import { environment } from '../../../environments/environment';
import { Component, ElementRef, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../../features/auth/application/session.service';
import { TryOnListService } from '../../../features/reservas-vestidor/application/try-on-list.service';
import { ACCOUNT_SECTIONS } from '../../../features/auth/presentation/account-layout.component';
import { IconComponent } from '../../../shared/icon.component';
import { AssistantWidgetComponent } from '../../../features/ventas-pagos/presentation/assistant-widget.component';
import { CartStateService } from '../../../features/ventas-pagos/application/cart-state.service';
@Component({
  selector: 'fs-site-layout',
  host: {
    '(document:click)': 'closeOutside($event)',
    '(document:keydown.escape)': 'onEscape()',
  },
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent, AssistantWidgetComponent],
  styles: `
    :host { display: contents; }
    /* ── Boton hamburguesa: solo visible en movil ── */
    .nav-toggle { display: none; }
    /* ── Separador visual de gestion ── */
    .nav-separator { display: inline-block; width: 1px; height: 18px; background: var(--line); margin: 0 8px; vertical-align: middle; }
    /* ── Badge del carrito (mismo patron que .visit-counter) ── */
    .cart-counter {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 18px; height: 18px; margin-left: 6px; padding: 0 5px;
      border-radius: 30px; background: var(--accent); color: white;
      font-size: 10px; line-height: 1;
    }
    @media (prefers-reduced-motion: reduce) {
      .nav-toggle, .main-nav { transition: none !important; }
    }
    @media (max-width: 760px) {
      .nav-toggle {
        display: inline-flex; align-items: center; gap: 6px;
        min-height: 44px; min-width: 44px; padding: 7px 14px;
        background: var(--paper); border: 1px solid var(--line);
        border-radius: 12px; color: var(--ink); font-size: 13px; cursor: pointer;
      }
      .main-nav:not(.is-open) { display: none; }
      .main-nav.is-open {
        display: flex; flex-direction: column; gap: 2px; width: 100%; order: 3;
        padding: 10px 0 14px;
      }
      .main-nav.is-open a, .main-nav.is-open .nav-separator { margin: 0; }
      .main-nav.is-open .nav-separator { display: none; }
      .cart-counter { font-size: 9px; min-width: 16px; height: 16px; padding: 0 4px; }
    }
  `,
  template: ` <a class="skip-link" href="#main-content">Saltar al contenido</a>
    <div class="top-strip">
      {{ demo ? 'ENTORNO DE PRUEBA · DATOS TEMPORALES' : 'TU ESTILO. TU RITMO. TU FASHIONSTORE.' }}
    </div>
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" routerLink="/" aria-label="FashionStore inicio"
          >fashion<span>store</span><i>®</i></a
        >
        <button type="button" class="nav-toggle" [attr.aria-expanded]="navOpen()" aria-controls="main-nav"
          (click)="navOpen.set(!navOpen())">
          <fs-icon [name]="navOpen() ? 'close' : 'menu'"/>{{ navOpen() ? 'Cerrar' : 'Menú' }}
        </button>
        <nav class="main-nav" [class.is-open]="navOpen()" id="main-nav"
             aria-label="Navegación principal" (click)="navOpen.set(false)">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Catálogo</a>
          <a routerLink="/sucursales" routerLinkActive="active">Sucursales</a>
          @if (session.administrative()) {
            <span class="nav-separator" aria-hidden="true"></span>
            <a routerLink="/admin" routerLinkActive="active">Gestión</a>
          }
        </nav>
        <div class="account-nav">
          <a routerLink="/agendar-visita" class="button visit-link" aria-label="Revisar selección para probarte prendas en sucursal"><fs-icon name="calendar" />Mi visita@if (tryOn.distinctCount) {<span class="visit-counter" aria-label="{{ tryOn.distinctCount }} variantes seleccionadas">{{ tryOn.distinctCount }}</span>}</a>
          <a routerLink="/carrito" class="button cart-link" aria-label="Ver carrito de compras"><fs-icon name="cart" />Carrito@if (cart.count()) {<span class="cart-counter" aria-label="{{ cart.count() }} prendas en el carrito">{{ cart.count() }}</span>}</a>
          @if (session.user(); as user) {
            <div class="account-menu">
              <button
                class="account-name"
                type="button"
                [attr.aria-expanded]="menuOpen()"
                aria-haspopup="true"
                (click)="menuOpen.set(!menuOpen())"
              >
                <fs-icon name="users" />Hola, {{ user.first_name }}
              </button>
              @if (menuOpen()) {
                <div class="account-dropdown" role="menu">
                  <p class="account-greeting">
                    Bienvenido de nuevo,<br /><strong>{{ user.first_name }} {{ user.last_name }}</strong>
                  </p>
                  @for (item of accountSections; track item.path) {
                    <a
                      [routerLink]="item.path"
                      role="menuitem"
                      (click)="menuOpen.set(false)"
                    >
                      <fs-icon [name]="item.icon" />{{ item.label }}
                    </a>
                  }
                  <button type="button" role="menuitem" (click)="logout()" [disabled]="busy()">
                    <fs-icon name="close" />{{ busy() ? 'Cerrando…' : 'Desconectar' }}
                  </button>
                </div>
              }
            </div>
          } @else {
            <a routerLink="/iniciar-sesion">Ingresar</a
            ><a routerLink="/registrarse" class="button primary">Crear cuenta</a>
          }
        </div>
      </div>
    </header>
    @if (notice()) {
      <p class="container alert error" role="alert">{{ notice() }}</p>
    }
    <main id="main-content"><router-outlet /></main>
    <footer class="site-footer">
      <div class="container footer-inner">
        <a class="brand" routerLink="/">fashion<span>store</span></a>
        <p>Prendas para vivir a tu manera.</p>
        <a routerLink="/sucursales">Encontrá tu sucursal ↗</a>
      </div>
    </footer>
    @if (session.user()) {
      <fs-assistant-widget />
    }`,
})
export class SiteLayoutComponent {
  readonly demo = environment.demo;
  readonly accountSections = ACCOUNT_SECTIONS;
  menuOpen = signal(false);
  navOpen = signal(false);
  private host = inject(ElementRef<HTMLElement>);
  session = inject(SessionService);
  cart = inject(CartStateService);
  tryOn = inject(TryOnListService);
  private router = inject(Router);
  busy = signal(false);
  notice = signal('');

  closeOutside(event: Event) {
    if (this.menuOpen()) {
      const target = event.target as Node;
      const menu = (this.host.nativeElement as HTMLElement).querySelector('.account-menu');
      if (menu && !menu.contains(target)) this.menuOpen.set(false);
    }
  }

  onEscape() {
    if (this.navOpen()) {
      this.navOpen.set(false);
      const toggle = (this.host.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.nav-toggle');
      toggle?.focus();
      return;
    }
    this.menuOpen.set(false);
  }

  async logout() {
    this.menuOpen.set(false);
    this.busy.set(true);
    this.notice.set('');
    this.tryOn.clear();
    try {
      await firstValueFrom(this.session.logout());
    } catch {
      this.notice.set(
        'Se cerró la sesión en este navegador. No se pudo confirmar la revocación en el servidor.',
      );
    } finally {
      this.cart.count.set(0);
      this.busy.set(false);
      await this.router.navigate(['/']);
    }
  }
}
