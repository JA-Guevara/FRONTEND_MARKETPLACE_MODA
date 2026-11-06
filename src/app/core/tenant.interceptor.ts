import { inject } from '@angular/core';
import { SessionService } from '../../features/usuarios-catalogo/application/session.service';
import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export function resolveStoreSlug(url: string): string | undefined {
  const match = url.split(/[?#]/, 1)[0].match(/^\/tienda\/([a-zA-Z0-9_-]+)(?:\/|$)/);
  const query = new URLSearchParams(url.split('?')[1]?.split('#')[0] ?? '').get('tienda');
  return match?.[1] ?? (query && /^[a-z0-9][a-z0-9_-]{0,59}$/.test(query) ? query : undefined);
}

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  if (
    req.url.startsWith(environment.apiUrl) &&
    !req.headers.has('X-Tenant-Slug') &&
    /\/(catalog\/|organization\/public\/branches|commerce\/|vestidor\/|tryon-ai\/)/.test(req.url.slice(environment.apiUrl.length))
  ) {
    const url = typeof window === 'undefined' ? '' : window.location.pathname + window.location.search;
    const slug = resolveStoreSlug(url) ?? inject(SessionService).tenant()?.slug ?? environment.tenantSlug;
    return next(req.clone({ setHeaders: { 'X-Tenant-Slug': slug } }));
  }
  return next(req);
};
