import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { ConnectivityService } from '../../app/core/offline/connectivity.service';
@Component({
  selector: 'fs-connection-badge',
  imports: [],
  template: `<span
    class="conn"
    [class.on]="connection.online()"
    [class.off]="!connection.online()"
    >{{ connection.online() ? 'En línea' : 'Sin conexión' }}</span
  >`,
  styleUrl: './connection-badge.component.scss',
})
export class ConnectionBadgeComponent {
  connection = inject(ConnectivityService);
}
