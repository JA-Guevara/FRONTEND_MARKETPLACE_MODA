import { Component, Input } from '@angular/core';

/** Tabla plana genérica (celdas ya formateadas por el que la arma) para la
 * pestaña "Tablas de datos" del dashboard — sin librerías, misma línea que
 * fs-bar-chart / fs-pie-chart. Primera columna como etiqueta, el resto
 * alineado a la derecha (valores numéricos/monetarios). */
@Component({
  selector: 'fs-data-table',
  template: `
    @if (rows.length) {
      <div class="dt" role="table" [attr.aria-label]="ariaLabel">
        <div class="dt-row dt-head" role="row">
          @for (h of headers; track h) { <span role="columnheader">{{ h }}</span> }
        </div>
        @for (row of rows; track $index) {
          <div class="dt-row" role="row">
            @for (cell of row; track $index) { <span role="cell">{{ cell }}</span> }
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
      .dt {
        border: 1px solid #eee8e1;
        border-radius: 12px;
        overflow: hidden;
        font-size: 0.8rem;
      }
      .dt-row {
        display: grid;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        align-items: center;
        border-bottom: 1px solid #f2eee8;
        grid-template-columns: minmax(0, 1.4fr) repeat(auto-fit, minmax(0, 1fr));
      }
      .dt-row:last-child {
        border-bottom: 0;
      }
      .dt-head {
        background: #f5efe8;
        font-weight: 600;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .dt-row span {
        overflow-wrap: anywhere;
      }
      .dt-row span:not(:first-child) {
        text-align: right;
        font-variant-numeric: tabular-nums;
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
export class DataTableComponent {
  @Input() headers: string[] = [];
  @Input() rows: (string | number)[][] = [];
  @Input() emptyText = 'Sin datos para este período.';
  @Input() ariaLabel = 'Tabla de datos';
}
