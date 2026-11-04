import {
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { PlataformaApi } from '../../../features/plataforma-saas/infrastructure/plataforma.api';
import { SoporteService } from '../../../features/plataforma-saas/application/soporte.service';
import { Tenant } from '../../../features/plataforma-saas/domain/empresa.models';
import { IniciarSoporteDialogComponent } from '../../../features/plataforma-saas/presentation/iniciar-soporte-dialog.component';

@Component({
  selector: 'fs-context-switcher',
  imports: [RouterLink, FormsModule, IniciarSoporteDialogComponent],
  template: `
    @if (session.isSupport()) {
      <div class="ctx">
        <button
          type="button"
          class="ctx-btn support"
          (click)="menuOpen.set(!menuOpen())"
          aria-haspopup="true"
          [attr.aria-expanded]="menuOpen()"
        >
          <span class="logo-t">{{ getInitials(session.tenant()?.trade_name) }}</span>
          <span>{{ session.tenant()?.trade_name }} · soporte ▾</span>
        </button>

        @if (menuOpen()) {
          <div class="ctx-menu">
            <button
              type="button"
              class="ctx-item"
              (click)="terminarSoporte()"
            >
              <span class="av">⌘</span>
              <div>
                <b>Vista plataforma</b>
                <span class="sub">Termina la sesión de soporte y vuelve al tablero</span>
              </div>
            </button>
          </div>
        }
      </div>
    } @else if (session.isPlatformAdmin()) {
      <div class="ctx">
        <button
          type="button"
          class="ctx-btn"
          (click)="togglePlatformMenu()"
          aria-haspopup="true"
          [attr.aria-expanded]="menuOpen()"
        >
          <span class="av">⌘</span>
          <span>Plataforma · <b>elegir empresa</b> ▾</span>
        </button>
        @if (menuOpen()) {
          <div class="ctx-menu" role="dialog" aria-label="Elegir empresa">
            <div class="input-wrap">
              <span class="search-ic">⌕</span>
              <input
                type="text"
                [(ngModel)]="searchQuery"
                (ngModelChange)="onSearchChange($event)"
                placeholder="Buscar empresa por nombre, NIT o slug…"
                aria-label="Buscar empresa"
              />
            </div>
            <h5>{{ searchQuery.trim().length >= 2 ? 'Resultados' : 'Empresas' }} · {{ total() }}</h5>
            @if (loading()) {
              <p class="ctx-empty">Cargando empresas…</p>
            } @else if (error()) {
              <p class="ctx-empty">{{ error() }}</p>
            } @else if (lista().length === 0) {
              <p class="ctx-empty">No hay empresas que coincidan.</p>
            }
            <div class="ctx-list">
              @for (t of lista(); track t.id) {
                <div class="ctx-item">
                  <span class="logo-t">{{ getInitials(t.trade_name) }}</span>
                  <div class="ctx-main">
                    <b>{{ t.trade_name }}</b>
                    <span class="sub"
                      >{{ t.plan_name ?? 'Sin plan' }} · {{ t.subscription_status ?? t.status }} ·
                      {{ t.active_branches }} suc.</span
                    >
                  </div>
                  <a
                    class="btn sm"
                    [routerLink]="['/admin/plataforma/empresas', t.id]"
                    (click)="menuOpen.set(false)"
                    title="Ver ficha 360° de la empresa"
                    >360°</a
                  >
                  <button type="button" class="btn sm" (click)="abrirAsistir(t)" title="Entrar como soporte">
                    Asistir
                  </button>
                </div>
              }
            </div>
            <a
              routerLink="/admin/plataforma/empresas"
              class="ctx-item ctx-all"
              (click)="menuOpen.set(false)"
            >
              <span>▦</span>
              <div>
                <b>Directorio de empresas</b>
                <span class="sub">Filtros, altas, suscripciones y estado</span>
              </div>
            </a>
          </div>
        }
      </div>
    } @else if (session.tenant(); as tenant) {
      <div class="tenant-pill">
        <span class="av">{{ getInitials(tenant.trade_name) }}</span>
        <span>{{ tenant.trade_name }}</span>
        @if (session.subscription()?.plan_name; as plan) {
          · <span class="badge plan">{{ plan }}</span>
        }
      </div>
    }

    @if (selectedTenantForSupport()) {
      <fs-iniciar-soporte-dialog
        [tenant]="selectedTenantForSupport()!"
        (closed)="onDialogClosed($event)"
      />
    }
  `,
  styleUrl: './context-switcher.component.scss',
})
export class ContextSwitcherComponent {
  session = inject(SessionService);
  soporte = inject(SoporteService);
  private api = inject(PlataformaApi);
  private el = inject(ElementRef);

  menuOpen = signal(false);
  searchQuery = '';
  /** Lista visible al abrir el menú (primeras empresas) o resultados de la búsqueda. */
  lista = signal<Tenant[]>([]);
  total = signal(0);
  loading = signal(false);
  error = signal('');
  selectedTenantForSupport = signal<{ id: string; trade_name: string; slug?: string } | null>(null);
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.el.nativeElement.contains(e.target)) {
      this.menuOpen.set(false);
    }
  }

  togglePlatformMenu(): void {
    const open = !this.menuOpen();
    this.menuOpen.set(open);
    if (open && this.lista().length === 0) {
      this.cargar('');
    }
  }

  onSearchChange(val: string): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    const q = (val ?? '').trim();
    this.searchTimeout = setTimeout(() => this.cargar(q.length >= 2 ? q : ''), 300);
  }

  private cargar(search: string): void {
    this.loading.set(true);
    this.error.set('');
    this.api.tenants({ search: search || undefined, page_size: 8 }).subscribe({
      next: (page) => {
        this.lista.set(page.items);
        this.total.set(page.total ?? page.items.length);
        this.loading.set(false);
      },
      error: () => {
        this.lista.set([]);
        this.total.set(0);
        this.error.set('No se pudo cargar la lista de empresas.');
        this.loading.set(false);
      },
    });
  }

  abrirAsistir(t: { id: string; trade_name: string; slug?: string }): void {
    this.menuOpen.set(false);
    this.selectedTenantForSupport.set(t);
  }

  onDialogClosed(started: boolean): void {
    this.selectedTenantForSupport.set(null);
  }

  terminarSoporte(): void {
    this.menuOpen.set(false);
    void this.soporte.terminar();
  }

  getInitials(name?: string | null): string {
    if (!name) return 'FS';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
}
