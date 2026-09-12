import { Component, Input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { barPercent } from '../domain/dashboard.helpers';

export interface BarItem {
  label: string;
  value: number | string;
}

/** Lista rankeada con barra proporcional, reutilizada por las comparativas del
 * dashboard (categoría, sucursal, hora del día, día de la semana). Mismo
 * lenguaje visual que la barra de "Ventas por día" del dashboard. */
@Component({
  selector: 'fs-metric-bar-list',
  imports: [CurrencyPipe, DecimalPipe],
  template: `
    @for (item of items; track item.label) {
      <div class="bar-row">
        <span>{{ item.label }}</span>
        <div class="bar" aria-hidden="true"><i [style.width.%]="percent(item.value, max())"></i></div>
        <b>{{
          format === 'currency' ? (item.value | currency: currency : 'code' : '1.2-2') : (item.value | number)
        }}</b>
      </div>
    } @empty {
      <p class="empty">{{ emptyText }}</p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .bar-row {
        display: grid;
        grid-template-columns: 110px minmax(25px, 1fr) auto;
        gap: 0.65rem;
        align-items: center;
        margin: 0.85rem 0;
        font-size: 0.73rem;
      }
      .bar-row > span {
        overflow-wrap: anywhere;
      }
      .bar {
        height: 8px;
        background: #f2eee8;
        border-radius: 5px;
        overflow: hidden;
      }
      .bar i {
        display: block;
        height: 100%;
        background: #a87954;
        border-radius: 5px;
      }
      .bar-row b {
        font-size: 0.72rem;
        overflow-wrap: anywhere;
      }
      .empty {
        color: #756c62;
        font-size: 0.85rem;
        line-height: 1.6;
        padding: 0.5rem 0;
        margin: 0;
      }
      @media (max-width: 480px) {
        .bar-row {
          grid-template-columns: 84px minmax(15px, 1fr);
          gap: 0.4rem;
        }
        .bar-row b {
          grid-column: 2;
        }
      }
    `,
  ],
})
export class MetricBarListComponent {
  @Input() items: BarItem[] = [];
  @Input() format: 'currency' | 'number' = 'currency';
  @Input() currency = 'BOB';
  @Input() emptyText = 'Sin datos para este período.';
  percent = barPercent;
  max() {
    return Math.max(0, ...this.items.map((i) => Number(i.value) || 0));
  }
}
