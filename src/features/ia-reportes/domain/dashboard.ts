export interface Dashboard {
  orders: number; paid_orders: number; pending_orders: number; revenue: string;
  currency: string; products: number; customers: number; low_stock: number;
  by_status: Record<string, number>;
  daily_sales: { date: string; total: string }[];
  top_products: { name: string; quantity: number }[];
  stripe_ready: boolean; ai_ready: boolean;
}
export interface Insight { available: boolean; message: string }
