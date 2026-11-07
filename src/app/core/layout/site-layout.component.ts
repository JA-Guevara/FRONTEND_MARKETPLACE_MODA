import { resolveStoreSlug } from '../tenant.interceptor';
import { ConnectionBadgeComponent } from '../../../shared/ui/connection-badge.component';
import { environment } from '../../../environments/environment';
import { Component, ElementRef, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, firstValueFrom, map } from 'rxjs';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { TryOnListService } from '../../../features/reservas-vestidor/application/try-on-list.service';
import { ACCOUNT_SECTIONS } from '../../../features/usuarios-catalogo/presentation/account-layout.component';
import { IconComponent } from '../../../shared/icon.component';
import { NotificationsBellComponent } from '../../../features/ventas-pagos/presentation/notifications-bell.component';
import { CartStateService } from '../../../features/ventas-pagos/application/cart-state.service';

@Component({
  selector: 'fs-site-layout',
  host: {
    '(document:click)': 'closeOutside($event)',
    '(document:keydown.escape)': 'onEscape()',
  },
  imports: [
    ConnectionBadgeComponent,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    IconComponent,
    NotificationsBellComponent,
  ],
  styles: `
    :host {
      display: contents;
    }
    /* ── Boton hamburguesa: solo visible en movil ── */
    .nav-toggle {
      display: none;
    }
    /* ── Separador visual de gestion ── */
    .nav-separator {
      display: inline-block;
      width: 1px;
      height: 18px;
      background: var(--line);
      margin: 0 8px;
      vertical-align: middle;
    }
    /* ── Badge del carrito (mismo patron que .visit-counter) ── */
    .cart-counter {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      margin-left: 6px;
      padding: 0 5px;
      border-radius: 30px;
      background: var(--accent);
      color: var(--on-accent);
      font-size: 10px;
      line-height: 1;
    }
    @media (prefers-reduced-motion: reduce) {
      .nav-toggle,
      .main-nav {
        transition: none !important;
      }
    }
    @media (max-width: 760px) {
      .nav-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 44px;
        min-width: 44px;
        padding: 7px 14px;
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 12px;
        color: var(--ink);
        font-size: 13px;
        cursor: pointer;
      }
      .main-nav:not(.is-open) {
        display: none;
      }
      .main-nav.is-open {
        display: flex;
        flex-direction: column;
        gap: 2px;
        width: 100%;
        order: 3;
        padding: 10px 0 14px;
      }
      .main-nav.is-open a,
      .main-nav.is-open .nav-separator {
        margin: 0;
      }
      .main-nav.is-open .nav-separator {
        display: none;
      }
      .cart-counter {
        font-size: 9px;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
      }
    }
  `,
  template: ` <a class="skip-link" href="#main-content">Saltar al contenido</a>
    @if (workspace()) {
      <header class="workspace-header">
        <a class="workspace-brand" routerLink="/admin"><i>FS</i> FashionStore</a
        ><span class="tenant-switch">{{
          session.isPlatformAdmin()
            ? 'Consola de plataforma'
            : session.tenant()?.trade_name || 'Mi empresa'
        }}</span
        ><span class="workspace-spacer"></span><fs-connection-badge /><button
          class="theme-toggle"
          (click)="toggleTheme()"
          aria-label="Cambiar tema"
        >
          ◐
        </button>
        <div class="workspace-user">
          <span class="workspace-avatar"
            >{{ session.user()?.first_name?.slice(0, 1)
            }}{{ session.user()?.last_name?.slice(0, 1) }}</span
          ><span
            ><strong>{{ session.user()?.first_name }} {{ session.user()?.last_name }}</strong
            ><small>{{
              session.isPlatformAdmin() ? 'FashionStore SaaS' : session.subscription()?.plan_name
            }}</small></span
          >
        </div>
        <button (click)="logout()" [disabled]="busy()" aria-label="Cerrar sesión">Salir</button>
      </header>
    } @else if (!adminShell()) {
      <div class="top-strip">
        {{
          isLanding()
            ? 'FASHIONSTORE SAAS · PLATAFORMA OMNICANAL PARA MARCAS DE MODA'
            : (demo ? 'ENTORNO DE PRUEBA · DATOS TEMPORALES' : 'TU ESTILO. TU RITMO. TU FASHIONSTORE.')
        }}
      </div>
      <header class="site-header" [class.is-landing-header]="isLanding()">
        <div class="container header-inner">
          @if (isLanding()) {
            <a class="brand saas-brand" routerLink="/" aria-label="FashionStore SaaS inicio">
              <span class="logo-pill">FS</span>
              fashion<span>store</span> <small class="saas-badge">SaaS</small>
            </a>
          } @else {
            <a class="brand" routerLink="/" aria-label="FashionStore inicio"
              >fashion<span>store</span><i>®</i></a
            >
          }

          <button
            type="button"
            class="nav-toggle"
            [attr.aria-expanded]="navOpen()"
            aria-controls="main-nav"
            (click)="navOpen.set(!navOpen())"
          >
            <fs-icon [name]="navOpen() ? 'close' : 'menu'" />{{ navOpen() ? 'Cerrar' : 'Menú' }}
          </button>

          <nav
            class="main-nav"
            [class.is-open]="navOpen()"
            id="main-nav"
            aria-label="Navegación principal"
            (click)="navOpen.set(false)"
          >
            @if (isLanding()) {
              <a href="#soluciones">Soluciones</a>
              <a href="#modulos">Módulos</a>
              <a href="#planes">Planes</a>
              <a href="#marcas">Tiendas</a>
              <a href="#faq">Preguntas</a>
            } @else {
              <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
                >Tiendas</a
              >
              @if (storeSlug(); as slug) {
                <a [routerLink]="['/tienda', slug]" routerLinkActive="active">Catálogo de la tienda</a>
                <a [routerLink]="['/tienda', slug, 'sucursales']" routerLinkActive="active">Sucursales</a>
              }
            }
            @if (session.administrative()) {
              <span class="nav-separator" aria-hidden="true"></span>
              <a routerLink="/admin" routerLinkActive="active">Gestión</a>
            }
          </nav>

          <div class="account-nav">
            <fs-connection-badge />
            @if (!isLanding()) {
              @if (session.administrative() && session.tenant(); as tenant) {
                <span class="tenant-switch"
                  >{{ tenant.trade_name }} · {{ session.subscription()?.plan_name }}</span
                >
              }
              <a
                routerLink="/reservar" [queryParams]="storeQuery()"
                class="button visit-link"
                aria-label="Revisar selección para reservar y probarte prendas en sucursal"
                ><fs-icon name="calendar" />Reservas
                @if (tryOn.distinctCount) {
                  <span
                    class="visit-counter"
                    aria-label="{{ tryOn.distinctCount }} variantes seleccionadas"
                    >{{ tryOn.distinctCount }}</span
                  >
                }
              </a>
              <a routerLink="/carrito" [queryParams]="storeQuery()" class="button cart-link" aria-label="Ver carrito de compras"
                ><fs-icon name="cart" />Carrito
                @if (cart.count()) {
                  <span class="cart-counter" aria-label="{{ cart.count() }} prendas en el carrito">{{
                    cart.count()
                  }}</span>
                }
              </a>
            }

            @if (session.user()) {
              <!-- La campanita solo tiene sentido con sesión: los avisos son personales. -->
              <fs-notifications-bell />
            }

            @if (session.user(); as user) {
              <div class="account-menu">
                <button
                  class="account-name"
                  type="button"
                  [attr.aria-expanded]="menuOpen()"
                  aria-haspopup="true"
                  (click)="menuOpen.set(!menuOpen())"
                >
                  <span class="user-avatar-circle">{{ user.first_name.slice(0, 1) }}{{ user.last_name.slice(0, 1) }}</span>
                  <span>Hola, {{ user.first_name }}</span>
                </button>
                @if (menuOpen()) {
                  <div class="account-dropdown" role="menu">
                    <p class="account-greeting">
                      Bienvenido de nuevo,<br /><strong
                        >{{ user.first_name }} {{ user.last_name }}</strong
                      ><br />
                      <small class="muted">{{
                        session.isPlatformAdmin()
                          ? 'Superadmin de Plataforma'
                          : (session.tenant()?.trade_name || 'Mi empresa') + ' · ' + (session.subscription()?.plan_name || 'Plan Activo')
                      }}</small>
                    </p>
                    @if (session.administrative()) {
                      <a routerLink="/admin" role="menuitem" class="highlight" (click)="menuOpen.set(false)" style="font-weight:700;color:var(--accent,#74394e)">
                        <fs-icon name="grid" />Consola de Gestión
                      </a>
                    }
                    @for (item of accountSections; track item.path) {
                      <a [routerLink]="item.path" role="menuitem" (click)="menuOpen.set(false)">
                        <fs-icon [name]="item.icon" />{{ item.label }}
                      </a>
                    }
                    <button type="button" role="menuitem" (click)="logout()" [disabled]="busy()">
                      <fs-icon name="close" />{{ busy() ? 'Cerrando…' : 'Desconectar' }}
                    </button>
                  </div>
                }
              </div>
              @if (isLanding() && session.administrative()) {
                <a routerLink="/admin" class="button primary cta-go-admin">Ir a la Consola →</a>
              }
            } @else {
              <!-- Opciones de ingreso cuando NO está autenticado -->
              <div class="ingress-group" [class.is-landing-ingress]="isLanding()">
                <div class="login-split">
                  <a routerLink="/iniciar-sesion" [queryParams]="storeQuery()" class="btn-login-main">
                    <fs-icon name="users" />Ingresar
                  </a>
                  <button
                    type="button"
                    class="btn-login-toggle"
                    [attr.aria-expanded]="loginMenuOpen()"
                    (click)="toggleLoginMenu($event)"
                    title="Opciones de acceso"
                  >
                    ▾
                  </button>
                  @if (loginMenuOpen()) {
                    <div class="login-menu-dropdown" role="menu">
                      <a routerLink="/iniciar-sesion" role="menuitem" (click)="loginMenuOpen.set(false)" class="dropdown-item">
                        <span class="icon">🏢</span>
                        <div class="menu-text">
                          <strong>Consola de Empresa</strong>
                          <small>Para propietarios, administradores y vendedores</small>
                        </div>
                      </a>
                      <a routerLink="/iniciar-sesion" role="menuitem" (click)="loginMenuOpen.set(false)" class="dropdown-item">
                        <span class="icon">🛍️</span>
                        <div class="menu-text">
                          <strong>Portal de Cliente</strong>
                          <small>Consulta tus reservas y pedidos</small>
                        </div>
                      </a>
                      <a routerLink="/iniciar-sesion" role="menuitem" (click)="loginMenuOpen.set(false)" class="dropdown-item">
                        <span class="icon">⚡</span>
                        <div class="menu-text">
                          <strong>Plataforma Global</strong>
                          <small>Consola de superadministración SaaS</small>
                        </div>
                      </a>
                    </div>
                  }
                </div>

                @if (isLanding()) {
                  <a routerLink="/crear-tienda" class="button primary btn-crear-tienda">
                    <span>Crear mi Tienda</span>
                    <small class="free-badge">14 días gratis</small>
                  </a>
                  <a routerLink="/registrarse" class="btn-subtle-reg" title="Registro para compradores">Crear cuenta</a>
                } @else {
                  <a routerLink="/registrarse" [queryParams]="storeQuery()" class="button primary">Crear cuenta</a>
                }
              </div>
            }
          </div>
        </div>
      </header>
    }
    @if (notice()) {
      <p class="container alert error" role="alert">{{ notice() }}</p>
    }
    <main id="main-content"><router-outlet /></main>
    @if (!workspace() && !adminShell() && !isLanding()) {
      <footer class="site-footer">
        <div class="container footer-inner">
          <a class="brand" routerLink="/">fashion<span>store</span></a>
          <p>Prendas para vivir a tu manera.</p>
          @if (storeSlug(); as slug) {
            <a [routerLink]="['/tienda', slug, 'sucursales']">Encontrá tu sucursal ↗</a>
          } @else {
            <a routerLink="/">Ver tiendas ↗</a>
          }
        </div>
      </footer>
    }
  `,
})
export class SiteLayoutComponent {
  readonly demo = environment.demo;
  readonly accountSections = ACCOUNT_SECTIONS;
  menuOpen = signal(false);
  navOpen = signal(false);
  loginMenuOpen = signal(false);
  private host = inject(ElementRef<HTMLElement>);
  session = inject(SessionService);
  cart = inject(CartStateService);
  tryOn = inject(TryOnListService);
  private router = inject(Router);

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects || e.url),
    ),
    { initialValue: this.router.url },
  );

  readonly isLanding = computed(() => {
    const url = this.currentUrl().split(/[?#]/, 1)[0];
    return url === '' || url === '/';
  });

  storeSlug() {
    return resolveStoreSlug(this.currentUrl()) ?? this.session.tenant()?.slug;
  }

  storeQuery() {
    const slug = this.storeSlug();
    return slug ? { tienda: slug } : {};
  }

  workspace() {
    return /^\/sin-conexion(\/|$)/.test(this.currentUrl());
  }

  adminShell() {
    return /^\/admin(\/|$|\?)/.test(this.currentUrl());
  }

  toggleTheme() {
    const dark =
      document.documentElement.dataset['theme'] === 'dark' ||
      (!document.documentElement.dataset['theme'] &&
        matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset['theme'] = dark ? 'light' : 'dark';
  }

  toggleLoginMenu(event: Event) {
    event.stopPropagation();
    this.loginMenuOpen.set(!this.loginMenuOpen());
  }

  busy = signal(false);
  notice = signal('');

  closeOutside(event: Event) {
    const target = event.target as Node;
    if (this.menuOpen()) {
      const menu = (this.host.nativeElement as HTMLElement).querySelector('.account-menu');
      if (menu && !menu.contains(target)) this.menuOpen.set(false);
    }
    if (this.loginMenuOpen()) {
      const split = (this.host.nativeElement as HTMLElement).querySelector('.login-split');
      if (split && !split.contains(target)) this.loginMenuOpen.set(false);
    }
  }

  onEscape() {
    if (this.loginMenuOpen()) {
      this.loginMenuOpen.set(false);
      return;
    }
    if (this.navOpen()) {
      this.navOpen.set(false);
      const toggle = (this.host.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        '.nav-toggle',
      );
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
