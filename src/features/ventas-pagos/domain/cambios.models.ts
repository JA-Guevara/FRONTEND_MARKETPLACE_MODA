export interface ExchangePolicy {
  tenant_id: string;
  exchange_days: number;
}

export interface ExchangeOrderLookupItem {
  variant_id: string;
  product_id?: string;
  product_name: string;
  sku?: string;
  size?: string;
  color?: string;
  original_quantity: number;
  already_exchanged_quantity: number;
  available_for_exchange: number;
  unit_price: number;
  subtotal: number;
}

export interface ExchangeOrderLookup {
  order_id: string;
  order_number: string;
  purchase_date: string;
  deadline_days: number;
  remaining_days: number;
  can_exchange: boolean;
  customer_email: string;
  branch_id: string;
  items: ExchangeOrderLookupItem[];
}

export interface ExchangeLineCalculate {
  original_variant_id: string;
  returned_quantity: number;
  original_unit_price: number;
  new_variant_id: string;
  delivered_quantity: number;
  new_unit_price: number;
  returned_value?: number;
  delivered_value?: number;
  difference?: number;
}

export interface ExchangeCalculation {
  total_returned_value: number;
  total_delivered_value: number;
  difference_amount: number;
  tipo_diferencia: 'PAGO_CLIENTE' | 'REINTEGRO_O_SALDO' | 'CAMBIO_DIRECTO';
  lineas: Array<{
    original_variant_id: string;
    returned_quantity: number;
    returned_value: number;
    new_variant_id: string;
    delivered_quantity: number;
    delivered_value: number;
    difference: number;
  }>;
}

export interface ExecuteExchangePayload {
  original_order_id: string;
  branch_id: string;
  payment_method: string;
  cash_received?: number;
  cash_returned?: number;
  notes?: string;
  client_request_id?: string;
  lines: ExchangeLineCalculate[];
}

export interface ExchangeLineDetail {
  id: string;
  original_variant_id: string;
  original_sku?: string;
  original_product_name?: string;
  returned_quantity: number;
  original_unit_price: number;
  returned_total: number;
  new_variant_id: string;
  new_sku?: string;
  new_product_name?: string;
  delivered_quantity: number;
  new_unit_price: number;
  delivered_total: number;
  price_difference: number;
}

export interface ExchangeDetail {
  id: string;
  tenant_id: string;
  branch_id: string;
  original_order_id: string;
  original_order_number?: string;
  difference_amount: number;
  payment_method: string;
  cash_received?: number;
  cash_returned?: number;
  status: string;
  notes?: string;
  created_at: string;
  lines: ExchangeLineDetail[];
}

export interface ExchangeSummaryItem {
  id: string;
  original_order_id: string;
  original_order_number?: string;
  branch_id: string;
  difference_amount: number;
  payment_method: string;
  status: string;
  lines_count: number;
  created_at: string;
}

export interface ExchangeListResponse {
  items: ExchangeSummaryItem[];
  total: number;
  page: number;
  page_size: number;
}
