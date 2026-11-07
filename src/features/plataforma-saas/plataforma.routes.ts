import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import { authGuard } from '../../app/core/auth.guard';
import { platformScopeGuard } from '../../app/core/scope.guard';
import { organizationResources } from '../inventario-sucursales/application/resources';
import { Resource } from '../../shared/form-schema';

const citiesBase = organizationResources.find((r) => r.key === 'cities');
export const citiesResource: Resource = {
  ...(citiesBase ?? {
    key: 'cities',
    title: 'Ciudades',
    singular: 'ciudad',
    feminine: true,
    path: '/organization/cities',
    group: 'Organización',
    columns: [
      { key: 'name', label: 'Ciudad' },
      { key: 'department', label: 'Departamento' },
      { key: 'country', label: 'País' },
    ],
    fields: [],
  }),
  permission: 'cities.write',
  writePermission: 'cities.write',
};

export const PLATAFORMA_ROUTES: Routes = [
  {
    path: 'plataforma/empresas/:id/datos',
    title: 'Datos y respaldos de empresa | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'platform.ops.read' },
    loadComponent: () =>
      import('../admin-empresa/presentation/datos-respaldos.component').then(
        (m) => m.DatosRespaldosComponent,
      ),
  },
  {
    path: 'plataforma/operacion/continuidad',
    title: 'Copias globales | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'platform.ops.read' },
    loadComponent: () =>
      import('./presentation/continuidad-page.component').then((m) => m.ContinuidadPageComponent),
  },
  {
    path: 'plataforma/operacion/despliegues',
    title: 'Diagnóstico técnico | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'platform.ops.read' },
    loadComponent: () =>
      import('./presentation/despliegues-page.component').then((m) => m.DesplieguesPageComponent),
  },
  {
    path: 'plataforma/operacion/salud',
    title: 'Estado del sistema | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'platform.ops.read' },
    loadComponent: () =>
      import('./presentation/salud-page.component').then((m) => m.SaludPageComponent),
  },
  {
    path: 'plataforma',
    title: 'Tablero | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'subscriptions.read' },
    loadComponent: () =>
      import('./presentation/analitica-plataforma.component').then(
        (m) => m.AnaliticaPlataformaComponent,
      ),
  },
  {
    path: 'plataforma/empresas',
    title: 'Empresas y suscripciones | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'tenants.read' },
    loadComponent: () =>
      import('./presentation/empresas-page.component').then((m) => m.EmpresasPageComponent),
  },
  {
    path: 'plataforma/suscripciones',
    redirectTo: () =>
      inject(Router).createUrlTree(['/admin/plataforma/empresas'], {
        queryParams: { filtro: 'por_vencer' },
      }),
    pathMatch: 'full',
  },
  {
    path: 'plataforma/empresas/:id',
    title: 'Empresa 360° | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'tenants.read' },
    loadComponent: () =>
      import('./presentation/empresa-360.component').then((m) => m.Empresa360Component),
  },
  {
    path: 'plataforma/empresas/:id/suscripcion',
    title: 'Suscripción de empresa | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'subscriptions.read' },
    loadComponent: () =>
      import('./presentation/suscripcion-empresa.component').then(
        (m) => m.SuscripcionEmpresaComponent,
      ),
  },
  {
    path: 'plataforma/planes',
    title: 'Planes | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'plans.read' },
    loadComponent: () =>
      import('./presentation/planes-page.component').then((m) => m.PlanesPageComponent),
  },
  {
    path: 'plataforma/modulos',
    title: 'Módulos | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'modules.read' },
    loadComponent: () =>
      import('./presentation/modulos-page.component').then((m) => m.ModulosPageComponent),
  },
  {
    path: 'plataforma/demo',
    title: 'Empresa Demo (Sandbox) | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'sandbox.manage' },
    loadComponent: () =>
      import('./presentation/demo-sandbox.component').then((m) => m.DemoSandboxComponent),
  },
  {
    path: 'plataforma/roles',
    title: 'Plantillas de Roles | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'platform_roles.read' },
    loadComponent: () =>
      import('./presentation/plantillas-roles.component').then((m) => m.PlantillasRolesComponent),
  },
  {
    path: 'plataforma/equipo',
    title: 'Equipo de plataforma | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'platform_users.write' },
    loadComponent: () =>
      import('./presentation/administradores.component').then((m) => m.AdministradoresComponent),
  },
  {
    path: 'plataforma/usuarios',
    title: 'Usuarios globales | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'platform_users.read' },
    loadComponent: () =>
      import('./presentation/usuarios-globales.component').then((m) => m.UsuariosGlobalesComponent),
  },
  {
    path: 'plataforma/administradores',
    redirectTo: 'plataforma/equipo',
    pathMatch: 'full',
  },
  {
    path: 'plataforma/auditoria',
    title: 'Auditoría global | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'platform_audit.read' },
    loadComponent: () =>
      import('./presentation/auditoria-global.component').then((m) => m.AuditoriaGlobalComponent),
  },
  {
    path: 'plataforma/soporte',
    title: 'Sesiones de soporte | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { permission: 'platform_audit.read' },
    loadComponent: () =>
      import('./presentation/sesiones-soporte.component').then((m) => m.SesionesSoporteComponent),
  },
  {
    path: 'plataforma/ciudades',
    title: 'Ciudades | Plataforma SaaS',
    canActivate: [authGuard, platformScopeGuard],
    data: { resource: citiesResource, permission: 'cities.write' },
    loadComponent: () =>
      import('../../shared/resource-page.component').then((m) => m.ResourcePageComponent),
  },
];
