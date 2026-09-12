import { environment } from '../../../environments/environment';
import { Component, ElementRef, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../../features/auth/application/session.service';
import { ACCOUNT_SECTIONS } from '../../../features/auth/presentation/account-layout.component';
import { IconComponent } from '../../../shared/icon.component';
import { AssistantWidgetComponent } from '../../../features/ventas-pagos/presentation/assistant-widget.component';
@Component({
  selector: 'fs-site-layout',
  // El menú de cuenta se cierra al tocar fuera o al presionar Escape.
  host: {
    '(document:click)': 'closeMenuOutside($event)',
    '(document:keydown.escape)': 'menuOpen.set(false)',
  },
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent, AssistantWidgetComponent],
  template: ` <a class="skip-link" href="#main-content">Saltar al contenido</a>
    <div class="top-strip">
      {{ demo ? 'ENTORNO DE PRUEBA · DATOS TEMPORALES' : 'TU ESTILO. TU RITMO. TU FASHIONSTORE.' }}
    </div>
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" routerLink="/" aria-label="FashionStore inicio"
          >fashion<span>store</span><i>®</i></a
        >
        <nav aria-label="Navegación principal">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
            >Catálogo</a
          ><a routerLink="/sucursales" routerLinkActive="active">Sucursales</a>
          @if (session.administrative()) {
            <a routerLink="/admin" routerLinkActive="active">Administración</a>
          }
        </nav>
        <div class="account-nav">
          <a routerLink="/carrito" class="button cart-link" aria-label="Ver carrito de compras"><fs-icon name="cart" />Carrito</a>
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
  private host = inject(ElementRef<HTMLElement>);
  closeMenuOutside(event: Event) {
    if (!this.menuOpen()) return;
    const objetivo = event.target as Node;
    const menu = (this.host.nativeElement as HTMLElement).querySelector('.account-menu');
    if (menu && !menu.contains(objetivo)) this.menuOpen.set(false);
  }
  session = inject(SessionService);
  private router = inject(Router);
  busy = signal(false);
  notice = signal('');
  async logout() {
    this.menuOpen.set(false);
    this.busy.set(true);
    this.notice.set('');
    try {
      await firstValueFrom(this.session.logout());
    } catch {
      this.notice.set(
        'Se cerró la sesión en este navegador. No se pudo confirmar la revocación en el servidor.',
      );
    } finally {
      this.busy.set(false);
      await this.router.navigate(['/']);
    }
  }
}
