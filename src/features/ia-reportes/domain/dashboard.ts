export interface PeriodKpi {
  orders: number;
  paid_orders: number;
  pending_orders: number;
  revenue: string;
  units_sold: number;
  ticket_avg: string;
  cancellation_rate: number;
}
export interface DashboardMeta {
  period: { from: string | null; to: string | null };
  timezone: string;
  currency: string;
  generated_at: string;
  coverage: string;
  note: string;
}
export interface ComparisonSide {
  revenue: string;
  paid_orders: number;
  revenue_delta_pct: number | null;
  paid_delta_pct: number | null;
  base_note: string | null;
}
export interface Comparison {
  available: boolean;
  mode: string;
  note: string;
  previous: ComparisonSide | null;
  year_ago: ComparisonSide | null;
}
export interface LowStockVariant {
  variant_id: string;
  product_id: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  branch: string;
  branch_id: string;
  quantity: number;
}
export interface PaymentMethod {
  method: string;
  orders: number;
}
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
  projection: { dates: string[]; values: string[]; trend: 'up' | 'down' | 'stable'; meta: { method: string; horizon_days: number } };
  meta: DashboardMeta;
  period: PeriodKpi;
  units_sold: number;
  comparison: Comparison;
  low_stock_variants: LowStockVariant[];
  reservations_by_status: { status: string; count: number }[];
  payment_methods: PaymentMethod[];
}
export interface Insight { available: boolean; message: string }

/** Filtros del reporte; el servidor recalcula las métricas con ellos. */
export interface ReportQuery {
  date_from?: string;
  date_to?: string;
  branch_id?: string | null;
  category_id?: string | null;
  status?: string;
  low_stock_lt?: number;
}
export type ViewId =
  | 'resumen' | 'ventas' | 'comparativas' | 'sucursales'
  | 'productos' | 'inventario' | 'reservas' | 'pagos';
export interface InterpretResult {
  ok: boolean;
  vista: string;
  filtros: ReportQuery;
  agrupacion: string | null;
  metrica: string;
  comparacion: string;
  aclaraciones: string[];
  respuesta: string;
}
export interface ExplainSections {
  hallazgo: string;
  cifras: string;
  interpretacion: string;
  accion: string;
  limitaciones: string;
}
export interface ExplainResult {
  available: boolean;
  sections?: ExplainSections;
  message?: string;
  context_used?: ReportQuery;
}
export type ExportReport =
  | 'ventas' | 'pedidos' | 'pagos' | 'prendas_vendidas' | 'existencias' | 'sucursales';