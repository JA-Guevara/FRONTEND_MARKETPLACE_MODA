import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MLApi } from '../infrastructure/ml.api';
import { MLModelSummary, MLTrainingRun } from '../domain/ml.models';

@Component({
  selector: 'app-modelos-analiticos',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="models-container">
      <header class="header">
        <div>
          <h1>Gestión de Modelos de Machine Learning</h1>
          <p class="subtitle">
            Ciclo de vida, ejecuciones de entrenamiento (Training Runs) y modelos desplegados en la plataforma.
          </p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" (click)="entrenarModelos()" [disabled]="entrenando()">
            <span *ngIf="entrenando()">Entrenando y Evaluando...</span>
            <span *ngIf="!entrenando()">Entrenar / Reentrenar Modelos</span>
          </button>
          <button class="btn btn-secondary" (click)="cargarDatos()" [disabled]="cargando()">
            Actualizar
          </button>
        </div>
      </header>

      <div *ngIf="error()" class="alert alert-error">
        {{ error() }}
      </div>
      <div *ngIf="mensajeExito()" class="alert alert-success">
        {{ mensajeExito() }}
      </div>

      <!-- Sección de Modelos Activos -->
      <section class="section-card">
        <h2>Modelos Registrados</h2>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Versión</th>
                <th>Estado</th>
                <th>Métricas</th>
                <th>Creado</th>
                <th>Publicado</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let m of models()">
                <td><strong>{{ m.model_type }}</strong></td>
                <td><code>v{{ m.version }}</code></td>
                <td>
                  <span *ngIf="m.is_active" class="pill pill-success">Producción</span>
                  <span *ngIf="!m.is_active" class="pill pill-neutral">Inactivo</span>
                </td>
                <td>
                  <span *ngIf="m.r2_score !== undefined">R²: {{ m.r2_score | number:'1.2-2' }}, MAE: {{ m.mae | number:'1.2-2' }}</span>
                  <span *ngIf="m.silhouette_score !== undefined">Silhouette: {{ m.silhouette_score | number:'1.2-2' }}</span>
                  <span *ngIf="m.contamination !== undefined">Contaminación: {{ m.contamination | percent }}</span>
                </td>
                <td>{{ m.created_at | date:'short' }}</td>
                <td>{{ m.published_at ? (m.published_at | date:'short') : '-' }}</td>
              </tr>
              <tr *ngIf="!models().length">
                <td colspan="6" class="text-center text-muted">No hay modelos registrados.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Sección de Training Runs -->
      <section class="section-card">
        <h2>Historial de Ejecuciones de Entrenamiento</h2>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tipo</th>
                <th>Versión</th>
                <th>Estado</th>
                <th>R²</th>
                <th>MAE</th>
                <th>RMSE</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of runs()">
                <td><code>{{ r.id.substring(0, 8) }}</code></td>
                <td>{{ r.model_type }}</td>
                <td>v{{ r.version }}</td>
                <td>
                  <span *ngIf="r.status === 'COMPLETED'" class="pill pill-success">Completado</span>
                  <span *ngIf="r.status === 'RUNNING'" class="pill pill-warning">En Ejecución</span>
                  <span *ngIf="r.status === 'FAILED'" class="pill pill-danger">Falló</span>
                </td>
                <td>{{ r.r2_score ? (r.r2_score | number:'1.2-2') : '-' }}</td>
                <td>{{ r.mae ? (r.mae | number:'1.2-2') : '-' }}</td>
                <td>{{ r.rmse ? (r.rmse | number:'1.2-2') : '-' }}</td>
                <td>{{ r.created_at | date:'short' }}</td>
              </tr>
              <tr *ngIf="!runs().length">
                <td colspan="8" class="text-center text-muted">No se registran ejecuciones de entrenamiento aún.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .models-container {
      padding: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      gap: 1rem;
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
    .header-actions {
      display: flex;
      gap: 0.5rem;
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
    .section-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .section-card h2 {
      margin: 0 0 1rem;
      font-size: 1.25rem;
      color: #1f2937;
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
    .pill-neutral { background: #f3f4f6; color: #374151; }
    .text-center { text-align: center; }
    .text-muted { color: #6b7280; }
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .btn-primary { background: #2563eb; color: white; }
    .btn-secondary { background: #e5e7eb; color: #1f2937; }
  `]
})
export class ModelosAnaliticosComponent implements OnInit {
  models = signal<MLModelSummary[]>([]);
  runs = signal<MLTrainingRun[]>([]);
  cargando = signal<boolean>(false);
  entrenando = signal<boolean>(false);
  error = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  constructor(private mlApi: MLApi) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  async cargarDatos(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [m, r] = await Promise.all([
        this.mlApi.getPlatformModels(),
        this.mlApi.getPlatformRuns(),
      ]);
      this.models.set(m);
      this.runs.set(r);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Error al cargar modelos.');
    } finally {
      this.cargando.set(false);
    }
  }

  async entrenarModelos(): Promise<void> {
    this.entrenando.set(true);
    this.error.set(null);
    try {
      await this.mlApi.initialize(42);
      this.mensajeExito.set('Entrenamiento completado y modelos actualizados exitosamente.');
      setTimeout(() => this.mensajeExito.set(null), 4000);
      await this.cargarDatos();
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Error durante el entrenamiento.');
    } finally {
      this.entrenando.set(false);
    }
  }
}
