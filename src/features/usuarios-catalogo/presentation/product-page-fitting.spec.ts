import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ProductPageComponent } from './product-page.component';
import { CatalogService } from '../infrastructure/catalog.service';
import { CommerceService } from '../../ventas-pagos/infrastructure/commerce.service';
import { SessionService } from '../../auth/application/session.service';

const BASE: object = {
  id: 'p1',
  name: 'Camisa',
  slug: 'camisa',
  description: 'Prueba',
  brand: 'FashionStore',
  gender: 'women',
  base_price: 100,
  category: { id: 'c1', slug: 'cat', name: 'Cat' },
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
};

/** Toda prenda publicada se puede probar: la prenda se dibuja sobre el cuerpo.
 * El recurso preparado, cuando existe, solo mejora la vista con la foto real. */
const CON_PROBADOR = {
  ...BASE,
  ar_assets: [{ is_active: true, asset_type: 'image_overlay', asset_url: '/camisa.webp' }],
};
const SIN_PREPARAR = { ...BASE, ar_assets: [] };
const SIN_VARIANTES = { ...BASE, variants: [], ar_assets: [] };

describe('Acceso al probador virtual desde la ficha', () => {
  async function render(setup: {
    product?: object;
    canRead?: boolean;
    variante?: string | null;
  } = {}) {
    const product = setup.product ?? SIN_PREPARAR;
    const catalog = {
      product: vi.fn().mockReturnValue(of(product)),
    } as unknown as CatalogService;
    const commerce = {
      add: vi.fn(),
      branches: vi.fn(),
      cart: vi.fn(),
    } as unknown as CommerceService;
    const session = {
      user: () => (setup.canRead ? { id: 'u1' } : null),
      can: () => !!setup.canRead,
    } as unknown as SessionService;
    const route = {
      paramMap: of({ get: () => 'camisa' }),
      snapshot: {
        queryParamMap: { get: (k: string) => (k === 'variante' ? (setup.variante ?? null) : null) },
      },
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CatalogService, useValue: catalog },
        { provide: CommerceService, useValue: commerce },
        { provide: SessionService, useValue: session },
        { provide: ActivatedRoute, useValue: route },
      ],
    });
    const fixture = TestBed.createComponent(ProductPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('ofrece el probador y pasa la variante al vestidor cuando hay recurso preparado', async () => {
    const fixture = await render({ product: CON_PROBADOR, variante: 'v1' });
const block = fixture.nativeElement.querySelector('.fitting-access');
    const link = block.querySelector('a[href^="/prendas/camisa/vestidor"]');
    expect(link).toBeTruthy();
    expect(block.textContent).toContain('Probarme esta prenda');
    expect(link.getAttribute('href')).toContain('variante=v1');
    expect(block.textContent).not.toContain('no tiene probador');
    expect(fixture.componentInstance.variant()?.id).toBe('v1');
  });
  it('ofrece el probador aunque nadie haya preparado un recurso', async () => {
    // Este era el motivo por el que el probador figuraba como no disponible:
    // ninguna prenda del catálogo tenía una imagen cargada a mano.
    const fixture = await render({ product: SIN_PREPARAR, canRead: false });
    const block = fixture.nativeElement.querySelector('.fitting-access');
    expect(block.textContent).toContain('Probarme esta prenda');
    expect(block.textContent).not.toContain('no tiene probador disponible');
  });
  it('solo lo oculta si la prenda no tiene variantes que probarse', async () => {
    const admin = await render({ product: SIN_VARIANTES, canRead: true });
    const block = admin.nativeElement.querySelector('.fitting-access');
    expect(block.textContent).toContain('no tiene probador disponible');
    expect(block.querySelector('a[href="/admin/products/p1"]')).toBeTruthy();
  });
});