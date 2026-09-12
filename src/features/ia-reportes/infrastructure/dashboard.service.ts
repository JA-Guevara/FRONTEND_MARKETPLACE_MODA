import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { Dashboard, Insight } from '../domain/dashboard';
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = inject(ApiService);
  load(date_from?: string, date_to?: string) {
    return this.api.get<Dashboard>('/analytics/dashboard', { date_from: date_from || '', date_to: date_to || '' });
  }
  insights() { return this.api.write<Insight>('POST', '/analytics/insights').pipe(map(r => r.data)); }
}
