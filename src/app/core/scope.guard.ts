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
