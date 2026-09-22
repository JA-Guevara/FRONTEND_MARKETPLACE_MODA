import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CommerceService } from '../infrastructure/commerce.service';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { CartPageComponent } from './cart-page.component';
import { routes } from '../../../app/core/app.routes';

describe('Compra desde el carrito', () => {
  const cart = {
    currency: 'bob',
    total: '100',
    items: [
      {
        variant_id: 'v1',
        name: 'Camisa',
        sku: 'QA',
        size: 'M',
        color: 'Arena',
        quantity: 1,
        available: 3,
        unit_price: '100',
        line_total: '100',
        product_id: 'p1',
        image_url: null,
      },
    ],
  };
  async function setup() {
    const api = {
      branches: vi.fn().mockResolvedValue([{ id: 'b1', name: 'Centro' }]),
      cart: vi.fn().mockResolvedValue(cart),
      write: vi.fn().mockResolvedValue({ id: 'order1' }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CommerceService, useValue: api },
        { provide: SessionService, useValue: { user: () => null } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new CartPageComponent());
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    return { component, api };
  }
  it('exige sucursal y disponibilidad antes de confirmar', async () => {
    const { component } = await setup();
    expect(component.canBuy()).toBe(false);
    component.branch = 'b1';
    expect(component.canBuy()).toBe(true);
    component.cart.set({ ...cart, items: [{ ...cart.items[0], available: 0 }] });
    expect(component.canBuy()).toBe(false);
  });
  it('un fallo de recarga invalida el stock anterior', async () => {
    const { component, api } = await setup();
    component.branch = 'b1';
    api.cart.mockRejectedValue(new Error('Sin conexión'));
    await component.loadCart();
    expect(component.cart()).toBeNull();
    expect(component.canBuy()).toBe(false);
  });
  it('crea pedido con sucursal y dirección, sin enviar total calculado en cliente', async () => {
    const { component, api } = await setup();
    component.branch = 'b1';
    const navigation = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await component.buy();
    expect(api.write).toHaveBeenCalledWith('POST', '/orders', {
      branch_id: 'b1',
      address: component.address,
      payment_method: 'manual',
      coupon_code: null,
    });
    expect(navigation).toHaveBeenCalledWith(['/mi-cuenta/pedidos'], {
      queryParams: { pedido: 'order1' },
    });
  });
  it('protege las nuevas rutas con sesión y permisos administrativos', () => {
    expect(routes.find((r) => r.path === 'carrito')?.canActivate?.length).toBe(1);
    // Las pantallas personales cuelgan de 'mi-cuenta': la guarda del padre
    // protege a todas sus hijas, así que se verifica ahí.
    const cuenta = routes.find((r) => r.path === 'mi-cuenta')!;
    expect(cuenta.canActivate?.length).toBe(1);
    expect(cuenta.children?.map((r) => r.path)).toContain('pedidos');
    const admin = routes.find((r) => r.path === 'admin')!;
    expect(admin.children?.find((r) => r.path === 'pedidos')?.data?.['permission']).toBe(
      'commerce.read',
    );
    expect(admin.children?.find((r) => r.path === 'promociones')?.data?.['permission']).toBe(
      'commerce.read',
    );
    expect(admin.children?.find((r) => r.path === 'stock')?.data?.['permission']).toBe(
      'stock.read',
    );
  });
});

