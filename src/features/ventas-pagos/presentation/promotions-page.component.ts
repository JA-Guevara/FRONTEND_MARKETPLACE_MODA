import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EngagementService, Promotion, PromotionPreview } from '../infrastructure/engagement.service';
import { ApiService } from '../../../app/core/shared/api.service';
import { Entity, Page, Product } from '../../../shared/models';
import { IconComponent } from '../../../shared/icon.component';
import { errorMessage } from '../../../shared/errors';
import { estadoOferta } from '../domain/ofertas.models';

type Draft = {
  name: string;
  code: string;
  description: string;
  discount_type: 'percent' | 'fixed' | 'clearance' | 'free_shipping';
  discount_value: number;
  minimum_order: number;
  scope: 'all' | 'frequent';
  target: 'all' | 'category' | 'product';
  target_id: string;
  applies_online: boolean;
  applies_pos: boolean;
  applies_offline: boolean;
  starts_at: string;
  ends_at: string;
  max_uses: string;
  per_user_limit: string;
  is_active: boolean;
};

const blank = (): Draft => ({
  name: '',
  code: '',
  description: '',
  discount_type: 'percent',
  discount_value: 10,
  minimum_order: 0,
  scope: 'all',
  target: 'all',
  target_id: '',
  applies_online: true,
  applies_pos: true,
  applies_offline: true,
  starts_at: '',
  ends_at: '',
  max_uses: '',
  per_user_limit: '',
  is_active: true,
});

@Component({
  selector: 'fs-promotions-page',
  imports: [FormsModule, IconComponent],
  styleUrl: './commerce.scss',
  template: `
    <section class="commerce-page">
      <p class="eyebrow">GESTIÓN COMERCIAL</p>
      <h1>Ofertas, descuentos y promociones</h1>
      <p class="muted">
        Reglas de precio unificadas para tienda web, punto de venta y ventas sin conexión.
        Las promociones automáticas compiten por el mejor beneficio para el cliente; los cupones requieren código explícito.
      </p>

      @if (error()) {
        <div class="alert error">
          <p>{{ error() }}</p>
          <button type="button" (click)="load()" [disabled]="loading()">Reintentar carga</button>
        </div>
      }

      <div class="commerce-grid promotion-layout">
        <!-- Formulario de creación / edición -->
        <form class="checkout-summary" #form="ngForm" (ngSubmit)="form.valid && save()">
          <h2>{{ editing() ? 'Editar oferta' : 'Nueva oferta o campaña' }}</h2>
          <div class="commerce-fields">
            <label class="wide">
              Nombre de la oferta
              <input name="name" [(ngModel)]="draft.name" required maxlength="160" placeholder="Ej. Liquidación de verano 30%" />
            </label>
            <label>
              Código de cupón (opcional)
              <input name="code" [(ngModel)]="draft.code" maxlength="50" placeholder="VERANO30 (vacío = automática)" />
            </label>
            <label>
              Tipo de descuento
              <select name="type" [(ngModel)]="draft.discount_type">
                <option value="percent">Porcentaje (%)</option>
                <option value="fixed">Monto fijo (BOB)</option>
                <option value="clearance">Liquidación (precio fijo)</option>
                <option value="free_shipping">Envío gratis</option>
              </select>
            </label>
            @if (draft.discount_type !== 'free_shipping') {
              <label>
                {{ draft.discount_type === 'clearance' ? 'Precio liquidación (BOB)' : 'Valor del descuento' }}
                <input
                  name="value"
                  [(ngModel)]="draft.discount_value"
                  type="number"
                  min="0.01"
                  [max]="draft.discount_type === 'percent' ? 100 : 1000000"
                  required
                />
              </label>
            }
            <label>
              Monto mínimo de compra (BOB)
              <input name="minimum" [(ngModel)]="draft.minimum_order" type="number" min="0" required />
            </label>
            <label>
              Segmento de cliente
              <select name="scope" [(ngModel)]="draft.scope">
                <option value="all">Cualquier cliente</option>
                <option value="frequent">Cliente frecuente (mínimo 2 compras)</option>
              </select>
            </label>
            <label>
              Alcance de productos
              <select name="target" [(ngModel)]="draft.target" (ngModelChange)="draft.target_id=''">
                <option value="all">Todo el catálogo</option>
                <option value="category">Una categoría</option>
                <option value="product">Una prenda específica</option>
              </select>
            </label>
            @if (draft.target === 'category') {
              <label class="wide">
                Categoría objetivo
                <select name="targetId" [(ngModel)]="draft.target_id" required>
                  <option value="">Seleccioná una categoría</option>
                  @for (cat of categories(); track cat.id) {
                    <option [value]="cat.id">{{ cat['name'] }}</option>
                  }
                </select>
              </label>
            }
            @if (draft.target === 'product') {
              <label class="wide">
                Prenda objetivo
                <select name="targetId" [(ngModel)]="draft.target_id" required>
                  <option value="">Seleccioná una prenda</option>
                  @for (prod of products(); track prod.id) {
                    <option [value]="prod.id">{{ prod.name }}</option>
                  }
                </select>
              </label>
            }
            <div class="wide" style="display: flex; gap: 1rem; align-items: center; margin: 0.5rem 0;">
              <strong>Canales de venta:</strong>
              <label class="check"><input type="checkbox" name="ch_online" [(ngModel)]="draft.applies_online" /> Web</label>
              <label class="check"><input type="checkbox" name="ch_pos" [(ngModel)]="draft.applies_pos" /> Caja (POS)</label>
              <label class="check"><input type="checkbox" name="ch_offline" [(ngModel)]="draft.applies_offline" /> Sin conexión</label>
            </div>
            <label>
              Fecha inicio
              <input name="starts" [(ngModel)]="draft.starts_at" type="datetime-local" />
            </label>
            <label>
              Fecha fin
              <input name="ends" [(ngModel)]="draft.ends_at" type="datetime-local" />
            </label>
            <label>
              Usos totales permitidos
              <input name="uses" [(ngModel)]="draft.max_uses" type="number" min="1" placeholder="Sin límite" />
            </label>
            <label>
              Límite por cliente
              <input name="perUser" [(ngModel)]="draft.per_user_limit" type="number" min="1" placeholder="Sin límite" />
            </label>
            <label class="wide">
              Descripción interna
              <input name="description" [(ngModel)]="draft.description" maxlength="500" placeholder="Motivo o campaña" />
            </label>
          </div>

          <label class="check">
            <input name="active" [(ngModel)]="draft.is_active" type="checkbox" /> Oferta activa
          </label>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem;">
            <button type="submit" class="primary" [disabled]="busy()">
              <fs-icon name="save" />
              {{ busy() ? 'Guardando…' : editing() ? 'Actualizar oferta' : 'Crear oferta' }}
            </button>
            <button type="button" (click)="preview()" [disabled]="busy() || !draft.name">
              <fs-icon name="search" /> Previsualizar impacto
            </button>
            @if (editing()) {
              <button type="button" (click)="cancel()">Cancelar</button>
            }
          </div>
        </form>

        <!-- Lista de ofertas registradas -->
        <div>
          <h2>Campañas y ofertas configuradas</h2>
          @if (loading()) {
            <p>Cargando ofertas…</p>
          }

          @if (previewResult(); as prev) {
            <div class="commerce-card" style="border-left: 4px solid var(--primary, #1e40af); margin-bottom: 1rem;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3>Previsualización de precios</h3>
                <button type="button" (click)="previewResult.set(null)">Cerrar</button>
              </div>
              @if (prev.errors.length > 0) {
                <p class="alert error">{{ prev.errors.join(', ') }}</p>
              }
              <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
                <thead>
                  <tr style="text-align: left; border-bottom: 1px solid #ccc;">
                    <th>Prenda</th><th>Regular</th><th>Final</th><th>Ahorro</th>
                  </tr>
                </thead>
                <tbody>
                  @for (it of prev.items; track it.variant_id) {
                    <tr>
                      <td>{{ it.product_name }}</td>
                      <td>BOB {{ it.regular }}</td>
                      <td><strong>BOB {{ it.final }}</strong></td>
                      <td style="color: green;">- BOB {{ it.discount_applied }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" class="muted">No hay prendas que coincidan con los filtros seleccionados.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @for (row of promotions(); track row.id) {
            <article class="commerce-card promotion-card">
              <div>
                <strong>{{ row.name }}</strong>
                <p>
                  {{ row.code ? 'Cupón: ' + row.code : 'Automática' }} · {{ label(row) }}
                </p>
                <small>
                  Estado: <strong>{{ estadoTexto(row) }}</strong> ·
                  Canales:
                  {{ canalesTexto(row) }}
                  · {{ row.uses_count }} uso(s){{ row.max_uses ? ' de ' + row.max_uses : '' }}
                </small>
              </div>
              <div style="display: flex; gap: 0.25rem;">
                @if (row.is_active) {
                  <button type="button" (click)="toggleActive(row, false)" [disabled]="busy()" title="Pausar oferta">
                    Pausar
                  </button>
                } @else {
                  <button type="button" class="primary" (click)="toggleActive(row, true)" [disabled]="busy()" title="Activar oferta">
                    Activar
                  </button>
                }
                <button type="button" (click)="edit(row)">
                  <fs-icon name="edit" /> Editar
                </button>
              </div>
            </article>
          } @empty {
            @if (!loading()) {
              <div class="empty-state">No hay ofertas ni promociones configuradas.</div>
            }
          }
        </div>
      </div>
    </section>
  `,
})
export class PromotionsPageComponent {
  private api = inject(EngagementService);
  private http = inject(ApiService);

  promotions = signal<Promotion[]>([]);
  categories = signal<Entity[]>([]);
  products = signal<Product[]>([]);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  editing = signal<string | null>(null);
  previewResult = signal<PromotionPreview | null>(null);
  draft: Draft = blank();

  constructor() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    const [promotions, categories, products] = await Promise.allSettled([
      this.api.promotions(),
      firstValueFrom(this.http.get<Entity[]>('/catalog/categories')),
      firstValueFrom(this.http.get<Page<Product>>('/catalog/products', { page_size: 100 })),
    ]);

    if (promotions.status === 'fulfilled') {
      this.promotions.set(promotions.value);
    } else {
      this.error.set('No se pudieron cargar las campañas. ' + errorMessage(promotions.reason));
    }

    if (categories.status === 'fulfilled') {
      this.categories.set(categories.value);
    } else if (!this.error()) {
      this.error.set('No se pudieron cargar las categorías. ' + errorMessage(categories.reason));
    }

    if (products.status === 'fulfilled') {
      this.products.set(products.value.items);
    } else if (!this.error()) {
      this.error.set('No se pudieron cargar las prendas. ' + errorMessage(products.reason));
    }

    this.loading.set(false);
  }

  canalesTexto(row: Promotion): string {
    const list: string[] = [];
    if (row.applies_online) list.push('Web');
    if (row.applies_pos) list.push('POS');
    if (row.applies_offline) list.push('Offline');
    return list.join(', ') || 'Ninguno';
  }

  estadoTexto(row: Promotion): string {
    const estado = estadoOferta({
      ...row,
      discount_type: row.discount_type,
      discount_value: row.discount_value,
      minimum_order: row.minimum_order,
      customer_scope: row.customer_scope,
      applies_online: row.applies_online ?? true,
      applies_pos: row.applies_pos ?? true,
      applies_offline: row.applies_offline ?? true,
      targets: row.targets?.map((t) => ({ target_type: t.target_type as any, target_id: t.target_id })),
    });
    switch (estado) {
      case 'vigente':
        return 'Vigente';
      case 'programada':
        return 'Programada';
      case 'vencida':
        return 'Vencida';
      case 'agotada':
        return 'Agotada';
      case 'pausada':
      default:
        return 'Pausada';
    }
  }

  label(row: Promotion) {
    if (row.discount_type === 'percent') return `${row.discount_value}% de descuento`;
    if (row.discount_type === 'fixed') return `BOB ${row.discount_value} de descuento`;
    if (row.discount_type === 'clearance') return `Liquidación a BOB ${row.discount_value}`;
    return 'Envío gratis';
  }

  edit(row: Promotion) {
    this.editing.set(row.id);
    this.draft = {
      name: row.name,
      code: row.code || '',
      description: row.description || '',
      discount_type: row.discount_type,
      discount_value: Number(row.discount_value),
      minimum_order: Number(row.minimum_order),
      scope: row.customer_scope,
      target: row.category_id ? 'category' : row.product_id ? 'product' : 'all',
      target_id: row.category_id || row.product_id || '',
      applies_online: row.applies_online ?? true,
      applies_pos: row.applies_pos ?? true,
      applies_offline: row.applies_offline ?? true,
      starts_at: row.starts_at?.slice(0, 16) || '',
      ends_at: row.ends_at?.slice(0, 16) || '',
      max_uses: row.max_uses?.toString() || '',
      per_user_limit: row.per_user_limit?.toString() || '',
      is_active: row.is_active,
    };
  }

  cancel() {
    this.editing.set(null);
    this.draft = blank();
    this.previewResult.set(null);
  }

  body() {
    const targets = [];
    if (this.draft.target === 'category' && this.draft.target_id) {
      targets.push({ target_type: 'CATEGORY', target_id: this.draft.target_id });
    } else if (this.draft.target === 'product' && this.draft.target_id) {
      targets.push({ target_type: 'PRODUCT', target_id: this.draft.target_id });
    } else {
      targets.push({ target_type: 'ALL', target_id: null });
    }

    return {
      name: this.draft.name,
      code: this.draft.code || null,
      description: this.draft.description || null,
      discount_type: this.draft.discount_type,
      discount_value: this.draft.discount_type === 'free_shipping' ? 0 : this.draft.discount_value,
      minimum_order: this.draft.minimum_order,
      customer_scope: this.draft.scope,
      minimum_paid_orders: this.draft.scope === 'frequent' ? 2 : 0,
      category_id: this.draft.target === 'category' ? this.draft.target_id || null : null,
      product_id: this.draft.target === 'product' ? this.draft.target_id || null : null,
      applies_online: this.draft.applies_online,
      applies_pos: this.draft.applies_pos,
      applies_offline: this.draft.applies_offline,
      starts_at: this.draft.starts_at || null,
      ends_at: this.draft.ends_at || null,
      max_uses: this.draft.max_uses ? Number(this.draft.max_uses) : null,
      per_user_limit: this.draft.per_user_limit ? Number(this.draft.per_user_limit) : null,
      is_active: this.draft.is_active,
      targets,
    };
  }

  async preview() {
    this.busy.set(true);
    try {
      const res = await this.api.previewPromotion(this.body());
      this.previewResult.set(res);
    } catch (e) {
      this.error.set('Error al previsualizar oferta: ' + errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async toggleActive(row: Promotion, activate: boolean) {
    this.busy.set(true);
    try {
      if (activate) {
        await this.api.activatePromotion(row.id);
      } else {
        await this.api.deactivatePromotion(row.id, 'Pausada desde el panel');
      }
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async save() {
    this.busy.set(true);
    this.error.set('');
    try {
      const id = this.editing();
      if (id) {
        await this.api.updatePromotion(id, this.body());
      } else {
        await this.api.createPromotion(this.body());
      }
      this.cancel();
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
