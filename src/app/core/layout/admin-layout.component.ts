import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../../../features/auth/application/session.service';
import { resources } from '../shared/resources';
@Component({
  selector: 'fs-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `<div class="admin-layout">
    <aside class="admin-sidebar">
      <p class="eyebrow">ESPACIO DE GESTIÓN</p>
      <a
        class="admin-overview"
        routerLink="/admin"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
        >Vista general</a
      >
      @for (group of groups; track group) {
        @if (groupItems(group).length) {
          <h3>{{ group }}</h3>
          <nav [attr.aria-label]="group">
            @for (item of groupItems(group); track item.key) {
              <a [routerLink]="['/admin', item.key]" routerLinkActive="active"
                >{{ item.title }}<span>↗</span></a
              >
            }
          </nav>
        }
      }
      @if (session.can('audit.read')) {
        <h3>Actividad</h3>
        <nav aria-label="Actividad">
          <a routerLink="/admin/bitacora" routerLinkActive="active">Bitácora<span>↗</span></a>
        </nav>
      }
      <div class="sidebar-note">FashionStore<br /><small>Administración del catálogo</small></div>
    </aside>
    <section class="admin-content"><router-outlet /></section>
  </div>`,
})
export class AdminLayoutComponent {
  session = inject(SessionService);
  groups = ['Acceso y seguridad', 'Catálogo', 'Organización'];
  groupItems(group: string) {
    return resources.filter((r) => r.group === group && this.session.can(r.permission));
  }
}
