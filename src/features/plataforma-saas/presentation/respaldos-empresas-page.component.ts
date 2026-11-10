import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { environment } from '../../../environments/environment';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge.component';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { errorMessage } from '../../../shared/errors';

export interface Policy {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  hour: number;
  timezone: string;
  retention: number;
  next_run_at?: string | null;
}

export interface BackupRun {
  id: string;
  kind: 'manual' | 'scheduled';
  status: 'queued' | 'running' | 'verified' | 'failed' | 'expired';
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  sha256?: string | null;
  size_bytes: number;
  report?: {
    duration_seconds: number;
    rows: Record<string, number>;
    own_images: number;
    external_images: number;
    note: string;
    restored?: boolean;
  } | null;
  error?: string | null;
}

export interface TenantBackupItem {
  tenant_id: string;
  trade_name: string;
  legal_name: string;
  slug: string;
  status: string;
  plan_code: string;
  policy: Policy;
  last_backup?: BackupRun | null;
  total_backups: number;
  total_size_bytes: number;
}

export interface BackupsOverviewResponse {
  summary: {
    total_tenants: number;
    tenants_with_policy: number;
    total_backups: number;
    verified_backups: number;
    total_storage_bytes: number;
    configured: boolean;
  };
  items: TenantBackupItem[];
  page: number;
  page_size: number;
  total: number;
}

interface TenantHistoryStatus {
  tenant: { id: string; name: string };
  configured: boolean;
  configuration_note: string | null;
  storage_note: string;
  policy: Policy;
  items: BackupRun[];
  page: number;
  total: number;
}

@Component({
  selector: 'fs-respaldos-empresas-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    StatusBadgeComponent,
    KpiCardComponent,
    EmptyStateComponent,
    DatePipe,
    DecimalPipe,
  ],
  template: `
    <div class="respaldos-page">
      <!-- Encabezado Principal -->
      <div class="sp2-heading">
        <div>
          <p class="crumbs">Plataforma SaaS / Continuidad y Seguridad</p>
          <h1>Respaldos por Empresa</h1>
          <p>Supervisa, administra y programa copias de seguridad independientes para cada empresa de la plataforma.</p>
        </div>
        <div class="actions">
          <button class="btn" (click)="load()" [disabled]="loading()">⟳ Actualizar</button>
          @if (session.can('platform.ops.write')) {
            <button class="btn primary" (click)="processQueue()" [disabled]="processingQueue()">
              {{ processingQueue() ? '⚡ Procesando…' : '⚡ Procesar cola ahora' }}
            </button>
          }
        </div>
      </div>

      <!-- Banner de Aporte Propio -->
      <div class="banner-aporte">
        <div class="banner-icon">⭐</div>
        <div class="banner-body">
          <strong>Aporte Propio: Programación Periódica Automatizada de Respaldos</strong>
          <p>
            Permite a cada empresa y a la superadministración establecer copias automáticas con frecuencia diaria o semanal,
            en zona horaria local, con política de retención rotativa (1 a 14 copias) y verificación criptográfica aislada
            (ensayo en esquema sandbox antes de dar por válida la copia) sin comprometer el aislamiento ni la base activa.
          </p>
        </div>
      </div>

      <!-- Notificaciones -->
      @if (notice()) {
        <div class="alert ok">{{ notice() }}</div>
      }
      @if (error()) {
        <div class="alert danger">{{ error() }}</div>
      }

      <!-- KPIs Globales -->
      @if (overview()?.summary; as s) {
        <div class="empresa-kpis">
          <fs-kpi-card
            label="Total Empresas"
            [value]="s.total_tenants"
            hint="Empresas registradas"
          />
          <fs-kpi-card
            label="Con Programación (Aporte)"
            [value]="s.tenants_with_policy"
            hint="Respaldos periódicos activos"
            tone="plan"
          />
          <fs-kpi-card
            label="Copias Verificadas"
            [value]="s.verified_backups + ' / ' + s.total_backups"
            hint="Ensayos superados con éxito"
            tone="ok"
          />
          <fs-kpi-card
            label="Espacio Custodiado"
            [value]="formatBytes(s.total_storage_bytes)"
            hint="Cifrado AES-128 Fernet"
          />
        </div>

        @if (!s.configured) {
          <div class="alert warning">
            ⚠️ La clave de custodia simétrica (TENANT_BACKUP_ENCRYPTION_KEY) no está configurada en el servidor.
            Las copias existentes se pueden consultar, pero la creación de nuevos respaldos requiere la clave activa.
          </div>
        }
      }

      <!-- Panel de Control y Tabla -->
      <div class="panel">
        <div class="toolbar-wrap">
          <div class="toolbar">
            <input
              type="text"
              class="input search-input"
              placeholder="Buscar por empresa, razón social o slug…"
              [(ngModel)]="search"
              (ngModelChange)="onSearchChange()"
            />
            <div class="filter-chips">
              <button
                class="chip"
                [class.active]="policyFilter === 'all'"
                (click)="setPolicyFilter('all')"
              >
                Todas ({{ overview()?.total ?? 0 }})
              </button>
              <button
                class="chip"
                [class.active]="policyFilter === 'enabled'"
                (click)="setPolicyFilter('enabled')"
              >
                🟢 Con Programación
              </button>
              <button
                class="chip"
                [class.active]="policyFilter === 'disabled'"
                (click)="setPolicyFilter('disabled')"
              >
                ⚪ Sin Programación
              </button>
            </div>
          </div>
        </div>

        @if (loading() && !overview()) {
          <p class="loading-text">Cargando empresas y estado de respaldos…</p>
        } @else if (overview()?.items?.length === 0) {
          <fs-empty-state
            title="No se encontraron empresas"
            message="No hay empresas que coincidan con los filtros o el término de búsqueda ingresado."
          />
        } @else {
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Plan</th>
                  <th>Programación (Aporte Propio)</th>
                  <th>Último Respaldo</th>
                  <th>Total Copias</th>
                  <th style="text-align:right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (t of overview()?.items; track t.tenant_id) {
                  <tr>
                    <!-- Datos de Empresa -->
                    <td>
                      <strong>{{ t.trade_name }}</strong>
                      <br />
                      <small class="muted">{{ t.legal_name || t.slug }}</small>
                      <br />
                      <small class="slug-tag">slug: {{ t.slug }}</small>
                    </td>

                    <!-- Plan -->
                    <td>
                      <fs-status-badge [label]="t.plan_code || 'SIN PLAN'" tone="plan" />
                    </td>

                    <!-- Programación (Aporte Propio) -->
                    <td>
                      @if (t.policy.enabled) {
                        <div class="policy-badge enabled">
                          <span class="dot"></span>
                          <strong>{{ t.policy.frequency === 'daily' ? 'Diaria' : 'Semanal' }} a las {{ formatHour(t.policy.hour) }}</strong>
                        </div>
                        <small class="policy-sub">
                          Retención: {{ t.policy.retention }} copias · {{ t.policy.timezone }}
                        </small>
                        @if (t.policy.next_run_at) {
                          <br />
                          <small class="next-run">
                            Próxima: {{ t.policy.next_run_at | date: 'dd/MM/yyyy HH:mm' }}
                          </small>
                        }
                      } @else {
                        <div class="policy-badge disabled">
                          <span class="dot off"></span>
                          <span>Sin programación</span>
                        </div>
                        <small class="muted">Solo copias manuales</small>
                      }
                    </td>

                    <!-- Último Respaldo -->
                    <td>
                      @if (t.last_backup; as b) {
                        <div class="last-backup-info">
                          <span class="badge" [class.ok]="b.status === 'verified'" [class.warn]="b.status === 'running' || b.status === 'queued'" [class.err]="b.status === 'failed'">
                            {{ stateLabel(b.status) }}
                          </span>
                          <span class="backup-date">{{ b.created_at | date: 'dd/MM/yyyy HH:mm' }}</span>
                          <span class="backup-size">{{ formatBytes(b.size_bytes) }}</span>
                        </div>
                        @if (b.status === 'verified' && b.report?.rows) {
                          <small class="muted">
                            {{ b.report?.rows?.['products'] || 0 }} prendas · {{ b.report?.rows?.['commerce_orders'] || 0 }} ventas
                          </small>
                        }
                        @if (b.error) {
                          <small class="error-text">{{ b.error }}</small>
                        }
                      } @else {
                        <span class="muted">Sin copias registradas</span>
                      }
                    </td>

                    <!-- Total Copias -->
                    <td>
                      <strong>{{ t.total_backups }}</strong>
                      <br />
                      <small class="muted">{{ formatBytes(t.total_size_bytes) }}</small>
                    </td>

                    <!-- Acciones -->
                    <td style="text-align:right;white-space:nowrap">
                      @if (session.can('platform.ops.write')) {
                        <button
                          class="btn sm primary"
                          (click)="createBackup(t)"
                          [disabled]="isBusy(t.tenant_id)"
                          title="Iniciar copia manual ahora"
                        >
                          {{ isBusy(t.tenant_id) ? 'Solicitando…' : '🚀 Respaldar' }}
                        </button>
                        <button
                          class="btn sm"
                          (click)="openPolicyModal(t)"
                          title="Configurar política de respaldo periódico"
                        >
                          ⏰ Programar
                        </button>
                      }
                      <button
                        class="btn sm"
                        (click)="openHistory(t)"
                        title="Ver historial de respaldos y descargar copias ZIP"
                      >
                        📂 Copias ({{ t.total_backups }})
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Paginación -->
          <div class="toolbar pagination">
            <small>{{ overview()?.total ?? 0 }} empresas · Página {{ page() }} de {{ totalPages() }}</small>
            <div class="page-btns">
              <button [disabled]="page() <= 1" (click)="setPage(page() - 1)">Anterior</button>
              <button [disabled]="page() >= totalPages()" (click)="setPage(page() + 1)">Siguiente</button>
            </div>
          </div>
        }
      </div>

      <!-- MODAL: Programación de Respaldos (Aporte Propio) -->
      @if (policyModalTenant(); as pt) {
        <div class="modal-backdrop" (click)="closePolicyModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <p class="crumbs">⭐ APORTE PROPIO</p>
                <h2>Programación de Respaldos</h2>
                <p class="muted">Empresa: <strong>{{ pt.trade_name }}</strong></p>
              </div>
              <button class="btn sm" (click)="closePolicyModal()">✕</button>
            </div>

            <form (ngSubmit)="savePolicy(pt)">
              <div class="modal-body">
                <label class="toggle-card">
                  <input
                    type="checkbox"
                    name="enabled"
                    [(ngModel)]="editingPolicy.enabled"
                  />
                  <div>
                    <strong>Activar respaldos periódicos automáticos</strong>
                    <p class="muted">
                      El servidor ejecutará copias de seguridad automáticas en segundo plano sin intervención manual.
                    </p>
                  </div>
                </label>

                <div class="grid-form" [class.disabled-form]="!editingPolicy.enabled">
                  <div class="field">
                    <label>Frecuencia de ejecución</label>
                    <select
                      name="frequency"
                      [(ngModel)]="editingPolicy.frequency"
                      [disabled]="!editingPolicy.enabled"
                    >
                      <option value="daily">Diaria (Todos los días)</option>
                      <option value="weekly">Semanal (Cada 7 días)</option>
                    </select>
                  </div>

                  <div class="field">
                    <label>Hora de ejecución</label>
                    <select
                      name="hour"
                      [(ngModel)]="editingPolicy.hour"
                      [disabled]="!editingPolicy.enabled"
                    >
                      @for (h of hours; track h) {
                        <option [ngValue]="h">{{ h.toString().padStart(2, '0') }}:00</option>
                      }
                    </select>
                  </div>

                  <div class="field">
                    <label>Zona horaria</label>
                    <select
                      name="timezone"
                      [(ngModel)]="editingPolicy.timezone"
                      [disabled]="!editingPolicy.enabled"
                    >
                      <option value="America/La_Paz">Bolivia (America/La_Paz, UTC-4)</option>
                      <option value="UTC">UTC (Universal)</option>
                    </select>
                  </div>

                  <div class="field">
                    <label>Copias a conservar (Retención)</label>
                    <input
                      type="number"
                      name="retention"
                      min="1"
                      max="14"
                      [(ngModel)]="editingPolicy.retention"
                      [disabled]="!editingPolicy.enabled"
                    />
                    <small class="muted">Las copias anteriores al límite se rotan automáticamente (1 a 14).</small>
                  </div>
                </div>

                <div class="tech-note">
                  <strong>ℹ️ Garantías de seguridad y verificación:</strong>
                  <ul>
                    <li>Las copias se procesan con transacciones de lectura aisladas (REPEATABLE READ).</li>
                    <li>Cada archivo es validado mediante restauración en un esquema aislado de prueba antes de marcarse como verificada.</li>
                    <li>El archivo final se cifra con AES-128-CBC + HMAC-SHA256 (Fernet) y se almacena custodiado.</li>
                  </ul>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn" (click)="closePolicyModal()">Cancelar</button>
                <button type="submit" class="btn primary" [disabled]="savingPolicy()">
                  {{ savingPolicy() ? 'Guardando…' : 'Guardar Programación' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- DRAWER / MODAL: Historial y Descarga de Respaldos de la Empresa -->
      @if (historyTenant(); as ht) {
        <div class="modal-backdrop" (click)="closeHistory()">
          <div class="modal-card wide" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <p class="crumbs">HISTORIAL Y ARCHIVOS DE RESPALDO</p>
                <h2>Copias de Seguridad: {{ ht.trade_name }}</h2>
                <p class="muted">Descarga de paquetes ZIP, reportes de ensayo de restauración y verificación.</p>
              </div>
              <button class="btn sm" (click)="closeHistory()">✕</button>
            </div>

            <div class="modal-body">
              <div class="history-actions-bar">
                <div>
                  <span class="muted">Empresa: <strong>{{ ht.trade_name }}</strong> ({{ ht.slug }})</span>
                </div>
                <div class="btns-row">
                  <button class="btn sm" (click)="loadHistory(ht.tenant_id)" [disabled]="historyLoading()">⟳ Refrescar</button>
                  @if (session.can('platform.ops.write')) {
                    <button class="btn sm primary" (click)="createBackupFromHistory(ht)" [disabled]="isBusy(ht.tenant_id)">
                      {{ isBusy(ht.tenant_id) ? 'Generando…' : '＋ Generar copia ahora' }}
                    </button>
                  }
                </div>
              </div>

              @if (historyLoading()) {
                <p class="loading-text">Consultando historial de copias…</p>
              } @else if (historyData()?.items?.length === 0) {
                <fs-empty-state
                  title="Sin copias de seguridad"
                  message="Esta empresa aún no cuenta con copias generadas. Podés generar la primera ahora mismo."
                />
              } @else {
                <div class="table-wrap">
                  <table class="tbl">
                    <thead>
                      <tr>
                        <th>Fecha de Solicitud</th>
                        <th>Origen</th>
                        <th>Estado</th>
                        <th>Tamaño</th>
                        <th>Detalle de Verificación</th>
                        <th style="text-align:right">Descarga</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (run of historyData()?.items; track run.id) {
                        <tr>
                          <td>
                            <strong>{{ run.created_at | date: 'dd/MM/yyyy HH:mm' }}</strong>
                            @if (run.finished_at) {
                              <br /><small class="muted">Finalizado: {{ run.finished_at | date: 'HH:mm:ss' }}</small>
                            }
                          </td>
                          <td>
                            <span class="badge-kind" [class.scheduled]="run.kind === 'scheduled'">
                              {{ run.kind === 'scheduled' ? '⏰ Programada' : '👤 Manual' }}
                            </span>
                          </td>
                          <td>
                            <span class="badge" [class.ok]="run.status === 'verified'" [class.warn]="run.status === 'running' || run.status === 'queued'" [class.err]="run.status === 'failed'">
                              {{ stateLabel(run.status) }}
                            </span>
                          </td>
                          <td>{{ formatBytes(run.size_bytes) }}</td>
                          <td>
                            @if (run.error) {
                              <p class="error-text">{{ run.error }}</p>
                            }
                            @if (run.report; as report) {
                              <div class="report-box">
                                <small>
                                  📦 <strong>{{ report.rows['products'] || 0 }}</strong> prendas ·
                                  <strong>{{ report.rows['commerce_orders'] || 0 }}</strong> ventas ·
                                  <strong>{{ report.rows['reservations'] || 0 }}</strong> reservas ·
                                  <strong>{{ report.own_images || 0 }}</strong> imágenes
                                </small>
                                <br />
                                <small class="muted">Ensayo aislado superado en {{ report.duration_seconds | number: '1.1-2' }} s.</small>
                              </div>
                            }
                          </td>
                          <td style="text-align:right">
                            @if (run.status === 'verified') {
                              <button
                                class="btn sm download-btn"
                                (click)="downloadZip(ht.tenant_id, run.id)"
                                [disabled]="downloadingId() === run.id"
                              >
                                {{ downloadingId() === run.id ? 'Descargando…' : '📥 Descargar ZIP' }}
                              </button>
                            } @else if (run.status === 'expired') {
                              <small class="muted">Conservación vencida</small>
                            } @else {
                              <small class="muted">No disponible</small>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>

            <div class="modal-footer">
              <button class="btn" (click)="closeHistory()">Cerrar</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .respaldos-page {
        max-width: 1400px;
        margin: 0 auto;
        padding-bottom: 40px;
      }
      .sp2-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
        flex-wrap: wrap;
      }
      .sp2-heading h1 {
        margin: 4px 0;
        font-size: 28px;
        font-family: var(--font-display, inherit);
      }
      .crumbs {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--muted);
      }
      .actions {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .banner-aporte {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 16px 20px;
        background: linear-gradient(135deg, #f0f7ff 0%, #e6f0fa 100%);
        border: 1px solid #b6d4fe;
        border-radius: 12px;
        margin-bottom: 22px;
      }
      .banner-icon {
        font-size: 26px;
        line-height: 1;
      }
      .banner-body strong {
        display: block;
        font-size: 14px;
        color: #0b4a72;
        margin-bottom: 4px;
      }
      .banner-body p {
        margin: 0;
        font-size: 12px;
        line-height: 1.5;
        color: #1e567a;
      }
      .empresa-kpis {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 20px;
      }
      .panel {
        background: var(--surface, #fff);
        border: 1px solid var(--line);
        border-radius: 12px;
        overflow: hidden;
      }
      .toolbar-wrap {
        padding: 16px 20px;
        border-bottom: 1px solid var(--line);
      }
      .toolbar {
        display: flex;
        gap: 14px;
        align-items: center;
        flex-wrap: wrap;
      }
      .search-input {
        flex: 1 1 260px;
        padding: 8px 12px;
        border: 1px solid var(--line);
        border-radius: 6px;
        font-size: 13px;
      }
      .filter-chips {
        display: flex;
        gap: 8px;
      }
      .chip {
        padding: 6px 12px;
        border-radius: 20px;
        border: 1px solid var(--line);
        background: var(--surface);
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .chip.active {
        background: #204d60;
        color: #fff;
        border-color: #204d60;
      }
      .table-wrap {
        overflow-x: auto;
      }
      .tbl {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .tbl th {
        text-align: left;
        padding: 12px 16px;
        font-size: 11px;
        text-transform: uppercase;
        color: var(--muted);
        border-bottom: 1px solid var(--line);
        background: #fbfbfb;
      }
      .tbl td {
        padding: 14px 16px;
        border-bottom: 1px solid var(--line);
        vertical-align: middle;
      }
      .slug-tag {
        display: inline-block;
        padding: 1px 6px;
        background: #f0f0f0;
        border-radius: 4px;
        font-size: 10px;
        color: #555;
        margin-top: 3px;
      }
      .policy-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #28a745;
        display: inline-block;
      }
      .dot.off {
        background: #bbb;
      }
      .policy-sub {
        color: var(--muted);
        font-size: 11px;
      }
      .next-run {
        color: #1976d2;
        font-size: 11px;
      }
      .last-backup-info {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 4px;
      }
      .backup-date {
        font-size: 12px;
        color: #333;
      }
      .backup-size {
        font-size: 11px;
        color: var(--muted);
      }
      .badge {
        padding: 3px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        background: #eee;
        color: #444;
      }
      .badge.ok {
        background: #e6f4ea;
        color: #137333;
      }
      .badge.warn {
        background: #fef7e0;
        color: #b06000;
      }
      .badge.err {
        background: #fce8e6;
        color: #c5221f;
      }
      .badge-kind {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        background: #f0f0f0;
        color: #333;
      }
      .badge-kind.scheduled {
        background: #e8f0fe;
        color: #1a73e8;
      }
      .btn {
        padding: 8px 14px;
        border-radius: 6px;
        border: 1px solid var(--line);
        background: var(--surface);
        font-size: 12px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .btn.primary {
        background: #204d60;
        color: #fff;
        border-color: #204d60;
      }
      .btn.sm {
        padding: 5px 10px;
        font-size: 11px;
        margin-left: 4px;
      }
      .btn:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .download-btn {
        background: #e8f5e9;
        color: #2e7d32;
        border-color: #a5d6a7;
        font-weight: 500;
      }
      .download-btn:hover {
        background: #c8e6c9;
      }
      .alert {
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 18px;
        font-size: 13px;
      }
      .alert.ok {
        background: #e6f4ea;
        color: #137333;
        border: 1px solid #b7e1cd;
      }
      .alert.warning {
        background: #fff3e0;
        color: #e65100;
        border: 1px solid #ffe0b2;
      }
      .alert.danger {
        background: #fce8e6;
        color: #c5221f;
        border: 1px solid #fad2cf;
      }
      .error-text {
        color: #c5221f;
        font-size: 11px;
        margin: 2px 0 0;
      }
      .report-box {
        background: #f8f9fa;
        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid #e9ecef;
        font-size: 11px;
      }
      .pagination {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 20px;
        border-top: 1px solid var(--line);
      }
      .page-btns {
        display: flex;
        gap: 8px;
      }
      .loading-text {
        padding: 30px;
        text-align: center;
        color: var(--muted);
      }

      /* Modales y Drawers */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999;
        padding: 20px;
      }
      .modal-card {
        background: #fff;
        border-radius: 14px;
        width: 100%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.2);
      }
      .modal-card.wide {
        max-width: 950px;
      }
      .modal-header {
        padding: 20px 24px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 1px solid var(--line);
      }
      .modal-header h2 {
        margin: 4px 0;
        font-size: 20px;
      }
      .modal-body {
        padding: 20px 24px;
      }
      .modal-footer {
        padding: 16px 24px;
        border-top: 1px solid var(--line);
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .toggle-card {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 14px 16px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fafafa;
        cursor: pointer;
        margin-bottom: 20px;
      }
      .toggle-card input[type='checkbox'] {
        width: 18px;
        height: 18px;
        margin-top: 2px;
      }
      .grid-form {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        margin-bottom: 20px;
      }
      .grid-form.disabled-form {
        opacity: 0.5;
        pointer-events: none;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .field label {
        font-size: 12px;
        font-weight: 500;
        color: #333;
      }
      .field select,
      .field input {
        padding: 8px 10px;
        border: 1px solid var(--line);
        border-radius: 6px;
        font-size: 13px;
      }
      .tech-note {
        padding: 12px 16px;
        background: #f1f8e9;
        border: 1px solid #c5e1a5;
        border-radius: 8px;
        font-size: 11px;
        color: #33691e;
      }
      .tech-note ul {
        margin: 6px 0 0 16px;
        padding: 0;
      }
      .history-actions-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .btns-row {
        display: flex;
        gap: 8px;
      }

      @media (max-width: 900px) {
        .empresa-kpis {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 600px) {
        .empresa-kpis,
        .grid-form {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class RespaldosEmpresasPageComponent implements OnInit {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  session = inject(SessionService);
  private destroy = inject(DestroyRef);

  overview = signal<BackupsOverviewResponse | null>(null);
  loading = signal(false);
  processingQueue = signal(false);
  busyTenants = signal<Record<string, boolean>>({});
  notice = signal('');
  error = signal('');

  search = '';
  policyFilter: 'all' | 'enabled' | 'disabled' = 'all';
  page = signal(1);

  // Policy modal
  policyModalTenant = signal<TenantBackupItem | null>(null);
  editingPolicy: Policy = {
    enabled: false,
    frequency: 'daily',
    hour: 3,
    timezone: 'America/La_Paz',
    retention: 7,
  };
  savingPolicy = signal(false);
  hours = Array.from({ length: 24 }, (_, i) => i);

  // History modal
  historyTenant = signal<TenantBackupItem | null>(null);
  historyData = signal<TenantHistoryStatus | null>(null);
  historyLoading = signal(false);
  downloadingId = signal<string | null>(null);

  private searchDebounce?: ReturnType<typeof setTimeout>;
  private alive = true;

  ngOnInit() {
    this.destroy.onDestroy(() => {
      this.alive = false;
      clearTimeout(this.searchDebounce);
    });
    void this.load();
  }

  async load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const params: Record<string, any> = {
        page: this.page(),
        policy_filter: this.policyFilter,
      };
      if (this.search.trim()) params['search'] = this.search.trim();

      const data = await firstValueFrom(
        this.api.get<BackupsOverviewResponse>('/platform/backups/tenants', params),
      );
      if (!this.alive) return;
      this.overview.set(data);
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  onSearchChange() {
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.page.set(1);
      void this.load();
    }, 350);
  }

  setPolicyFilter(filter: 'all' | 'enabled' | 'disabled') {
    this.policyFilter = filter;
    this.page.set(1);
    void this.load();
  }

  setPage(p: number) {
    this.page.set(p);
    void this.load();
  }

  totalPages(): number {
    const total = this.overview()?.total ?? 0;
    const size = this.overview()?.page_size ?? 20;
    return Math.max(1, Math.ceil(total / size));
  }

  isBusy(tenantId: string): boolean {
    return !!this.busyTenants()[tenantId];
  }

  private setBusy(tenantId: string, val: boolean) {
    this.busyTenants.update((curr) => ({ ...curr, [tenantId]: val }));
  }

  async createBackup(tenant: TenantBackupItem) {
    if (this.isBusy(tenant.tenant_id)) return;
    this.setBusy(tenant.tenant_id, true);
    this.notice.set('');
    this.error.set('');
    try {
      await firstValueFrom(
        this.api.post(`/platform/tenants/${tenant.tenant_id}/backups`, {
          request_id: crypto.randomUUID(),
        }),
      );
      this.notice.set(
        `Solicitud de respaldo para "${tenant.trade_name}" encolada con éxito. El ensayo aislado verificará la copia en breve.`,
      );
      await this.load();
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.setBusy(tenant.tenant_id, false);
    }
  }

  async processQueue() {
    this.processingQueue.set(true);
    this.notice.set('');
    this.error.set('');
    try {
      const res = await firstValueFrom(
        this.api.post<{ processed: number; message: string }>('/platform/backups/process-queue', {}),
      );
      this.notice.set(res.message || `Procesamiento completado. (${res.processed} copias)`);
      await this.load();
      if (this.historyTenant()) {
        await this.loadHistory(this.historyTenant()!.tenant_id);
      }
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.processingQueue.set(false);
    }
  }

  // Policy Modal
  openPolicyModal(tenant: TenantBackupItem) {
    this.policyModalTenant.set(tenant);
    this.editingPolicy = { ...tenant.policy };
  }

  closePolicyModal() {
    this.policyModalTenant.set(null);
  }

  async savePolicy(tenant: TenantBackupItem) {
    this.savingPolicy.set(true);
    this.notice.set('');
    this.error.set('');
    try {
      await firstValueFrom(
        this.api.put(`/platform/tenants/${tenant.tenant_id}/backups/policy`, this.editingPolicy),
      );
      this.notice.set(
        `Programación periódica de respaldos (Aporte Propio) para "${tenant.trade_name}" actualizada.`,
      );
      this.closePolicyModal();
      await this.load();
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.savingPolicy.set(false);
    }
  }

  // History Modal
  openHistory(tenant: TenantBackupItem) {
    this.historyTenant.set(tenant);
    void this.loadHistory(tenant.tenant_id);
  }

  closeHistory() {
    this.historyTenant.set(null);
    this.historyData.set(null);
  }

  async loadHistory(tenantId: string) {
    this.historyLoading.set(true);
    try {
      const data = await firstValueFrom(
        this.api.get<TenantHistoryStatus>(`/platform/tenants/${tenantId}/backups`),
      );
      if (!this.alive) return;
      this.historyData.set(data);
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.historyLoading.set(false);
    }
  }

  async createBackupFromHistory(tenant: TenantBackupItem) {
    await this.createBackup(tenant);
    await this.loadHistory(tenant.tenant_id);
  }

  async downloadZip(tenantId: string, runId: string) {
    this.downloadingId.set(runId);
    this.error.set('');
    try {
      const blob = await firstValueFrom(
        this.http.get(
          `${environment.apiUrl}/platform/tenants/${tenantId}/backups/${runId}/download`,
          { responseType: 'blob' },
        ),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fashionstore-empresa-${runId}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.downloadingId.set(null);
    }
  }

  formatBytes(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(1) + ' KB';
    const mb = kb / 1024;
    return mb.toFixed(2) + ' MB';
  }

  formatHour(hour: number): string {
    return hour.toString().padStart(2, '0') + ':00';
  }

  stateLabel(state: string): string {
    const map: Record<string, string> = {
      queued: 'En cola',
      running: 'En preparación',
      verified: 'Verificada en ensayo',
      failed: 'Fallida',
      expired: 'Conservación vencida',
    };
    return map[state] ?? state;
  }
}
