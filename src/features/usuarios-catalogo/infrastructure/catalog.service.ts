import { Injectable, inject } from '@angular/core';
import { Observable, catchError, firstValueFrom, shareReplay, throwError } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { Entity, Page, Product } from '../domain/catalog.models';
import { ProductDraft, ProductDraftInput } from '../domain/catalog.models';
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private api = inject(ApiService);
  /** Caché en memoria de las listas de referencia. La clave es el `key` porque
   * `reference()` no lleva parámetros de consulta. */
  private referencias = new Map<string, Observable<Entity[]>>();
  products(query: Record<string, unknown>) {
    return this.api.get<Page<Product>>('/catalog/products', query);
  }
  product(slug: string) {
    return this.api.get<Product>('/catalog/products/' + encodeURIComponent(slug));
  }
  /** Categorías, tallas, colores, temporadas y colecciones: cinco listas de
   * rotación casi nula que el catálogo pedía de nuevo en cada visita. Se
   * comparten con `shareReplay` para que la segunda lectura no salga a la red.
   * Toda alta o baja desde administración debe llamar a `invalidateReference`. */
  reference(key: string) {
    const cacheada = this.referencias.get(key);
    if (cacheada) return cacheada;
    const peticion = this.api.get<Entity[]>('/catalog/' + key).pipe(
      // Sin esto el error quedaría cacheado para siempre y el botón «Recargar
      // filtros» repetiría el mismo fallo eternamente: se borra la entrada
      // ANTES de propagarlo para que el próximo intento pida de nuevo.
      catchError((e) => {
        this.referencias.delete(key);
        return throwError(() => e);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.referencias.set(key, peticion);
    return peticion;
  }
  /** Olvida una lista (o todas, sin argumento). Solo toca memoria: NUNCA dispara
   * una petición, porque se llama desde pantallas administrativas cuyas pruebas
   * verifican que no haya peticiones de más. */
  invalidateReference(key?: string) {
    if (key) this.referencias.delete(key);
    else this.referencias.clear();
  }
  /** Le pide a la IA que extraiga nombre/precio/categoría de un pedido en
   * lenguaje natural. No crea nada: solo propone un borrador para revisar. */
  async draftProduct(message: string) {
    return (
      await firstValueFrom(
        this.api.write<ProductDraft>('POST', '/catalog/admin/products/draft', { message }),
      )
    ).data;
  }
  async createProduct(data: ProductDraftInput) {
    return (
      await firstValueFrom(this.api.write<Product>('POST', '/catalog/admin/products', data))
    ).data;
  }
}
