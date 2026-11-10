export interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string;
  permission?: string;
  feature?: string;
  children?: NavItem[];
  badge?: 'support';
}

export interface NavSection {
  title: string;
  scope: 'platform' | 'tenant';
  items: NavItem[];
  hideInSupport?: boolean;
}

export const ADMIN_NAV: NavSection[] = [
  // ---------- PLATAFORMA ----------
  {
    title: 'Plataforma SaaS',
    scope: 'platform',
    items: [
      {
        key: 'tablero',
        label: 'Panel de plataforma',
        icon: 'chart',
        path: '/admin/plataforma',
        children: [
          {
            key: 'ejecutivo',
            label: 'Panel ejecutivo',
            icon: 'chart',
            path: '/admin/plataforma',
            permission: 'subscriptions.read',
          },
          {
            key: 'salud',
            label: 'Estado y seguridad',
            icon: 'heart',
            path: '/admin/plataforma/operacion/salud',
            permission: 'platform.ops.read',
          },
          {
            key: 'despliegues',
            label: 'Diagnóstico técnico',
            icon: 'settings',
            path: '/admin/plataforma/operacion/despliegues',
            permission: 'platform.ops.read',
          },
          {
            key: 'continuidad',
            label: 'Copias globales',
            icon: 'box',
            path: '/admin/plataforma/operacion/continuidad',
            permission: 'platform.ops.read',
          },
          {
            key: 'respaldos-empresas',
            label: 'Respaldos por empresa',
            icon: 'download',
            path: '/admin/plataforma/respaldos-empresas',
            permission: 'platform.ops.read',
          },
        ],
      },
      {
        key: 'respaldos-empresas',
        label: 'Respaldos por empresa',
        icon: 'download',
        path: '/admin/plataforma/respaldos-empresas',
        permission: 'platform.ops.read',
      },
      {
        key: 'empresas',
        label: 'Empresas y suscripciones',
        icon: 'users',
        path: '/admin/plataforma/empresas',
        permission: 'tenants.read',
      },
      {
        key: 'planes',
        label: 'Planes de suscripción',
        icon: 'tag',
        path: '/admin/plataforma/planes',
        permission: 'plans.read',
      },
    ],
  },
  {
    title: 'Producto',
    scope: 'platform',
    items: [
      {
        key: 'modulos',
        label: 'Módulos',
        icon: 'box',
        path: '/admin/plataforma/modulos',
        permission: 'modules.read',
      },
      {
        key: 'demo',
        label: 'Empresa demo',
        icon: 'sparkles',
        path: '/admin/plataforma/demo',
        permission: 'sandbox.manage',
      },
      {
        key: 'modelos-ml',
        label: 'Modelos de ML',
        icon: 'grid',
        path: '/admin/plataforma/ml',
        permission: 'ml_models.manage',
      },
    ],
  },
  {
    title: 'Personas y seguridad',
    scope: 'platform',
    items: [
      {
        key: 'usuarios',
        label: 'Usuarios globales',
        icon: 'users',
        path: '/admin/plataforma/usuarios',
        permission: 'platform_users.read',
      },
      {
        key: 'roles',
        label: 'Roles y permisos',
        icon: 'lock',
        path: '/admin/plataforma/roles',
        permission: 'platform_roles.read',
      },
      {
        key: 'admins',
        label: 'Superadministradores',
        icon: 'users',
        path: '/admin/plataforma/equipo',
        permission: 'platform_users.write',
      },
      {
        key: 'auditoria',
        label: 'Auditoría global',
        icon: 'list',
        path: '/admin/plataforma/auditoria',
        permission: 'platform_audit.read',
      },
      {
        key: 'soporte',
        label: 'Sesiones de soporte',
        icon: 'heart',
        path: '/admin/plataforma/soporte',
        permission: 'platform_audit.read',
      },
    ],
  },
  {
    title: 'Catálogos globales',
    scope: 'platform',
    items: [
      {
        key: 'ciudades',
        label: 'Ciudades',
        icon: 'box',
        path: '/admin/plataforma/ciudades',
        permission: 'cities.write',
      },
    ],
  },

  // ---------- TENANT (EMPRESA) ----------
  {
    title: 'General',
    scope: 'tenant',
    items: [
      { key: 'panel', label: 'Panel', icon: 'home', path: '/admin', permission: 'dashboard.read' },
      {
        key: 'reportes',
        label: 'Centro de reportes',
        icon: 'chart',
        path: '/admin/dashboard',
        permission: 'dashboard.read',
      },
      {
        key: 'ia',
        label: 'Reportes con IA',
        icon: 'sparkles',
        path: '/admin/reportes-ia',
        permission: 'ai_reports.use',
        feature: 'ai_reports',
      },
      {
        key: 'analitica-ml',
        label: 'Analítica predictiva ML',
        icon: 'chart',
        path: '/admin/analitica-ml',
        permission: 'ml_dashboard.read',
        feature: 'ml_analytics',
      },
    ],
  },
  {
    title: 'Ventas',
    scope: 'tenant',
    items: [
      {
        key: 'caja',
        label: 'Caja',
        icon: 'box',
        path: '/admin/caja',
        permission: 'commerce.write',
        feature: 'sales',
      },
      {
        key: 'pedidos',
        label: 'Pedidos y pagos',
        icon: 'cart',
        path: '/admin/pedidos',
        permission: 'commerce.read',
        feature: 'sales',
      },
      {
        key: 'cambios',
        label: 'Cambios de prenda',
        icon: 'return',
        path: '/admin/cambios',
        permission: 'exchanges.read',
        feature: 'exchanges',
      },
      {
        key: 'devoluciones',
        label: 'Devoluciones',
        icon: 'return',
        path: '/admin/devoluciones',
        permission: 'commerce.read',
      },
      {
        key: 'promos',
        label: 'Cupones y promociones',
        icon: 'tag',
        path: '/admin/promociones',
        permission: 'commerce.read',
        feature: 'promotions',
      },
    ],
  },
  {
    title: 'Inventario y reservas',
    scope: 'tenant',
    items: [
      {
        key: 'stock',
        label: 'Existencias',
        icon: 'list',
        path: '/admin/stock',
        permission: 'stock.read',
        feature: 'inventory',
      },
      {
        key: 'reservas',
        label: 'Reservas',
        icon: 'calendar',
        path: '/admin/reservas',
        permission: 'reservations.read',
        feature: 'reservations',
      },
      {
        key: 'conflictos-sync',
        label: 'Conflictos de sync',
        icon: 'refresh',
        path: '/admin/sincronizacion/conflictos',
        permission: 'sync_conflicts.read',
      },
      {
        key: 'historial-sync',
        label: 'Historial de sync',
        icon: 'list',
        path: '/admin/sincronizacion/historial',
        permission: 'sync_log.read',
      },
    ],
  },
  {
    title: 'Catálogo',
    scope: 'tenant',
    items: [
      {
        key: 'prendas',
        label: 'Prendas',
        icon: 'tag',
        path: '/admin/products',
        permission: 'catalog.read',
      },
      {
        key: 'atributos',
        label: 'Categorías y atributos',
        icon: 'grid',
        path: '/admin/categories',
        permission: 'catalog.read',
        children: [
          {
            key: 'categories',
            label: 'Categorías',
            icon: 'grid',
            path: '/admin/categories',
            permission: 'catalog.read',
          },
          {
            key: 'sizes',
            label: 'Tallas',
            icon: 'grid',
            path: '/admin/sizes',
            permission: 'catalog.read',
          },
          {
            key: 'colors',
            label: 'Colores',
            icon: 'grid',
            path: '/admin/colors',
            permission: 'catalog.read',
          },
          {
            key: 'seasons',
            label: 'Temporadas',
            icon: 'grid',
            path: '/admin/seasons',
            permission: 'catalog.read',
          },
          {
            key: 'collections',
            label: 'Colecciones',
            icon: 'grid',
            path: '/admin/collections',
            permission: 'catalog.read',
          },
        ],
      },
      {
        key: 'proveedores',
        label: 'Proveedores',
        icon: 'refresh',
        path: '/admin/suppliers',
        children: [
          {
            key: 'suppliers',
            label: 'Proveedores',
            icon: 'refresh',
            path: '/admin/suppliers',
            permission: 'suppliers.read',
          },
          {
            key: 'supply',
            label: 'Abastecimiento',
            icon: 'box',
            path: '/admin/abastecimiento',
            permission: 'catalog.read',
          },
        ],
      },
      {
        key: 'probador',
        label: 'Vestidor virtual',
        icon: 'camera',
        path: '/admin/probador',
        children: [
          {
            key: 'tryon',
            label: 'Probador virtual',
            icon: 'camera',
            path: '/admin/probador',
            permission: 'catalog.read',
            feature: 'virtual_tryon',
          },
          {
            key: 'ar',
            label: 'Recursos 3D / AR',
            icon: 'box',
            path: '/admin/recursos-ar',
            permission: 'catalog.read',
          },
        ],
      },
    ],
  },
  {
    title: 'Organización',
    scope: 'tenant',
    items: [
      {
        key: 'sucursales',
        label: 'Sucursales y cajas',
        icon: 'home',
        path: '/admin/branches',
        permission: 'branches.read',
        children: [
          {
            key: 'branches',
            label: 'Sucursales',
            icon: 'home',
            path: '/admin/branches',
            permission: 'branches.read',
          },
          {
            key: 'cash-points',
            label: 'Puntos de caja',
            icon: 'box',
            path: '/admin/cash-points',
            permission: 'branches.read',
          },
          {
            key: 'cities',
            label: 'Ciudades',
            icon: 'box',
            path: '/admin/cities',
            permission: 'branches.read',
          },
        ],
      },
    ],
  },
  {
    title: 'Personal',
    scope: 'tenant',
    items: [
      {
        key: 'personal',
        label: 'Usuarios y permisos',
        icon: 'users',
        path: '/admin/users',
        children: [
          {
            key: 'users',
            label: 'Usuarios',
            icon: 'users',
            path: '/admin/users',
            permission: 'users.read',
          },
          {
            key: 'roles',
            label: 'Roles de empresa',
            icon: 'lock',
            path: '/admin/roles',
            permission: 'roles.read',
          },
          {
            key: 'permissions',
            label: 'Catálogo de permisos',
            icon: 'list',
            path: '/admin/permissions',
            permission: 'roles.read',
          },
        ],
      },
    ],
  },
  {
    title: 'Mi empresa',
    scope: 'tenant',
    items: [
      {
        key: 'configuracion',
        label: 'Configuración de la empresa',
        icon: 'settings',
        path: '/admin/empresa/configuracion',
        children: [
          {
            key: 'tienda-config',
            label: 'Tienda pública y marca',
            icon: 'home',
            path: '/admin/empresa/configuracion',
            permission: 'storefront.write',
          },
          {
            key: 'perfil',
            label: 'Datos de empresa',
            icon: 'edit',
            path: '/admin/empresa/perfil',
            permission: 'my_subscription.read',
          },
          {
            key: 'datos-respaldos',
            label: 'Datos y respaldos',
            icon: 'download',
            path: '/admin/empresa/datos',
            permission: 'tenant.data_export',
          },
          {
            key: 'suscripcion',
            label: 'Plan y facturación',
            icon: 'settings',
            path: '/admin/mi-suscripcion',
            permission: 'my_subscription.read',
          },
          {
            key: 'cobros-tarjeta',
            label: 'Cobros de prendas',
            icon: 'tag',
            path: '/admin/empresa/cobros',
            permission: 'payment_methods.write',
          },
        ],
      },
      {
        key: 'integraciones',
        label: 'Integraciones y API',
        icon: 'refresh',
        path: '/admin/empresa/integraciones',
        permission: 'integrations.read',
      },
      {
        key: 'accesos',
        label: 'Accesos de soporte',
        icon: 'heart',
        path: '/admin/empresa/accesos-soporte',
        permission: 'support_sessions.read',
      },
      {
        key: 'bitacora',
        label: 'Bitácora',
        icon: 'list',
        path: '/admin/bitacora',
        permission: 'audit.read',
      },
    ],
  },
  {
    title: 'Sin conexión',
    scope: 'tenant',
    hideInSupport: true,
    items: [
      { key: 'offline', label: 'Preparar dispositivo', icon: 'download', path: '/sin-conexion' },
      {
        key: 'catalogo-offline',
        label: 'Catálogo sin conexión',
        icon: 'tag',
        path: '/sin-conexion/catalogo',
      },
      {
        key: 'venta-offline',
        label: 'Venta de contado local',
        icon: 'cart',
        path: '/sin-conexion/venta',
        permission: 'commerce.write',
        feature: 'offline',
      },
      {
        key: 'locales',
        label: 'Reservas locales',
        icon: 'calendar',
        path: '/sin-conexion/reservas',
        feature: 'offline',
      },
      {
        key: 'operaciones-sync',
        label: 'Operaciones locales',
        icon: 'refresh',
        path: '/sin-conexion/operaciones',
        feature: 'offline',
      },
    ],
  },
];

export function visibleSections(
  nav: NavSection[],
  s: {
    scope: 'platform' | 'tenant';
    isSupport: boolean;
    can: (p?: string) => boolean;
  },
): NavSection[] {
  return nav
    .filter((section) => {
      if (section.scope !== s.scope) {
        return false;
      }
      if (s.isSupport && section.hideInSupport) {
        return false;
      }
      return true;
    })
    .map((section) => {
      const filteredItems = section.items
        .map((item) => {
          if (item.children && item.children.length > 0) {
            const visibleChildren = item.children.filter((child) => s.can(child.permission));
            if (visibleChildren.length === 0) {
              return null;
            }
            if (!s.can(item.permission)) {
              return null;
            }
            const entry =
              visibleChildren.find((child) => child.path === item.path) ?? visibleChildren[0];
            return { ...item, path: entry.path, children: visibleChildren };
          }
          if (!s.can(item.permission)) {
            return null;
          }
          return item;
        })
        .filter((item): item is NavItem => item !== null);

      return { ...section, items: filteredItems };
    })
    .filter((section) => section.items.length > 0);
}

export function lockedByPlan(item: NavItem, hasFeature: (c: string) => boolean): boolean {
  return Boolean(item.feature && !hasFeature(item.feature));
}
