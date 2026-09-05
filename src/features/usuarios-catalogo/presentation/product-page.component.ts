import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { CatalogService } from '../infrastructure/catalog.service';
import { Product, Entity } from '../domain/catalog.models';
import { errorMessage } from '../../../shared/errors';
@Component({
  selector: 'fs-product-page',
  imports: [RouterLink, DecimalPipe],
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
        </div>
        <div>
          <p class="eyebrow">{{ p.category['name'] }} / {{ p.brand || 'FASHIONSTORE' }}</p>
          <h1>{{ p.name }}</h1>
          <p class="detail-price">
            Bs {{ variant()?.['price_override'] ?? p.base_price | number: '1.2-2' }}
          </p>
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
              <button [class.selected]="variant()?.id === v.id" (click)="variant.set(v)">
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
  private api = inject(CatalogService);
  private route = inject(ActivatedRoute);
  private destroy = inject(DestroyRef);
  product = signal<Product | null>(null);
  variant = signal<Entity | null>(null);
  selectedImage = signal('');
  error = signal('');
  loading = signal(true);
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
        this.variant.set(null);
        this.selectedImage.set(
          (p?.images.find((i) => i['is_primary']) || p?.images[0])?.['url'] || '',
        );
        this.loading.set(false);
      });
  }
}
