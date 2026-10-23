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
  selector: 'fs-reserva-offline',
  imports: [CommonModule, FormsModule, RouterLink, ConnectionBadgeComponent, EmptyStateComponent],
  template: `<div class="sp2-page">
    <div class="offline-heading">
      <div>
        <p class="crumbs">
          <a routerLink="/sin-conexion/catalogo">Catálogo sin conexión</a> / Nueva reserva
        </p>
        <h1>Nueva reserva sin conexión</h1>
        <p>Selecciona tus prendas y agenda la visita a la sucursal.</p>
      </div>
      <fs-connection-badge />
    </div>
    @if (store.error()) {
      <div class="alert danger" role="alert">{{ store.error() }}</div>
    }
    <div class="reservation-cols">
      <section class="panel">
        <h2>Prendas seleccionadas ({{ store.items().length }} de 20)</h2>
        @for (item of store.items(); track item.variante_id) {
          <div class="reservation-item">
            <div class="grow">
              <strong>{{ name(item.variante_id) }}</strong>
              <p>
                {{ variant(item.variante_id)?.talla }} · {{ variant(item.variante_id)?.color }} ·
                SKU {{ variant(item.variante_id)?.sku }}
              </p>
              <small>Existencia local: {{ stock(item.variante_id) }}</small>
            </div>
            <input
              class="input"
              style="width:80px"
              type="number"
              min="1"
              max="10"
              aria-label="Cantidad"
              [ngModel]="item.cantidad"
              (ngModelChange)="store.cambiarCantidad(item.variante_id, $event)"
            /><button aria-label="Quitar prenda" (click)="store.quitar(item.variante_id)">×</button>
          </div>
        } @empty {
          <fs-empty-state
            title="Tu reserva está vacía"
            text="Agrega prendas del catálogo descargado."
            ><a class="btn" routerLink="/sin-conexion/catalogo">Elegir prendas</a></fs-empty-state
          >
        }
        <p><a routerLink="/sin-conexion/catalogo">＋ Agregar más prendas</a></p>
      </section>
      <section class="panel sp2-form">
        <h2>Tu visita</h2>
        <label class="f">Sucursal<input class="input" [value]="branchName()" disabled /></label>
        <div class="sp2-grid">
          <label class="f"
            >Fecha<input
              class="input"
              type="date"
              [ngModel]="store.fecha()"
              (ngModelChange)="store.fecha.set($event)" /></label
          ><label class="f"
            >Hora<input
              class="input"
              type="time"
              [ngModel]="store.hora()"
              (ngModelChange)="store.hora.set($event)"
          /></label>
        </div>
        @if (session.can('reservations.write')) {
          <label class="f"
            >Cliente<select
              class="input"
              [ngModel]="store.clienteId()"
              (ngModelChange)="store.clienteId.set($event)"
            >
              <option value="">Mi cuenta</option>
              @for (c of store.catalogo.datos().clientes; track c.id) {
                <option [value]="c.id">{{ c.nombre }} · …{{ c.documento_final }}</option>
              }
            </select></label
          >
        }
        <label class="f"
          >Notas<textarea
            class="input"
            rows="3"
            maxlength="1000"
            [ngModel]="store.notas()"
            (ngModelChange)="store.notas.set($event)"
          ></textarea>
        </label>
        <div class="alert info">
          <strong>Comprobante provisional</strong>
          <p>
            Esta reserva se guarda en el dispositivo y está pendiente de sincronizar. Las
            existencias y el horario se confirmarán al conectarte.
          </p>
        </div>
        <button
          class="btn primary"
          [disabled]="store.guardando() || !store.items().length || session.readOnly()"
          (click)="confirmar()"
        >
          {{ store.guardando() ? 'Guardando…' : 'Confirmar reserva sin conexión' }}
        </button>
      </section>
    </div>
  </div>`,
  styleUrl: './reserva-offline.component.scss',
})
export class ReservaOfflineComponent {
  store = inject(ReservaOfflineStore);
  session = inject(SessionService);
  private router = inject(Router);
  constructor() {
    void this.store.catalogo.cargarLocal();
  }
  variant(id: string) {
    return this.store.catalogo.datos().variantes.find((v) => v.id === id);
  }
  name(id: string) {
    return (
      this.store.catalogo.datos().productos.find((p) => p.id === this.variant(id)?.producto_id)
        ?.nombre ?? id
    );
  }
  stock(id: string) {
    return this.store.catalogo.datos().existencias.find((x) => x.variante_id === id)?.cantidad ?? 0;
  }
  branchName() {
    return (
      this.store.catalogo.datos().sucursales.find((b) => b.id === this.store.sucursalId())
        ?.nombre ?? ''
    );
  }
  async confirmar() {
    try {
      const id = await this.store.confirmar();
      await this.router.navigate(['/sin-conexion/reservas', id]);
    } catch (e) {
      this.store.error.set(e instanceof Error ? e.message : 'No se pudo guardar la reserva.');
    }
  }
}
