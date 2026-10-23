import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogFocusDirective } from '../dialog-focus.directive';
@Component({
  selector: 'fs-confirm-dialog',
  imports: [FormsModule, DialogFocusDirective],
  template: `@if (open) {
    <div class="sp2-scrim" (click)="cancelled.emit()"></div>
    <section
      class="sp2-dialog"
      role="alertdialog"
      aria-modal="true"
      [attr.aria-label]="title"
      (dismissed)="cancelled.emit()"
    >
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
      <label class="f"
        >Motivo<textarea class="input" [(ngModel)]="reason" rows="3" maxlength="300"></textarea>
      </label>
      @if (requireText) {
        <label class="f"
          >Escribe {{ requireText }} para confirmar<input class="input" [(ngModel)]="typed"
        /></label>
      }
      <footer>
        <button type="button" (click)="cancelled.emit()">Cancelar</button
        ><button
          type="button"
          [class.danger-solid]="tone === 'danger'"
          [disabled]="
            (!!requireText && typed !== requireText) ||
            ((!!requireText || requireReason) && reason.trim().length < 3)
          "
          (click)="confirmed.emit(reason)"
        >
          {{ confirmLabel }}
        </button>
      </footer>
    </section>
  }`,
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent implements OnChanges {
  ngOnChanges(changes: SimpleChanges) {
    if (changes['open']?.currentValue) {
      this.reason = '';
      this.typed = '';
    }
  }
  @Input() open = false;
  @Input() title = 'Confirmar';
  @Input() message = '';
  @Input() confirmLabel = 'Confirmar';
  @Input() tone: 'primary' | 'danger' = 'primary';
  @Input() requireText?: string;
  @Input() requireReason = false;
  @Output() confirmed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();
  reason = '';
  typed = '';
}
