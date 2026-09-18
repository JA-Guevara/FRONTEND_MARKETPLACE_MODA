import { TestBed } from '@angular/core/testing';
import { OrderReturnsComponent } from './order-returns.component';
import { CommerceService } from '../infrastructure/commerce.service';
import { CartItem, Order, ReturnAvailability } from '../domain/commerce.models';

const prenda: CartItem = {
  variant_id: 'v1', product_id: 'p1', name: 'Polera básica', sku: 'POL-001', size: 'M',
  color: 'Negro', image_url: null, unit_price: '100.00', quantity: 2, available: 5,
  line_total: '200.00',
};
const entregado: Order = {
  id: 'order-1', number: 'FS-TEST', customer_email: 'buyer@example.test', branch_id: 'b1', status: 'delivered',
  payment_status: 'paid', payment_method: 'manual', payment_reference: 'rec-1', total: '200.00',
  currency: 'BOB',
  address: { recipient: 'Buyer', phone: '123', line1: 'Calle', city: 'SCZ', country: 'BO' },
  items: [prenda], tracking: [], carrier: null, tracking_number: null,
  created_at: '2026-09-16T17:53:00Z',
};
const disponible: ReturnAvailability = {
  can_request: true, reason: null, units: { v1: 2 }, returns: [],
};

async function setup(estado: ReturnAvailability = disponible) {
  const api = {
    returnsOf: vi.fn().mockResolvedValue(estado),
    requestReturn: vi.fn().mockResolvedValue({ id: 'r1' }),
  };
  TestBed.configureTestingModule({
    imports: [OrderReturnsComponent],
    providers: [{ provide: CommerceService, useValue: api }],
  });
  const fixture = TestBed.createComponent(OrderReturnsComponent);
  fixture.componentRef.setInput('pedido', entregado);
  fixture.detectChanges();
  return { fixture, api, componente: fixture.componentInstance };
}

/** Abre el panel y espera a que llegue la respuesta del servidor. */
async function abrir(contexto: Awaited<ReturnType<typeof setup>>) {
  await contexto.componente.toggle();
  contexto.fixture.detectChanges();
}

describe('Panel de devoluciones (CU19)', () => {
  it('no consulta al servidor hasta que el cliente abre el panel', async () => {
    const contexto = await setup();
    expect(contexto.api.returnsOf).not.toHaveBeenCalled();
    await abrir(contexto);
    expect(contexto.api.returnsOf).toHaveBeenCalledWith('order-1');
  });

  it('ofrece devolver solo las prendas que todavía tienen unidades disponibles', async () => {
    const contexto = await setup({ ...disponible, units: {} });
    await abrir(contexto);
    expect(contexto.componente.devolvibles()).toEqual([]);
  });

  it('no deja pedir más unidades de las que quedan', async () => {
    const contexto = await setup();
    await abrir(contexto);
    contexto.componente.setCantidad('v1', 9);
    expect(contexto.componente.cantidad('v1')).toBe(2);
  });

  it('ignora cantidades negativas o no numéricas', async () => {
    const contexto = await setup();
    await abrir(contexto);
    contexto.componente.setCantidad('v1', -3);
    expect(contexto.componente.cantidad('v1')).toBe(0);
  });

  it('avisa en vez de enviar una solicitud sin prendas', async () => {
    const contexto = await setup();
    await abrir(contexto);
    contexto.componente.motivo = 'La talla no me quedó bien.';
    await contexto.componente.enviar();
    expect(contexto.api.requestReturn).not.toHaveBeenCalled();
    expect(contexto.componente.error()).toContain('cuántas unidades');
  });

  it('envía el detalle elegido y vuelve a consultar el estado', async () => {
    const contexto = await setup();
    await abrir(contexto);
    contexto.componente.setCantidad('v1', 1);
    contexto.componente.motivo = 'La talla no me quedó bien.';
    await contexto.componente.enviar();
    const [id, cuerpo] = contexto.api.requestReturn.mock.calls[0];
    expect(id).toBe('order-1');
    expect(cuerpo.items).toEqual([{ variant_id: 'v1', quantity: 1 }]);
    expect(cuerpo.reason).toContain('talla');
    // Tras enviar se recarga para reflejar lo que quedó comprometido.
    expect(contexto.api.returnsOf).toHaveBeenCalledTimes(2);
    expect(contexto.componente.cantidad('v1')).toBe(0);
  });

  it('explica por qué no se puede devolver cuando el servidor lo impide', async () => {
    const contexto = await setup({
      can_request: false, reason: 'El plazo de 15 días para devolver ya venció.', units: {},
      returns: [],
    });
    await abrir(contexto);
    expect(contexto.fixture.nativeElement.textContent).toContain('plazo de 15 días');
    expect(contexto.fixture.nativeElement.textContent).not.toContain('Solicitar una devolución');
  });

  it('muestra las devoluciones ya registradas con su estado y su reintegro', async () => {
    const contexto = await setup({
      can_request: false,
      reason: null,
      units: {},
      returns: [
        {
          id: 'ret-1', order_id: 'order-1', branch_id: 'b1', status: 'approved',
          reason: 'No me quedó bien.', items: [{ ...prenda, quantity: 1, line_total: '100.00' }],
          refund_amount: '100.00', currency: 'BOB', resolution_note: 'Traela a la sucursal.',
          resolved_at: null, created_at: '2026-09-17T10:00:00Z',
        },
      ],
    });
    await abrir(contexto);
    const texto = contexto.fixture.nativeElement.textContent;
    expect(texto).toContain('Devolución aprobada');
    expect(texto).toContain('100.00');
    expect(texto).toContain('Traela a la sucursal.');
  });
});
