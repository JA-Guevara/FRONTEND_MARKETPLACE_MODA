import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  formatoCelda,
  ReportResponse,
} from '../domain/reporte-ia.models';

@Component({
  selector: 'fs-resultado-reporte',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="resultado-container" *ngIf="report">
      <!-- Encabezado del reporte -->
      <div class="resultado-header">
        <div>
          <h2 class="resultado-titulo">{{ report.title }}</h2>
          <span class="resultado-sub">
            Generado en {{ report.duration_ms || 250 }} ms · {{ report.rows.length }} registros
          </span>
        </div>
      </div>

      <!-- Narrativa inteligente (IA) -->
      <div class="narrativa-card" *ngIf="report.narrative">
        <div class="narrativa-icono">💡</div>
        <div class="narrativa-cuerpo">
          <div class="narrativa-tag">Lectura inteligente del reporte</div>
          <p class="narrativa-texto">{{ report.narrative }}</p>
        </div>
      </div>

      <!-- Visualización gráfica -->
      <div class="grafico-card" *ngIf="vista === 'grafico' && report.chart.kind !== 'TABLE'">
        <div class="grafico-header">
          <span class="grafico-tipo-badge">{{ report.chart.kind }}</span>
          <span class="grafico-label">{{ report.chart.label || report.title }}</span>
        </div>

        <!-- Barras verticales / barras simples -->
        <div class="chart-bars" *ngIf="report.chart.kind === 'BAR'">
          <div class="bar-row" *ngFor="let row of report.rows">
            <span class="bar-label">{{ row[report.chart.x] }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                [style.width.%]="calcularPorcentaje(row[report.chart.y])"
              ></div>
            </div>
            <span class="bar-val">{{ formato(row[report.chart.y], 'money') }}</span>
          </div>
        </div>

        <!-- Barras agrupadas / comparativa -->
        <div class="chart-grouped" *ngIf="report.chart.kind === 'GROUPED_BAR'">
          <div class="grouped-item" *ngFor="let row of report.rows">
            <div class="grouped-title">{{ row[report.chart.x] }}</div>
            <div class="grouped-bars-list">
              <div class="sub-bar" *ngFor="let s of report.series">
                <span class="sub-label">{{ s.name }}</span>
                <div class="bar-track">
                  <div
                    class="bar-fill bar-fill--sub"
                    [style.width.%]="calcularPorcentaje(row[s.name] || 0)"
                  ></div>
                </div>
                <span class="sub-val">{{ formato(row[s.name] || 0, 'money') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Línea temporal -->
        <div class="chart-line" *ngIf="report.chart.kind === 'LINE'">
          <div class="line-steps">
            <div class="line-step" *ngFor="let row of report.rows">
              <div
                class="line-bar-pill"
                [style.height.%]="calcularPorcentaje(row[report.chart.y])"
                [title]="formato(row[report.chart.y], 'money')"
              ></div>
              <span class="line-step-x">{{ row[report.chart.x] }}</span>
              <span class="line-step-y">{{ formato(row[report.chart.y], 'money') }}</span>
            </div>
          </div>
        </div>

        <!-- Pastel / Participación -->
        <div class="chart-pie" *ngIf="report.chart.kind === 'PIE'">
          <div class="pie-items">
            <div class="pie-item" *ngFor="let row of report.rows">
              <div class="pie-info">
                <span class="pie-label">{{ row[report.chart.x] }}</span>
                <span class="pie-pct">{{ row['percentage'] || 0 }}%</span>
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill bar-fill--pie"
                  [style.width.%]="row['percentage'] || calcularPorcentaje(row[report.chart.y])"
                ></div>
              </div>
              <span class="pie-amount">{{ formato(row[report.chart.y], 'money') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabla de datos (cuando vista === 'tabla' o el gráfico por defecto es TABLE) -->
      <div class="tabla-card" *ngIf="vista === 'tabla' || report.chart.kind === 'TABLE'">
        <div class="table-responsive">
          <table class="datos-table">
            <thead>
              <tr>
                <th *ngFor="let col of report.columns" [class.th-num]="col.type !== 'text'">
                  {{ col.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of report.rows">
                <td *ngFor="let col of report.columns" [class.td-num]="col.type !== 'text'">
                  {{ formato(row[col.key], col.type) }}
                </td>
              </tr>
              <!-- Fila de totales -->
              <tr class="tr-totales" *ngIf="report.totals">
                <td *ngFor="let col of report.columns" [class.td-num]="col.type !== 'text'">
                  <strong>{{ formato(report.totals[col.key], col.type) }}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .resultado-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .resultado-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .resultado-titulo {
      font-size: 1.35rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .resultado-sub {
      font-size: 0.85rem;
      color: #64748b;
    }
    .narrativa-card {
      display: flex;
      gap: 0.85rem;
      background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 1rem 1.25rem;
    }
    .narrativa-icono {
      font-size: 1.5rem;
      line-height: 1;
    }
    .narrativa-tag {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #2563eb;
      margin-bottom: 0.25rem;
    }
    .narrativa-texto {
      margin: 0;
      font-size: 0.95rem;
      color: #1e293b;
      line-height: 1.5;
    }
    .grafico-card, .tabla-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .grafico-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }
    .grafico-tipo-badge {
      font-size: 0.7rem;
      font-weight: 700;
      background: #e0f2fe;
      color: #0369a1;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      text-transform: uppercase;
    }
    .grafico-label {
      font-size: 0.9rem;
      font-weight: 600;
      color: #334155;
    }
    .chart-bars {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .bar-row {
      display: grid;
      grid-template-columns: 180px 1fr 120px;
      align-items: center;
      gap: 0.75rem;
    }
    .bar-label {
      font-size: 0.875rem;
      color: #1e293b;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bar-track {
      background: #f1f5f9;
      height: 18px;
      border-radius: 9px;
      overflow: hidden;
    }
    .bar-fill {
      background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
      height: 100%;
      border-radius: 9px;
      transition: width 0.4s ease;
    }
    .bar-fill--sub {
      background: linear-gradient(90deg, #10b981 0%, #059669 100%);
    }
    .bar-fill--pie {
      background: linear-gradient(90deg, #8b5cf6 0%, #6d28d9 100%);
    }
    .bar-val {
      font-size: 0.875rem;
      font-weight: 600;
      color: #0f172a;
      text-align: right;
    }
    .chart-grouped {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .grouped-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 0.5rem;
    }
    .grouped-bars-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-left: 0.5rem;
    }
    .sub-bar {
      display: grid;
      grid-template-columns: 140px 1fr 100px;
      align-items: center;
      gap: 0.75rem;
    }
    .sub-label {
      font-size: 0.8rem;
      color: #64748b;
    }
    .sub-val {
      font-size: 0.8rem;
      font-weight: 600;
      text-align: right;
    }
    .chart-line {
      overflow-x: auto;
      padding: 1rem 0;
    }
    .line-steps {
      display: flex;
      align-items: flex-end;
      gap: 1rem;
      min-height: 200px;
      padding-bottom: 1rem;
    }
    .line-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      flex: 1;
      min-width: 70px;
    }
    .line-bar-pill {
      width: 24px;
      background: linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%);
      border-radius: 6px 6px 0 0;
      min-height: 8px;
    }
    .line-step-x {
      font-size: 0.75rem;
      color: #64748b;
      white-space: nowrap;
    }
    .line-step-y {
      font-size: 0.75rem;
      font-weight: 600;
      color: #0f172a;
    }
    .chart-pie {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .pie-items {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .pie-item {
      display: grid;
      grid-template-columns: 180px 1fr 120px;
      align-items: center;
      gap: 0.75rem;
    }
    .pie-info {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .pie-label {
      font-size: 0.875rem;
      font-weight: 500;
    }
    .pie-pct {
      font-size: 0.85rem;
      font-weight: 700;
      color: #8b5cf6;
    }
    .pie-amount {
      font-size: 0.875rem;
      font-weight: 600;
      text-align: right;
    }
    .table-responsive {
      overflow-x: auto;
    }
    .datos-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .datos-table th, .datos-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e2e8f0;
      text-align: left;
    }
    .datos-table th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
    }
    .th-num, .td-num {
      text-align: right !important;
    }
    .tr-totales {
      background: #f1f5f9;
      border-top: 2px solid #cbd5e1;
    }
  `],
})
export class ResultadoReporteComponent {
  @Input() report: ReportResponse | null = null;
  @Input() vista: 'grafico' | 'tabla' = 'grafico';

  formato(valor: unknown, tipo: string): string {
    return formatoCelda(valor, (tipo as any) || 'text');
  }

  calcularPorcentaje(val: any): number {
    if (!this.report || !this.report.rows.length) return 0;
    const num = typeof val === 'number' ? val : parseFloat(val) || 0;
    const maxVal = Math.max(
      ...this.report.rows.map((r) => {
        const v = r[this.report!.chart.y];
        return typeof v === 'number' ? v : parseFloat(v) || 0;
      }),
      1
    );
    return Math.min(100, Math.max(5, (num / maxVal) * 100));
  }
}
