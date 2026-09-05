import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../application/session.service';
import { errorMessage } from '../../../shared/errors';
@Component({
  selector: 'fs-account-page',
  imports: [RouterLink],
  template: `<section class="container narrow section">
    <p class="eyebrow">TU ESPACIO</p>
    <h1>Mi cuenta</h1>
    @if (session.user(); as user) {
      <div class="panel">
        <h2>{{ user.first_name }} {{ user.last_name }}</h2>
        <p>{{ user.email }}</p>
        <p>{{ user.phone || 'Sin teléfono registrado' }}</p>
        <span class="badge">{{
          user.is_verified ? 'Correo verificado' : 'Correo pendiente de verificación'
        }}</span>
        <div class="form-actions">
          <a class="button primary" routerLink="/mi-cuenta/direcciones">Mis direcciones</a
          ><a class="button" routerLink="/cambiar-contrasena">Cambiar contraseña</a>
          @if (!user.is_verified) {
            <button (click)="resend()" [disabled]="busy()">Reenviar verificación</button>
          }
        </div>
      </div>
    }
    @if (message()) {
      <p class="alert success" role="status">{{ message() }}</p>
    }
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }
  </section>`,
})
export class AccountPageComponent {
  session = inject(SessionService);
  busy = signal(false);
  message = signal('');
  error = signal('');
  async resend() {
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(
        this.session.request('resend-verification', { email: this.session.user()?.email }),
      );
      this.message.set(r.message);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
