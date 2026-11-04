import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SoporteService } from '../application/soporte.service';
import {
  SUPPORT_DURATIONS,
  isValidReason,
} from '../domain/soporte.models';

@Component({
  selector: 'fs-iniciar-soporte-dialog',
  imports: [FormsModule],
  template: `
    <div class="dialog-backdrop" (click)="onBackdrop($event)">
      <div class="dialog-box" role="dialog" aria-modal="true">
        <h2 class="dialog-title">⛑ Asistir a {{ tenant.trade_name }}</h2>
        <p class="dialog-desc">
          Entrarás al panel de la empresa con permisos de administrador. La sesión
          vence sola y la empresa verá este acceso en «Accesos de soporte».
        </p>

        <div class="reason-field">
          <label for="support-reason">Motivo *</label>
          <textarea
            id="support-reason"
            [(ngModel)]="reason"
            [class.err]="errorMessage()"
            placeholder="Ej. Revisar existencias negativas en sucursal Norte (ticket #482)"
            (input)="onInput()"
          ></textarea>
          @if (errorMessage()) {
            <span class="err-text">{{ errorMessage() }}</span>
          } @else {
            <span class="hint"
              >Mínimo 10 caracteres (actual: {{ reason.trim().length }}/300).
              Aparece en la bitácora de la empresa.</span
            >
          }
        </div>

        <div class="duration-selector">
          <span class="label">Duración</span>
          <div class="chips">
            @for (d of durations; track d) {
              <button
                type="button"
                class="chip"
                [class.on]="duration() === d"
                (click)="duration.set(d)"
              >
                {{ formatDurationLabel(d) }}
              </button>
            }
          </div>
        </div>

        <div class="alert warn">
          <span>⚠</span>
          <div>
            <b>Escritura completa.</b> Los cambios que hagas son reales y quedan
            firmados con tu nombre y el de la sesión.
          </div>
        </div>

        <div class="dialog-actions">
          <button type="button" class="btn ghost" (click)="close()">
            Cancelar
          </button>
          <button
            type="button"
            class="btn primary"
            [disabled]="!canSubmit() || busy()"
            (click)="iniciar()"
          >
            {{ busy() ? 'Iniciando…' : 'Iniciar sesión de soporte' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './iniciar-soporte-dialog.component.scss',
})
export class IniciarSoporteDialogComponent {
  @Input({ required: true }) tenant!: { id: string; trade_name: string; slug?: string };
  @Output() closed = new EventEmitter<boolean>();

  private soporte = inject(SoporteService);

  readonly durations = SUPPORT_DURATIONS;
  duration = signal<number>(60);
  reason = '';
  busy = signal(false);
  errorMessage = signal<string | null>(null);

  canSubmit(): boolean {
    return isValidReason(this.reason);
  }

  onInput(): void {
    if (this.errorMessage()) {
      this.errorMessage.set(null);
    }
  }

  formatDurationLabel(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = minutes / 60;
    return h === 1 ? '60 min' : `${h} h`;
  }

  onBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('dialog-backdrop')) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit(false);
  }

  async iniciar(): Promise<void> {
    if (!this.canSubmit() || this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      await this.soporte.iniciar(this.tenant, this.reason.trim(), this.duration());
      this.closed.emit(true);
    } catch (err: any) {
      this.busy.set(false);
      if (err.status === 409) {
        this.errorMessage.set(
          err.error?.message ||
            'Ya existe una sesión activa para esta empresa o la empresa está suspendida.'
        );
      } else if (err.status === 422) {
        this.errorMessage.set('El motivo debe tener entre 10 y 300 caracteres.');
      } else {
        this.errorMessage.set(
          err.error?.message || 'Error al iniciar la sesión de soporte.'
        );
      }
    }
  }
}
