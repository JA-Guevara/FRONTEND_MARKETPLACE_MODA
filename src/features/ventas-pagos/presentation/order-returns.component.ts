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
      {{ abierto() ? 'Ocultar devoluciones' : 'Devolver prendas' }}
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
                  <strong>{{ etiqueta(d.status) }}</strong>
                  <small>{{ d.created_at | date: 'dd/MM/yyyy HH:mm' }}</small>
                </div>
                <p class="muted">{{ resumen(d.items) }}</p>
                <p>
                  Reintegro: <strong>{{ d.currency | uppercase }} {{ d.refund_amount | number: '1.2-2' }}</strong>
                </p>
                @if (d.resolution_note) {
                  <p class="muted">{{ d.resolution_note }}</p>
                }
              </li>
            }
          </ul>
        }

        @if (info.can_request) {
          @if (!formulario()) {
            <button type="button" class="primary" (click)="formulario.set(true)">
              <fs-icon name="plus" /> Solicitar una devolución
            </button>
          } @else {
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
      await this.api.requestReturn(this.pedido.id, {
        reason: this.motivo,
        items,
        // Un reenvío del formulario no debe abrir dos devoluciones.
        client_request_id: crypto.randomUUID(),
      });
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
}
