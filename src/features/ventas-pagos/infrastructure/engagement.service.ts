import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';

export interface Favorite {
  id: string;
  product_id: string;
  slug: string;
  name: string;
  base_price: string;
  image_url: string | null;
  stock_alert: boolean;
  price_alert: boolean;
}

export interface FavoriteState {
  is_favorite: boolean;
  stock_alert: boolean;
  price_alert: boolean;
}

export interface PromotionTarget {
  id?: string;
  target_type: string;
  target_id?: string | null;
}

export interface Promotion {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  discount_type: 'percent' | 'fixed' | 'clearance' | 'free_shipping';
  discount_value: string;
  minimum_order: string;
  category_id: string | null;
  product_id: string | null;
  customer_scope: 'all' | 'frequent';
  minimum_paid_orders: number;
  applies_online: boolean;
  applies_pos: boolean;
  applies_offline: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  uses_count: number;
  per_user_limit: number | null;
  is_active: boolean;
  deactivated_at?: string | null;
  deactivated_by?: string | null;
  targets?: PromotionTarget[];
}

export interface PromotionPreviewItem {
  variant_id: string;
  product_name: string;
  variant_sku?: string;
  regular: number;
  final: number;
  discount_applied: number;
}

export interface PromotionPreview {
  items: PromotionPreviewItem[];
  errors: string[];
}

@Injectable({ providedIn: 'root' })
export class EngagementService {
  private api = inject(ApiService);

  getFavorite(productId: string) {
    return firstValueFrom(this.api.get<FavoriteState>('/commerce/favorites/' + productId));
  }

  favorites() {
    return firstValueFrom(this.api.get<Favorite[]>('/commerce/favorites'));
  }

  saveFavorite(productId: string, options = { stock_alert: true, price_alert: true }) {
    return firstValueFrom(this.api.write<FavoriteState>('PUT', '/commerce/favorites/' + productId, options));
  }

  removeFavorite(productId: string) {
    return firstValueFrom(this.api.write<FavoriteState>('DELETE', '/commerce/favorites/' + productId));
  }

  promotions(params?: Record<string, string | number | boolean | undefined>) {
    return firstValueFrom(this.api.get<Promotion[]>('/commerce/admin/promotions', params));
  }

  createPromotion(body: unknown) {
    return firstValueFrom(this.api.write<Promotion>('POST', '/commerce/admin/promotions', body));
  }

  updatePromotion(id: string, body: unknown) {
    return firstValueFrom(this.api.write<Promotion>('PATCH', '/commerce/admin/promotions/' + id, body));
  }

  previewPromotion(body: unknown): Promise<PromotionPreview> {
    return firstValueFrom(this.api.write<PromotionPreview>('POST', '/commerce/admin/promotions/preview', body)).then(
      (r: any) => (r && r.data ? r.data : r) as PromotionPreview,
    );
  }

  activatePromotion(id: string) {
    return firstValueFrom(this.api.write<Promotion>('POST', `/commerce/admin/promotions/${id}/activate`));
  }

  deactivatePromotion(id: string, reason?: string) {
    return firstValueFrom(this.api.write<Promotion>('POST', `/commerce/admin/promotions/${id}/deactivate`, { reason }));
  }
}
