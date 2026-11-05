import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Empresa360Component } from './empresa-360.component';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { Tenant } from '../domain/empresa.models';
import { TenantOverview } from '../domain/consola.models';
import {
  EffectiveTenantLimit,
  PermissionCatalogItem,
  TenantRole,
} from '../domain/gobierno.models';

const tenant: Tenant = {
  id: 't1',
  legal_name: 'Moda Cruceña SRL',
  trade_name: 'Moda Cruceña',
  tax_id: '1020304050',
  slug: 'moda-crucena',
  contact_email: 'moda@example.com',
  phone: null,
  status: 'ACTIVA',
  plan_code: 'PROFESIONAL',
  plan_name: 'Profesional',
  subscription_status: 'ACTIVA',
  end_date: '2030-11-30',
  active_branches: 5,
  admin_email: 'admin@example.com',
  admin_password_set: true,
  created_at: '2030-10-01T12:00:00Z',
};

const overview: TenantOverview = {
  sales_30d: 0,
  orders_30d: 0,
  online_orders_30d: 0,
  pos_orders_30d: 0,
  reservations_30d: 0,
  offline_reservations_30d: 0,
  active_users: 1,
  users_by_role: {},
  quotas: [
    {
      code: 'max_active_branches',
      label: 'Sucursales activas',
      used: 5,
      limit: 2,
    },
  ],
  last_activity_at: null,
};

const limits: EffectiveTenantLimit[] = [
  {
    limit_code: 'max_active_branches',
    plan_value: 2,
    effective_value: 5,
    usage: 5,
    source: 'EMPRESA',
    subscription_end_date: '2030-11-30',
    override_active: true,
    override: {
      id: 'l1',
      tenant_id: 't1',
      limit_code: 'max_active_branches',
      value: 5,
      expires_at: '2030-11-20T23:59:59Z',
      reason: 'Temporada alta',
      created_at: '2030-11-01T12:00:00Z',
    },
  },
];

const role: TenantRole = {
  id: 'r1',
  code: 'supervisor',
  name: 'Supervisor',
  description: null,
  is_system: false,
  is_active: true,
  permissions: [{ id: 'p1', code: 'catalog.read', name: 'Ver catálogo' }],
};

const permission: PermissionCatalogItem = {
  id: 'p1',
  code: 'catalog.read',
  name: 'Ver catálogo',
  description: null,
  module: 'catalog',
  scope: 'tenant',
  is_active: true,
};

describe('Empresa 360° integrada', () => {
  function configure(api: Record<string, unknown>) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PlataformaApi, useValue: api },
        { provide: SessionService, useValue: { can: () => true } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: 't1' }) },
            queryParamMap: of(convertToParamMap({})),
          },
        },
      ],
    });
  }

  function apiBase() {
    return {
      tenant: () => of(tenant),
      tenantOverview: () => of(overview),
      tenantActivity: () => of([]),
      tenantModules: () => of([]),
      modules: () => of([]),
      tenantLimits: () => of(limits),
      tenantRoles: () => of([role]),
      permissions: () => of([permission]),
    };
  }

  it('muestra el valor del plan y el forzado que devuelve GET limits', async () => {
    configure({ ...apiBase(), setTenantRolePermissions: vi.fn(() => of(role)) });
    const fixture = TestBed.createComponent(Empresa360Component);
    fixture.detectChanges();

    await fixture.componentInstance.loadModules();
    fixture.componentInstance.activeTab.set('modulos');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(fixture.nativeElement.querySelectorAll('.limit-row')).toHaveLength(1);
    expect(text).toContain('max_active_branches: 5');
    expect(text).toContain('Plan: 2');
    expect(text).toContain('Forzado por la empresa');
    expect(text).toContain('Temporada alta');
  });

  it('guarda los permisos del rol con códigos y motivo en el PUT real', async () => {
    const setTenantRolePermissions = vi.fn(() => of(role));
    configure({ ...apiBase(), setTenantRolePermissions });
    const fixture = TestBed.createComponent(Empresa360Component);
    fixture.detectChanges();

    fixture.componentInstance.editingRole.set(role);
    fixture.componentInstance.selectedPermissions = ['catalog.read'];

    fixture.componentInstance.roleReason = '';
    await fixture.componentInstance.saveRole();
    expect(setTenantRolePermissions).not.toHaveBeenCalled();
    expect(fixture.componentInstance.roleError()).toContain('motivo');

    fixture.componentInstance.roleReason = 'Ajuste de permisos';
    await fixture.componentInstance.saveRole();
    expect(setTenantRolePermissions).toHaveBeenCalledWith('t1', 'r1', {
      permission_codes: ['catalog.read'],
      reason: 'Ajuste de permisos',
    });
    expect(fixture.componentInstance.editingRole()).toBeNull();
  });
});
