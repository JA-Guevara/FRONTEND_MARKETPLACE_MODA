import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CommerceService } from '../infrastructure/commerce.service';
import { Branch, CartItem, Order } from '../domain/commerce.models';
import { errorMessage } from '../../../shared/errors';
import { environment } from '../../../environments/environment';

interface CashPoint { id: string; code: string; name: string; branch_id: string; }

@Component({
  selector: 'fs-pos-page',
  imports: [FormsModule, DecimalPipe],
  styleUrl: './commerce.scss',
  template: `<section class="commerce-page pos-page">
    <p class="eyebrow">VENTA PRESENCIAL</p>
    <h1>Caja</h1>
    <p class="muted">Registrá una venta cobrada. El precio y las existencias se confirman desde el servidor antes de guardarla.</p>
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
    @if (message()) { <p class="alert" role="status">{{ message() }}</p> }
    <div class="commerce-grid">
      <section class="commerce-card">
        <div class="form-grid">
          <label>Sucursal<select [(ngModel)]="branch" (ngModelChange)="loadBranch()" [disabled]="busy()"><option value="">Seleccioná una sucursal</option>@for (b of branches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }</select></label>
          <label>Punto de caja<select [(ngModel)]="cashPoint" [disabled]="!branch || busy()"><option value="">Seleccioná una caja</option>@for (p of cashPoints(); track p.id) { <option [value]="p.id">{{ p.code }} · {{ p.name }}</option> }</select></label>
        </div>
        <label>Buscar prenda o SKU<input [(ngModel)]="search" type="search" placeholder="Nombre, talla, color o SKU" /></label>
        <div class="stock-scroll"><table class="commerce-table"><thead><tr><th>Prenda</th><th>Disponible</th><th>Agregar</th></tr></thead><tbody>
          @for (item of filtered(); track item.variant_id) { <tr><td><strong>{{ item.name }}</strong><p>{{ item.size }} · {{ item.color }} · {{ item.sku }}</p></td><td>{{ item.available }}</td><td><button type="button" (click)="add(item)" [disabled]="selected(item).quantity >= item.available">＋ Añadir</button></td></tr> }
          @empty { <tr><td colspan="3">{{ branch ? 'No hay prendas disponibles con esa búsqueda.' : 'Elegí una sucursal para empezar.' }}</td></tr> }
        </tbody></table></div>
      </section>
      <aside class="commerce-card checkout-side">
        <h2>Venta actual</h2>
        @for (line of lines(); track line.item.variant_id) { <div class="cart-line"><div><strong>{{ line.item.name }}</strong><p>{{ line.item.size }} · {{ line.item.color }}</p></div><div class="quantity"><button type="button" (click)="change(line.item, -1)">−</button><span>{{ line.quantity }}</span><button type="button" (click)="change(line.item, 1)" [disabled]="line.quantity >= line.item.available">+</button></div></div> }
        @empty { <p class="muted">Agregá prendas desde el listado.</p> }
        <p class="total">Total <strong>{{ total() | number: '1.2-2' }} BOB</strong></p>
        <label>Cliente<input [(ngModel)]="customerName" autocomplete="name" placeholder="Consumidor final" /></label>
        <label>Correo opcional<input [(ngModel)]="customerEmail" type="email" autocomplete="email" placeholder="cliente@correo.com" /></label>
        <label>Forma de pago<select [(ngModel)]="paymentMethod"><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select></label>
        <label>Referencia<input [(ngModel)]="reference" placeholder="N.º de recibo o transferencia" /></label>
        <label class="check"><input type="checkbox" [(ngModel)]="received" /> Confirmo que el pago fue recibido.</label>
        <button class="primary" type="button" (click)="complete()" [disabled]="busy() || !lines().length">{{ busy() ? 'Registrando…' : 'Cobrar y emitir comprobante' }}</button>
      </aside>
    </div>
  </section>`,
})
export class PosPageComponent {
  api = inject(CommerceService);
  http = inject(HttpClient);
  branches = signal<Branch[]>([]); cashPoints = signal<CashPoint[]>([]); items = signal<CartItem[]>([]);
  lines = signal<{ item: CartItem; quantity: number }[]>([]); busy = signal(false); error = signal(''); message = signal('');
  branch = ''; cashPoint = ''; search = ''; customerName = ''; customerEmail = ''; paymentMethod: 'cash' | 'transfer' = 'cash'; reference = ''; received = false;
  constructor() { void this.init(); }
  async init() { try { this.branches.set(await this.api.branches()); } catch (e) { this.error.set(errorMessage(e)); } }
  filtered() { const q = this.search.trim().toLowerCase(); return this.items().filter(i => [i.name, i.sku, i.size, i.color].join(' ').toLowerCase().includes(q)); }
  selected(item: CartItem) { return this.lines().find(line => line.item.variant_id === item.variant_id) || { item, quantity: 0 }; }
  total() { return this.lines().reduce((sum, line) => sum + Number(line.item.unit_price) * line.quantity, 0); }
  add(item: CartItem) { this.change(item, 1); }
  change(item: CartItem, delta: number) {
    const old = this.selected(item); const next = old.quantity + delta;
    if (next < 0 || next > item.available) return;
    this.lines.update(lines => next === 0 ? lines.filter(line => line.item.variant_id !== item.variant_id) : [...lines.filter(line => line.item.variant_id !== item.variant_id), { item, quantity: next }]);
  }
  async loadBranch() {
    this.items.set([]); this.lines.set([]); this.cashPoints.set([]); this.cashPoint = ''; if (!this.branch) return;
    this.busy.set(true); this.error.set('');
    try { const [points, stock] = await Promise.all([this.api.get<CashPoint[]>('/admin/cash-points', { branch_id: this.branch }), this.api.get<CartItem[]>('/admin/pos/stock', { branch_id: this.branch })]); this.cashPoints.set(points); this.items.set(stock); }
    catch (e) { this.error.set(errorMessage(e)); } finally { this.busy.set(false); }
  }
  async complete() {
    if (!this.branch || !this.cashPoint || this.customerName.trim().length < 2 || this.reference.trim().length < 3 || !this.received) { this.error.set('Completá sucursal, caja, cliente, referencia y la confirmación de cobro.'); return; }
    this.busy.set(true); this.error.set(''); this.message.set('');
    try {
      const order = await this.api.write<Order & { idempotent_replay?: boolean }>('POST', '/admin/pos/sales', { client_request_id: crypto.randomUUID(), branch_id: this.branch, cash_point_id: this.cashPoint, customer_name: this.customerName.trim(), customer_email: this.customerEmail.trim() || undefined, payment_method: this.paymentMethod, payment_reference: this.reference.trim(), payment_received: true, items: this.lines().map(line => ({ variant_id: line.item.variant_id, quantity: line.quantity })) });
      this.message.set('Venta ' + order.number + ' registrada y entregada.'); this.lines.set([]); this.reference = ''; this.received = false; await this.loadBranch();
      const receipt = await firstValueFrom(this.http.get(environment.apiUrl + '/commerce/admin/orders/' + order.id + '/receipt', { responseType: 'blob' }));
      const url = URL.createObjectURL(receipt); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { this.error.set(errorMessage(e)); } finally { this.busy.set(false); }
  }
}
