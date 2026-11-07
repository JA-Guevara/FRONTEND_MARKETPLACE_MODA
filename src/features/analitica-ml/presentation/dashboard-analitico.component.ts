import { Component, OnInit, Optional, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MLApi } from '../infrastructure/ml.api';
import {
  MLDashboard,
  AnomaliaItem,
  AnomaliaRegistro,
  RecomendacionIA,
  SegmentoCliente,
} from '../domain/ml.models';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { errorMessage } from '../../../shared/errors';

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

        <!-- Sección IA: Recomendaciones Estratégicas y Decisiones de Negocio -->
        <section class="section-card ai-recommendations-card" *ngIf="dashboard()?.recomendaciones_ia?.length">
          <div class="ai-card-header">
            <div>
              <h2>Recomendaciones Estratégicas y Decisiones con IA</h2>
              <p class="section-desc">Acciones sugeridas generadas a partir de la demanda proyectada, rotación de catálogo y clusters RFM.</p>
            </div>
            <span class="ai-spark-badge">Decisiones Inteligentes</span>
          </div>

          <div class="recom-grid">
            <div *ngFor="let r of dashboard()?.recomendaciones_ia" class="recom-item" [attr.data-tipo]="r.tipo">
              <div class="recom-top">
                <span class="recom-tipo">{{ r.tipo }}</span>
                <span class="recom-prio" [class.alta]="r.prioridad === 'ALTA'" [class.media]="r.prioridad === 'MEDIA'">
                  Prioridad {{ r.prioridad }}
                </span>
              </div>
              <h4 class="recom-title">{{ r.titulo }}</h4>
              <p class="recom-desc">{{ r.descripcion }}</p>
              <div class="recom-footer">
                <span class="impact-pill">Impacto: {{ r.impacto_estimado }}</span>
                <button type="button" class="btn btn-sm btn-outline-primary" (click)="ejecutarAccion(r)">
                  {{ r.accion }} →
                </button>
              </div>
            </div>
          </div>
        </section>

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

      <!-- CU-31 · Segmentos de clientes (GET /analytics/ml/segments) -->
      <section class="section-card" aria-labelledby="ml-segmentos-titulo">
        <div class="ai-card-header">
          <div>
            <h2 id="ml-segmentos-titulo">Segmentos de clientes</h2>
            <p class="section-desc">Asignación de cada cliente a su segmento RFM según el último entrenamiento.</p>
          </div>
          <label class="small">Segmento
            <select [(ngModel)]="filtroSegmento" aria-label="Filtrar por segmento">
              <option value="">Todos</option>
              <option *ngFor="let n of nombresSegmento()" [value]="n">{{ n }}</option>
            </select>
          </label>
        </div>
        <div *ngIf="cargandoSegmentos()" class="loading-state" role="status">Cargando segmentos de clientes...</div>
        <div *ngIf="!cargandoSegmentos() && errorSegmentos()" class="alert alert-error" role="alert">
          {{ errorSegmentos() }}
          <button type="button" class="btn btn-sm btn-outline" (click)="cargarSegmentos()">Reintentar</button>
        </div>
        <div *ngIf="!cargandoSegmentos() && !errorSegmentos() && !segmentos().length" class="empty-state">
          Todavía no hay clientes segmentados. Entrená el modelo RFM para generar los segmentos.
        </div>
        <div *ngIf="!cargandoSegmentos() && !errorSegmentos() && segmentos().length" class="table-responsive">
          <table class="data-table">
            <thead>
              <tr><th>Cliente</th><th>Segmento</th><th>Recencia</th><th>Frecuencia</th><th>Monto total</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of segmentosFiltrados()">
                <td><code>{{ s.customer_id.slice(0, 8) }}</code></td>
                <td><span class="pill pill-info">{{ s.segment_name }}</span></td>
                <td>{{ s.recency_days }} días</td>
                <td>{{ s.frequency_orders }} compras</td>
                <td>{{ s.monetary_total | currency:'BOB':'symbol':'1.0-0' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- CU-31 · Anomalías (GET /analytics/ml/anomalies) -->
      <section class="section-card" aria-labelledby="ml-anomalias-titulo">
        <div class="ai-card-header">
          <div>
            <h2 id="ml-anomalias-titulo">Anomalías</h2>
            <p class="section-desc">Ventas diarias atípicas detectadas por sucursal, con su estado de revisión.</p>
          </div>
          <label class="small">Estado
            <select [(ngModel)]="filtroAnomalias" (ngModelChange)="cargarAnomalias()" aria-label="Filtrar anomalías por estado">
              <option value="pendientes">Pendientes</option>
              <option value="resueltas">Resueltas</option>
              <option value="todas">Todas</option>
            </select>
          </label>
        </div>
        <div *ngIf="cargandoAnomalias()" class="loading-state" role="status">Cargando anomalías...</div>
        <div *ngIf="!cargandoAnomalias() && errorAnomalias()" class="alert alert-error" role="alert">
          {{ errorAnomalias() }}
          <button type="button" class="btn btn-sm btn-outline" (click)="cargarAnomalias()">Reintentar</button>
        </div>
        <div *ngIf="!cargandoAnomalias() && !errorAnomalias() && !anomalias().length" class="empty-state">
          No hay anomalías {{ filtroAnomalias === 'todas' ? 'registradas' : filtroAnomalias }}.
        </div>
        <div *ngIf="!cargandoAnomalias() && !errorAnomalias() && anomalias().length" class="table-responsive">
          <table class="data-table">
            <thead>
              <tr><th>Fecha</th><th>Motivo</th><th>Score</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let a of anomalias()">
                <td>{{ a.sale_date | date:'shortDate' }}</td>
                <td>{{ a.reason }}</td>
                <td><span class="pill pill-danger">{{ a.anomaly_score | number:'1.3-3' }}</span></td>
                <td>
                  <span *ngIf="!a.resolved" class="pill pill-warning">Abierta</span>
                  <span *ngIf="a.resolved" class="pill pill-success">Resuelta</span>
                </td>
                <td>
                  <button *ngIf="!a.resolved && puedeResolver()" type="button" class="btn btn-sm btn-outline" (click)="iniciarResolucionRegistro(a)">
                    Resolver
                  </button>
                  <span *ngIf="a.resolved" class="text-muted small">{{ a.notes || 'Verificado' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

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
    /* Tarjeta y Grilla de Recomendaciones IA */
    .ai-recommendations-card {
      border: 1px solid #c7d2fe;
      background: linear-gradient(180deg, #f8faff 0%, #ffffff 100%);
    }
    .ai-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
      gap: 12px;
    }
    .ai-spark-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      color: #4338ca;
      background: #e0e7ff;
      border: 1px solid #c7d2fe;
      padding: 4px 12px;
      border-radius: 9999px;
      letter-spacing: 0.04em;
    }
    .recom-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
      gap: 1.25rem;
    }
    .recom-item {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .recom-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
      border-color: #cbd5e1;
    }
    .recom-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.6rem;
    }
    .recom-tipo {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }
    .recom-prio {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 9999px;
      background: #f1f5f9;
      color: #475569;
    }
    .recom-prio.alta {
      background: #fee2e2;
      color: #991b1b;
    }
    .recom-prio.media {
      background: #fef3c7;
      color: #92400e;
    }
    .recom-title {
      margin: 0 0 0.5rem;
      font-size: 0.98rem;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.35;
    }
    .recom-desc {
      margin: 0 0 1rem;
      font-size: 0.84rem;
      color: #475569;
      line-height: 1.5;
      flex: 1;
    }
    .recom-footer {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: auto;
      border-top: 1px solid #f1f5f9;
      padding-top: 0.75rem;
    }
    .impact-pill {
      font-size: 0.76rem;
      color: #047857;
      background: #ecfdf5;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 600;
      display: inline-block;
    }
    .btn-outline-primary {
      background: transparent;
      border: 1px solid #3b82f6;
      color: #2563eb;
      font-weight: 600;
      border-radius: 8px;
      padding: 6px 12px;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s ease;
    }
    .btn-outline-primary:hover {
      background: #2563eb;
      color: #ffffff;
    }

    /* Modal Flotante de Alta Gama */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(8px) saturate(140%);
      -webkit-backdrop-filter: blur(8px) saturate(140%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }
    .modal-card {
      background: #ffffff;
      border-radius: 20px;
      padding: 2rem;
      width: 100%;
      max-width: 520px;
      border: 1px solid rgba(255, 255, 255, 0.4);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05);
      animation: modalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes modalScaleIn {
      from { opacity: 0; transform: scale(0.95) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .modal-card h3 {
      margin: 0 0 0.5rem;
      font-size: 1.35rem;
      color: #0f172a;
      font-weight: 750;
    }
    .form-group {
      margin: 1.25rem 0;
    }
    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-size: 0.88rem;
      font-weight: 600;
      color: #334155;
    }
    .form-control {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      font-family: inherit;
      font-size: 0.92rem;
      box-sizing: border-box;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      background: #f8fafc;
    }
    .form-control:focus {
      background: #ffffff;
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
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

  segmentos = signal<SegmentoCliente[]>([]);
  cargandoSegmentos = signal<boolean>(false);
  errorSegmentos = signal<string | null>(null);
  filtroSegmento = '';
  readonly nombresSegmento = computed(() => [...new Set(this.segmentos().map((s) => s.segment_name))].sort());

  anomalias = signal<AnomaliaRegistro[]>([]);
  cargandoAnomalias = signal<boolean>(false);
  errorAnomalias = signal<string | null>(null);
  filtroAnomalias: 'pendientes' | 'resueltas' | 'todas' = 'pendientes';

  constructor(
    private mlApi: MLApi,
    @Optional() private session?: SessionService,
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
    void this.cargarSegmentos();
    void this.cargarAnomalias();
  }

  /** Resolver exige ml_models.manage en el backend y no aplica en modo solo lectura. */
  puedeResolver(): boolean {
    if (!this.session) return true;
    return this.session.can('ml_models.manage') && !this.session.readOnly();
  }

  segmentosFiltrados(): SegmentoCliente[] {
    return this.filtroSegmento
      ? this.segmentos().filter((s) => s.segment_name === this.filtroSegmento)
      : this.segmentos();
  }

  async cargarSegmentos(): Promise<void> {
    this.cargandoSegmentos.set(true);
    this.errorSegmentos.set(null);
    try {
      this.segmentos.set((await this.mlApi.getSegments()) ?? []);
    } catch (err) {
      this.segmentos.set([]);
      this.errorSegmentos.set(errorMessage(err));
    } finally {
      this.cargandoSegmentos.set(false);
    }
  }

  async cargarAnomalias(): Promise<void> {
    this.cargandoAnomalias.set(true);
    this.errorAnomalias.set(null);
    const resolved = this.filtroAnomalias === 'todas' ? undefined : this.filtroAnomalias === 'resueltas';
    try {
      this.anomalias.set((await this.mlApi.getAnomalies(resolved)) ?? []);
    } catch (err) {
      this.anomalias.set([]);
      this.errorAnomalias.set(errorMessage(err));
    } finally {
      this.cargandoAnomalias.set(false);
    }
  }

  /** Reutiliza el diálogo de resolución adaptando la fila de /anomalies. */
  iniciarResolucionRegistro(a: AnomaliaRegistro): void {
    this.iniciarResolucion({
      id: a.id,
      branch_id: a.branch_id,
      anomaly_date: a.sale_date,
      metric_name: a.reason,
      metric_value: 0,
      expected_value: 0,
      anomaly_score: a.anomaly_score,
      resolved: a.resolved,
    });
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

  ejecutarAccion(r: RecomendacionIA): void {
    this.mensajeExito.set(`Acción programada: "${r.accion}" para el área de ${r.tipo.toLowerCase()}.`);
    setTimeout(() => this.mensajeExito.set(null), 4500);
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
      await Promise.all([this.cargarDatos(), this.cargarAnomalias()]);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Error al resolver la anomalía.');
    } finally {
      this.guardandoResolucion.set(false);
    }
  }
}
