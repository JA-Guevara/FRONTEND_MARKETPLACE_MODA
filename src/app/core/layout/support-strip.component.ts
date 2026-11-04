import { Component, computed, inject } from '@angular/core';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { SoporteService } from '../../../features/plataforma-saas/application/soporte.service';
import { formatRemaining } from '../../../features/plataforma-saas/domain/soporte.models';

@Component({
  selector: 'fs-support-strip',
  template: `
    @if (session.support(); as sup) {
      <div
        class="support-strip"
        [class.danger]="isNearExpire()"
        role="status"
        aria-live="polite"
      >
        <span class="ic">!</span>
        <div class="grow">
          <b>Sesión de soporte en {{ sup.tenant.trade_name }}</b>
          · Motivo: «{{ sup.session.reason }}». Todo lo que hagas queda en la
          bitácora de la empresa y en la auditoría global.
        </div>
        <span>
          Vence en <span class="timer">{{ formattedTimer() }}</span>
        </span>
        <button type="button" class="btn sm" (click)="extender()">
          Extender 30 min
        </button>
        <button type="button" class="btn sm" (click)="terminar()">
          Terminar soporte
        </button>
      </div>
    }
  `,
  styleUrl: './support-strip.component.scss',
})
export class SupportStripComponent {
  session = inject(SessionService);
  soporte = inject(SoporteService);

  readonly formattedTimer = computed(() => {
    return formatRemaining(this.soporte.remaining());
  });

  readonly isNearExpire = computed(() => {
    // Menos de 5 minutos (300,000 ms) pasa a advertencia/peligro
    return this.soporte.remaining() > 0 && this.soporte.remaining() <= 5 * 60 * 1000;
  });

  extender(): void {
    void this.soporte.extender(30);
  }

  terminar(): void {
    void this.soporte.terminar();
  }
}
