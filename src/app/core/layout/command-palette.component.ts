import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DialogFocusDirective } from '../../../shared/dialog-focus.directive';
import { IconComponent } from '../../../shared/icon.component';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { PlataformaApi } from '../../../features/plataforma-saas/infrastructure/plataforma.api';
import { CommandPaletteService } from './admin-topbar.component';
import {
  ADMIN_NAV,
  NavItem,
  visibleSections,
} from './admin-nav';
import { Tenant } from '../../../features/plataforma-saas/domain/empresa.models';
import { GlobalUser } from '../../../features/plataforma-saas/domain/consola.models';
import { IniciarSoporteDialogComponent } from '../../../features/plataforma-saas/presentation/iniciar-soporte-dialog.component';

export interface CommandItem {
  id: string;
  type: 'nav' | 'tenant' | 'user';
  label: string;
  sub?: string;
  icon: string;
  path?: string;
  action?: () => void;
  tenantData?: Tenant;
}

@Component({
  selector: 'fs-command-palette',
  imports: [
    FormsModule,
    DialogFocusDirective,
    IconComponent,
    IniciarSoporteDialogComponent,
  ],
  template: `
    @if (isOpen()) {
      <div class="cmd-backdrop" (click)="onBackdrop($event)">
        <div
          class="cmd"
          role="dialog"
          aria-modal="true"
          aria-label="Paleta de comandos"
          (dismissed)="close()"
          (keydown)="onKeyDown($event)"
        >
          <div class="q">
            <span style="color:var(--muted)">⌕</span>
            <input
              #searchInput
              type="text"
              [ngModel]="query()"
              (ngModelChange)="onQueryChange($event)"
              placeholder="Buscar comando, pantalla o recurso…"
              autocomplete="off"
            />
            <span class="kbd">ESC</span>
          </div>

          <div class="results-wrap">
            @if (allResults().length === 0) {
              <div class="empty">No se encontraron resultados para «{{ query() }}»</div>
            } @else {
              @if (navResults().length > 0) {
                <div class="grp">
                  <h5>Navegación</h5>
                  @for (it of navResults(); track it.id; let idx = $index) {
                    <button
                      type="button"
                      class="it"
                      [class.on]="selectedIndex() === getGlobalIndex(it)"
                      (click)="execute(it)"
                      (mouseenter)="selectedIndex.set(getGlobalIndex(it))"
                    >
                      <fs-icon [name]="it.icon" class="ic" />
                      <b>{{ it.label }}</b>
                      @if (it.sub) {
                        <span class="sub">{{ it.sub }}</span>
                      }
                      <kbd>↵</kbd>
                    </button>
                  }
                </div>
              }

              @if (tenantResults().length > 0) {
                <div class="grp">
                  <h5>Empresas</h5>
                  @for (it of tenantResults(); track it.id) {
                    <div
                      class="it"
                      [class.on]="selectedIndex() === getGlobalIndex(it)"
                      (click)="execute(it)"
                      (mouseenter)="selectedIndex.set(getGlobalIndex(it))"
                    >
                      <fs-icon name="users" class="ic" />
                      <div style="flex:1">
                        <b>{{ it.label }}</b>
                        <span class="sub">{{ it.sub }}</span>
                      </div>
                      <div class="actions">
                        <button
                          type="button"
                          class="btn sm"
                          (click)="irA360(it, $event)"
                        >
                          360°
                        </button>
                        <button
                          type="button"
                          class="btn sm primary"
                          (click)="asistir(it, $event)"
                        >
                          ⛑ Asistir
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }

              @if (userResults().length > 0) {
                <div class="grp">
                  <h5>Usuarios</h5>
                  @for (it of userResults(); track it.id) {
                    <button
                      type="button"
                      class="it"
                      [class.on]="selectedIndex() === getGlobalIndex(it)"
                      (click)="execute(it)"
                      (mouseenter)="selectedIndex.set(getGlobalIndex(it))"
                    >
                      <fs-icon name="users" class="ic" />
                      <div style="flex:1">
                        <b>{{ it.label }}</b>
                        <span class="sub">{{ it.sub }}</span>
                      </div>
                      <kbd>↵</kbd>
                    </button>
                  }
                </div>
              }
            }
          </div>
        </div>
      </div>
    }

    @if (supportDialogTenant()) {
      <fs-iniciar-soporte-dialog
        [tenant]="supportDialogTenant()!"
        (closed)="supportDialogTenant.set(null)"
      />
    }
  `,
  styleUrl: './command-palette.component.scss',
})
export class CommandPaletteComponent {
  session = inject(SessionService);
  private cmdService = inject(CommandPaletteService);
  private api = inject(PlataformaApi);
  private router = inject(Router);

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly query = signal('');
  selectedIndex = signal(0);
  supportDialogTenant = signal<Tenant | null>(null);

  tenantsFound = signal<Tenant[]>([]);
  usersFound = signal<GlobalUser[]>([]);
  private searchDebounce: any = null;

  readonly isOpen = computed(() => this.cmdService.isOpen());

  readonly navItems = computed<CommandItem[]>(() => {
    const sections = visibleSections(ADMIN_NAV, {
      scope: this.session.scope(),
      isSupport: this.session.isSupport(),
      can: (perm) => this.session.can(perm),
    });

    const items: CommandItem[] = [];
    for (const sec of sections) {
      for (const it of sec.items) {
        items.push({
          id: `nav-${it.key}`,
          type: 'nav',
          label: it.label,
          sub: sec.title,
          icon: it.icon,
          path: it.path,
        });
      }
    }
    return items;
  });

  readonly navResults = computed<CommandItem[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.navItems();
    if (!q) return all;
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.sub && item.sub.toLowerCase().includes(q))
    );
  });

  readonly tenantResults = computed<CommandItem[]>(() => {
    return this.tenantsFound().map((t) => ({
      id: `tenant-${t.id}`,
      type: 'tenant',
      label: t.trade_name,
      sub: `${t.slug} · ${t.status}`,
      icon: 'users',
      tenantData: t,
      path: `/admin/plataforma/empresas/${t.id}`,
    }));
  });

  readonly userResults = computed<CommandItem[]>(() => {
    return this.usersFound().map((u) => ({
      id: `user-${u.id}`,
      type: 'user',
      label: `${u.first_name} ${u.last_name}`,
      sub: `${u.email} · ${u.tenant_name ?? 'Plataforma'}`,
      icon: 'users',
      path: `/admin/plataforma/usuarios`,
    }));
  });

  readonly allResults = computed<CommandItem[]>(() => {
    return [
      ...this.navResults(),
      ...this.tenantResults(),
      ...this.userResults(),
    ];
  });

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.toggle();
    }
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.query.set('');
    this.selectedIndex.set(0);
    this.tenantsFound.set([]);
    this.usersFound.set([]);
    this.cmdService.open();
    queueMicrotask(() => {
      this.searchInput?.nativeElement?.focus();
    });
  }

  close(): void {
    this.cmdService.close();
  }

  onBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('cmd-backdrop')) {
      this.close();
    }
  }

  onQueryChange(val: string): void {
    this.query.set(val);
    this.selectedIndex.set(0);
    clearTimeout(this.searchDebounce);
    const q = val.trim();
    if (!q || this.session.scope() !== 'platform') {
      this.tenantsFound.set([]);
      this.usersFound.set([]);
      return;
    }

    this.searchDebounce = setTimeout(() => {
      this.api.tenants({ search: q }).subscribe({
        next: (page) => this.tenantsFound.set(page.items.slice(0, 5)),
        error: () => this.tenantsFound.set([]),
      });
      this.api.users({ search: q }).subscribe({
        next: (page) => this.usersFound.set(page.items.slice(0, 5)),
        error: () => this.usersFound.set([]),
      });
    }, 250);
  }

  getGlobalIndex(item: CommandItem): number {
    return this.allResults().findIndex((x) => x.id === item.id);
  }

  onKeyDown(e: KeyboardEvent): void {
    const list = this.allResults();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex.update((i) => (i + 1 < list.length ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex.update((i) => (i - 1 >= 0 ? i - 1 : list.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = list[this.selectedIndex()];
      if (current) {
        this.execute(current);
      }
    }
  }

  execute(item: CommandItem): void {
    this.close();
    if (item.action) {
      item.action();
    } else if (item.path) {
      void this.router.navigateByUrl(item.path);
    }
  }

  irA360(item: CommandItem, e: MouseEvent): void {
    e.stopPropagation();
    this.close();
    if (item.tenantData) {
      void this.router.navigate(['/admin/plataforma/empresas', item.tenantData.id]);
    }
  }

  asistir(item: CommandItem, e: MouseEvent): void {
    e.stopPropagation();
    this.close();
    if (item.tenantData) {
      this.supportDialogTenant.set(item.tenantData);
    }
  }
}
