import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { SessionService } from '../application/session.service';
import { Tokens } from '../../../shared/models';

describe('Sesión e interceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: SessionService;
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
      roles: [
        {
          id: 'r1',
          name: 'Lector',
          code: 'reader',
          permissions: [{ id: 'p1', name: 'Leer catálogo', code: 'catalog.read' }],
        },
      ],
    },
  };
  const envelope = (data: unknown) => ({ success: true, message: 'OK', data });
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
  });
  afterEach(() => backend.verify());
  function login() {
    session.login('QA@example.com', 'Password!2026').subscribe();
    const req = backend.expectOne('/api/v1/auth/login');
    expect(req.request.body.email).toBe('qa@example.com');
    req.flush(envelope(tokens));
  }
  it('permite catálogo anónimo sin token', () => {
    http.get('/api/v1/catalog/products').subscribe();
    const req = backend.expectOne('/api/v1/catalog/products');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(envelope([]));
  });
  it('usa permisos, no el nombre del rol', () => {
    login();
    expect(session.can('catalog.read')).toBe(true);
    expect(session.can('users.write')).toBe(false);
  });
  it('no filtra credenciales a otro servidor ni a prefijos parecidos', () => {
    login();
    for (const url of ['https://other.example/api/v1/test', '/api/v10/test']) {
      http.get(url).subscribe();
      const req = backend.expectOne(url);
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    }
  });
  it('renueva una sola vez para dos solicitudes simultáneas y reintenta con el token nuevo', () => {
    login();
    const results: unknown[] = [];
    http.get('/api/v1/users').subscribe((r) => results.push(r));
    http.get('/api/v1/roles').subscribe((r) => results.push(r));
    backend.expectOne('/api/v1/users').flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/roles').flush({}, { status: 401, statusText: 'Unauthorized' });
    const refresh = backend.expectOne('/api/v1/auth/refresh');
    expect(refresh.request.body.refresh_token).toBe('refresh-one');
    refresh.flush(
      envelope({ ...tokens, access_token: 'access-two', refresh_token: 'refresh-two' }),
    );
    for (const path of ['/api/v1/users', '/api/v1/roles']) {
      const req = backend.expectOne(path);
      expect(req.request.headers.get('Authorization')).toBe('Bearer access-two');
      req.flush(envelope([]));
    }
    expect(results.length).toBe(2);
  });
  it('cierra sesión cuando la renovación falla', () => {
    login();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http.get('/api/v1/users').subscribe({ error: () => {} });
    backend.expectOne('/api/v1/users').flush({}, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.user()).toBeNull();
    expect(navigate).toHaveBeenCalled();
  });
  it('no intenta renovar un error de permisos', () => {
    login();
    http.get('/api/v1/users').subscribe({ error: () => {} });
    backend.expectOne('/api/v1/users').flush({}, { status: 403, statusText: 'Forbidden' });
    backend.expectNone('/api/v1/auth/refresh');
    expect(session.user()).not.toBeNull();
  });
  it('no entra en bucle si el reintento vuelve a responder 401', () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    login();
    http.get('/api/v1/users').subscribe({ error: () => {} });
    backend.expectOne('/api/v1/users').flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/auth/refresh').flush(envelope(tokens));
    backend.expectOne('/api/v1/users').flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectNone('/api/v1/auth/refresh');
  });
  it('renueva también el cambio de contraseña protegido', () => {
    login();
    session
      .request('change-password', {
        current_password: 'Old!123456789',
        new_password: 'New!123456789',
      })
      .subscribe();
    backend
      .expectOne('/api/v1/auth/change-password')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush(envelope({ ...tokens, access_token: 'new-token' }));
    const retry = backend.expectOne('/api/v1/auth/change-password');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
    retry.flush(envelope(null));
  });
  it('logout borra los tokens incluso si la red falla', () => {
    login();
    session.logout().subscribe({ error: () => {} });
    backend.expectOne('/api/v1/auth/logout').error(new ProgressEvent('error'));
    expect(session.accessToken).toBeUndefined();
    expect(session.user()).toBeNull();
  });
});

