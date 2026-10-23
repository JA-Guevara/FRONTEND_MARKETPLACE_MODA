import { Component, Input, Output, EventEmitter, inject } from '@angular/core';

@Component({
  selector: 'fs-kpi-card',
  imports: [],
  template: `<div class="card kpi">
    <span class="lbl">{{ label }}</span
    ><strong class="val">{{ value }}</strong
    ><small class="dlt">{{ hint }}</small>
  </div>`,
  styleUrl: './kpi-card.component.scss',
})
export class KpiCardComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() hint = '';
  @Input() tone = 'neutral';
}
