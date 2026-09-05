import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../application/session.service';
import { passwordError } from '../domain/password';
import { errorMessage } from '../../../shared/errors';

@Component({
  selector: 'fs-auth-page',
  imports: [FormsModule, RouterLink],
  template: ` <section class="auth-layout">
    <div class="auth-story">
      <p class="eyebrow">FASHIONSTORE / TU ESTILO</p>
      <h1>Tu próxima<br />historia empieza<br />con vos.</h1>
      <p>Descubrí prendas, explorá colecciones y encontrá tu estilo en un solo lugar.</p>
      <a routerLink="/">Explorar el catálogo ↗</a><span class="story-mark">F.</span>
    </div>
    <div class="auth-panel">
      <a class="back-link" routerLink="/">← Volver al catálogo</a>
      <p class="eyebrow">MI CUENTA</p>
      <h2>{{ title() }}</h2>
      <p class="muted">{{ subtitle() }}</p>
      @if (error()) {
        <p class="alert error" role="alert">{{ error() }}</p>
      }
      @if (message()) {
        <p class="alert success" role="status">{{ message() }}</p>
      }
      @if (!done()) {
        <form #form="ngForm" (ngSubmit)="submit(form)" class="auth-form">
          @if (mode === 'register') {
            <div class="form-grid">
              <label
                >Nombres<input
                  name="first_name"
                  [(ngModel)]="firstName"
                  required
                  minlength="2"
                  maxlength="100"
                  autocomplete="given-name" /></label
              ><label
                >Apellidos<input
                  name="last_name"
                  [(ngModel)]="lastName"
                  required
                  minlength="2"
                  maxlength="100"
                  autocomplete="family-name"
              /></label>
            </div>
          }
          @if (['login', 'register', 'forgot', 'resend'].includes(mode)) {
            <label
              >Correo electrónico<input
                type="email"
                name="email"
                [(ngModel)]="email"
                required
                email
                autocomplete="email"
            /></label>
          }
          @if (mode === 'register') {
            <label
              >Teléfono <span class="muted">(opcional)</span
              ><input name="phone" [(ngModel)]="phone" maxlength="30" autocomplete="tel"
            /></label>
          }
          @if (mode === 'change') {
            <label
              >Contraseña actual<input
                type="password"
                name="currentPassword"
                [(ngModel)]="currentPassword"
                required
                autocomplete="current-password"
            /></label>
          }
          @if (['login', 'register', 'reset', 'change'].includes(mode)) {
            <label
              >{{ mode === 'login' ? 'Contraseña' : 'Nueva contraseña' }}
              <div class="password-input">
                <input
                  [type]="showPassword ? 'text' : 'password'"
                  name="password"
                  [(ngModel)]="password"
                  required
                  [maxlength]="128"
                  [attr.autocomplete]="mode === 'login' ? 'current-password' : 'new-password'"
                /><button
                  type="button"
                  (click)="showPassword = !showPassword"
                  [attr.aria-label]="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                >
                  {{ showPassword ? 'Ocultar' : 'Ver' }}
                </button>
              </div></label
            >
            @if (mode !== 'login') {
              <small
                >Entre 12 y 128 caracteres, mayúscula, minúscula, número y símbolo. No incluyas el
                nombre de tu correo.</small
              ><label
                >Repetir contraseña<input
                  type="password"
                  name="confirmPassword"
                  [(ngModel)]="confirmPassword"
                  required
                  autocomplete="new-password"
              /></label>
            }
          }
          @if (['verify', 'reset'].includes(mode) && !token) {
            <p class="alert error">Falta el enlace del correo. Solicitá uno nuevo.</p>
          }
          @if (mode === 'login') {
            <a routerLink="/recuperar-contrasena">Olvidé mi contraseña</a>
          }
          <button
            type="submit"
            class="primary"
            [disabled]="busy() || (['verify', 'reset'].includes(mode) && !token)"
          >
            {{ busy() ? 'Procesando…' : buttonLabel() }}
          </button>
        </form>
      }
      <div class="auth-links">
        @if (mode === 'login') {
          <p>¿Todavía no tenés cuenta? <a routerLink="/registrarse">Crear cuenta</a></p>
        } @else {
          <a routerLink="/iniciar-sesion">Ir a iniciar sesión</a>
        }
        <a routerLink="/reenviar-verificacion">Reenviar verificación de correo</a>
      </div>
    </div>
  </section>`,
})
export class AuthPageComponent {
  session = inject(SessionService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  mode = 'login';
  token = '';
  email = '';
  password = '';
  confirmPassword = '';
  currentPassword = '';
  firstName = '';
  lastName = '';
  phone = '';
  showPassword = false;
  busy = signal(false);
  error = signal('');
  message = signal('');
  done = signal(false);
  constructor() {
    this.route.data.subscribe((data) => {
      this.mode = data['mode'];
      this.token = this.route.snapshot.queryParamMap.get('token') || '';
      if (this.mode === 'forgot' && this.token) this.mode = 'reset';
      this.error.set('');
      this.message.set(
        this.route.snapshot.queryParamMap.has('expired')
          ? 'Tu sesión terminó. Volvé a ingresar.'
          : '',
      );
      this.done.set(false);
      this.password = '';
      this.confirmPassword = '';
    });
  }
  title() {
    return (
      {
        login: 'Qué bueno verte de nuevo',
        register: 'Creá tu cuenta',
        forgot: 'Recuperá tu contraseña',
        reset: 'Elegí una nueva contraseña',
        verify: 'Verificá tu correo',
        resend: 'Reenviar verificación',
        change: 'Cambiar contraseña',
      } as Record<string, string>
    )[this.mode];
  }
  subtitle() {
    return this.mode === 'login'
      ? 'Ingresá para acceder a tu cuenta.'
      : this.mode === 'register'
        ? 'Completá tus datos para formar parte de FashionStore.'
        : this.mode === 'verify'
          ? 'Confirmá el correo asociado a tu cuenta.'
          : 'Seguí los pasos para mantener el acceso a tu cuenta.';
  }
  buttonLabel() {
    return (
      {
        login: 'Iniciar sesión',
        register: 'Crear cuenta',
        forgot: 'Enviar enlace',
        reset: 'Guardar contraseña',
        verify: 'Verificar correo',
        resend: 'Enviar verificación',
        change: 'Cambiar contraseña',
      } as Record<string, string>
    )[this.mode];
  }
  async submit(form: NgForm) {
    if (this.busy()) return;
    this.error.set('');
    form.control.markAllAsTouched();
    if (form.invalid) {
      this.error.set('Revisá los campos obligatorios y el formato del correo.');
      return;
    }
    if (['register', 'reset', 'change'].includes(this.mode)) {
      const problem = passwordError(this.password, this.email || this.session.user()?.email);
      if (problem) {
        this.error.set(problem);
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.error.set('Las contraseñas no coinciden.');
        return;
      }
    }
    this.busy.set(true);
    try {
      if (this.mode === 'login') {
        await firstValueFrom(this.session.login(this.email, this.password));
        const target = this.route.snapshot.queryParamMap.get('returnUrl');
        await this.router.navigateByUrl(
          target?.startsWith('/') && !target.startsWith('//') && !target.includes('://')
            ? target
            : '/',
        );
      } else {
        const payloads: Record<string, { action: string; body: unknown }> = {
          register: {
            action: 'register',
            body: {
              email: this.email.trim().toLowerCase(),
              password: this.password,
              first_name: this.firstName.trim(),
              last_name: this.lastName.trim(),
              phone: this.phone.trim() || null,
            },
          },
          forgot: { action: 'forgot-password', body: { email: this.email.trim().toLowerCase() } },
          resend: {
            action: 'resend-verification',
            body: { email: this.email.trim().toLowerCase() },
          },
          reset: {
            action: 'reset-password',
            body: { token: this.token, new_password: this.password },
          },
          verify: { action: 'verify-email', body: { token: this.token } },
          change: {
            action: 'change-password',
            body: { current_password: this.currentPassword, new_password: this.password },
          },
        };
        const task = payloads[this.mode];
        const response = await firstValueFrom(this.session.request(task.action, task.body));
        this.message.set(response.message);
        this.done.set(true);
        if (['reset', 'change'].includes(this.mode)) this.session.clear();
        if (this.mode === 'verify' && this.session.user())
          await firstValueFrom(this.session.reloadUser());
        this.password = '';
        this.currentPassword = '';
        this.confirmPassword = '';
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
