import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PlanEditorComponent } from './plan-editor.component';
import { PlanesPageComponent } from './planes-page.component';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { StripeSaasApi } from '../infrastructure/stripe-saas.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { plans } from './saas-test-fixtures';
import { precioPlanRespuesta } from './stripe-saas.fixtures';

describe('Planes con precio Stripe', () => {
  function configure(can = true) {
    const stripe = { planPrice: vi.fn(() => of(precioPlanRespuesta.data)) };
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      { provide: SessionService, useValue: { can: () => can } }, { provide: StripeSaasApi, useValue: stripe },
      { provide: PlataformaApi, useValue: { plans: () => of(plans), featureCatalog: () => of([]) } },
    ] });
    return stripe;
  }
  it('valida price_ y guarda por el endpoint de precio sin enviar claves ni editar otros campos', async () => {
    const api = configure(); const fixture = TestBed.createComponent(PlanEditorComponent);
    fixture.componentRef.setInput('plan', plans[1]); fixture.detectChanges();
    fixture.componentInstance.stripePrice = 'sk_test_no_es_un_precio'; await fixture.componentInstance.saveStripePrice();
    expect(api.planPrice).not.toHaveBeenCalled();
    fixture.componentInstance.stripePrice = 'price_test_profesional_mes'; await fixture.componentInstance.saveStripePrice();
    expect(api.planPrice).toHaveBeenCalledExactlyOnceWith(plans[1].id, 'price_test_profesional_mes');
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Precio de Stripe actualizado.');
  });
  it('solo lectura no puede cambiar el precio ni invocar la escritura', async () => {
    const api = configure(false); const fixture = TestBed.createComponent(PlanEditorComponent);
    fixture.componentRef.setInput('plan', plans[0]); fixture.detectChanges();
    await fixture.whenStable(); fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('#stripe-price-month') as HTMLInputElement).disabled).toBe(true);
    fixture.componentInstance.stripePrice = 'price_test_profesional_mes'; await fixture.componentInstance.saveStripePrice();
    expect(api.planPrice).not.toHaveBeenCalled();
  });
  it('el catálogo indica Sin precio y explica cuando ningún plan está listo', async () => {
    configure(false); const fixture = TestBed.createComponent(PlanesPageComponent);
    fixture.detectChanges(); await fixture.componentInstance.load(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sin precio');
    expect(fixture.nativeElement.textContent).toContain('Ningún plan se puede pagar con tarjeta todavía.');
  });
});
