import { Injectable, signal } from '@angular/core';
import { ReportQuery } from '../features/ia-reportes/domain/dashboard';

/** Contexto visible que las pantallas publican para el asistente: el filtro
 * con el que el dashboard recalculó sus métricas (o lo que esté mostrando la
 * pantalla actual). El asistente usa este contexto para interpretar pedidos
 * como "explicame esto" o "exportá esto" sin volver a preguntar. */
@Injectable({ providedIn: 'root' })
export class AssistantContextService {
  readonly report = signal<ReportQuery>({});

  setReport(query: ReportQuery | null | undefined) {
    this.report.set(query ?? {});
  }

  clear() {
    this.report.set({});
  }
}