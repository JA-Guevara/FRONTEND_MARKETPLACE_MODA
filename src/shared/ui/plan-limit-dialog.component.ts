import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { PlanNoticeService } from '../../app/core/plan-notice.service';
import { RouterLink } from '@angular/router';
import { UsageMeterComponent } from './usage-meter.component';
import { DialogFocusDirective } from '../dialog-focus.directive';
@Component({
  selector: 'fs-plan-limit-dialog',
  imports: [RouterLink, UsageMeterComponent, DialogFocusDirective],
  template: `@if (service.notice(); as n) {
    <div class="sp2-scrim" (click)="service.close()"></div>
    <section
      class="sp2-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-label="Aviso de tu plan"
      (dismissed)="service.close()"
    >
      <h2>
        {{
          n.code === 'plan_limit_exceeded'
            ? 'Límite de tu plan alcanzado'
            : n.code === 'subscription_inactive'
              ? 'Tu suscripción no está activa'
              : 'Tu plan no incluye esta funcionalidad'
        }}
      </h2>
      <p>
        {{
          n.code === 'subscription_inactive'
            ? 'Puedes seguir consultando información. Contacta al administrador para reactivar tu suscripción.'
            : 'Consulta las características y límites de tu plan para continuar.'
        }}
      </p>
      @if (n.code === 'plan_limit_exceeded') {
        <fs-usage-meter
          [used]="number(n.details['current'] ?? n.details['active_branches'])"
          [limit]="number(n.details['limit'])"
        />
      }
      <footer>
        <button (click)="service.close()">Entendido</button
        ><a class="btn primary" routerLink="/admin/mi-suscripcion" (click)="service.close()"
          >Ver planes</a
        >
      </footer>
    </section>
  }`,
  styleUrl: './plan-limit-dialog.component.scss',
})
export class PlanLimitDialogComponent {
  service = inject(PlanNoticeService);
  number(v: unknown) {
    return Number(v ?? 0);
  }
}
