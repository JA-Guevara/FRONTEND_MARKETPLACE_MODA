import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SessionService } from './session.service';

describe('Restauración después de Stripe', () => {
  const tokens = { access_token: 'access-new', refresh_token: 'refresh-new', expires_in: 900,
    user: { id: 'buyer', email: 'buyer@example.test', first_name: 'Buyer', last_name: 'Test',
      phone: null, roles: [], is_active: true, is_verified: true } };
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); sessionStorage.clear(); });

  it('restaura desde refresh, rota el token y no almacena access token ni usuario', async () => {
    sessionStorage.setItem('fashionstore.refresh', 'refresh-old');
    const service = TestBed.inject(SessionService);
    const ready = service.restore();
    const same = service.restore();
    expect(service.user()).toBeNull();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/refresh');
    expect(request.request.body).toEqual({ refresh_token: 'refresh-old' });
    request.flush({ success: true, message: 'OK', data: tokens });
    await Promise.all([ready, same]);
    expect(service.user()?.id).toBe('buyer');
    expect(service.accessToken).toBe('access-new');
    expect(sessionStorage.getItem('fashionstore.refresh')).toBe('refresh-new');
    expect(sessionStorage.length).toBe(1);
  });
  it('descarta un refresh revocado sin aceptar una sesión falsa', async () => {
    sessionStorage.setItem('fashionstore.refresh', 'revoked');
    const service = TestBed.inject(SessionService);
    const ready = service.restore();
    TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });
    await ready;
    expect(service.user()).toBeNull();
    expect(sessionStorage.getItem('fashionstore.refresh')).toBeNull();
  });
  it('no revive una sesión cerrada mientras se restauraba', async () => {
    sessionStorage.setItem('fashionstore.refresh', 'old');
    const service = TestBed.inject(SessionService);
    const ready = service.restore();
    service.clear();
    TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/refresh').flush({ data: tokens });
    await ready;
    expect(service.user()).toBeNull();
    expect(sessionStorage.getItem('fashionstore.refresh')).toBeNull();
  });
  it('una renovación tardía tampoco revive la sesión después de salir', async () => {
    sessionStorage.setItem('fashionstore.refresh', 'old');
    const service = TestBed.inject(SessionService);
    const http = TestBed.inject(HttpTestingController);
    const ready = service.restore();
    http.expectOne('/api/v1/auth/refresh').flush({ data: tokens });
    await ready;
    const error = vi.fn();
    service.refresh().subscribe({ error });
    service.clear();
    http.expectOne('/api/v1/auth/refresh').flush({ data: tokens });
    expect(error).toHaveBeenCalled();
    expect(service.user()).toBeNull();
    expect(service.accessToken).toBeUndefined();
    expect(sessionStorage.getItem('fashionstore.refresh')).toBeNull();
  });
});
