import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { LIMITES_HTTP, timeoutInterceptor } from './timeout.interceptor';
import { interceptores } from './app.config';
import { SessionService } from '../../features/usuarios-catalogo/application/session.service';
import { errorMessage } from '../../shared/errors';
import { Tokens } from '../../shared/models';

/** Se usan temporizadores REALES con límites de pocos milisegundos: mezclar
 * `vi.useFakeTimers()` con HttpTestingController congela el planificador de
 * rxjs y la prueba queda colgada. Por eso el límite es un token inyectable. */
const NORMAL = 60;
const LARGO = 4000;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const envelope = (data: unknown) => ({ success: true, message: 'OK', data });

describe('Tiempo límite de las peticiones', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, timeoutInterceptor])),
        provideHttpClientTesting(),
        { provide: LIMITES_HTTP, useValue: { normal: NORMAL, largo: LARGO } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('corta una petición colgada y explica el motivo en español', async () => {
    let capturado: unknown;
    http.get('/api/v1/catalog/products').subscribe({ error: (e) => (capturado = e) });
    backend.expectOne('/api/v1/catalog/products'); // se deja sin responder a propósito
    await esperar(NORMAL * 2);
    expect(capturado).toBeTruthy();
    expect(errorMessage(capturado)).toBe(
      'El servidor está tardando más de lo habitual y cancelamos la espera. Reintentá en unos momentos.',
    );
  });

  it('no toca peticiones fuera de nuestra API', async () => {
    let capturado: unknown;
    http.get('https://otro.example/lento').subscribe({ error: (e) => (capturado = e) });
    const req = backend.expectOne('https://otro.example/lento');
    await esperar(NORMAL * 2);
    expect(capturado).toBeUndefined();
    req.flush({});
  });

  describe('rutas largas', () => {
    it('no corta una subida (cuerpo FormData) al límite normal', async () => {
      const body = new FormData();
      body.append('file', new Blob(['x']), 'foto.png');
      let listo = false;
      let capturado: unknown;
      http
        .post('/api/v1/media/images', body)
        .subscribe({ next: () => (listo = true), error: (e) => (capturado = e) });
      const req = backend.expectOne('/api/v1/media/images');
      await esperar(NORMAL * 2);
      expect(capturado).toBeUndefined();
      req.flush(envelope({ url: '/media/foto.webp' }));
      expect(listo).toBe(true);
    });

    it('no corta una descarga generada al vuelo (responseType blob)', async () => {
      let capturado: unknown;
      http
        .get('/api/v1/analytics/reports/export', { responseType: 'blob' })
        .subscribe({ error: (e) => (capturado = e) });
      const req = backend.expectOne('/api/v1/analytics/reports/export');
      await esperar(NORMAL * 2);
      expect(capturado).toBeUndefined();
      req.flush(new Blob(['hoja']));
    });

    it.each([
      '/api/v1/commerce/assistant',
      '/api/v1/catalog/admin/products/draft',
      '/api/v1/analytics/insights',
      '/api/v1/bulk/products/preview',
      '/api/v1/tryon-ai/jobs/j1',
      '/api/v1/vestidor/admin/bulk-prepare',
    ])('no corta %s al límite normal', async (url) => {
      let capturado: unknown;
      http.post(url, {}).subscribe({ error: (e) => (capturado = e) });
      const req = backend.expectOne(url);
      await esperar(NORMAL * 2);
      expect(capturado).toBeUndefined();
      req.flush(envelope(null));
    });
  });

  // El orden real no se puede medir por tiempo: `timeout({each})` reinicia su
  // reloj con cada evento del flujo, y el evento `Sent` del reintento lo
  // reinicia igual esté el tiempo límite por fuera o por dentro. Se fija
  // entonces sobre la lista que arma la cadena, que es donde se decide.
  it('registra el tiempo límite por dentro de auth, no por fuera', () => {
    expect(interceptores.indexOf(timeoutInterceptor)).toBeGreaterThan(
      interceptores.indexOf(authInterceptor),
    );
    expect(interceptores.indexOf(authInterceptor)).toBe(0);
  });

  it('el reintento tras renovar el token llega a completarse', async () => {
    // La petición original consume casi todo su presupuesto antes del 401 y el
    // reintento tarda otro tanto: entre las dos se pasan del límite, pero cada
    // una corre con su propio reloj y ninguna debe morir por el camino.
    const session = TestBed.inject(SessionService);
    const tokens: Tokens = {
      access_token: 'access-one',
      refresh_token: 'refresh-one',
      expires_in: 900,
      user: {
        id: 'u1',
        email: 'qa@example.com',
        first_name: 'Prueba',
        last_name: 'Local',
        phone: null,
        is_active: true,
        is_verified: true,
        roles: [],
      },
    };
    session.login('qa@example.com', 'Password!2026').subscribe();
    backend.expectOne('/api/v1/auth/login').flush(envelope(tokens));

    const resultados: unknown[] = [];
    let capturado: unknown;
    http.get('/api/v1/users').subscribe({
      next: (r) => resultados.push(r),
      error: (e) => (capturado = e),
    });
    // Se consume la mayor parte del presupuesto antes de que llegue el 401.
    await esperar(NORMAL * 0.6);
    backend.expectOne('/api/v1/users').flush({}, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush(envelope({ ...tokens, access_token: 'access-two' }));
    // El reintento tarda otro tanto: el total supera el límite, pero su reloj
    // arrancó de cero, así que debe completarse igual.
    await esperar(NORMAL * 0.6);
    const reintento = backend.expectOne('/api/v1/users');
    expect(reintento.request.headers.get('Authorization')).toBe('Bearer access-two');
    reintento.flush(envelope([]));
    expect(capturado).toBeUndefined();
    expect(resultados.length).toBe(1);
  });

  it('también limita el inicio de sesión, que no pasa por los interceptores', async () => {
    const session = TestBed.inject(SessionService);
    let capturado: unknown;
    session.login('qa@example.com', 'Password!2026').subscribe({ error: (e) => (capturado = e) });
    backend.expectOne('/api/v1/auth/login'); // sin responder: el backend está colgado
    await esperar(NORMAL * 2);
    expect(errorMessage(capturado)).toContain('tardando más de lo habitual');
  });
});
