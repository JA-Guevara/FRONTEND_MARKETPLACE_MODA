import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
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
              <span class="nav-label">{{ item.label }}</span>
              <span class="nav-lock">PRO</span>
            </a>
          } @else {
            <div class="nav-item-wrapper" [class.open]="isExpanded(item)">
              <div class="nav-i-row">
                <a
                  class="nav-i"
                  [routerLink]="item.path"
                  [class.has-active-child]="hasActiveChild(item)"
                  routerLinkActive="on"
                  [routerLinkActiveOptions]="{ exact: isExactNav(item) }"
                  [title]="item.label"
                >
                  <fs-icon [name]="item.icon" class="ic" />
                  <span class="nav-label">{{ item.label }}</span>
                  @if (isTrial(item)) { <span class="nav-trial">Prueba</span> }
                </a>
                @if (item.children && item.children.length > 1) {
                  <button
                    type="button"
                    class="nav-accordion-btn"
                    [class.expanded]="isExpanded(item)"
                    (click)="toggleExpand(item, $event)"
                    [title]="(isExpanded(item) ? 'Plegar ' : 'Desplegar ') + item.label"
                  >
                    <span class="nav-chevron" [class.rotated]="isExpanded(item)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
                        <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                      </svg>
                    </span>
                  </button>
                }
              </div>
              @if (item.children && item.children.length > 1 && isExpanded(item)) {
                <div class="nav-sub-list">
                  @for (child of item.children; track child.key) {
                    <a
                      class="nav-sub-i"
                      [routerLink]="child.path"
                      routerLinkActive="sub-on"
                      [routerLinkActiveOptions]="{ exact: true }"
                      [title]="subItemDescription(child.key)"
                    >
                      <span class="sub-dot"></span>
                      <div class="sub-text">
                        <span class="sub-label">{{ child.label }}</span>
                        @if (subItemDescription(child.key); as desc) {
                          <span class="sub-desc">{{ desc }}</span>
                        }
                      </div>
                    </a>
                  }
                </div>
              }
            </div>
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
  private router = inject(Router);
  private currentPath = toSignal(this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map(event => event.urlAfterRedirects.split('?')[0]),
  ), {initialValue: this.router.url.split('?')[0]});
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

  expandedMap = signal<Record<string, boolean>>({});

  isItemLocked(item: NavItem): boolean {
    return lockedByPlan(item, (feat) => this.session.hasFeature(feat));
  }

  isExactNav(item: NavItem): boolean {
    return item.path === '/admin' || item.path === '/admin/plataforma' || !!(item.children && item.children.length > 0);
  }

  isChildPathActive(childPath: string): boolean {
    const curr = this.currentPath();
    if (childPath === '/admin' || childPath === '/admin/plataforma') {
      return curr === childPath;
    }
    return curr === childPath || curr.startsWith(childPath + '/');
  }

  hasActiveChild(item: NavItem): boolean {
    if (!item.children || item.children.length === 0) return false;
    return item.children.some(child => this.isChildPathActive(child.path));
  }

  groupActive(item: NavItem): boolean {
    return this.hasActiveChild(item);
  }

  isExpanded(item: NavItem): boolean {
    const manual = this.expandedMap()[item.key];
    if (manual !== undefined) return manual;
    return this.hasActiveChild(item);
  }

  toggleExpand(item: NavItem, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    const curr = this.isExpanded(item);
    this.expandedMap.update(m => ({ ...m, [item.key]: !curr }));
  }

  subItemDescription(key: string): string {
    const descs: Record<string, string> = {
      ejecutivo: 'MRR, crecimiento y métricas clave',
      salud: 'Servicios, latencia e incidentes',
      despliegues: 'Diagnóstico técnico y versiones',
      continuidad: 'Respaldos y copias globales',
      dashboard: 'Resumen operativo del día',
      catalog: 'Prendas y existencias',
      pos: 'Punto de cobro y cajas',
      reservations: 'Vestidor y probadores',
      orders: 'Historial y devoluciones',
    };
    return descs[key] || '';
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
