import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { PosPageComponent } from './pos-page.component';
import { CommerceService } from '../infrastructure/commerce.service';
import { Branch, CartItem, CashPoint } from '../domain/commerce.models';

const polera: CartItem = {
  variant_id: 'v1', product_id: 'p1', name: 'Polera básica', sku: 'POL-001', size: 'M',
  color: 'Negro', image_url: null, unit_price: '100.00', quantity: 0, available: 3,
  line_total: '0.00',
};
const camisa: CartItem = {
  variant_id: 'v2', product_id: 'p2', name: 'Camisa lino', sku: 'CAM-002', size: 'L',
  color: 'Blanco', image_url: null, unit_price: '250.00', quantity: 0, available: 1,
  line_total: '0.00',
};
const sucursal: Branch = { id: 'b1', name: 'Central', address: 'Av. 1' };
const cajas: CashPoint[] = [{ id: 'c1', code: 'C1', name: 'Caja 1', branch_id: 'b1' }];

async function setup(stock: CartItem[] = [polera, camisa]) {
  const api = {
    branches: vi.fn().mockResolvedValue([sucursal]),
    cashPoints: vi.fn().mockResolvedValue(cajas),
    posStock: vi.fn().mockResolvedValue(stock),
    posSale: vi.fn().mockResolvedValue({
      id: 'o1', number: 'FS-POS-1', total: '100.00', currency: 'BOB',
      customer_email: 'cliente@example.test',
    }),
  };
  TestBed.configureTestingModule({
    imports: [PosPageComponent],
    providers: [
      { provide: CommerceService, useValue: api },
      { provide: HttpClient, useValue: { get: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(PosPageComponent);
  const pos = fixture.componentInstance;
  await fixture.whenStable();
  pos.branch = 'b1';
  await pos.cargarSucursal();
  fixture.detectChanges();
  return { fixture, pos, api };
}

/** Deja la venta en condiciones de cobrarse, salvo lo que cada prueba altere. */
function completar(pos: PosPageComponent) {
  pos.customerName = 'Ana Perez';
  pos.reference = 'REC-0098';
  pos.received = true;
}

describe('Caja: armado de la venta', () => {
  it('con una sola caja la elige sola, para no pedir un clic de más', async () => {
    const { pos } = await setup();
    expect(pos.cashPoint).toBe('c1');
  });

  it('el disponible descuenta lo que ya está en la venta', async () => {
    const { pos } = await setup();
    expect(pos.disponibleReal(polera)).toBe(3);
    pos.cambiar(polera, 2);
    expect(pos.disponibleReal(polera)).toBe(1);
  });

  it('no deja pasarse del stock de la sucursal', async () => {
    const { pos } = await setup();
    pos.fijar(polera, 99);
    expect(pos.lineas()[0].cantidad).toBe(3);
  });

  it('poner la cantidad en cero saca la prenda de la venta', async () => {
    const { pos } = await setup();
    pos.cambiar(polera, 2);
    pos.fijar(polera, 0);
    expect(pos.lineas()).toEqual([]);
  });

  it('suma el total y las unidades de varias prendas', async () => {
    const { pos } = await setup();
    pos.cambiar(polera, 2);
    pos.cambiar(camisa, 1);
    expect(pos.total()).toBe(450);
    expect(pos.unidades()).toBe(3);
  });
});

describe('Caja: escaneo por código', () => {
  it('un SKU exacto agrega la prenda y limpia el buscador', async () => {
    const { pos } = await setup();
    pos.search = 'cam-002';
    pos.agregarPorCodigo();
    expect(pos.lineas()[0].item.sku).toBe('CAM-002');
    expect(pos.search).toBe('');
  });

  it('una búsqueda con un solo resultado también agrega', async () => {
    const { pos } = await setup();
    pos.search = 'lino';
    pos.agregarPorCodigo();
    expect(pos.lineas().length).toBe(1);
  });

  it('una búsqueda ambigua no adivina', async () => {
    const { pos } = await setup();
    pos.search = 'a';
    pos.agregarPorCodigo();
    expect(pos.lineas()).toEqual([]);
  });

  it('avisa en vez de agregar una prenda sin stock restante', async () => {
    const { pos } = await setup();
    pos.cambiar(camisa, 1); // la única unidad
    pos.search = 'CAM-002';
    pos.agregarPorCodigo();
    expect(pos.lineas()[0].cantidad).toBe(1);
    expect(pos.error()).toContain('No queda stock');
  });
});

describe('Caja: cobro y vuelto', () => {
  it('calcula el vuelto sobre el total', async () => {
    const { pos } = await setup();
    pos.cambiar(polera, 2);
    pos.recibido = 250;
    expect(pos.vuelto()).toBe(50);
  });

  it('un pago insuficiente da vuelto negativo y no deja cobrar', async () => {
    const { pos, api } = await setup();
    pos.cambiar(polera, 2);
    completar(pos);
    pos.recibido = 100;
    expect(pos.vuelto()).toBe(-100);
    await pos.cobrar();
    expect(api.posSale).not.toHaveBeenCalled();
    expect(pos.error()).toContain('no alcanza');
  });

  it('no cobra sin confirmar que el pago fue recibido', async () => {
    const { pos, api } = await setup();
    pos.cambiar(polera, 1);
    completar(pos);
    pos.received = false;
    await pos.cobrar();
    expect(api.posSale).not.toHaveBeenCalled();
    expect(pos.error()).toContain('recibiste el pago');
  });

  it('manda al servidor solo identidades y cantidades, nunca precios', async () => {
    const { pos, api } = await setup();
    pos.cambiar(polera, 2);
    completar(pos);
    pos.recibido = 500;
    await pos.cobrar();

    const cuerpo = api.posSale.mock.calls[0][0];
    expect(cuerpo.items).toEqual([{ variant_id: 'v1', quantity: 2 }]);
    expect(JSON.stringify(cuerpo)).not.toContain('unit_price');
    expect(cuerpo.client_request_id).toBeTruthy();
  });

  it('tras cobrar muestra el vuelto que se entregó y el correo del comprobante', async () => {
    const { fixture, pos } = await setup();
    pos.cambiar(polera, 1);
    completar(pos);
    pos.recibido = 200;
    await pos.cobrar();
    fixture.detectChanges();

    expect(pos.vueltoCobrado()).toBe(100);
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('FS-POS-1');
    expect(texto).toContain('cliente@example.test');
  });

  it('una transferencia no arrastra el vuelto de un cobro en efectivo', async () => {
    const { pos } = await setup();
    pos.cambiar(polera, 1);
    completar(pos);
    pos.recibido = 500;
    pos.paymentMethod = 'transfer';
    await pos.cobrar();
    expect(pos.vueltoCobrado()).toBeNull();
  });

  it('empezar otra venta limpia el mostrador', async () => {
    const { pos } = await setup();
    pos.cambiar(polera, 1);
    completar(pos);
    await pos.cobrar();
    pos.nuevaVenta();

    expect(pos.cobrada()).toBeNull();
    expect(pos.lineas()).toEqual([]);
    expect(pos.reference).toBe('');
    expect(pos.received).toBe(false);
  });
});

describe('Caja: medios de pago (RF18)', () => {
  it('ofrece efectivo, QR, tarjeta y transferencia', async () => {
    const { fixture } = await setup();
    const texto = fixture.nativeElement.textContent;
    for (const medio of ['Efectivo', 'QR', 'Tarjeta', 'Transferencia']) {
      expect(texto).toContain(medio);
    }
  });

  it('la referencia que se pide cambia según el medio', async () => {
    const { pos } = await setup();
    pos.elegirMedio('cash');
    expect(pos.etiquetaReferencia()).toContain('recibo');
    pos.elegirMedio('qr');
    expect(pos.etiquetaReferencia()).toContain('transacción');
    pos.elegirMedio('card');
    expect(pos.etiquetaReferencia()).toContain('Voucher');
    pos.elegirMedio('transfer');
    expect(pos.etiquetaReferencia()).toContain('comprobante');
  });

  it('cambiar de medio limpia la referencia del anterior', async () => {
    const { pos } = await setup();
    pos.reference = 'REC-0098';
    pos.elegirMedio('qr');
    expect(pos.reference).toBe('');
  });

  it('solo el efectivo arrastra el importe recibido', async () => {
    const { pos } = await setup();
    pos.recibido = 500;
    pos.elegirMedio('card');
    expect(pos.recibido).toBeNull();
  });

  it('cobra con QR sin exigir vuelto', async () => {
    const { pos, api } = await setup();
    pos.cambiar(polera, 1);
    completar(pos);
    pos.elegirMedio('qr');
    pos.reference = 'QR-20260918-0042';
    await pos.cobrar();

    expect(api.posSale.mock.calls[0][0].payment_method).toBe('qr');
    expect(pos.vueltoCobrado()).toBeNull();
  });
});
