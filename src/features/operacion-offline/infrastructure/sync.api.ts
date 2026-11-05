import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { SyncOperationWire, SyncResult } from '../domain/sincronizacion.models';

export interface SyncBatchResponse {
  batch_id: string;
  total_operations: number;
  confirmed: number;
  conflicts: number;
  rejected: number;
  retry: number;
  results: SyncResult[];
}

export interface SyncConflictItem {
  id: string;
  tenant_id: string;
  branch_id: string;
  client_request_id: string;
  operation_type: string;
  conflict_type: string;
  status: 'PENDING' | 'RESOLVED';
  detected_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolution?: string | null;
  resolution_notes?: string | null;
  payload_snapshot: any;
  server_state_snapshot: any;
  resolution_payload?: any;
}

export interface ConflictsListResponse {
  items: SyncConflictItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ResolveConflictPayload {
  resolution: 'ADJUST' | 'AUTHORIZE_PRICE' | 'CANCEL' | 'RETRY';
  resolution_notes?: string;
  line_adjustments?: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class SyncApi {
  private api = inject(ApiService);

  postBatch(operations: SyncOperationWire[]): Promise<SyncBatchResponse> {
    return firstValueFrom(
      this.api.write<SyncBatchResponse>('POST', '/sync/batch', { operations }),
    ).then((r: any) => (r && r.data ? r.data : r) as SyncBatchResponse);
  }

  getStatus(clientRequestIds: string[]): Promise<{ operations: SyncResult[] }> {
    return firstValueFrom(
      this.api.get<{ operations: SyncResult[] }>('/sync/status', {
        client_request_ids: clientRequestIds.join(','),
      }),
    ).then((r: any) => (r && r.data ? r.data : r));
  }

  getConflicts(
    branchId?: string,
    status?: string,
    page = 1,
    pageSize = 20,
  ): Promise<ConflictsListResponse> {
    return firstValueFrom(
      this.api.get<ConflictsListResponse>('/sync/conflicts', {
        branch_id: branchId || undefined,
        status: status || undefined,
        page,
        page_size: pageSize,
      }),
    ).then((r: any) => (r && r.data ? r.data : r));
  }

  getConflict(id: string): Promise<SyncConflictItem> {
    return firstValueFrom(
      this.api.get<SyncConflictItem>(`/sync/conflicts/${id}`),
    ).then((r: any) => (r && r.data ? r.data : r));
  }

  resolveConflict(id: string, payload: ResolveConflictPayload): Promise<SyncConflictItem> {
    return firstValueFrom(
      this.api.write<SyncConflictItem>('POST', `/sync/conflicts/${id}/resolve`, payload),
    ).then((r: any) => (r && r.data ? r.data : r));
  }

  getBatches(
    page = 1,
    pageSize = 20,
  ): Promise<{ items: any[]; total: number; page: number; page_size: number }> {
    return firstValueFrom(
      this.api.get<{ items: any[]; total: number; page: number; page_size: number }>(
        '/sync/batches',
        { page, page_size: pageSize },
      ),
    ).then((r: any) => (r && r.data ? r.data : r));
  }

  getBatchDetails(batchId: string): Promise<any> {
    return firstValueFrom(
      this.api.get<any>(`/sync/batches/${batchId}`),
    ).then((r: any) => (r && r.data ? r.data : r));
  }
}
