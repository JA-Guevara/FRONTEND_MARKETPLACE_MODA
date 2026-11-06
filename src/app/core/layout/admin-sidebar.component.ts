import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { SoporteService } from '../../../features/plataforma-saas/application/soporte.service';
import { ConnectivityService } from '../offline/connectivity.service';
import { ApiService } from '../shared/api.service';
import { PlanCardComponent } from '../../../shared/ui/plan-card.component';
import { IconComponent } from '../../../shared/icon.component';
import {
  ADMIN_NAV,
  NavItem,
  lockedByPlan,
  visibleSections,
} from './admin-nav';

@Component({
  selector: 'fs-admin-sidebar',
  imports: [RouterLink, RouterLinkActive, PlanCardComponent, IconComponent],
  template: `
    <aside class="sidebar">
      @if (session.isSupport()) {
        <a class="nav-back" href="javascript:void(0)" (click)="volverConsola()">
          ← Volver a la consola de plataforma
        </a>
      }

      @for (sec of sections(); track sec.title) {
        <h4>{{ sec.title }}</h4>
        @for (item of sec.items; track item.key) {
          @if (isItemLocked(item)) {
            <a
              class="nav-i"
              routerLink="/admin/mi-suscripcion"
              [title]="item.label + ' (requiere plan superior)'"
            >
              <fs-icon [name]="item.icon" class="ic" />
              <span style="flex:1">{{ item.label }}</span>
              <span class="nav-lock">PRO</span>
            </a>
          } @else {
            <a
              class="nav-i"
              [routerLink]="item.path"
              routerLinkActive="on"
              [routerLinkActiveOptions]="{
                exact: item.path === '/admin' || item.path === '/admin/plataforma'
              }"
            >
              <fs-icon [name]="item.icon" class="ic" />
              <span style="flex:1">{{ item.label }}</span>
              @if (isTrial(item)) { <span class="nav-trial">Prueba</span> }
            </a>
          }
        }
      }

      @if (session.scope() === 'tenant' && session.subscription(); as sub) {
        <div class="side-plan">
          <fs-plan-card [subscription]="sub" [activeBranches]="activeBranches()" />
        </div>
      }
    </aside>
  `,
  styleUrl: './admin-sidebar.component.scss',
})
export class AdminSidebarComponent {
  session = inject(SessionService);
  private soporte = inject(SoporteService);
  private connection = inject(ConnectivityService);
  private api = inject(ApiService);

  activeBranches = signal(0);

  readonly sections = computed(() => {
    return visibleSections(ADMIN_NAV, {
      scope: this.session.scope(),
      isSupport: this.session.isSupport(),
      can: (perm) => this.session.can(perm),
    }).map((section) => ({
      ...section,
      items: section.items.map((item) => {
        const available = item.children?.find((child) => !this.isItemLocked(child));
        return available ? { ...item, path: available.path } : item;
      }),
    }));
  });

  constructor() {
    if (
      this.session.can('my_subscription.read') &&
      this.session.tenant() &&
      this.connection.online()
    ) {
      this.api
        .get<{ usage: { active_branches: number } }>('/tenant/subscription')
        .subscribe({
          next: (r) => this.activeBranches.set(r.usage.active_branches),
          error: () => {},
        });
    }
  }

  isItemLocked(item: NavItem): boolean {
    return lockedByPlan(item, (feat) => this.session.hasFeature(feat));
  }

  isTrial(item: NavItem): boolean {
    return !!item.feature && (this.session.modules?.() ?? []).some(
      (module) => module.code === item.feature && module.origin === 'TRIAL',
    );
  }

  volverConsola(): void {
    void this.soporte.terminar();
  }
}
