import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';
export const tenantInterceptor: HttpInterceptorFn = (req, next) =>
  next(
    req.url.startsWith(environment.apiUrl) &&
      /\/(catalog\/|public\/branches|commerce\/branches)/.test(req.url)
      ? req.clone({ setHeaders: { 'X-Tenant-Slug': environment.tenantSlug } })
      : req,
  );
