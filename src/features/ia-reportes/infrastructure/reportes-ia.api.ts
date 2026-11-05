import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../../app/core/shared/api.service';
import {
  DefinicionReporte,
  InterpretResult,
  ReportResponse,
  ReportSpec,
  SolicitudHistorial,
} from '../domain/reporte-ia.models';

@Injectable({ providedIn: 'root' })
export class ReportesIaApi {
  private api = inject(ApiService);
  private http = inject(HttpClient);

  async definitions(): Promise<DefinicionReporte[]> {
    return firstValueFrom(this.api.get<DefinicionReporte[]>('/analytics/ai-reports/definitions'));
  }

  async interpret(text: string, channel: 'TEXT' | 'VOICE' = 'TEXT'): Promise<InterpretResult> {
    return firstValueFrom(
      this.api.post<InterpretResult>('/analytics/ai-reports/interpret', { text, channel })
    );
  }

  async run(spec: ReportSpec, requestId?: string): Promise<ReportResponse> {
    return firstValueFrom(
      this.api.post<ReportResponse>('/analytics/ai-reports/run', {
        spec,
        request_id: requestId || null,
      })
    );
  }

  async exportar(
    spec: ReportSpec,
    format: 'xlsx' | 'pdf' | 'csv' = 'xlsx',
    requestId?: string
  ): Promise<Blob> {
    return firstValueFrom(
      this.http.post(
        `${environment.apiUrl}/analytics/ai-reports/export`,
        {
          spec,
          format,
          request_id: requestId || null,
        },
        { responseType: 'blob' }
      )
    );
  }

  async history(
    mine = false,
    page = 1,
    pageSize = 20
  ): Promise<{ items: SolicitudHistorial[]; total: number; page: number }> {
    return firstValueFrom(
      this.api.get<{ items: SolicitudHistorial[]; total: number; page: number }>(
        '/analytics/ai-reports/history',
        { mine, page, page_size: pageSize }
      )
    );
  }
}
