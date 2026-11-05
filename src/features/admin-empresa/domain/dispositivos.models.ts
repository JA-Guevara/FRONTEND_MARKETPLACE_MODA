export interface Dispositivo {
  id: string;
  tenant_id: string;
  device_id: string;
  platform: 'PWA' | 'ANDROID' | string;
  label: string | null;
  user_id: string | null;
  user_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  app_version: string | null;
  first_seen_at: string;
  last_snapshot_at: string | null;
  last_sync_at: string | null;
  last_batch_id: string | null;
  status: 'ACTIVO' | 'BLOQUEADO';
  blocked_at: string | null;
  block_reason: string | null;
  rejected_attempts: number;
  last_rejected_at: string | null;
}

export interface DispositivoActividad {
  id: string;
  action: string;
  description: string;
  created_at: string;
  actor_name: string | null;
  metadata?: Record<string, unknown>;
}

export interface DispositivoDetalle extends Dispositivo {
  recent_activity: DispositivoActividad[];
}

export interface FiltrosDispositivos {
  platform?: string;
  status?: string;
  branch_id?: string;
  search?: string;
  stale?: boolean;
  page?: number;
  page_size?: number;
}
