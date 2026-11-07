import { Component, inject, signal, OnInit } from '@angular/core';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { CommonModule } from '@angular/common';
import { SyncApi } from '../infrastructure/sync.api';
import { OperacionesLocalesRepository } from '../infrastructure/operaciones-locales.repository';
import { HistorialSyncLocal } from '../../../app/core/offline/offline-db';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';

@Component({
  selector: 'fs-historial-sincronizacion',
  imports: [CommonModule, EmptyStateComponent],
  template: `
    <div class="sp2-page">
      <div class="header">
        <div>
          <p class="crumbs">Administración / Sincronización</p>
          <h1>Historial de sincronización</h1>
          <p>Registro de lotes procesados por el servidor y eventos de sincronización de este dispositivo.</p>
        </div>
      </div>

      <div class="tabs">
        <button class="tab" [class.active]="tabActiva() === 'servidor'" (click)="tabActiva.set('servidor')">
          Lotes del servidor
        </button>
        <button class="tab" [class.active]="tabActiva() === 'local'" (click)="tabActiva.set('local')">
          Eventos locales (este dispositivo)
        </button>
      </div>

      @if (tabActiva() === 'servidor') {
        <section class="panel">
          <div class="sp2-table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Lote ID</th>
                  <th>Fecha recepción</th>
                  <th>Total ops</th>
                  <th>Confirmadas</th>
                  <th>Conflictos</th>
                  <th>Rechazadas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (b of lotesServidor(); track b.id) {
                  <tr>
                    <td><code>{{ b.id.slice(0, 8) }}...</code></td>
                    <td>{{ b.received_at | date:'short' }}</td>
                    <td><strong>{{ b.total_operations }}</strong></td>
                    <td><span class="text-success">{{ b.confirmed_count }}</span></td>
                    <td><span class="text-warning">{{ b.conflicts_count }}</span></td>
                    <td><span class="text-danger">{{ b.rejected_count }}</span></td>
                    <td>
                      <span class="badge" [class.done]="b.status === 'COMPLETED'">
                        {{ b.status }}
                      </span>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7">
                      <fs-empty-state
                        title="Sin lotes en el servidor"
                        description="No se han registrado lotes de sincronización aún."
                      ></fs-empty-state>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @else {
        <section class="panel">
          <div class="sp2-table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Iniciado</th>
                  <th>Terminado</th>
                  <th>Enviadas</th>
                  <th>Confirmadas</th>
                  <th>Conflictos</th>
                  <th>Rechazadas</th>
                  <th>Resultado / Error</th>
                </tr>
              </thead>
              <tbody>
                @for (h of historialLocal(); track h.iniciado_en) {
                  <tr>
                    <td>{{ h.iniciado_en | date:'short' }}</td>
                    <td>{{ h.terminado_en | date:'mediumTime' }}</td>
                    <td>{{ h.enviadas }}</td>
                    <td><span class="text-success">{{ h.confirmadas }}</span></td>
                    <td><span class="text-warning">{{ h.conflictos }}</span></td>
                    <td><span class="text-danger">{{ h.rechazadas }}</span></td>
                    <td>
                      @if (h.codigo_error) {
                        <span class="badge-error">{{ h.codigo_error }} ({{ h.http_status ?? 'sin red' }})</span>
                      } @else {
                        <span class="badge-ok">OK</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7">
                      <fs-empty-state
                        title="Sin eventos locales"
                        description="Este dispositivo no ha ejecutado sincronizaciones todavía."
                      ></fs-empty-state>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .sp2-page { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 1.5rem; }
    .crumbs { font-size: 0.85rem; color: #6b7280; margin: 0 0 0.25rem; }
    h1 { margin: 0 0 0.5rem; font-size: 1.75rem; font-weight: 700; color: #111827; }
    .tabs { display: flex; gap: 0.5rem; border-bottom: 1px solid #e5e7eb; margin-bottom: 1rem; }
    .tab { padding: 0.5rem 1rem; border: none; background: none; font-weight: 500; cursor: pointer; color: #6b7280; border-bottom: 2px solid transparent; }
    .tab.active { color: #2563eb; border-bottom-color: #2563eb; }
    .panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .sp2-table-wrap { overflow-x: auto; }
    .tbl { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; }
    .tbl th, .tbl td { padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6; }
    .tbl th { background: #f9fafb; font-weight: 600; color: #374151; }
    .text-success { color: #059669; font-weight: 600; }
    .text-warning { color: #d97706; font-weight: 600; }
    .text-danger { color: #dc2626; font-weight: 600; }
    .badge { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; background: #e5e7eb; color: #374151; }
    .badge.done { background: #d1fae5; color: #065f46; }
    .badge-ok { color: #059669; font-weight: 600; }
    .badge-error { color: #dc2626; background: #fee2e2; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; }
  `]
})
export class HistorialSincronizacionComponent implements OnInit {
  private session = inject(SessionService);
  private syncApi = inject(SyncApi);
  private operacionesRepo = inject(OperacionesLocalesRepository);

  tabActiva = signal<'servidor' | 'local'>('servidor');
  lotesServidor = signal<any[]>([]);
  historialLocal = signal<HistorialSyncLocal[]>([]);

  async ngOnInit() {
    await Promise.all([this.cargarServidor(), this.cargarLocal()]);
  }

  async cargarServidor() {
    try {
      const res = await this.syncApi.getBatches(1, 30);
      this.lotesServidor.set(res.items || []);
    } catch {
      // Ignorar si el usuario no tiene permiso sync_log.read
    }
  }

  async cargarLocal() {
    try {
      const user = this.session.user();
      if (!user?.tenant) { this.historialLocal.set([]); return; }
      const res = await this.operacionesRepo.listarHistorialSync(30, {tenantId: user.tenant.id, usuarioId: user.id});
      this.historialLocal.set(res);
    } catch {
      // Ignorar
    }
  }
}
