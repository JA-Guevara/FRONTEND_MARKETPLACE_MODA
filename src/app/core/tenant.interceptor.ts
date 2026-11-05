import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export function resolveCurrentTenantSlug(): string {
  if (typeof window !== 'undefined' && window.location) {
    const pathname = window.location.pathname || '';
    const match = pathname.match(/\/tienda\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return environment.tenantSlug;
}

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  if (
    req.url.startsWith(environment.apiUrl) &&
    /\/(catalog\/|public\/branches|commerce\/branches)/.test(req.url)
  ) {
    const slug = resolveCurrentTenantSlug();
    return next(req.clone({ setHeaders: { 'X-Tenant-Slug': slug } }));
  }
  return next(req);
};
