import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommerceService } from '../../ventas-pagos/infrastructure/commerce.service';
import { ReservasService } from '../infrastructure/reservas.service';
import { Reservation, reservationLabel } from '../domain/reservas.models';
import { Branch } from '../../ventas-pagos/domain/commerce.models';
import { SessionService } from '../../auth/application/session.service';
import { IconComponent } from '../../../shared/icon.component';
import { errorMessage } from '../../../shared/errors';

const NEXT_STATUS: Record<string, string> = { pending: 'confirmed', confirmed: 'ready', ready: 'attended' };

@Component({
  selector: 'fs-admin-reservas',
  imports: [DatePipe, FormsModule, IconComponent],
  template: `<p class="eyebrow">GESTIÓN COMERCIAL</p>
    <h1>Reservas de prendas</h1>
    <p class="muted">
      Atendé las visitas agendadas: confirmá, prepará las prendas y registrá la recepción del
      cliente.
    </p>
    <form class="toolbar" (ngSubmit)="page = 1; apply()">
      <label
        >Buscar<input
          name="q"
          type="search"
          [(ngModel)]="search"
          placeholder="Cliente, email o n.º de reserva"
      /></label>
      <label
        >Sucursal<select name="branch" [(ngModel)]="branchId">
          <option value="">Todas</option>
          @for (b of branches(); track b.id) {
            <option [value]="b.id">{{ b.name }}</option>
          }
        </select></label
      ><label
        >Estado<select name="status" [(ngModel)]="status">
          <option value="">Todos</option>
          <option value="pending">Pendiente de confirmación</option>
          <option value="confirmed">Confirmada</option>
          <option value="ready">Prendas preparadas</option>
          <option value="attended">Atendida</option>
          <option value="cancelled">Cancelada</option>
        </select></label
      ><label
        >Desde<input name="date_from" type="date" [(ngModel)]="date_from" /></label
      ><label
        >Hasta<input name="date_to" type="date" [(ngModel)]="date_to" /></label
      ><button class="primary" type="submit">Filtrar</button>
    </form>
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <p class="empty" role="status">Cargando reservas…</p>
    } @else {
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N.º</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Sucursal</th>
              <th>Prendas</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of reservations(); track r.id) {
              <tr>
                <td>#{{ r.id.slice(0, 8) }}</td>
                <td>{{ r.scheduled_at | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  {{ r.user_name || '—' }}
                  <p class="muted">{{ r.user_email }}</p>
                </td>
                <td>{{ r.branch_name || '—' }}</td>
                <td>
                  @for (i of r.items; track i.variant_id) {
                    <div>{{ i.name }} · {{ i.size }}/{{ i.color }} ×{{ i.quantity }}</div>
                  }
                </td>
                <td>{{ label(r.status) }}</td>
                <td>
                  @if (session.can('reservations.write')) {
                    @if (nextStatus(r)) {
                      <button [disabled]="busy() === r.id" (click)="transition(r, nextStatus(r))">
                        {{ actionLabel(r) }}
                      </button>
                    }
                    @if (['pending', 'confirmed', 'ready'].includes(r.status)) {
                      <button [disabled]="busy() === r.id" (click)="transition(r, 'cancelled')">
                        Cancelar
                      </button>
                    }
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty">No hay reservas con estos filtros.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (pages() > 1) {
        <div class="pagination">
          <button (click)="page = page - 1; apply()" [disabled]="page <= 1 || loading()">
            <fs-icon name="arrow-left" />Anterior</button
          ><span>Página {{ page }} de {{ pages() || 1 }}</span
          ><button (click)="page = page + 1; apply()" [disabled]="page >= pages() || loading()">
            Siguiente<fs-icon name="arrow-right" />
          </button>
        </div>
      }
    }`,
})
export class AdminReservasComponent {
  private api = inject(ReservasService);
  private commerce = inject(CommerceService);
  session = inject(SessionService);
  branches = signal<Branch[]>([]);
  reservations = signal<Reservation[]>([]);
  loading = signal(true);
  error = signal('');
  busy = signal('');
  search = '';
  branchId = '';
  status = '';
  date_from = '';
  date_to = '';
  page = 1;
  pages = signal(0);
  label = reservationLabel;
  /** Número de consulta: si al filtrar cambia antes de que llegue la respuesta
   * anterior, esa respuesta se descarta (no se pisa el resultado nuevo). */
  private requestId = 0;
  constructor() {
    void this.loadBranches();
    void this.apply();
  }
  async loadBranches() {
    try {
      this.branches.set(await this.commerce.branches());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
  async apply() {
    const current = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.api.admin(
        this.page,
        this.branchId,
        this.status,
        this.search.trim(),
        this.date_from,
        this.date_to,
      );
      if (current !== this.requestId) return;
      this.reservations.set(result.items);
      this.pages.set(result.pages);
      if (result.pages && this.page > result.pages) {
        this.page = result.pages;
        await this.apply();
      }
    } catch (e) {
      if (current !== this.requestId) return;
      this.error.set(errorMessage(e));
    } finally {
      if (current === this.requestId) this.loading.set(false);
    }
  }
  nextStatus(r: Reservation) {
    return NEXT_STATUS[r.status] || '';
  }
  actionLabel(r: Reservation) {
    return (
      { confirmed: 'Confirmar', ready: 'Marcar prendas listas', attended: 'Confirmar recepción del cliente' } as Record<
        string,
        string
      >
    )[this.nextStatus(r)];
  }
  async transition(r: Reservation, status: string) {
    this.busy.set(r.id);
    this.error.set('');
    try {
      await this.api.updateStatus(r.id, status);
      await this.apply();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set('');
    }
  }
}