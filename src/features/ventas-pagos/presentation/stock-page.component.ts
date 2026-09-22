import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommerceService } from '../infrastructure/commerce.service';
import { Branch, CartItem } from '../domain/commerce.models';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { errorMessage } from '../../../shared/errors';
interface StockMovement { id: string; variant_id: string; delta: number; quantity_before: number; quantity_after: number; kind: string; reason: string; reference: string | null; actor_email: string | null; created_at: string; }
@Component({
  selector: 'fs-stock-page',
  imports: [FormsModule],
  styleUrl: './commerce.scss',
  template: `<section class="commerce-page">
    <p class="eyebrow">INVENTARIO</p>
    <h1>Existencias por sucursal</h1>
    <p class="muted">
      Cantidades disponibles para nuevas compras. Los pedidos pendientes ya reservan sus unidades.
    </p>
    @if (error()) {
      <p role="alert" class="alert error">{{ error() }}</p>
    }
    @if (message()) {
      <p role="status" class="alert">{{ message() }}</p>
    }
    <label
      >Sucursal<select [(ngModel)]="branch" (ngModelChange)="load()" [disabled]="busy()">
        <option value="">Seleccioná una sucursal</option>
        @for (b of branches(); track b.id) {
          <option [value]="b.id">{{ b.name }}</option>
        }
      </select></label
    ><label
      >Buscar prenda o SKU<input
        [(ngModel)]="search"
        type="search"
        placeholder="Nombre, talla, color o SKU"
    /></label>
    @if (session.can('stock.write')) {
      <label>Motivo del ajuste<input [(ngModel)]="reason" maxlength="500" placeholder="Ej.: ingreso por compra, conteo físico" /></label>
    }
    @if (busy()) {
      <p role="status">Actualizando existencias…</p>
    }
    <div class="stock-scroll">
      <table class="commerce-table">
        <thead>
          <tr>
            <th>Prenda / variante</th>
            <th>SKU</th>
            <th>Disponible</th>
            @if (session.can('stock.write')) {
              <th>Nueva cantidad</th>
              <th>Acción</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (i of filtered(); track i.variant_id) {
            <tr>
              <td>
                <strong>{{ i.name }}</strong>
                <p>{{ i.size }} · {{ i.color }}</p>
              </td>
              <td>{{ i.sku }}</td>
              <td>{{ i.available }}</td>
              @if (session.can('stock.write')) {
                <td>
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    [(ngModel)]="drafts[i.variant_id]"
                    [attr.aria-label]="'Nueva cantidad de ' + i.sku"
                  />
                </td>
                <td><button (click)="save(i)" [disabled]="busy()">Guardar</button></td>
              }
            </tr>
          } @empty {
            <tr>
              <td colspan="5">
                {{ branch ? 'Sin variantes que coincidan.' : 'Elegí una sucursal para consultar.' }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    @if (branch) {
      <section class="order-card">
        <h2>Historial reciente</h2>
        <p class="muted">Cada cambio conserva saldo anterior, saldo final, motivo y el correo del usuario que lo registró.</p>
        <div class="stock-scroll"><table class="commerce-table"><thead><tr><th>Fecha</th><th>Movimiento</th><th>Cambio</th><th>Saldo</th><th>Usuario</th></tr></thead><tbody>
          @for (m of movements(); track m.id) { <tr><td>{{ m.created_at.slice(0, 16).replace('T', ' ') }}</td><td>{{ m.reason }}<p>{{ m.reference || m.kind }}</p></td><td>{{ m.delta > 0 ? '+' : '' }}{{ m.delta }}</td><td>{{ m.quantity_before }} → {{ m.quantity_after }}</td><td>{{ m.actor_email || 'Sistema' }}</td></tr> }
          @empty { <tr><td colspan="5">Todavía no hay movimientos registrados para esta sucursal.</td></tr> }
        </tbody></table></div>
      </section>
    }
  </section>`,
})
export class StockPageComponent {
  api = inject(CommerceService);
  session = inject(SessionService);
  branches = signal<Branch[]>([]);
  items = signal<CartItem[]>([]);
  movements = signal<StockMovement[]>([]);
  busy = signal(false);
  error = signal('');
  message = signal('');
  branch = '';
  search = '';
  reason = 'Ajuste de inventario';
  drafts: Record<string, number> = {};
  constructor() {
    void this.init();
  }
  async init() {
    try {
      this.branches.set(await this.api.branches());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
  filtered() {
    const q = this.search.toLowerCase().trim();
    return this.items().filter((i) =>
      [i.name, i.sku, i.size, i.color].join(' ').toLowerCase().includes(q),
    );
  }
  async load() {
    this.items.set([]); this.movements.set([]);
    if (!this.branch) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const [items, movements] = await Promise.all([
        this.api.get<CartItem[]>('/admin/stock', { branch_id: this.branch }),
        this.api.get<StockMovement[]>('/admin/stock/movements', { branch_id: this.branch }),
      ]);
      this.items.set(items);
      this.movements.set(movements);
      this.drafts = Object.fromEntries(items.map((i) => [i.variant_id, i.available]));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async save(i: CartItem) {
    const quantity = this.drafts[i.variant_id];
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) {
      this.error.set('Ingresá una cantidad entera entre 0 y 1.000.000.');
      return;
    }
    if (this.reason.trim().length < 3) { this.error.set('Indicá un motivo de al menos 3 caracteres.'); return; }
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await this.api.write('PUT', '/admin/stock/' + i.variant_id, {
        branch_id: this.branch,
        quantity,
        reason: this.reason.trim(),
      });
      this.message.set('Existencias actualizadas para ' + i.sku);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}

