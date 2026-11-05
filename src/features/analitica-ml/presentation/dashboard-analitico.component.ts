import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MLApi } from '../infrastructure/ml.api';
import { MLDashboard, AnomaliaItem } from '../domain/ml.models';

@Component({
  selector: 'app-dashboard-analitico',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ml-dashboard-container">
      <header class="header">
        <div>
          <h1>Analítica Predictiva y Machine Learning</h1>
          <p class="subtitle">
            Modelos de regresión de demanda (GBR), segmentación RFM (K-Means) y detección de anomalías (Isolation Forest)
          </p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="cargarDatos()" [disabled]="cargando()">
            <span *ngIf="cargando()">Cargando...</span>
            <span *ngIf="!cargando()">Actualizar</span>
          </button>
        </div>
      </header>

      <!-- Alertas de error o éxito -->
      <div *ngIf="error()" class="alert alert-error">
        {{ error() }}
      </div>
      <div *ngIf="mensajeExito()" class="alert alert-success">
        {{ mensajeExito() }}
      </div>

      <!-- Spinner -->
      <div *ngIf="cargando() && !dashboard()" class="loading-state">
        <div class="spinner"></div>
        <p>Procesando inferencias y métricas de modelos...</p>
      </div>

      <div *ngIf="dashboard()" class="dashboard-content">
        <!-- Badge de Modelo Activo -->
        <div class="model-badge-card" *ngIf="dashboard()?.modelo_activo as mod">
          <div class="badge-header">
            <span class="status-indicator active"></span>
            <strong>Modelo en Producción: {{ mod.model_type }} v{{ mod.version }}</strong>
            <span class="pill pill-success">Activo</span>
          </div>
          <div class="badge-details">
            <span>R² Score: <strong>{{ (mod.r2_score ?? 0) | number:'1.2-2' }}</strong></span>
            <span>MAE: <strong>{{ (mod.mae ?? 0) | number:'1.2-2' }} unidades</strong></span>
            <span>RMSE: <strong>{{ (mod.rmse ?? 0) | number:'1.2-2' }}</strong></span>
            <span>Publicado: <strong>{{ mod.published_at ? (mod.published_at | date:'short') : 'Automático' }}</strong></span>
          </div>
        </div>

        <!-- Tarjetas KPI Principales -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Demanda Proyectada (Próx. Semana)</span>
            <div class="kpi-value">{{ dashboard()?.kpis?.demanda_proxima_semana | number:'1.0-0' }} <small>prendas</small></div>
            <span class="kpi-sub">Basado en Gradient Boosting</span>
          </div>

          <div class="kpi-card">
            <span class="kpi-label">Clientes Segmentados (RFM)</span>
            <div class="kpi-value">{{ dashboard()?.kpis?.total_clientes_segmentados }}</div>
            <span class="kpi-sub">Agrupados por comportamiento</span>
          </div>

          <div class="kpi-card" [class.alert-border]="(dashboard()?.kpis?.anomalias_pendientes ?? 0) > 0">
            <span class="kpi-label">Anomalías Pendientes</span>
            <div class="kpi-value" [class.text-danger]="(dashboard()?.kpis?.anomalias_pendientes ?? 0) > 0">
              {{ dashboard()?.kpis?.anomalias_pendientes }}
            </div>
            <span class="kpi-sub">Detectadas por Isolation Forest</span>
          </div>

          <div class="kpi-card">
            <span class="kpi-label">Precisión R² / Error MAE</span>
            <div class="kpi-value">{{ (dashboard()?.kpis?.precision_modelo_r2 ?? 0) | number:'1.2-2' }}</div>
            <span class="kpi-sub">MAE: {{ (dashboard()?.kpis?.error_promedio_mae ?? 0) | number:'1.2-2' }} u.</span>
          </div>
        </div>

        <!-- Sección 1: Pronóstico de Demanda Semanal -->
        <section class="section-card">
          <h2>Pronóstico de Demanda Semanal</h2>
          <p class="section-desc">Proyecciones de volumen con bandas de incertidumbre al 95% para planificación de inventario.</p>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th>Fecha de Proyección</th>
                  <th>Demanda Proyectada</th>
                  <th>Intervalo Inferior</th>
                  <th>Intervalo Superior</th>
                  <th>Ventas Reales</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of dashboard()?.serie_demanda">
                  <td>Semana {{ p.semana }}</td>
                  <td>{{ p.fecha | date:'mediumDate' }}</td>
                  <td><strong class="text-primary">{{ p.demanda_proyectada | number:'1.1-1' }}</strong></td>
                  <td class="text-muted">{{ p.intervalo_inferior | number:'1.1-1' }}</td>
                  <td class="text-muted">{{ p.intervalo_superior | number:'1.1-1' }}</td>
                  <td>
                    <span *ngIf="p.ventas_reales !== undefined && p.ventas_reales !== null" class="pill pill-neutral">
                      {{ p.ventas_reales | number:'1.1-1' }}
                    </span>
                    <span *ngIf="p.ventas_reales === undefined || p.ventas_reales === null" class="text-muted">
                      <em>Pendiente</em>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Sección 2: Segmentación de Clientes RFM -->
        <section class="section-card">
          <h2>Segmentación de Clientes (RFM Clusters)</h2>
          <p class="section-desc">Clustering de clientes según Recencia (R), Frecuencia (F) y Valor Monetario (M).</p>

          <div class="segments-grid">
            <div *ngFor="let seg of dashboard()?.segmentos" class="segment-card">
              <div class="segment-header">
                <h3>{{ seg.segment_name }}</h3>
                <span class="pill pill-info">{{ seg.customer_count }} clientes ({{ seg.percentage | number:'1.1-1' }}%)</span>
              </div>
              <div class="segment-metrics">
                <div class="metric">
                  <span class="label">Ticket Promedio:</span>
                  <span class="value">{{ seg.avg_monetary | currency:'BOB':'symbol':'1.0-0' }}</span>
                </div>
                <div class="metric">
                  <span class="label">Frecuencia Media:</span>
                  <span class="value">{{ seg.avg_frequency | number:'1.1-1' }} compras</span>
                </div>
                <div class="metric">
                  <span class="label">Recencia Media:</span>
                  <span class="value">{{ seg.avg_recency_days | number:'1.0-0' }} días</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Sección 3: Detección y Resolución de Anomalías -->
        <section class="section-card">
          <h2>Detección de Anomalías Operativas</h2>
          <p class="section-desc">Comportamientos atípicos de ventas y tráfico en sucursales para auditoría y corrección temprana.</p>

          <div *ngIf="!dashboard()?.anomalias_recientes?.length" class="empty-state">
            No se registran anomalías operativas pendientes.
          </div>

          <div *ngIf="dashboard()?.anomalias_recientes?.length" class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Métrica</th>
                  <th>Valor Observado</th>
                  <th>Esperado</th>
                  <th>Score Anomalía</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let a of dashboard()?.anomalias_recientes">
                  <td>{{ a.anomaly_date | date:'shortDate' }}</td>
                  <td><code>{{ a.metric_name }}</code></td>
                  <td><strong>{{ a.metric_value | number:'1.2-2' }}</strong></td>
                  <td class="text-muted">{{ a.expected_value | number:'1.2-2' }}</td>
                  <td>
                    <span class="pill pill-danger">{{ a.anomaly_score | number:'1.3-3' }}</span>
                  </td>
                  <td>
                    <span *ngIf="!a.resolved" class="pill pill-warning">Abierta</span>
                    <span *ngIf="a.resolved" class="pill pill-success">Resuelta</span>
                  </td>
                  <td>
                    <button *ngIf="!a.resolved" class="btn btn-sm btn-outline" (click)="iniciarResolucion(a)">
                      Resolver
                    </button>
                    <span *ngIf="a.resolved" class="text-muted small">
                      {{ a.notes ?? 'Verificado' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- Modal de resolución de anomalía -->
      <div *ngIf="anomaliaSeleccionada()" class="modal-backdrop">
        <div class="modal-card">
          <h3>Resolver Anomalía Operativa</h3>
          <p>
            Métrica: <strong>{{ anomaliaSeleccionada()?.metric_name }}</strong> el
            {{ anomaliaSeleccionada()?.anomaly_date | date:'shortDate' }}
          </p>
          <div class="form-group">
            <label for="resol-notes">Motivo o causa identificada:</label>
            <textarea
              id="resol-notes"
              class="form-control"
              rows="3"
              [(ngModel)]="notasResolucion"
              placeholder="Ej. Corte de suministro eléctrico en la zona, liquidación especial de temporada..."
            ></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="cancelarResolucion()" [disabled]="guardandoResolucion()">
              Cancelar
            </button>
            <button class="btn btn-primary" (click)="confirmarResolucion()" [disabled]="!notasResolucion.trim() || guardandoResolucion()">
              <span *ngIf="guardandoResolucion()">Guardando...</span>
              <span *ngIf="!guardandoResolucion()">Marcar como Resuelta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ml-dashboard-container {
      padding: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .header h1 {
      margin: 0;
      font-size: 1.6rem;
      color: #1f2937;
    }
    .subtitle {
      margin: 0.25rem 0 0;
      color: #6b7280;
      font-size: 0.9rem;
    }
    .alert {
      padding: 0.75rem 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }
    .alert-error {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #f87171;
    }
    .alert-success {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
    }
    .model-badge-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }
    .badge-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }
    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #10b981;
    }
    .badge-details {
      display: flex;
      gap: 1.5rem;
      font-size: 0.85rem;
      color: #475569;
      flex-wrap: wrap;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .kpi-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .kpi-card.alert-border {
      border-left: 4px solid #ef4444;
    }
    .kpi-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
    }
    .kpi-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: #111827;
      margin: 0.25rem 0;
    }
    .kpi-value small {
      font-size: 0.9rem;
      font-weight: normal;
      color: #6b7280;
    }
    .kpi-value.text-danger {
      color: #dc2626;
    }
    .kpi-sub {
      font-size: 0.8rem;
      color: #9ca3af;
    }
    .section-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .section-card h2 {
      margin: 0 0 0.25rem;
      font-size: 1.25rem;
      color: #1f2937;
    }
    .section-desc {
      margin: 0 0 1rem;
      font-size: 0.85rem;
      color: #6b7280;
    }
    .segments-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }
    .segment-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1rem;
      background: #f8fafc;
    }
    .segment-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .segment-header h3 {
      margin: 0;
      font-size: 1rem;
      color: #334155;
    }
    .segment-metrics .metric {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      margin-bottom: 0.35rem;
    }
    .segment-metrics .label {
      color: #64748b;
    }
    .segment-metrics .value {
      font-weight: 600;
      color: #0f172a;
    }
    .table-responsive {
      overflow-x: auto;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    .data-table th, .data-table td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    .data-table th {
      background: #f9fafb;
      color: #4b5563;
      font-weight: 600;
    }
    .pill {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .pill-success { background: #dcfce7; color: #166534; }
    .pill-warning { background: #fef3c7; color: #92400e; }
    .pill-danger { background: #fee2e2; color: #991b1b; }
    .pill-info { background: #e0f2fe; color: #075985; }
    .pill-neutral { background: #f3f4f6; color: #374151; }
    .text-primary { color: #2563eb; }
    .text-muted { color: #6b7280; }
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }
    .btn-primary {
      background: #2563eb;
      color: white;
    }
    .btn-secondary {
      background: #e5e7eb;
      color: #1f2937;
    }
    .btn-outline {
      background: white;
      border-color: #cbd5e1;
      color: #334155;
    }
    .btn-outline:hover {
      background: #f1f5f9;
    }
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-card {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }
    .modal-card h3 {
      margin-top: 0;
    }
    .form-group {
      margin: 1rem 0;
    }
    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .form-control {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-family: inherit;
      box-sizing: border-box;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
    .empty-state {
      padding: 2rem;
      text-align: center;
      color: #6b7280;
      background: #f9fafb;
      border-radius: 6px;
    }
    .loading-state {
      text-align: center;
      padding: 3rem 0;
      color: #6b7280;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e5e7eb;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class DashboardAnaliticoComponent implements OnInit {
  dashboard = signal<MLDashboard | null>(null);
  cargando = signal<boolean>(false);
  error = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  anomaliaSeleccionada = signal<AnomaliaItem | null>(null);
  notasResolucion = '';
  guardandoResolucion = signal<boolean>(false);

  constructor(private mlApi: MLApi) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  async cargarDatos(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const data = await this.mlApi.getDashboard();
      this.dashboard.set(data);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'No se pudo cargar el tablero analítico.');
    } finally {
      this.cargando.set(false);
    }
  }

  iniciarResolucion(anomalia: AnomaliaItem): void {
    this.anomaliaSeleccionada.set(anomalia);
    this.notasResolucion = '';
  }

  cancelarResolucion(): void {
    this.anomaliaSeleccionada.set(null);
    this.notasResolucion = '';
  }

  async confirmarResolucion(): Promise<void> {
    const anomalia = this.anomaliaSeleccionada();
    if (!anomalia) return;

    this.guardandoResolucion.set(true);
    try {
      await this.mlApi.resolveAnomaly(anomalia.id, this.notasResolucion);
      this.mensajeExito.set('Anomalía marcada como resuelta.');
      setTimeout(() => this.mensajeExito.set(null), 4000);
      this.cancelarResolucion();
      await this.cargarDatos();
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Error al resolver la anomalía.');
    } finally {
      this.guardandoResolucion.set(false);
    }
  }
}
