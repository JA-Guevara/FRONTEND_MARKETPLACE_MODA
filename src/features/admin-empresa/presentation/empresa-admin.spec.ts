import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { PanelEmpresaComponent } from './panel-empresa.component';
import { RolesEmpresaComponent } from './roles-empresa.component';
import { PerfilEmpresaComponent } from './perfil-empresa.component';
import { AccesosSoporteComponent } from './accesos-soporte.component';
import { EmpresaAdminApi } from '../infrastructure/empresa-admin.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { BranchContextService } from '../../../app/core/layout/admin-topbar.component';
import { TenantDashboard, TenantProfile, RoleView } from '../domain/empresa-admin.models';
import { SupportSession } from '../../plataforma-saas/domain/soporte.models';

const mockDashboard: TenantDashboard = {
  sales_today: 4820,
  orders_today: 18,
  sales_delta_pct: 12,
  reservations_today: 12,
  in_fitting_room: 4,
  critical_stock: 3,
  plan_usage: {
    active_branches: 2,
    max_branches: 2,
  },
  recent_orders: [
    {
      id: 'o1',
      code: '1042',
      total: 350,
      channel: 'pos',
      payment_method: 'efectivo',
      status: 'PAGADO',
      created_at: '2026-11-04T10:00:00Z',
    },
  ],
  upcoming_reservations: [
    {
      id: 'r1',
      customer_name: 'Ana Pérez',
      items: 2,
      starts_at: '2026-11-04T10:30:00Z',
      status: 'CONFIRMADA',
      origin: 'online',
    },
  ],
};

const mockProfile: TenantProfile = {
  id: 't-1',
  legal_name: 'Moda Cruceña S.R.L.',
  trade_name: 'Moda Cruceña',
  tax_id: '1020304050',
  slug: 'moda-crucena',
  contact_email: 'contacto@modacrucena.bo',
  phone: '70000000',
};

const mockSessions: SupportSession[] = [
  {
    id: 'ss-1',
    tenant_id: 't-1',
    tenant_name: 'Moda Cruceña',
    platform_user_id: 'u-admin1',
    platform_user_name: 'José Guevara',
    reason: 'Revisar sucursal duplicada (ticket #455)',
    duration_minutes: 22,
    started_at: '2026-10-28T10:02:00Z',
    expires_at: '2026-10-28T10:24:00Z',
    ended_at: '2026-10-28T10:24:00Z',
    end_reason: 'manual',
    actions_count: 3,
    is_active: false,
  },
  {
    id: 'ss-2',
    tenant_id: 't-1',
    tenant_name: 'Moda Cruceña',
    platform_user_id: 'u-admin2',
    platform_user_name: 'Ana Rojas',
    reason: 'Capacitación inicial del catálogo',
    duration_minutes: 60,
    started_at: '2026-10-20T15:30:00Z',
    expires_at: '2026-10-20T16:30:00Z',
    ended_at: '2026-10-20T16:30:00Z',
    end_reason: 'expired',
    actions_count: 14,
    is_active: false,
  },
];

const mockRoles: RoleView[] = [
  {
    id: 'r-sys',
    code: 'admin',
    name: 'Administrador de empresa',
    description: 'Sistema',
    is_template: true,
    is_active: true,
    users_count: 1,
    permissions: [{ id: 'p1', code: 'commerce.read', name: 'commerce.read' }],
  },
  {
    id: 'r-custom',
    code: 'vendedora',
    name: 'Vendedora de piso',
    description: 'Propio',
    is_template: false,
    is_active: true,
    users_count: 2,
    permissions: [{ id: 'p1', code: 'commerce.read', name: 'commerce.read' }],
  },
];

describe('Panel de empresa (Ola 2)', () => {
  it('Panel: renderiza 4 KPI y al cambiar sucursal vuelve a pedir dashboard(branchId)', async () => {
    const api = {
      dashboard: vi.fn((_bId?: string) => of(mockDashboard)),
    };
    const session = {
      user: () => ({ first_name: 'Lucía' }),
      tenant: () => ({ trade_name: 'Moda Cruceña' }),
      isSupport: () => false,
      hasFeature: () => true,
      can: () => true,
    };
    const branchService = new BranchContextService();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: EmpresaAdminApi, useValue: api },
        { provide: SessionService, useValue: session },
        { provide: BranchContextService, useValue: branchService },
      ],
    });

    const fixture = TestBed.createComponent(PanelEmpresaComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const kpiElements = fixture.nativeElement.querySelectorAll('.card.kpi');
    expect(kpiElements.length).toBe(4);
    expect(api.dashboard).toHaveBeenCalledWith(undefined);

    // Cambiar sucursal
    branchService.setBranchId('branch-123');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(api.dashboard).toHaveBeenCalledWith('branch-123');
  });

  it('Panel sin ai_reports -> fs-upgrade-card visible', async () => {
    const api = {
      dashboard: vi.fn(() => of(mockDashboard)),
    };
    const session = {
      user: () => ({ first_name: 'Lucía' }),
      tenant: () => ({ trade_name: 'Moda Cruceña' }),
      isSupport: () => false,
      hasFeature: vi.fn((feat: string) => feat !== 'ai_reports'),
      can: () => true,
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: EmpresaAdminApi, useValue: api },
        { provide: SessionService, useValue: session },
        { provide: BranchContextService, useClass: BranchContextService },
      ],
    });

    const fixture = TestBed.createComponent(PanelEmpresaComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const upgradeCard = fixture.nativeElement.querySelector('fs-upgrade-card');
    expect(upgradeCard).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Reportes con IA y análisis predictivo');
  });

  it('Roles: rol de sistema muestra matriz deshabilitada y botón Duplicar', async () => {
    const api = {
      roles: vi.fn(() => of(mockRoles)),
      permissions: vi.fn(() => of([{ id: 'p1', code: 'commerce.read', name: 'commerce.read', module: 'commerce' }])),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: EmpresaAdminApi, useValue: api },
      ],
    });

    const fixture = TestBed.createComponent(RolesEmpresaComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The first role is template/system
    expect(fixture.componentInstance.selectedRole()?.is_template).toBe(true);

    // Verify matrix checkboxes are disabled
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
    for (const cb of Array.from(checkboxes) as HTMLInputElement[]) {
      expect(cb.disabled).toBe(true);
    }

    // Verify "Duplicar como propio" button exists
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const dupBtn = buttons.find((b) => b.textContent?.includes('Duplicar como propio'));
    expect(dupBtn).toBeDefined();
  });

  it('Roles: guardar con respuesta 409 -> alerta «Los roles de sistema no se editan»', async () => {
    const api = {
      roles: vi.fn(() => of(mockRoles)),
      permissions: vi.fn(() => of([{ id: 'p1', code: 'commerce.read', name: 'commerce.read', module: 'commerce' }])),
      setRolePermissions: vi.fn(() => throwError(() => ({ status: 409, error: { message: 'system_role_locked' } }))),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: EmpresaAdminApi, useValue: api },
      ],
    });

    const fixture = TestBed.createComponent(RolesEmpresaComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Select the custom role so it allows save attempt
    fixture.componentInstance.selectRole(mockRoles[1]);
    fixture.detectChanges();

    // Trigger save
    fixture.componentInstance.guardarPermisos();
    fixture.detectChanges();

    expect(fixture.componentInstance.errorAlert()).toContain('Los roles de sistema no se editan');
    expect(fixture.nativeElement.textContent).toContain('Los roles de sistema no se editan');
  });

  it('Perfil: NIT y slug deshabilitados', async () => {
    const api = {
      profile: vi.fn(() => of(mockProfile)),
      updateProfile: vi.fn(() => of(mockProfile)),
    };
    const session = {
      can: vi.fn((perm: string) => perm === 'tenant_profile.write'),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: EmpresaAdminApi, useValue: api },
        { provide: SessionService, useValue: session },
      ],
    });

    const fixture = TestBed.createComponent(PerfilEmpresaComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const taxInput = fixture.nativeElement.querySelector('#tax_id') as HTMLInputElement;
    const slugInput = fixture.nativeElement.querySelector('#slug') as HTMLInputElement;

    expect(taxInput).not.toBeNull();
    expect(slugInput).not.toBeNull();
    expect(taxInput.disabled).toBe(true);
    expect(slugInput.disabled).toBe(true);
    expect(taxInput.value).toBe('1020304050');
    expect(slugInput.value).toBe('moda-crucena');
  });

  it('Accesos de soporte: tabla con 2 filas y enlace a bitácora con support_session_id', async () => {
    const api = {
      supportSessions: vi.fn(() => of({ items: mockSessions, total: 2, page: 1, pages: 1, page_size: 20 })),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: EmpresaAdminApi, useValue: api },
      ],
    });

    const fixture = TestBed.createComponent(AccesosSoporteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    const links = fixture.nativeElement.querySelectorAll('a');
    const bitacoraLink = Array.from(links).find((a: any) => a.textContent.includes('Ver en bitácora')) as HTMLAnchorElement;
    expect(bitacoraLink).toBeDefined();
    expect(bitacoraLink.getAttribute('href') || bitacoraLink.outerHTML).toContain('support_session_id');
  });
});
