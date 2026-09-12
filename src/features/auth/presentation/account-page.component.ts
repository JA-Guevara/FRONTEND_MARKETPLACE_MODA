import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../application/session.service';
import { errorMessage } from '../../../shared/errors';
import { ApiService } from '../../../app/core/shared/api.service';
import { EntityFormComponent } from '../../../shared/entity-form.component';
import { IconComponent } from '../../../shared/icon.component';
import { Field } from '../../../shared/form-schema';

/** Dirección del perfil, reutilizada al comprar. */
interface Address {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string;
  postal_code: string | null;
  country: string;
  reference: string | null;
  is_default: boolean;
}
@Component({
  selector: 'fs-account-page',
  imports: [RouterLink, EntityFormComponent, IconComponent],
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
          <a class="button primary" routerLink="/mi-cuenta/pedidos">Mis pedidos</a>
          <a class="button primary" routerLink="/mi-cuenta/direcciones">Mis direcciones</a
          ><a class="button" routerLink="/cambiar-contrasena">Cambiar contraseña</a>
          <button (click)="editing.set(!editing())" [disabled]="busy()">{{ editing() ? 'Cerrar edición' : 'Editar mis datos' }}</button>
          @if (!user.is_verified) {
            <button (click)="resend()" [disabled]="busy()">Reenviar verificación</button>
          }
        </div>
        @if (editing()) {
          <div class="profile-editor">
            <h3>Datos personales</h3>
            <p class="muted">Mantené tu nombre y teléfono actualizados para coordinar tus pedidos.</p>
            <fs-entity-form [fields]="fields" [value]="profileValue()" [busy]="busy()" (saved)="saveProfile($event)" (cancel)="editing.set(false)" />
          </div>
        }
      </div>
    }
    @if (session.user()) {
      <div class="panel profile-addresses">
        <div class="page-heading">
          <div>
            <h2>Mis direcciones</h2>
            <p class="muted">
              La predeterminada se completa sola al finalizar una compra, así no la reescribís cada
              vez.
            </p>
          </div>
          <a class="button" routerLink="/mi-cuenta/direcciones">
            <fs-icon name="plus" />Administrar
          </a>
        </div>
        @if (loadingAddresses()) {
          <p class="empty" role="status">Cargando direcciones…</p>
        } @else {
          @for (address of addresses(); track address.id) {
            <article class="address-card" [class.is-default]="address.is_default">
              <div>
                <strong>{{ address.label }}</strong>
                @if (address.is_default) {
                  <span class="badge">Predeterminada</span>
                }
                <p>{{ address.recipient_name }} · {{ address.phone }}</p>
                <p class="muted">
                  {{ address.address_line }} · {{ address.city
                  }}{{ address.postal_code ? ' · CP ' + address.postal_code : '' }}
                </p>
              </div>
              @if (!address.is_default) {
                <button (click)="makeDefault(address)" [disabled]="busy()">
                  <fs-icon name="check" />Usar como predeterminada
                </button>
              }
            </article>
          } @empty {
            <p class="empty">
              Todavía no guardaste direcciones. Agregá una y se usará automáticamente en tus
              próximos pedidos.
            </p>
          }
        }
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
  private api = inject(ApiService);
  editing = signal(false);
  fields: Field[] = [
    { key: 'first_name', label: 'Nombres', required: true, minLength: 2, maxLength: 100 },
    { key: 'last_name', label: 'Apellidos', required: true, minLength: 2, maxLength: 100 },
    { key: 'phone', label: 'Teléfono', maxLength: 30 },
  ];
  profileValue = computed(() => {
    const user = this.session.user();
    return user ? { id: user.id, first_name: user.first_name, last_name: user.last_name, phone: user.phone } : null;
  });
  async saveProfile(body: Record<string, unknown>) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.message.set('');
    try {
      await firstValueFrom(this.api.write('PATCH', '/commerce/profile', body));
      const user = this.session.user();
      if (user) this.session.user.set({ ...user, first_name: String(body['first_name']), last_name: String(body['last_name']), phone: body['phone'] ? String(body['phone']) : null });
      this.editing.set(false); this.message.set('Tus datos fueron actualizados.');
    } catch (error) { this.error.set(errorMessage(error)); }
    finally { this.busy.set(false); }
  }
  busy = signal(false);
  message = signal('');
  error = signal('');
  addresses = signal<Address[]>([]);
  loadingAddresses = signal(true);
  constructor() {
    void this.loadAddresses();
  }
  async loadAddresses() {
    this.loadingAddresses.set(true);
    try {
      this.addresses.set(await firstValueFrom(this.api.get<Address[]>('/users/me/addresses')));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loadingAddresses.set(false);
    }
  }
  /** El backend deja una sola predeterminada: al marcar esta, limpia el resto. */
  async makeDefault(address: Address) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await firstValueFrom(
        this.api.write('PATCH', `/users/me/addresses/${address.id}`, { is_default: true }),
      );
      this.message.set(`«${address.label}» quedó como dirección predeterminada.`);
      await this.loadAddresses();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
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
