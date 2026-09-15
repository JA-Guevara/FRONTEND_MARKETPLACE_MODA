import { Routes } from '@angular/router';
import { authGuard } from '../../features/auth/presentation/auth.guard';
import { resources } from './shared/resources';
import { addressesResource } from '../../features/usuarios-catalogo/application/resources';

const auth = () =>
  import('../../features/auth/presentation/auth-page.component').then((m) => m.AuthPageComponent);
const resource = () =>
  import('../../shared/resource-page.component').then((m) => m.ResourcePageComponent);
export const routes: Routes = [
  {
    path: 'carrito',
    title: 'Mi carrito | FashionStore',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../../features/ventas-pagos/presentation/cart-page.component').then(
        (m) => m.CartPageComponent,
      ),
  },
  {
    path: '',
    title: 'FashionStore | Tu estilo',
    loadComponent: () =>
      import('../../features/usuarios-catalogo/presentation/catalog-page.component').then(
        (m) => m.CatalogPageComponent,
      ),
  },
  {
    path: 'prendas/:slug',
    title: 'Prenda | FashionStore',
    loadComponent: () =>
      import('../../features/usuarios-catalogo/presentation/product-page.component').then(
        (m) => m.ProductPageComponent,
      ),
  },
  {
    path: 'sucursales',
    title: 'Sucursales | FashionStore',
    loadComponent: () =>
      import('../../features/inventario-sucursales/presentation/branches-page.component').then(
        (m) => m.BranchesPageComponent,
      ),
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
      import('../../features/auth/presentation/account-layout.component').then(
        (m) => m.AccountLayoutComponent,
      ),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        title: 'Mi perfil | FashionStore',
        loadComponent: () =>
          import('../../features/auth/presentation/account-page.component').then(
            (m) => m.AccountPageComponent,
          ),
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
            (m) => m.OrdersPageComponent,
          ),
      },
      {
        path: 'reservas',
        title: 'Mis reservas | FashionStore',
        loadComponent: () =>
          import('../../features/reservas-vestidor/presentation/mis-reservas.component').then(
            (m) => m.MisReservasComponent,
          ),
      },
      {
        // Antes vivía suelta en /cambiar-contrasena y se salía del módulo:
        // el cliente quedaba sin el menú de su cuenta para volver.
        path: 'seguridad',
        title: 'Seguridad | FashionStore',
        loadComponent: auth,
        data: { mode: 'change' },
      },
    ],
  },
  {
    path: 'reservar',
    title: 'Nueva reserva | FashionStore',
    loadComponent: () =>
      import('../../features/reservas-vestidor/presentation/nueva-reserva.component').then(
        (m) => m.NuevaReservaComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'prendas/:slug/vestidor',
    title: 'Vestidor virtual | FashionStore',
    loadComponent: () =>
      import('../../features/reservas-vestidor/presentation/vestidor.component').then(
        (m) => m.VestidorComponent,
      ),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        title: 'Centro de reportes | FashionStore',
        canActivate: [authGuard],
        data: { permission: 'dashboard.read' },
        loadComponent: () =>
          import('../../features/ia-reportes/presentation/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'pedidos',
        title: 'Pedidos y pagos | FashionStore',
        canActivate: [authGuard],
        data: { admin: true, permission: 'commerce.read' },
        loadComponent: () =>
          import('../../features/ventas-pagos/presentation/orders-page.component').then(
            (m) => m.OrdersPageComponent,
          ),
      },
      {
        path: 'stock',
        title: 'Existencias | FashionStore',
        canActivate: [authGuard],
        data: { permission: 'stock.read' },
        loadComponent: () =>
          import('../../features/ventas-pagos/presentation/stock-page.component').then(
            (m) => m.StockPageComponent,
          ),
      },
      {
        path: '',
        title: 'Administración | FashionStore',
        loadComponent: () =>
          import('./layout/admin-home.component').then((m) => m.AdminHomeComponent),
      },
      ...resources.map((r) => ({
        path: r.key,
        title: r.title + ' | FashionStore',
        loadComponent: resource,
        canActivate: [authGuard],
        data: { resource: r, permission: r.permission },
      })),
      {
        path: 'products/:id',
        title: 'Recursos de la prenda | FashionStore',
        loadComponent: () =>
          import('../../features/usuarios-catalogo/presentation/product-editor.component').then(
            (m) => m.ProductEditorComponent,
          ),
        canActivate: [authGuard],
        data: { permission: 'catalog.read' },
      },
      {
        path: 'reservas',
        title: 'Reservas | FashionStore',
        loadComponent: () =>
          import('../../features/reservas-vestidor/presentation/admin-reservas.component').then(
            (m) => m.AdminReservasComponent,
          ),
        canActivate: [authGuard],
        data: { permission: 'reservations.read' },
      },
      {
        path: 'bitacora',
        title: 'Bitácora | FashionStore',
        loadComponent: () =>
          import('../../features/usuarios-catalogo/presentation/audit-page.component').then(
            (m) => m.AuditPageComponent,
          ),
        canActivate: [authGuard],
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
