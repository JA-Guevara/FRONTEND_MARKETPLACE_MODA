import { environment } from '../../../environments/environment';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../../features/auth/application/session.service';
import { IconComponent } from '../../../shared/icon.component';
@Component({
  selector: 'fs-site-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent],
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
            <a routerLink="/mi-cuenta" class="account-name">Hola, {{ user.first_name }}</a
            ><button (click)="logout()" [disabled]="busy()">Salir</button>
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
    </footer>`,
})
export class SiteLayoutComponent {
  readonly demo = environment.demo;
  session = inject(SessionService);
  private router = inject(Router);
  busy = signal(false);
  notice = signal('');
  async logout() {
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
