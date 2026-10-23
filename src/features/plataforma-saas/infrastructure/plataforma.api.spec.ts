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
