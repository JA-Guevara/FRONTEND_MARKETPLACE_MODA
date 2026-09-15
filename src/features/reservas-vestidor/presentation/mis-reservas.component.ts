import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ReservasService } from '../infrastructure/reservas.service';
import { Reservation, reservationLabel } from '../domain/reservas.models';
import { errorMessage } from '../../../shared/errors';
import { IconComponent } from '../../../shared/icon.component';
@Component({
  selector: 'fs-mis-reservas',
  styleUrl: './reservas.scss',
  imports: [DatePipe, RouterLink, IconComponent],
  template: `<section class="container section">
    <p class="eyebrow">MI CUENTA</p>
    <h1>Mis reservas</h1>
    <p class="muted">Seguimiento de las reservas que hiciste para probarte prendas en sucursal.</p>
    @if (confirmed()) {
      <p class="alert success" role="status">
        Solicitud de reserva registrada. Está pendiente de confirmación de la sucursal.
      </p>
    }
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <p class="empty" role="status">Cargando reservas…</p>
    } @else if (!reservations().length) {
      <div class="empty-state">
        <h2>
          {{
            query
              ? 'No hay reservas que coincidan con tu búsqueda'
              : 'Todavía no hiciste ninguna reserva'
          }}
        </h2>
        <a routerLink="/">Ir al catálogo</a>
      </div>
    } @else {
      <div class="orders-grid">
        @for (r of reservations(); track r.id) {
          <article class="order-card">
            <div class="order-header">
              <div>
                <h2>{{ r.scheduled_at | date: 'dd/MM/yyyy HH:mm' }}</h2>
                @if (r.branch_name) {
                  <p class="muted">{{ r.branch_name }}</p>
                }
                <p class="muted">
                  {{ r.items.length }} {{ r.items.length === 1 ? 'prenda' : 'prendas' }} ·
                  {{ totalUnits(r.items) }}
                  {{ totalUnits(r.items) === 1 ? 'unidad' : 'unidades' }}
                </p>
              </div>
              <span class="commerce-status">{{ label(r.status) }}</span>
            </div>
            <details class="order-details">
              <summary>Ver prendas y seguimiento</summary>
              @for (i of r.items; track i.variant_id) {
                <div class="commerce-item">
                  @if (i.image_url) {
                    <img [src]="i.image_url" [alt]="i.name" />
                  } @else {
                    <span>F.</span>
                  }
                  <div>
                    <h3>{{ i.name }}</h3>
                    <p>{{ i.size }} · {{ i.color }} · {{ i.quantity }} unidad(es)</p>
                  </div>
                </div>
              }
              @if (r.notes) {
                <p>Nota: {{ r.notes }}</p>
              }
              <ol class="timeline">
                @for (t of r.tracking; track $index) {
                  <li>
                    <strong>{{ label(t.status) }}</strong
                    ><small>{{ t.date | date: 'dd/MM/yyyy HH:mm' }}</small>
                    <p>{{ t.note }}</p>
                  </li>
                }
              </ol>
            </details>
            @if (['pending', 'confirmed', 'ready'].includes(r.status)) {
              <button [disabled]="busy() === r.id" (click)="cancel(r)">
                {{ busy() === r.id ? 'Cancelando…' : 'Cancelar reserva' }}
              </button>
            }
          </article>
        }
      </div>
      @if (pages() > 1) {
        <div class="pagination">
          <button (click)="page = page - 1; load()" [disabled]="page <= 1 || loading()">
            <fs-icon name="arrow-left" />Anterior</button
          ><span>Página {{ page }} de {{ pages() }}</span
          ><button (click)="page = page + 1; load()" [disabled]="page >= pages() || loading()">
            Siguiente<fs-icon name="arrow-right" />
          </button>
        </div>
      }
    }
  </section>`,
})
export class MisReservasComponent {
  private api = inject(ReservasService);
  private route = inject(ActivatedRoute);
  /** Id de la reserva recién creada. La confirmación solo se muestra cuando esa
   * reserva figura en la respuesta del backend; un parámetro escrito a mano no
   * basta (ya no se usa agendada=1). */
  private routeQuery = this.route.snapshot.queryParamMap;
  query = this.routeQuery.get('nueva') || '';
  reservations = signal<Reservation[]>([]);
  loading = signal(true);
  error = signal('');
  busy = signal('');
  confirmed = signal(false);
  page = 1;
  pages = signal(0);
  label = reservationLabel;
  constructor() {
    void this.load();
  }
  totalUnits(items: Reservation['items']): number {
    return items.reduce((sum, i) => sum + i.quantity, 0);
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.api.mine(this.page);
      this.reservations.set(result.items);
      this.pages.set(result.pages);
      await this.verifyConfirmation();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  /** La confirmación proviene del backend: el id debe existir y pertenecer al
   * usuario. GET /reservations/{id} aplica esa restricción, así que un
   * parámetro inventado no puede fabricar una confirmación. */
  private async verifyConfirmation() {
    if (!this.query) {
      this.confirmed.set(false);
      return;
    }
    try {
      await this.api.get(this.query);
      this.confirmed.set(true);
    } catch {
      this.confirmed.set(false);
    }
  }
  async cancel(r: Reservation) {
    this.busy.set(r.id);
    this.error.set('');
    try {
      await this.api.cancel(r.id);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set('');
    }
  }
}