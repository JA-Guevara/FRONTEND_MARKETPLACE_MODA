import { Component, Input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';

export interface BarChartItem {
  label: string;
  value: number | string;
}

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 200;
const PLOT_TOP = 10;
const PLOT_HEIGHT = 150;

/** Gráfico de barras verticales en SVG (sin librerías, misma línea que
 * fs-trend-chart). Con muchos ítems (24 horas) solo se etiqueta 1 de cada N
 * barras para no amontonar texto; el resto queda accesible por título. */
@Component({
  selector: 'fs-bar-chart',
  imports: [CurrencyPipe, DecimalPipe],
  template: `
    @if (items.length) {
      <svg
        [attr.viewBox]="'0 0 ' + width + ' ' + height"
        preserveAspectRatio="none"
        role="img"
        [attr.aria-label]="ariaLabel"
      >
        <line
          x1="0"
          [attr.y1]="baseline()"
          [attr.x2]="width"
          [attr.y2]="baseline()"
          class="bar-chart-axis"
        />
        @for (item of items; track $index; let i = $index) {
          <rect
            [attr.x]="barX(i)"
            [attr.y]="barY(item.value)"
            [attr.width]="barWidth()"
            [attr.height]="barHeight(item.value)"
            rx="3"
            class="bar-chart-bar"
          >
            <title>{{ item.label }}: {{ item.value }}</title>
          </rect>
        }
      </svg>
      <div class="bar-chart-labels" [style.grid-template-columns]="'repeat(' + items.length + ', 1fr)'">
        @for (item of items; track $index; let i = $index) {
          <div class="bar-chart-label">
            @if (i % labelStep() === 0) {
              <b>{{
                format === 'currency'
                  ? (item.value | currency: currency : 'symbol-narrow' : '1.0-0')
                  : (item.value | number)
              }}</b>
              <span>{{ item.label }}</span>
            }
          </div>
        }
      </div>
    } @else {
      <p class="empty">{{ emptyText }}</p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      svg {
        width: 100%;
        height: 170px;
        display: block;
      }
      .bar-chart-axis {
        stroke: #e5ded5;
        stroke-width: 1;
      }
      .bar-chart-bar {
        fill: #74394e;
      }
      .bar-chart-labels {
        display: grid;
        margin-top: 6px;
      }
      .bar-chart-label {
        display: grid;
        justify-items: center;
        text-align: center;
        font-size: 0.68rem;
        color: #6d6459;
        overflow: hidden;
      }
      .bar-chart-label b {
        font-size: 0.68rem;
        color: #24231f;
        overflow-wrap: anywhere;
      }
      .empty {
        color: #756c62;
        font-size: 0.85rem;
        line-height: 1.6;
        margin: 0;
      }
    `,
  ],
})
export class BarChartComponent {
  @Input() items: BarChartItem[] = [];
  @Input() format: 'currency' | 'number' = 'currency';
  @Input() currency = 'BOB';
  @Input() emptyText = 'Sin datos para este período.';
  @Input() ariaLabel = 'Gráfico de barras';
  width = VIEW_WIDTH;
  height = VIEW_HEIGHT;
  private max(): number {
    return Math.max(1, ...this.items.map((i) => Number(i.value) || 0));
  }
  baseline(): number {
    return PLOT_TOP + PLOT_HEIGHT;
  }
  labelStep(): number {
    return Math.max(1, Math.ceil(this.items.length / 8));
  }
  barWidth(): number {
    const slot = this.width / Math.max(1, this.items.length);
    return Math.max(3, slot * 0.55);
  }
  barX(index: number): number {
    const slot = this.width / Math.max(1, this.items.length);
    return slot * index + (slot - this.barWidth()) / 2;
  }
  barHeight(value: number | string): number {
    return (Math.max(0, Number(value) || 0) / this.max()) * PLOT_HEIGHT;
  }
  barY(value: number | string): number {
    return this.baseline() - this.barHeight(value);
  }
}
