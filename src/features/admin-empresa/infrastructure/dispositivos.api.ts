import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { Dispositivo, DispositivoDetalle, FiltrosDispositivos } from '../domain/dispositivos.models';
import { Page } from '../../../shared/models';

@Injectable({ providedIn: 'root' })
export class DispositivosApi {
  private api = inject(ApiService);

  listar(filtros: FiltrosDispositivos = {}) {
    return firstValueFrom(this.api.get<Page<Dispositivo>>('/tenant/devices', filtros as Record<string, unknown>));
  }

  obtener(id: string) {
    return firstValueFrom(this.api.get<DispositivoDetalle>(`/tenant/devices/${id}`));
  }

  bloquear(id: string, reason: string, revokeSessions = false) {
    return firstValueFrom(
      this.api.write<DispositivoDetalle>('POST', `/tenant/devices/${id}/block`, {
        reason,
        revoke_sessions: revokeSessions,
      }),
    ).then((r: any) => (r && r.data ? r.data : r) as DispositivoDetalle);
  }

  desbloquear(id: string, reason?: string) {
    return firstValueFrom(
      this.api.write<DispositivoDetalle>('POST', `/tenant/devices/${id}/unblock`, { reason }),
    ).then((r: any) => (r && r.data ? r.data : r) as DispositivoDetalle);
  }

  renombrar(id: string, label: string) {
    return firstValueFrom(
      this.api.write<DispositivoDetalle>('PATCH', `/tenant/devices/${id}`, { label }),
    ).then((r: any) => (r && r.data ? r.data : r) as DispositivoDetalle);
  }
}
