import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorsState, httpErrorsInterceptor } from './http-errors.interceptor';
import { EnvStripComponent } from './layout/env-strip.component';
import { SessionService } from '../../features/usuarios-catalogo/application/session.service';

describe('Avisos operativos y ambiente', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let state: HttpErrorsState;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([httpErrorsInterceptor])), provideHttpClientTesting(),
    ] });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    state = TestBed.inject(HttpErrorsState);
  });
  afterEach(() => backend.verify());

  it('429 muestra la espera y no repite una escritura', () => {
    let errorStatus = 0;
    http.post('/venta', {}).subscribe({ error: e => { errorStatus = e.status; } });
    backend.expectOne('/venta').flush({ error: { code: 'rate_limited' } }, {
      status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '47' },
    });
    expect(state.notice()).toContain('47 s');
    expect(errorStatus).toBe(429);
    backend.expectNone('/venta');
  });

  it('503 maintenance muestra el banner sin borrar la cola', () => {
    const fixture = TestBed.createComponent(EnvStripComponent);
    http.post('/sync/batch', {}).subscribe({ error: () => {} });
    backend.expectOne('/sync/batch').flush({ error: { code: 'maintenance' } }, {
      status: 503, statusText: 'Service Unavailable',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('mantenimiento');
    expect(state.maintenance()).toBe(true);
    fixture.nativeElement.querySelector('button').click();
    expect(state.notice()).toBeNull();
  });

  it('acepta el ambiente real de la API y rechaza valores arbitrarios', () => {
    http.get('/salud').subscribe();
    backend.expectOne('/salud').flush({}, { headers: { 'X-App-Env': 'staging' } });
    expect(state.apiEnvironment()).toBe('staging');
    state.environment('valor-ajeno');
    expect(state.apiEnvironment()).toBe('staging');
  });

  it('el login directo por HttpBackend también avisa de Retry-After', () => {
    TestBed.inject(SessionService).login('prueba@example.test', 'clave-no-real').subscribe({ error: () => {} });
    backend.expectOne('/api/v1/auth/login').flush({}, {
      status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '120' },
    });
    expect(state.notice()).toContain('120 s');
  });
});
