import { Component, inject, signal } from '@angular/core';
import { DecimalPipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommerceService } from '../infrastructure/commerce.service';
import { Branch, Cart, DeliveryAddress, Order } from '../domain/commerce.models';
import { SessionService } from '../../auth/application/session.service';
import { errorMessage } from '../../../shared/errors';
@Component({
  selector: 'fs-cart-page',
  imports: [FormsModule, RouterLink, DecimalPipe, UpperCasePipe],
  styleUrl: './commerce.scss',
  template: ` <section class="commerce-page">
    <p class="eyebrow">TU SELECCIÓN</p>
    <h1>Mi carrito</h1>
    @if (error()) {
      <div class="alert error" role="alert">
        {{ error() }} <button type="button" (click)="init()" [disabled]="busy()">Reintentar</button>
      </div>
    }
    @if (loading()) {
      <p role="status">Cargando tu carrito…</p>
    }
    @if (cart(); as c) {
      @if (c.items.length) {
        <div class="commerce-grid">
          <div>
            <div class="commerce-actions">
              <a routerLink="/">← Seguir comprando</a
              ><a routerLink="/mi-cuenta/pedidos">Mis pedidos</a>
            </div>
            @for (item of c.items; track item.variant_id) {
              <article class="commerce-item">
                @if (item.image_url) {
                  <img [src]="item.image_url" [alt]="item.name" />
                } @else {
                  <span aria-hidden="true">F.</span>
                }
                <div>
                  <h3>{{ item.name }}</h3>
                  <p>{{ item.size }} · {{ item.color }} · {{ item.sku }}</p>
                  <p>
                    {{ c.currency | uppercase }} {{ item.unit_price | number: '1.2-2' }} / unidad
                  </p>
                  <div class="quantity">
                    <label
                      >Cantidad<input
                        type="number"
                        min="1"
                        max="99"
                        [ngModel]="item.quantity"
                        (change)="quantity(item.variant_id, $event)"
                        [disabled]="busy()" /></label
                    ><button (click)="remove(item.variant_id)" [disabled]="busy()">Quitar</button>
                  </div>
                  @if (branch) {
                    <p [class.error]="item.available < item.quantity">
                      {{ item.available }} disponibles en la sucursal
                    </p>
                  }
                </div>
                <strong
                  >{{ c.currency | uppercase }} {{ item.line_total | number: '1.2-2' }}</strong
                >
              </article>
            }
          </div>
          <aside class="checkout-summary">
            <h2>Resumen de compra</h2>
            <label
              >Sucursal que prepara tu pedido<select
                [(ngModel)]="branch"
                (ngModelChange)="loadCart()"
                [disabled]="busy()"
              >
                <option value="">Seleccioná una sucursal</option>
                @for (b of branches(); track b.id) {
                  <option [value]="b.id">{{ b.name }}</option>
                }
              </select></label
            >
            <div class="commerce-total">
              <span>Total</span
              ><strong>{{ c.currency | uppercase }} {{ c.total | number: '1.2-2' }}</strong>
            </div>
            <p class="muted">
              El total corresponde a las prendas. Coordiná la entrega con la tienda.
            </p>
            @if (!addressStep()) {
              <button
                class="primary"
                (click)="addressStep.set(true)"
                [disabled]="!canBuy() || busy()"
              >
                Continuar con la compra
              </button>
            } @else {
              <form #checkoutForm="ngForm" (ngSubmit)="checkoutForm.valid && buy()">
                <h3>Datos de entrega</h3>
                <div class="commerce-fields">
                  <label class="wide"
                    >Nombre de quien recibe<input
                      name="recipient"
                      [(ngModel)]="address.recipient"
                      required
                      minlength="2"
                      maxlength="200"
                      autocomplete="name"
                  /></label>
                  <label class="wide"
                    >Teléfono<input
                      name="phone"
                      [(ngModel)]="address.phone"
                      required
                      minlength="6"
                      maxlength="30"
                      autocomplete="tel"
                  /></label>
                  <label class="wide"
                    >Dirección<input
                      name="line1"
                      [(ngModel)]="address.line1"
                      required
                      minlength="5"
                      maxlength="300"
                      autocomplete="street-address"
                  /></label>
                  <label
                    >Ciudad<input
                      name="city"
                      [(ngModel)]="address.city"
                      required
                      minlength="2"
                      maxlength="100"
                      autocomplete="address-level2" /></label
                  ><label
                    >País<select name="country" [(ngModel)]="address.country">
                      <option value="BO">Bolivia</option>
                    </select></label
                  >
                </div>
                <label
                  >Cómo querés pagar<select name="method" [(ngModel)]="method">
                    <option value="manual">Coordinar efectivo o transferencia</option>
                    <option value="stripe">Tarjeta · Stripe (prueba)</option>
                  </select></label
                >
                <p class="muted">
                  Al confirmar se crea el pedido y se reservan las prendas. El pago se confirma por
                  separado.
                </p>
                <button
                  type="submit"
                  class="primary"
                  [disabled]="busy() || !checkoutForm.valid || !canBuy()"
                >
                  {{ busy() ? 'Creando pedido…' : 'Confirmar pedido' }}</button
                ><button type="button" (click)="addressStep.set(false)" [disabled]="busy()">
                  Volver al resumen
                </button>
              </form>
            }
          </aside>
        </div>
      } @else {
        <div class="empty-state">
          <h2>Tu próximo look empieza aquí</h2>
          <p>Elegí una prenda, su talla y color para agregarla.</p>
          <a routerLink="/" class="button primary">Explorar prendas</a>
          <p><a routerLink="/mi-cuenta/pedidos">Ver mis pedidos</a></p>
        </div>
      }
    }
  </section>`,
})
export class CartPageComponent {
  api = inject(CommerceService);
  private router = inject(Router);
  private session = inject(SessionService);
  cart = signal<Cart | null>(null);
  branches = signal<Branch[]>([]);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  addressStep = signal(false);
  branch = '';
  method = 'manual';
  address: DeliveryAddress = {
    recipient: [this.session.user()?.first_name, this.session.user()?.last_name]
      .filter(Boolean)
      .join(' '),
    phone: this.session.user()?.phone || '',
    line1: '',
    city: '',
    country: 'BO',
  };
  constructor() {
    void this.init();
  }
  async init() {
    try {
      this.branches.set(await this.api.branches());
      await this.loadCart();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  async loadCart() {
    this.busy.set(true);
    this.error.set('');
    try {
      this.cart.set(await this.api.cart(this.branch));
    } catch (e) {
      this.cart.set(null);
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  canBuy() {
    return (
      !!this.branch &&
      !!this.cart()?.items.length &&
      this.cart()!.items.every((i) => i.available >= i.quantity)
    );
  }
  async quantity(id: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < 1 || value > 99) {
      input.value = String(this.cart()?.items.find((i) => i.variant_id === id)?.quantity || 1);
      this.error.set('La cantidad debe estar entre 1 y 99.');
      return;
    }
    await this.change('PUT', id, { quantity: value });
  }
  async remove(id: string) {
    await this.change('DELETE', id);
  }
  private async change(method: 'PUT' | 'DELETE', id: string, body?: unknown) {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.write(method, '/cart/items/' + id, body);
      await this.loadCart();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async buy() {
    if (this.busy() || !this.canBuy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const order = await this.api.write<Order>('POST', '/orders', {
        branch_id: this.branch,
        address: this.address,
        payment_method: this.method,
      });
      await this.router.navigate(['/mi-cuenta/pedidos'], { queryParams: { pedido: order.id } });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
