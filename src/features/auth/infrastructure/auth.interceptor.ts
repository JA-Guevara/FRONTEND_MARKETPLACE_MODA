import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { SessionService } from '../application/session.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (
    !(request.url === environment.apiUrl || request.url.startsWith(environment.apiUrl + '/')) ||
    !session.accessToken
  )
    return next(request);
  const authorize = () =>
    request.clone({ setHeaders: { Authorization: `Bearer ${session.accessToken}` } });
  return next(authorize()).pipe(
    catchError((error) => {
      if (error.status !== 401) return throwError(() => error);
      return session.refresh().pipe(
        catchError((refreshError) => {
          session.clear();
          void router.navigate(['/iniciar-sesion'], {
            queryParams: { returnUrl: router.url, expired: '1' },
          });
          return throwError(() => refreshError);
        }),
        switchMap(() => next(authorize()).pipe(catchError(retryError => {
          if (retryError.status === 401) {
            session.clear();
            void router.navigate(['/iniciar-sesion'], { queryParams: { returnUrl: router.url, expired: '1' } });
          }
          return throwError(() => retryError);
        }))),
      );
    }),
  );
};
