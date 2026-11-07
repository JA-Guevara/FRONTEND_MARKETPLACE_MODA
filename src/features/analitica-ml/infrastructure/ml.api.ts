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
    return firstValueFrom(this.api.get<MLDashboard>('/analytics/ml/dashboard'));
  }

  async getSegments(): Promise<CustomerSegmentItem[]> {
    return firstValueFrom(this.api.get<CustomerSegmentItem[]>('/analytics/ml/segments'));
  }

  async getAnomalies(resolved?: boolean): Promise<AnomaliaItem[]> {
    const params: Record<string, string> = {};
    if (resolved !== undefined) {
      params['resolved'] = String(resolved);
    }
    return firstValueFrom(this.api.get<AnomaliaItem[]>('/analytics/ml/anomalies', params));
  }

  async resolveAnomaly(id: string, notes: string): Promise<AnomaliaItem> {
    return firstValueFrom(
      this.api.post<AnomaliaItem>(`/analytics/ml/anomalies/${id}/resolve`, { notes }),
    );
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
