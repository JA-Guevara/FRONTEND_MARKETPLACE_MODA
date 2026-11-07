import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../../features/usuarios-catalogo/application/session.service';

export const platformScopeGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (session.scope() === 'platform') {
    return true;
  }
  return router.parseUrl('/admin');
};

export const tenantScopeGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (session.scope() === 'tenant') {
    return true;
  }
  return router.parseUrl('/admin/plataforma');
};

export const administrativeGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (!session.user()) {
    return router.parseUrl('/iniciar-sesion');
  }
  if (session.isClient?.() || !session.administrative()) {
    const slug = session.tenant()?.slug;
    return router.parseUrl(slug ? `/tienda/${slug}` : '/mi-cuenta');
  }
  return true;
};
