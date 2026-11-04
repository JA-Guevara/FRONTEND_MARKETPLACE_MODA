import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'fs-upgrade-card',
  imports: [RouterLink],
  template: `
    <div class="upgrade-card">
      <span class="sparkle-icon">✦</span>
      <div class="content">
        <b>{{ title }}</b>
        <div class="muted">{{ text }}</div>
      </div>
      <a routerLink="/admin/mi-suscripcion" class="btn primary">
        Ver planes
      </a>
    </div>
  `,
  styleUrl: './upgrade-card.component.scss',
})
export class UpgradeCardComponent {
  @Input() feature = '';
  @Input({ required: true }) title = '';
  @Input({ required: true }) text = '';
}
