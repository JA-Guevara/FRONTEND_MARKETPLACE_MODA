import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { Branch, Cart, CashPoint, Order, OrderReturn, PosLookup, ReturnAvailability } from '../domain/commerce.models';
@Injectable({ providedIn: 'root' })
export class CommerceService {
  private api = inject(ApiService);
  branches() {
    return firstValueFrom(this.api.get<Branch[]>('/commerce/branches'));
  }
  cart(branch_id = '', coupon_code = '') {
    return firstValueFrom(this.api.get<Cart>('/commerce/cart', { branch_id, coupon_code }));
  }
  async write<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown) {
    return (await firstValueFrom(this.api.write<T>(method, '/commerce' + path, body))).data;
  }
  orders(admin = false, offset = 0, filtros: Record<string, unknown> = {}) {
    return firstValueFrom(
      this.api.get<Order[]>(admin ? '/commerce/admin/orders' : '/commerce/orders', {
        limit: 50,
        offset,
        // Los filtros solo aplican a la bandeja de gestión; el cliente ve los suyos.
        ...(admin ? filtros : {}),
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

  /** CU19: qué se puede devolver de un pedido y qué devoluciones ya tiene. */
  returnsOf(orderId: string) {
    return this.get<ReturnAvailability>('/orders/' + orderId + '/returns');
  }
  requestReturn(orderId: string, body: unknown) {
    return this.write<OrderReturn>('POST', '/orders/' + orderId + '/returns', body);
  }
  adminReturns(filtros: Record<string, unknown> = {}, offset = 0) {
    return this.get<OrderReturn[]>('/admin/returns', { limit: 50, offset, ...filtros });
  }
  resolveReturn(id: string, body: unknown) {
    return this.write<OrderReturn>('PATCH', '/admin/returns/' + id, body);
  }

  // --- Caja (RF17, RF18) ---
  cashPoints(branch_id: string) {
    return this.get<CashPoint[]>('/admin/cash-points', { branch_id });
  }
  posStock(branch_id: string) {
    return this.get<import('../domain/commerce.models').CartItem[]>('/admin/pos/stock', { branch_id });
  }
  posSale(body: unknown) {
    return this.write<Order & { idempotent_replay?: boolean }>('POST', '/admin/pos/sales', body);
  }
  /** Busca una venta por número para atender una devolución en el mostrador. */
  posLookup(number: string) {
    return this.get<PosLookup>('/admin/pos/orders', { number });
  }
  posReturn(body: unknown) {
    return this.write<OrderReturn>('POST', '/admin/pos/returns', body);
  }

  verifyPayment(id: string, admin = false) {
    return this.write<Order>('POST', (admin ? '/admin/orders/' : '/orders/') + id + '/payment-status');
  }
}
