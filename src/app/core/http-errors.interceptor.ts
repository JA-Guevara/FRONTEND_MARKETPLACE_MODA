import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { catchError, tap, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HttpErrorsState {
  readonly apiEnvironment = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly maintenance = signal(false);

  environment(value: string | null): void {
    if (value && ['local', 'test', 'staging', 'production'].includes(value)) this.apiEnvironment.set(value);
  }

  failed(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) return;
    this.environment(error.headers.get('X-App-Env'));
    if (error.status === 429) {
      const header = error.headers.get('Retry-After');
      const numeric = header !== null && /^\d+$/.test(header) ? Number(header) : null;
      const date = header ? Date.parse(header) : NaN;
      const seconds = numeric ?? (Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : null);
      this.notice.set(seconds === null ? 'Demasiados intentos. Espera antes de reintentar.' : `Demasiados intentos, espera ${seconds} s.`);
    }
    if (error.status === 503 && error.error?.error?.code === 'maintenance') {
      this.maintenance.set(true);
      this.notice.set('Estamos realizando mantenimiento. Tus operaciones pendientes se conservan.');
    }
  }

  dismiss(): void { this.notice.set(null); this.maintenance.set(false); }
}

export const httpErrorsInterceptor: HttpInterceptorFn = (req, next) => {
  const state = inject(HttpErrorsState);
  return next(req).pipe(
    tap(event => { if (event instanceof HttpResponse) state.environment(event.headers.get('X-App-Env')); }),
    catchError(error => { state.failed(error); return throwError(() => error); }),
  );
};
