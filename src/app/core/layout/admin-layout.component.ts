import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { ADMIN_NAV, lockedByPlan, visibleSections } from './admin-nav';
import { ConnectivityService } from '../offline/connectivity.service';
import { AdminTopbarComponent } from './admin-topbar.component';
import { SupportStripComponent } from './support-strip.component';
import { SubscriptionStripComponent } from './subscription-strip.component';
import { AdminSidebarComponent } from './admin-sidebar.component';
import { PlanLimitDialogComponent } from '../../../shared/ui/plan-limit-dialog.component';
import { CommandPaletteComponent } from './command-palette.component';

@Component({
  selector: 'fs-admin-layout',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    AdminTopbarComponent,
    SupportStripComponent,
    SubscriptionStripComponent,
    AdminSidebarComponent,
    PlanLimitDialogComponent,
    CommandPaletteComponent,
  ],
  template: `
    <fs-admin-topbar />
    @if (session.isSupport()) {
      <fs-support-strip />
    }
    <fs-subscription-strip />
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
        @if (tabs().length > 1) {
          <nav class="admin-section-tabs" aria-label="Secciones de administración">
            @for (tab of tabs(); track tab.key) {
              <a [routerLink]="tab.path" routerLinkActive="selected" ariaCurrentWhenActive="page"
                 [routerLinkActiveOptions]="{ exact: true }">{{ tab.label }}</a>
            }
          </nav>
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
  private router = inject(Router);
  private currentUrl = toSignal(this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map((event) => event.urlAfterRedirects),
  ), { initialValue: this.router.url });
  readonly tabs = computed(() => {
    const path = this.currentUrl().split(/[?#]/, 1)[0];
    const group = visibleSections(ADMIN_NAV, {
      scope: this.session.scope(),
      isSupport: this.session.isSupport(),
      can: (permission) => this.session.can(permission),
    }).flatMap((section) => section.items)
      .find((item) => item.children?.some((tab) => tab.path === path));
    return (group?.children ?? []).filter((tab) => !lockedByPlan(tab, (feature) => this.session.hasFeature(feature)));
  });
}
