import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommerceService } from '../infrastructure/commerce.service';
import { Branch, CartItem } from '../domain/commerce.models';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { errorMessage } from '../../../shared/errors';
import { DialogFocusDirective } from '../../../shared/dialog-focus.directive';
import { HttpErrorResponse } from '@angular/common/http';
/** Tipos que acepta POST /admin/stock/{variant_id}/movements (StockEntry.kind).
 * El ajuste a una cantidad exacta sigue yendo por PUT /admin/stock/{variant_id}. */
export const MOVEMENT_KINDS = [
  { value: 'receipt', label: 'Entrada (ingreso de mercadería)' },
  { value: 'return', label: 'Entrada por devolución' },
  { value: 'issue', label: 'Salida (baja, merma o traspaso)' },
] as const;
type MovementKind = (typeof MOVEMENT_KINDS)[number]['value'];
const KIND_LABELS: Record<string, string> = {
  receipt: 'Entrada', return: 'Devolución', issue: 'Salida', adjustment: 'Ajuste', sale: 'Venta',
};
interface StockMovement { id: string; variant_id: string; delta: number; quantity_before: number; quantity_after: number; kind: string; reason: string; reference: string | null; actor_email: string | null; created_at: string; }
@Component({
  selector: 'fs-stock-page',
  imports: [FormsModule, DialogFocusDirective],
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
    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;">
      <span class="muted" style="font-size:13px;">Vista:</span>
      <button type="button" [class.primary]="viewMode() === 'list'" (click)="viewMode.set('list')" style="padding:4px 12px;font-size:12px;border-radius:6px;">Lista</button>
      <button type="button" [class.primary]="viewMode() === 'matrix'" (click)="viewMode.set('matrix')" style="padding:4px 12px;font-size:12px;border-radius:6px;">Matriz Talla × Color</button>
    </div>
    @if (viewMode() === 'matrix') {
      <div class="stock-scroll">
        @for (mat of matrices(); track mat.name) {
          <div style="margin-bottom:16px;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <strong style="font-size:14px;">{{ mat.name }}</strong>
              <span class="muted" style="font-size:12px;">Total disponible: {{ mat.totalAvailable }}</span>
            </div>
            <table class="commerce-table" style="margin:0;">
              <thead>
                <tr>
                  <th style="width:130px;">Color \ Talla</th>
                  @for (sz of mat.sizes; track sz) {
                    <th style="text-align:center;">{{ sz }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (col of mat.colors; track col) {
                  <tr>
                    <td><strong>{{ col }}</strong></td>
                    @for (sz of mat.sizes; track sz) {
                      @if (mat.cells[col]?.[sz]; as item) {
                        <td style="text-align:center;">
                          <span [style.color]="item.available === 0 ? 'var(--danger,#e11d48)' : (item.available <= 3 ? 'var(--warning,#f59e0b)' : 'inherit')" style="font-weight:bold;">
                            {{ item.available }}
                          </span>
                          @if (session.can('stock.write') && !session.readOnly()) {
                            <button type="button" (click)="openMovement(item)" style="padding:2px 6px;font-size:11px;margin-left:6px;" title="Registrar movimiento">±</button>
                          }
                        </td>
                      } @else {
                        <td style="text-align:center;" class="muted">-</td>
                      }
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @empty {
          <p class="muted">{{ branch ? 'Sin prendas para mostrar.' : 'Elegí una sucursal para consultar.' }}</p>
        }
      </div>
    } @else {
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
                <td>
                  <button (click)="save(i)" [disabled]="busy()">Guardar</button>
                  @if (!session.readOnly()) {
                    <button (click)="openMovement(i)" [disabled]="busy()">Registrar movimiento</button>
                  }
                </td>
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
    }
    @if (branch) {
      <section class="order-card">
        <h2>Historial reciente</h2>
        <p class="muted">Cada cambio conserva saldo anterior, saldo final, motivo y el correo del usuario que lo registró.</p>
        <div class="stock-scroll"><table class="commerce-table"><thead><tr><th>Fecha</th><th>Movimiento</th><th>Cambio</th><th>Saldo</th><th>Usuario</th></tr></thead><tbody>
          @for (m of movements(); track m.id) { <tr><td>{{ m.created_at.slice(0, 16).replace('T', ' ') }}</td><td>{{ m.reason }}<p>{{ kindLabel(m.kind) }}{{ m.reference ? ' · ' + m.reference : '' }}</p></td><td>{{ m.delta > 0 ? '+' : '' }}{{ m.delta }}</td><td>{{ m.quantity_before }} → {{ m.quantity_after }}</td><td>{{ m.actor_email || 'Sistema' }}</td></tr> }
          @empty { <tr><td colspan="5">Todavía no hay movimientos registrados para esta sucursal.</td></tr> }
        </tbody></table></div>
      </section>
    }
    @if (movementItem(); as target) {
      <div class="modal-backdrop">
        <section class="modal small" role="dialog" aria-modal="true" aria-labelledby="movement-title" (dismissed)="closeMovement()">
          <h2 id="movement-title">Registrar movimiento</h2>
          <p class="muted">{{ target.name }} · {{ target.size }} · {{ target.color }} ({{ target.sku }}). Disponible: {{ target.available }}.</p>
          @if (movementError()) {
            <p role="alert" class="alert error">{{ movementError() }}</p>
          }
          <form (ngSubmit)="registerMovement()">
            <label>Tipo de movimiento
              <select name="kind" [(ngModel)]="movement.kind">
                @for (k of kinds; track k.value) { <option [value]="k.value">{{ k.label }}</option> }
              </select></label>
            <label>Cantidad<input name="quantity" type="number" min="1" max="1000000" required [(ngModel)]="movement.quantity" /></label>
            <label>Motivo<input name="reason" required minlength="3" maxlength="500" [(ngModel)]="movement.reason" placeholder="Ej.: compra a proveedor, prenda dañada" /></label>
            <label>Referencia (opcional)<input name="reference" maxlength="100" [(ngModel)]="movement.reference" placeholder="Ej.: factura 0012" /></label>
            <div class="form-actions">
              <button class="primary" type="submit" [disabled]="busy()">{{ busy() ? 'Registrando…' : 'Registrar' }}</button>
              <button type="button" [disabled]="busy()" (click)="closeMovement()">Cancelar</button>
            </div>
          </form>
        </section>
      </div>
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
  readonly kinds = MOVEMENT_KINDS;
  readonly viewMode = signal<'list' | 'matrix'>('list');
  movementItem = signal<CartItem | null>(null);
  movementError = signal('');
  movement: { kind: MovementKind; quantity: number | null; reason: string; reference: string } = {
    kind: 'receipt', quantity: null, reason: '', reference: '',
  };
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
  matrices() {
    const list = this.filtered();
    const map = new Map<string, CartItem[]>();
    for (const item of list) {
      const group = map.get(item.name) || [];
      group.push(item);
      map.set(item.name, group);
    }
    return Array.from(map.entries()).map(([name, variants]) => {
      const sizes = Array.from(new Set(variants.map((v) => v.size)));
      const colors = Array.from(new Set(variants.map((v) => v.color)));
      const cells: Record<string, Record<string, CartItem>> = {};
      let total = 0;
      for (const v of variants) {
        if (!cells[v.color]) cells[v.color] = {};
        cells[v.color][v.size] = v;
        total += v.available || 0;
      }
      return { name, sizes, colors, cells, totalAvailable: total };
    });
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
  kindLabel(kind: string) {
    return KIND_LABELS[kind] || kind;
  }
  openMovement(i: CartItem) {
    if (!this.session.can('stock.write') || this.session.readOnly()) return;
    this.movement = { kind: 'receipt', quantity: null, reason: '', reference: '' };
    this.movementError.set('');
    this.movementItem.set(i);
  }
  closeMovement() {
    if (this.busy()) return;
    this.movementItem.set(null);
  }
  /** CU-13: registra entrada/salida con POST /admin/stock/{variant_id}/movements. */
  async registerMovement() {
    const target = this.movementItem();
    if (!target || this.busy() || !this.session.can('stock.write') || this.session.readOnly()) return;
    const quantity = Number(this.movement.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000000) {
      this.movementError.set('Ingresá una cantidad entera entre 1 y 1.000.000.');
      return;
    }
    const reason = this.movement.reason.trim();
    if (reason.length < 3) { this.movementError.set('Indicá un motivo de al menos 3 caracteres.'); return; }
    this.busy.set(true);
    this.movementError.set('');
    this.message.set('');
    try {
      const reference = this.movement.reference.trim();
      const result = await this.api.write<{ quantity: number }>('POST', `/admin/stock/${target.variant_id}/movements`, {
        branch_id: this.branch,
        kind: this.movement.kind,
        quantity,
        reason,
        ...(reference ? { reference } : {}),
      });
      this.busy.set(false);
      this.movementItem.set(null);
      await this.load();
      this.message.set(`Movimiento registrado para ${target.sku}. Saldo actual: ${result?.quantity ?? '—'}.`);
    } catch (e) {
      this.movementError.set(
        e instanceof HttpErrorResponse && e.status === 409
          ? `Stock insuficiente: no podés retirar ${quantity} unidades de ${target.sku} porque solo hay ${target.available} disponibles.`
          : errorMessage(e),
      );
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

