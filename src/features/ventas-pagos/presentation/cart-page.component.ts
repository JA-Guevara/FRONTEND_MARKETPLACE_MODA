import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe, UpperCasePipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommerceService } from '../infrastructure/commerce.service';
import { CartStateService } from '../application/cart-state.service';
import { Branch, Cart, DeliveryAddress, Order, SavedAddress } from '../domain/commerce.models';
import { ApiService } from '../../../app/core/shared/api.service';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { errorMessage } from '../../../shared/errors';
import { IconComponent } from '../../../shared/icon.component';
import { NoticesService } from '../../../app/core/notices.service';
@Component({
  selector: 'fs-cart-page',
  imports: [FormsModule, RouterLink, DecimalPipe, UpperCasePipe, DatePipe, IconComponent],
  styleUrl: './commerce.scss',
  template: ` <section class="commerce-page">
    <p class="eyebrow">TU SELECCIÓN</p>
    <h1>Mi carrito</h1>
    @if (offlineSavedOrder(); as saved) {
      <article class="panel offline-saved-card" style="margin-bottom: 2rem; border: 2px solid var(--accent, #1e40af); background: var(--surface-2, #f8fafc); border-radius: 12px; padding: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem;">
          <span style="font-size: 28px;">✅</span>
          <div>
            <h2 style="margin: 0; font-size: 1.25rem;">¡Compra guardada en tu dispositivo!</h2>
            <p style="margin: 0; color: var(--muted, #64748b); font-size: 0.875rem;">Folio provisional: <strong>{{ saved.id }}</strong> · {{ saved.created_at | date:'short' }}</p>
          </div>
        </div>
        <div style="background: var(--surface, #fff); border-radius: 8px; padding: 1rem; border: 1px solid var(--line, #e2e8f0); margin-bottom: 1rem; font-size: 0.9rem;">
          <p style="margin: 0.25rem 0;"><strong>Destinatario:</strong> {{ saved.recipient }} (Tel: {{ saved.phone }})</p>
          <p style="margin: 0.25rem 0;"><strong>Dirección de entrega:</strong> {{ saved.address.line1 }}, {{ saved.address.city }}</p>
          <p style="margin: 0.25rem 0;"><strong>Forma de pago elegida:</strong> {{ saved.payment_method === 'stripe' ? 'Tarjeta (al conectar)' : 'Efectivo o transferencia' }}</p>
          <p style="margin: 0.25rem 0;"><strong>Total estimado:</strong> {{ (cart()?.currency || 'BOB') | uppercase }} {{ saved.total | number:'1.2-2' }} ({{ saved.itemCount }} prenda(s))</p>
        </div>
        <div class="alert info" style="margin: 0 0 1rem;">
          <strong>Sincronización automática:</strong> Cuando el navegador recupere la conexión a Internet, tu pedido se enviará al servidor y te notificaremos aquí si las prendas continuaban disponibles en inventario.
        </div>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <a routerLink="/" class="button primary">Seguir viendo catálogo</a>
          <button type="button" (click)="offlineSavedOrder.set(null)">Cerrar comprobante</button>
        </div>
      </article>
    }
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
              <span>Subtotal</span
              ><strong>{{ c.currency | uppercase }} {{ (c.subtotal || c.total) | number: '1.2-2' }}</strong>
            </div>
            <div class="coupon-box">
              <label>¿Tenés un cupón?
                <span class="coupon-entry"><input name="coupon" [(ngModel)]="coupon" maxlength="50" placeholder="Ej. VERANO15" [disabled]="busy()" /><button type="button" (click)="applyCoupon()" [disabled]="busy()">Aplicar</button></span>
              </label>
              @if (couponMessage()) { <small [class.error]="couponError()">{{ couponMessage() }}</small> }
            </div>
            @for (discount of c.discounts || []; track discount.promotion_id) {
              <div class="discount-line"><span><fs-icon name="tag" />{{ discount.name }}{{ discount.code ? ' · ' + discount.code : '' }}</span><strong>@if (discount.amount !== '0.00') {− {{ c.currency | uppercase }} {{ discount.amount | number: '1.2-2' }}} @else {Beneficio aplicado}</strong></div>
              @if (discount.message) { <small class="muted">{{ discount.message }}</small> }
            }
            <div class="commerce-total final-total">
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
                @if (savedAddresses().length) {
                  <div class="saved-addresses">
                    <p class="muted">Tus direcciones guardadas</p>
                    @for (saved of savedAddresses(); track saved.id) {
                      <label class="saved-address" [class.selected]="selectedAddress === saved.id">
                        <input
                          type="radio"
                          name="savedAddress"
                          [value]="saved.id"
                          [ngModel]="selectedAddress"
                          (ngModelChange)="useAddress($event)"
                        />
                        <span>
                          <strong>{{ saved.label }}</strong>
                          @if (saved.is_default) {
                            <span class="badge">Predeterminada</span>
                          }
                          <small
                            >{{ saved.address_line }} · {{ saved.city
                            }}{{ saved.postal_code ? ' · CP ' + saved.postal_code : '' }}</small
                          >
                        </span>
                      </label>
                    }
                    <label class="saved-address" [class.selected]="!selectedAddress">
                      <input
                        type="radio"
                        name="savedAddress"
                        [value]="''"
                        [ngModel]="selectedAddress"
                        (ngModelChange)="useNewAddress()"
                      />
                      <span><strong>Usar otra dirección</strong></span>
                    </label>
                    <a routerLink="/mi-cuenta/direcciones">Administrar mis direcciones ↗</a>
                  </div>
                }
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
                    >Código postal<input
                      name="postal_code"
                      [(ngModel)]="address.postal_code"
                      maxlength="20"
                      autocomplete="postal-code" /></label
                  ><label
                    >País<select name="country" [(ngModel)]="address.country">
                      <option value="BO">Bolivia</option>
                    </select></label
                  >
                </div>
                @if (!selectedAddress) {
                  <label class="check"
                    ><input type="checkbox" name="saveToProfile" [(ngModel)]="saveToProfile" />Guardar
                    esta dirección en mi perfil</label
                  >
                }
                <label
                  >Cómo querés pagar<select name="method" [(ngModel)]="method">
                    <option value="manual">Coordinar efectivo o transferencia</option>
                    @if (cart()?.card_payments_available) {
                      <option value="stripe">Tarjeta · Stripe (prueba)</option>
                    }
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
                @if (!isOnline() || errorIsConnection()) {
                  <div class="offline-checkout-box" style="margin-top: 1.25rem; padding: 1.25rem; border-radius: 10px; border: 2px dashed var(--accent, #1e40af); background: color-mix(in oklab, var(--accent, #1e40af) 6%, var(--surface, #fff));">
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--accent, #1e40af); margin-bottom: 6px;">
                      <span style="font-size: 20px;">📡</span> Modo de compra sin conexión
                    </div>
                    <p style="margin: 0 0 12px; font-size: 0.875rem; line-height: 1.4;">
                      Detectamos problemas de conexión con el servidor. Podés guardar esta compra en tu dispositivo. En cuanto el sistema restablezca la conexión, se procesará automáticamente y te notificaremos si las prendas estaban disponibles.
                    </p>
                    <button
                      type="button"
                      class="button primary"
                      style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 8px;"
                      [disabled]="busy() || !checkoutForm.valid || !canBuy()"
                      (click)="saveOfflineOrder()"
                    >
                      <span>💾</span> Guardar compra sin conexión
                    </button>
                  </div>
                }
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
  private notices = inject(NoticesService);
  api = inject(CommerceService);
  private router = inject(Router);
  private session = inject(SessionService);
  private http = inject(ApiService);
  private cartState = inject(CartStateService);
  cart = signal<Cart | null>(null);
  branches = signal<Branch[]>([]);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  addressStep = signal(false);
  isOnline = signal(typeof navigator !== 'undefined' ? navigator.onLine : true);
  offlineSavedOrder = signal<any | null>(null);
  errorIsConnection = computed(() => {
    const err = (this.error() || '').toLowerCase();
    return !this.isOnline() || err.includes('servidor') || err.includes('conexión') || err.includes('espera') || err.includes('interrupción');
  });
  /** Direcciones del perfil, para no reescribirlas en cada compra. */
  savedAddresses = signal<SavedAddress[]>([]);
  selectedAddress = '';
  saveToProfile = false;
  branch = '';
  method = 'manual';
  coupon = '';
  couponMessage = signal('');
  couponError = signal(false);
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
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline.set(true);
        void this.syncOfflineOrders();
      });
      window.addEventListener('offline', () => {
        this.isOnline.set(false);
      });
      void this.syncOfflineOrders();
    }
    void this.init();
  }
  async init() {
    try {
      this.branches.set(await this.api.branches());
      await this.loadCart();
      await this.loadAddresses();
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
      this.setQuote(await this.api.cart(this.branch, this.coupon));
    } catch (e) {
      this.cart.set(null);
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  private setQuote(quote: Cart) {
    this.cart.set(quote);
    if (this.method === 'stripe' && !quote.card_payments_available) this.method = 'manual';
  }

  canBuy() {
    return (
      !!this.branch &&
      !!this.cart()?.items.length &&
      this.cart()!.items.every((i) => i.available >= i.quantity)
    );
  }
  async applyCoupon() {
    this.coupon = this.coupon.trim().toUpperCase();
    this.couponMessage.set('');
    this.couponError.set(false);
    this.busy.set(true);
    try {
      // Si el código no es válido se conserva el carrito que el cliente ya
      // estaba revisando; una validación de cupón no debe vaciar la pantalla.
      const quoted = await this.api.cart(this.branch, this.coupon);
      this.setQuote(quoted);
      const applied = quoted.discounts?.find((row) => row.code === this.coupon);
      this.couponMessage.set(applied ? 'Cupón aplicado al total.' : 'No hay un beneficio asociado a este cupón.');
      this.couponError.set(!applied);
    } catch (e) {
      this.couponError.set(true);
      this.couponMessage.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
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
      await this.cartState.refresh();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  /** Trae las direcciones del perfil y deja lista la predeterminada. */
  async loadAddresses() {
    if (!this.session.user()) return;
    try {
      const direcciones = await firstValueFrom(
        this.http.get<SavedAddress[]>('/users/me/addresses'),
      );
      this.savedAddresses.set(direcciones);
      const preferida = direcciones.find((d) => d.is_default) || direcciones[0];
      if (preferida) this.useAddress(preferida.id);
    } catch {
      // Sin direcciones guardadas se completa a mano; no es un error de la compra.
    }
  }
  /** Copia una dirección guardada al formulario de entrega. */
  useAddress(id: string) {
    this.selectedAddress = id;
    const elegida = this.savedAddresses().find((d) => d.id === id);
    if (!elegida) return;
    this.saveToProfile = false;
    this.address = {
      recipient: elegida.recipient_name,
      phone: elegida.phone,
      line1: elegida.address_line,
      city: elegida.city,
      country: elegida.country || 'BO',
      postal_code: elegida.postal_code || '',
    };
  }
  /** Vacía el formulario para cargar una dirección distinta. */
  useNewAddress() {
    this.selectedAddress = '';
    const user = this.session.user();
    this.address = {
      recipient: [user?.first_name, user?.last_name].filter(Boolean).join(' '),
      phone: user?.phone || '',
      line1: '',
      city: '',
      country: 'BO',
      postal_code: '',
    };
  }
  /** Guarda en el perfil la dirección recién usada, para la próxima compra. */
  private async storeAddress() {
    try {
      await firstValueFrom(
        this.http.write('POST', '/users/me/addresses', {
          label: 'Entrega',
          recipient_name: this.address.recipient,
          phone: this.address.phone,
          address_line: this.address.line1,
          city: this.address.city,
          postal_code: this.address.postal_code || null,
          country: this.address.country || 'BO',
          is_default: this.savedAddresses().length === 0,
        }),
      );
    } catch {
      // El pedido ya fue creado: no se interrumpe la compra por esto.
    }
  }
  async buy() {
    const noticeScope = this.notices.scope();
    if (this.busy() || !this.canBuy()) return;
    this.busy.set(true);
    this.error.set('');
    if (this.method === 'stripe' && !this.cart()?.card_payments_available) {
      this.busy.set(false);
      this.error.set('La tienda no tiene habilitado el pago con tarjeta.');
      return;
    }
    try {
      const order = await this.api.write<Order>('POST', '/orders', {
        branch_id: this.branch,
        address: this.address,
        payment_method: this.method,
        coupon_code: this.coupon || null,
      });
      if (noticeScope !== this.notices.scope()) return;
      this.notices.show({key: `order:${order.id}:created`, title: order.payment_status === 'paid' ? 'Pedido confirmado' : 'Pedido creado · pago pendiente',
        detail: `${order.number} · ${order.total} ${order.currency.toUpperCase()}. ` + (order.payment_status === 'paid' ? 'El servidor registró el pedido como pagado.' : 'Crear el pedido no acredita el pago. Continuá con el medio elegido.'),
        tone: order.payment_status === 'paid' ? 'success' : 'info', important: true, link: `/mi-cuenta/pedidos?pedido=${order.id}`});
      await this.cartState.refresh();
      if (this.saveToProfile && !this.selectedAddress) await this.storeAddress();
      await this.router.navigate(['/mi-cuenta/pedidos'], { queryParams: { pedido: order.id } });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  saveOfflineOrder() {
    if (!this.canBuy()) return;
    const items = this.cart()?.items || [];
    const folio = 'OFF-' + crypto.randomUUID().slice(0, 8).toUpperCase();
    const offlineOrder = {
      id: folio,
      created_at: new Date().toISOString(),
      branch_id: this.branch,
      address: { ...this.address },
      payment_method: this.method,
      coupon_code: this.coupon || null,
      items: items.map(i => ({
        variant_id: i.variant_id,
        name: i.name,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        price: i.unit_price,
      })),
      total: this.cart()?.total || 0,
      recipient: this.address.recipient,
      phone: this.address.phone,
      itemCount: items.reduce((acc, i) => acc + i.quantity, 0),
      status: 'PENDIENTE',
    };

    try {
      const existing = JSON.parse(localStorage.getItem('fs_offline_store_orders') || '[]');
      existing.push(offlineOrder);
      localStorage.setItem('fs_offline_store_orders', JSON.stringify(existing));
    } catch { /* memoria local */ }

    this.offlineSavedOrder.set(offlineOrder);
    this.error.set('');
    this.addressStep.set(false);
    this.notices.show({
      key: `offline:saved:${offlineOrder.id}`,
      title: 'Compra guardada en tu dispositivo',
      detail: `Folio ${offlineOrder.id}. Cuando regrese la conexión se procesará y te notificaremos si las prendas estaban disponibles.`,
      tone: 'info',
      important: false,
    });
  }

  async syncOfflineOrders() {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    const raw = localStorage.getItem('fs_offline_store_orders');
    if (!raw) return;
    let list: any[] = [];
    try { list = JSON.parse(raw); } catch { return; }
    if (!list.length) return;

    const remaining: any[] = [];
    for (const item of list) {
      if (item.status !== 'PENDIENTE') continue;
      try {
        const order = await this.api.write<Order>('POST', '/orders', {
          branch_id: item.branch_id,
          address: item.address,
          payment_method: item.payment_method,
          coupon_code: item.coupon_code || null,
        });
        this.notices.show({
          key: `order:offline:confirmed:${order.id}`,
          title: '¡Compra sin conexión procesada con éxito!',
          detail: `Tu pedido #${order.number} por Bs ${order.total} fue procesado y confirmado en el servidor.`,
          tone: 'success',
          important: true,
          link: `/mi-cuenta/pedidos?pedido=${order.id}`,
        });
        await this.cartState.refresh();
      } catch (err: any) {
        const msg = (errorMessage(err) || '').toLowerCase();
        if (err?.status === 409 || err?.status === 422 || msg.includes('existencias') || msg.includes('disponible') || msg.includes('stock')) {
          this.notices.show({
            key: `order:offline:out_of_stock:${item.id}`,
            title: 'Prenda no disponible en inventario',
            detail: `Una o más prendas de tu compra sin conexión (Folio ${item.id}) ya no contaban con existencias disponibles en el servidor al restablecerse la conexión.`,
            tone: 'error',
            important: true,
          });
        } else if (err?.status === 0) {
          remaining.push(item);
        } else {
          this.notices.show({
            key: `order:offline:error:${item.id}`,
            title: 'No se pudo procesar la compra sin conexión',
            detail: errorMessage(err) || 'Error al procesar el pedido guardado.',
            tone: 'error',
            important: true,
          });
        }
      }
    }
    localStorage.setItem('fs_offline_store_orders', JSON.stringify(remaining));
  }
}
