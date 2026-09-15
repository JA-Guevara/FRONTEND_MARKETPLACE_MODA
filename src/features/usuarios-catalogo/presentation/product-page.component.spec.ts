import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ProductPageComponent } from './product-page.component';
import { CatalogService } from '../infrastructure/catalog.service';
import { CommerceService } from '../../ventas-pagos/infrastructure/commerce.service';
import { SessionService } from '../../auth/application/session.service';
import { TryOnListService } from '../../reservas-vestidor/application/try-on-list.service';
import { Product } from '../domain/catalog.models';

const PRODUCT: Product = {
  id: 'p1',
  name: 'Camisa',
  slug: 'camisa',
  description: 'Prueba',
  brand: 'FashionStore',
  gender: 'women',
  base_price: 100,
  category: { id: 'c1', slug: 'cat', name: 'Cat' },
  season: null,
  collection: null,
  is_featured: false,
  variants: [
    {
      id: 'v1',
      sku: 'SKU-1',
      is_active: true,
      size: { id: 's1', name: 'M', code: 'M' },
      color: { id: 'cl1', name: 'Arena', hex_code: '#ccc' },
    },
  ],
  images: [],
  ar_assets: [],
};

describe('Agregar prendas a la reserva desde el detalle', () => {
  beforeEach(() => {
    sessionStorage.removeItem('fs-try-on-list');
  });
  async function setup(overrides: { user?: unknown } = {}) {
    const catalog = { product: vi.fn().mockReturnValue(of(PRODUCT)) } as unknown as CatalogService;
    const commerce = { add: vi.fn(), branches: vi.fn(), cart: vi.fn() } as unknown as CommerceService;
    const session = { user: vi.fn().mockReturnValue(overrides.user ?? { id: 'u1' }) } as unknown as SessionService;
    const route = { paramMap: of({ get: (k: string) => (k === 'slug' ? 'camisa' : null) }) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CatalogService, useValue: catalog },
        { provide: CommerceService, useValue: commerce },
        { provide: SessionService, useValue: session },
        { provide: ActivatedRoute, useValue: route },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new ProductPageComponent());
    const tryOn = TestBed.inject(TryOnListService);
    await Promise.resolve();
    return { component, tryOn, commerce };
  }
  it('agrega la variante elegida con la cantidad y muestra el mensaje exacto', async () => {
    const { component, tryOn } = await setup();
    component.variant.set(PRODUCT.variants[0]);
    component.addToTryOn();
    expect(tryOn.items().length).toBe(1);
    expect(tryOn.items()[0].variant_id).toBe('v1');
    expect(tryOn.items()[0].quantity).toBe(1);
    expect(component.tryOnMessage()).toBe(
      'Prenda añadida a tu selección. Elegí sucursal y horario para registrar la reserva.',
    );
  });
  it('recorta la cantidad a 1..10 y avisa al superar el máximo por talla', async () => {
    const { component, tryOn } = await setup();
    component.variant.set(PRODUCT.variants[0]);
    component.tryOnQuantity = 999;
    component.addToTryOn();
    expect(tryOn.items()[0].quantity).toBe(10);
    component.addToTryOn();
    expect(component.tryOnMessage()).toContain('No podés agregar más de 10 unidades');
  });
  it('no agrega sin una variante elegida', async () => {
    const { component, tryOn } = await setup();
    component.addToTryOn();
    expect(tryOn.items()).toEqual([]);
    expect(component.tryOnMessage()).toBe('');
  });
  it('cambiar de variante limpia el mensaje anterior', async () => {
    const { component } = await setup();
    component.selectVariant(PRODUCT.variants[0]);
    component.addToTryOn();
    expect(component.tryOnMessage()).toBeTruthy();
    component.selectVariant(PRODUCT.variants[0]);
    expect(component.tryOnMessage()).toBe('');
  });
});