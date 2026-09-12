import { Component, Input } from '@angular/core';
import { barPercent } from '../domain/dashboard.helpers';

export interface TrendPoint {
  label: string;
  value: number;
}

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 160;
const TOP_PADDING = 12;
const PLOTTABLE_HEIGHT = VIEW_HEIGHT - TOP_PADDING - 10;

/** Línea de tendencia SVG: la serie real (sólida) seguida de la proyección
 * (punteada), compartiendo la misma escala. Sin librería de gráficos, en
 * línea con el resto del proyecto — el trazado se arma con `barPercent`. */
@Component({
  selector: 'fs-trend-chart',
  template: `
    @if (actual.length > 1) {
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none" role="img" [attr.aria-label]="ariaLabel">
        <polyline [attr.points]="actualPoints()" fill="none" stroke="#a87954" stroke-width="2.5" />
        @if (projected.length) {
          <polyline
            [attr.points]="projectedPoints()"
            fill="none"
            stroke="#a87954"
            stroke-width="2.5"
            stroke-dasharray="6 5"
            opacity="0.65"
          />
        }
      </svg>
      <div class="trend-legend">
        <span><i class="solid"></i>Real</span>
        @if (projected.length) {
          <span><i class="dashed"></i>Proyección</span>
        }
      </div>
    } @else {
      <p class="empty">Todavía no hay suficientes datos para graficar una tendencia.</p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      svg {
        width: 100%;
        height: 150px;
        display: block;
      }
      .trend-legend {
        display: flex;
        gap: 1.1rem;
        font-size: 0.75rem;
        color: #6d6459;
        margin-top: 0.4rem;
      }
      .trend-legend span {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }
      .trend-legend i {
        width: 16px;
        height: 0;
        border-top: 2.5px solid #a87954;
      }
      .trend-legend i.dashed {
        opacity: 0.65;
        border-top-style: dashed;
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
export class TrendChartComponent {
  @Input() actual: TrendPoint[] = [];
  @Input() projected: TrendPoint[] = [];
  @Input() ariaLabel = 'Gráfico de tendencia';
  width = VIEW_WIDTH;
  height = VIEW_HEIGHT;
  private totalCount() {
    return Math.max(1, this.actual.length + this.projected.length - 1);
  }
  private maxValue() {
    return Math.max(0, ...this.actual.map((p) => p.value), ...this.projected.map((p) => p.value));
  }
  private y(value: number): number {
    return VIEW_HEIGHT - 8 - (barPercent(value, this.maxValue()) / 100) * PLOTTABLE_HEIGHT;
  }
  private x(index: number): number {
    return (index / this.totalCount()) * (VIEW_WIDTH - 16) + 8;
  }
  actualPoints(): string {
    return this.actual.map((p, i) => `${this.x(i).toFixed(2)},${this.y(p.value).toFixed(2)}`).join(' ');
  }
  projectedPoints(): string {
    const offset = this.actual.length - 1;
    const bridge = this.actual.length
      ? [`${this.x(offset).toFixed(2)},${this.y(this.actual[offset].value).toFixed(2)}`]
      : [];
    const rest = this.projected.map(
      (p, i) => `${this.x(offset + 1 + i).toFixed(2)},${this.y(p.value).toFixed(2)}`,
    );
    return [...bridge, ...rest].join(' ');
  }
}
