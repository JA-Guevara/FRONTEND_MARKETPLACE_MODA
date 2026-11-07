import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { MiSuscripcionComponent } from './mi-suscripcion.component';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { StripeSaasApi, safeStripeUrl } from '../infrastructure/stripe-saas.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { detail } from './saas-test-fixtures';
import { billingCheckoutRespuesta, billingPortalRespuesta, billingNoConfigurado, billingPortalSinCliente } from './stripe-saas.fixtures';

describe('Suscripción: pago seguro y actualización por webhook', () => {
  const plans = [{ code: 'PROFESIONAL', name: 'Profesional', reference_price: '690.00', stripe_ready: true }];
  async function create(overrides: object = {}, can = true, returned = false) {
    const api = { plans: vi.fn(() => of(plans)), checkout: vi.fn(() => of(billingCheckoutRespuesta.data)),
      portal: vi.fn(() => of(billingPortalRespuesta.data)), redirect: vi.fn(() => true), ...overrides };
    await TestBed.configureTestingModule({ imports: [MiSuscripcionComponent], providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(returned ? { pago: 'ok' } : {}), paramMap: convertToParamMap({}) } } },
      { provide: SessionService, useValue: { can: () => can } },
      { provide: PlataformaApi, useValue: { mySubscription: () => of(detail()), myInvoices: () => of([]) } },
      { provide: StripeSaasApi, useValue: api },
    ] }).compileComponents();
    const fixture = TestBed.createComponent(MiSuscripcionComponent); fixture.detectChanges();
    return { fixture, api, component: fixture.componentInstance };
  }
  it('envía el plan seleccionado, bloquea el doble clic y redirige solo tras recibir checkout', async () => {
    const response = new Subject<typeof billingCheckoutRespuesta.data>();
    const { component, api, fixture } = await create({ checkout: vi.fn(() => response) });
    component.payPlan('PROFESIONAL'); component.payPlan('PROFESIONAL'); fixture.detectChanges();
    expect(api.checkout).toHaveBeenCalledExactlyOnceWith('PROFESIONAL');
    expect(fixture.nativeElement.textContent).toContain('Abriendo el pago seguro de Stripe…');
    response.next(billingCheckoutRespuesta.data); response.complete();
    expect(api.redirect).toHaveBeenCalledWith(billingCheckoutRespuesta.data.checkout_url, 'checkout');
  });
  it('sin billing.manage no ofrece controles ni envía pagos aunque se invoque el método', async () => {
    const { fixture, component, api } = await create({}, false);
    expect(fixture.nativeElement.textContent).not.toContain('Pagar con tarjeta');
    component.payPlan('PROFESIONAL'); component.openPortal();
    expect(api.checkout).not.toHaveBeenCalled(); expect(api.portal).not.toHaveBeenCalled();
  });
  it('si Stripe no está configurado conserva el pago manual y no cambia la suscripción', async () => {
    const { component, api, fixture } = await create({ checkout: () => throwError(() => ({ status: 503, error: billingNoConfigurado })) });
    const before = component.detail(); component.payPlan('PROFESIONAL'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('El cobro con tarjeta no está configurado. Usa el pago manual.');
    expect(fixture.nativeElement.textContent).toContain('Solicitar renovación');
    expect(component.detail()).toBe(before); expect(api.redirect).not.toHaveBeenCalled();
  });
  it('portal sin cliente muestra el mensaje recuperable y no redirige', async () => {
    const { component, api, fixture } = await create({ portal: () => throwError(() => ({ status: 409, error: billingPortalSinCliente })) });
    component.openPortal(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Primero paga un plan con tarjeta.');
    expect(api.redirect).not.toHaveBeenCalled();
  });
  it('el retorno ok solo informa y no activa el plan desde el navegador', async () => {
    const { fixture, component, api } = await create({}, true, true);
    expect(fixture.nativeElement.textContent).toContain('Volviste de Stripe. El pago del plan se acredita cuando el servidor recibe la confirmación; revisá el estado de cuenta.');
    expect(component.detail()?.current.id).toBe(detail().current.id);
    expect(api.checkout).not.toHaveBeenCalled();
    expect(safeStripeUrl('javascript:alert(1)', 'checkout')).toBeNull();
    expect(safeStripeUrl('https://checkout.stripe.com.evil.example/x', 'checkout')).toBeNull();
    expect(safeStripeUrl(billingCheckoutRespuesta.data.checkout_url, 'checkout')).toBe(billingCheckoutRespuesta.data.checkout_url);
  });
});
