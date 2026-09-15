import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { Entity, Page, Product } from '../domain/catalog.models';
import { ProductDraft, ProductDraftInput } from '../domain/catalog.models';
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private api = inject(ApiService);
  products(query: Record<string, unknown>) {
    return this.api.get<Page<Product>>('/catalog/products', query);
  }
  product(slug: string) {
    return this.api.get<Product>('/catalog/products/' + encodeURIComponent(slug));
  }
  reference(key: string) {
    return this.api.get<Entity[]>('/catalog/' + key);
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
