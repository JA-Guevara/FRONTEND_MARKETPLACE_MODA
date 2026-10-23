import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { OfflineCatalogStore } from '../application/offline-catalog.store';
import { ReservaOfflineStore } from '../application/reserva-offline.store';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { ConnectionBadgeComponent } from '../../../shared/ui/connection-badge.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';

@Component({
  selector: 'fs-catalogo-offline',
  imports: [CommonModule, FormsModule, RouterLink, ConnectionBadgeComponent, EmptyStateComponent],
  template: `<div class="sp2-page">
    <div class="offline-heading">
      <div>
        <p class="crumbs"><a routerLink="/sin-conexion">Sin conexión</a> / Catálogo</p>
        <h1>Tu catálogo, sin conexión</h1>
        <p>
          Existencia local de {{ branchName() }} · Última actualización
          {{ store.meta().descargadoEn | date: 'dd/MM/yyyy HH:mm' }}
        </p>
      </div>
      <div class="toolbar">
        <fs-connection-badge /><a class="btn primary" routerLink="/sin-conexion/reservar"
          >Reserva ({{ reserva.items().length }})</a
        >
      </div>
    </div>
    @if (store.desactualizado() && store.meta().version) {
      <div class="alert warn">
        <strong>La información puede estar desactualizada</strong>
        <p>
          Pasaron {{ hours() }} horas desde la última descarga. Los precios y las existencias pueden
          haber cambiado.
        </p>
        <a routerLink="/sin-conexion">Actualizar al conectarte →</a>
      </div>
    }
    @if (!store.meta().version) {
      <fs-empty-state
        title="Aún no hay datos sin conexión"
        text="Conéctate al menos una vez para descargar el catálogo de tu empresa."
        ><a class="btn primary" routerLink="/sin-conexion">Preparar catálogo</a></fs-empty-state
      >
    } @else {
      <div class="offline-cols">
        <aside class="panel">
          <h3>Filtros</h3>
          <label class="f"
            >Buscar<input
              class="input"
              placeholder="Nombre o marca…"
              [ngModel]="store.filtros().texto"
              (ngModelChange)="store.setFiltro('texto', $event)" /></label
          ><label class="f"
            >Categoría<select
              class="input"
              [ngModel]="store.filtros().categoria"
              (ngModelChange)="store.setFiltro('categoria', $event)"
            >
              <option value="">Todas</option>
              @for (c of categories(); track c) {
                <option>{{ c }}</option>
              }
            </select></label
          ><label class="f"
            >Talla<select
              class="input"
              [ngModel]="store.filtros().talla"
              (ngModelChange)="store.setFiltro('talla', $event)"
            >
              <option value="">Todas</option>
              @for (t of sizes(); track t) {
                <option>{{ t }}</option>
              }
            </select></label
          ><label class="f"
            >Color<select
              class="input"
              [ngModel]="store.filtros().color"
              (ngModelChange)="store.setFiltro('color', $event)"
            >
              <option value="">Todos</option>
              @for (c of colors(); track c) {
                <option>{{ c }}</option>
              }
            </select></label
          ><label class="f"
            >Precio mínimo<input
              class="input"
              type="number"
              min="0"
              [ngModel]="store.filtros().precioMin"
              (ngModelChange)="store.setFiltro('precioMin', $event)" /></label
          ><label class="f"
            >Precio máximo<input
              class="input"
              type="number"
              min="0"
              [ngModel]="store.filtros().precioMax"
              (ngModelChange)="store.setFiltro('precioMax', $event)" /></label
          ><label
            ><input
              type="checkbox"
              [ngModel]="store.filtros().soloOferta"
              (ngModelChange)="store.setFiltro('soloOferta', $event)"
            />
            Solo ofertas</label
          ><br /><label
            ><input
              type="checkbox"
              [ngModel]="store.filtros().soloConStock"
              (ngModelChange)="store.setFiltro('soloConStock', $event)"
            />
            Con existencia local</label
          >
        </aside>
        <div>
          <p class="muted">{{ store.vista().length }} prendas disponibles en tu catálogo</p>
          @if (reserva.error()) {
            <div class="alert danger" role="alert">{{ reserva.error() }}</div>
          }
          <div class="product-grid">
            @for (p of store.vista(); track p.producto.id) {
              <article class="product-card">
                <div class="product-image">
                  @if (p.producto.imagen_url && !broken().includes(p.producto.id)) {
                    <img
                      [src]="p.producto.imagen_url"
                      [alt]="p.producto.nombre"
                      loading="lazy"
                      (error)="markBroken(p.producto.id)"
                    />
                  } @else {
                    <span>{{ p.producto.categoria.slice(0, 1) }}</span>
                  }
                </div>
                <div class="product-body">
                  <small>{{ p.producto.categoria }} · {{ p.producto.marca }}</small>
                  <h3>{{ p.producto.nombre }}</h3>
                  <div class="product-price">
                    Bs {{ p.precioFinal | number: '1.2-2' }}
                    @if (p.producto.precio_oferta !== null) {
                      <del>Bs {{ p.producto.precio_base | number: '1.2-2' }}</del>
                    }
                  </div>
                  <small>{{ p.tallas.join(' · ') }} · {{ p.stock }} unidades locales</small
                  ><select
                    class="input"
                    aria-label="Seleccionar talla y color"
                    [ngModel]="selected[p.producto.id] || ''"
                    (ngModelChange)="selected[p.producto.id] = $event"
                  >
                    <option value="">Elige talla y color</option>
                    @for (v of p.variantes; track v.id) {
                      <option [value]="v.id" [disabled]="stock(v.id) <= 0">
                        {{ v.talla }} · {{ v.color }} ({{ stock(v.id) }})
                      </option>
                    }</select
                  ><button
                    class="btn primary"
                    [disabled]="!selected[p.producto.id] || session.readOnly()"
                    (click)="add(selected[p.producto.id])"
                  >
                    ＋ Reservar
                  </button>
                </div>
              </article>
            } @empty {
              <fs-empty-state
                title="No hay prendas con estos filtros"
                text="Prueba otra talla, color o rango de precios."
              />
            }
          </div>
        </div>
      </div>
    }
  </div>`,
  styleUrl: './catalogo-offline.component.scss',
})
export class CatalogoOfflineComponent {
  store = inject(OfflineCatalogStore);
  reserva = inject(ReservaOfflineStore);
  session = inject(SessionService);
  selected: Record<string, string> = {};
  broken = signal<string[]>([]);
  categories = computed(() => [...new Set(this.store.datos().productos.map((p) => p.categoria))]);
  sizes = computed(() => [...new Set(this.store.datos().variantes.map((v) => v.talla))]);
  colors = computed(() => [...new Set(this.store.datos().variantes.map((v) => v.color))]);
  branchName = computed(
    () =>
      this.store.datos().sucursales.find((b) => b.id === this.store.meta().sucursalId)?.nombre ??
      'tu sucursal',
  );
  hours = computed(() =>
    Math.max(
      0,
      Math.floor((Date.now() - Date.parse(this.store.meta().descargadoEn ?? '')) / 3600000),
    ),
  );
  constructor() {
    void this.store.cargarLocal();
  }
  stock(id: string) {
    return this.store.datos().existencias.find((x) => x.variante_id === id)?.cantidad ?? 0;
  }
  markBroken(id: string) {
    this.broken.update((xs) => [...xs, id]);
  }
  add(id: string) {
    this.reserva.agregar(id);
  }
}
