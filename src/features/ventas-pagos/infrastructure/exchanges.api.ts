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
  BranchStockAvailability,
  InterbranchTransferPayload,
  InterbranchTransferResult,
} from '../domain/cambios.models';

const moneyFields=new Set(['unit_price','subtotal','original_unit_price','new_unit_price','returned_total','delivered_total','price_difference','difference','returned_value','delivered_value','difference_amount','total_returned_value','total_delivered_value','cash_received','cash_returned']);
function exchangeNumbers<T>(value:T):T{
  if(Array.isArray(value))return value.map(item=>exchangeNumbers(item)) as T;
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>
    [key,moneyFields.has(key) && item!=null?Number(item):exchangeNumbers(item)])) as T;
  return value;
}

@Injectable({ providedIn: 'root' })
export class ExchangesApi {
  private api = inject(ApiService);

  async getPolicy(): Promise<ExchangePolicy> {
    const res = await firstValueFrom(
      this.api.get<ExchangePolicy>('/commerce/admin/exchanges/policy'),
    );
    return exchangeNumbers(res);
  }

  async updatePolicy(exchange_days: number): Promise<ExchangePolicy> {
    const res = await firstValueFrom(
      this.api.put<ExchangePolicy>('/commerce/admin/exchanges/policy', { exchange_days }),
    );
    return exchangeNumbers(res);
  }

  async lookupOrder(orderIdOrNumber: string): Promise<ExchangeOrderLookup> {
    const res = await firstValueFrom(
      this.api.get<ExchangeOrderLookup>(
        `/commerce/admin/exchanges/lookup/${encodeURIComponent(orderIdOrNumber.trim())}`,
      ),
    );
    return exchangeNumbers(res);
  }

  async calculate(branchId: string, lines: any[], orderId?:string): Promise<ExchangeCalculation> {
    const res = await firstValueFrom(
      this.api.post<ExchangeCalculation>('/commerce/admin/exchanges/calculate', {
        branch_id: branchId,
        lines,
        original_order_id:orderId,
      }),
    );
    return exchangeNumbers(res);
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
    return exchangeNumbers(res);
  }

  async listExchanges(page = 1, pageSize = 20): Promise<ExchangeListResponse> {
    const res = await firstValueFrom(
      this.api.get<ExchangeListResponse>(
        `/commerce/admin/exchanges?page=${page}&page_size=${pageSize}`,
      ),
    );
    return exchangeNumbers(res);
  }

  async getExchange(id: string): Promise<ExchangeDetail> {
    const res = await firstValueFrom(
      this.api.get<ExchangeDetail>(`/commerce/admin/exchanges/${id}`),
    );
    return exchangeNumbers(res);
  }

  async getAvailability(variantId: string): Promise<BranchStockAvailability[]> {
    return await firstValueFrom(
      this.api.get<BranchStockAvailability[]>(`/commerce/admin/exchanges/availability/${variantId}`),
    );
  }

  async transferStock(payload: InterbranchTransferPayload): Promise<InterbranchTransferResult> {
    return await firstValueFrom(
      this.api.post<InterbranchTransferResult>('/commerce/admin/exchanges/transfer', payload),
    );
  }
}
