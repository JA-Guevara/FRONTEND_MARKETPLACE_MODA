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
    pos.search.set('cam-002');
    pos.agregarPorCodigo();
    expect(pos.lineas()[0].item.sku).toBe('CAM-002');
    expect(pos.search()).toBe('');
  });

  it('una búsqueda con un solo resultado también agrega', async () => {
    const { pos } = await setup();
    pos.search.set('lino');
    pos.agregarPorCodigo();
    expect(pos.lineas().length).toBe(1);
  });

  it('una búsqueda ambigua no adivina', async () => {
    const { pos } = await setup();
    pos.search.set('a');
    pos.agregarPorCodigo();
    expect(pos.lineas()).toEqual([]);
  });

  it('avisa en vez de agregar una prenda sin stock restante', async () => {
    const { pos } = await setup();
    pos.cambiar(camisa, 1); // la única unidad
    pos.search.set('CAM-002');
    pos.agregarPorCodigo();
    expect(pos.lineas()[0].cantidad).toBe(1);
    expect(pos.error()).toContain('No queda stock');
  });
});

describe('Caja: cobro y vuelto', () => {
  it('calcula el vuelto sobre el total', async () => {
    const { pos } = await setup();
    pos.cambiar(polera, 2);
    pos.recibido.set(250);
    expect(pos.vuelto()).toBe(50);
  });

  it('un pago insuficiente da vuelto negativo y no deja cobrar', async () => {
    const { pos, api } = await setup();
    pos.cambiar(polera, 2);
    completar(pos);
    pos.recibido.set(100);
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
    pos.recibido.set(500);
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
    pos.recibido.set(200);
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
    pos.recibido.set(500);
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
    pos.recibido.set(500);
    pos.elegirMedio('card');
    expect(pos.recibido()).toBeNull();
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

describe('Caja: regresiones de un mostrador real', () => {
  it('el vuelto se recalcula cada vez que el cajero corrige el importe', async () => {
    // Regresión: `vuelto` era un computed() que leía un campo común, así que se
    // congelaba en el primer valor leído. Tecleando 200 mostraba el vuelto de 2
    // y el cajero devolvía de menos. Leer ANTES de cambiar es lo que lo destapa.
    const { pos } = await setup();
    pos.cambiar(polera, 2); // 200.00

    pos.recibido.set(2);
    expect(pos.vuelto()).toBe(-198);

    pos.recibido.set(20);
    expect(pos.vuelto()).toBe(-180);

    pos.recibido.set(200);
    expect(pos.vuelto()).toBe(0);

    pos.recibido.set(500);
    expect(pos.vuelto()).toBe(300);
  });

  it('el vuelto también sigue los cambios de la venta', async () => {
    const { pos } = await setup();
    pos.recibido.set(500);
    pos.cambiar(polera, 1);
    expect(pos.vuelto()).toBe(400);
    pos.cambiar(camisa, 1);
    expect(pos.vuelto()).toBe(150);
  });

  it('cada línea muestra su importe, no el precio unitario suelto', async () => {
    const { fixture, pos } = await setup();
    pos.cambiar(polera, 3);
    fixture.detectChanges();
    // 3 × 100 = 300: mostrar solo "100.00" hacía parecer que la línea costaba eso.
    expect(pos.importeLinea(pos.lineas()[0])).toBe(300);
    expect(fixture.nativeElement.textContent).toContain('300.00');
  });

  it('un correo mal escrito se avisa acá y no se pierde el cobro en el servidor', async () => {
    const { pos, api } = await setup();
    pos.cambiar(polera, 1);
    completar(pos);
    pos.customerEmail = 'srtstjstjyrjryj';
    await pos.cobrar();

    expect(api.posSale).not.toHaveBeenCalled();
    expect(pos.error()).toContain('correo');
  });

  it('sin correo la venta igual se cobra', async () => {
    const { pos, api } = await setup();
    pos.cambiar(polera, 1);
    completar(pos);
    pos.customerEmail = '   ';
    await pos.cobrar();
    expect(api.posSale).toHaveBeenCalled();
  });

  it('un correo válido pasa', async () => {
    const { pos, api } = await setup();
    pos.cambiar(polera, 1);
    completar(pos);
    pos.customerEmail = 'ana@example.test';
    await pos.cobrar();
    expect(api.posSale).toHaveBeenCalled();
  });
});

describe('Caja: listado manejable', () => {
  /** 120 variantes, como el catálogo real. */
  function catalogoGrande(): CartItem[] {
    return Array.from({ length: 120 }, (_, i) => ({
      ...polera,
      variant_id: 'v' + i,
      sku: 'SKU-' + String(i).padStart(3, '0'),
      name: i % 2 === 0 ? 'Polera básica' : 'Camisa lino',
      available: i < 5 ? 0 : 10,
    }));
  }

  it('no vuelca el catálogo entero en la tabla', async () => {
    const { pos } = await setup(catalogoGrande());
    expect(pos.coincidencias().length).toBe(120);
    expect(pos.visibles().length).toBe(40);
    expect(pos.ocultas()).toBe(80);
  });

  it('lo que tiene stock se muestra antes que lo agotado', async () => {
    const { pos } = await setup(catalogoGrande());
    expect(pos.visibles().every((i) => pos.disponibleReal(i) > 0)).toBe(true);
  });

  it('al afinar la búsqueda deja de haber filas ocultas', async () => {
    const { pos } = await setup(catalogoGrande());
    pos.search.set('SKU-007');
    expect(pos.coincidencias().length).toBe(1);
    expect(pos.ocultas()).toBe(0);
  });

  it('el escaneo encuentra un SKU que la tabla no está dibujando', async () => {
    // El recorte es visual: si el cajero escanea algo fuera de las 40 filas,
    // igual se tiene que agregar.
    const { pos } = await setup(catalogoGrande());
    pos.search.set('SKU-119');
    pos.agregarPorCodigo();
    expect(pos.lineas()[0].item.sku).toBe('SKU-119');
  });
});
