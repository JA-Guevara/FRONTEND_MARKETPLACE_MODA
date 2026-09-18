import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { OrdersPageComponent } from './orders-page.component';
import { CommerceService } from '../infrastructure/commerce.service';
import { SessionService } from '../../auth/application/session.service';
import { Order } from '../domain/commerce.models';

const pending: Order = {
  id: 'order-1', number: 'FS-TEST', customer_email: 'buyer@example.test', branch_id: 'b1', status: 'pending_payment',
  payment_status: 'pending', payment_method: 'stripe', payment_reference: null,
  total: '169.00', currency: 'BOB', address: { recipient: 'Buyer', phone: '123', line1: 'Street', city: 'City', country: 'BO' },
  items: [], tracking: [], carrier: null, tracking_number: null, created_at: '2026-09-16T17:53:00Z',
};
const paid = { ...pending, status: 'paid', payment_status: 'paid', payment_reference: 'pi_verified' };

async function setup(query: Record<string, string> = {}, admin = false, result: Order = paid) {
  const api = { orders: vi.fn().mockResolvedValue([pending]), verifyPayment: vi.fn().mockResolvedValue(result), checkout: vi.fn().mockResolvedValue(false), branches: vi.fn().mockResolvedValue([{ id: 'b1', name: 'Sucursal Centro', address: 'Av. 1' }]) };
  TestBed.configureTestingModule({ imports: [OrdersPageComponent], providers: [provideRouter([]),
    { provide: ActivatedRoute, useValue: { snapshot: { data: { admin }, queryParamMap: convertToParamMap(query) } } },
    { provide: CommerceService, useValue: api }, { provide: SessionService, useValue: { can: () => true } },
  ] });
  const fixture = TestBed.createComponent(OrdersPageComponent);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api };
}

describe('Retorno de Stripe en pedidos', () => {
  it('consulta el servidor al volver y retira Pagar solo después de recibir confirmación', async () => {
    const { fixture, api } = await setup({ payment: 'success', pedido: pending.id });
    expect(api.verifyPayment).toHaveBeenCalledWith(pending.id, false);
    expect(fixture.componentInstance.orders()[0].payment_reference).toBe('pi_verified');
    expect(fixture.nativeElement.textContent).toContain('Pago confirmado por Stripe');
    expect(fixture.nativeElement.textContent).not.toContain('Pagar con Stripe');
  });
  it('el parámetro success no acredita un pedido que el servidor mantiene pendiente', async () => {
    const { fixture } = await setup({ payment: 'success', pedido: pending.id }, false, pending);
    expect(fixture.nativeElement.textContent).toContain('Stripe todavía no confirma');
    expect(fixture.nativeElement.textContent).toContain('Pagar con Stripe');
  });
  it('admite sesiones antiguas cuyo retorno no tenía identificador del pedido', async () => {
    const { api } = await setup({ payment: 'success' });
    expect(api.verifyPayment).toHaveBeenCalledWith(pending.id, false);
  });
  it('no acredita ni consulta automáticamente un retorno cancelado', async () => {
    const { fixture, api } = await setup({ payment: 'cancelled', pedido: pending.id });
    expect(api.verifyPayment).not.toHaveBeenCalled();
    expect(fixture.componentInstance.orders()[0].payment_status).toBe('pending');
  });
  it('la gestión verifica con el endpoint administrativo y muestra el estado recibido', async () => {
    const { fixture, api } = await setup({}, true);
    await fixture.componentInstance.verifyPayment(pending.id);
    fixture.detectChanges();
    expect(api.verifyPayment).toHaveBeenCalledWith(pending.id, true);
    expect(fixture.nativeElement.textContent).toContain('Pagado');
    expect(fixture.nativeElement.textContent).not.toContain('Verificar pago con Stripe');
  });
  it('si el intento de pagar detecta un cobro anterior, refresca sin abrir otro checkout', async () => {
    const { fixture, api } = await setup();
    api.orders.mockResolvedValue([paid]);
    await fixture.componentInstance.pay(pending);
    fixture.detectChanges();
    expect(api.checkout).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).not.toContain('Pagar con Stripe');
  });
});

describe('Bandeja de pedidos de gestión', () => {
  it('manda los filtros al servidor y no los aplica en la vista del cliente', async () => {
    const { fixture, api } = await setup({}, true);
    const pos = fixture.componentInstance;
    pos.estado = 'paid';
    pos.canal = 'pos';
    pos.sucursal = 'b1';
    pos.consulta = '  FS-8A3C21 ';
    pos.buscar();
    await fixture.whenStable();

    const [admin, offset, filtros] = api.orders.mock.calls.at(-1)!;
    expect(admin).toBe(true);
    expect(offset).toBe(0);
    expect(filtros).toEqual({
      status: 'paid',
      channel: 'pos',
      branch_id: 'b1',
      q: 'FS-8A3C21',
    });
  });

  it('un filtro nuevo vuelve a la primera página', async () => {
    const { fixture } = await setup({}, true);
    const pos = fixture.componentInstance;
    pos.page(1);
    expect(pos.offset).toBe(50);
    pos.estado = 'shipped';
    pos.buscar();
    expect(pos.offset).toBe(0);
  });

  it('marca el canal de caja y la devolución sin resolver', async () => {
    const { fixture, api } = await setup({}, true);
    api.orders.mockResolvedValue([
      { ...paid, sales_channel: 'pos', has_open_return: true },
    ]);
    await fixture.componentInstance.load();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Caja');
    expect(texto).toContain('Devolución abierta');
  });

  it('el cliente no ve la barra de filtros de gestión', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('.orders-filters')).toBeNull();
  });

  it('limpiar deja los filtros vacíos', async () => {
    const { fixture } = await setup({}, true);
    const pos = fixture.componentInstance;
    pos.estado = 'paid';
    pos.consulta = 'FS-1';
    pos.limpiarFiltros();
    expect(pos.hayFiltros()).toBe(false);
  });
});
