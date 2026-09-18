import { Component, Input, computed, inject, signal } from '@angular/core';
import { DecimalPipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/icon.component';
import { CommerceService } from '../infrastructure/commerce.service';
import { CartItem, OrderReturn, PosLookup, commerceLabel } from '../domain/commerce.models';
import { errorMessage } from '../../../shared/errors';

/**
 * Devoluciones atendidas en el mostrador (CU19 en caja).
 *
 * En el mostrador la devolución no es un trámite en tres pasos: el cliente
 * entrega la prenda y se le reintegra el dinero en el momento. Por eso esta
 * pantalla registra y cierra la devolución de una sola vez, y el servidor
 * devuelve las unidades al stock enseguida.
 */
@Component({
  selector: 'fs-pos-returns',
  imports: [FormsModule, DecimalPipe, UpperCasePipe, IconComponent],
  styleUrl: './pos.scss',
  template: `<div class="pos-layout">
    <section class="pos-panel">
      <h2>Buscar la venta</h2>
      <p class="muted">Pedile al cliente el número que figura en su comprobante.</p>
      <form (ngSubmit)="buscar()" class="pos-search">
        <label>
          Número de venta
          <input
            name="numero"
            [(ngModel)]="numero"
            (keydown.enter)="$event.preventDefault(); buscar()"
            placeholder="FS-XXXXXXXXXXXX"
            autocomplete="off"
            autofocus
          />
        </label>
        <div class="pos-actions">
          <button type="submit" class="primary" [disabled]="busy() || numero.trim().length < 3">
            <fs-icon name="search" /> Buscar
          </button>
          @if (venta()) {
            <button type="button" (click)="limpiar()" [disabled]="busy()">Limpiar</button>
          }
        </div>
      </form>

      @if (error()) {
        <p class="alert error" role="alert">{{ error() }}</p>
      }

      @if (venta(); as datos) {
        <h3>Venta {{ datos.order.number }}</h3>
        <p class="muted">
          {{ datos.order.address.recipient || 'Consumidor final' }} ·
          {{ etiqueta(datos.order.payment_method) }} ·
          {{ datos.order.currency | uppercase }} {{ datos.order.total | number: '1.2-2' }}
        </p>

        @if (!datos.can_request) {
          <p class="alert" role="status">
            {{ datos.reason || 'Esta venta ya no admite devoluciones.' }}
          </p>
        }

        <div class="pos-stock">
          <table>
            <thead>
              <tr><th>Prenda</th><th>Quedan</th><th>Devolver</th></tr>
            </thead>
            <tbody>
              @for (i of devolvibles(); track i.variant_id) {
                <tr>
                  <td>
                    <strong>{{ i.name }}</strong>
                    <small>{{ i.size }} · {{ i.color }} · {{ i.sku }}</small>
                  </td>
                  <td>{{ disponible(i.variant_id) }}</td>
                  <td>
                    <div class="pos-qty">
                      <button type="button" (click)="cambiar(i, -1)" [disabled]="cantidad(i.variant_id) === 0">−</button>
                      <input
                        type="number"
                        [name]="'dev-' + i.variant_id"
                        [ngModel]="cantidad(i.variant_id)"
                        (ngModelChange)="fijar(i.variant_id, $event)"
                        min="0"
                        [max]="disponible(i.variant_id)"
                      />
                      <button type="button" (click)="cambiar(i, 1)" [disabled]="cantidad(i.variant_id) >= disponible(i.variant_id)">+</button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="3" class="muted">No quedan prendas por devolver de esta venta.</td></tr>
              }
            </tbody>
          </table>
        </div>

        @if (datos.returns.length) {
          <h3>Devoluciones anteriores</h3>
          @for (d of datos.returns; track d.id) {
            <p class="muted">
              {{ etiqueta(d.status) }} · {{ d.currency | uppercase }}
              {{ d.refund_amount | number: '1.2-2' }} · {{ resumen(d) }}
            </p>
          }
        }
      }
    </section>

    <aside class="pos-ticket">
      @if (cerrada(); as hecho) {
        <div class="pos-recibo">
          <h2><fs-icon name="check" /> Devolución registrada</h2>
          <dl>
            <dt>Reintegro</dt>
            <dd><strong>{{ hecho.currency | uppercase }} {{ hecho.refund_amount | number: '1.2-2' }}</strong></dd>
            <dt>Prendas</dt>
            <dd>{{ unidades(hecho) }}</dd>
          </dl>
          <p class="muted">
            Las unidades ya volvieron al stock de la sucursal y el cliente recibió el aviso por
            correo. Entregale el importe.
          </p>
          <button type="button" class="primary" (click)="limpiar()">
            <fs-icon name="plus" /> Atender otra devolución
          </button>
        </div>
      } @else if (venta()?.can_request) {
        <section class="pos-panel">
          <h2>Reintegro</h2>
          <div class="pos-total">
            <span>A devolver</span>
            <strong>{{ importe() | number: '1.2-2' }}</strong>
          </div>
          <label>
            Motivo
            <textarea
              name="motivo"
              [(ngModel)]="motivo"
              required
              minlength="5"
              maxlength="500"
              placeholder="Talla equivocada, falla de fábrica, arrepentimiento…"
            ></textarea>
          </label>
          <label>
            Nota interna (opcional)
            <input name="nota" [(ngModel)]="nota" maxlength="500" placeholder="Estado de la prenda" />
          </label>
          @if (message()) {
            <p class="alert error" role="alert">{{ message() }}</p>
          }
          <button type="button" class="primary" (click)="registrar()" [disabled]="busy() || !total()">
            {{ busy() ? 'Registrando…' : 'Registrar devolución y reintegrar' }}
          </button>
          <p class="muted">
            Se reintegra por el mismo medio de la compra y el stock vuelve en el acto.
          </p>
        </section>
      }
    </aside>
  </div>`,
})
export class PosReturnsComponent {
  /** Sucursal elegida en la barra de caja, para avisar si la venta es de otra. */
  @Input() sucursal = '';

  private api = inject(CommerceService);
  venta = signal<PosLookup | null>(null);
  cerrada = signal<OrderReturn | null>(null);
  busy = signal(false);
  error = signal('');
  message = signal('');
  numero = '';
  motivo = '';
  nota = '';
  etiqueta = commerceLabel;
  private cantidades = signal<Record<string, number>>({});

  devolvibles = computed<CartItem[]>(() => {
    const datos = this.venta();
    if (!datos) return [];
    return (datos.order.items || []).filter((i) => (datos.units[i.variant_id] || 0) > 0);
  });
  total = computed(() => Object.values(this.cantidades()).reduce((a, b) => a + b, 0));
  importe = computed(() => {
    const datos = this.venta();
    if (!datos) return 0;
    return (datos.order.items || []).reduce(
      (suma, i) => suma + Number(i.unit_price) * (this.cantidades()[i.variant_id] || 0),
      0,
    );
  });

  disponible(variantId: string) {
    return this.venta()?.units[variantId] || 0;
  }
  cantidad(variantId: string) {
    return this.cantidades()[variantId] || 0;
  }
  fijar(variantId: string, valor: number) {
    // El tope del servidor manda: el campo se puede editar a mano.
    const limite = this.disponible(variantId);
    this.cantidades.update((actual) => ({
      ...actual,
      [variantId]: Math.max(0, Math.min(Number(valor) || 0, limite)),
    }));
  }
  cambiar(item: CartItem, delta: number) {
    this.fijar(item.variant_id, this.cantidad(item.variant_id) + delta);
  }
  resumen(d: OrderReturn) {
    return d.items.map((i) => `${i.name} x${i.quantity}`).join(' · ');
  }
  unidades(d: OrderReturn) {
    return d.items.reduce((suma, i) => suma + i.quantity, 0);
  }

  limpiar() {
    this.venta.set(null);
    this.cerrada.set(null);
    this.cantidades.set({});
    this.numero = '';
    this.motivo = '';
    this.nota = '';
    this.error.set('');
    this.message.set('');
  }

  async buscar() {
    if (this.busy() || this.numero.trim().length < 3) return;
    this.busy.set(true);
    this.error.set('');
    this.cerrada.set(null);
    this.cantidades.set({});
    try {
      const datos = await this.api.posLookup(this.numero.trim().toUpperCase());
      this.venta.set(datos);
      if (this.sucursal && datos.order.branch_id !== this.sucursal) {
        this.error.set(
          'Atención: esta venta se hizo en otra sucursal. La devolución reingresa el stock en la sucursal de la venta.',
        );
      }
    } catch (e) {
      this.venta.set(null);
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async registrar() {
    const datos = this.venta();
    if (!datos || this.busy()) return;
    const items = Object.entries(this.cantidades())
      .filter(([, cantidad]) => cantidad > 0)
      .map(([variant_id, quantity]) => ({ variant_id, quantity }));
    if (!items.length) {
      this.message.set('Indicá cuántas unidades devuelve el cliente.');
      return;
    }
    if (this.motivo.trim().length < 5) {
      this.message.set('Escribí el motivo de la devolución.');
      return;
    }
    this.busy.set(true);
    this.message.set('');
    this.error.set('');
    try {
      this.cerrada.set(
        await this.api.posReturn({
          order_id: datos.order.id,
          reason: this.motivo.trim(),
          note: this.nota.trim() || null,
          items,
          // Un doble clic no puede reintegrar dos veces.
          client_request_id: crypto.randomUUID(),
        }),
      );
      this.venta.set(null);
    } catch (e) {
      this.message.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
