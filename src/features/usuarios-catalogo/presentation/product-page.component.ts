import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommerceService } from '../../ventas-pagos/infrastructure/commerce.service';
import { CartStateService } from '../../ventas-pagos/application/cart-state.service';
import { SessionService } from '../../auth/application/session.service';
import { IconComponent } from '../../../shared/icon.component';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { CatalogService } from '../infrastructure/catalog.service';
import { Product, Entity, hasVestidor } from '../domain/catalog.models';
import { errorMessage } from '../../../shared/errors';
import { TryOnListService } from '../../reservas-vestidor/application/try-on-list.service';
import { EngagementService } from '../../ventas-pagos/infrastructure/engagement.service';
import {
  MAX_ITEM_QUANTITY,
  MIN_ITEM_QUANTITY,
} from '../../reservas-vestidor/domain/reservas.models';
@Component({
  selector: 'fs-product-page',
  imports: [RouterLink, DecimalPipe, IconComponent, FormsModule],
  template: `<section class="container section">
    <a class="back-link" routerLink="/">← Volver al catálogo</a>
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <p class="empty" role="status">Cargando prenda…</p>
    }
    @if (product(); as p) {
      <div class="product-detail">
        <div>
          <div class="detail-photo">
            @if (selectedImage()) {
              <img [src]="selectedImage()" [alt]="p.name" (error)="selectedImage.set('')" />
            } @else {
              <div class="image-placeholder">
                <span>F.</span><small>Imagen no disponible</small>
              </div>
            }
          </div>
          <div class="thumbnails">
            @for (img of p.images; track img.id) {
              <button
                (click)="selectedImage.set(img['url'])"
                [attr.aria-label]="img['alt_text'] || 'Ver imagen de ' + p.name"
              >
                <img [src]="img['url']" [alt]="img['alt_text'] || p.name" />
              </button>
            }
          </div>
          @if (p.images.length > 1) {
            <div class="gallery-controls" aria-label="Controles de imágenes">
              <button (click)="moveImage(-1)" aria-label="Imagen anterior">← Anterior</button>
              <span aria-live="polite">{{ imageIndex() + 1 }} / {{ p.images.length }}</span>
              <button (click)="moveImage(1)" aria-label="Imagen siguiente">Siguiente →</button>
            </div>
          }
        </div>
        <div>
          <p class="eyebrow">{{ p.category['name'] }} / {{ p.brand || 'FASHIONSTORE' }}</p>
          <h1>{{ p.name }}</h1>
          <p class="detail-price">
            Bs {{ variant()?.['price_override'] ?? p.base_price | number: '1.2-2' }}
          </p>
          <button type="button" (click)="toggleFavorite()" [disabled]="favoriteBusy()">
            <fs-icon name="heart" />{{ favorite() ? 'Guardada en favoritos' : 'Guardar en favoritos' }}
          </button>
          @if (favoriteMessage()) { <p class="muted">{{ favoriteMessage() }}</p> }
          <p class="description">{{ p.description }}</p>
          @if (p.collection) {
            <p>Colección: {{ p.collection['name'] }}</p>
          }
          @if (p.season) {
            <p>Temporada: {{ p.season['name'] }}</p>
          }
          <h3>Tallas y colores</h3>
          <div class="variant-list">
            @for (v of p.variants; track v.id) {
              <button [class.selected]="variant()?.id === v.id" (click)="selectVariant(v)">
                <span class="swatch" [style.background]="v['color']['hex_code']"></span
                >{{ v['size']['name'] }} · {{ v['color']['name'] }}
              </button>
            } @empty {
              <p class="muted">No hay variantes publicadas.</p>
            }
          </div>
          @if (variant()) {
            <p class="muted">SKU: {{ variant()!['sku'] }}</p>
          }
          <div class="fitting-access">
            <h3>Probador virtual</h3>
            @if (puedeProbar()) {
              <p class="muted">
                Activá tu cámara para ver una aproximación de cómo se ve la prenda. Nada se
                graba ni se envía al servidor. El permiso de cámara se pide cuando entrás.
              </p>
              <a
                class="button primary"
                [routerLink]="'/prendas/' + p.slug + '/vestidor'"
                [queryParams]="variant() ? { variante: variant()!.id } : undefined"
              >
                <fs-icon name="camera" />Probarme esta prenda
              </a>
              @if (session.can('catalog.write')) {
                <a
                  class="button"
                  [routerLink]="['/admin/products', p.id]"
                  [queryParams]="{ seccion: 'probador' }"
                  >Preparar imagen de referencia</a
                >
              }
            } @else {
              <p class="muted">Agregá al menos una talla y color para habilitar el probador.</p>
              @if (session.can('catalog.read')) {
                <a
                  class="button"
                  [routerLink]="['/admin/products', p.id]"
                  [queryParams]="{ seccion: 'probador' }"
                  >Preparar imágenes del probador</a
                >
              }
            }
          </div>
          <div class="form-actions">
            <button class="primary" [disabled]="!variant() || adding()" (click)="addToCart()">
              <fs-icon name="cart" />{{ adding() ? 'Agregando…' : 'Agregar al carrito' }}
            </button>
            <a class="button" routerLink="/carrito"><fs-icon name="cart" />Ver carrito</a>
          </div>
          <div class="form-actions">
            <label class="check"
              >Cantidad<input
                type="number"
                name="tryon-quantity"
                [(ngModel)]="tryOnQuantity"
                min="1"
                max="10"
                step="1"
                (ngModelChange)="tryOnMessage.set('')"
              /></label
            >
            <button [disabled]="!variant()" (click)="addToTryOn()">
              <fs-icon name="calendar" />Agregar a mi reserva
            </button>
          </div>
          @if (!variant()) {
            <p class="muted">Elegí una talla y un color para continuar.</p>
          }
          @if (cartMessage()) {
            <p class="alert success" role="status">{{ cartMessage() }}</p>
          }
          @if (cartError()) {
            <p class="alert error" role="alert">{{ cartError() }}</p>
          }
          @if (tryOnMessage()) {
            <p class="alert success" role="status">{{ tryOnMessage() }}</p>
            <div class="form-actions">
              <a class="button primary" routerLink="/reservar">
                <fs-icon name="calendar" />Revisar selección y reservar
              </a>
              <a class="button" routerLink="/">Seguir explorando</a>
            </div>
          }
          <div class="panel">
            <h3>Conocé nuestras sucursales</h3>
            <p>Consultá las ubicaciones y horarios de atención.</p>
            <a routerLink="/sucursales">Ver sucursales ↗</a>
          </div>
        </div>
      </div>
    }
  </section>`,
})
export class ProductPageComponent {
  private commerce = inject(CommerceService);
  private engagement = inject(EngagementService);
  private cartState = inject(CartStateService);
  session = inject(SessionService);
  private router = inject(Router);
  private tryOn = inject(TryOnListService);
  adding = signal(false);
  favorite = signal(false);
  favoriteBusy = signal(false);
  favoriteMessage = signal('');
  cartMessage = signal('');
  cartError = signal('');
  tryOnMessage = signal('');
  tryOnQuantity = MIN_ITEM_QUANTITY;
  /// Toda prenda con variantes activas puede abrir el espejo. La imagen
  /// preparada mejora la vista, pero ya no depende del viejo recurso AR manual.
  puedeProbar() {
    return hasVestidor(this.product() ?? { variants: [] });
  }
  selectVariant(v: Entity) {
    this.variant.set(v);
    this.tryOnMessage.set('');
    this.tryOnQuantity = MIN_ITEM_QUANTITY;
  }
  addToTryOn() {
    const p = this.product();
    const v = this.variant();
    if (!p || !v) return;
    const quantity = Math.min(
      Math.max(Math.floor(this.tryOnQuantity) || MIN_ITEM_QUANTITY, MIN_ITEM_QUANTITY),
      MAX_ITEM_QUANTITY,
    );
    const result = this.tryOn.add({
      variant_id: v.id,
      product_id: p.id,
      name: p.name,
      sku: v['sku'],
      size: v['size']['name'],
      color: v['color']['name'],
      image_url: this.selectedImage() || null,
      quantity,
    });
    if (result === 'limit_items')
      return this.tryOnMessage.set(
        'Ya tenés 20 prendas en tu selección. Revisá la lista o confirmá la reserva.',
      );
    if (result === 'limit_quantity')
      return this.tryOnMessage.set(
        'No podés agregar más de 10 unidades de la misma talla a una reserva.',
      );
    this.tryOnMessage.set(
      'Prenda añadida a tu selección. Elegí sucursal y horario para registrar la reserva.',
    );
  }
  async addToCart() {
    const selected = this.variant();
    if (!selected || this.adding()) return;
    if (!this.session.user()) {
      await this.router.navigate(['/iniciar-sesion'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }
    this.adding.set(true);
    this.cartError.set('');
    this.cartMessage.set('');
    try {
      await this.commerce.add(selected.id);
      await this.cartState.refresh();
      this.cartMessage.set(
        'Prenda agregada. Podés revisar la cantidad y disponibilidad en tu carrito.',
      );
    } catch (error) {
      this.cartError.set(errorMessage(error));
    } finally {
      this.adding.set(false);
    }
  }
  async toggleFavorite() {
    const product = this.product();
    if (!product || this.favoriteBusy()) return;
    if (!this.session.user()) {
      await this.router.navigate(['/iniciar-sesion'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.favoriteBusy.set(true);
    this.favoriteMessage.set('');
    try {
      if (this.favorite()) {
        await this.engagement.removeFavorite(product.id);
        this.favorite.set(false);
        this.favoriteMessage.set('Quitamos la prenda de tus favoritos.');
      } else {
        await this.engagement.saveFavorite(product.id);
        this.favorite.set(true);
        this.favoriteMessage.set('La guardamos y te avisaremos por correo si vuelve el stock o baja el precio.');
      }
    } catch (e) {
      this.favoriteMessage.set(errorMessage(e));
    } finally {
      this.favoriteBusy.set(false);
    }
  }
  private api = inject(CatalogService);
  private route = inject(ActivatedRoute);
  private destroy = inject(DestroyRef);
  product = signal<Product | null>(null);
  variant = signal<Entity | null>(null);
  selectedImage = signal('');
  error = signal('');
  loading = signal(true);
  imageIndex() {
    return Math.max(
      0,
      this.product()?.images.findIndex((image) => image['url'] === this.selectedImage()) ?? 0,
    );
  }
  moveImage(direction: number) {
    const images = this.product()?.images || [];
    if (!images.length) return;
    this.selectedImage.set(
      images[(this.imageIndex() + direction + images.length) % images.length]['url'],
    );
  }
  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((p) => {
          this.loading.set(true);
          this.error.set('');
          return this.api.product(p.get('slug') || '').pipe(
            catchError((e) => {
              this.error.set(errorMessage(e));
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((p) => {
        this.product.set(p);
        this.favorite.set(false);
        // Conserva la variante elegida al volver del probador (query ?variante=).
        const wantedId = this.route.snapshot?.queryParamMap?.get('variante') ?? null;
        this.variant.set(
          wantedId ? (p?.variants.find((v) => v.id === wantedId) ?? null) : null,
        );
        this.selectedImage.set(
          (p?.images.find((i) => i['is_primary']) || p?.images[0])?.['url'] || '',
        );
        this.loading.set(false);
        if (p && this.session.user()) {
          void this.engagement.getFavorite(p.id).then((data) => this.favorite.set(data.is_favorite)).catch(() => undefined);
        }
      });
  }
}
