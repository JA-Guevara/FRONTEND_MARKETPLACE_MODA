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
          <span>Vista plataforma ▾</span>
        </button>

        @if (menuOpen()) {
          <div class="ctx-menu">
            <div class="input-wrap">
              <span class="search-ic">⌕</span>
              <input
                type="text"
                [(ngModel)]="searchQuery"
                (ngModelChange)="onSearchChange($event)"
                placeholder="Buscar empresa por nombre, NIT o slug…"
              />
            </div>

            @if (searchResults().length > 0) {
              <h5>Resultados</h5>
              @for (t of searchResults(); track t.id) {
                <div class="ctx-item">
                  <span class="logo-t">{{ getInitials(t.trade_name) }}</span>
                  <div style="flex:1">
                    <b>{{ t.trade_name }}</b>
                    <span class="sub">{{ t.slug }} · {{ t.status }}</span>
                  </div>
                  <button
                    type="button"
                    class="btn sm"
                    (click)="abrirAsistir(t)"
                  >
                    Asistir
                  </button>
                </div>
              }
            } @else if (soporte.recientes().length > 0) {
              <h5>Empresas recientes</h5>
              @for (r of soporte.recientes(); track r.id) {
                <div class="ctx-item">
                  <span class="logo-t">{{ getInitials(r.trade_name) }}</span>
                  <div style="flex:1">
                    <b>{{ r.trade_name }}</b>
                    <span class="sub">{{ r.slug ?? '' }}</span>
                  </div>
                  <button
                    type="button"
                    class="btn sm"
                    (click)="abrirAsistir(r)"
                  >
                    Asistir
                  </button>
                </div>
              }
            }

            <h5 style="margin-top: 10px">Ver todas</h5>
            <a
              routerLink="/admin/plataforma/empresas"
              class="ctx-item"
              (click)="menuOpen.set(false)"
            >
              <span>▦</span>
              <div>
                <b>Directorio de empresas</b>
                <span class="sub">Todas las empresas registradas</span>
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
  searchResults = signal<Tenant[]>([]);
  selectedTenantForSupport = signal<{ id: string; trade_name: string; slug?: string } | null>(null);

  private searchTimeout: any = null;

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.el.nativeElement.contains(e.target)) {
      this.menuOpen.set(false);
    }
  }

  togglePlatformMenu(): void {
    this.menuOpen.set(!this.menuOpen());
  }

  onSearchChange(val: string): void {
    clearTimeout(this.searchTimeout);
    if (!val || val.trim().length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.searchTimeout = setTimeout(() => {
      this.api.tenants({ search: val.trim() }).subscribe({
        next: (page) => this.searchResults.set(page.items),
        error: () => this.searchResults.set([]),
      });
    }, 300);
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
