import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../../features/usuarios-catalogo/application/session.service';
export const authGuard: CanActivateFn = (route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (!session.user())
    return router.createUrlTree(['/iniciar-sesion'], { queryParams: { returnUrl: state.url } });
  return session.can(route.data['permission']) || router.createUrlTree(['/sin-acceso']);
};

