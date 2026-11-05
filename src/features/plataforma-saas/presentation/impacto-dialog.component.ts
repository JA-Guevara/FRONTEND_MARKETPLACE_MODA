import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogFocusDirective } from '../../../shared/dialog-focus.directive';
import { PlanImpact, TemplateImpact } from '../domain/gobierno.models';

@Component({
  selector: 'fs-impacto-dialog',
  imports: [FormsModule, DialogFocusDirective],
  styleUrl: './impacto-dialog.component.scss',
  template: `<div class="scrim" (click)="!busy && cancelled.emit()"></div>
    <section
      role="alertdialog"
      aria-modal="true"
      [attr.aria-label]="title"
      (dismissed)="!busy && cancelled.emit()"
    >
      <h2>{{ title }}</h2>
      <p class="muted">Revisa el alcance antes de aplicar el cambio.</p>
      <div class="metrics">
        <div>
          <strong>{{ impact.affected_tenants }}</strong> empresas
        </div>
        <div>
          <strong>{{ impact.affected_users }}</strong> usuarios
        </div>
      </div>
      @if (isPlan()) {
        <p><b>Módulos que se agregan:</b> {{ added().join(', ') || 'Ninguno' }}</p>
        <p><b>Módulos que se quitan:</b> {{ removed().join(', ') || 'Ninguno' }}</p>
        <p class="notice">
          Se respetan las asignaciones extra y las pruebas que sigan vigentes. Los roles no se
          modifican; el acceso se calcula con los módulos efectivos.
        </p>
      } @else {
        <p><b>Permisos agregados:</b> {{ added().join(', ') || 'Ninguno' }}</p>
        <p><b>Permisos retirados:</b> {{ removed().join(', ') || 'Ninguno' }}</p>
      }
      <label
        >Motivo (auditoría)<textarea
          [(ngModel)]="reason"
          rows="3"
          maxlength="300"
          required
          [disabled]="busy"
        ></textarea>
      </label>
      @if (error) {
        <p class="alert danger" role="alert">{{ error }}</p>
      }
      <footer>
        <button type="button" [disabled]="busy" (click)="cancelled.emit()">Cancelar</button>
        <button
          type="button"
          class="primary"
          [disabled]="busy || reason.trim().length < 3"
          (click)="confirmed.emit(reason.trim())"
        >
          {{ busy ? 'Aplicando…' : 'Confirmar cambio' }}
        </button>
      </footer>
    </section>`,
})
export class ImpactoDialogComponent {
  @Input({ required: true }) impact!: PlanImpact | TemplateImpact;
  @Input() title = 'Revisar impacto';
  @Input() busy = false;
  @Input() error = '';
  @Output() confirmed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();
  reason = '';
  isPlan(): boolean {
    return 'plan_id' in this.impact;
  }
  added() {
    return 'modules_added' in this.impact
      ? this.impact.modules_added
      : this.impact.permissions_added;
  }
  removed() {
    return 'modules_removed' in this.impact
      ? this.impact.modules_removed
      : this.impact.permissions_removed;
  }
}
