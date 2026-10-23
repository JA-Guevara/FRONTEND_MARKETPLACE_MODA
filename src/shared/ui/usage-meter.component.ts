import { Component, Input, Output, EventEmitter, inject } from '@angular/core';

@Component({
  selector: 'fs-usage-meter',
  imports: [],
  template: `<div>
      {{ label }} <strong>{{ used }} de {{ limit }}</strong>
    </div>
    <div class="meter" [class.near]="used >= limit * 0.8" [class.full]="used >= limit">
      <i [style.width.%]="percent"></i>
    </div>`,
  styleUrl: './usage-meter.component.scss',
})
export class UsageMeterComponent {
  @Input() label = 'Sucursales activas';
  @Input() used = 0;
  @Input() limit = 0;
  get percent() {
    return this.limit > 0 ? Math.min(100, (this.used / this.limit) * 100) : 0;
  }
}
