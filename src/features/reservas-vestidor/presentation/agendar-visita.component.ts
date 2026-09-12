import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommerceService } from '../../ventas-pagos/infrastructure/commerce.service';
import { ReservasService } from '../infrastructure/reservas.service';
import { TryOnListService } from '../application/try-on-list.service';
import { Branch } from '../../ventas-pagos/domain/commerce.models';
import { IconComponent } from '../../../shared/icon.component';
import { errorMessage } from '../../../shared/errors';
@Component({
  selector: 'fs-agendar-visita',
  imports: [FormsModule, RouterLink, IconComponent],
  template: `<section class="container section">
    <p class="eyebrow">RESERVAS</p>
    <h1>Agendar visita para probarte prendas</h1>
    <p class="muted">
      Elegí la sucursal y el horario aproximado. Vas a poder probarte estas prendas y decidir cuáles
      comprar cuando llegues a la tienda.
    </p>
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }
    @if (!tryOn.items().length) {
      <div class="empty-state">
        <h2>Todavía no agregaste prendas a tu visita</h2>
        <a routerLink="/">Ir al catálogo</a>
      </div>
    } @else {
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Prenda</th>
              <th>Talla</th>
              <th>Color</th>
              <th>Cantidad</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (i of tryOn.items(); track i.variant_id) {
              <tr>
                <td>{{ i.name }}</td>
                <td>{{ i.size }}</td>
                <td>{{ i.color }}</td>
                <td>{{ i.quantity }}</td>
                <td>
                  <button type="button" (click)="tryOn.remove(i.variant_id)">
                    <fs-icon name="trash" />Quitar
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <form #f="ngForm" (ngSubmit)="f.valid && submit()" class="toolbar">
        <label
          >Sucursal<select name="branch" [(ngModel)]="branchId" required>
            <option value="" disabled>Elegí una sucursal</option>
            @for (b of branches(); track b.id) {
              <option [value]="b.id">{{ b.name }}</option>
            }
          </select></label
        ><label
          >Horario aproximado<input
            type="datetime-local"
            name="scheduled"
            [(ngModel)]="scheduledAt"
            [min]="minDateTime"
            required
        /></label>
        <label
          >Notas (opcional)<input
            name="notes"
            [(ngModel)]="notes"
            maxlength="1000"
            placeholder="Ej.: prefiero la tarde"
        /></label>
        <button class="primary" type="submit" [disabled]="busy()">
          {{ busy() ? 'Agendando…' : 'Confirmar visita' }}
        </button>
      </form>
    }
  </section>`,
})
export class AgendarVisitaComponent {
  tryOn = inject(TryOnListService);
  private commerce = inject(CommerceService);
  private reservas = inject(ReservasService);
  private router = inject(Router);
  branches = signal<Branch[]>([]);
  branchId = '';
  notes = '';
  busy = signal(false);
  error = signal('');
  minDateTime = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
  scheduledAt = this.minDateTime;
  constructor() {
    void this.loadBranches();
  }
  async loadBranches() {
    try {
      this.branches.set(await this.commerce.branches());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
  async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.reservas.create(
        this.branchId,
        new Date(this.scheduledAt).toISOString(),
        this.tryOn.items(),
        this.notes,
      );
      this.tryOn.clear();
      await this.router.navigate(['/mi-cuenta/reservas'], {
        queryParams: { agendada: '1' },
      });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
