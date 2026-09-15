import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { environment } from '../../../environments/environment';
import {
  Dashboard, ExplainResult, ExportReport, Insight, InterpretResult, ReportQuery,
} from '../domain/dashboard';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  load(query: ReportQuery = {}) {
    return this.api.get<Dashboard>('/analytics/dashboard', query as Record<string, unknown>);
  }
  insights(filters?: ReportQuery) {
    return this.api.write<Insight>('POST', '/analytics/insights', filters ? { filters } : null).pipe(map(r => r.data));
  }
  /** Funcion A del asistente de reportes: lenguaje natural -> estructura validada. */
  interpret(message: string, current: ReportQuery) {
    return this.api
      .write<InterpretResult>('POST', '/analytics/assistant/interpret', { message, current })
      .pipe(map(r => r.data));
  }
  /** Funcion B: explica las métricas recalculadas por el servidor. */
  explain(question: string, filters: ReportQuery) {
    return this.api
      .write<ExplainResult>('POST', '/analytics/assistant/explain', { question, filters })
      .pipe(map(r => r.data));
  }
  /** Exporta el reporte autorizado con los filtros visibles (xlsx/csv). */
  exportUrl(report: ExportReport, format: 'xlsx' | 'csv', query: ReportQuery) {
    let params = new HttpParams().set('report', report).set('format', format);
    for (const [key, value] of Object.entries(query)) {
      if (value === '' || value === undefined || value === null) continue;
      params = params.append(key, String(value));
    }
    return this.http.get(environment.apiUrl + '/analytics/reports/export', {
      params,
      responseType: 'blob',
    });
  }
}