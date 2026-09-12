import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommerceService } from '../../ventas-pagos/infrastructure/commerce.service';
import { ReservasService } from '../infrastructure/reservas.service';
import { Reservation, reservationLabel } from '../domain/reservas.models';
import { Branch } from '../../ventas-pagos/domain/commerce.models';
import { SessionService } from '../../auth/application/session.service';
import { errorMessage } from '../../../shared/errors';

const NEXT_STATUS: Record<string, string> = { pending: 'confirmed', confirmed: 'ready', ready: 'attended' };

@Component({
  selector: 'fs-admin-reservas',
  imports: [DatePipe, FormsModule],
  template: `<p class="eyebrow">GESTIÓN COMERCIAL</p>
    <h1>Reservas de prendas</h1>
    <p class="muted">Atendé las visitas agendadas: confirmá, prepará las prendas y registrá la recepción del cliente.</p>
    <form class="toolbar" (ngSubmit)="load()">
      <label
        >Sucursal<select name="branch" [(ngModel)]="branchId" (change)="load()">
          <option value="">Todas</option>
          @for (b of branches(); track b.id) {
            <option [value]="b.id">{{ b.name }}</option>
          }
        </select></label
      ><label
        >Estado<select name="status" [(ngModel)]="status" (change)="load()">
          <option value="">Todos</option>
          <option value="pending">Pendiente de confirmación</option>
          <option value="confirmed">Confirmada</option>
          <option value="ready">Prendas preparadas</option>
          <option value="attended">Atendida</option>
          <option value="cancelled">Cancelada</option>
        </select></label
      >
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
              <th>Horario</th>
              <th>Prendas</th>
              <th>Nota</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of reservations(); track r.id) {
              <tr>
                <td>{{ r.scheduled_at | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  @for (i of r.items; track i.variant_id) {
                    <div>{{ i.name }} · {{ i.size }}/{{ i.color }} ×{{ i.quantity }}</div>
                  }
                </td>
                <td>{{ r.notes || '—' }}</td>
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
                <td colspan="5" class="empty">No hay reservas con estos filtros.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
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
  branchId = '';
  status = '';
  label = reservationLabel;
  constructor() {
    void this.loadBranches();
    void this.load();
  }
  async loadBranches() {
    try {
      this.branches.set(await this.commerce.branches());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.reservations.set((await this.api.admin(1, this.branchId, this.status)).items);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
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
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set('');
    }
  }
}
