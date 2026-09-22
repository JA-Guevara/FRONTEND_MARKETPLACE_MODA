import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { authGuard } from './auth.guard';
import { SessionService } from '../../features/usuarios-catalogo/application/session.service';
describe('Rutas protegidas', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  const guard = () =>
    TestBed.runInInjectionContext(() =>
      authGuard(
        { data: { permission: 'catalog.write' } } as unknown as ActivatedRouteSnapshot,
        { url: '/admin/products' } as RouterStateSnapshot,
      ),
    );
  it('redirige a login conservando el destino', () =>
    expect(TestBed.inject(Router).serializeUrl(guard() as any)).toContain(
      'returnUrl=%2Fadmin%2Fproducts',
    ));
  it('rechaza un cliente aunque esté autenticado', () => {
    TestBed.inject(SessionService).user.set({
      id: 'u',
      email: 'a@b.com',
      first_name: 'Ana',
      last_name: 'Flores',
      phone: null,
      is_active: true,
      is_verified: true,
      roles: [],
    });
    expect(TestBed.inject(Router).serializeUrl(guard() as any)).toBe('/sin-acceso');
  });
});

