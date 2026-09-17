import { Component, Input } from '@angular/core';
import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';

export interface PieSlice {
  label: string;
  value: number | string;
}

const COLORS = ['#74394e', '#a87954', '#4f6d7a', '#c9a15a', '#6b8f71', '#9b3c34', '#5b5f97', '#b08bbb'];
const RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Gráfico circular (donut) en SVG, armado con círculos superpuestos y
 * stroke-dasharray — sin librerías, mismo criterio que el resto del
 * dashboard. Pensado para composiciones (estado, método de pago, categoría). */
@Component({
  selector: 'fs-pie-chart',
  imports: [CurrencyPipe, DecimalPipe, PercentPipe],
  template: `
    @if (items.length && total() > 0) {
      <div class="pie-wrap">
        <svg viewBox="-6 -6 152 152" role="img" [attr.aria-label]="ariaLabel">
          <g transform="translate(70,70) rotate(-90)">
            @for (item of items; track $index; let i = $index) {
              <circle
                r="60"
                cx="0"
                cy="0"
                fill="none"
                [attr.stroke]="color(i)"
                stroke-width="24"
                [attr.stroke-dasharray]="dash(i)"
                [attr.stroke-dashoffset]="offset(i)"
              >
                <title>{{ item.label }}: {{ pct(item.value) | percent: '1.0-1' }}</title>
              </circle>
            }
          </g>
          <text x="70" y="66" text-anchor="middle" class="pie-total-label">Total</text>
          <text x="70" y="83" text-anchor="middle" class="pie-total-value">
            {{
              format === 'currency'
                ? (total() | currency: currency : 'symbol-narrow' : '1.0-0')
                : (total() | number)
            }}
          </text>
        </svg>
        <ul class="pie-legend">
          @for (item of items; track $index; let i = $index) {
            <li>
              <i [style.background]="color(i)"></i><span>{{ item.label }}</span
              ><b>{{ pct(item.value) | percent: '1.0-1' }}</b>
            </li>
          }
        </ul>
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
      .pie-wrap {
        display: flex;
        gap: 1.2rem;
        align-items: center;
        flex-wrap: wrap;
      }
      svg {
        width: 140px;
        height: 140px;
        flex: 0 0 auto;
      }
      circle {
        transition: stroke-width 0.15s ease;
      }
      circle:hover {
        stroke-width: 27;
      }
      .pie-total-label {
        font-size: 8px;
        fill: #756c62;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .pie-total-value {
        font-size: 11px;
        font-weight: 700;
        fill: #24231f;
      }
      .pie-legend {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.45rem;
        flex: 1 1 160px;
        min-width: 0;
      }
      .pie-legend li {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.78rem;
      }
      .pie-legend i {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        flex: 0 0 auto;
      }
      .pie-legend span {
        flex: 1;
        overflow-wrap: anywhere;
        color: #4a453d;
      }
      .pie-legend b {
        color: #24231f;
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
export class PieChartComponent {
  @Input() items: PieSlice[] = [];
  @Input() format: 'currency' | 'number' = 'number';
  @Input() currency = 'BOB';
  @Input() emptyText = 'Sin datos para este período.';
  @Input() ariaLabel = 'Gráfico circular';
  color(index: number): string {
    return COLORS[index % COLORS.length];
  }
  total(): number {
    return this.items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  }
  pct(value: number | string): number {
    const total = this.total();
    return total ? (Number(value) || 0) / total : 0;
  }
  dash(index: number): string {
    const fraction = this.pct(this.items[index].value);
    return `${fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`;
  }
  offset(index: number): number {
    let cumulative = 0;
    for (let j = 0; j < index; j++) cumulative += this.pct(this.items[j].value);
    return -cumulative * CIRCUMFERENCE;
  }
}
