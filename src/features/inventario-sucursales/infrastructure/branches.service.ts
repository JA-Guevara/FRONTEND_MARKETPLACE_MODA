import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../app/core/shared/api.service';
import { Branch } from '../domain/branch';
@Injectable({ providedIn: 'root' })
export class BranchesService {
  private api = inject(ApiService);
  list() {
    return this.api.get<Branch[]>('/public/branches');
  }
}
