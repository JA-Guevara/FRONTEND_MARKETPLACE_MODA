import { DialogFocusDirective } from '../../../shared/dialog-focus.directive';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { SessionService } from '../../auth/application/session.service';
import { Field } from '../../../shared/form-schema';
import { EntityFormComponent } from '../../../shared/entity-form.component';
import { ImageFormComponent } from '../../../shared/image-form.component';
import { Entity, Product } from '../domain/catalog.models';
import { errorMessage } from '../../../shared/errors';
import { lookup } from '../application/resources';
@Component({
  selector: 'fs-product-editor',
  imports: [RouterLink, FormsModule, EntityFormComponent, ImageFormComponent, DialogFocusDirective],
  template: `
    <a routerLink="/admin/products" class="back-link">← Todas las prendas</a>
    <div class="page-heading">
      <div>
        <p class="eyebrow">CATÁLOGO / DETALLE</p>
        <h1>{{ product()?.name || 'Prenda' }}</h1>
        <p class="muted">Variantes, imágenes, probador virtual y proveedores</p>
      </div>
      <button (click)="load()">Actualizar</button>
    </div>
    @if (error()) {
      <div class="alert error" role="alert">{{ error() }}</div>
    }
    @if (message()) {
      <div class="alert success" role="status">{{ message() }}</div>
    }
    @if (product(); as p) {
      <nav class="tabs" aria-label="Recursos de la prenda">
        @for (tab of tabs; track tab.key) {
          <button [class.selected]="section === tab.key" (click)="section = tab.key">
            {{ tab.label }}
          </button>
        }
      </nav>
      <div class="panel">
        <div class="page-heading">
          <h2>{{ sectionTitle() }}</h2>
          @if (canWrite() && !p['deleted_at'] && section !== 'ar-assets') {
            <button class="primary" (click)="open()">+ Agregar {{ singular() }}</button>
          }
        </div>
        @if (section === 'suppliers') {
          <p class="muted">La lista se guarda completa. Solo un proveedor puede ser principal.</p>
        }
        @if (section === 'ar-assets') {
            <p class="muted">
              Esta es la única configuración necesaria: el sistema toma la imagen principal del catálogo,
              la prepara para cada color y muestra una vista previa antes de habilitarla en cámara.
              No cargues un recurso AR manual ni un modelo 3D.
            </p>
            <div class="prepare-tryon">
              <p>
                <strong>1. Elegí el color. 2. Prepará la imagen. 3. Revisá el resultado.</strong>
                Se usa la foto principal de esta prenda; se quita el fondo, se calculan los anclajes
                y se genera la imagen transparente que verá el cliente.
              </p>
              <label>Color de la foto<select [(ngModel)]="colorProbador" [disabled]="preparando()">
                <option value="">Seleccioná un color</option>
                @for (color of coloresProbador(); track color.id) { <option [value]="color.id">{{ color.name }}</option> }
              </select></label>
              <button type="button" (click)="prepararProbador()" [disabled]="preparando() || !colorProbador">
                {{ preparando() ? 'Preparando…' : 'Preparar desde la foto' }}
              </button>
              @if (prepararMensaje()) {
                <p class="alert" role="status">{{ prepararMensaje() }}</p>
              }
              @for (recurso of tryOnAssets(); track recurso.id) {
                <article class="tryon-result" [class.failed]="recurso['ai_status'] === 'failed'">
                  @if (recurso['transparent_url']) { <img [src]="recurso['transparent_url']" alt="Recorte preparado" /> }
                  <div><strong>{{ colorNombre(recurso['color_id']) }}</strong><p>Estado: {{ estadoProbador(recurso['ai_status']) }}</p><small>{{ recurso['ai_error'] || 'Fondo retirado y recurso disponible.' }}</small></div>
                </article>
              }
            </div>
          }
          @if (section === 'images') {
          <div class="image-gallery" aria-label="Galería de la prenda">
            @for (item of rows(); track item.id) {
              <article class="image-card">
                <img [src]="item['url']" [alt]="item['alt_text'] || p.name" loading="lazy" />
                <div>
                  <span class="badge">{{ item['is_primary'] ? 'Principal' : 'Secundaria' }}</span>
                  <p>{{ item['alt_text'] || 'Sin descripción' }}</p>
                  <small>Orden {{ item['sort_order'] }}</small>
                  <div class="row-actions">
                    <a [href]="item['url']" target="_blank" rel="noopener noreferrer">Ver imagen ↗</a>
                    @if (canWrite() && !p['deleted_at']) {
                      <button class="danger-text" (click)="pending = item">Eliminar</button>
                    }
                  </div>
                </div>
              </article>
            } @empty {
              <p class="empty">Agregá una imagen desde una URL o desde tu dispositivo.</p>
            }
          </div>
        }
        <div class="table-wrap" [hidden]="section === 'images' || section === 'ar-assets'">
          <table>
            <thead>
              <tr>
                <th>{{ sectionTitle() }}</th>
                <th>Información</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (item of rows(); track item.id || item['supplier_id']) {
                <tr>
                  <td>
                    @switch (section) {
                      @case ('variants') {
                        <strong>{{ item['sku'] }}</strong>
                        <p>{{ item['size']['name'] }} · {{ item['color']['name'] }}</p>
                      }
                      @case ('images') {
                        <img
                          class="table-image"
                          [src]="item['url']"
                          [alt]="item['alt_text'] || p.name"
                        />
                      }
                      @case ('ar-assets') {
                        <strong>{{ item['asset_type'] }}</strong>
                        <p>{{ item['asset_url'] }}</p>
                      }
                      @case ('suppliers') {
                        <strong>{{ supplierName(item['supplier_id']) }}</strong>
                      }
                    }
                  </td>
                  <td>
                    @switch (section) {
                      @case ('variants') {
                        <p>Precio: Bs {{ item['price_override'] ?? p.base_price }}</p>
                        <span class="badge" [class.inactive]="!item['is_active']">{{
                          item['is_active'] ? 'Activa' : 'Inactiva'
                        }}</span>
                        <p>Código de barras: {{ item['barcode'] || '—' }}</p>
                      }
                      @case ('images') {
                        <p>{{ item['alt_text'] || 'Sin descripción' }}</p>
                        <p>
                          {{ item['is_primary'] ? 'Imagen principal' : 'Secundaria' }} · Orden
                          {{ item['sort_order'] }}
                        </p>
                        <a [href]="item['url']" target="_blank" rel="noopener noreferrer"
                          >Abrir imagen ↗</a
                        >
                      }
                      @case ('ar-assets') {
                        <span class="badge" [class.inactive]="!item['is_active']">{{
                          item['is_active'] ? 'Activo (en uso por el probador)' : 'Inactivo'
                        }}</span>
                        <a [href]="item['asset_url']" target="_blank" rel="noopener noreferrer"
                          >Abrir recurso ↗</a
                        >
                      }
                      @case ('suppliers') {
                        <p>SKU: {{ item['supplier_sku'] || '—' }}</p>
                        <p>Costo: {{ item['unit_cost'] ?? '—' }}</p>
                        <span class="badge">{{
                          item['is_primary'] ? 'Principal' : 'Alternativo'
                        }}</span>
                      }
                    }
                  </td>
                  <td>
                    @if (canWrite() && !p['deleted_at']) {
                      <div class="row-actions">
                        @if (section === 'variants' || section === 'suppliers' || section === 'ar-assets') {
                          <button (click)="open(item)">Editar</button>
                        }
                        @if (
                          section === 'ar-assets' &&
                          item['asset_type'] === 'image_overlay' &&
                          item['is_active']
                        ) {
                          <a [routerLink]="'/prendas/' + p['slug'] + '/vestidor'">Ver probador ↗</a>
                        }
                        <button class="danger-text" (click)="pending = item">Eliminar</button>
                      </div>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3">
                    <div class="empty">Todavía no hay {{ sectionTitle().toLowerCase() }}.</div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
    @if (editing()) {
      <div class="modal-backdrop">
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resource-title"
          (dismissed)="!busy() && editing.set(false)"
        >
          <h2 id="resource-title">{{ current ? 'Editar' : 'Agregar' }} {{ singular() }}</h2>
          @if (formError()) {
            <p class="alert error" role="alert">{{ formError() }}</p>
          }
          @if (section === 'images' && !current) {
            <fs-image-form [busy]="busy()" (saved)="save($event)" (cancel)="editing.set(false)" />
          } @else {
          <fs-entity-form
            [fields]="fields"
            [value]="current"
            [busy]="busy()"
            (saved)="save($event)"
              (cancel)="editing.set(false)"
            />
          }
        </section>
      </div>
    }
    @if (pending) {
      <div class="modal-backdrop">
        <section
          class="modal small"
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirmar eliminación"
          (dismissed)="!busy() && (pending = null)"
        >
          <h2>Eliminar {{ singular() }}</h2>
          <p>Se quitará este recurso de la prenda.</p>
          @if (formError()) {
            <p class="alert error">{{ formError() }}</p>
          }
          <div class="form-actions">
            <button class="primary" [disabled]="busy()" (click)="remove()">Confirmar</button
            ><button [disabled]="busy()" (click)="pending = null; formError.set('')">
              Cancelar
            </button>
          </div>
        </section>
      </div>
    }
  `,
})
export class ProductEditorComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  session = inject(SessionService);
  product = signal<Product | null>(null);
  suppliers = signal<Entity[]>([]);
  error = signal('');
  message = signal('');
  formError = signal('');
  busy = signal(false);
  editing = signal(false);
  preparando = signal(false);
  prepararMensaje = signal('');
  tryOnAssets = signal<Entity[]>([]);
  colorProbador = '';
  section = this.route.snapshot.queryParamMap.get('seccion') === 'probador' ? 'ar-assets' : 'variants';
  current: Entity | null = null;
  pending: Entity | null = null;
  fields: Field[] = [];
  tabs = [
    { key: 'variants', label: 'Variantes' },
    { key: 'images', label: 'Imágenes' },
    { key: 'ar-assets', label: 'Preparar probador' },
    { key: 'suppliers', label: 'Proveedores' },
  ];
  private get path() {
    return '/catalog/admin/products/' + this.route.snapshot.paramMap.get('id');
  }
  constructor() {
    void this.load();
  }
  canWrite() {
    return this.session.can('catalog.write');
  }
  async load() {
    this.error.set('');
    try {
      const product = await firstValueFrom(this.api.get<Product>(this.path));
      this.product.set(product);
      const colors = this.coloresProbador();
      if (!this.colorProbador && colors.length === 1) this.colorProbador = colors[0].id;
      if (this.session.can('catalog.read')) {
        try {
          this.tryOnAssets.set(
            await firstValueFrom(this.api.get<Entity[]>(`/vestidor/admin/products/${product.id}/assets`)),
          );
        } catch {
          // La prenda debe seguir siendo editable cuando aún no existe un recurso preparado.
          this.tryOnAssets.set([]);
        }
      }
      if (this.session.can('suppliers.read'))
        this.suppliers.set(
          await firstValueFrom(
            this.api.get<Entity[]>('/organization/suppliers', {
              include_inactive: true,
              include_deleted: true,
            }),
          ),
        );
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
  rows() {
    return this.product()?.[this.section === 'ar-assets' ? 'ar_assets' : this.section] || [];
  }
  coloresProbador() {
    const encontrados = new Map<string, { id: string; name: string }>();
    for (const variant of this.product()?.variants || []) {
      const color = variant['color'] as { id?: string; name?: string } | undefined;
      if (color?.id) encontrados.set(color.id, { id: color.id, name: color.name || 'Color sin nombre' });
    }
    return [...encontrados.values()];
  }
  colorNombre(id: string) {
    return this.coloresProbador().find((color) => color.id === id)?.name || 'Color';
  }
  estadoProbador(status: unknown) {
    return ({ ready: 'Listo para el vestidor', manual: 'Ajustado manualmente', failed: 'Necesita otra foto', pending: 'Pendiente' } as Record<string, string>)[String(status)] || String(status);
  }
  sectionTitle() {
    return this.tabs.find((t) => t.key === this.section)?.label || '';
  }
  singular() {
    return (
      {
        variants: 'variante',
        images: 'imagen',
        'ar-assets': 'recurso del probador',
        suppliers: 'proveedor',
      } as Record<string, string>
    )[this.section];
  }
  supplierName(id: string) {
    return this.suppliers().find((s) => s.id === id)?.['business_name'] || id;
  }
  open(item: Entity | null = null) {
    this.current = item;
    this.formError.set('');
    const defs: Record<string, Field[]> = {
      variants: [
        lookup('size_id', 'Talla', '/catalog/admin/sizes', true),
        lookup('color_id', 'Color', '/catalog/admin/colors', true),
        { key: 'sku', label: 'SKU', required: true, minLength: 2, maxLength: 80 },
        { key: 'barcode', label: 'Código de barras', maxLength: 80 },
        {
          key: 'price_override',
          label: 'Precio alternativo (Bs)',
          type: 'number',
          min: 0,
          hint: 'Vacío para usar el precio base.',
        },
        ...(item
          ? [{ key: 'is_active', label: 'Variante activa', type: 'checkbox' as const }]
          : []),
      ],
      images: [
        {
          key: 'url',
          label: 'URL de la imagen',
          type: 'url',
          required: true,
          hint: 'Enlace público HTTPS a la imagen; el backend actual recibe URLs.',
        },
        { key: 'alt_text', label: 'Descripción de la imagen', maxLength: 255 },
        { key: 'sort_order', label: 'Orden', type: 'number', min: 0, default: 0 },
        { key: 'is_primary', label: 'Imagen principal', type: 'checkbox' },
      ],
      suppliers: [
        {
          ...lookup('supplier_id', 'Proveedor', '/organization/suppliers', true),
          lookupLabel: 'business_name',
        },
        { key: 'supplier_sku', label: 'SKU del proveedor', maxLength: 100 },
        { key: 'unit_cost', label: 'Costo unitario (Bs)', type: 'number', min: 0 },
        { key: 'is_primary', label: 'Proveedor principal', type: 'checkbox' },
      ],
    };
    this.fields = defs[this.section];
    this.editing.set(true);
  }
  private supplierPayload(replacement?: Record<string, unknown>, remove?: Entity) {
    const list = (this.product()?.suppliers || [])
      .filter((s) => s.id !== remove?.id && s.id !== this.current?.id)
      .map((s) => ({
        supplier_id: s['supplier_id'],
        supplier_sku: s['supplier_sku'],
        unit_cost: s['unit_cost'],
        is_primary: s['is_primary'],
      }));
    if (replacement) list.push(replacement as (typeof list)[number]);
    if (new Set(list.map((s) => s.supplier_id)).size !== list.length)
      throw new Error('El proveedor ya está asociado a esta prenda.');
    if (list.filter((s) => s.is_primary).length > 1)
      throw new Error('Solo un proveedor puede ser principal. Editá primero el proveedor actual.');
    return { suppliers: list };
  }
  /**
   * Dispara la preparación automática del recurso del probador.
   *
   * El servidor recorta el fondo de la foto principal y calcula los anclajes.
   * Un recorte que falla NO deja el recurso listo: el probador cae al dibujo en
   * vez de mostrar la foto con su fondo.
   */
  async prepararProbador() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || !this.colorProbador || this.preparando()) return;
    this.preparando.set(true);
    this.prepararMensaje.set('');
    try {
      const recurso = await firstValueFrom(
        this.api.write<{ ai_status?: string; ai_error?: string }>(
          'POST',
          `/vestidor/admin/products/${id}/assets`,
          { color_id: this.colorProbador },
        ),
      );
      const datos = recurso.data;
      this.prepararMensaje.set(
        datos?.ai_status === 'ready'
          ? 'Recurso preparado. La prenda ya se prueba con su foto real.'
          : datos?.ai_error || 'No se pudo recortar el fondo; el probador sigue con el dibujo.',
      );
      await this.load();
    } catch (e) {
      this.prepararMensaje.set(errorMessage(e));
    } finally {
      this.preparando.set(false);
    }
  }

  async save(body: Record<string, unknown>) {
    if (this.busy() || !this.canWrite()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      const path =
        this.path +
        '/' +
        this.section +
        (this.current && (this.section === 'variants' || this.section === 'ar-assets')
          ? '/' + this.current.id
          : '');
      const payload = this.section === 'suppliers' ? this.supplierPayload(body) : body;
      const r = await firstValueFrom(
        this.api.write<Product>(
          this.section === 'suppliers' ? 'PUT' : this.current ? 'PATCH' : 'POST',
          path,
          payload,
        ),
      );
      this.product.set(r.data);
      this.message.set(r.message);
      this.editing.set(false);
      await this.load();
    } catch (e) {
      this.formError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async remove() {
    if (!this.pending || this.busy() || !this.canWrite()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      this.current = null;
      const r = await firstValueFrom(
        this.api.write<Product>(
          this.section === 'suppliers' ? 'PUT' : 'DELETE',
          this.path +
            '/' +
            this.section +
            (this.section === 'suppliers' ? '' : '/' + this.pending.id),
          this.section === 'suppliers' ? this.supplierPayload(undefined, this.pending) : undefined,
        ),
      );
      this.product.set(r.data);
      this.message.set(r.message);
      this.pending = null;
      await this.load();
    } catch (e) {
      this.formError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
