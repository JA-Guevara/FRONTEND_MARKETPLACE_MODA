import {
  saveOfflineProfile,
  readOfflineProfile,
  clearOfflineProfile,
} from '../../../app/core/offline/offline-session';
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import {
  Observable,
  catchError,
  finalize,
  map,
  shareReplay,
  switchMap,
  tap,
  throwError,
  firstValueFrom,
  timeout,
} from 'rxjs';
import { ApiResponse, Tokens, User } from '../../../shared/models';
import { environment } from '../../../environments/environment';
import { errorDeTiempoLimite } from '../../../shared/errors';
import { LIMITES_HTTP } from '../../../app/core/timeout.interceptor';
import { HttpErrorsState } from '../../../app/core/http-errors.interceptor';
import { SupportSessionStart } from '../../plataforma-saas/domain/soporte.models';

@Injectable({ providedIn: 'root' })
export class SessionService {
  // Access token stays in memory. Only the rotating refresh token survives
  // same-tab redirects (Stripe) in sessionStorage; never localStorage.
  private http = new HttpClient(inject(HttpBackend));
  // Este HttpClient se construye sobre HttpBackend a propósito (ver arriba), así
  // que SALTA toda la cadena de interceptores: el tiempo límite global no lo
  // cubre. Sin este límite propio, un backend congelado dejaba la pantalla de
  // inicio de sesión girando para siempre y `refresh()` sin resolver nunca.
  private limites = inject(LIMITES_HTTP);
  private operationalNotices = inject(HttpErrorsState);
  private conLimite<T>(peticion: Observable<T>, url: string) {
    return peticion.pipe(
      timeout({
        each: this.limites.normal,
        with: () => throwError(() => errorDeTiempoLimite(url)),
      }),
      catchError(error => { this.operationalNotices.failed(error); return throwError(() => error); }),
    );
  }
  private tokens: Tokens | null = null;
  private renewing?: Observable<Tokens>;
  private restoring?: Promise<void>;
  private sessionVersion = 0;
  private readonly storageKey = 'fashionstore.refresh';
  private readonly supportStorageKey = 'fashionstore.support';

  readonly user = signal<User | null>(null);
  readonly offlineSession = signal(false);
  readonly support = signal<SupportSessionStart | null>(null);

  readonly isSupport = computed(() => !!this.support());
  readonly tenant = computed(() => this.support()?.tenant ?? this.user()?.tenant ?? null);
  readonly subscription = computed(
    () => this.support()?.subscription ?? this.user()?.subscription ?? null,
  );

  private basePermissions = computed(
    () =>
      new Set(
        this.user()
          ?.roles.filter((r) => r.is_active !== false)
          .flatMap((r) => r.permissions.filter((p) => p.is_active !== false).map((p) => p.code)) ??
          [],
      ),
  );

  baseCan(permission?: string): boolean {
    return !permission || this.basePermissions().has(permission);
  }

  readonly isPlatformAdmin = computed(
    () => !this.user()?.tenant && this.baseCan('tenants.read'),
  );

  readonly readOnly = computed(() => {
    if (this.user()?.read_only || this.support()?.session.mode === 'READ_ONLY') return true;
    const s = this.subscription();
    if (!s) return false;
    if (s.lifecycle_state === 'read_only' || s.lifecycle_state === 'canceled') return true;
    if (s.lifecycle_state === 'grace' || s.lifecycle_state === 'active' || s.lifecycle_state === 'expiring') return false;
    const end = new Date(s.end_date + 'T23:59:59');
    return s.status !== 'ACTIVA' || end.getTime() < Date.now();
  });

  readonly modules = computed(() => this.subscription()?.modules ?? []);

  hasFeature(code: string) {
    const subscription = this.subscription();
    // Una respuesta nueva enumera los módulos efectivos, incluidos extras/pruebas.
    // La ausencia del campo conserva compatibilidad con perfiles locales anteriores.
    return subscription?.modules !== undefined
      ? subscription.modules.some((module) => module.code === code)
      : subscription?.features[code] === true;
  }

  readonly permissions = computed(() =>
    this.support() ? new Set(this.support()!.permissions) : this.basePermissions(),
  );

  readonly administrative = computed(() => this.permissions().size > 0);

  readonly scope = computed<'platform' | 'tenant'>(() =>
    this.isPlatformAdmin() && !this.isSupport() ? 'platform' : 'tenant',
  );

  get accessToken(): string | undefined {
    const s = this.support();
    if (s) {
      const expiresAt = new Date(s.session.expires_at).getTime();
      if (expiresAt > Date.now()) {
        return s.access_token;
      }
    }
    return this.tokens?.access_token;
  }

  can(permission?: string) {
    return !permission || this.permissions().has(permission);
  }

  constructor() {
    try {
      const raw = sessionStorage.getItem(this.supportStorageKey);
      if (raw) {
        const parsed: SupportSessionStart = JSON.parse(raw);
        if (new Date(parsed.session?.expires_at).getTime() > Date.now()) {
          this.support.set(parsed);
        } else {
          sessionStorage.removeItem(this.supportStorageKey);
        }
      }
    } catch {
      /* storage unavailable or parse error */
    }
  }

  startSupport(start: SupportSessionStart): void {
    this.support.set(start);
    try {
      sessionStorage.setItem(this.supportStorageKey, JSON.stringify(start));
    } catch {
      /* storage unavailable */
    }
  }

  endSupport(): void {
    this.support.set(null);
    try {
      sessionStorage.removeItem(this.supportStorageKey);
    } catch {
      /* storage unavailable */
    }
  }

  private accept(tokens: Tokens) {
    this.tokens = tokens;
    this.user.set(tokens.user);
    this.offlineSession.set(false);
    if (!this.isSupport()) {
      void saveOfflineProfile(tokens.user).catch(() => {});
    }
    try {
      sessionStorage.setItem(this.storageKey, tokens.refresh_token);
    } catch {
      /* memory-only fallback */
    }
  }

  clear() {
    this.sessionVersion++;
    this.tokens = null;
    this.user.set(null);
    this.offlineSession.set(false);
    this.endSupport();
    void clearOfflineProfile().catch(() => {});
    try {
      sessionStorage.removeItem(this.storageKey);
    } catch {
      /* storage unavailable */
    }
  }

  restore(): Promise<void> {
    if (this.user() && !this.offlineSession()) return Promise.resolve();
    if (this.restoring) return this.restoring;
    let refreshToken: string | null = null;
    try {
      refreshToken = sessionStorage.getItem(this.storageKey);
    } catch {
      /* storage unavailable */
    }
    if (!navigator.onLine) {
      const version = this.sessionVersion;
      return readOfflineProfile()
        .then((u) => {
          if (version === this.sessionVersion && u?.is_active && u.tenant?.status === 'ACTIVA') {
            this.user.set(u);
            this.offlineSession.set(true);
          }
        })
        .catch(() => {});
    }
    if (!refreshToken) return Promise.resolve();
    const version = this.sessionVersion;
    this.restoring = firstValueFrom(
      this.request<Tokens>('refresh', { refresh_token: refreshToken }).pipe(timeout(10000)),
    )
      .then((r) => {
        if (version === this.sessionVersion) this.accept(r.data);
      })
      .catch(async (error) => {
        if (version !== this.sessionVersion) return;
        if (error.status === 0 || error.name === 'TimeoutError') {
          const profile = await readOfflineProfile().catch(() => null);
          if (version !== this.sessionVersion) return;
          if (profile?.is_active && profile.tenant?.status === 'ACTIVA') {
            this.tokens = null;
            this.user.set(profile);
            this.offlineSession.set(true);
            return;
          }
        }
        this.clear();
      })
      .finally(() => {
        this.restoring = undefined;
      });
    return this.restoring;
  }

  login(email: string, password: string, tenantSlug?: string, platform = false) {
    return this.request<Tokens>('login', { email: email.trim().toLowerCase(), password,
      ...(tenantSlug ? { tenant_slug: tenantSlug } : {}), ...(platform ? { platform_login: true } : {}),
    }).pipe(
      tap((r) => this.accept(r.data)),
    );
  }

  request<T>(action: string, body: unknown, tenantSlug = environment.tenantSlug) {
    const headers = this.accessToken
      ? new HttpHeaders({
          Authorization: `Bearer ${this.accessToken}`,
          ...(action === 'register' ? { 'X-Tenant-Slug': tenantSlug } : {}),
        })
      : action === 'register'
        ? new HttpHeaders({ 'X-Tenant-Slug': tenantSlug })
        : undefined;
    const url = `${environment.apiUrl}/auth/${action}`;
    // El límite envuelve cada envío por separado, no la cadena entera: el
    // reintento posterior a la renovación estrena su propio reloj, igual que en
    // timeoutInterceptor.
    return this.conLimite(this.http.post<ApiResponse<T>>(url, body, { headers }), url).pipe(
      catchError((error) => {
        if (action !== 'change-password' || error.status !== 401 || !this.tokens)
          return throwError(() => error);
        return this.refresh().pipe(
          switchMap(() =>
            this.conLimite(
              this.http.post<ApiResponse<T>>(url, body, {
                headers: { Authorization: `Bearer ${this.accessToken}` },
              }),
              url,
            ),
          ),
        );
      }),
    );
  }

  refresh(): Observable<Tokens> {
    if (this.renewing) return this.renewing;
    if (!this.tokens) return throwError(() => new Error('Iniciá sesión para continuar.'));
    const version = this.sessionVersion;
    this.renewing = this.request<Tokens>('refresh', {
      refresh_token: this.tokens.refresh_token,
    }).pipe(
      map((r) => r.data),
      tap((t) => {
        if (version !== this.sessionVersion)
          throw new Error('La sesión se cerró durante la renovación.');
        this.accept(t);
      }),
      finalize(() => (this.renewing = undefined)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.renewing;
  }

  logout() {
    const refresh_token = this.tokens?.refresh_token;
    return this.request<null>('logout', { refresh_token }).pipe(finalize(() => this.clear()));
  }

  reloadUser() {
    const url = `${environment.apiUrl}/auth/me`;
    return this.conLimite(
      this.http.get<ApiResponse<User>>(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }),
      url,
    ).pipe(
      tap((r) => {
        this.user.set(r.data);
        if (!this.isSupport()) {
          void saveOfflineProfile(r.data).catch(() => {});
        }
      }),
    );
  }
}
