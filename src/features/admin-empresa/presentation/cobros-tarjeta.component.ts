import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { StripePaymentAccount, StripeSaasApi } from '../../plataforma-saas/infrastructure/stripe-saas.api';

@Component({
  selector: 'fs-cobros-tarjeta', standalone: true, imports: [RouterLink, DatePipe],
  template: `<section class="payments-shell">
    <header><div><p class="crumbs">Mi empresa / Cobros</p><h1>Cobros con tarjeta</h1>
      <p>Conecta la cuenta en la que tu empresa recibirá los pagos de su tienda.</p></div>
      @if (allowed()) { <button class="btn" [disabled]="loading() || connecting()" (click)="load()">Actualizar estado</button> }
    </header>
    @if (!allowed()) { <p role="alert">No tienes permiso para gestionar los cobros de la empresa.</p> }
    @if (loading()) { <div class="card skeleton" role="status" aria-label="Cargando cuenta de cobros"><span></span><span></span><span></span></div> }
    @if (error()) { <p class="alert danger" role="alert">{{ error() }}</p><button class="btn" (click)="load()">Reintentar</button> }
    @if (account(); as a) {
      <div class="payments-grid">
        <article class="card">
          <h2>Tu cuenta de Stripe</h2><span class="status" [class.active]="a.charges_enabled">{{ stateLabel() }}</span>
          @switch (a.status) {
            @case ('not_connected') { <p>Conecta tu cuenta de Stripe para aceptar tarjeta en tu tienda.</p> }
            @case ('pending') { <p>Stripe está revisando tus datos.</p> }
            @case ('restricted') { <p>Stripe necesita más información para habilitar los cobros.</p> }
            @case ('active') {
              @if (a.charges_enabled) { <p>Tu tienda acepta tarjeta. El dinero llega a tu cuenta de Stripe.</p> }
              @else { <p>Stripe necesita más información para habilitar los cobros.</p> }
            }
          }
          <ul class="indicators">
            <li [class.enabled]="a.charges_enabled">{{ a.charges_enabled ? '✓ Cargos habilitados' : '— Cargos no habilitados' }}</li>
            <li [class.enabled]="a.payouts_enabled">{{ a.payouts_enabled ? '✓ Retiros habilitados' : '— Retiros no habilitados' }}</li>
            <li [class.enabled]="a.details_submitted">{{ a.details_submitted ? '✓ Datos enviados' : '— Datos pendientes' }}</li>
          </ul>
          @if (a.account_ref) { <p class="muted">Cuenta: <code>{{ a.account_ref }}</code></p> }
          @if (a.updated_at) { <p class="muted">Última actualización: {{ a.updated_at | date:'dd/MM/yyyy HH:mm' }}</p> }
          @if (a.status !== 'active' || !a.charges_enabled) {
            <button class="btn primary" [disabled]="connecting()" (click)="connect()">{{ connecting() ? 'Abriendo Stripe…' : a.status === 'not_connected' ? 'Conectar con Stripe' : 'Continuar registro' }}</button>
          }
          @if (actionError()) { <p class="alert danger" role="alert">{{ actionError() }}</p> }
          <p class="help">FashionStore no ve ni guarda tus claves de Stripe: tú inicias sesión en Stripe y autorizas la conexión.</p>
        </article>
        <article class="card"><h2>Métodos manuales</h2><p>Los métodos manuales, como QR y transferencia, se gestionan por separado.</p>
          <p class="muted">Conectar Stripe no cambia su configuración. La tarjeta se ofrece únicamente cuando Stripe habilita los cargos de tu cuenta.</p>
          <a class="btn" routerLink="/admin/empresa/perfil">Ver perfil de la empresa</a>
        </article>
      </div>
    }
  </section>`,
  styleUrl: './cobros-tarjeta.component.scss',
})
export class CobrosTarjetaComponent {
  private readonly api = inject(StripeSaasApi);
  private readonly session = inject(SessionService);
  private readonly destroy = inject(DestroyRef);
  readonly allowed = computed(() => this.session.can('payment_methods.write'));
  readonly account = signal<StripePaymentAccount | null>(null);
  readonly loading = signal(false);
  readonly connecting = signal(false);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly stateLabel = computed(() => ({ not_connected: 'Sin conectar', pending: 'Pendiente de verificación', active: 'Activa', restricted: 'Restringida' })[this.account()?.status ?? 'not_connected']);
  constructor() { this.load(); }
  load() {
    if (!this.allowed() || this.loading() || this.connecting()) return;
    this.loading.set(true); this.error.set(''); this.account.set(null);
    this.api.account().pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false))).subscribe({
      next: value => this.account.set(value),
      error: error => this.error.set(error?.error?.error?.code === 'billing_not_configured'
        ? 'Los cobros con tarjeta no están disponibles en este momento.' : 'No se pudo cargar la información.'),
    });
  }
  connect() {
    if (!this.allowed() || this.connecting()) return;
    this.connecting.set(true); this.actionError.set('');
    let redirected = false;
    this.api.onboarding().pipe(takeUntilDestroyed(this.destroy), finalize(() => { if (!redirected) this.connecting.set(false); })).subscribe({
      next: result => { redirected = this.api.redirect(result.onboarding_url, 'onboarding'); if (!redirected) this.actionError.set('No se pudo abrir la conexión segura con Stripe. Reintenta.'); },
      error: error => this.actionError.set(error?.error?.error?.code === 'billing_not_configured'
        ? 'Los cobros con tarjeta no están disponibles en este momento.' : 'No se pudo abrir la conexión segura con Stripe. Reintenta.'),
    });
  }
}
