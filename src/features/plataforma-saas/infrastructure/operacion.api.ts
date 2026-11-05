import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../app/core/shared/api.service';
import { Page } from '../../../shared/models';
import { environment } from '../../../environments/environment';

export interface CheckRespaldo { name: string; ok: boolean; details: Record<string, number | string | null>; }
export interface Respaldo {
  id: string; kind: string; finished_at: string; size_bytes: number;
  sha256: string | null; storage_ref: string | null; alembic_revision: string | null;
  verify_status: 'ok' | 'failed' | 'pending'; workflow_run_url: string | null;
  verify_report: { ok: boolean; duration_seconds: number; checks: CheckRespaldo[] } | null;
}
export interface EstadoOperacion {
  version: string; git_sha: string | null; app_env: string;
  revision_bd: string | null; cabeza_codigo: string; migraciones_pendientes: boolean;
  ultimo_respaldo: { id: string; finished_at: string; age_hours: number; alembic_revision: string } | null;
  mantenimiento: boolean;
  contadores: { rate_limited: number | null; sync_rechazadas_24h: number; cuentas_bloqueadas: number;
    errors_5xx?: number; rate_limited_by_policy?: Record<string, number>;
    mfa_adopcion: { total: number; habilitadas: number | null } };
}

@Injectable({ providedIn: 'root' })
export class OperacionApi {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  estado() { return this.api.get<EstadoOperacion>('/platform/ops/status'); }
  respaldos(page = 1) { return this.api.get<Page<Respaldo>>('/platform/ops/backups', { page, page_size: 20 }); }
  respaldarAhora(motivo: string) { return this.api.post<{ dispatched: boolean }>('/platform/ops/backups/dispatch', { reason: motivo }); }
  ready() { return this.http.get<{ status: string; revision: string; version: string }>(environment.apiUrl.replace(/\/api\/v1\/?$/, '') + '/health/ready'); }
}
