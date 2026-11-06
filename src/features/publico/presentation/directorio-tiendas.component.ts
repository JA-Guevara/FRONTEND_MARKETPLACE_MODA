import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TiendasPublicasApi, TiendaPublica } from '../infrastructure/tiendas-publicas.api';
import { errorMessage } from '../../../shared/errors';

@Component({
  selector: 'fs-directorio-tiendas',
  imports: [RouterLink],
  template: `
    <section class="container section">
      <div class="page-heading">
        <div>
          <p class="eyebrow">FashionStore</p>
          <h1>Elegí una tienda</h1>
          <p>Explorá las prendas y sucursales de cada marca.</p>
        </div>
        <a class="button" routerLink="/iniciar-sesion">Ingresar a mi empresa</a>
      </div>
      @if (loading()) { <p role="status">Cargando tiendas…</p> }
      @else if (error()) {
        <p role="alert">{{ error() }}</p>
        <button type="button" (click)="load(page())">Reintentar</button>
        <a routerLink="/sin-conexion/catalogo">Abrir mi catálogo sin conexión</a>
      } @else {
        <div class="stores">
          @for (store of stores(); track store.slug) {
            <a class="panel" [routerLink]="['/tienda', store.slug]">
              @if (store.logo_url) { <img [src]="store.logo_url" alt="" loading="lazy" /> }
              <strong>{{ store.trade_name }}</strong>
              @if (store.city) { <span>{{ store.city }}</span> }
              @if (store.slogan) { <span>{{ store.slogan }}</span> }
              <span>Ver catálogo →</span>
            </a>
          } @empty { <p>Todavía no hay tiendas publicadas.</p> }
        </div>
        @if (pages() > 1) {
          <div class="pagination">
            <button type="button" [disabled]="page() === 1" (click)="load(page() - 1)">Anterior</button>
            <span>Página {{ page() }} de {{ pages() }}</span>
            <button type="button" [disabled]="page() === pages()" (click)="load(page() + 1)">Siguiente</button>
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .stores { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: 1rem; }
    .stores a { display: grid; gap: .5rem; align-content: start; text-decoration: none; }
    .stores img { width: 3.5rem; height: 3.5rem; object-fit: contain; }
    .pagination { display: flex; align-items: center; gap: 1rem; margin-top: 1rem; }
  `],
})
export class DirectorioTiendasComponent {
  private api = inject(TiendasPublicasApi);
  private destroy = inject(DestroyRef);
  readonly stores = signal<TiendaPublica[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal(1);
  readonly pages = signal(0);

  constructor() { this.load(1); }

  load(page: number) {
    this.loading.set(true);
    this.error.set('');
    this.page.set(page);
    this.api.listar(page).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (result) => {
        this.stores.set(result.items);
        this.pages.set(Math.ceil(result.total / result.page_size));
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }
}
