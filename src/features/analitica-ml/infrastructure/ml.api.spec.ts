import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { MLApi } from './ml.api';

describe('Modelos ML de plataforma', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('entrega los modelos y las ejecuciones de la respuesta de la API', async () => {
    const api = TestBed.inject(MLApi);
    const http = TestBed.inject(HttpTestingController);
    const models = api.getPlatformModels();
    const runs = api.getPlatformRuns();
    const data = [{ id: 'demo-1', tenant_name: 'FashionStore Demo' }];
    http.expectOne(environment.apiUrl + '/platform/ml/models').flush({ success: true, data });
    http.expectOne(environment.apiUrl + '/platform/ml/runs').flush({ success: true, data });
    expect(await models).toEqual(data);
    expect(await runs).toEqual(data);
  });
  it('el panel y las anomalías de empresa reciben los datos una sola vez y el filtro viaja plano', async () => {
    const api = TestBed.inject(MLApi),
      http = TestBed.inject(HttpTestingController);
    const dashboard = api.getDashboard(),
      anomalies = api.getAnomalies(false);
    http
      .expectOne(environment.apiUrl + '/analytics/ml/dashboard')
      .flush({ success: true, data: { ready: true } });
    const request = http.expectOne(
      (req) => req.url === environment.apiUrl + '/analytics/ml/anomalies',
    );
    expect(request.request.params.get('resolved')).toBe('false');
    expect(request.request.params.has('params')).toBe(false);
    request.flush({ success: true, data: [] });
    expect(await dashboard).toEqual({ ready: true });
    expect(await anomalies).toEqual([]);
  });
});
