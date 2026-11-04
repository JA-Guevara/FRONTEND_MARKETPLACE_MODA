import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { ConnectivityService } from '../offline/connectivity.service';
import { AdminTopbarComponent } from './admin-topbar.component';
import { SupportStripComponent } from './support-strip.component';
import { AdminSidebarComponent } from './admin-sidebar.component';
import { PlanLimitDialogComponent } from '../../../shared/ui/plan-limit-dialog.component';
import { CommandPaletteComponent } from './command-palette.component';

@Component({
  selector: 'fs-admin-layout',
  imports: [
    RouterLink,
    RouterOutlet,
    AdminTopbarComponent,
    SupportStripComponent,
    AdminSidebarComponent,
    PlanLimitDialogComponent,
    CommandPaletteComponent,
  ],
  template: `
    <fs-admin-topbar />
    @if (session.isSupport()) {
      <fs-support-strip />
    }
    <div class="admin-body">
      <button
        type="button"
        class="mobile-nav-toggle"
        (click)="sidebarOpen.set(!sidebarOpen())"
        aria-label="Alternar menú lateral"
      >
        ☰ {{ sidebarOpen() ? 'Cerrar navegación' : 'Menú de navegación' }}
      </button>
      @if (sidebarOpen()) {
        <div class="sidebar-backdrop" (click)="sidebarOpen.set(false)"></div>
      }
      <fs-admin-sidebar [class.open]="sidebarOpen()" />
      <section class="admin-content">
        @if (!connection.online()) {
          <div class="offline-strip">
            Sin conexión. Trabaja con el catálogo y las reservas de este dispositivo.
            <a routerLink="/sin-conexion/catalogo">Abrir catálogo local →</a>
          </div>
        }
        @if (session.readOnly()) {
          <div class="alert danger">
            <strong>Modo solo consulta</strong> · Tu suscripción está
            {{ session.subscription()?.status }}. Contacta al administrador para volver a operar.
          </div>
        }
        <router-outlet />
      </section>
    </div>
    <fs-plan-limit-dialog />
    <fs-command-palette />
  `,
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  session = inject(SessionService);
  connection = inject(ConnectivityService);
  sidebarOpen = signal(false);
}
