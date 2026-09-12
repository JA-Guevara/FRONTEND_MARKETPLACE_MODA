import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ReservasService } from '../infrastructure/reservas.service';
import { Reservation, reservationLabel } from '../domain/reservas.models';
import { errorMessage } from '../../../shared/errors';
@Component({
  selector: 'fs-mis-reservas',
  imports: [DatePipe, RouterLink],
  template: `<section class="container section">
    <p class="eyebrow">MI CUENTA</p>
    <h1>Mis reservas</h1>
    <p class="muted">Seguimiento de las visitas que agendaste para probarte prendas en sucursal.</p>
    @if (confirmed) {
      <p class="alert success" role="status">
        Visita agendada. La sucursal ya puede ver tu reserva y prepararla.
      </p>
    }
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <p class="empty" role="status">Cargando reservas…</p>
    } @else if (!reservations().length) {
      <div class="empty-state">
        <h2>Todavía no agendaste ninguna visita</h2>
        <a routerLink="/">Ir al catálogo</a>
      </div>
    } @else {
      <div class="orders-grid">
        @for (r of reservations(); track r.id) {
          <article class="order-card">
            <div class="order-header">
              <div>
                <h2>{{ r.scheduled_at | date: 'dd/MM/yyyy HH:mm' }}</h2>
                <p class="muted">{{ r.items.length }} prenda(s)</p>
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
    }
  </section>`,
})
export class MisReservasComponent {
  private api = inject(ReservasService);
  private route = inject(ActivatedRoute);
  confirmed = this.route.snapshot.queryParamMap.get('agendada') === '1';
  reservations = signal<Reservation[]>([]);
  loading = signal(true);
  error = signal('');
  busy = signal('');
  label = reservationLabel;
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.reservations.set((await this.api.mine()).items);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
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
