import { Component, Input, Output, EventEmitter, inject } from '@angular/core';

@Component({
  selector: 'fs-status-badge',
  imports: [],
  template: `<span class="badge" [class]="tone">{{ label }}</span>`,
  styleUrl: './status-badge.component.scss',
})
export class StatusBadgeComponent {
  @Input() tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'plan' = 'neutral';
  @Input({ required: true }) label = '';
}
