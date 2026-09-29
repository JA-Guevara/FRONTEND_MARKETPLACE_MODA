import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { CatalogService } from './catalog.service';

const envelope = (data: unknown) => ({ success: true, message: 'OK', data });

describe('Caché de las listas de referencia', () => {
  let catalog: CatalogService;
  let backend: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    catalog = TestBed.inject(CatalogService);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('la segunda lectura no genera una petición nueva', async () => {
    const primera = firstValueFrom(catalog.reference('categories'));
    backend.expectOne('/api/v1/catalog/categories').flush(envelope([{ id: 'c1', name: 'Camperas' }]));
    expect(await primera).toEqual([{ id: 'c1', name: 'Camperas' }]);
    const segunda = await firstValueFrom(catalog.reference('categories'));
    backend.expectNone('/api/v1/catalog/categories');
    expect(segunda).toEqual([{ id: 'c1', name: 'Camperas' }]);
  });

  it('cachea cada lista por separado', async () => {
    void firstValueFrom(catalog.reference('sizes'));
    backend.expectOne('/api/v1/catalog/sizes').flush(envelope([]));
    void firstValueFrom(catalog.reference('colors'));
    backend.expectOne('/api/v1/catalog/colors').flush(envelope([]));
    void firstValueFrom(catalog.reference('sizes'));
    backend.expectNone('/api/v1/catalog/sizes');
  });

  it('al invalidar una lista, la siguiente lectura vuelve a pedirla', async () => {
    void firstValueFrom(catalog.reference('categories'));
    backend.expectOne('/api/v1/catalog/categories').flush(envelope([{ id: 'c1', name: 'Vieja' }]));
    catalog.invalidateReference('categories');
    const recargada = firstValueFrom(catalog.reference('categories'));
    backend.expectOne('/api/v1/catalog/categories').flush(envelope([{ id: 'c2', name: 'Nueva' }]));
    expect(await recargada).toEqual([{ id: 'c2', name: 'Nueva' }]);
  });

  it('sin argumento olvida todas las listas', async () => {
    for (const key of ['categories', 'sizes']) {
      void firstValueFrom(catalog.reference(key));
      backend.expectOne('/api/v1/catalog/' + key).flush(envelope([]));
    }
    catalog.invalidateReference();
    for (const key of ['categories', 'sizes']) {
      void firstValueFrom(catalog.reference(key));
      backend.expectOne('/api/v1/catalog/' + key).flush(envelope([]));
    }
  });

  it('no deja el error cacheado: se puede reintentar', async () => {
    const fallida = firstValueFrom(catalog.reference('seasons'));
    backend
      .expectOne('/api/v1/catalog/seasons')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await expect(fallida).rejects.toBeTruthy();
    const reintento = firstValueFrom(catalog.reference('seasons'));
    backend.expectOne('/api/v1/catalog/seasons').flush(envelope([{ id: 's1', name: 'Verano' }]));
    expect(await reintento).toEqual([{ id: 's1', name: 'Verano' }]);
  });
});
