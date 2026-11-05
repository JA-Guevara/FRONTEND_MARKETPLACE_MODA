import { describe, it, expect } from 'vitest';
import { ADMIN_NAV, visibleSections, lockedByPlan, NavItem } from './admin-nav';
import { PLATAFORMA_ROUTES } from '../../../features/plataforma-saas/plataforma.routes';
import { platformScopeGuard } from '../scope.guard';

describe('admin-nav', () => {
  it('visibleSections con scope platform muestra solo secciones de plataforma', () => {
    const sections = visibleSections(ADMIN_NAV, {
      scope: 'platform',
      isSupport: false,
      can: () => true,
    });

    const titles = sections.map((s) => s.title);
    expect(titles).toEqual([
      'Plataforma SaaS',
      'Producto',
      'Personas y seguridad',
      'Catálogos globales',
    ]);
  });

  it('separa Producto y requiere sandbox.manage para la demo', () => {
    const product = ADMIN_NAV.find((section) => section.title === 'Producto');
    expect(product?.items.find((item) => item.key === 'demo')?.permission).toBe('sandbox.manage');
    const security = ADMIN_NAV.find((section) => section.title === 'Personas y seguridad');
    expect(security?.items.some((item) => item.label === 'Superadministradores' && item.path.endsWith('/equipo'))).toBe(true);
    expect(security?.items.some((item) => item.label === 'Roles y permisos')).toBe(true);
  });
  it('las rutas nuevas conservan guard de plataforma y el enlace anterior del equipo redirige', () => {
    for (const path of ['plataforma/modulos', 'plataforma/demo', 'plataforma/roles', 'plataforma/equipo']) {
      expect(PLATAFORMA_ROUTES.find((route) => route.path === path)?.canActivate).toContain(platformScopeGuard);
    }
    expect(PLATAFORMA_ROUTES.find((route) => route.path === 'plataforma/demo')?.data?.['permission']).toBe('sandbox.manage');
    expect(PLATAFORMA_ROUTES.find((route) => route.path === 'plataforma/administradores')?.redirectTo).toBe('plataforma/equipo');
  });

  it('scope tenant + isSupport excluye la seccion Sin conexion', () => {
    const sections = visibleSections(ADMIN_NAV, {
      scope: 'tenant',
      isSupport: true,
      can: () => true,
    });

    const titles = sections.map((s) => s.title);
    expect(titles).not.toContain('Sin conexión');
    expect(titles).toContain('General');
    expect(titles).toContain('Ventas');
    expect(titles).toContain('Inventario y reservas');
    expect(titles).toContain('Catálogo');
    expect(titles).toContain('Organización');
    expect(titles).toContain('Personal');
    expect(titles).toContain('Mi empresa');
  });

  it('scope tenant sin soporte incluye la seccion Sin conexion', () => {
    const sections = visibleSections(ADMIN_NAV, {
      scope: 'tenant',
      isSupport: false,
      can: () => true,
    });

    const titles = sections.map((s) => s.title);
    expect(titles).toContain('Sin conexión');
  });

  it('Cajero (commerce.write, stock.read) ve Caja y Existencias, no Personal', () => {
    const userPermissions = ['commerce.write', 'stock.read'];
    const sections = visibleSections(ADMIN_NAV, {
      scope: 'tenant',
      isSupport: false,
      can: (p?: string) => !p || userPermissions.includes(p),
    });

    const titles = sections.map((s) => s.title);
    expect(titles).not.toContain('Personal');

    const ventas = sections.find((s) => s.title === 'Ventas');
    expect(ventas).toBeDefined();
    expect(ventas?.items.map((i) => i.key)).toEqual(['caja']);

    const inv = sections.find((s) => s.title === 'Inventario y reservas');
    expect(inv).toBeDefined();
    expect(inv?.items.map((i) => i.key)).toEqual(['stock']);
  });

  it('lockedByPlan(Reportes con IA) sin ai_reports retorna true', () => {
    const iaItem: NavItem = {
      key: 'ia',
      label: 'Reportes con IA',
      icon: 'sparkles',
      path: '/admin/dashboard?modo=ia',
      permission: 'dashboard.read',
      feature: 'ai_reports',
    };

    const locked = lockedByPlan(iaItem, (feat) => feat !== 'ai_reports');
    expect(locked).toBe(true);
  });

  it('lockedByPlan(Reportes con IA) con ai_reports retorna false', () => {
    const iaItem: NavItem = {
      key: 'ia',
      label: 'Reportes con IA',
      icon: 'sparkles',
      path: '/admin/dashboard?modo=ia',
      permission: 'dashboard.read',
      feature: 'ai_reports',
    };

    const locked = lockedByPlan(iaItem, (feat) => feat === 'ai_reports');
    expect(locked).toBe(false);
  });

  it('lockedByPlan para item sin feature retorna false', () => {
    const panelItem: NavItem = {
      key: 'panel',
      label: 'Panel',
      icon: 'home',
      path: '/admin',
      permission: 'dashboard.read',
    };

    expect(lockedByPlan(panelItem, () => false)).toBe(false);
  });

  describe('scope guards', () => {
    it('platformScopeGuard permite acceso si el scope es platform', () => {
      const mockSession = { scope: () => 'platform' };
      const mockRouter = { parseUrl: (url: string) => ({ url }) };
      const guard = () => {
        if (mockSession.scope() === 'platform') return true;
        return mockRouter.parseUrl('/admin');
      };
      expect(guard()).toBe(true);
    });

    it('platformScopeGuard redirige a /admin si el scope no es platform', () => {
      const mockSession = { scope: () => 'tenant' };
      const mockRouter = { parseUrl: (url: string) => ({ url }) };
      const guard = () => {
        if (mockSession.scope() === 'platform') return true;
        return mockRouter.parseUrl('/admin');
      };
      expect(guard()).toEqual({ url: '/admin' });
    });

    it('tenantScopeGuard permite acceso si el scope es tenant', () => {
      const mockSession = { scope: () => 'tenant' };
      const mockRouter = { parseUrl: (url: string) => ({ url }) };
      const guard = () => {
        if (mockSession.scope() === 'tenant') return true;
        return mockRouter.parseUrl('/admin/plataforma');
      };
      expect(guard()).toBe(true);
    });

    it('tenantScopeGuard redirige a /admin/plataforma si el scope no es tenant', () => {
      const mockSession = { scope: () => 'platform' };
      const mockRouter = { parseUrl: (url: string) => ({ url }) };
      const guard = () => {
        if (mockSession.scope() === 'tenant') return true;
        return mockRouter.parseUrl('/admin/plataforma');
      };
      expect(guard()).toEqual({ url: '/admin/plataforma' });
    });
  });
});
