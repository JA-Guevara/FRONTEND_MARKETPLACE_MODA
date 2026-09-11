import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { Dashboard, Insight } from '../domain/dashboard';
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = inject(ApiService);
  load() { return this.api.get<Dashboard>('/analytics/dashboard'); }
  insights() { return this.api.write<Insight>('POST', '/analytics/insights').pipe(map(r => r.data)); }
}
