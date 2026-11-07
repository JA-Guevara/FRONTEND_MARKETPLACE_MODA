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
      this.api.get<ExchangePolicy>('/commerce/admin/exchanges/policy'),
    );
    return res;
  }

  async updatePolicy(exchange_days: number): Promise<ExchangePolicy> {
    const res = await firstValueFrom(
      this.api.put<ExchangePolicy>('/commerce/admin/exchanges/policy', { exchange_days }),
    );
    return res;
  }

  async lookupOrder(orderIdOrNumber: string): Promise<ExchangeOrderLookup> {
    const res = await firstValueFrom(
      this.api.get<ExchangeOrderLookup>(
        `/commerce/admin/exchanges/lookup/${encodeURIComponent(orderIdOrNumber.trim())}`,
      ),
    );
    return res;
  }

  async calculate(branchId: string, lines: any[], orderId?:string): Promise<ExchangeCalculation> {
    const res = await firstValueFrom(
      this.api.post<ExchangeCalculation>('/commerce/admin/exchanges/calculate', {
        branch_id: branchId,
        lines,
        original_order_id:orderId,
      }),
    );
    return res;
  }

  options(branchId: string) {
    return firstValueFrom(
      this.api.get<import('../domain/commerce.models').CartItem[]>(
        '/commerce/admin/exchanges/options/' + branchId,
      ),
    );
  }

  async executeExchange(payload: ExecuteExchangePayload): Promise<ExchangeDetail> {
    const res = await firstValueFrom(
      this.api.post<ExchangeDetail>('/commerce/admin/exchanges', payload),
    );
    return res;
  }

  async listExchanges(page = 1, pageSize = 20): Promise<ExchangeListResponse> {
    const res = await firstValueFrom(
      this.api.get<ExchangeListResponse>(
        `/commerce/admin/exchanges?page=${page}&page_size=${pageSize}`,
      ),
    );
    return res;
  }

  async getExchange(id: string): Promise<ExchangeDetail> {
    const res = await firstValueFrom(
      this.api.get<ExchangeDetail>(`/commerce/admin/exchanges/${id}`),
    );
    return res;
  }
}
