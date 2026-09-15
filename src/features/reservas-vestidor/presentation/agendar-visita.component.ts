import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommerceService } from '../../ventas-pagos/infrastructure/commerce.service';
import { ReservasService } from '../infrastructure/reservas.service';
import { TryOnListService } from '../application/try-on-list.service';
import { Branch } from '../../ventas-pagos/domain/commerce.models';
import {
  VariantAvailability,
  MAX_ITEM_QUANTITY,
  MIN_ITEM_QUANTITY,
} from '../domain/reservas.models';
import { IconComponent } from '../../../shared/icon.component';
import { errorMessage } from '../../../shared/errors';

type QueryState = 'idle' | 'checking' | 'error';

function newIdemKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return crypto.randomUUID() as string;
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

@Component({
  selector: 'fs-agendar-visita',
  styleUrl: './reservas.scss',
  imports: [FormsModule, RouterLink, IconComponent],
  template: `<section class="container section">
    <p class="eyebrow">RESERVAS</p>
    <h1>Agendar visita para probarte prendas</h1>
    <p class="muted">
      Elegí la sucursal y el horario aproximado. Vas a poder probarte estas prendas y decidir cuáles
      comprar cuando llegues a la tienda. La hora se interpreta en tu zona horaria (GMT-04:00,
      Bolivia).
    </p>
    @if (memoryOnly()) {
      <p class="alert error" role="alert">
        Este navegador no guarda la selección entre recargas. No cierres ni recargues la página
        antes de confirmar.
      </p>
    }
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
                <td>
                  <input
                    type="number"
                    aria-label="Cantidad de {{ i.name }} {{ i.size }} {{ i.color }}"
                    [min]="MIN_QTY"
                    [max]="MAX_QTY"
                    step="1"
                    [ngModel]="i.quantity"
                    (ngModelChange)="changeQuantity(i.variant_id, $event)"
                  />
                </td>
                <td>
                  @if (!branchId) {
                    <span class="muted">Sin consultar: elegí una sucursal</span>
                  } @else if (queryState() === 'checking') {
                    <span class="muted">Consultando…</span>
                  } @else if (queryState() === 'error') {
                    <span class="muted">Error de consulta</span>
                  } @else if (statusOf(i.variant_id); as estado) {
                    <span class="badge" [class.inactive]="!estado.available">
                      @if (estado.available) {
                        Disponible · {{ estado.requested }} pza(s) pedida(s), hay
                        {{ estado.quantity }}
                      } @else {
                        {{ estado.reason }}
                      }
                    </span>
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
      <form #f="ngForm" (ngSubmit)="submit()" class="toolbar">
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
        <button class="primary" type="submit" [disabled]="!canConfirm()">
          <fs-icon name="calendar" />{{ busy() ? 'Agendando…' : 'Confirmar visita' }}
        </button>
      </form>
      @if (unavailable.length) {
        <p class="alert error" role="alert">
          Esta sucursal no tiene o no alcanza para las cantidades que elegiste:
          {{ unavailable.map((a) => a.reason).join(' · ') }}. Reducí la cantidad, quitá esas prendas o
          probá con otra sucursal, así no viajás al local para nada.
        </p>
      }
      @if (!branchId) {
        <p class="muted">Elegí una sucursal para saber qué hay disponible antes de confirmar.</p>
      }
      <div class="form-actions">
        <a class="button" routerLink="/">Seguir explorando</a>
      </div>
    }
  </section>`,
})
export class AgendarVisitaComponent {
  readonly MIN_QTY = MIN_ITEM_QUANTITY;
  readonly MAX_QTY = MAX_ITEM_QUANTITY;
  tryOn = inject(TryOnListService);
  private commerce = inject(CommerceService);
  private reservas = inject(ReservasService);
  private router = inject(Router);
  branches = signal<Branch[]>([]);
  availability = signal<VariantAvailability[]>([]);
  queryState = signal<QueryState>('idle');
  branchId = '';
  notes = '';
  busy = signal(false);
  error = signal('');
  /** Generación de la consulta: si cambia antes de que llegue la respuesta de
   * una sucursal anterior, esa respuesta se descarta (Hallazgo H). */
  private requestId = 0;
  /** Clave idempotente del intento actual: estable para reintentos del mismo
   * envío y nueva cuando se confirma con éxito. */
  private idemKey: string | null = null;
  /** `datetime-local` trabaja en hora local, pero `toISOString()` devuelve UTC:
      usarlo directo corría el mínimo tantas horas como el huso (en Bolivia, 4),
      y no se podía agendar para hoy. Se descuenta el desfase antes de recortar. */
  private static localInput(date: Date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  /** Regla documentada, igual que el backend: la visita debe ser futura. El
   * mínimo se recorta al próximo minuto para no enviar una hora que ya pasó. */
  minDateTime = AgendarVisitaComponent.localInput(
    new Date(Date.now() + 60 * 1000),
  ).slice(0, 16);
  scheduledAt = this.minDateTime;
  memoryOnly = this.tryOn.memoryOnly;
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
  canConfirm() {
    const items = this.tryOn.items();
    if (!items.length || !this.branchId || !this.scheduledAt) return false;
    if (new Date(this.scheduledAt).getTime() <= Date.now()) return false;
    if (this.queryState() !== 'idle') return false;
    if (this.availability().length !== items.length) return false;
    return this.unavailable.length === 0;
  }
  /** Al cambiar la sucursal se vuelve a preguntar qué hay ahí (y si alcanza
   * para las cantidades pedidas). Una respuesta vieja no pisa a la nueva. */
  async onBranchChange() {
    const current = ++this.requestId;
    this.availability.set([]);
    this.error.set('');
    const items = this.tryOn.items();
    if (!this.branchId || !items.length) {
      this.queryState.set('idle');
      return;
    }
    this.queryState.set('checking');
    try {
      const result = await this.reservas.availability(this.branchId, items);
      if (current !== this.requestId) return; // llegó de una sucursal anterior
      this.availability.set(result);
      this.queryState.set('idle');
    } catch (e) {
      if (current !== this.requestId) return;
      this.queryState.set('error');
      this.error.set(errorMessage(e));
    }
  }
  changeQuantity(variantId: string, value: number) {
    this.tryOn.setQuantity(variantId, Number(value));
    void this.onBranchChange();
  }
  removeItem(variantId: string) {
    this.tryOn.remove(variantId);
    void this.onBranchChange();
  }
  async submit() {
    const items = this.tryOn.items();
    if (this.busy() || !this.canConfirm()) return;
    this.busy.set(true);
    this.error.set('');
    if (!this.idemKey) this.idemKey = newIdemKey();
    try {
      const reserva = await this.reservas.create(
        this.branchId,
        new Date(this.scheduledAt).toISOString(),
        items,
        this.notes,
        this.idemKey,
      );
      this.tryOn.clear();
      this.idemKey = null;
      await this.router.navigate(['/mi-cuenta/reservas'], {
        queryParams: { nueva: reserva.id },
      });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}