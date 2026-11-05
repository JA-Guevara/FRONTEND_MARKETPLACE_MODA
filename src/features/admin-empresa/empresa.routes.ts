import { Routes } from '@angular/router';
import { authGuard } from '../../app/core/auth.guard';
import { tenantScopeGuard } from '../../app/core/scope.guard';

export const EMPRESA_ROUTES: Routes = [
  {
    path: '',
    title: 'Panel | FashionStore',
    canActivate: [authGuard, tenantScopeGuard],
    loadComponent: () =>
      import('./presentation/panel-empresa.component').then(
        (m) => m.PanelEmpresaComponent
      ),
  },
  {
    path: 'roles',
    title: 'Roles y permisos | FashionStore',
    canActivate: [authGuard, tenantScopeGuard],
    data: { permission: 'roles.read' },
    loadComponent: () =>
      import('./presentation/roles-empresa.component').then(
        (m) => m.RolesEmpresaComponent
      ),
  },
  {
    path: 'empresa/perfil',
    title: 'Perfil de empresa | FashionStore',
    canActivate: [authGuard, tenantScopeGuard],
    data: { permission: 'my_subscription.read' },
    loadComponent: () =>
      import('./presentation/perfil-empresa.component').then(
        (m) => m.PerfilEmpresaComponent
      ),
  },
  {
    path: 'empresa/accesos-soporte',
    title: 'Accesos de soporte | FashionStore',
    canActivate: [authGuard, tenantScopeGuard],
    data: { permission: 'support_sessions.read' },
    loadComponent: () =>
      import('./presentation/accesos-soporte.component').then(
        (m) => m.AccesosSoporteComponent
      ),
  },
  {
    path: 'empresa/dispositivos',
    title: 'Dispositivos | FashionStore',
    canActivate: [authGuard, tenantScopeGuard],
    data: { permission: 'devices.read' },
    loadComponent: () =>
      import('./presentation/dispositivos.component').then(
        (m) => m.DispositivosComponent
      ),
  },
  {
    path: 'mi-suscripcion',
    title: 'Mi suscripción | FashionStore',
    canActivate: [authGuard, tenantScopeGuard],
    data: { permission: 'my_subscription.read' },
    loadComponent: () =>
      import('../plataforma-saas/presentation/mi-suscripcion.component').then(
        (m) => m.MiSuscripcionComponent
      ),
  },
];
