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

@Injectable({ providedIn: 'root' })
export class SessionService {
  // Access token stays in memory. Only the rotating refresh token survives
  // same-tab redirects (Stripe) in sessionStorage; never localStorage.
  private http = new HttpClient(inject(HttpBackend));
  private tokens: Tokens | null = null;
  private renewing?: Observable<Tokens>;
  private restoring?: Promise<void>;
  private sessionVersion = 0;
  private readonly storageKey = 'fashionstore.refresh';
  readonly user = signal<User | null>(null);
  readonly permissions = computed(
    () =>
      new Set(
        this.user()
          ?.roles.filter((r) => r.is_active !== false)
          .flatMap((r) => r.permissions.filter((p) => p.is_active !== false).map((p) => p.code)) ??
          [],
      ),
  );
  readonly administrative = computed(() => this.permissions().size > 0);
  get accessToken() {
    return this.tokens?.access_token;
  }
  can(permission?: string) {
    return !permission || this.permissions().has(permission);
  }
  private accept(tokens: Tokens) {
    this.tokens = tokens;
    this.user.set(tokens.user);
    try { sessionStorage.setItem(this.storageKey, tokens.refresh_token); } catch { /* memory-only fallback */ }
  }
  clear() {
    this.sessionVersion++;
    this.tokens = null;
    this.user.set(null);
    try { sessionStorage.removeItem(this.storageKey); } catch { /* storage unavailable */ }
  }
  restore(): Promise<void> {
    if (this.user()) return Promise.resolve();
    if (this.restoring) return this.restoring;
    let refreshToken: string | null = null;
    try { refreshToken = sessionStorage.getItem(this.storageKey); } catch { /* storage unavailable */ }
    if (!refreshToken) return Promise.resolve();
    const version = this.sessionVersion;
    this.restoring = firstValueFrom(this.request<Tokens>('refresh', { refresh_token: refreshToken }).pipe(timeout(10000)))
      .then(r => { if (version === this.sessionVersion) this.accept(r.data); })
      .catch(() => { if (version === this.sessionVersion) this.clear(); })
      .finally(() => { this.restoring = undefined; });
    return this.restoring;
  }
  login(email: string, password: string) {
    return this.request<Tokens>('login', { email: email.trim().toLowerCase(), password }).pipe(
      tap((r) => this.accept(r.data)),
    );
  }
  request<T>(action: string, body: unknown) {
    const headers = this.accessToken
      ? new HttpHeaders({ Authorization: `Bearer ${this.accessToken}` })
      : undefined;
    return this.http
      .post<ApiResponse<T>>(`${environment.apiUrl}/auth/${action}`, body, { headers })
      .pipe(
        catchError((error) => {
          if (action !== 'change-password' || error.status !== 401 || !this.tokens)
            return throwError(() => error);
          return this.refresh().pipe(
            switchMap(() =>
              this.http.post<ApiResponse<T>>(`${environment.apiUrl}/auth/${action}`, body, {
                headers: { Authorization: `Bearer ${this.accessToken}` },
              }),
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
        if (version !== this.sessionVersion) throw new Error('La sesión se cerró durante la renovación.');
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
    return this.http
      .get<ApiResponse<User>>(`${environment.apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      })
      .pipe(tap((r) => this.user.set(r.data)));
  }
}
