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
  /** Exporta el reporte autorizado con los filtros visibles (xlsx/csv).
   * Se mantiene para retrocompatibilidad; el panel nuevo usa exportMultiple. */
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
  /** Exportación múltiple (xlsx/PDF/csv): varios reportes en una sola
   * operación, con los filtros VISIBLES del dashboard. El servidor valida los
   * tipos y devuelve el archivo; los encabezados X-Export-* comunican
   * truncamiento para mostrar la nota honesta en el panel. */
  exportMultiple(reports: ExportReport[], format: 'xlsx' | 'pdf' | 'csv', query: ReportQuery) {
    const filters: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value === '' || value === undefined || value === null) continue;
      filters[key] = value;
    }
    const body: Record<string, unknown> = { reports, format };
    if (Object.keys(filters).length) body['filters'] = filters;
    return this.http.post(environment.apiUrl + '/analytics/reports/export-multiple', body, {
      responseType: 'blob',
      observe: 'response',
    });
  }
  /** Ejecuta una herramienta tipada del asistente (hoy export_report) contra el
   * registro autorizado del servidor. request_id hace idempotente la operacion:
   * si se repite, el servidor no vuelve a auditar ni regenera el trabajo y
   * responde con X-Idempotent-Replay: true. */
  executeTool(
    requestId: string,
    tool: 'export_report',
    reports: ExportReport[],
    format: 'xlsx' | 'pdf' | 'csv',
    query: ReportQuery,
  ) {
    const filters: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value === '' || value === undefined || value === null) continue;
      filters[key] = value;
    }
    const params: Record<string, unknown> = { reports, format };
    if (Object.keys(filters).length) params['filters'] = filters;
    return this.http.post(environment.apiUrl + '/analytics/assistant/execute', {
      tool,
      request_id: requestId,
      params,
    }, { responseType: 'blob', observe: 'response' });
  }
}