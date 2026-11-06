import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { SignupApi, VerifyResponse } from '../infrastructure/signup.api';

@Component({
  selector: 'fs-crear-tienda',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="signup-container">
      <section class="hero">
        <span class="brand"><i>FS</i> FashionStore</span>
        <h1>Tu tienda de ropa en línea y en mostrador, en 5 minutos.</h1>
        <ul>
          <li>14 días de prueba del plan Profesional, sin tarjeta</li>
          <li>Caja, inventario por sucursal y reservas</li>
          <li>Funciona sin Internet en la web y en el móvil</li>
          <li>Reportes con IA por texto o voz</li>
        </ul>
        <span class="footnote">
          Al terminar la prueba eliges plan o pasas a Básico. Tus datos son tuyos: puedes exportarlos cuando quieras.
        </span>
      </section>

      <section class="form-wrapper">
        <div class="signup-card">
          @if (verifying()) {
            <div class="success-state">
              <div class="icon">⏳</div>
              <h3>Verificando tu tienda...</h3>
              <p>Estamos preparando tu catálogo, caja y período de prueba.</p>
            </div>
          } @else if (verifiedResult(); as res) {
            <div class="success-state">
              <div class="icon">🎉</div>
              <h3>¡Tu tienda está lista!</h3>
              <p>Activamos tu prueba de {{ res.trial_days }} días del plan {{ res.plan_code }}.</p>
              <div class="dev-box">
                <strong>Empresa activada:</strong> /tienda/{{ res.slug }}
              </div>
              <a class="btn primary" [routerLink]="['/tienda', res.slug]">
                Ir a mi tienda
              </a>
            </div>
          } @else if (submitted()) {
            <div class="success-state">
              <div class="icon">✉️</div>
              <h3>Revisa tu correo</h3>
              <p>
                Enviamos las instrucciones de activación a <strong>{{ submittedEmail() }}</strong>.
                Haz clic en el enlace del mensaje para activar tu tienda y comenzar tus 14 días gratis.
              </p>
              @if (devToken()) {
                <div class="dev-box">
                  <p><strong>Modo desarrollo:</strong> Token generado:</p>
                  <code>{{ devToken() }}</code>
                  <br><br>
                  <button type="button" class="btn primary" (click)="verifyNow(devToken()!)">
                    Activar tienda ahora
                  </button>
                </div>
              }
            </div>
          } @else if (registrationClosed()) {
            <p class="alert danger" role="alert">El registro de tiendas está cerrado por ahora.</p>
          } @else {
            <h2>Crea tu tienda</h2>

            @if (error()) {
              <div class="alert danger">{{ error() }}</div>
            }

            <form (ngSubmit)="onSubmit()" #signupForm="ngForm">
              <div class="form-group">
                <label for="companyName">Nombre de la empresa</label>
                <input
                  id="companyName"
                  type="text"
                  name="companyName"
                  placeholder="Ej. Boutique Las Lomas"
                  [ngModel]="companyName()"
                  (ngModelChange)="onNameChange($event)"
                  required
                />
                @if (slug()) {
                  <span
                    class="slug-preview"
                    [class.ok]="slugAvailable() === true"
                    [class.danger]="slugAvailable() === false"
                  >
                    fashionstore.app/tienda/<b>{{ slug() }}</b>
                    @if (slugAvailable() === true) {
                      <span> ✔ disponible</span>
                    } @else if (slugAvailable() === false) {
                      <span> ✕ {{ slugReason() }}</span>
                    }
                  </span>
                }
              </div>

              <div class="form-group">
                <label for="email">Tu correo</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="administracion@laslomas.test"
                  [(ngModel)]="email"
                  required
                />
              </div>

              <div class="form-group">
                <label for="password">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  placeholder="••••••••••••"
                  [(ngModel)]="password"
                  required
                  minlength="8"
                />
                @if (password().length > 0) {
                  <span class="pwd-meter" [ngClass]="pwdStrength().level">
                    {{ pwdStrength().label }}
                  </span>
                }
              </div>

              <div class="form-group">
                <label for="city">Ciudad</label>
                <select id="city" name="city" [(ngModel)]="city">
                  <option value="Santa Cruz de la Sierra">Santa Cruz de la Sierra</option>
                  <option value="La Paz">La Paz</option>
                  <option value="Cochabamba">Cochabamba</option>
                  <option value="Sucre">Sucre</option>
                  <option value="Tarija">Tarija</option>
                </select>
              </div>

              <div class="checkbox-group">
                <input
                  id="acceptTerms"
                  type="checkbox"
                  name="acceptTerms"
                  [(ngModel)]="acceptTerms"
                  required
                />
                <label for="acceptTerms">
                  Acepto los <a routerLink="/legal/terminos" target="_blank">Términos del servicio</a>
                  y la <a routerLink="/legal/privacidad" target="_blank">Política de privacidad</a> (versión 2026-11)
                </label>
              </div>

              <button
                type="submit"
                class="btn primary"
                [disabled]="!isFormValid() || submitting()"
                style="width: 100%; margin-top: 8px;"
              >
                @if (submitting()) {
                  <span>Creando tu tienda...</span>
                } @else {
                  <span>Crear mi tienda (14 días gratis)</span>
                }
              </button>

              <span class="help-sub" style="display: block; margin-top: 8px;">
                Te enviaremos un enlace para confirmar tu correo.
              </span>
            </form>
          }
        </div>
      </section>
    </div>
  `,
  styleUrl: './crear-tienda.component.scss',
})
export class CrearTiendaComponent implements OnInit {
  private readonly api = inject(SignupApi);
  private readonly destroy = inject(DestroyRef);
  private slugRequest?: Subscription;
  readonly registrationClosed = signal(false);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  companyName = signal('');
  slug = signal('');
  slugAvailable = signal<boolean | null>(null);
  slugReason = signal('');

  email = signal('');
  password = signal('');
  city = signal('Santa Cruz de la Sierra');
  acceptTerms = signal(false);

  submitting = signal(false);
  submitted = signal(false);
  submittedEmail = signal('');
  devToken = signal<string | null>(null);
  error = signal('');

  verifying = signal(false);
  verifiedResult = signal<VerifyResponse['data'] | null>(null);

  readonly pwdStrength = computed(() => {
    const p = this.password();
    if (p.length < 8) {
      return { level: 'weak', label: 'Débil · requiere 8+ caracteres' };
    }
    if (p.length >= 12 && /[A-Z]/.test(p) && /[0-9!@#$%^&*]/.test(p)) {
      return { level: 'strong', label: 'Fuerte · 12+ caracteres' };
    }
    return { level: 'medium', label: 'Media · añade mayúsculas y símbolos' };
  });

  readonly isFormValid = computed(() => {
    return (
      !this.registrationClosed() &&
      this.companyName().trim().length >= 2 &&
      this.slugAvailable() === true &&
      this.email().trim().includes('@') &&
      this.password().length >= 8 &&
      this.acceptTerms()
    );
  });

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.verifyNow(token);
    }
  }

  onNameChange(val: string): void {
    if (this.registrationClosed()) return;
    this.slugRequest?.unsubscribe();
    this.slugAvailable.set(null);
    this.companyName.set(val);
    const computedSlug = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    this.slug.set(computedSlug);

    if (computedSlug.length < 3) {
      this.slugAvailable.set(false);
      this.slugReason.set('Mínimo 3 caracteres');
      return;
    }

    this.slugRequest = this.api.slug(computedSlug).pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: (res) => {
          this.slugAvailable.set(res.data.available);
          this.slugReason.set(res.data.reason);
        },
        error: (err) => {
          this.slugAvailable.set(null); this.handleClosed(err);
        },
      });
  }

  onSubmit(): void {
    if (!this.isFormValid() || this.submitting()) return;

    this.submitting.set(true);
    this.error.set('');

    const body = {
      company_name: this.companyName().trim(),
      slug: this.slug(),
      email: this.email().trim(),
      password: this.password(),
      accept_terms: true,
      accept_privacy: true,
    };

    this.api.signup(body).pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.submitted.set(true);
          this.submittedEmail.set(this.email().trim());
          if (res.data?.dev_token) {
            this.devToken.set(res.data.dev_token);
          }
        },
        error: (err) => {
          this.submitting.set(false);
          if (this.handleClosed(err)) return;
          const detail = err.error?.error?.message || err.error?.detail || err.error?.message || 'Error al procesar el registro.';
          this.error.set(typeof detail === 'string' ? detail : 'Error al procesar el registro.');
        },
      });
  }

  verifyNow(token: string): void {
    if (this.registrationClosed() || this.verifying()) return;
    this.verifying.set(true);
    this.error.set('');

    this.api.verify(token).pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: (res) => {
          this.verifying.set(false);
          this.verifiedResult.set(res.data);
        },
        error: (err) => {
          this.verifying.set(false);
          if (this.handleClosed(err)) return;
          const detail = err.error?.error?.message || err.error?.detail?.message || err.error?.detail || 'Token no válido o expirado.';
          this.error.set(typeof detail === 'string' ? detail : 'El enlace de verificación ha expirado.');
        },
      });
  }
  private handleClosed(error: { status?: number; error?: { error?: { code?: string } } }): boolean {
    if (error.status !== 404) return false;
    this.registrationClosed.set(true); this.slugAvailable.set(false);
    this.password.set(''); this.devToken.set(null); this.error.set('El registro de tiendas está cerrado por ahora.');
    return true;
  }

}
