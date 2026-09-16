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

/** El probador web funciona con una imagen frontal preparada: el mismo criterio
 * (activo + image_overlay) que usan el catálogo y el vestidor. */
const CON_PROBADOR = {
  ...BASE,
  ar_assets: [{ is_active: true, asset_type: 'image_overlay', asset_url: '/camisa.webp' }],
};
const SIN_PROBADOR = { ...BASE, ar_assets: [] };

describe('Acceso al probador virtual desde la ficha', () => {
  async function render(setup: {
    product?: object;
    canRead?: boolean;
    variante?: string | null;
  } = {}) {
    const product = setup.product ?? SIN_PROBADOR;
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
  it('sin recurso preparado avisa y solo los administradores ven "Configurar probador"', async () => {
    const admin = await render({ canRead: true });
    const block = admin.nativeElement.querySelector('.fitting-access');
    expect(block.textContent).toContain('no tiene probador disponible');
    expect(block.querySelector('a[href="/admin/products/p1"]')).toBeTruthy();
    expect(block.textContent).not.toContain('Probarme esta prenda');
  });
  it('un cliente sin permiso no ve la opción de configuración', async () => {
    const guest = await render({ canRead: false });
    const block = guest.nativeElement.querySelector('.fitting-access');
    expect(block.textContent).toContain('no tiene probador disponible');
    expect(block.querySelector('a[href="/admin/products/p1"]')).toBeFalsy();
  });
});