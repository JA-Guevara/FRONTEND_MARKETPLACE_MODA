import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  OnInit,
  OnChanges,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge.component';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';
import { UsageMeterComponent } from '../../../shared/ui/usage-meter.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { DrawerComponent } from '../../../shared/ui/drawer.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { SubscriptionDetail, expiryTone } from '../domain/suscripcion.models';
import { FEATURE_LABELS } from '../domain/plan.models';
@Component({
  selector: 'fs-mi-suscripcion',
  imports: [CommonModule, StatusBadgeComponent, UsageMeterComponent],
  template: `<div class="sp2-heading">
      <div>
        <p class="crumbs">Mi empresa / Suscripción</p>
        <h1>Mi suscripción</h1>
        <p>Consulta tu vigencia, funcionalidades y uso del plan.</p>
      </div>
      <a class="btn" href="mailto:?subject=Solicitud%20de%20cambio%20de%20plan%20FashionStore">Solicitar cambio de plan</a>
    </div>
    @if (detail(); as d) {
      @if (d.current.status !== 'ACTIVA') {
        <div class="alert danger">
          Solo consulta. Tu suscripción está {{ d.current.status.toLowerCase() }}. Contacta al
          administrador de plataforma para volver a operar.
        </div>
      } @else if (d.current.days_left <= 7) {
        <div class="alert warn">
          Tu suscripción vence en {{ d.current.days_left }} días. Contacta al administrador para
          renovarla a tiempo.
        </div>
      }
    }
    @if (detail(); as d) {
      <div class="sp2-grid">
        <section class="panel">
          <span class="badge plan">{{ d.current.plan_code }}</span>
          <h2>{{ d.current.plan_name }}</h2>
          @if (d.current.reference_price != null) { <p>Precio de referencia: Bs {{d.current.reference_price | number:'1.2-2'}}</p> }
          <fs-status-badge
            [tone]="tone(d.current.days_left, d.current.status)"
            [label]="d.current.status"
          />
          <p>
            Desde {{ d.current.start_date | date: 'dd/MM/yyyy' }} hasta
            {{ d.current.end_date | date: 'dd/MM/yyyy' }}
          </p>
          <strong>{{ d.current.days_left }} días restantes</strong
          ><fs-usage-meter [used]="d.usage.active_branches" [limit]="d.usage.max_active_branches" />
        </section>
        <section class="panel">
          <h2>Tu plan incluye</h2>
          <ul class="feature-list">
            @for (f of featureEntries(d.features); track f[0]) {
              <li>{{ f[1] ? '✓' : '—' }} {{ labels[f[0]] || f[0] }}</li>
            }
          </ul>
        </section>
      </div>
      <section class="panel" style="margin-top:20px">
        <h2>Historial de suscripción</h2>
        <ol class="timeline">
          @for (s of d.history; track s.id) {
            <li>
              <strong>{{ s.plan_name }} · {{ s.status }}</strong>
              <p>{{ s.start_date | date: 'dd/MM/yyyy' }} — {{ s.end_date | date: 'dd/MM/yyyy' }}</p>
              <small>{{ s.reason }}</small>
            </li>
          } @empty {
            <li>Esta es la primera suscripción de la empresa.</li>
          }
        </ol>
      </section>
    }
    @if (detail(); as d) {
      <div class="sp2-grid" style="margin-top:20px">
        <section class="panel">
          <h3>¿Necesitas más sucursales?</h3>
          <p>Consulta con el administrador de plataforma para ampliar tu plan.</p>
        </section>
        @if (!d.features['ai_reports']) {
          <section class="panel">
            <h3>Reportes con IA</h3>
            <p>
              Disponibles en los planes que incluyen esta funcionalidad. Consulta las opciones para
              tu empresa.
            </p>
          </section>
        }
      </div>
    }
    @if (error()) {
      <p class="alert danger">{{ error() }}</p>
    }`,
  styleUrl: './mi-suscripcion.component.scss',
})
export class MiSuscripcionComponent {
  private api = inject(PlataformaApi);
  detail = signal<SubscriptionDetail | null>(null);
  error = signal('');
  tone = expiryTone;
  labels = FEATURE_LABELS;
  featureEntries = Object.entries;
  constructor() {
    this.api
      .mySubscription()
      .subscribe({
        next: (d) => this.detail.set(d),
        error: () => this.error.set('No se pudo consultar tu suscripción.'),
      });
  }
}
