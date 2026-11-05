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

  async initialize(seed = 42): Promise<any> {
    const res = await firstValueFrom(
      this.api.post<{ success: boolean; data: any }>(
        `/analytics/ml/initialize?seed=${seed}`,
        {}
      )
    );
    return res.data;
  }

  async getPlatformRuns(): Promise<MLTrainingRun[]> {
    const res = await firstValueFrom(
      this.api.get<{ success: boolean; data: MLTrainingRun[] }>('/platform/ml/runs')
    );
    return res.data;
  }

  async getPlatformModels(): Promise<MLModelSummary[]> {
    const res = await firstValueFrom(
      this.api.get<{ success: boolean; data: MLModelSummary[] }>('/platform/ml/models')
    );
    return res.data;
  }
}
