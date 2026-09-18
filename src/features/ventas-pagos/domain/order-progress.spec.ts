import { describe, expect, it } from 'vitest';
import { Order } from './commerce.models';
import { etapasDelPedido, progresoPedido, resumenPedido } from './order-progress';

function pedido(cambios: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    number: 'FS-001',
    customer_email: 'cliente@example.com',
    branch_id: 'b1',
    status: 'pending_payment',
    payment_status: 'pending',
    payment_method: 'manual',
    payment_reference: null,
    total: '129.00',
    currency: 'BOB',
    address: { recipient: 'Cliente', phone: '700', line1: 'Av. 1', city: 'SCZ', country: 'BO' },
    items: [],
    tracking: [],
    carrier: null,
    tracking_number: null,
    created_at: '2026-09-10T10:00:00Z',
    ...cambios,
  } as Order;
}

const estados = (o: Order) => etapasDelPedido(o).map((e) => `${e.clave}:${e.estado}`);

describe('Etapas del pedido', () => {
  it('un pedido recién creado está en la primera etapa y el resto queda pendiente', () => {
    expect(estados(pedido())).toEqual([
      'pending_payment:actual',
      'paid:pendiente',
      'processing:pendiente',
      'shipped:pendiente',
      'delivered:pendiente',
    ]);
  });

  it('marca como cumplidas las etapas anteriores a la actual', () => {
    const enCamino = pedido({ status: 'shipped', payment_status: 'paid' });
    expect(estados(enCamino)).toEqual([
      'pending_payment:hecha',
      'paid:hecha',
      'processing:hecha',
      'shipped:actual',
      'delivered:pendiente',
    ]);
  });

  it('un pedido entregado tiene todas las etapas cumplidas', () => {
    const entregado = pedido({ status: 'delivered', payment_status: 'paid' });
    expect(estados(entregado).at(-1)).toBe('delivered:actual');
    expect(estados(entregado).filter((e) => e.includes('pendiente'))).toEqual([]);
  });

  it('reconoce el pago aunque el pedido siga sin prepararse', () => {
    const pagado = pedido({ status: 'pending_payment', payment_status: 'paid' });
    const etapas = etapasDelPedido(pagado);
    expect(etapas.find((e) => e.clave === 'paid')?.estado).not.toBe('pendiente');
  });

  it('toma la fecha de cada etapa del historial', () => {
    const conHistorial = pedido({
      status: 'processing',
      payment_status: 'paid',
      tracking: [
        { status: 'paid', note: 'Pago acreditado', date: '2026-09-10T11:00:00Z' },
        { status: 'processing', note: 'Armando el pedido', date: '2026-09-11T09:00:00Z' },
      ],
    });
    const etapas = etapasDelPedido(conHistorial);
    expect(etapas.find((e) => e.clave === 'paid')?.fecha).toBe('2026-09-10T11:00:00Z');
    expect(etapas.find((e) => e.clave === 'processing')?.fecha).toBe('2026-09-11T09:00:00Z');
    // Las etapas que no ocurrieron no inventan fecha.
    expect(etapas.find((e) => e.clave === 'delivered')?.fecha).toBeUndefined();
  });

  it('la primera etapa usa la fecha de creación aunque no haya historial', () => {
    const etapas = etapasDelPedido(pedido());
    expect(etapas[0].fecha).toBe('2026-09-10T10:00:00Z');
  });

  it('un pedido cancelado no muestra etapas futuras como pendientes', () => {
    const cancelado = pedido({
      status: 'cancelled',
      tracking: [{ status: 'cancelled', note: 'Cancelado por el cliente', date: '2026-09-12T08:00:00Z' }],
    });
    const etapas = etapasDelPedido(cancelado);
    expect(etapas.some((e) => e.estado === 'pendiente')).toBe(false);
    const ultima = etapas.at(-1)!;
    expect(ultima.titulo).toBe('Pedido cancelado');
    expect(ultima.fecha).toBe('2026-09-12T08:00:00Z');
  });

  it('distingue un pago vencido de una cancelación', () => {
    const vencido = pedido({ status: 'expired' });
    expect(etapasDelPedido(vencido).at(-1)?.titulo).toBe('Pago vencido');
  });
});

describe('Avance y resumen', () => {
  it('el avance crece con cada etapa cumplida', () => {
    const inicio = progresoPedido(etapasDelPedido(pedido()));
    const medio = progresoPedido(etapasDelPedido(pedido({ status: 'processing', payment_status: 'paid' })));
    const fin = progresoPedido(etapasDelPedido(pedido({ status: 'delivered', payment_status: 'paid' })));
    expect(inicio).toBe(0);
    expect(medio).toBeGreaterThan(inicio);
    expect(fin).toBe(100);
  });

  it('resume en una frase dónde está el pedido', () => {
    expect(resumenPedido(pedido())).toContain('Recibimos tu pedido');
    expect(resumenPedido(pedido({ status: 'processing', payment_status: 'paid' }))).toContain(
      'armando',
    );
  });

  it('incluye el número de seguimiento cuando el pedido va en camino', () => {
    const enCamino = pedido({
      status: 'shipped',
      payment_status: 'paid',
      tracking_number: 'TRK-99',
      carrier: 'Transportes Sur',
    });
    const resumen = resumenPedido(enCamino);
    expect(resumen).toContain('TRK-99');
    expect(resumen).toContain('Transportes Sur');
  });
});
