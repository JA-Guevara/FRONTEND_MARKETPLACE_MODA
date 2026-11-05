import {
  Component,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SubscriptionDetail, expiryTone } from '../domain/suscripcion.models';
import { FEATURE_LABELS } from '../domain/plan.models';
import { EstadoCuentaComponent } from './estado-cuenta.component';

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

    @if (detail(); as d) {
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
      <p class="alert danger">{{ error() }}</p>
    }
  `,
  styleUrl: './mi-suscripcion.component.scss',
})
export class MiSuscripcionComponent {
  private api = inject(PlataformaApi);
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
    this.api.mySubscription().subscribe({
      next: (d) => this.detail.set(d),
      error: () => this.error.set('No se pudo consultar tu suscripción.'),
    });
  }
}
