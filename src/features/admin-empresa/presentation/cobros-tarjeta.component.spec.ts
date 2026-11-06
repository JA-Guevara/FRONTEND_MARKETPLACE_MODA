import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CobrosTarjetaComponent } from './cobros-tarjeta.component';
import { StripePaymentAccount, StripeSaasApi } from '../../plataforma-saas/infrastructure/stripe-saas.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { cuentaCobroActiva, cuentaCobroNoConectada, cuentaCobroPendiente, onboardingRespuesta } from '../../plataforma-saas/presentation/stripe-saas.fixtures';

describe('Cobros de la empresa con Stripe Connect', () => {
  async function create(account: StripePaymentAccount = cuentaCobroNoConectada.data, overrides: object = {}, can = true) {
    const api = { account: vi.fn(() => of(account)), onboarding: vi.fn(() => of(onboardingRespuesta.data)), redirect: vi.fn(() => true), ...overrides };
    await TestBed.configureTestingModule({ imports: [CobrosTarjetaComponent], providers: [provideRouter([]),
      { provide: StripeSaasApi, useValue: api }, { provide: SessionService, useValue: { can: () => can } },
    ] }).compileComponents();
    const fixture = TestBed.createComponent(CobrosTarjetaComponent); fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, api };
  }
  it('sin cuenta ofrece conectar y abre el enlace devuelto por onboarding', async () => {
    const { fixture, component, api } = await create();
    expect(fixture.nativeElement.textContent).toContain('Conecta tu cuenta de Stripe para aceptar tarjeta en tu tienda.');
    component.connect();
    expect(api.onboarding).toHaveBeenCalledOnce();
    expect(api.redirect).toHaveBeenCalledWith(onboardingRespuesta.data.onboarding_url, 'onboarding');
  });
  it('pendiente mantiene cargos deshabilitados y ofrece continuar registro', async () => {
    const { fixture } = await create(cuentaCobroPendiente.data);
    expect(fixture.nativeElement.textContent).toContain('Stripe está revisando tus datos.');
    expect(fixture.nativeElement.textContent).toContain('Continuar registro');
    expect(fixture.nativeElement.textContent).toContain('Cargos no habilitados');
  });
  it('activa muestra indicadores reales y métodos manuales, sin claves secretas', async () => {
    const { fixture } = await create(cuentaCobroActiva.data);
    expect(fixture.nativeElement.textContent).toContain('Tu tienda acepta tarjeta. El dinero llega a tu cuenta de Stripe.');
    expect(fixture.nativeElement.textContent).toContain('acct_…7Qx2');
    expect(fixture.nativeElement.querySelector('a[href="/admin/empresa/perfil"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeNull();
  });
  it('503 deja explicación y sin permiso ni siquiera consulta o inicia conexión', async () => {
    const { fixture, component, api } = await create(cuentaCobroNoConectada.data, {}, false);
    component.connect(); expect(api.account).not.toHaveBeenCalled(); expect(api.onboarding).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    const result = await create(cuentaCobroNoConectada.data, { account: () => throwError(() => ({ status: 503, error: { error: { code: 'billing_not_configured' } } })) });
    expect(result.fixture.nativeElement.textContent).toContain('Los cobros con tarjeta no están disponibles en este momento.');
  });
});
