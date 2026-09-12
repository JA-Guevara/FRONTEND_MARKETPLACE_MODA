export interface Dashboard {
  orders: number; paid_orders: number; pending_orders: number; revenue: string;
  currency: string; products: number; customers: number; low_stock: number;
  by_status: Record<string, number>;
  daily_sales: { date: string; total: string }[];
  top_products: { name: string; quantity: number }[];
  stripe_ready: boolean; ai_ready: boolean;
  average_ticket: string;
  cancellation_rate: number;
  monthly_sales: { month: string; total: string; orders: number }[];
  hourly_distribution: { hour: number; total: string; orders: number }[];
  weekday_distribution: { weekday: string; total: string; orders: number }[];
  category_breakdown: { category: string; total: string; quantity: number }[];
  branch_performance: { branch: string; total: string; orders: number }[];
  projection: { dates: string[]; values: string[]; trend: 'up' | 'down' | 'stable' };
}
export interface Insight { available: boolean; message: string }
