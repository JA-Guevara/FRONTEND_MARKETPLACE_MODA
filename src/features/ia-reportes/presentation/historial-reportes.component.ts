import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import {
  chipsDeSpec,
  ReportSpec,
  SolicitudHistorial,
} from '../domain/reporte-ia.models';
import { ReportesIaApi } from '../infrastructure/reportes-ia.api';

@Component({
  selector: 'fs-historial-reportes',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="historial-page">
      <div class="page-header">
        <div>
          <a routerLink="/admin/reportes-ia" class="back-link">← Volver a Reportes con IA</a>
          <h1 class="page-title">Historial de Consultas IA</h1>
          <p class="page-desc">
            Registro de todas las consultas realizadas mediante lenguaje natural y dictado por voz.
          </p>
        </div>
      </div>

      <div class="table-card">
        <div class="loading-state" *ngIf="cargando()">
          Cargando historial de consultas...
        </div>

        <div class="empty-state" *ngIf="!cargando() && items().length === 0">
          No hay consultas registradas aún en el historial.
        </div>

        <div class="table-responsive" *ngIf="!cargando() && items().length > 0">
          <table class="historial-table">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Consulta</th>
                <th>Reporte generado</th>
                <th>Usuario</th>
                <th>Canal</th>
                <th>Estado</th>
                <th>Filas</th>
                <th>Exportación</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of items()">
                <td class="col-date">{{ formatearFecha(item.created_at) }}</td>
                <td class="col-prompt">
                  <strong>{{ resumen(item) }}</strong>
                </td>
                <td>{{ item.title }}</td>
                <td>{{ item.user_name }}</td>
                <td>
                  <span class="badge-canal" [class.badge-canal--voice]="item.channel === 'VOICE'">
                    {{ item.channel === 'VOICE' ? '🎙️ Voz' : '⌨️ Texto' }}
                  </span>
                </td>
                <td>
                  <span class="badge-status" [class.badge-status--executed]="item.status === 'EXECUTED' || item.status === 'EXPORTED'">
                    {{ item.status }}
                  </span>
                </td>
                <td>{{ item.rows ?? '-' }}</td>
                <td>
                  <span *ngIf="item.export_format" class="badge-format">{{ item.export_format.toUpperCase() }}</span>
                  <span *ngIf="!item.export_format">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .historial-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    .back-link {
      font-size: 0.85rem;
      color: #2563eb;
      text-decoration: none;
      font-weight: 600;
      display: inline-block;
      margin-bottom: 0.5rem;
    }
    .page-title {
      font-size: 1.75rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 0.35rem 0;
    }
    .page-desc {
      font-size: 0.95rem;
      color: #64748b;
      margin: 0;
    }
    .table-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .loading-state, .empty-state {
      padding: 2.5rem;
      text-align: center;
      color: #64748b;
      font-size: 0.95rem;
    }
    .table-responsive {
      overflow-x: auto;
    }
    .historial-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    .historial-table th, .historial-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e2e8f0;
      text-align: left;
    }
    .historial-table th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
    }
    .col-date {
      white-space: nowrap;
      color: #64748b;
      font-size: 0.8rem;
    }
    .col-prompt {
      max-width: 320px;
      color: #1e293b;
    }
    .badge-canal {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      background: #f1f5f9;
      color: #475569;
    }
    .badge-canal--voice {
      background: #fef3c7;
      color: #b45309;
    }
    .badge-status {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      border-radius: 6px;
      background: #f1f5f9;
      color: #64748b;
    }
    .badge-status--executed {
      background: #dcfce7;
      color: #15803d;
    }
    .badge-format {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.45rem;
      border-radius: 4px;
      background: #e0f2fe;
      color: #0369a1;
    }
  `],
})
export class HistorialReportesComponent implements OnInit {
  private api = inject(ReportesIaApi);

  items = signal<SolicitudHistorial[]>([]);
  cargando = signal(true);

  async ngOnInit(): Promise<void> {
    try {
      const res = await this.api.history(false, 1, 50);
      this.items.set(res.items || []);
    } catch {
      this.items.set([]);
    } finally {
      this.cargando.set(false);
    }
  }

  resumen(item: SolicitudHistorial): string {
    const tipo = item.title || item.definition_code || 'Reporte';
    return `Consulta de ${item.prompt_length} caracteres · ${tipo} · ${this.filtros(item.spec)}`;
  }

  private filtros(spec: unknown): string {
    if (!spec || typeof spec !== 'object' || !(spec as ReportSpec).filters) return 'Sin filtros';
    const chips = chipsDeSpec(spec as ReportSpec);
    return chips.length
      ? chips.map((chip) => `${chip.etiqueta}: ${chip.valor}`).join(' · ')
      : 'Sin filtros';
  }

  formatearFecha(iso: string): string {
    if (!iso) return '-';
    try {
      const dt = new Date(iso);
      return dt.toLocaleString('es-BO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }
}
