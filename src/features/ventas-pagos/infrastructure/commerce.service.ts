import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { Branch, Cart, Order } from '../domain/commerce.models';
@Injectable({ providedIn: 'root' })
export class CommerceService {
  private api = inject(ApiService);
  branches() {
    return firstValueFrom(this.api.get<Branch[]>('/commerce/branches'));
  }
  cart(branch_id = '') {
    return firstValueFrom(this.api.get<Cart>('/commerce/cart', { branch_id }));
  }
  async write<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown) {
    return (await firstValueFrom(this.api.write<T>(method, '/commerce' + path, body))).data;
  }
  orders(admin = false, offset = 0) {
    return firstValueFrom(
      this.api.get<Order[]>(admin ? '/commerce/admin/orders' : '/commerce/orders', {
        limit: 50,
        offset,
      }),
    );
  }
  get<T>(path: string, query: Record<string, unknown> = {}) {
    return firstValueFrom(this.api.get<T>('/commerce' + path, query));
  }
  async add(variant: string) {
    const cart = await this.cart();
    const quantity = (cart.items.find((i) => i.variant_id === variant)?.quantity || 0) + 1;
    return this.write('PUT', '/cart/items/' + variant, { quantity });
  }
  async checkout(id: string) {
    const data = await this.write<{ url: string | null; status?: string }>('POST', '/orders/' + id + '/checkout');
    if (!data.url && data.status && ['paid', 'processing', 'shipped', 'delivered'].includes(data.status)) return false;
    if (!data.url) throw new Error('No se recibió un enlace de pago válido.');
    const url = new URL(data.url);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com')
      throw new Error('El enlace de pago recibido no es válido.');
    window.location.assign(url.href);
    return true;
  }

  verifyPayment(id: string, admin = false) {
    return this.write<Order>('POST', (admin ? '/admin/orders/' : '/orders/') + id + '/payment-status');
  }
}
