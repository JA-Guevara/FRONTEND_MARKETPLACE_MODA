import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EngagementService, Favorite } from '../infrastructure/engagement.service';
import { IconComponent } from '../../../shared/icon.component';
import { errorMessage } from '../../../shared/errors';

@Component({
  selector: 'fs-favorites-page', imports: [RouterLink, DecimalPipe, IconComponent], styleUrl: './commerce.scss',
  template: `<section class="commerce-page"><p class="eyebrow">MI SELECCIÓN</p><h1>Mis favoritos</h1>
    <p class="muted">Guardá prendas para volver a encontrarlas y elegí si querés recibir avisos por correo cuando haya una reposición o una rebaja.</p>
    @if (error()) { <p class="alert error">{{ error() }}</p> }
    @if (loading()) { <p role="status">Cargando favoritos…</p> }
    @if (!loading() && !favorites().length) { <div class="empty-state"><h2>Aún no guardaste prendas</h2><p>Desde la ficha de una prenda usá el corazón para guardarla.</p><a routerLink="/" class="button primary">Ver catálogo</a></div> }
    <div class="favorites-grid">
      @for (item of favorites(); track item.product_id) { <article class="favorite-card">
        <a [routerLink]="['/prendas', item.slug]">@if (item.image_url) { <img [src]="item.image_url" [alt]="item.name" /> } @else { <div class="image-placeholder">F.</div> }</a>
        <div><h2><a [routerLink]="['/prendas', item.slug]">{{ item.name }}</a></h2><strong>BOB {{ item.base_price | number:'1.2-2' }}</strong>
          <div class="alert-options"><button type="button" [class.selected]="item.stock_alert" (click)="toggle(item, 'stock_alert')"><fs-icon name="box" />{{ item.stock_alert ? 'Avisar reposición' : 'Sin aviso de stock' }}</button><button type="button" [class.selected]="item.price_alert" (click)="toggle(item, 'price_alert')"><fs-icon name="tag" />{{ item.price_alert ? 'Avisar rebaja' : 'Sin aviso de precio' }}</button></div>
          <button type="button" class="danger-link" (click)="remove(item)"><fs-icon name="trash" />Quitar de favoritos</button>
        </div>
      </article> }
    </div>
  </section>`,
})
export class FavoritesPageComponent {
  private api = inject(EngagementService); favorites = signal<Favorite[]>([]); loading = signal(true); error = signal('');
  constructor() { void this.load(); }
  async load() { this.loading.set(true); this.error.set(''); try { this.favorites.set(await this.api.favorites()); } catch (e) { this.error.set(errorMessage(e)); } finally { this.loading.set(false); } }
  async toggle(item: Favorite, field: 'stock_alert' | 'price_alert') { try { const data = await this.api.saveFavorite(item.product_id, {...item, [field]: !item[field]}); this.favorites.update(rows => rows.map(row => row.product_id === item.product_id ? {...row, ...data} : row)); } catch (e) { this.error.set(errorMessage(e)); } }
  async remove(item: Favorite) { try { await this.api.removeFavorite(item.product_id); this.favorites.update(rows => rows.filter(row => row.product_id !== item.product_id)); } catch (e) { this.error.set(errorMessage(e)); } }
}
