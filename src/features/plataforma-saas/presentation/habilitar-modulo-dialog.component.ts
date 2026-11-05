import { Component, Input, Output, EventEmitter, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DialogFocusDirective } from '../../../shared/dialog-focus.directive';
import { PlatformModule, TenantModuleGrant, OverrideMode } from '../domain/gobierno.models';
@Component({
  selector: 'fs-habilitar-modulo-dialog',
  imports: [FormsModule, CommonModule, DialogFocusDirective],
  styleUrl: './habilitar-modulo-dialog.component.scss',
  template: `<div class="scrim" (click)="!busy && closed.emit()"></div>
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Habilitar módulo a la empresa"
      (dismissed)="!busy && closed.emit()"
    >
      <h2>Habilitar módulo</h2>
      <p class="muted">{{ tenantName }} · Solo cambia esta empresa.</p>
      <label
        >Módulo<select [(ngModel)]="moduleCode" [disabled]="busy">
          @for (module of available(); track module.code) {
            <option [value]="module.code">{{ module.name }} · {{ module.lifecycle }}</option>
          }
        </select></label
      >
      <label
        >Modo<select [(ngModel)]="mode" [disabled]="busy">
          <option value="TRIAL">Prueba por tiempo limitado</option>
          <option value="EXTRA">Extra</option>
        </select></label
      >
      <label
        >Días de vigencia (1–30)<input
          type="number"
          min="1"
          max="30"
          step="1"
          [ngModel]="days()"
          (ngModelChange)="days.set($event)"
          [disabled]="busy"
      /></label>
      <p class="end">Vence {{ endDate() | date: 'dd/MM/yyyy' }}</p>
      <label
        >Motivo<textarea [(ngModel)]="reason" rows="3" maxlength="300" [disabled]="busy"></textarea>
      </label>
      <p class="notice">
        Habilitar el módulo no agrega permisos a los roles. El personal necesita un rol que los
        incluya.
      </p>
      @if (error) {
        <p class="alert danger" role="alert">{{ error }}</p>
      }
      <footer>
        <button (click)="closed.emit()" [disabled]="busy">Cancelar</button
        ><button class="primary" [disabled]="busy || !valid()" (click)="submit()">
          {{ busy ? 'Guardando…' : mode === 'TRIAL' ? 'Dar prueba' : 'Habilitar extra' }}
        </button>
      </footer>
    </section>`,
})
export class HabilitarModuloDialogComponent {
  @Input() modules: PlatformModule[] = [];
  @Input() tenantName = '';
  @Input() busy = false;
  @Input() error = '';
  @Input() moduleCode = '';
  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<TenantModuleGrant>();
  mode: OverrideMode = 'TRIAL';
  days = signal(7);
  reason = '';
  available() {
    return this.modules.filter(
      (module) => module.kind !== 'BASE' && ['BETA', 'GA'].includes(module.lifecycle),
    );
  }
  endDate = computed(() => new Date(Date.now() + this.days() * 86_400_000));
  valid() {
    return (
      !!this.available().find((module) => module.code === this.moduleCode) &&
      Number.isInteger(this.days()) &&
      this.days() >= 1 &&
      this.days() <= 30 &&
      this.reason.trim().length >= 3
    );
  }
  submit() {
    if (this.valid())
      this.confirmed.emit({
        module_code: this.moduleCode,
        mode: this.mode,
        days: this.days(),
        reason: this.reason.trim(),
      });
  }
}
