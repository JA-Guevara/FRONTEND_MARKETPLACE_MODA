import { offlineGuard } from './offline/offline-session';
import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { administrativeGuard, platformScopeGuard, tenantScopeGuard } from './scope.guard';
import { resources } from './shared/resources';
import { addressesResource } from '../../features/usuarios-catalogo/application/resources';
import { PLATAFORMA_ROUTES } from '../../features/plataforma-saas/plataforma.routes';
import { EMPRESA_ROUTES } from '../../features/admin-empresa/empresa.routes';

const auth = () =>
  import('../../features/usuarios-catalogo/presentation/auth-page.component').then(
    (m) => m.AuthPageComponent
  );
const resource = () =>
  import('../../shared/resource-page.component').then((m) => m.ResourcePageComponent);

export const routes: Routes = [
  {
    path: 'sin-conexion/venta',
    canActivate: [offlineGuard],
    data: { permission: 'commerce.write' },
    loadComponent: () => import('../../features/operacion-offline/presentation/venta-offline.component')
      .then(component => component.VentaOfflineComponent),
  },
  {
    path: 'sin-conexion',
    canActivate: [offlineGuard],
    loadComponent: () =>
      import(
        '../../features/operacion-offline/presentation/preparar-offline.component'
      ).then((m) => m.PrepararOfflineComponent),
  },
  {
    path: 'sin-conexion/catalogo',
    canActivate: [offlineGuard],
    loadComponent: () =>
      import(
        '../../features/operacion-offline/presentation/catalogo-offline.component'
      ).then((m) => m.CatalogoOfflineComponent),
  },
  {
    path: 'sin-conexion/reservar',
    canActivate: [offlineGuard],
    loadComponent: () =>
      import(
        '../../features/operacion-offline/presentation/reserva-offline.component'
      ).then((m) => m.ReservaOfflineComponent),
  },
  {
    path: 'sin-conexion/reservas',
    canActivate: [offlineGuard],
    loadComponent: () =>
      import(
        '../../features/operacion-offline/presentation/reservas-locales.component'
      ).then((m) => m.ReservasLocalesComponent),
  },
  {
    path: 'sin-conexion/operaciones',
    canActivate: [offlineGuard],
    loadComponent: () =>
      import(
        '../../features/operacion-offline/presentation/operaciones-pendientes.component'
      ).then((m) => m.OperacionesPendientesComponent),
  },
  {
    path: 'sin-conexion/reservas/:id',
    canActivate: [offlineGuard],
    loadComponent: () =>
      import(
        '../../features/operacion-offline/presentation/comprobante-reserva.component'
      ).then((m) => m.ComprobanteReservaComponent),
  },
  {
    path: 'carrito',
    title: 'Mi carrito | FashionStore',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../../features/ventas-pagos/presentation/cart-page.component').then(
        (m) => m.CartPageComponent
      ),
  },
  {
    path: '',
    title: 'FashionStore SaaS · Plataforma Omnicanal para Marcas de Moda',
    loadComponent: () =>
      import('../../features/operacion-offline/presentation/catalogo-adaptable.component')
        .then((m) => m.CatalogoAdaptableComponent),
  },
  {
    path: 'crear-tienda',
    title: 'Crea tu tienda | FashionStore',
    loadComponent: () =>
      import(
        '../../features/publico/presentation/crear-tienda.component'
      ).then((m) => m.CrearTiendaComponent),
  },
  {
    path: 'legal/terminos',
    title: 'Términos del Servicio | FashionStore',
    loadComponent: () =>
      import(
        '../../features/publico/presentation/legal-page.component'
      ).then((m) => m.LegalPageComponent),
    data: { docType: 'terminos' },
  },
  {
    path: 'legal/privacidad',
    title: 'Política de Privacidad | FashionStore',
    loadComponent: () =>
      import(
        '../../features/publico/presentation/legal-page.component'
      ).then((m) => m.LegalPageComponent),
    data: { docType: 'privacidad' },
  },
  {
    path: 'tienda/:tenantSlug',
    title: 'Catálogo de tienda | FashionStore',
    loadComponent: () =>
      import(
        '../../features/operacion-offline/presentation/catalogo-adaptable.component'
      ).then((m) => m.CatalogoAdaptableComponent),
  },
  {
    path: 'tienda/:tenantSlug/prendas/:slug/vestidor',
    title: 'Vestidor virtual | FashionStore',
    loadComponent: () =>
      import('../../features/reservas-vestidor/presentation/vestidor.component')
        .then((m) => m.VestidorComponent),
  },
  {
    path: 'tienda/:tenantSlug/prendas/:slug',
    title: 'Prenda | FashionStore',
    loadComponent: () =>
      import(
        '../../features/usuarios-catalogo/presentation/product-page.component'
      ).then((m) => m.ProductPageComponent),
  },
  {
    path: 'tienda/:tenantSlug/sucursales',
    title: 'Sucursales de la tienda | FashionStore',
    loadComponent: () =>
      import(
        '../../features/inventario-sucursales/presentation/branches-page.component'
      ).then((m) => m.BranchesPageComponent),
  },
  {
    path: 'prendas/:slug',
    title: 'Prenda | FashionStore',
    loadComponent: () =>
      import(
        '../../features/usuarios-catalogo/presentation/product-page.component'
      ).then((m) => m.ProductPageComponent),
  },
  {
    path: 'sucursales',
    title: 'Sucursales | FashionStore',
    loadComponent: () =>
      import(
        '../../features/inventario-sucursales/presentation/branches-page.component'
      ).then((m) => m.BranchesPageComponent),
  },
  {
    path: 'iniciar-sesion',
    title: 'Iniciar sesión | FashionStore',
    loadComponent: auth,
    data: { mode: 'login' },
  },
  {
    path: 'registrarse',
    title: 'Crear cuenta | FashionStore',
    loadComponent: auth,
    data: { mode: 'register' },
  },
  {
    path: 'recuperar-contrasena',
    title: 'Recuperar contraseña | FashionStore',
    loadComponent: auth,
    data: { mode: 'forgot' },
  },
  {
    path: 'verificar-correo',
    title: 'Verificar correo | FashionStore',
    loadComponent: auth,
    data: { mode: 'verify' },
  },
  {
    path: 'reenviar-verificacion',
    title: 'Verificación | FashionStore',
    loadComponent: auth,
    data: { mode: 'resend' },
  },
  { path: 'cambiar-contrasena', redirectTo: 'mi-cuenta/seguridad', pathMatch: 'full' },
  {
    // Espacio personal del cliente: un solo módulo con menú propio.
    path: 'mi-cuenta',
    loadComponent: () =>
      import(
        '../../features/usuarios-catalogo/presentation/account-layout.component'
      ).then((m) => m.AccountLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        title: 'Mi perfil | FashionStore',
        loadComponent: () =>
          import(
            '../../features/usuarios-catalogo/presentation/account-page.component'
          ).then((m) => m.AccountPageComponent),
      },
      {
        path: 'direcciones',
        title: 'Mis direcciones | FashionStore',
        loadComponent: resource,
        data: { resource: addressesResource },
      },
      {
        path: 'pedidos',
        title: 'Mis pedidos | FashionStore',
        loadComponent: () =>
          import('../../features/ventas-pagos/presentation/orders-page.component').then(
            (m) => m.OrdersPageComponent
          ),
      },
      {
        path: 'favoritos',
        title: 'Mis favoritos | FashionStore',
        loadComponent: () =>
          import(
            '../../features/ventas-pagos/presentation/favorites-page.component'
          ).then((m) => m.FavoritesPageComponent),
      },
      {
        path: 'reservas',
        title: 'Mis reservas | FashionStore',
        loadComponent: () =>
          import(
            '../../features/reservas-vestidor/presentation/mis-reservas.component'
          ).then((m) => m.MisReservasComponent),
      },
      {
        path: 'seguridad',
        title: 'Seguridad | FashionStore',
        loadComponent: auth,
        data: { mode: 'change' },
      },
      {
        path: 'sesiones',
        title: 'Sesiones activas | FashionStore',
        loadComponent: () =>
          import(
            '../../features/cuenta/presentation/sesiones.component'
          ).then((m) => m.SesionesComponent),
      },
    ],
  },
  {
    path: 'reservar',
    title: 'Nueva reserva | FashionStore',
    loadComponent: () =>
      import(
        '../../features/reservas-vestidor/presentation/nueva-reserva.component'
      ).then((m) => m.NuevaReservaComponent),
    canActivate: [authGuard],
  },
  {
    path: 'prendas/:slug/vestidor',
    title: 'Vestidor virtual | FashionStore',
    loadComponent: () =>
      import(
        '../../features/reservas-vestidor/presentation/vestidor.component'
      ).then((m) => m.VestidorComponent),
  },
  { path: 'mi-empresa/roles', redirectTo: 'admin/roles', pathMatch: 'full' },
  {
    path: 'admin',
    loadComponent: () =>
      import('./layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    canActivate: [authGuard, administrativeGuard],
    children: [
      ...PLATAFORMA_ROUTES,
      ...EMPRESA_ROUTES,
      {
        path: 'dashboard',
        title: 'Centro de reportes | FashionStore',
        canActivate: [tenantScopeGuard, authGuard],
        data: { permission: 'dashboard.read' },
        loadComponent: () =>
          import('../../features/ia-reportes/presentation/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'analitica-ml',
        title: 'Analítica predictiva ML | FashionStore',
        canActivate: [tenantScopeGuard, authGuard],
        data: { permission: 'ml_dashboard.read', feature: 'ml_analytics' },
        loadComponent: () =>
          import('../../features/analitica-ml/presentation/dashboard-analitico.component').then(
            (m) => m.DashboardAnaliticoComponent
          ),
      },
      {
        path: 'plataforma/ml',
        title: 'Modelos de Machine Learning | FashionStore',
        canActivate: [platformScopeGuard, authGuard],
        data: { permission: 'ml_models.manage' },
        loadComponent: () =>
          import('../../features/analitica-ml/presentation/modelos-analiticos.component').then(
            (m) => m.ModelosAnaliticosComponent
          ),
      },
      {
        path: 'pedidos',
        title: 'Pedidos y pagos | FashionStore',
        canActivate: [tenantScopeGuard, authGuard],
        data: { admin: true, permission: 'commerce.read' },
        loadComponent: () =>
          import('../../features/ventas-pagos/presentation/orders-page.component').then(
            (m) => m.OrdersPageComponent
          ),
      },
      {
        path: 'promociones',
        title: 'Cupones y promociones | FashionStore',
        canActivate: [tenantScopeGuard, authGuard],
        data: { admin: true, permission: 'commerce.read' },
        loadComponent: () =>
          import(
            '../../features/ventas-pagos/presentation/promotions-page.component'
          ).then((m) => m.PromotionsPageComponent),
      },
      {
        path: 'stock',
        title: 'Existencias | FashionStore',
        canActivate: [tenantScopeGuard, authGuard],
        data: { permission: 'stock.read' },
        loadComponent: () =>
          import('../../features/ventas-pagos/presentation/stock-page.component').then(
            (m) => m.StockPageComponent
          ),
      },
      {
        path: 'caja',
        title: 'Caja | FashionStore',
        canActivate: [tenantScopeGuard, authGuard],
        data: { permission: 'commerce.write' },
        loadComponent: () =>
          import('../../features/ventas-pagos/presentation/pos-page.component').then(
            (m) => m.PosPageComponent
          ),
      },
      ...Object.entries({
        sucursales: 'branches', cajas: 'cash-points', ciudades: 'cities',
        categorias: 'categories', tallas: 'sizes', colores: 'colors',
        temporadas: 'seasons', colecciones: 'collections', proveedores: 'suppliers',
        usuarios: 'users', permisos: 'permissions', prendas: 'products',
        'vestidor-virtual': 'probador',
      }).map(([path, redirectTo]) => ({ path, redirectTo, pathMatch: 'full' as const })),
      ...(['abastecimiento', 'recursos-ar'] as const).map((path) => ({
        path,
        title: path === 'abastecimiento' ? 'Abastecimiento | FashionStore' : 'Recursos 3D / AR | FashionStore',
        canActivate: [tenantScopeGuard, authGuard],
        loadComponent: resource,
        data: {
          permission: 'catalog.read',
          productSection: path,
          resource: {
            ...resources.find((r) => r.key === 'products')!,
            title: path === 'abastecimiento' ? 'Abastecimiento' : 'Recursos 3D / AR',
          },
        },
      })),
      ...resources.map((r) => ({
          path: r.key,
          title: r.title + ' | FashionStore',
          loadComponent: resource,
          canActivate: [tenantScopeGuard, authGuard],
          data: { resource: r, permission: r.permission, readOnlyResource: r.key === 'cities' },
        })),
      {
        path: 'products/:id',
        title: 'Recursos de la prenda | FashionStore',
        loadComponent: () =>
          import(
            '../../features/usuarios-catalogo/presentation/product-editor.component'
          ).then((m) => m.ProductEditorComponent),
        canActivate: [tenantScopeGuard, authGuard],
        data: { permission: 'catalog.read' },
      },
      {
        path: 'probador',
        title: 'Recursos del probador | FashionStore',
        loadComponent: () =>
          import(
            '../../features/probador-virtual/presentation/admin-recursos.component'
          ).then((m) => m.AdminRecursosComponent),
        canActivate: [tenantScopeGuard, authGuard],
        data: { permission: 'catalog.read' },
      },
      {
        path: 'reservas',
        title: 'Reservas | FashionStore',
        loadComponent: () =>
          import(
            '../../features/reservas-vestidor/presentation/admin-reservas.component'
          ).then((m) => m.AdminReservasComponent),
        canActivate: [tenantScopeGuard, authGuard],
        data: { permission: 'reservations.read' },
      },
      {
        path: 'devoluciones',
        title: 'Devoluciones | FashionStore',
        loadComponent: () =>
          import(
            '../../features/ventas-pagos/presentation/admin-returns.component'
          ).then((m) => m.AdminReturnsComponent),
        canActivate: [tenantScopeGuard, authGuard],
        data: { permission: 'commerce.read' },
      },
      {
        path: 'cambios',
        title: 'Cambios de prenda | FashionStore',
        loadComponent: () =>
          import(
            '../../features/ventas-pagos/presentation/cambios-page.component'
          ).then((m) => m.CambiosPageComponent),
        canActivate: [tenantScopeGuard, authGuard],
        data: { permission: 'exchanges.read', feature: 'exchanges' },
      },
      {
        path: 'reportes-ia',
        title: 'Reportes Inteligentes con IA | FashionStore',
        loadComponent: () =>
          import(
            '../../features/ia-reportes/presentation/reportes-ia.component'
          ).then((m) => m.ReportesIaComponent),
        canActivate: [tenantScopeGuard, authGuard],
        data: { permission: 'ai_reports.use', feature: 'ai_reports' },
      },
      {
        path: 'reportes-ia/historial',
        title: 'Historial de Reportes IA | FashionStore',
        loadComponent: () =>
          import(
            '../../features/ia-reportes/presentation/historial-reportes.component'
          ).then((m) => m.HistorialReportesComponent),
        canActivate: [tenantScopeGuard, authGuard],
        data: { permission: 'ai_reports.use', feature: 'ai_reports' },
      },
      {
        path: 'sincronizacion/conflictos',
        title: 'Conflictos de sincronización | FashionStore',
        loadComponent: () =>
          import(
            '../../features/operacion-offline/presentation/conflictos.component'
          ).then((m) => m.ConflictosSyncComponent),
        canActivate: [tenantScopeGuard, authGuard],
        data: { permission: 'sync_conflicts.read' },
      },
      {
        path: 'sincronizacion/historial',
        title: 'Historial de sincronización | FashionStore',
        loadComponent: () =>
          import(
            '../../features/operacion-offline/presentation/historial-sincronizacion.component'
          ).then((m) => m.HistorialSincronizacionComponent),
        canActivate: [tenantScopeGuard, authGuard],
        data: { permission: 'sync_log.read' },
      },
      {
        path: 'bitacora',
        title: 'Bitácora | FashionStore',
        loadComponent: () =>
          import('./audit/audit-page.component').then((m) => m.AuditPageComponent),
        canActivate: [tenantScopeGuard, authGuard],
        data: { permission: 'audit.read' },
      },
    ],
  },
  {
    path: 'sin-acceso',
    loadComponent: () =>
      import('./layout/status-page.component').then((m) => m.StatusPageComponent),
    data: { forbidden: true },
  },
  {
    path: '**',
    loadComponent: () =>
      import('./layout/status-page.component').then((m) => m.StatusPageComponent),
  },
];
