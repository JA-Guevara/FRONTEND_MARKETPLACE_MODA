import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { DialogFocusDirective } from '../dialog-focus.directive';
@Component({
  selector: 'fs-drawer',
  imports: [DialogFocusDirective],
  template: `@if (open) {
    <div class="sp2-scrim" (click)="closed.emit()"></div>
    <section
      class="sp2-drawer"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title"
      (dismissed)="closed.emit()"
    >
      <header>
        <h2>{{ title }}</h2>
        <button type="button" aria-label="Cerrar" (click)="closed.emit()">×</button>
      </header>
      @if (steps.length) {
        <ol class="steps">
          @for (s of steps; track s; let i = $index) {
            <li [class.on]="i === step">{{ i + 1 }} · {{ s }}</li>
          }
        </ol>
      }
      <div class="drawer-body"><ng-content /></div>
      <footer><ng-content select="[drawer-footer]" /></footer>
    </section>
  }`,
  styleUrl: './drawer.component.scss',
})
export class DrawerComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() steps: string[] = [];
  @Input() step = 0;
  @Output() closed = new EventEmitter<void>();
}
