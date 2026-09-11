import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ProductImagesComponent } from './product-images.component';

describe('Carrusel dentro del formulario de prendas', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [ProductImagesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return {
      component: TestBed.createComponent(ProductImagesComponent).componentInstance,
      http: TestBed.inject(HttpTestingController),
    };
  }
  it('previsualiza enlaces sin guardar y conserva el orden del carrusel', async () => {
    const { component, http } = setup();
    component.link = 'https://example.com/front.jpg';
    component.addLink();
    component.link = 'https://example.com/back.jpg';
    component.addLink();
    component.move(-1);
    expect(component.items[component.index].preview).toContain('front');
    expect((await component.prepare()).map((i) => i.sort_order)).toEqual([0, 1]);
    http.expectNone(() => true);
  });
  it('quitar una imagen existente no la elimina del servidor al cancelar', async () => {
    const { component, http } = setup();
    component.existing = [{ id: 'image1', url: 'https://example.com/a.jpg', is_primary: true }];
    component.ngOnChanges({ existing: true });
    component.remove();
    expect(component.removed).toEqual(['image1']);
    expect(await component.prepare()).toEqual([]);
    component.ngOnDestroy();
    http.expectNone(() => true);
  });
  it('permite una sola principal y no pierde enlaces pendientes silenciosamente', async () => {
    const { component } = setup();
    component.link = 'https://example.com/a.jpg';
    component.addLink();
    component.link = 'https://example.com/b.jpg';
    component.addLink();
    component.items[1].primary = true;
    component.makePrimary(component.items[1]);
    expect(component.items.filter((i) => i.primary)).toHaveLength(1);
    component.link = 'https://example.com/pending.jpg';
    await expect(component.prepare()).rejects.toThrow('enlace pendiente');
  });
});
