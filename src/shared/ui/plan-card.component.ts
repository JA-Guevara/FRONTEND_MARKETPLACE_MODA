import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { SubscriptionSummary } from '../models';
import { RouterLink } from '@angular/router';
import { UsageMeterComponent } from './usage-meter.component';
@Component({
  selector: 'fs-plan-card',
  imports: [RouterLink, UsageMeterComponent],
  template: `<div class="side-plan">
    <strong>{{ subscription.plan_name }}</strong>
    <p>{{ subscription.status }} · {{ subscription.days_left }} días restantes</p>
    <fs-usage-meter
      [used]="activeBranches"
      [limit]="subscription.limits['max_active_branches'] || 0"
    /><a routerLink="/admin/mi-suscripcion">Ver mi suscripción →</a>
  </div>`,
  styleUrl: './plan-card.component.scss',
})
export class PlanCardComponent {
  @Input({ required: true }) subscription!: SubscriptionSummary;
  @Input() activeBranches = 0;
}
