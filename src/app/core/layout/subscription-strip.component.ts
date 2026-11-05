import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { PlataformaApi } from '../../../features/plataforma-saas/infrastructure/plataforma.api';
import { SubscriptionDetail } from '../../../features/plataforma-saas/domain/suscripcion.models';

@Component({
  selector: 'fs-subscription-strip',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible()) {
      <div
        class="grace-strip"
        [class.warn]="tone() === 'warn'"
        [class.danger]="tone() === 'danger'"
        role="status"
        aria-live="polite"
      >
        <span class="ic">!</span>
        <div class="grow">
          @if (isGrace()) {
            <b>Tu suscripción venció el {{ endDateFormatted() }}.</b>
            Período de gracia: {{ daysRemaining() }} días. Después, la empresa pasa a solo lectura (puedes consultar y exportar, no vender).
          } @else if (isReadOnly()) {
            <b>Modo solo lectura activado.</b>
            Tu suscripción está vencida. Puedes consultar y exportar información, pero las ventas y modificaciones están bloqueadas.
          } @else if (isExpiring()) {
            <b>Tu suscripción vence en {{ daysRemaining() }} días.</b>
            Solicita la renovación para no interrumpir las operaciones de tu empresa.
          }
        </div>
        <button type="button" class="btn sm" (click)="solicitarRenovacion()">
          Solicitar renovación
        </button>
      </div>
    }
  `,
  styleUrl: './subscription-strip.component.scss',
})
export class SubscriptionStripComponent implements OnInit {
  session = inject(SessionService);
  private api = inject(PlataformaApi);
  private router = inject(Router);

  /** Si se pasa un detalle externamente, se prioriza sobre la consulta propia. */
  detailInput = input<SubscriptionDetail | null>(null, { alias: 'detail' });
  private internalDetail = signal<SubscriptionDetail | null>(null);

  readonly detail = computed(() => this.detailInput() ?? this.internalDetail());

  readonly lifecycleState = computed(() => {
    const d = this.detail();
    if (d?.current?.lifecycle_state) return d.current.lifecycle_state;
    const sub = this.session.subscription();
    if (sub?.lifecycle_state) return sub.lifecycle_state;

    // Fallback a cálculo por fechas
    if (sub) {
      if (sub.status !== 'ACTIVA') return 'read_only';
      if (sub.days_left <= 3) return 'expiring';
      return 'active';
    }
    return 'active';
  });

  readonly isGrace = computed(() => this.lifecycleState() === 'grace');
  readonly isReadOnly = computed(() => this.lifecycleState() === 'read_only' || this.session.readOnly());
  readonly isExpiring = computed(() => {
    const d = this.daysRemaining();
    return this.lifecycleState() === 'expiring' && d <= 3;
  });

  readonly visible = computed(() => {
    // Si no hay empresa de usuario, no se muestra
    if (!this.session.tenant()) return false;
    return this.isGrace() || this.isReadOnly() || this.isExpiring();
  });

  readonly tone = computed<'warn' | 'danger'>(() => {
    return this.isReadOnly() || this.isGrace() ? 'danger' : 'warn';
  });

  readonly daysRemaining = computed(() => {
    const d = this.detail();
    if (d?.current?.days_left != null) return d.current.days_left;
    return this.session.subscription()?.days_left ?? 0;
  });

  readonly endDateFormatted = computed(() => {
    const d = this.detail();
    const raw = d?.current?.end_date ?? this.session.subscription()?.end_date;
    if (!raw) return 'la fecha límite';
    return raw;
  });

  ngOnInit(): void {
    if (!this.detailInput() && this.session.tenant() && typeof this.api.mySubscription === 'function') {
      this.api.mySubscription().subscribe({
        next: (d) => this.internalDetail.set(d),
        error: () => {},
      });
    }
  }

  solicitarRenovacion(): void {
    void this.router.navigate(['/admin/empresa/suscripcion']);
  }
}
