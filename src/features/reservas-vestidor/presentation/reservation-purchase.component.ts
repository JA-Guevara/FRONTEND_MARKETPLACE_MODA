import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Reservation } from '../domain/reservas.models';
import { ReservasService } from '../infrastructure/reservas.service';
import { errorMessage } from '../../../shared/errors';

@Component({
  selector: 'fs-reservation-purchase',
  imports: [FormsModule, RouterLink],
  template: ` @if (reservation.order_id) {
      <p>
        Pedido {{ reservation.order_number }} ·
        {{ reservation.payment_status === 'paid' ? 'Pagado' : 'Pendiente de pago' }}
      </p>
      <a
        [routerLink]="admin ? '/admin/pedidos' : '/mi-cuenta/pedidos'"
        [queryParams]="{ pedido: reservation.order_id }"
        >Ver pedido y pago →</a
      >
    } @else if (['pending', 'confirmed', 'ready', 'attended'].includes(reservation.status)) {
      @if (!open()) {
        <button type="button" (click)="begin()">Comprar prendas de esta reserva</button>
      } @else {
        <form (ngSubmit)="create()" class="purchase">
          <strong>Elegí las prendas que te llevás</strong>
          <p>
            El pedido mostrará el precio vigente y los descuentos antes de pagarlo. Las prendas que
            no elegís vuelven a estar disponibles.
          </p>
          @for (item of reservation.items; track item.variant_id) {
            <label
              >{{ item.name }} · {{ item.size }} · {{ item.color }}
              <input
                type="number"
                [name]="item.variant_id"
                [(ngModel)]="quantities[item.variant_id]"
                min="0"
                [max]="item.quantity"
                step="1"
                required
              />
            </label>
          }
          <label
            >Forma de pago
            <select name="payment" [(ngModel)]="method">
              <option value="manual">Coordinar pago con la tienda</option>
              <option value="stripe">Tarjeta con Stripe</option>
            </select>
          </label>
          @if (error()) {
            <p role="alert">{{ error() }}</p>
          }
          <button type="submit" [disabled]="busy()">
            {{ busy() ? 'Creando…' : 'Crear pedido y revisar total' }}
          </button>
          <button type="button" [disabled]="busy()" (click)="open.set(false)">Volver</button>
        </form>
      }
    }`,
  styles: [
    `
      .purchase {
        display: grid;
        gap: 12px;
        padding: 16px;
        min-width: min(320px, 100%);
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 12px;
      }
      .purchase label {
        display: grid;
        gap: 5px;
      }
      .purchase input {
        max-width: 90px;
      }
      .purchase p {
        max-width: 48ch;
        font-size: 13px;
      }
    `,
  ],
})
export class ReservationPurchaseComponent {
  @Input({ required: true }) reservation!: Reservation;
  @Input() admin = false;
  @Output() converted = new EventEmitter<void>();
  private api = inject(ReservasService);
  open = signal(false);
  busy = signal(false);
  error = signal('');
  quantities: Record<string, number> = {};
  method: 'manual' | 'stripe' = 'manual';
  begin() {
    this.quantities = Object.fromEntries(
      this.reservation.items.map((i) => [i.variant_id, i.quantity]),
    );
    this.open.set(true);
  }
  async create() {
    if (this.busy()) return;
    const items = this.reservation.items
      .map((i) => ({
        variant_id: i.variant_id,
        quantity: Number(this.quantities[i.variant_id] || 0),
      }))
      .filter((i) => i.quantity > 0);
    if (!items.length) {
      this.error.set('Elegí al menos una prenda.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.toOrder(
        this.reservation.id,
        { items, payment_method: this.method },
        this.admin,
      );
      this.open.set(false);
      this.converted.emit();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
