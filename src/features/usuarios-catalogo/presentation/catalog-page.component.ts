import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, of, switchMap, tap } from 'rxjs';
import { CatalogService } from '../infrastructure/catalog.service';
import { Entity, Page, Product } from '../domain/catalog.models';
import { errorMessage } from '../../../shared/errors';
import { CommerceService } from '../../ventas-pagos/infrastructure/commerce.service';
import { RecommendedProduct } from '../../ventas-pagos/domain/commerce.models';

@Component({
  selector: 'fs-catalog-page',
  imports: [FormsModule, RouterLink, DecimalPipe],
  template: ` <section class="catalog-hero">
      <div class="container hero-inner">
        <div>
          <p class="eyebrow">FASHIONSTORE · HECHO PARA TU DÍA</p>
          <h1>Vestí tu<br /><em>propia historia.</em></h1>
          <p>Prendas que acompañan tu ritmo.<br />Encontrá lo que va con vos.</p>
          <a class="button primary" href="#catalogo">Explorar prendas ↓</a>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="art-orbit"></div>
          <svg viewBox="0 0 300 330">
            <path
              d="M88 60 115 42Q150 72 185 42L212 60 265 131 222 163 201 134 210 288Q150 313 90 288L99 134 78 163 35 131Z"
              fill="#b99b79"
            />
            <path d="M115 42Q150 72 185 42L176 76Q150 91 124 76Z" fill="#3f3932" />
            <path
              d="M150 92V297M105 133 92 284M195 133 208 284"
              stroke="#967b5d"
              stroke-width="2"
            />
            <path d="M124 126h53v54h-53Z" fill="#ad8d6b" /></svg
          ><span>ESTILO SIN COMPLICACIONES</span>
        </div>
      </div>
    </section>
    <section class="container section" id="catalogo">
      <div class="page-heading">
        <div>
          <p class="eyebrow">DESCUBRÍ LA SELECCIÓN</p>
          <h2>El catálogo</h2>
        </div>
        <span class="muted">{{ result()?.total || 0 }} prendas</span>
      </div>
      <div class="filters" [class.filters-collapsed]="!filtersOpen()">
        <button
          class="filters-toggle"
          type="button"
          [attr.aria-expanded]="filtersOpen()"
          aria-controls="catalog-filters"
          (click)="filtersOpen.set(!filtersOpen())"
        >
          {{ filtersOpen() ? 'Ocultar filtros −' : 'Buscar y filtrar prendas +' }}
        </button>
        <form id="catalog-filters" class="filter-bar" (ngSubmit)="apply(); filtersOpen.set(false)">
            <label class="filter-search"
              >Buscar<input
                name="search"
                [(ngModel)]="filters['search']"
                placeholder="Nombre o descripción"
            /></label>
            @for (ref of referenceFields; track ref.key) {
              <label
                >{{ ref.label
                }}<select [name]="ref.key" [(ngModel)]="filters[ref.key]">
                  <option value="">Todas</option>
                  @for (item of references()[ref.resource] || []; track item.id) {
                    <option [value]="item.id">{{ item['name'] }}</option>
                  }
                </select></label
              >
            }
            <label
              >Marca<input
                name="brand"
                [(ngModel)]="filters['brand']"
                placeholder="Todas las marcas"
            /></label>
            <div class="price-range">
              <label
                >Desde Bs<input
                  type="number"
                  name="min_price"
                  min="0"
                  [(ngModel)]="filters['min_price']" /></label
              ><label
                >Hasta Bs<input
                  type="number"
                  name="max_price"
                  min="0"
                  [(ngModel)]="filters['max_price']"
              /></label>
            </div>
            <label class="check"
              ><input type="checkbox" name="featured" [(ngModel)]="featured" />Solo
              destacadas</label
            >
            <div class="filter-actions">
              <button class="primary">Aplicar</button
              ><button type="button" (click)="clear()">Limpiar</button>
            </div>
          </form>
      </div>
      <div class="catalog-results">
          @if (error()) {
            <div class="alert error" role="alert">
              {{ error() }}<button (click)="retry()">Reintentar</button>
            </div>
          }
          @if (referenceError()) {
            <p class="alert error">
              {{ referenceError() }} <button (click)="loadReferences()">Recargar filtros</button>
            </p>
          }
          @if (loading()) {
            <div class="empty" role="status">Buscando prendas…</div>
          } @else {
            <div class="product-grid">
              @for (product of result()?.items || []; track product.id) {
                <a class="product-card" [routerLink]="['/prendas', product.slug]"
                  ><div class="product-image">
                    @if (image(product); as source) {
                      <img
                        [src]="source"
                        [alt]="product.name"
                        loading="lazy"
                        (error)="hideImage($event)"
                      />
                    } @else {
                      <div class="image-placeholder">
                        <span>F.</span><small>Imagen no disponible</small>
                      </div>
                    }
                    @if (product.is_featured) {
                      <span class="product-tag">Destacada</span>
                    }
                  </div>
                  <p class="eyebrow">{{ product.category['name'] }}</p>
                  <h3>{{ product.name }}</h3>
                  <div class="product-bottom">
                    <span>Bs {{ product.base_price | number: '1.2-2' }}</span
                    ><span class="muted">Ver prenda ↗</span>
                  </div></a
                >
              } @empty {
                @if (!error()) {
                  <div class="empty panel">
                    <h3>Todavía no hay prendas para mostrar</h3>
                    <p>Probá cambiar los filtros o volvé más tarde.</p>
                    <button (click)="clear()">Ver todo</button>
                  </div>
                }
              }
            </div>
          }
          @if (result() && result()!.pages > 1) {
            <div class="pagination">
              <button [disabled]="result()!.page <= 1 || loading()" (click)="goPage(-1)">
                Anterior</button
              ><span>{{ result()!.page }} / {{ result()!.pages }}</span
              ><button
                [disabled]="result()!.page >= result()!.pages || loading()"
                (click)="goPage(1)"
              >
                Siguiente
              </button>
            </div>
          }
      </div>
    </section>
    @if (recommendations().length) {
      <section class="container section recommendations">
        <p class="eyebrow">INTELIGENCIA ARTIFICIAL</p>
        <h2>Recomendado para vos</h2>
        <div class="product-grid product-grid-compact">
          @for (item of recommendations(); track item.id) {
            <a class="product-card" [routerLink]="['/prendas', item.slug]">
              <div class="product-image">
                @if (item.image_url) {
                  <img [src]="item.image_url" [alt]="item.name" loading="lazy" />
                } @else {
                  <div class="image-placeholder"><span>F.</span></div>
                }
              </div>
              <p class="eyebrow">{{ item.category }}</p>
              <h3>{{ item.name }}</h3>
              <div class="product-bottom">
                <span>Bs {{ item.base_price | number: '1.2-2' }}</span>
              </div>
            </a>
          }
        </div>
      </section>
    }`,
})
export class CatalogPageComponent {
  private api = inject(CatalogService);
  private commerce = inject(CommerceService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroy = inject(DestroyRef);
  result = signal<Page<Product> | null>(null);
  recommendations = signal<RecommendedProduct[]>([]);
  loading = signal(true);
  error = signal('');
  referenceError = signal('');
  references = signal<Record<string, Entity[]>>({});
  filters: Record<string, any> = {};
  featured = false;
  filtersOpen = signal(false);
  referenceFields = [
    { key: 'category_id', label: 'Categoría', resource: 'categories' },
    { key: 'season_id', label: 'Temporada', resource: 'seasons' },
    { key: 'collection_id', label: 'Colección', resource: 'collections' },
    { key: 'size_id', label: 'Talla', resource: 'sizes' },
    { key: 'color_id', label: 'Color', resource: 'colors' },
  ];
  constructor() {
    this.clearFields();
    void this.loadReferences();
    void this.loadRecommendations();
    this.route.queryParams
      .pipe(
        tap((query) => {
          this.clearFields();
          Object.assign(this.filters, query);
          this.featured = query['featured'] === 'true';
          this.loading.set(true);
          this.error.set('');
        }),
        switchMap((query) =>
          this.api.products({ ...query, page_size: 12 }).pipe(
            catchError((e) => {
              this.error.set(errorMessage(e));
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => {
        this.result.set(result);
        this.loading.set(false);
      });
  }
  clearFields() {
    this.filters = {
      search: '',
      brand: '',
      min_price: '',
      max_price: '',
      category_id: '',
      season_id: '',
      collection_id: '',
      size_id: '',
      color_id: '',
    };
    this.featured = false;
  }
  async loadRecommendations() {
    try {
      this.recommendations.set(await this.commerce.get<RecommendedProduct[]>('/recommendations'));
    } catch {
      /* seccion opcional: si falla, simplemente no se muestra */
    }
  }
  async loadReferences() {
    this.referenceError.set('');
    const keys = this.referenceFields.map((f) => f.resource);
    const results = await Promise.allSettled(
      keys.map((k) => firstValueFrom(this.api.reference(k))),
    );
    const refs: Record<string, Entity[]> = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') refs[keys[i]] = r.value;
      else
        this.referenceError.set('No se pudieron cargar algunos filtros. ' + errorMessage(r.reason));
    });
    this.references.set(refs);
  }
  apply() {
    const min = this.filters['min_price'],
      max = this.filters['max_price'];
    if (
      (min !== '' && min != null && Number(min) < 0) ||
      (max !== '' && max != null && Number(max) < 0) ||
      (min !== '' && max !== '' && min != null && max != null && Number(min) > Number(max))
    ) {
      this.error.set('Revisá el rango de precios.');
      return;
    }
    const query = Object.fromEntries(
      Object.entries({ ...this.filters, page: 1, featured: this.featured ? 'true' : '' }).filter(
        ([, v]) => v !== '' && v != null,
      ),
    );
    void this.router.navigate([], { relativeTo: this.route, queryParams: query });
  }
  clear() {
    this.clearFields();
    void this.router.navigate(['/']);
  }
  goPage(delta: number) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: (this.result()?.page || 1) + delta },
      queryParamsHandling: 'merge',
    });
  }
  async retry() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.result.set(
        await firstValueFrom(
          this.api.products({ ...this.route.snapshot.queryParams, page_size: 12 }),
        ),
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  image(product: Product) {
    return (product.images.find((i) => i['is_primary']) || product.images[0])?.['url'];
  }
  hideImage(event: Event) {
    const image = event.target as HTMLImageElement;
    image.style.display = 'none';
    image.parentElement?.classList.add('missing-image');
  }
}
