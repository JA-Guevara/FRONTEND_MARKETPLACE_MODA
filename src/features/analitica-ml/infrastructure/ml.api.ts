import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import {
  CustomerSegmentItem,
  AnomaliaItem,
  MLDashboard,
  MLModelSummary,
  MLTrainingRun,
} from '../domain/ml.models';

@Injectable({ providedIn: 'root' })
export class MLApi {
  private api = inject(ApiService);

  async getDashboard(): Promise<MLDashboard> {
    const res = await firstValueFrom(
      this.api.get<{ success: boolean; data: MLDashboard }>('/analytics/ml/dashboard')
    );
    return res.data;
  }

  async getSegments(): Promise<CustomerSegmentItem[]> {
    const res = await firstValueFrom(
      this.api.get<{ success: boolean; data: CustomerSegmentItem[] }>('/analytics/ml/segments')
    );
    return res.data;
  }

  async getAnomalies(resolved?: boolean): Promise<AnomaliaItem[]> {
    const params: Record<string, string> = {};
    if (resolved !== undefined) {
      params['resolved'] = String(resolved);
    }
    const res = await firstValueFrom(
      this.api.get<{ success: boolean; data: AnomaliaItem[] }>('/analytics/ml/anomalies', {
        params,
      })
    );
    return res.data;
  }

  async resolveAnomaly(id: string, notes: string): Promise<AnomaliaItem> {
    const res = await firstValueFrom(
      this.api.post<{ success: boolean; data: AnomaliaItem }>(
        `/analytics/ml/anomalies/${id}/resolve`,
        { notes }
      )
    );
    return res.data;
  }

  async initializeDemo(seed = 42) {
    return firstValueFrom(
      this.api.post<{ status: string }>(`/platform/ml/initialize?seed=${seed}`, {}),
    );
  }

  async getPlatformRuns(): Promise<MLTrainingRun[]> {
    return firstValueFrom(this.api.get<MLTrainingRun[]>('/platform/ml/runs'));
  }

  async getPlatformModels(): Promise<MLModelSummary[]> {
    return firstValueFrom(this.api.get<MLModelSummary[]>('/platform/ml/models'));
  }
}
