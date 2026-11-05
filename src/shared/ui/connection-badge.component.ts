import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConnectivityService } from '../../app/core/offline/connectivity.service';
import { SincronizacionService } from '../../features/operacion-offline/application/sincronizacion.service';

@Component({
  selector: 'fs-connection-badge',
  imports: [CommonModule],
  template: `<span
    class="conn"
    [class.on]="connection.online()"
    [class.off]="!connection.online()"
    >{{ connection.online() ? 'En línea' : 'Sin conexión' }}
    @if (syncService?.sincronizando?.()) {
      <span class="sync-indicator"> · ⇅ Sincronizando...</span>
    } @else if ((syncService?.pendientesCount?.() ?? 0) > 0) {
      <span class="sync-indicator"> · {{ syncService?.pendientesCount?.() }} pendientes</span>
    }
  </span>`,
  styleUrl: './connection-badge.component.scss',
})
export class ConnectionBadgeComponent {
  connection = inject(ConnectivityService);
  syncService = inject(SincronizacionService, { optional: true });
}
