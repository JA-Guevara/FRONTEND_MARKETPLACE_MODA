import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { ModulosPageComponent } from './modulos-page.component';
import { ModuloDrawerComponent } from './modulo-drawer.component';
import { PlanEditorComponent } from './plan-editor.component';
import { ImpactoDialogComponent } from './impacto-dialog.component';
import { HabilitarModuloDialogComponent } from './habilitar-modulo-dialog.component';
import { Empresa360Component } from './empresa-360.component';
import { PlanesPageComponent } from './planes-page.component';
import { ModuleDetail, PlatformModule } from '../domain/gobierno.models';
import { plans, tenant, session } from './saas-test-fixtures';

const module: PlatformModule = {
  code: 'ai_reports',
  name: 'Reportes con IA',
  description: 'Reportes escritos y por voz',
  kind: 'ADDON',
  lifecycle: 'GA',
  depends_on: [],
  web_routes: ['/admin/reportes-ia'],
  sort_order: 1,
  plans_count: 1,
  tenants_count: 1,
  permissions_count: 1,
};
const detail: ModuleDetail = {
  ...module,
  permissions: [{ id: 'p1', code: 'ai_reports.use', name: 'Usar reportes' }],
  plans: [],
  active_tenants: [],
  history: [],
};
const impact = {
  plan_id: 'p2',
  affected_tenants: 1,
  affected_users: 2,
  modules_added: [],
  modules_removed: ['ai_reports'],
  permissions_gained: [],
  permissions_lost: ['ai_reports.use'],
};

describe('Consola RS2 · módulos, impacto y empresa360', () => {
  function configure(api: object) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PlataformaApi, useValue: api },
        { provide: SessionService, useValue: { ...session, startSupport: vi.fn() } },
      ],
    });
  }
  it('busca por código de permiso real obtenido del detalle y aplica filtros', async () => {
    configure({
      modules: () => of([module, { ...module, code: 'beta', name: 'Cambios', lifecycle: 'BETA' }]),
      module: () => of(detail),
    });
    const fixture = TestBed.createComponent(ModulosPageComponent);
    await fixture.componentInstance.loadModules();
    await fixture.componentInstance.find('ai_reports.use');
    expect(fixture.componentInstance.filtered().map((item) => item.code)).toEqual(['ai_reports']);
    fixture.componentInstance.filter.set('beta');
    expect(fixture.componentInstance.filtered()).toHaveLength(0);
  });
  it('el drawer expone module_not_reviewed sin ocultar el error ni cerrar', async () => {
    configure({
      module: () => of({ ...detail, lifecycle: 'BETA' }),
      updateModule: () =>
        throwError(() => new Error('module_not_reviewed: prueba el módulo antes de publicarlo')),
    });
    const fixture = TestBed.createComponent(ModuloDrawerComponent);
    fixture.componentRef.setInput('code', 'ai_reports');
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.componentInstance.lifecycle = 'GA';
    await fixture.componentInstance.save();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('module_not_reviewed');
    expect(fixture.componentInstance.detail()?.lifecycle).toBe('BETA');
  });
  it('editar plan no guarda antes de revisar y confirmar impacto con motivo', async () => {
    const updatePlan = vi.fn(() => of({ data: { plan: plans[1], exceeded_tenants: [] } }));
    configure({ planImpact: () => of(impact), updatePlan });
    const fixture = TestBed.createComponent(PlanEditorComponent);
    fixture.componentRef.setInput('plan', plans[1]);
    fixture.detectChanges();
    await fixture.componentInstance.save();
    expect(updatePlan).not.toHaveBeenCalled();
    expect(fixture.componentInstance.impact()).toEqual(impact);
    fixture.componentInstance.draft.features['ai_reports'] = false;
    await fixture.componentInstance.confirmSave('Actualizar oferta comercial');
    expect(updatePlan).toHaveBeenCalledWith(
      'p2',
      expect.objectContaining({
        reason: 'Actualizar oferta comercial',
        confirm: true,
        features: plans[1].features,
      }),
    );
  });
  it('la matriz abre el diálogo visible sin abrir el editor y guarda solo la revisión confirmada', async () => {
    const updatePlan = vi.fn(() => of({ data: { plan: plans[1], exceeded_tenants: [] } }));
    configure({
      plans: () => of(plans),
      featureCatalog: () => of([]),
      matrix: () =>
        of({
          modules: [module],
          plans: [
            {
              id: 'p2',
              code: 'PROFESIONAL',
              name: 'Profesional',
              modules: { ai_reports: true },
              limits: { max_active_branches: 10 },
            },
          ],
        }),
      planImpact: () => of(impact),
      updatePlan,
    });
    const fixture = TestBed.createComponent(PlanesPageComponent);
    await fixture.componentInstance.openMatrix();
    await fixture.componentInstance.review('p2');
    fixture.detectChanges();
    expect(fixture.componentInstance.editor()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('fs-impacto-dialog [role=alertdialog]'),
    ).not.toBeNull();
    expect(updatePlan).not.toHaveBeenCalled();
    await fixture.componentInstance.applyMatrix('Revisión de planes');
    expect(updatePlan).toHaveBeenCalledWith('p2', {
      features: { ai_reports: true },
      limits: { max_active_branches: 10 },
      reason: 'Revisión de planes',
      confirm: true,
    });
  });
  it('el diálogo exige motivo y conserva pruebas sin inventar una cantidad', async () => {
    configure({});
    const fixture = TestBed.createComponent(ImpactoDialogComponent);
    fixture.componentRef.setInput('impact', impact);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Se respetan las asignaciones extra');
    expect(fixture.nativeElement.querySelector('.primary').disabled).toBe(true);
    await fixture.whenStable();
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Cambio verificado';
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.primary').disabled).toBe(false);
  });
  it('la prueba permite 1–30 días y nunca envía tenant_id en el body', () => {
    configure({});
    const fixture = TestBed.createComponent(HabilitarModuloDialogComponent);
    fixture.componentRef.setInput('modules', [module]);
    fixture.componentRef.setInput('moduleCode', 'ai_reports');
    const confirmed = vi.spyOn(fixture.componentInstance.confirmed, 'emit');
    fixture.componentInstance.reason = 'Evaluación de IA';
    fixture.componentInstance.days.set(31);
    fixture.componentInstance.submit();
    expect(confirmed).not.toHaveBeenCalled();
    fixture.componentInstance.days.set(6);
    fixture.componentInstance.submit();
    expect(confirmed).toHaveBeenCalledWith({
      module_code: 'ai_reports',
      mode: 'TRIAL',
      days: 6,
      reason: 'Evaluación de IA',
    });
  });
  it('los límites y edición de roles fallidos quedan visibles sin éxito simulado', async () => {
    configure({
      tenant: () => of(tenant),
      tenantOverview: () => of(null),
      tenantActivity: () => of([]),
      tenantModules: () => of([]),
      modules: () => of([module]),
      tenantLimits: () => throwError(() => new Error('Endpoint de límites no disponible')),
      setTenantRolePermissions: () => throwError(() => new Error('Endpoint de permisos pendiente')),
    });
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: { paramMap: convertToParamMap({ id: 't1' }) },
        queryParamMap: of(convertToParamMap({})),
      },
    });
    const fixture = TestBed.createComponent(Empresa360Component);
    await fixture.componentInstance.loadModules();
    expect(fixture.componentInstance.limitError()).toContain('Endpoint de límites no disponible');
    fixture.componentInstance.editingRole.set({
      id: 'r1',
      code: 'cajero',
      name: 'Cajero',
      description: null,
      is_system: false,
      is_active: true,
      permissions: [],
    });
    fixture.componentInstance.roleReason = 'Motivo de prueba';
    await fixture.componentInstance.saveRole();
    expect(fixture.componentInstance.roleError()).toContain('Endpoint de permisos pendiente');
    expect(fixture.componentInstance.editingRole()).not.toBeNull();
  });
  it('asigna la prueba a la empresa fija y refresca módulos después del éxito', async () => {
    const grantModule = vi.fn(() => of({ module_code: 'ai_reports', origin: 'TRIAL' }));
    configure({
      grantModule,
      tenantModules: () =>
        of([
          {
            ...module,
            module_code: 'ai_reports',
            module_name: module.name,
            origin: 'TRIAL',
            effective: true,
            is_blocked: false,
          },
        ]),
      modules: () => of([module]),
      tenantLimits: () => of([]),
    });
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: { paramMap: convertToParamMap({ id: 't1' }) },
        queryParamMap: of(convertToParamMap({})),
      },
    });
    const fixture = TestBed.createComponent(Empresa360Component);
    fixture.componentInstance.grantOpen.set(true);
    await fixture.componentInstance.grant({
      module_code: 'ai_reports',
      mode: 'TRIAL',
      days: 7,
      reason: 'Prueba autorizada',
    });
    expect(grantModule).toHaveBeenCalledWith('t1', {
      module_code: 'ai_reports',
      mode: 'TRIAL',
      days: 7,
      reason: 'Prueba autorizada',
    });
    expect(fixture.componentInstance.grantOpen()).toBe(false);
    expect(fixture.componentInstance.tenantModules()[0].origin).toBe('TRIAL');
  });
  it('bloquear o revocar usa únicamente el módulo/override seleccionado y exige motivo', async () => {
    const grantModule = vi.fn(() => of({})),
      revokeModule = vi.fn(() => of(null));
    configure({
      grantModule,
      revokeModule,
      tenantModules: () => of([]),
      modules: () => of([module]),
      tenantLimits: () => of([]),
    });
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: { paramMap: convertToParamMap({ id: 't1' }) },
        queryParamMap: of(convertToParamMap({})),
      },
    });
    const fixture = TestBed.createComponent(Empresa360Component);
    const record = {
      ...module,
      id: 'o1',
      module_code: 'ai_reports',
      module_name: module.name,
      effective: true,
      origin: 'TRIAL',
      mode: 'TRIAL',
      starts_at: null,
      expires_at: null,
      reason: null,
      granted_by_name: null,
      is_blocked: false,
    } as const;
    fixture.componentInstance.requestAction(record, 'block');
    await fixture.componentInstance.confirmAction('');
    expect(grantModule).not.toHaveBeenCalled();
    await fixture.componentInstance.confirmAction('Suspensión solicitada');
    expect(grantModule).toHaveBeenCalledWith('t1', {
      module_code: 'ai_reports',
      mode: 'BLOQUEADO',
      reason: 'Suspensión solicitada',
    });
    fixture.componentInstance.requestAction(record, 'revoke');
    await fixture.componentInstance.confirmAction('Terminar prueba');
    expect(revokeModule).toHaveBeenCalledWith('t1', 'o1', 'Terminar prueba');
  });
});
