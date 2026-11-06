import { Routes } from '@angular/router';
import { authGuard } from '../../app/core/auth.guard';
import { tenantScopeGuard } from '../../app/core/scope.guard';

export const EMPRESA_ROUTES: Routes = [
  {
    path: 'empresa/cobros',
    title: 'Cobros con tarjeta | FashionStore',
    canActivate: [tenantScopeGuard, authGuard],
    data: { permission: 'payment_methods.write' },
    loadComponent: () => import('./presentation/cobros-tarjeta.component').then(m => m.CobrosTarjetaComponent),
  },
  {
    path: 'empresa/suscripcion',
    title: 'Mi suscripción | FashionStore',
    canActivate: [tenantScopeGuard, authGuard],
    data: { permission: 'my_subscription.read' },
    loadComponent: () => import('../plataforma-saas/presentation/mi-suscripcion.component').then(m => m.MiSuscripcionComponent),
  },
  {
    path: '',
    title: 'Panel | FashionStore',
    canActivate: [tenantScopeGuard, authGuard],
    loadComponent: () =>
      import('./presentation/panel-empresa.component').then(
        (m) => m.PanelEmpresaComponent
      ),
  },
  {
    path: 'permissions',
    title: 'Catálogo de permisos | FashionStore',
    canActivate: [tenantScopeGuard, authGuard],
    data: { permission: 'roles.read', permissionsCatalog: true },
    loadComponent: () => import('./presentation/roles-empresa.component').then(m => m.RolesEmpresaComponent),
  },
  {
    path: 'roles',
    title: 'Roles y permisos | FashionStore',
    canActivate: [tenantScopeGuard, authGuard],
    data: { permission: 'roles.read' },
    loadComponent: () =>
      import('./presentation/roles-empresa.component').then(
        (m) => m.RolesEmpresaComponent
      ),
  },
  {
    path: 'empresa/perfil',
    title: 'Perfil de empresa | FashionStore',
    canActivate: [tenantScopeGuard, authGuard],
    data: { permission: 'my_subscription.read' },
    loadComponent: () =>
      import('./presentation/perfil-empresa.component').then(
        (m) => m.PerfilEmpresaComponent
      ),
  },
  {
    path: 'empresa/accesos-soporte',
    title: 'Accesos de soporte | FashionStore',
    canActivate: [tenantScopeGuard, authGuard],
    data: { permission: 'support_sessions.read' },
    loadComponent: () =>
      import('./presentation/accesos-soporte.component').then(
        (m) => m.AccesosSoporteComponent
      ),
  },
  {
    path: 'empresa/dispositivos',
    title: 'Dispositivos | FashionStore',
    canActivate: [tenantScopeGuard, authGuard],
    data: { permission: 'devices.read' },
    loadComponent: () =>
      import('./presentation/dispositivos.component').then(
        (m) => m.DispositivosComponent
      ),
  },
  {
    path: 'empresa/integraciones',
    title: 'Integraciones | FashionStore',
    canActivate: [tenantScopeGuard, authGuard],
    data: { permission: 'integrations.read' },
    loadComponent: () =>
      import('./presentation/integraciones.component').then(
        (m) => m.IntegracionesComponent
      ),
  },
  {
    path: 'mi-suscripcion',
    title: 'Mi suscripción | FashionStore',
    canActivate: [tenantScopeGuard, authGuard],
    data: { permission: 'my_subscription.read' },
    loadComponent: () =>
      import('../plataforma-saas/presentation/mi-suscripcion.component').then(
        (m) => m.MiSuscripcionComponent
      ),
  },
];
