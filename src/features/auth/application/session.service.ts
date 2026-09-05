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
} from 'rxjs';
import { ApiResponse, Tokens, User } from '../../../shared/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SessionService {
  // The API supplies bearer tokens, not HttpOnly cookies. Keep both in memory.
  private http = new HttpClient(inject(HttpBackend));
  private tokens: Tokens | null = null;
  private renewing?: Observable<Tokens>;
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
  }
  clear() {
    this.tokens = null;
    this.user.set(null);
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
    this.renewing = this.request<Tokens>('refresh', {
      refresh_token: this.tokens.refresh_token,
    }).pipe(
      map((r) => r.data),
      tap((t) => this.accept(t)),
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
