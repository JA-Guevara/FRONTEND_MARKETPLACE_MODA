import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../application/session.service';
import { IconComponent } from '../../../shared/icon.component';
import { errorMessage } from '../../../shared/errors';

/** Secciones del espacio personal del cliente. */
export const ACCOUNT_SECTIONS = [
  { path: '/mi-cuenta', icon: 'users', label: 'Mi perfil', hint: 'Datos personales', exact: true },
  { path: '/mi-cuenta/direcciones', icon: 'box', label: 'Mis direcciones', hint: 'Entrega y facturación' },
  { path: '/mi-cuenta/pedidos', icon: 'cart', label: 'Mis pedidos', hint: 'Compras y pagos' },
  { path: '/mi-cuenta/reservas', icon: 'calendar', label: 'Mis reservas', hint: 'Visitas a sucursal' },
  { path: '/cambiar-contrasena', icon: 'lock', label: 'Seguridad', hint: 'Cambiar contraseña' },
];

/**
 * Contenedor de todas las pantallas personales. Reúne perfil, direcciones,
 * pedidos, reservas y seguridad en un solo espacio con menú propio, en lugar de
 * páginas sueltas alcanzables solo desde botones dispersos.
 */
@Component({
  selector: 'fs-account-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent],
  template: `<section class="container section account-shell">
    <div class="account-layout">
      <aside class="account-sidebar">
        @if (session.user(); as user) {
          <div class="account-identity">
            <span class="account-avatar" aria-hidden="true">{{ initials(user) }}</span>
            <div>
              <strong>{{ user.first_name }} {{ user.last_name }}</strong>
              <small>{{ user.email }}</small>
            </div>
          </div>
        }
        <nav aria-label="Secciones de mi cuenta">
          @for (item of sections; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: !!item.exact }"
            >
              <fs-icon [name]="item.icon" />
              <span>
                {{ item.label }}
                <small>{{ item.hint }}</small>
              </span>
            </a>
          }
        </nav>
        <button class="account-signout" (click)="logout()" [disabled]="busy()">
          <fs-icon name="close" />{{ busy() ? 'Cerrando…' : 'Cerrar sesión' }}
        </button>
      </aside>
      <div class="account-content"><router-outlet /></div>
    </div>
    @if (notice()) {
      <p class="alert error" role="alert">{{ notice() }}</p>
    }
  </section>`,
})
export class AccountLayoutComponent {
  session = inject(SessionService);
  private router = inject(Router);
  readonly sections = ACCOUNT_SECTIONS;
  busy = signal(false);
  notice = signal('');
  initials(user: { first_name: string; last_name: string }) {
    return ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || '·';
  }
  async logout() {
    this.busy.set(true);
    this.notice.set('');
    try {
      await firstValueFrom(this.session.logout());
    } catch (error) {
      this.notice.set(errorMessage(error));
    } finally {
      this.busy.set(false);
      await this.router.navigate(['/']);
    }
  }
}
