import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommerceService } from '../infrastructure/commerce.service';
import { Branch, Order, commerceLabel } from '../domain/commerce.models';
import { OrderTrackerComponent } from './order-tracker.component';
import { OrderReturnsComponent } from './order-returns.component';
import { SessionService } from '../../auth/application/session.service';
import { errorMessage } from '../../../shared/errors';
@Component({
  selector: 'fs-orders-page',
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, UpperCasePipe, OrderTrackerComponent, OrderReturnsComponent],
  styleUrl: './commerce.scss',
  template: ` <section class="commerce-page">
    <p class="eyebrow">{{ admin ? 'GESTIÓN COMERCIAL' : 'MI CUENTA' }}</p>
    <h1>{{ admin ? 'Pedidos y pagos' : 'Mis pedidos' }}</h1>
    <p class="muted">
      {{
        admin
          ? 'Revisá las prendas compradas, los pagos y cada etapa de entrega.'
          : 'Tu compra, sus pagos y el seguimiento en un solo lugar.'
      }}
    </p>
    <div class="commerce-actions">
      <button (click)="load()" [disabled]="busy()">Actualizar estados</button>
      @if (!admin) {
        <a routerLink="/carrito">Ir al carrito</a>
      }
    </div>
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }
    @if (message()) {
      <p class="alert" role="status">{{ message() }}</p>
    }
    @if (busy()) {
      <p role="status">Actualizando…</p>
    }
    @if (admin) {
      <!-- Sin filtros hay que pasar páginas a mano para encontrar un pedido. -->
      <form class="orders-filters" (ngSubmit)="$event.preventDefault(); buscar()">
        <label>
          Estado
          <select name="estado" [(ngModel)]="estado" (ngModelChange)="buscar()">
            <option value="">Todos</option>
            <option value="pending_payment">Pendiente de pago</option>
            <option value="paid">Pagado</option>
            <option value="processing">En preparación</option>
            <option value="shipped">En camino</option>
            <option value="delivered">Entregado</option>
            <option value="cancelled">Cancelado</option>
            <option value="expired">Vencido</option>
          </select>
        </label>
        <label>
          Canal
          <select name="canal" [(ngModel)]="canal" (ngModelChange)="buscar()">
            <option value="">Todos</option>
            <option value="web">Web</option>
            <option value="pos">Caja</option>
          </select>
        </label>
        <label>
          Sucursal
          <select name="sucursal" [(ngModel)]="sucursal" (ngModelChange)="buscar()">
            <option value="">Todas</option>
            @for (b of branches(); track b.id) {
              <option [value]="b.id">{{ b.name }}</option>
            }
          </select>
        </label>
        <label class="orders-search">
          Buscar
          <input name="q" [(ngModel)]="consulta" type="search" placeholder="N.º de pedido o correo" />
        </label>
        <button type="submit" [disabled]="busy()">Buscar</button>
        @if (hayFiltros()) {
          <button type="button" (click)="limpiarFiltros()" [disabled]="busy()">Limpiar</button>
        }
      </form>
    }

    <div class="orders-grid">
      @for (o of orders(); track o.id) {
        <article class="order-card">
          <div class="order-header">
            <div>
              <h2>{{ o.number }}</h2>
              <p class="muted">{{ o.created_at | date: 'dd/MM/yyyy HH:mm' }}</p>
              @if (admin) {
                <p>{{ o.customer_email }}</p>
              }
            </div>
            <div>
              <span class="commerce-status">{{ label(o.status) }}</span>
              @if (admin && o.sales_channel === 'pos') {
                <span class="order-flag">Caja</span>
              }
              @if (admin && o.has_open_return) {
                <a class="order-flag is-aviso" routerLink="/admin/devoluciones">Devolución abierta</a>
              }
              <p>
                <strong>{{ o.currency | uppercase }} {{ o.total | number: '1.2-2' }}</strong>
              </p>
            </div>
          </div>
          <p>
            Pago: <strong>{{ label(o.payment_status) }}</strong> · {{ label(o.payment_method) }}
          </p>
          <fs-order-tracker [pedido]="o" />
          <details class="order-details" [open]="selected === o.id">
            <summary>Ver prendas, entrega y seguimiento</summary>
            @for (i of o.items; track i.variant_id) {
              <div class="commerce-item">
                @if (i.image_url) {
                  <img [src]="i.image_url" [alt]="i.name" />
                } @else {
                  <span>F.</span>
                }
                <div>
                  <h3>{{ i.name }}</h3>
                  <p>{{ i.size }} · {{ i.color }} · {{ i.quantity }} unidad(es)</p>
                  <small>{{ i.sku }}</small>
                </div>
                <strong>{{ o.currency | uppercase }} {{ i.line_total | number: '1.2-2' }}</strong>
              </div>
            }
            <h3>Entrega</h3>
            <p>{{ o.address.recipient }} · {{ o.address.phone }}</p>
            <p>{{ o.address.line1 }}, {{ o.address.city }} · {{ o.address.country }}</p>
            <dl>
              <dt>Transportista</dt>
              <dd>{{ o.carrier || 'Por asignar' }}</dd>
              <dt>N.º seguimiento</dt>
              <dd>{{ o.tracking_number || 'Todavía no asignado' }}</dd>
              <dt>Referencia de pago</dt>
              <dd>{{ o.payment_reference || 'Sin confirmación' }}</dd>
            </dl>
          </details>
          @if (!admin && o.status === 'delivered') {
            <fs-order-returns [pedido]="o" />
          }
          @if (o.status === 'pending_payment' && o.payment_method === 'stripe' && (!admin || session.can('commerce.write'))) {
            <button [disabled]="busy()" (click)="verifyPayment(o.id)">Verificar pago con Stripe</button>
          }
          @if (!admin && o.status === 'pending_payment' && o.payment_status !== 'paid') {
            <div class="commerce-actions">
              @if (o.payment_method === 'stripe') {
                <button class="primary" [disabled]="busy()" (click)="pay(o)">
                  Pagar con Stripe
                </button>
              } @else {
                <p class="muted">Coordiná el pago con la tienda indicando {{ o.number }}.</p>
              }
              <button [disabled]="busy()" (click)="cancelCandidate.set(o.id)">
                Cancelar pedido
              </button>
            </div>
            @if (cancelCandidate() === o.id) {
              <div class="alert">
                <p>¿Cancelar {{ o.number }} y liberar las prendas reservadas?</p>
                <div class="commerce-actions">
                  <button [disabled]="busy()" (click)="cancel(o)">Sí, cancelar</button
                  ><button (click)="cancelCandidate.set('')">Conservar pedido</button>
                </div>
              </div>
            }
          }
          @if (admin && session.can('commerce.write')) {
            @if (o.status === 'pending_payment' && o.payment_method === 'manual') {
              <button (click)="edit(o, 'payment')" [disabled]="busy()">
                Registrar pago recibido
              </button>
            }
            @if (nextStatus(o)) {
              <button (click)="edit(o, 'tracking')" [disabled]="busy()">
                {{ label(nextStatus(o)) }} →
              </button>
            }
            @if (editing() === o.id) {
              <form
                #adminForm="ngForm"
                (ngSubmit)="adminForm.valid && save(o)"
                class="checkout-summary"
                style="position:static;margin-top:16px"
              >
                <h3>
                  {{ mode === 'payment' ? 'Confirmar pago recibido' : 'Actualizar seguimiento' }}
                </h3>
                @if (mode === 'payment') {
                  <label
                    >Medio de pago<select name="method" [(ngModel)]="method">
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                    </select></label
                  ><label
                    >Referencia / recibo<input
                      name="reference"
                      [(ngModel)]="reference"
                      required
                      minlength="3"
                      maxlength="255"
                  /></label>
                  <p class="muted">Registrá únicamente un pago que ya haya sido verificado.</p>
                } @else {
                  <p>
                    Nuevo estado: <strong>{{ label(nextStatus(o)) }}</strong>
                  </p>
                  @if (nextStatus(o) === 'shipped') {
                    <label
                      >Transportista<input
                        name="carrier"
                        [(ngModel)]="carrier"
                        required
                        maxlength="120" /></label
                    ><label
                      >Número de seguimiento<input
                        name="tracking"
                        [(ngModel)]="tracking"
                        required
                        maxlength="150"
                    /></label>
                  }
                  <label
                    >Nota para el cliente<textarea
                      name="note"
                      [(ngModel)]="note"
                      maxlength="1000"
                    ></textarea>
                  </label>
                }
                <div class="commerce-actions">
                  <button type="submit" class="primary" [disabled]="busy() || !adminForm.valid">
                    Guardar confirmación</button
                  ><button type="button" (click)="editing.set('')" [disabled]="busy()">
                    Volver
                  </button>
                </div>
              </form>
            }
          }
        </article>
      } @empty {
        @if (!busy()) {
          <div class="empty-state">
            <h2>No hay pedidos en esta página</h2>
            @if (!admin) {
              <a routerLink="/">Descubrir prendas</a>
            }
          </div>
        }
      }
    </div>
    <div class="commerce-actions">
      <button (click)="page(-1)" [disabled]="offset === 0 || busy()">Anterior</button
      ><span>Página {{ offset / 50 + 1 }}</span
      ><button (click)="page(1)" [disabled]="orders().length < 50 || busy()">Siguiente</button>
    </div>
    <p class="muted">
      Los estados reflejan actualizaciones de la tienda. Volver del pago no acredita la compra hasta
      recibir su confirmación.
    </p>
  </section>`,
})
export class OrdersPageComponent {
  api = inject(CommerceService);
  session = inject(SessionService);
  private route = inject(ActivatedRoute);
  admin = this.route.snapshot.data['admin'] === true;
  selected = this.route.snapshot.queryParamMap.get('pedido');
  orders = signal<Order[]>([]);
  branches = signal<Branch[]>([]);
  busy = signal(false);
  error = signal('');
  message = signal('');
  editing = signal('');
  cancelCandidate = signal('');
  label = commerceLabel;
  offset = 0;
  // Filtros de la bandeja de gestión.
  estado = '';
  canal = '';
  sucursal = '';
  consulta = '';
  mode = '';
  method = 'cash';
  reference = '';
  carrier = '';
  tracking = '';
  note = '';
  constructor() {
    void this.initialize();
  }
  hayFiltros() {
    return !!(this.estado || this.canal || this.sucursal || this.consulta.trim());
  }
  /** Filtros vigentes; los vacíos no viajan. */
  private filtros() {
    return {
      status: this.estado,
      channel: this.canal,
      branch_id: this.sucursal,
      q: this.consulta.trim(),
    };
  }
  buscar() {
    // Un filtro nuevo empieza por la primera página: si no, se mira una página
    // que ya no corresponde al resultado.
    this.offset = 0;
    void this.load();
  }
  limpiarFiltros() {
    this.estado = this.canal = this.sucursal = this.consulta = '';
    this.buscar();
  }

  private async initialize() {
    await this.load();
    if (this.admin) {
      try {
        this.branches.set(await this.api.branches());
      } catch {
        // Sin la lista, el filtro de sucursal queda vacío: el resto sigue sirviendo.
      }
      // El retorno de Stripe es cosa del cliente: la gestión no vuelve de un pago.
      return;
    }
    const returned = this.route.snapshot.queryParamMap.get('payment');
    if (returned === 'success') {
      if (this.selected) await this.verifyPayment(this.selected);
      else {
        // Sesiones antiguas de Stripe no incluyen pedido en success_url.
        const pending = this.orders().filter(o => o.payment_method === 'stripe' && o.status === 'pending_payment');
        for (const order of pending.slice(0, 5)) await this.verifyPayment(order.id);
      }
    } else if (returned === 'cancelled') {
      this.message.set('Volviste del pago. Tu pedido sigue pendiente hasta que Stripe confirme el cobro.');
    }
  }
  async verifyPayment(id: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('Consultando la confirmación de Stripe…');
    try {
      const updated = await this.api.verifyPayment(id, this.admin);
      this.orders.update(orders => orders.some(o => o.id === id)
        ? orders.map(o => o.id === id ? updated : o) : [updated, ...orders]);
      this.message.set(updated.payment_status === 'paid'
        ? 'Pago confirmado por Stripe. Tu pedido está pagado.'
        : updated.status === 'expired' ? 'La sesión de pago expiró. Las existencias fueron liberadas.'
        : 'Stripe todavía no confirma el pago. Si ya pagaste, volvé a verificar en unos momentos.');
    } catch (e) {
      this.message.set('');
      this.error.set(errorMessage(e));
    } finally { this.busy.set(false); }
  }
  async load() {
    this.busy.set(true);
    this.error.set('');
    try {
      this.orders.set(await this.api.orders(this.admin, this.offset, this.filtros()));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  page(direction: number) {
    this.offset = Math.max(0, this.offset + direction * 50);
    void this.load();
  }
  nextStatus(o: Order) {
    return (
      (
        { paid: 'processing', processing: 'shipped', shipped: 'delivered' } as Record<
          string,
          string
        >
      )[o.status] || ''
    );
  }
  edit(o: Order, mode: string) {
    this.editing.set(o.id);
    this.mode = mode;
    this.reference = '';
    this.note = '';
    this.carrier = o.carrier || '';
    this.tracking = o.tracking_number || '';
  }
  async pay(o: Order) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const redirected = await this.api.checkout(o.id);
      if (!redirected) {
        this.message.set('Stripe confirmó que este pedido ya está pagado.');
        await this.load();
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async cancel(o: Order) {
    await this.act('POST', '/orders/' + o.id + '/cancel');
    this.cancelCandidate.set('');
  }
  async save(o: Order) {
    if (this.mode === 'payment')
      await this.act('POST', '/admin/orders/' + o.id + '/payment', {
        method: this.method,
        reference: this.reference,
      });
    else
      await this.act('PATCH', '/admin/orders/' + o.id + '/tracking', {
        status: this.nextStatus(o),
        carrier: this.carrier || null,
        tracking_number: this.tracking || null,
        note: this.note,
      });
  }
  private async act(method: 'POST' | 'PATCH', path: string, body?: unknown) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await this.api.write(method, path, body);
      this.editing.set('');
      this.message.set('Pedido actualizado correctamente.');
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
