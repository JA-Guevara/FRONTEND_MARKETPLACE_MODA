import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommerceService } from '../../ventas-pagos/infrastructure/commerce.service';
import { ReservasService } from '../infrastructure/reservas.service';
import { TryOnListService } from '../application/try-on-list.service';
import { Branch } from '../../ventas-pagos/domain/commerce.models';
import { VariantAvailability } from '../domain/reservas.models';
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
              <th>En la sucursal</th>
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
                  @if (!branchId) {
                    <span class="muted">Elegí una sucursal</span>
                  } @else if (checking()) {
                    <span class="muted">Consultando…</span>
                  } @else if (statusOf(i.variant_id); as estado) {
                    <span class="badge" [class.inactive]="!estado.available">{{
                      estado.available ? 'Disponible · ' + estado.quantity : estado.reason
                    }}</span>
                  }
                </td>
                <td>
                  <button type="button" (click)="removeItem(i.variant_id)">
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
          >Sucursal<select
            name="branch"
            [(ngModel)]="branchId"
            (ngModelChange)="onBranchChange()"
            required
          >
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
        <button class="primary" type="submit" [disabled]="busy() || checking() || !!unavailable.length">
          <fs-icon name="calendar" />{{ busy() ? 'Agendando…' : 'Confirmar visita' }}
        </button>
      </form>
      @if (unavailable.length) {
        <p class="alert error" role="alert">
          Esta sucursal no tiene
          {{ unavailable.length === 1 ? 'una de las tallas' : unavailable.length + ' de las tallas' }}
          que elegiste. Quitalas de la lista o probá con otra sucursal, así no viajás al local para
          nada.
        </p>
      }
    }
  </section>`,
})
export class AgendarVisitaComponent {
  tryOn = inject(TryOnListService);
  private commerce = inject(CommerceService);
  private reservas = inject(ReservasService);
  private router = inject(Router);
  branches = signal<Branch[]>([]);
  availability = signal<VariantAvailability[]>([]);
  checking = signal(false);
  branchId = '';
  notes = '';
  busy = signal(false);
  error = signal('');
  /** `datetime-local` trabaja en hora local, pero `toISOString()` devuelve UTC:
      usarlo directo corría el mínimo tantas horas como el huso (en Bolivia, 4),
      y no se podía agendar para hoy. Se descuenta el desfase antes de recortar. */
  private static localInput(date: Date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  minDateTime = AgendarVisitaComponent.localInput(new Date(Date.now() + 60 * 60 * 1000));
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
  /** Estado de una prenda en la sucursal elegida. */
  statusOf(variantId: string) {
    return this.availability().find((a) => a.variant_id === variantId) || null;
  }
  get unavailable() {
    return this.availability().filter((a) => !a.available);
  }
  /** Al cambiar de sucursal se vuelve a preguntar qué tallas hay ahí. */
  async onBranchChange() {
    this.availability.set([]);
    this.error.set('');
    const items = this.tryOn.items();
    if (!this.branchId || !items.length) return;
    this.checking.set(true);
    try {
      this.availability.set(
        await this.reservas.availability(
          this.branchId,
          items.map((i) => i.variant_id),
        ),
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.checking.set(false);
    }
  }
  removeItem(variantId: string) {
    this.tryOn.remove(variantId);
    void this.onBranchChange();
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
