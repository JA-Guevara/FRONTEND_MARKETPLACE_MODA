import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EngagementService, Promotion } from '../infrastructure/engagement.service';
import { ApiService } from '../../../app/core/shared/api.service';
import { Entity, Page, Product } from '../../../shared/models';
import { IconComponent } from '../../../shared/icon.component';
import { errorMessage } from '../../../shared/errors';

type Draft = {
  name: string; code: string; description: string; discount_type: 'percent'|'fixed'|'free_shipping';
  discount_value: number; minimum_order: number; scope: 'all'|'frequent'; target: 'all'|'category'|'product'; target_id: string;
  starts_at: string; ends_at: string; max_uses: string; per_user_limit: string; is_active: boolean;
};
const blank = (): Draft => ({ name:'', code:'', description:'', discount_type:'percent', discount_value:10, minimum_order:0, scope:'all', target:'all', target_id:'', starts_at:'', ends_at:'', max_uses:'', per_user_limit:'', is_active:true });

@Component({
  selector: 'fs-promotions-page', imports: [FormsModule, IconComponent], styleUrl: './commerce.scss',
  template: `<section class="commerce-page"><p class="eyebrow">GESTIÓN COMERCIAL</p><h1>Cupones y promociones</h1>
    <p class="muted">Un cupón tiene código y el cliente lo ingresa al comprar. Una promoción sin código se aplica sola cuando cumple sus condiciones. Envío gratis queda registrado como beneficio porque hoy la tienda no cobra flete por separado.</p>
    @if (error()) { <div class="alert error"><p>{{ error() }}</p><button type="button" (click)="load()" [disabled]="loading()">Reintentar carga</button></div> }
    <div class="commerce-grid promotion-layout"><form class="checkout-summary" #form="ngForm" (ngSubmit)="form.valid && save()">
      <h2>{{ editing() ? 'Editar campaña' : 'Nueva campaña' }}</h2>
      <div class="commerce-fields">
        <label class="wide">Nombre<input name="name" [(ngModel)]="draft.name" required maxlength="160" placeholder="Ej. Cambio de temporada" /></label>
        <label>Código opcional<input name="code" [(ngModel)]="draft.code" maxlength="50" placeholder="VERANO15" /></label>
        <label>Tipo<select name="type" [(ngModel)]="draft.discount_type"><option value="percent">Porcentaje</option><option value="fixed">Importe fijo (BOB)</option><option value="free_shipping">Envío gratis</option></select></label>
        @if (draft.discount_type !== 'free_shipping') { <label>Descuento<input name="value" [(ngModel)]="draft.discount_value" type="number" min="0.01" [max]="draft.discount_type === 'percent' ? 100 : 1000000" required /></label> }
        <label>Monto mínimo (BOB)<input name="minimum" [(ngModel)]="draft.minimum_order" type="number" min="0" required /></label>
        <label>Cliente<select name="scope" [(ngModel)]="draft.scope"><option value="all">Cualquier cliente</option><option value="frequent">Cliente frecuente (2 compras pagadas)</option></select></label>
        <label>Aplicar a<select name="target" [(ngModel)]="draft.target" (ngModelChange)="draft.target_id=''"><option value="all">Todo el carrito</option><option value="category">Una categoría</option><option value="product">Una prenda</option></select></label>
        @if (draft.target === 'category') { <label class="wide">Categoría<select name="targetId" [(ngModel)]="draft.target_id" required><option value="">Seleccioná</option>@for (category of categories(); track category.id) {<option [value]="category.id">{{ category['name'] }}</option>}</select></label> }
        @if (draft.target === 'product') { <label class="wide">Prenda<select name="targetId" [(ngModel)]="draft.target_id" required><option value="">Seleccioná</option>@for (product of products(); track product.id) {<option [value]="product.id">{{ product.name }}</option>}</select></label> }
        <label>Desde<input name="starts" [(ngModel)]="draft.starts_at" type="datetime-local" /></label><label>Hasta<input name="ends" [(ngModel)]="draft.ends_at" type="datetime-local" /></label>
        <label>Usos totales<input name="uses" [(ngModel)]="draft.max_uses" type="number" min="1" placeholder="Sin límite" /></label><label>Usos por cliente<input name="perUser" [(ngModel)]="draft.per_user_limit" type="number" min="1" placeholder="Sin límite" /></label>
        <label class="wide">Descripción<input name="description" [(ngModel)]="draft.description" maxlength="500" placeholder="Texto interno para identificar la campaña" /></label>
      </div>
      <label class="check"><input name="active" [(ngModel)]="draft.is_active" type="checkbox" />Disponible</label>
      <button type="submit" class="primary" [disabled]="busy()"><fs-icon name="save" />{{ busy() ? 'Guardando…' : editing() ? 'Actualizar campaña' : 'Crear campaña' }}</button>
      @if (editing()) { <button type="button" (click)="cancel()">Cancelar edición</button> }
    </form>
    <div><h2>Campañas registradas</h2>@if (loading()) {<p>Cargando…</p>} @for (row of promotions(); track row.id) {<article class="commerce-card promotion-card"><div><strong>{{ row.name }}</strong><p>{{ row.code ? 'Cupón: ' + row.code : 'Automática' }} · {{ label(row) }}</p><small>{{ row.is_active ? 'Activa' : 'Pausada' }} · {{ row.uses_count }} uso(s){{ row.max_uses ? ' de ' + row.max_uses : '' }}</small></div><button type="button" (click)="edit(row)"><fs-icon name="edit" />Editar</button></article>} @empty { @if (!loading()) { <div class="empty-state">Todavía no hay campañas creadas.</div> } }</div>
    </div></section>`,
})
export class PromotionsPageComponent {
  private api = inject(EngagementService); private http = inject(ApiService);
  promotions = signal<Promotion[]>([]); categories = signal<Entity[]>([]); products = signal<Product[]>([]); loading = signal(true); busy = signal(false); error = signal(''); editing = signal<string | null>(null); draft: Draft = blank();
  constructor() { void this.load(); }
  async load() {
    this.loading.set(true); this.error.set('');
    const [promotions, categories, products] = await Promise.allSettled([
      this.api.promotions(),
      firstValueFrom(this.http.get<Entity[]>('/catalog/categories')),
      firstValueFrom(this.http.get<Page<Product>>('/catalog/products', { page_size: 100 })),
    ]);
    if (promotions.status === 'fulfilled') this.promotions.set(promotions.value);
    else this.error.set('No se pudieron cargar las campañas. ' + errorMessage(promotions.reason));
    if (categories.status === 'fulfilled') this.categories.set(categories.value);
    else if (!this.error()) this.error.set('No se pudieron cargar las categorías. ' + errorMessage(categories.reason));
    if (products.status === 'fulfilled') this.products.set(products.value.items);
    else if (!this.error()) this.error.set('No se pudieron cargar las prendas. ' + errorMessage(products.reason));
    this.loading.set(false);
  }
  label(row: Promotion) { return row.discount_type === 'percent' ? `${row.discount_value}% de descuento` : row.discount_type === 'fixed' ? `BOB ${row.discount_value} de descuento` : 'Envío gratis'; }
  edit(row: Promotion) { this.editing.set(row.id); this.draft = { name:row.name, code:row.code||'', description:row.description||'', discount_type:row.discount_type, discount_value:Number(row.discount_value), minimum_order:Number(row.minimum_order), scope:row.customer_scope, target:row.category_id?'category':row.product_id?'product':'all', target_id:row.category_id||row.product_id||'', starts_at:row.starts_at?.slice(0,16)||'', ends_at:row.ends_at?.slice(0,16)||'', max_uses:row.max_uses?.toString()||'', per_user_limit:row.per_user_limit?.toString()||'', is_active:row.is_active }; }
  cancel() { this.editing.set(null); this.draft = blank(); }
  body() { return { name:this.draft.name, code:this.draft.code||null, description:this.draft.description||null, discount_type:this.draft.discount_type, discount_value:this.draft.discount_type==='free_shipping'?0:this.draft.discount_value, minimum_order:this.draft.minimum_order, customer_scope:this.draft.scope, minimum_paid_orders:this.draft.scope==='frequent'?2:0, category_id:this.draft.target==='category'?this.draft.target_id||null:null, product_id:this.draft.target==='product'?this.draft.target_id||null:null, starts_at:this.draft.starts_at||null, ends_at:this.draft.ends_at||null, max_uses:this.draft.max_uses?Number(this.draft.max_uses):null, per_user_limit:this.draft.per_user_limit?Number(this.draft.per_user_limit):null, is_active:this.draft.is_active }; }
  async save() { this.busy.set(true); this.error.set(''); try { const id = this.editing(); if (id) await this.api.updatePromotion(id, this.body()); else await this.api.createPromotion(this.body()); this.cancel(); await this.load(); } catch(e) { this.error.set(errorMessage(e)); } finally { this.busy.set(false); } }
}
