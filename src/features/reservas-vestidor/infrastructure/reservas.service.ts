import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { Page } from '../../../shared/models';
import { Reservation, TryOnEntry, VariantAvailability } from '../domain/reservas.models';
@Injectable({ providedIn: 'root' })
export class ReservasService {
  private api = inject(ApiService);
  /** Crea una visita. El backend responde 201 con la reserva; una clave
   * idempotente (misma intento) hace que un reintento no duplique la visita. */
  async create(
    branch_id: string,
    scheduled_at: string,
    items: TryOnEntry[],
    notes: string,
    client_key: string,
  ): Promise<Reservation> {
    return (
      await firstValueFrom(
        this.api.write<Reservation>('POST', '/reservations', {
          branch_id,
          scheduled_at,
          notes: notes || null,
          client_key,
          items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
        }),
      )
    ).data;
  }
  /** Disponibilidad de cada talla/color y de la cantidad pedida, en la
   * sucursal elegida. ``quantities`` viaja alineado por posición. */
  availability(branch_id: string, items: TryOnEntry[]) {
    return firstValueFrom(
      this.api.get<VariantAvailability[]>('/reservations/availability', {
        branch_id,
        variant_ids: items.map((i) => i.variant_id),
        quantities: items.map((i) => i.quantity),
      }),
    );
  }
  mine(page = 1) {
    return firstValueFrom(
      this.api.get<Page<Reservation>>('/reservations', { page, page_size: 20 }),
    );
  }
  /** Detalle de una reserva del usuario actual (el backend lo filtra por
   * dueño; un id ajeno da 404). */
  get(id: string): Promise<Reservation> {
    return firstValueFrom(this.api.get<Reservation>('/reservations/' + id));
  }
  cancel(id: string): Promise<Reservation> {
    return firstValueFrom(this.api.write<Reservation>('POST', '/reservations/' + id + '/cancel')).then(
      (r) => r.data,
    );
  }
  admin(
    page = 1,
    branch_id = '',
    status = '',
    q = '',
    date_from = '',
    date_to = '',
    order = 'scheduled_at',
    direction = 'desc',
  ) {
    return firstValueFrom(
      this.api.get<Page<Reservation>>('/reservations/admin/all', {
        page,
        page_size: 20,
        branch_id,
        status,
        q,
        date_from,
        date_to,
        order,
        direction,
      }),
    );
  }
  updateStatus(id: string, status: string, note = ''): Promise<Reservation> {
    return firstValueFrom(
      this.api.write<Reservation>('PATCH', '/reservations/admin/' + id + '/status', {
        status,
        note,
      }),
    ).then((r) => r.data);
  }
}