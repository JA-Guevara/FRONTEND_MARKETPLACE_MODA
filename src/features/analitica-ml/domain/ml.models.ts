export interface MLModelSummary {
  id: string;
  model_type: 'DEMAND' | 'RFM' | 'ANOMALY';
  version: string;
  is_active: boolean;
  r2_score?: number;
  mae?: number;
  rmse?: number;
  silhouette_score?: number;
  contamination?: number;
  created_at: string;
  published_at?: string;
}

export interface DemandaPunto {
  semana: number;
  fecha: string;
  ventas_reales?: number;
  demanda_proyectada: number;
  intervalo_inferior: number;
  intervalo_superior: number;
}

export interface SegmentoResumen {
  segment_id: number;
  segment_name: string;
  customer_count: number;
  avg_monetary: number;
  avg_frequency: number;
  avg_recency_days: number;
  percentage: number;
}

export interface AnomaliaItem {
  id: string;
  branch_id: string;
  branch_name?: string;
  anomaly_date: string;
  metric_name: string;
  metric_value: number;
  expected_value: number;
  anomaly_score: number;
  resolved: boolean;
  notes?: string;
  resolved_at?: string;
}

export interface DashboardKPIs {
  demanda_proxima_semana: number;
  total_clientes_segmentados: number;
  anomalias_pendientes: number;
  precision_modelo_r2: number;
  error_promedio_mae: number;
}

export interface MLDashboard {
  tenant_id: string;
  modelo_activo?: MLModelSummary;
  kpis: DashboardKPIs;
  serie_demanda: DemandaPunto[];
  segmentos: SegmentoResumen[];
  anomalias_recientes: AnomaliaItem[];
}

export interface CustomerSegmentItem {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  segment_id: number;
  segment_name: string;
  recency_days: number;
  frequency: number;
  monetary: number;
  assigned_at: string;
}

export interface MLTrainingRun {
  id: string;
  tenant_id: string;
  model_type: string;
  version: string;
  status: string;
  r2_score?: number;
  mae?: number;
  rmse?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}
