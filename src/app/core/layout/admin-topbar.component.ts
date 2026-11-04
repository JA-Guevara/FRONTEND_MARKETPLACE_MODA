import {
  Component,
  ElementRef,
  HostListener,
  Injectable,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { ApiService } from '../shared/api.service';
import { ContextSwitcherComponent } from './context-switcher.component';
import { ConnectionBadgeComponent } from '../../../shared/ui/connection-badge.component';
import { NotificationsBellComponent } from '../../../features/ventas-pagos/presentation/notifications-bell.component';
import { IconComponent } from '../../../shared/icon.component';

@Injectable({ providedIn: 'root' })
export class BranchContextService {
  private readonly storageKey = 'fashionstore.branch';
  readonly branchId = signal<string | null>(null);

  constructor() {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (stored) {
        this.branchId.set(stored);
      }
    } catch {
      /* ignore */
    }
  }

  setBranchId(id: string | null): void {
    this.branchId.set(id);
    try {
      if (id) {
        sessionStorage.setItem(this.storageKey, id);
      } else {
        sessionStorage.removeItem(this.storageKey);
      }
    } catch {
      /* ignore */
    }
  }
}

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.set(!this.isOpen());
  }
}

@Component({
  selector: 'fs-admin-topbar',
  imports: [
    RouterLink,
    FormsModule,
    ContextSwitcherComponent,
    ConnectionBadgeComponent,
    NotificationsBellComponent,
    IconComponent,
  ],
  template: `
    <header class="topbar">
      <a routerLink="/admin" class="brand">
        <i>FS</i>
        <span>FashionStore</span>
      </a>

      <fs-context-switcher />

      @if (session.scope() === 'tenant') {
        <select
          class="branch-select"
          [ngModel]="branchService.branchId() ?? ''"
          (ngModelChange)="onBranchChange($event)"
          aria-label="Seleccionar sucursal"
        >
          <option value="">⌂ Todas las sucursales</option>
          @for (b of branches(); track b.id) {
            <option [value]="b.id">⌂ {{ b.name }}</option>
          }
        </select>
      }

      <span class="grow"></span>

      <button
        type="button"
        class="search-btn"
        (click)="openPalette()"
        aria-label="Abrir paleta de comandos"
      >
        <span>⌕ Buscar…</span>
        <span class="kbd">Ctrl K</span>
      </button>

      <fs-connection-badge />

      <fs-notifications-bell />

      <div class="user-wrap">
        <button
          type="button"
          class="user-btn"
          (click)="userMenuOpen.set(!userMenuOpen())"
          aria-haspopup="true"
          [attr.aria-expanded]="userMenuOpen()"
        >
          <span class="av">{{ initials() }}</span>
          <div class="user-info">
            <b>{{ userName() }}</b>
            <span class="muted">{{ userRole() }}</span>
          </div>
        </button>

        @if (userMenuOpen()) {
          <div class="user-menu" role="menu">
            <a routerLink="/mi-cuenta" (click)="userMenuOpen.set(false)" role="menuitem">
              <fs-icon name="users" /> Mi cuenta
            </a>
            <button type="button" (click)="toggleTheme()" role="menuitem">
              <fs-icon name="settings" /> Cambiar tema
            </button>
            <button type="button" (click)="logout()" role="menuitem">
              <fs-icon name="lock" /> Salir
            </button>
          </div>
        }
      </div>
    </header>
  `,
  styleUrl: './admin-topbar.component.scss',
})
export class AdminTopbarComponent {
  session = inject(SessionService);
  branchService = inject(BranchContextService);
  private cmdService = inject(CommandPaletteService);
  private api = inject(ApiService);
  private router = inject(Router);
  private el = inject(ElementRef);

  userMenuOpen = signal(false);
  branches = signal<{ id: string; name: string }[]>([]);

  constructor() {
    if (this.session.scope() === 'tenant' && this.session.can('branches.read')) {
      this.api.get<{ id: string; name: string }[]>('/organization/branches').subscribe({
        next: (list) => {
          if (Array.isArray(list)) {
            this.branches.set(list);
          }
        },
        error: () => {},
      });
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.el.nativeElement.contains(e.target)) {
      this.userMenuOpen.set(false);
    }
  }

  onBranchChange(val: string): void {
    this.branchService.setBranchId(val ? val : null);
  }

  openPalette(): void {
    this.cmdService.open();
  }

  userName(): string {
    const u = this.session.user();
    if (!u) return 'Usuario';
    return `${u.first_name} ${u.last_name}`.trim();
  }

  userRole(): string {
    if (this.session.isSupport()) {
      return 'Super administrador (soporte)';
    }
    if (this.session.isPlatformAdmin()) {
      return 'Super administrador';
    }
    const roles = this.session.user()?.roles ?? [];
    return roles[0]?.name ?? 'Usuario';
  }

  initials(): string {
    const u = this.session.user();
    if (!u) return 'FS';
    const first = u.first_name ? u.first_name[0] : '';
    const last = u.last_name ? u.last_name[0] : '';
    return (first + last).toUpperCase() || 'FS';
  }

  toggleTheme(): void {
    this.userMenuOpen.set(false);
    const dark =
      document.documentElement.dataset['theme'] === 'dark' ||
      (!document.documentElement.dataset['theme'] &&
        matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset['theme'] = dark ? 'light' : 'dark';
  }

  logout(): void {
    this.userMenuOpen.set(false);
    this.session.logout().subscribe(() => {
      void this.router.navigate(['/iniciar-sesion']);
    });
  }
}
