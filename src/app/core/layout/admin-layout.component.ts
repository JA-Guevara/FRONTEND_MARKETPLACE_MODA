import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent } from '../../../shared/icon.component';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { resources } from '../shared/resources';
import { ConnectivityService } from '../offline/connectivity.service';
import { PlanCardComponent } from '../../../shared/ui/plan-card.component';
import { PlanLimitDialogComponent } from '../../../shared/ui/plan-limit-dialog.component';
import { ApiService } from '../shared/api.service';
@Component({
  selector: 'fs-admin-layout',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    IconComponent,
    PlanCardComponent,
    PlanLimitDialogComponent,
  ],
  styleUrl: './admin-layout.component.scss',
  template: `<div class="admin-layout">
      <aside class="admin-sidebar">
        <button
          class="management-toggle"
          type="button"
          (click)="menuOpen.set(!menuOpen())"
          [attr.aria-expanded]="menuOpen()"
        >
          ☰ {{ menuOpen() ? 'Cerrar menú' : 'Menú de gestión' }}
        </button>
        <div class="management-menu" [class.collapsed]="!menuOpen()">
          <p class="eyebrow">ESPACIO DE GESTIÓN</p>
          @if (session.isPlatformAdmin()) {
            <h3>Plataforma SaaS</h3>
            <nav>
              <a routerLink="/admin/plataforma/empresas" routerLinkActive="active"
                ><fs-icon name="users" />Empresas</a
              >
              @if (session.can('plans.read')) {
                <a routerLink="/admin/plataforma/planes" routerLinkActive="active"
                  ><fs-icon name="grid" />Planes</a
                >
              }
            </nav>
          } @else {
            <h3>General</h3>
            <nav>
              <a
                routerLink="/admin"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: true }"
                ><fs-icon name="home" />Vista general</a
              >
              @if (session.can('dashboard.read')) {
                <a routerLink="/admin/dashboard" routerLinkActive="active"
                  ><fs-icon name="chart" />Reportes</a
                >
              }
            </nav>
            @for (group of groups; track group) {
              @if (groupItems(group).length) {
                <h3>{{ group }}</h3>
                <nav>
                  @for (item of groupItems(group); track item.key) {
                    <a [routerLink]="['/admin', item.key]" routerLinkActive="active"
                      ><fs-icon name="grid" />{{ item.title }}</a
                    >
                  }
                </nav>
              }
            }
            <h3>Ventas e inventario</h3>
            <nav>
              @for (item of business; track item.path) {
                @if (session.can(item.permission)) {
                  <a [routerLink]="item.path" routerLinkActive="active"
                    ><fs-icon [name]="item.icon" />{{ item.label }}</a
                  >
                }
              }
            </nav>
            @if (session.hasFeature('offline')) {
              <h3>Sin conexión</h3>
              <nav>
                <a routerLink="/sin-conexion" routerLinkActive="active"
                  ><fs-icon name="download" />Preparar dispositivo</a
                ><a routerLink="/sin-conexion/catalogo"><fs-icon name="grid" />Catálogo local</a
                ><a routerLink="/sin-conexion/reservas"
                  ><fs-icon name="calendar" />Reservas locales</a
                >
              </nav>
            }
            @if (session.can('my_subscription.read')) {
              <h3>Mi empresa</h3>
              <nav>
                <a routerLink="/admin/mi-suscripcion" routerLinkActive="active"
                  ><fs-icon name="settings" />Mi suscripción</a
                >
              </nav>
            }
          }
          @if (session.subscription(); as sub) {
            <fs-plan-card [subscription]="sub" [activeBranches]="activeBranches()" />
          }
          <div class="sidebar-note">
            FashionStore<br /><small>{{
              session.tenant()?.trade_name || 'Administración de plataforma'
            }}</small>
          </div>
        </div>
      </aside>
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
    <fs-plan-limit-dialog />`,
})
export class AdminLayoutComponent {
  session = inject(SessionService);
  connection = inject(ConnectivityService);
  private api = inject(ApiService);
  menuOpen = signal(false);
  activeBranches = signal(0);
  groups = ['Acceso y seguridad', 'Catálogo', 'Organización'];
  business = [
    { path: '/admin/pedidos', label: 'Pedidos y pagos', permission: 'commerce.read', icon: 'cart' },
    {
      path: '/admin/promociones',
      label: 'Cupones y promociones',
      permission: 'commerce.read',
      icon: 'tag',
    },
    {
      path: '/admin/devoluciones',
      label: 'Devoluciones',
      permission: 'commerce.read',
      icon: 'return',
    },
    { path: '/admin/caja', label: 'Caja', permission: 'commerce.write', icon: 'cart' },
    { path: '/admin/stock', label: 'Existencias', permission: 'stock.read', icon: 'grid' },
    {
      path: '/admin/reservas',
      label: 'Reservas',
      permission: 'reservations.read',
      icon: 'calendar',
    },
    {
      path: '/admin/probador',
      label: 'Recursos del probador',
      permission: 'catalog.read',
      icon: 'camera',
    },
    { path: '/admin/bitacora', label: 'Bitácora', permission: 'audit.read', icon: 'list' },
  ];
  constructor() {
    if (
      this.session.can('my_subscription.read') &&
      this.session.tenant() &&
      this.connection.online()
    )
      this.api
        .get<{ usage: { active_branches: number } }>('/tenant/subscription')
        .subscribe({
          next: (r) => this.activeBranches.set(r.usage.active_branches),
          error: () => {},
        });
  }
  groupItems(group: string) {
    return resources.filter((r) => r.group === group && this.session.can(r.permission));
  }
}
