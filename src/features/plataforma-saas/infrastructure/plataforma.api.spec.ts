import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PlataformaApi } from './plataforma.api';
import { planNoticeInterceptor } from '../../../app/core/plan-notice.interceptor';
import { PlanNoticeService } from '../../../app/core/plan-notice.service';
describe('Contrato HTTP plataforma', () => {
  let api: PlataformaApi, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([planNoticeInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(PlataformaApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('serializa funcionalidades y límites al crear plan', () => {
    api
      .createPlan({
        code: 'BASICO',
        name: 'Básico',
        duration_days: 30,
        reference_price: 20,
        features: { sales: true, ai_reports: false },
        limits: { max_active_branches: 2 },
      })
      .subscribe();
    const r = http.expectOne('/api/v1/platform/plans');
    expect(r.request.body).toEqual({
      code: 'BASICO',
      name: 'Básico',
      duration_days: 30,
      reference_price: 20,
      features: [
        { feature_code: 'sales', enabled: true, limit_value: null },
        { feature_code: 'ai_reports', enabled: false, limit_value: null },
        { feature_code: 'max_active_branches', enabled: true, limit_value: 2 },
      ],
    });
    r.flush({ data: {} });
  });
  it('renueva sin campos no admitidos', () => {
    api.renew('t1', { reason: 'Renovación mensual' }).subscribe();
    const r = http.expectOne('/api/v1/platform/tenants/t1/subscription/renew');
    expect(r.request.body).toEqual({ reason: 'Renovación mensual' });
    r.flush({ data: {} });
  });
  it('consulta impacto con diccionario de funcionalidades y confirma conservando el motivo', () => {
    api.planImpact('p1', { products: true, ai_reports: false }).subscribe();
    const impact = http.expectOne('/api/v1/platform/plans/p1/impact');
    expect(impact.request.method).toBe('POST');
    expect(impact.request.body).toEqual({ products: true, ai_reports: false });
    impact.flush({ data: {} });
    api
      .updatePlan('p1', {
        features: { products: true },
        reason: 'Ajuste solicitado',
        confirm: true,
      })
      .subscribe();
    const save = http.expectOne('/api/v1/platform/plans/p1');
    expect(save.request.body.reason).toBe('Ajuste solicitado');
    expect(save.request.body.confirm).toBe(true);
    save.flush({ data: {} });
  });
  it('asigna prueba y revoca sin alterar la empresa ni enviar datos extra', () => {
    api
      .grantModule('t1', {
        module_code: 'ai_reports',
        mode: 'TRIAL',
        days: 7,
        reason: 'Evaluación solicitada',
      })
      .subscribe();
    const grant = http.expectOne('/api/v1/platform/tenants/t1/modules');
    expect(grant.request.body).toEqual({
      module_code: 'ai_reports',
      mode: 'TRIAL',
      days: 7,
      reason: 'Evaluación solicitada',
    });
    grant.flush({ data: {} });
    api.revokeModule('t1', 'o1', 'Finalizar prueba').subscribe();
    const revoke = http.expectOne('/api/v1/platform/tenants/t1/modules/o1/revoke');
    expect(revoke.request.body).toEqual({ reason: 'Finalizar prueba' });
    revoke.flush({ data: null });
  });
  it('plan_limit_exceeded abre aviso y relanza error', () => {
    const error = vi.fn();
    api.changePlan('t1', { plan_code: 'BASICO', reason: 'Ajustar capacidad' }).subscribe({ error });
    http
      .expectOne('/api/v1/platform/tenants/t1/subscription/change-plan')
      .flush(
        { error: { code: 'plan_limit_exceeded', details: { must_deactivate: 4 } } },
        { status: 409, statusText: 'Conflict' },
      );
    expect(TestBed.inject(PlanNoticeService).notice()?.code).toBe('plan_limit_exceeded');
    expect(error).toHaveBeenCalled();
  });
});
