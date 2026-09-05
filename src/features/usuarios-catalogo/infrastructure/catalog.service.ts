import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../app/core/shared/api.service';
import { Entity, Page, Product } from '../domain/catalog.models';
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
}
