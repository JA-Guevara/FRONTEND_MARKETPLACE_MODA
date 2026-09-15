import { Component, inject, signal } from '@angular/core';
import { IconComponent } from '../../../shared/icon.component';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../../../features/auth/application/session.service';
import { resources } from '../shared/resources';
@Component({
  selector: 'fs-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent],
  styles: [
    `
      .management-toggle {
        display: none;
      }
      @media (max-width: 760px) {
        .management-toggle {
          display: flex;
          width: 100%;
          min-height: 44px;
          margin-bottom: 8px;
        }
        .management-menu.collapsed {
          display: none;
        }
      }
    `,
  ],
  template: `<div class="admin-layout">
    <aside class="admin-sidebar">
      <button
        class="management-toggle"
        type="button"
        (click)="menuOpen.set(!menuOpen())"
        [attr.aria-expanded]="menuOpen()"
        aria-controls="management-menu"
      >
        <fs-icon name="menu" />{{ menuOpen() ? 'Cerrar menú de gestión' : 'Menú de gestión' }}
      </button>
      <div id="management-menu" class="management-menu" [class.collapsed]="!menuOpen()">
        <p class="eyebrow">ESPACIO DE GESTIÓN</p>
        <a
          class="admin-overview"
          routerLink="/admin"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          >Vista general</a
        >
        @if (session.can('dashboard.read')) {
          <a class="admin-overview" routerLink="/admin/dashboard" routerLinkActive="active"
            >Dashboard<span>↗</span></a
          >
        }
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
        @if (session.can('commerce.read') || session.can('stock.read') || session.can('reservations.read')) {
          <h3>Ventas e inventario</h3>
          <nav aria-label="Ventas e inventario">
            @if (session.can('commerce.read')) {
              <a routerLink="/admin/pedidos" routerLinkActive="active"
                >Pedidos y pagos<span>↗</span></a
              >
            }
            @if (session.can('stock.read')) {
              <a routerLink="/admin/stock" routerLinkActive="active">Existencias<span>↗</span></a>
            }
            @if (session.can('reservations.read')) {
              <a routerLink="/admin/reservas" routerLinkActive="active">Reservas<span>↗</span></a>
            }
          </nav>
        }
        <div class="sidebar-note">FashionStore<br /><small>Administración del catálogo</small></div>
      </div>
    </aside>
    <section class="admin-content"><router-outlet /></section>
  </div>`,
})
export class AdminLayoutComponent {
  session = inject(SessionService);
  menuOpen = signal(false);
  groups = ['Acceso y seguridad', 'Catálogo', 'Organización'];
  groupItems(group: string) {
    return resources.filter((r) => r.group === group && this.session.can(r.permission));
  }
}
