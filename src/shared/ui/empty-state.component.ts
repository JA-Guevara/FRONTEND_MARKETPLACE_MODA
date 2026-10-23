import { Component, Input, Output, EventEmitter, inject } from '@angular/core';

@Component({
  selector: 'fs-empty-state',
  imports: [],
  template: `<div class="empty">
    <span>{{ icon }}</span>
    <h2>{{ title }}</h2>
    <p>{{ text }}</p>
    <ng-content />
  </div>`,
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  @Input() icon = '◇';
  @Input() title = 'Sin resultados';
  @Input() text = '';
}
