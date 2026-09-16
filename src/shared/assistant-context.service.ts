import { Injectable, signal } from '@angular/core';
import { ReportQuery } from '../features/ia-reportes/domain/dashboard';

export interface ApplyRequest {
  query: ReportQuery;
  source: string;
}

/** Contexto visible que las pantallas publican para el asistente: el filtro
 * con el que el dashboard recalculó sus métricas (o lo que esté mostrando la
 * pantalla actual). El asistente usa este contexto para interpretar pedidos
 * como "explicame esto" o "exportá esto" sin volver a preguntar.
 *
 * Para los pedidos de tipo "mostrame las ventas de la sucursal central", el
 * asistente solicita con `applyToScreen` que el dashboard aplique esos filtros;
 * la pantalla consume la petición con `consumeApply`. */
@Injectable({ providedIn: 'root' })
export class AssistantContextService {
  readonly report = signal<ReportQuery>({});
  readonly applyRequest = signal<ApplyRequest | null>(null);

  setReport(query: ReportQuery | null | undefined) {
    this.report.set(query ?? {});
  }

  applyToScreen(query: ReportQuery, source = 'asistente') {
    this.applyRequest.set({ query, source });
  }

  consumeApply(): ApplyRequest | null {
    const request = this.applyRequest();
    this.applyRequest.set(null);
    return request;
  }

  clear() {
    this.report.set({});
  }
}