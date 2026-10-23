import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../app/core/shared/api.service';
import { OfflineSnapshot } from '../domain/offline.models';
@Injectable({ providedIn: 'root' })
export class SnapshotApi {
  private api = inject(ApiService);
  get(branchId: string | null, since: string | null) {
    return this.api.get<OfflineSnapshot>('/offline/snapshot', { branch_id: branchId, since });
  }
}
