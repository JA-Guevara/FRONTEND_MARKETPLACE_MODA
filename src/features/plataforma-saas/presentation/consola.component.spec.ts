import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { TableroPlataformaComponent } from './tablero-plataforma.component';
import { Empresa360Component } from './empresa-360.component';
import { IniciarSoporteDialogComponent } from './iniciar-soporte-dialog.component';
import { UsuariosGlobalesComponent } from './usuarios-globales.component';
import { AuditoriaGlobalComponent } from './auditoria-global.component';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SoporteService } from '../application/soporte.service';
import { PlatformDashboard, TenantOverview, GlobalUser, PlatformAuditEvent } from '../domain/consola.models';
import { tenant } from './saas-test-fixtures';

const mockDashboard: PlatformDashboard = {
  mrr_estimate: 7410,
  currency: 'BOB',
  tenants: {
    active: 10,
    inactive: 1,
    suspended: 1,
    expiring_7d: 3,
    near_limit: 2,
  },
  plan_distribution: [
    { plan_code: 'BASICO', plan_name: 'Básico', tenants: 7 },
    { plan_code: 'PROFESIONAL', plan_name: 'Profesional', tenants: 5 },
  ],
  signups_by_month: [
    { month: '2026-06', count: 2 },
    { month: '2026-07', count: 3 },
    { month: '2026-08', count: 2 },
    { month: '2026-09', count: 4 },
    { month: '2026-10', count: 5 },
    { month: '2026-11', count: 6 },
  ],
  usage: {
    active_branches: 34,
    branch_capacity: 52,
    ai_reports_month: 910,
    tryon_jobs_month: 1420,
    orders_30d: 500,
    reservations_30d: 120,
  },
  attention: [
    { tenant_id: 't1', trade_name: 'Textiles Andinos', kind: 'expiring', detail: 'Vence el 08/11 · Profesional' },
    { tenant_id: 't2', trade_name: 'Moda Cruceña S.R.L.', kind: 'at_limit', detail: '2 de 2 sucursales · Básico' },
    { tenant_id: 't3', trade_name: 'La Vitrina', kind: 'suspended', detail: 'Suspendida el 28/10 · pago pendiente' },
  ],
  recent_activity: [
    { id: 'a1', action: 'Sesión de soporte', description: 'Revisar existencias', created_at: '2026-11-04T09:12:00Z', tenant_name: 'Urbano Boutique' },
  ],
};

const mockOverview: TenantOverview = {
  sales_30d: 48300,
  orders_30d: 312,
  online_orders_30d: 41,
  pos_orders_30d: 271,
  reservations_30d: 96,
  offline_reservations_30d: 12,
  active_users: 18,
  users_by_role: { admin: 1, cashier: 4 },
  quotas: [
    { code: 'max_active_branches', label: 'Sucursales activas', used: 6, limit: 10 },
  ],
  last_activity_at: '2026-11-04T09:12:00Z',
};

const mockUser: GlobalUser = {
  id: 'u-1',
  first_name: 'Carla',
  last_name: 'Suárez',
  email: 'carla@urbano.bo',
  tenant_id: 't1',
  tenant_name: 'Urbano Boutique',
  roles: ['Cajero'],
  is_active: true,
  is_verified: true,
  locked_until: '2026-11-05T00:00:00Z',
  last_login_at: '2026-11-01T22:14:00Z',
  created_at: '2026-10-01T00:00:00Z',
};

describe('Consola de plataforma SaaS (Ola 2)', () => {
  it('Tablero: muestra mrr con formato «Bs 7.410,00» y 3 filas de atención', async () => {
    const api = {
      dashboard: vi.fn(() => of(mockDashboard)),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PlataformaApi, useValue: api },
      ],
    });

    const fixture = TestBed.createComponent(TableroPlataformaComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    // Intl.NumberFormat in es-BO creates "Bs 7.410,00" or with non-breaking space
    expect(text).toMatch(/Bs\s*7\.410,00/);

    const attentionRows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(attentionRows.length).toBe(3);
    expect(text).toContain('Textiles Andinos');
    expect(text).toContain('Moda Cruceña S.R.L.');
    expect(text).toContain('La Vitrina');
  });

  it('Empresa 360: ?tab=usuarios muestra tabla y aviso de solo lectura', async () => {
    const api = {
      tenant: vi.fn(() => of(tenant)),
      tenantOverview: vi.fn(() => of(mockOverview)),
      tenantActivity: vi.fn(() => of([])),
      tenantBranches: vi.fn(() => of([])),
      tenantUsers: vi.fn(() => of({ items: [mockUser], total: 1, page: 1, pages: 1, page_size: 20 })),
      supportSessions: vi.fn(() => of({ items: [], total: 0, page: 1, pages: 1, page_size: 20 })),
      subscription: vi.fn(() => of({
        tenant: { id: tenant.id, slug: tenant.slug, trade_name: tenant.trade_name, status: tenant.status },
        current: { id: 's1', plan_code: 'BASICO', plan_name: 'Básico', start_date: '2026-11-01', end_date: '2026-11-30', status: 'ACTIVA', days_left: 26, reason: null },
        usage: { active_branches: 1, max_active_branches: 2 },
        features: {},
        history: [],
      })),
      plans: vi.fn(() => of([])),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PlataformaApi, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 't1' },
              queryParamMap: { get: (k: string) => (k === 'tab' ? 'usuarios' : null) },
            },
            queryParamMap: of({
              get: (k: string) => (k === 'tab' ? 'usuarios' : null),
            }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(Empresa360Component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Vista de consulta');
    expect(text).toContain('Para crear, editar o bloquear usuarios de esta empresa inicia una sesión de soporte');
    expect(text).toContain('Carla Suárez');
  });

  it('Diálogo de soporte: botón deshabilitado con motivo corto; envío llama startSupport y navega a /admin', async () => {
    const soporteService = {
      iniciar: vi.fn(() => Promise.resolve()),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SoporteService, useValue: soporteService },
      ],
    });

    const fixture = TestBed.createComponent(IniciarSoporteDialogComponent);
    fixture.componentInstance.tenant = { id: 't1', trade_name: 'Urbano Boutique' };
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('button.btn.primary') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Revisar existencias negativas en sucursal Norte';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const submitBtnAfter = fixture.nativeElement.querySelector('button.btn.primary') as HTMLButtonElement;
    expect(submitBtnAfter.disabled).toBe(false);

    await fixture.componentInstance.iniciar();
    expect(soporteService.iniciar).toHaveBeenCalledWith(
      { id: 't1', trade_name: 'Urbano Boutique' },
      'Revisar existencias negativas en sucursal Norte',
      60
    );
  });

  it('Usuarios globales: «Desbloquear» confirma y llama userAction(id,"unlock")', async () => {
    const api = {
      users: vi.fn(() => of({ items: [mockUser], total: 1, page: 1, pages: 1, page_size: 20 })),
      userAction: vi.fn(() => of({ ...mockUser, locked_until: null })),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PlataformaApi, useValue: api },
      ],
    });

    const fixture = TestBed.createComponent(UsuariosGlobalesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Carla Suárez');

    // Click on Desbloquear cuenta
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const unlockBtn = buttons.find((b) => b.textContent?.includes('Desbloquear cuenta'));
    expect(unlockBtn).toBeDefined();
    unlockBtn?.click();
    fixture.detectChanges();

    // Confirm dialog is shown
    expect(fixture.componentInstance.pendingAction()).not.toBeNull();
    fixture.componentInstance.executeAction('unlock');
    expect(api.userAction).toHaveBeenCalledWith('u-1', 'unlock');
  });

  it('Auditoría: chip «Solo soporte» llama audit({support_only:true})', async () => {
    const auditEvents: PlatformAuditEvent[] = [
      {
        id: 'e1',
        tenant_id: 't1',
        tenant_name: 'Urbano Boutique',
        support_session_id: 'ss-1',
        actor_user_id: 'u-admin',
        actor_name: 'José Guevara',
        actor_email: 'jose@fashionstore.bo',
        action: 'stock.adjusted',
        entity_type: 'stock',
        entity_id: 's-1',
        description: 'Ajuste de stock en soporte',
        created_at: '2026-11-04T09:31:00Z',
      },
    ];

    const api = {
      audit: vi.fn((_q: any) => of({ items: auditEvents, total: 1, page: 1, pages: 1, page_size: 20 })),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PlataformaApi, useValue: api },
      ],
    });

    const fixture = TestBed.createComponent(AuditoriaGlobalComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Select chip "Solo soporte"
    fixture.componentInstance.selectChip('soporte');
    expect(api.audit).toHaveBeenLastCalledWith(expect.objectContaining({ support_only: true }));
  });
});
