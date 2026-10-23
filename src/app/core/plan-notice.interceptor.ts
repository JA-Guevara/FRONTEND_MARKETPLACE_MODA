import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { PlanNoticeService } from './plan-notice.service';
export const planNoticeInterceptor: HttpInterceptorFn = (req, next) => {
  const notices = inject(PlanNoticeService);
  return next(req).pipe(
    catchError((error) => {
      const body = error.error?.error ?? error.error;
      const code = body?.code;
      if (['plan_limit_exceeded', 'feature_not_in_plan', 'subscription_inactive'].includes(code))
        notices.show(code, body.details ?? {});
      return throwError(() => error);
    }),
  );
};
