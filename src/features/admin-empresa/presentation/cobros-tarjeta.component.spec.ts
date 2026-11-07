import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CobrosTarjetaComponent } from './cobros-tarjeta.component';
import { StripePaymentAccount, StripeSaasApi } from '../../plataforma-saas/infrastructure/stripe-saas.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { cuentaCobroActiva, cuentaCobroNoConectada, cuentaCobroPendiente, onboardingRespuesta } from '../../plataforma-saas/presentation/stripe-saas.fixtures';

describe('Cobros de la empresa con Stripe Connect', () => {
  async function create(account: StripePaymentAccount = cuentaCobroNoConectada.data, overrides: object = {}, can = true, query: Record<string,string> = {}) {
    const api = { account: vi.fn(() => of(account)), onboarding: vi.fn(() => of(onboardingRespuesta.data)), redirect: vi.fn(() => true), ...overrides };
    await TestBed.configureTestingModule({ imports: [CobrosTarjetaComponent], providers: [provideRouter([]),
      { provide: StripeSaasApi, useValue: api }, { provide: SessionService, useValue: { can: () => can } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
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
  it('enlace vencido solicita otro enlace y el error sigue visible sin cuenta cargada', async () => {
    const {fixture,component,api} = await create(cuentaCobroNoConectada.data, {
      onboarding: vi.fn(() => throwError(() => ({error:{error:{message:'Completá la configuración de Connect en el entorno de prueba.'}}}))),
    },true,{stripe:'reintentar'});
    fixture.detectChanges();
    expect(api.onboarding).toHaveBeenCalledOnce();
    expect(component.account()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Completá la configuración de Connect en el entorno de prueba.');
    expect(fixture.nativeElement.textContent).toContain('Reintentar conexión con Stripe');
    expect(fixture.nativeElement.textContent).toContain('Stripe está en modo prueba');
  });
  it('volver del alta consulta el estado real sin habilitar cargos desde la URL', async () => {
    const {component,api} = await create(cuentaCobroPendiente.data,{},true,{stripe:'volver'});
    expect(api.account).toHaveBeenCalledOnce();
    expect(api.onboarding).not.toHaveBeenCalled();
    expect(component.account()?.charges_enabled).toBe(false);
  });
});
