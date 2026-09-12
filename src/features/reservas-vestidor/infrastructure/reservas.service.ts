import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { Page } from '../../../shared/models';
import { Reservation, TryOnEntry } from '../domain/reservas.models';
@Injectable({ providedIn: 'root' })
export class ReservasService {
  private api = inject(ApiService);
  create(branch_id: string, scheduled_at: string, items: TryOnEntry[], notes: string) {
    return firstValueFrom(
      this.api.write<Reservation>('POST', '/reservations', {
        branch_id,
        scheduled_at,
        notes: notes || null,
        items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
      }),
    );
  }
  mine(page = 1) {
    return firstValueFrom(
      this.api.get<Page<Reservation>>('/reservations', { page, page_size: 20 }),
    );
  }
  cancel(id: string) {
    return firstValueFrom(this.api.write<Reservation>('POST', '/reservations/' + id + '/cancel'));
  }
  admin(page = 1, branch_id = '', status = '') {
    return firstValueFrom(
      this.api.get<Page<Reservation>>('/reservations/admin/all', {
        page,
        page_size: 50,
        branch_id,
        status,
      }),
    );
  }
  updateStatus(id: string, status: string, note = '') {
    return firstValueFrom(
      this.api.write<Reservation>('PATCH', '/reservations/admin/' + id + '/status', {
        status,
        note,
      }),
    );
  }
}
