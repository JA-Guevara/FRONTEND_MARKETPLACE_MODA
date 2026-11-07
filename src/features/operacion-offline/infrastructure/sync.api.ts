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
  lines?: { variant_id: string; product_name: string; requested_quantity: number;
    available_quantity: number; unit_price: string; current_price: string }[];
}

interface ConflictWire {
  id: string;
  client_request_id: string;
  branch_id: string;
  operation_type: string;
  type: string;
  status: 'OPEN' | 'RESOLVED';
  created_at: string;
  resolved_at?: string;
  resolution?: string;
  resolution_note?: string;
  lines: NonNullable<SyncConflictItem['lines']>;
}

function convertirConflicto(item: ConflictWire): SyncConflictItem {
  return {
    id: item.id, tenant_id: '', client_request_id: item.client_request_id, branch_id: item.branch_id,
    operation_type: item.operation_type, conflict_type: item.type,
    status: item.status === 'OPEN' ? 'PENDING' : 'RESOLVED', detected_at: item.created_at,
    resolved_at: item.resolved_at, resolution: item.resolution, resolution_notes: item.resolution_note,
    lines: item.lines, payload_snapshot: item.lines.map(line => ({
      prenda: line.product_name, cantidad: line.requested_quantity, precio: line.unit_price,
    })), server_state_snapshot: item.lines.map(line => ({
      prenda: line.product_name, disponible: line.available_quantity, precio: line.current_price,
    })),
  };
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
      this.api.write<SyncBatchResponse>('POST', '/sync/batch', {
        device_id: operations[0]?.device_id, client_version: 'web-offline-v2', operations,
      }),
    ).then(r => {
      const data = r.data;
      return { ...data, total_operations: operations.length,
        confirmed: data.results.filter(result => result.status === 'CONFIRMED').length,
        conflicts: data.results.filter(result => result.status === 'CONFLICT').length,
        rejected: data.results.filter(result => result.status === 'REJECTED').length,
        retry: data.results.filter(result => result.status === 'RETRY').length };
    });
  }

  getStatus(clientRequestIds: string[]): Promise<{ operations: SyncResult[] }> {
    return firstValueFrom(
      this.api.post<SyncResult[]>('/sync/status', { client_request_ids: clientRequestIds }),
    ).then(operations => ({ operations }));
  }

  getConflicts(
    branchId?: string,
    status?: string,
    page = 1,
    pageSize = 20,
  ): Promise<ConflictsListResponse> {
    return firstValueFrom(
      this.api.get<Omit<ConflictsListResponse, 'items'> & { items: ConflictWire[] }>('/sync/conflicts', {
        branch_id: branchId || undefined,
        status: status === 'PENDING' ? 'OPEN' : status || undefined,
        page,
        page_size: pageSize,
      }),
    ).then(result => ({ ...result, items: result.items.map(convertirConflicto) }));
  }

  getConflict(id: string): Promise<SyncConflictItem> {
    return firstValueFrom(
      this.api.get<ConflictWire>(`/sync/conflicts/${id}`),
    ).then(convertirConflicto);
  }

  resolveConflict(id: string, payload: ResolveConflictPayload): Promise<SyncConflictItem> {
    return firstValueFrom(
      this.api.post<ConflictWire>(`/sync/conflicts/${id}/resolve`, {
        action: payload.resolution, note: payload.resolution_notes ?? 'Reevaluar operación pendiente',
        quantities: payload.line_adjustments,
      }),
    ).then(convertirConflicto);
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
