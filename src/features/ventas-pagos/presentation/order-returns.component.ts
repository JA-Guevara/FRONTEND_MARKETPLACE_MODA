import { Component, Input, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/icon.component';
import { CommerceService } from '../infrastructure/commerce.service';
import { CartItem, Order, OrderReturn, ReturnAvailability, commerceLabel } from '../domain/commerce.models';
import { errorMessage } from '../../../shared/errors';

/**
 * Devoluciones de un pedido, desde la vista del cliente (CU19).
 *
 * Se carga bajo demanda: mientras el cliente no toque el panel no se pide nada
 * al servidor, para que "Mis pedidos" siga abriendo con una sola consulta.
 */
@Component({
  selector: 'fs-order-returns',
  styleUrl: './order-tracking.scss',
  imports: [FormsModule, DatePipe, DecimalPipe, UpperCasePipe, IconComponent],
  template: `<div class="returns-panel">
    <button type="button" class="tracker-toggle" (click)="toggle()" [disabled]="busy()">
      <fs-icon [name]="abierto() ? 'close' : 'box'" />
      {{ abierto() ? 'Ocultar cambios y devoluciones' : 'Cambiar o devolver prendas' }}
    </button>

    @if (abierto()) {
      @if (error()) {
        <p class="alert error" role="alert">{{ error() }}</p>
      }
      @if (message()) {
        <p class="alert" role="status">{{ message() }}</p>
      }
      @if (busy() && !estado()) {
        <p role="status">Consultando…</p>
      }

      @if (estado(); as info) {
        @if (info.returns.length) {
          <ul class="returns-list">
            @for (d of info.returns; track d.id) {
              <li class="is-{{ d.status }}">
                <div>
                  <strong>{{ d.kind === 'exchange' ? 'Cambio' : 'Devolución' }} · {{ etiqueta(d.status) }}</strong>
                  <small>{{ d.created_at | date: 'dd/MM/yyyy HH:mm' }}</small>
                </div>
                <p class="muted">{{ resumen(d.items) }}</p>
                @if (d.kind === 'exchange') {
                  <p>Cambio por: {{ d.items[0].replacement_name }} · {{ d.items[0].replacement_size }} · {{ d.items[0].replacement_color }}</p>
                } @else {<p>
                  Reintegro: <strong>{{ d.currency | uppercase }} {{ d.refund_amount | number: '1.2-2' }}</strong>
                </p>}
                @if (d.resolution_note) {
                  <p class="muted">{{ d.resolution_note }}</p>
                }
              </li>
            }
          </ul>
        }

        @if (info.can_request) {
          @if (!formulario() && !formularioCambio()) {
            <button type="button" class="primary" (click)="formulario.set(true)">
              <fs-icon name="plus" /> Solicitar una devolución
            </button>
            <button type="button" (click)="formularioCambio.set(true)">Solicitar un cambio</button>
          } @else if (formulario()) {
            <form #form="ngForm" (ngSubmit)="form.valid && enviar()" class="returns-form">
              <h3>¿Qué querés devolver?</h3>
              @for (i of devolvibles(); track i.variant_id) {
                <label class="returns-item">
                  <span>
                    {{ i.name }}
                    <small>{{ i.size }} · {{ i.color }} · quedan {{ disponible(i.variant_id) }}</small>
                  </span>
                  <input
                    type="number"
                    [name]="'cantidad-' + i.variant_id"
                    [ngModel]="cantidad(i.variant_id)"
                    (ngModelChange)="setCantidad(i.variant_id, $event)"
                    min="0"
                    [max]="disponible(i.variant_id)"
                  />
                </label>
              }
              <label>
                Motivo de la devolución
                <textarea
                  name="motivo"
                  [(ngModel)]="motivo"
                  required
                  minlength="5"
                  maxlength="500"
                  placeholder="Contanos qué pasó con la prenda"
                ></textarea>
              </label>
              <p class="muted">
                Al aprobarla te indicamos cómo entregar las prendas; el reintegro se procesa cuando
                las recibimos en la sucursal.
              </p>
              <div class="commerce-actions">
                <button type="submit" class="primary" [disabled]="busy() || !form.valid || total() === 0">
                  Enviar solicitud</button
                ><button type="button" (click)="formulario.set(false)" [disabled]="busy()">
                  Volver
                </button>
              </div>
            </form>
          }
          @if (formularioCambio()) {
            <form #exchangeForm="ngForm" (ngSubmit)="exchangeForm.valid && enviarCambio()" class="returns-form">
              <h3>Solicitar un cambio</h3>
              <label>Prenda del pedido
                <select name="original" [ngModel]="originalCambio()" (ngModelChange)="elegirOriginal($event)" required>
                  <option value="">Elegí una prenda</option>
                  @for (i of devolvibles(); track i.variant_id) {
                    <option [value]="i.variant_id">{{ i.name }} · {{ i.size }} · {{ i.color }}</option>
                  }
                </select>
              </label>
              @if (originalCambio()) {
                <label>Nueva prenda o talla
                  <select name="replacement" [(ngModel)]="reemplazoCambio" required>
                    <option value="">Elegí una opción disponible al mismo precio</option>
                    @for (o of opcionesCambio(); track o.variant_id) {
                      <option [value]="o.variant_id">{{ o.product_name }} · {{ o.size }} · {{ o.color }} · {{ o.available }} disponibles</option>
                    }
                  </select>
                </label>
                <label>Cantidad
                  <input type="number" name="exchangeQuantity" [(ngModel)]="cantidadCambio" min="1" [max]="maxCambio()" required />
                </label>
                <label>Motivo
                  <textarea name="exchangeReason" [(ngModel)]="motivoCambio" minlength="5" maxlength="500" required></textarea>
                </label>
                <p class="muted">La nueva prenda queda apartada al solicitar el cambio. La original vuelve al inventario cuando se recibe en la sucursal.</p>
                <button type="submit" class="primary" [disabled]="busy() || !exchangeForm.valid || !reemplazoCambio || cantidadCambio > maxCambio()">Enviar cambio</button>
              }
              <button type="button" (click)="formularioCambio.set(false)">Volver</button>
            </form>
          }
        } @else if (info.reason) {
          <p class="muted">{{ info.reason }}</p>
        }
      }
    }
  </div>`,
})
export class OrderReturnsComponent {
  @Input({ required: true }) pedido!: Order;
  private api = inject(CommerceService);
  abierto = signal(false);
  formulario = signal(false);
  formularioCambio = signal(false);
  originalCambio = signal('');
  opcionesCambio = signal<{ variant_id: string; product_name: string; size: string; color: string; available: number; price: string }[]>([]);
  reemplazoCambio = '';
  cantidadCambio = 1;
  motivoCambio = '';
  private pendingReturn?: { fingerprint: string; id: string };
  private pendingExchange?: { fingerprint: string; id: string };
  maxCambio = () => Math.min(
    this.disponible(this.originalCambio()),
    this.opcionesCambio().find((row) => row.variant_id === this.reemplazoCambio)?.available || 0,
  );
  estado = signal<ReturnAvailability | null>(null);
  busy = signal(false);
  error = signal('');
  message = signal('');
  motivo = '';
  etiqueta = commerceLabel;
  private cantidades = signal<Record<string, number>>({});

  /** Prendas del pedido que todavía admiten devolución. */
  devolvibles = computed<CartItem[]>(() => {
    const unidades = this.estado()?.units || {};
    return (this.pedido.items || []).filter((i) => (unidades[i.variant_id] || 0) > 0);
  });
  total = computed(() => Object.values(this.cantidades()).reduce((a, b) => a + b, 0));

  disponible(variantId: string) {
    return this.estado()?.units[variantId] || 0;
  }
  cantidad(variantId: string) {
    return this.cantidades()[variantId] || 0;
  }
  setCantidad(variantId: string, valor: number) {
    // El tope del servidor manda: el input puede ser editado a mano.
    const limite = this.disponible(variantId);
    const cantidad = Math.max(0, Math.min(Number(valor) || 0, limite));
    this.cantidades.update((actual) => ({ ...actual, [variantId]: cantidad }));
  }
  resumen(items: CartItem[]) {
    return items.map((i) => `${i.name} (${i.size}/${i.color}) x${i.quantity}`).join(' · ');
  }

  private requestId(kind: 'return' | 'exchange', payload: unknown): string {
    const fingerprint = JSON.stringify(payload);
    const pending = kind === 'return' ? this.pendingReturn : this.pendingExchange;
    if (pending?.fingerprint === fingerprint) return pending.id;
    const next = { fingerprint, id: crypto.randomUUID() };
    if (kind === 'return') this.pendingReturn = next;
    else this.pendingExchange = next;
    return next.id;
  }

  async toggle() {
    this.abierto.update((v) => !v);
    if (this.abierto() && !this.estado()) await this.cargar();
  }

  private async cargar() {
    this.busy.set(true);
    this.error.set('');
    try {
      this.estado.set(await this.api.returnsOf(this.pedido.id));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async enviar() {
    const items = Object.entries(this.cantidades())
      .filter(([, cantidad]) => cantidad > 0)
      .map(([variant_id, quantity]) => ({ variant_id, quantity }));
    if (!items.length) {
      this.error.set('Indicá cuántas unidades querés devolver.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const payload = { reason: this.motivo.trim(), items };
      await this.api.requestReturn(this.pedido.id, {
        ...payload,
        // Un reenvío del formulario no debe abrir dos devoluciones.
        client_request_id: this.requestId('return', payload),
      });
      this.pendingReturn = undefined;
      this.message.set('Registramos tu solicitud. Te avisamos por correo cuando la revisemos.');
      this.formulario.set(false);
      this.cantidades.set({});
      this.motivo = '';
      await this.cargar();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async elegirOriginal(variantId: string) {
    this.originalCambio.set(variantId);
    this.reemplazoCambio = '';
    this.opcionesCambio.set([]);
    if (!variantId) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const options = await this.api.exchangeOptions(this.pedido.id, variantId);
      if (this.originalCambio() === variantId) this.opcionesCambio.set(options);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async enviarCambio() {
    if (!this.originalCambio() || !this.reemplazoCambio ||
        this.cantidadCambio < 1 || this.cantidadCambio > this.maxCambio()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const payload = {
        variant_id: this.originalCambio(), replacement_variant_id: this.reemplazoCambio,
        quantity: Number(this.cantidadCambio), reason: this.motivoCambio.trim(),
      };
      await this.api.requestExchange(this.pedido.id, {
        ...payload, client_request_id: this.requestId('exchange', payload),
      });
      this.pendingExchange = undefined;
      this.message.set('Registramos el cambio y apartamos la nueva prenda. Te avisaremos cuando lo revisen.');
      this.formularioCambio.set(false);
      this.originalCambio.set('');
      this.reemplazoCambio = '';
      this.motivoCambio = '';
      await this.cargar();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
