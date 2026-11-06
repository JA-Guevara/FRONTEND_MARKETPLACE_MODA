import {
  Component,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize, forkJoin, of } from 'rxjs';
import { CommonModule } from '@angular/common';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SubscriptionDetail, expiryTone } from '../domain/suscripcion.models';
import { FEATURE_LABELS } from '../domain/plan.models';
import { EstadoCuentaComponent } from './estado-cuenta.component';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { StripeSaasApi, TenantBillingPlan } from '../infrastructure/stripe-saas.api';

@Component({
  selector: 'fs-mi-suscripcion',
  standalone: true,
  imports: [CommonModule, EstadoCuentaComponent],
  template: `
    <div class="sp2-heading">
      <div>
        <p class="crumbs">Mi empresa / Suscripción</p>
        <h1>Mi suscripción</h1>
        <p>Plan, estado, uso y ciclo de vida de tu cuenta FashionStore SaaS.</p>
      </div>
      <a class="btn" href="mailto:?subject=Solicitud%20de%20renovaci%C3%B3n%20o%20cambio%20de%20plan%20FashionStore">
        Solicitar renovación
      </a>
    </div>

    @if (loading()) {
      <div class="card subscription-skeleton" role="status" aria-label="Cargando suscripción"><span></span><span></span><span></span></div>
    }
    @if (returnedFromPayment) {
      <p class="alert info" role="status">Recibimos tu pago. La suscripción se actualiza en unos segundos.</p>
    }
    @if (detail(); as d) {
      @if (canManage()) {
        <section class="card stripe-billing" aria-label="Pago de la suscripción">
          <h2>Paga o cambia tu plan</h2>
          <div class="sp2-grid">
            @for (plan of availablePlans(); track plan.code) {
              <article class="panel">
                <h3>{{ plan.name }}</h3><p>Bs {{ plan.reference_price | number:'1.2-2' }} / mes</p>
                <p>{{ plan.code === d.current.plan_code ? 'Plan actual' : 'Disponible' }}</p>
                <button class="btn" [disabled]="paymentBusy() || !plan.stripe_ready" (click)="payPlan(plan.code)">
                  {{ paymentBusy() ? 'Abriendo el pago seguro de Stripe…' : plan.code === d.current.plan_code ? 'Pagar con tarjeta' : 'Elegir' }}
                </button>
                @if (!plan.stripe_ready) { <small class="muted">Pago manual disponible</small> }
              </article>
            }
          </div>
          @if (!availablePlans().length) { <p class="muted">Consulta con la plataforma los planes disponibles para pago manual.</p> }
          <button class="btn" [disabled]="paymentBusy()" (click)="openPortal()">Administrar tarjeta y facturas</button>
          @if (paymentBusy()) { <p role="status">Abriendo el pago seguro de Stripe…</p> }
          @if (paymentError()) { <p class="alert warn" role="alert">{{ paymentError() }}</p> }
          <p class="muted">Pagos procesados por Stripe en modo prueba. FashionStore no guarda los datos de tu tarjeta.</p>
        </section>
      }
      @if (lifecycleState() === 'grace') {
        <div class="alert danger">
          <div>
            <strong>Suscripción en período de gracia.</strong> Venció el {{ d.current.end_date }}.
            Dispones de {{ d.current.days_left }} días para registrar tu pago antes de pasar a solo lectura.
          </div>
          <a class="btn sm" href="mailto:?subject=Registro%20de%20pago%20FashionStore">Registrar pago</a>
        </div>
      } @else if (lifecycleState() === 'read_only') {
        <div class="alert danger">
          <div>
            <strong>Modo solo lectura activado.</strong> Tu suscripción está vencida.
            Puedes consultar y exportar información, pero las ventas y modificaciones están bloqueadas.
          </div>
          <a class="btn sm" href="mailto:?subject=Reactivacion%20de%20suscripcion%20FashionStore">Solicitar reactivación</a>
        </div>
      } @else if (lifecycleState() === 'expiring') {
        <div class="alert warn">
          <div>
            <strong>Tu suscripción vence pronto.</strong> Quedan {{ d.current.days_left }} días
            (hasta el {{ d.current.end_date }}).
          </div>
          <a class="btn sm" href="mailto:?subject=Renovacion%20anticipada%20FashionStore">Renovar</a>
        </div>
      }

      <!-- Grid de 4 KPIs según maqueta px-gracia -->
      <div class="grid4">
        <div class="card kpi">
          <span class="lbl">Plan</span>
          <span class="val">{{ d.current.plan_name }}</span>
          <span class="dlt muted">
            @if (d.current.reference_price != null) {
              Mensual · Bs {{ d.current.reference_price | number:'1.2-2' }}
            } @else {
              Plan estándar
            }
          </span>
        </div>
        <div class="card kpi">
          <span class="lbl">Estado</span>
          <span class="val">{{ estadoLabel() }}</span>
          <span class="dlt" [style.color]="estadoColor()">
            {{ estadoSubtext() }}
          </span>
        </div>
        <div class="card kpi">
          <span class="lbl">Sucursales</span>
          <span class="val">{{ d.usage.active_branches }} / {{ d.usage.max_active_branches }}</span>
          <span class="dlt muted">Activas de permitidas</span>
        </div>
        <div class="card kpi">
          <span class="lbl">Vigencia</span>
          <span class="val">{{ d.current.days_left }} días</span>
          <span class="dlt muted">Fin: {{ d.current.end_date }}</span>
        </div>
      </div>

      <!-- Línea del ciclo según maqueta px-gracia -->
      <div class="card">
        <h3>Ciclo de tu suscripción</h3>
        <div class="life">
          <div class="a" [class.on]="lifecycleState() === 'active'">
            <b>Activa</b>
            <span>{{ d.current.start_date }} – {{ d.current.end_date }}</span>
            @if (lifecycleState() === 'active') { <small><b>← hoy</b></small> }
          </div>
          <div class="p" [class.on]="lifecycleState() === 'expiring'">
            <b>Por vencer</b>
            <span>Avisos a 7, 3 y 1 día</span>
            @if (lifecycleState() === 'expiring') { <small><b>← hoy</b></small> }
          </div>
          <div class="g" [class.on]="lifecycleState() === 'grace'">
            <b>En gracia</b>
            <span>Hasta 3 días</span>
            @if (lifecycleState() === 'grace') { <small><b>← hoy</b></small> }
          </div>
          <div class="s" [class.on]="lifecycleState() === 'read_only'">
            <b>Solo lectura</b>
            <span>Consultar y exportar</span>
            @if (lifecycleState() === 'read_only') { <small><b>← hoy</b></small> }
          </div>
          <div class="c" [class.on]="lifecycleState() === 'canceled'">
            <b>Cancelada</b>
            <span>Retención 30 días</span>
            @if (lifecycleState() === 'canceled') { <small><b>← hoy</b></small> }
          </div>
        </div>
      </div>

      <!-- Estado de cuenta (maqueta px-gracia) -->
      <fs-estado-cuenta />

      <div class="sp2-details">
        <section class="card">
          <h2>Funcionalidades incluidas</h2>
          <ul class="feature-list">
            @for (f of featureEntries(d.features); track f[0]) {
              <li>{{ f[1] ? '✓' : '—' }} {{ labels[f[0]] || f[0] }}</li>
            }
          </ul>
        </section>

        <section class="card">
          <h2>Historial de suscripción</h2>
          <ol class="timeline">
            @for (s of d.history; track s.id) {
              <li>
                <strong>{{ s.plan_name }} · {{ s.status }}</strong>
                <p>{{ s.start_date }} — {{ s.end_date }}</p>
                <small>{{ s.reason }}</small>
              </li>
            } @empty {
              <li>Esta es la primera suscripción de la empresa.</li>
            }
          </ol>
        </section>
      </div>
    }

    @if (error()) {
      <p class="alert danger" role="alert">{{ error() }}</p><button class="btn" (click)="load()">Reintentar</button>
    }
  `,
  styleUrl: './mi-suscripcion.component.scss',
  styles: ['.stripe-billing .sp2-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1rem; margin-bottom: 1rem; } .subscription-skeleton { display: grid; gap: 1rem; } .subscription-skeleton span { height: 1rem; border-radius: 4px; background: var(--surface-2); } .subscription-skeleton span:first-child { width: 60%; } @media(max-width: 639px) { .stripe-billing button { width: 100%; } }'],
})
export class MiSuscripcionComponent {
  private api = inject(PlataformaApi);
  private readonly stripe = inject(StripeSaasApi);
  private readonly session = inject(SessionService);
  private readonly destroy = inject(DestroyRef);
  readonly returnedFromPayment = inject(ActivatedRoute).snapshot.queryParamMap.get('pago') === 'ok';
  readonly loading = signal(true);
  readonly availablePlans = signal<TenantBillingPlan[]>([]);
  readonly paymentBusy = signal(false);
  readonly paymentError = signal('');
  readonly canManage = computed(() => this.session.can('billing.manage'));
  detail = signal<SubscriptionDetail | null>(null);
  error = signal('');
  tone = expiryTone;
  labels = FEATURE_LABELS;
  featureEntries = Object.entries;

  readonly lifecycleState = computed(() => {
    const d = this.detail();
    if (d?.current?.lifecycle_state) return d.current.lifecycle_state;
    if (!d) return 'active';
    if (d.current.status === 'CANCELADA') return 'canceled';
    if (d.current.status !== 'ACTIVA') return 'read_only';
    if (d.current.days_left <= 7) return 'expiring';
    return 'active';
  });

  readonly estadoLabel = computed(() => {
    const s = this.lifecycleState();
    switch (s) {
      case 'active': return 'Activa';
      case 'expiring': return 'Por vencer';
      case 'grace': return 'En gracia';
      case 'read_only': return 'Solo lectura';
      case 'canceled': return 'Cancelada';
      default: return this.detail()?.current.status || 'Activa';
    }
  });

  readonly estadoColor = computed(() => {
    const s = this.lifecycleState();
    switch (s) {
      case 'active': return 'var(--ok)';
      case 'expiring': return 'var(--warn)';
      case 'grace': return 'var(--danger)';
      case 'read_only': return 'var(--danger)';
      default: return 'var(--muted)';
    }
  });

  readonly estadoSubtext = computed(() => {
    const d = this.detail();
    const s = this.lifecycleState();
    if (!d) return '';
    if (s === 'grace') return `Vence el período: ${d.current.days_left}d restantes`;
    if (s === 'read_only') return 'Operaciones bloqueadas';
    if (s === 'expiring') return `Vence en ${d.current.days_left} días`;
    return `Hasta ${d.current.end_date}`;
  });

  constructor() {
    this.load();
  }
  load() {
    this.loading.set(true); this.error.set(''); this.detail.set(null);
    forkJoin({ detail: this.api.mySubscription(), plans: this.canManage() ? this.stripe.plans() : of([]) })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false))).subscribe({
      next: ({ detail, plans }) => { this.detail.set(detail); this.availablePlans.set(plans); },
      error: () => this.error.set('No se pudo cargar la información.'),
    });
  }
  payPlan(code: string) {
    if (!this.canManage() || this.paymentBusy() || !this.availablePlans().some(p => p.code === code && p.stripe_ready)) return;
    this.paymentBusy.set(true); this.paymentError.set('');
    let redirected = false;
    this.stripe.checkout(code).pipe(takeUntilDestroyed(this.destroy), finalize(() => { if (!redirected) this.paymentBusy.set(false); })).subscribe({
      next: result => { redirected = this.stripe.redirect(result.checkout_url, 'checkout'); if (!redirected) this.paymentError.set('No se pudo abrir el pago seguro. Reintenta.'); },
      error: error => this.paymentError.set(this.billingError(error)),
    });
  }
  openPortal() {
    if (!this.canManage() || this.paymentBusy()) return;
    this.paymentBusy.set(true); this.paymentError.set('');
    let redirected = false;
    this.stripe.portal().pipe(takeUntilDestroyed(this.destroy), finalize(() => { if (!redirected) this.paymentBusy.set(false); })).subscribe({
      next: result => { redirected = this.stripe.redirect(result.portal_url, 'portal'); if (!redirected) this.paymentError.set('No se pudo abrir el portal seguro. Reintenta.'); },
      error: error => this.paymentError.set(this.billingError(error)),
    });
  }
  private billingError(error: { error?: { error?: { code?: string } } }): string {
    const code = error?.error?.error?.code;
    return code === 'billing_not_configured' ? 'El cobro con tarjeta no está configurado. Usa el pago manual.'
      : code === 'billing_customer_missing' ? 'Primero paga un plan con tarjeta.'
      : code === 'plan_not_available' ? 'Este plan no está disponible para pago con tarjeta. Usa el pago manual.'
      : code === 'permission_denied' ? 'No tienes permiso para gestionar los pagos de la empresa.'
      : 'No se pudo abrir el pago seguro. Reintenta.';
  }
}
