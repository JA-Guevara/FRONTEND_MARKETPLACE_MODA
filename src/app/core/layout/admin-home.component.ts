import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { resources } from '../shared/resources';
import { SessionService } from '../../../features/auth/application/session.service';
@Component({
  selector: 'fs-admin-home',
  imports: [RouterLink],
  template: `<p class="eyebrow">FASHIONSTORE / ADMINISTRACIÓN</p>
    <h1>Todo en su lugar.</h1>
    <p class="muted">Hola, {{ session.user()?.first_name }}. Elegí un área para comenzar.</p>
    <div class="admin-cards">
      @for (item of available(); track item.key) {
        <a class="panel admin-card" [routerLink]="['/admin', item.key]"
          ><p class="eyebrow">{{ item.group }}</p>
          <h2>{{ item.title }} <span>↗</span></h2>
          <p>
            {{
              session.can(item.writePermission)
                ? 'Consultar y gestionar registros'
                : 'Consultar registros'
            }}
          </p></a
        >
      } @empty {
        <div class="panel">Tu cuenta no tiene permisos administrativos asignados.</div>
      }
      @if (session.can('audit.read')) {
        <a class="panel admin-card" routerLink="/admin/bitacora"
          ><p class="eyebrow">ACTIVIDAD</p>
          <h2>Bitácora ↗</h2>
          <p>Consultar el historial de operaciones</p></a
        >
      }
    </div>`,
})
export class AdminHomeComponent {
  session = inject(SessionService);
  available() {
    return resources.filter((r) => this.session.can(r.permission));
  }
}
