import { TiendasPublicasApi, TiendaPublica } from '../../publico/infrastructure/tiendas-publicas.api';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../application/session.service';
import { passwordError } from '../domain/password';
import { errorMessage } from '../../../shared/errors';
import { IconComponent } from '../../../shared/icon.component';

@Component({
  selector: 'fs-auth-page',
  imports: [FormsModule, RouterLink, IconComponent],
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
          @if (mode === 'login' || mode === 'register') {
            @if (fixedStore(); as fixedSlug) {
              <div class="store-badge-card" style="margin-bottom:14px;padding:10px 14px;border-radius:8px;background:var(--surface,#f5f5f5);border:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:8px">
                <span>Tienda: <strong>{{ fixedStoreName() }}</strong></span>
                <button type="button" (click)="unlockStore()" style="background:none;border:none;color:var(--primary,#6c1b33);cursor:pointer;font-size:12px;font-weight:600">Cambiar</button>
              </div>
            } @else {
            <label>Empresa o tienda
              <select name="empresa" [(ngModel)]="empresa" required [disabled]="busy()">
                <option value="">Seleccioná una empresa</option>
                @if (mode === 'login') { <option value="__platform__">Administración de plataforma</option> }
                @if (empresa && !empresa.startsWith('__') && !listed(empresa)) {
                  <option [value]="empresa">{{ empresa }}</option>
                }
                @for (store of tiendas(); track store.slug) {
                  <option [value]="store.slug">{{ store.trade_name }}</option>
                }
                <option value="__custom__">Ingresar código de empresa</option>
              </select>
            </label>
            @if (empresa === '__custom__') {
              <label>Código de empresa
                <input name="empresaCodigo" [(ngModel)]="empresaCodigo" required
                  pattern="[a-z0-9][a-z0-9_-]{0,59}" placeholder="Ej. mi-tienda" />
              </label>
            }
            @if (errorTiendas()) {
              <p role="status">No se pudo cargar la lista. Podés ingresar el código de tu empresa.</p>
            }
            }
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
                    [attr.aria-pressed]="showPassword"
                >
                    <fs-icon [name]="showPassword ? 'eye-off' : 'eye'" />
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
  private readonly tiendasApi = inject(TiendasPublicasApi);
  readonly tiendas = signal<TiendaPublica[]>([]);
  readonly errorTiendas = signal(false);
  empresa = '';
  empresaCodigo = '';
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
  readonly fixedStore = signal<string | null>(null);
  readonly fixedStoreName = computed(() => {
    const s = this.fixedStore();
    if (!s) return '';
    return this.tiendas().find((t) => t.slug === s)?.trade_name ?? s;
  });
  unlockStore(): void { this.fixedStore.set(null); }
  constructor() {
    this.route.data.subscribe((data) => {
      this.mode = data['mode'];
      const slug = this.route.snapshot.queryParamMap.get('tienda');
      this.empresa = slug && /^[a-z0-9][a-z0-9_-]{0,59}$/.test(slug) ? slug : '';
      this.fixedStore.set(this.empresa || null);
      this.empresaCodigo = '';
      if (this.mode === 'login' || this.mode === 'register') {
        this.tiendasApi.listar(1, 100).subscribe({
          next: (result) => { this.tiendas.set(result.items); this.errorTiendas.set(false); },
          error: () => this.errorTiendas.set(true),
        });
      }
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
  listed(slug: string) { return this.tiendas().some((store) => store.slug === slug); }

  private tenantSlug(): string | undefined {
    return this.empresa === '__platform__' ? undefined
      : (this.empresa === '__custom__' ? this.empresaCodigo.trim() : this.empresa) || undefined;
  }

  title() {
    return (
      {
        login: 'Qué bueno verte de nuevo',
        register: 'Creá tu cuenta',
        forgot: 'Recuperá tu contraseña',
        reset: this.route.snapshot.queryParamMap.get('invitacion')==='1'?'Activa tu cuenta':'Elegí una nueva contraseña',
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
        reset: this.route.snapshot.queryParamMap.get('invitacion')==='1'?'Establecer contraseña':'Guardar contraseña',
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
        await firstValueFrom(this.session.login(this.email, this.password, this.tenantSlug(), this.empresa === '__platform__'));
        const target = this.route.snapshot.queryParamMap.get('returnUrl');
        const isClient = this.session.isClient?.();
        const safeTarget = target && (!isClient || !target.startsWith('/admin')) ? target : null;
        await this.router.navigateByUrl(
          safeTarget?.startsWith('/') && !safeTarget.startsWith('//') && !safeTarget.includes('://')
            ? safeTarget
            : this.session.isPlatformAdmin() ? '/admin/plataforma'
              : this.session.administrative() ? '/admin'
                : this.session.tenant()?.slug ? '/tienda/' + this.session.tenant()?.slug : '/mi-cuenta',
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
        const response = await firstValueFrom(this.session.request(task.action, task.body, this.mode === 'register' ? this.tenantSlug() : undefined));
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
