import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import {
  ExchangeCalculation,
  ExchangeDetail,
  ExchangeListResponse,
  ExchangeOrderLookup,
  ExchangePolicy,
  ExecuteExchangePayload,
} from '../domain/cambios.models';

@Injectable({ providedIn: 'root' })
export class ExchangesApi {
  private api = inject(ApiService);

  async getPolicy(): Promise<ExchangePolicy> {
    const res = await firstValueFrom(
      this.api.get<{ success: boolean; data: ExchangePolicy }>('/commerce/admin/exchanges/policy')
    );
    return res.data;
  }

  async updatePolicy(exchange_days: number): Promise<ExchangePolicy> {
    const res = await firstValueFrom(
      this.api.put<{ success: boolean; data: ExchangePolicy }>(
        '/commerce/admin/exchanges/policy',
        { exchange_days }
      )
    );
    return res.data;
  }

  async lookupOrder(orderIdOrNumber: string): Promise<ExchangeOrderLookup> {
    const res = await firstValueFrom(
      this.api.get<{ success: boolean; data: ExchangeOrderLookup }>(
        `/commerce/admin/exchanges/lookup/${encodeURIComponent(orderIdOrNumber.trim())}`
      )
    );
    return res.data;
  }

  async calculate(branchId: string, lines: any[]): Promise<ExchangeCalculation> {
    const res = await firstValueFrom(
      this.api.post<{ success: boolean; data: ExchangeCalculation }>(
        '/commerce/admin/exchanges/calculate',
        { branch_id: branchId, lines }
      )
    );
    return res.data;
  }

  async executeExchange(payload: ExecuteExchangePayload): Promise<ExchangeDetail> {
    const res = await firstValueFrom(
      this.api.post<{ success: boolean; data: ExchangeDetail }>(
        '/commerce/admin/exchanges',
        payload
      )
    );
    return res.data;
  }

  async listExchanges(page = 1, pageSize = 20): Promise<ExchangeListResponse> {
    const res = await firstValueFrom(
      this.api.get<{ success: boolean; data: ExchangeListResponse }>(
        `/commerce/admin/exchanges?page=${page}&page_size=${pageSize}`
      )
    );
    return res.data;
  }

  async getExchange(id: string): Promise<ExchangeDetail> {
    const res = await firstValueFrom(
      this.api.get<{ success: boolean; data: ExchangeDetail }>(
        `/commerce/admin/exchanges/${id}`
      )
    );
    return res.data;
  }
}
