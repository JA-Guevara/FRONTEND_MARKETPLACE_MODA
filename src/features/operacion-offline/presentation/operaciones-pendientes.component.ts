import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SincronizacionService } from '../application/sincronizacion.service';
import {
  OperacionesLocalesRepository,
  OperacionConDetalle,
} from '../infrastructure/operaciones-locales.repository';
import { OperacionPendiente } from '../domain/reserva-offline.models';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge.component';
import { SessionService } from '../../usuarios-catalogo/application/session.service';

@Component({
  selector: 'fs-operaciones-pendientes',
  imports: [CommonModule, EmptyStateComponent, StatusBadgeComponent],
  template: `
    <div class="sp2-page">
      <div class="offline-heading">
        <div>
          <p class="crumbs">Sin conexión / Sincronización</p>
          <h1>Operaciones locales y sincronización</h1>
          <p>Supervisa las ventas y reservas generadas fuera de línea y su estado de envío.</p>
        </div>
        <div class="actions">
          <button
            class="btn primary"
            [disabled]="syncService.sincronizando()"
            (click)="sincronizar()"
          >
            {{ syncService.sincronizando() ? 'Sincronizando...' : '⇅ Sincronizar ahora' }}
          </button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Pendientes</span>
          <span class="kpi-value warning">{{ syncService.pendientesCount() }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Conflictos</span>
          <span class="kpi-value danger">{{ syncService.conflictosCount() }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Último sincronizado</span>
          <span class="kpi-value sub">{{
            syncService.ultimoSync()
              ? (syncService.ultimoSync() | date: 'short')
              : 'Sin sincronizaciones'
          }}</span>
        </div>
      </div>

      @if (syncService.ultimoError()) {
        <p class="alert danger">{{ syncService.ultimoError() }}</p>
      }

      @if (mensajeExito()) {
        <p class="alert success">{{ mensajeExito() }}</p>
      }

      <div class="toolbar">
        @for (filtro of filtros; track filtro) {
          <button
            class="chip"
            [class.on]="filtroActual() === filtro"
            (click)="filtroActual.set(filtro)"
          >
            {{ filtro }}
          </button>
        }
      </div>

      <section class="panel">
        <div class="sp2-table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Identificador</th>
                <th>Fecha creación</th>
                <th>Intentos</th>
                <th>Estado</th>
                <th>Detalle error / Server Ref</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              @for (op of operacionesFiltradas(); track op.id) {
                <tr>
                  <td>
                    <span
                      class="badge-type"
                      [class.sale]="op.tipo === 'VENTA'"
                      [class.res]="op.tipo === 'RESERVA'"
                    >
                      {{ op.tipo }}
                    </span>
                  </td>
                  <td>
                    <code>{{ op.id.slice(0, 8) }}...</code>
                  </td>
                  <td>{{ op.creada_en | date: 'short' }}</td>
                  <td>{{ op.intentos || 0 }}</td>
                  <td>
                    <fs-status-badge [label]="op.estado"></fs-status-badge>
                  </td>
                  <td>
                    @if (op.refund_amount) {
                      <p>
                        Reintegro
                        {{ op.refund_status === 'confirmed' ? 'confirmado' : 'pendiente' }}: Bs
                        {{ op.refund_amount }}
                      </p>
                    }
                    @if (op.server_ref) {
                      <span class="text-success"
                        >Ref: {{ op.server_ref }} ({{ op.server_numero }})</span
                      >
                    } @else if (op.ultimo_error) {
                      <span class="text-danger">{{ op.ultimo_error }}</span>
                    } @else {
                      <span class="text-muted">-</span>
                    }
                  </td>
                  <td>
                    <button class="btn small" (click)="verDetalle(op.id)">Ver</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7">
                    <fs-empty-state
                      title="Sin operaciones"
                      description="No hay operaciones registradas con este filtro."
                    ></fs-empty-state>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      @if (detalleSeleccionado()) {
        <div class="modal-backdrop" (click)="detalleSeleccionado.set(null)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>Detalle de la operación</h3>
            <p><strong>ID:</strong> {{ detalleSeleccionado()!.operacion.id }}</p>
            <p><strong>Tipo:</strong> {{ detalleSeleccionado()!.operacion.tipo }}</p>
            <p><strong>Estado:</strong> {{ detalleSeleccionado()!.operacion.estado }}</p>
            <p>
              <strong>Creada en:</strong>
              {{ detalleSeleccionado()!.operacion.creada_en | date: 'medium' }}
            </p>
            @if (detalleSeleccionado()!.operacion.server_ref) {
              <p><strong>Server Ref:</strong> {{ detalleSeleccionado()!.operacion.server_ref }}</p>
              <p><strong>Número:</strong> {{ detalleSeleccionado()!.operacion.server_numero }}</p>
            }
            @if (detalleSeleccionado()!.operacion.ultimo_error) {
              <div class="alert danger">
                <strong>Error:</strong> {{ detalleSeleccionado()!.operacion.ultimo_error }}
              </div>
            }
            @if (detalleSeleccionado()!.venta; as venta) {
              <h4>Comprobante de venta local</h4>
              <p>{{ venta.folio }} · {{ venta.estado }}</p>
              @for (item of detalleSeleccionado()!.itemsVenta ?? []; track item.variante_id) {
                <p>
                  {{ item.producto_nombre }} · {{ item.variante_desc }} · {{ item.cantidad }} · Bs
                  {{ item.total_linea | number: '1.2-2' }}
                </p>
              }
              <p>
                Total Bs {{ venta.total | number: '1.2-2' }} · Efectivo Bs
                {{ venta.recibido | number: '1.2-2' }} · Vuelto Bs
                {{ venta.vuelto | number: '1.2-2' }}
              </p>
            }
            <div class="modal-actions">
              <button class="btn" (click)="detalleSeleccionado.set(null)">Cerrar</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .sp2-page {
        padding: 1.5rem;
        max-width: 1200px;
        margin: 0 auto;
      }
      .offline-heading {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1.5rem;
      }
      .crumbs {
        font-size: 0.85rem;
        color: #6b7280;
        margin: 0 0 0.25rem;
      }
      h1 {
        margin: 0 0 0.5rem;
        font-size: 1.75rem;
        font-weight: 700;
        color: #111827;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .kpi-card {
        background: #fff;
        padding: 1.25rem;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        display: flex;
        flex-direction: column;
      }
      .kpi-label {
        font-size: 0.85rem;
        color: #6b7280;
        font-weight: 500;
      }
      .kpi-value {
        font-size: 1.75rem;
        font-weight: 700;
        margin-top: 0.25rem;
        color: #111827;
      }
      .kpi-value.warning {
        color: #f59e0b;
      }
      .kpi-value.danger {
        color: #ef4444;
      }
      .kpi-value.sub {
        font-size: 1rem;
        color: #4b5563;
        font-weight: 600;
        margin-top: 0.5rem;
      }
      .toolbar {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }
      .chip {
        padding: 0.35rem 0.85rem;
        border-radius: 999px;
        border: 1px solid #d1d5db;
        background: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      }
      .chip.on {
        background: #111827;
        color: #fff;
        border-color: #111827;
      }
      .panel {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }
      .sp2-table-wrap {
        overflow-x: auto;
      }
      .tbl {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 0.9rem;
      }
      .tbl th,
      .tbl td {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #f3f4f6;
      }
      .tbl th {
        background: #f9fafb;
        font-weight: 600;
        color: #374151;
      }
      .badge-type {
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .badge-type.sale {
        background: #e0e7ff;
        color: #3730a3;
      }
      .badge-type.res {
        background: #fef3c7;
        color: #92400e;
      }
      .text-success {
        color: #059669;
        font-weight: 500;
      }
      .text-danger {
        color: #dc2626;
        font-size: 0.85rem;
      }
      .text-muted {
        color: #9ca3af;
      }
      .btn {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid #d1d5db;
        background: #fff;
      }
      .btn.primary {
        background: #2563eb;
        color: #fff;
        border-color: #2563eb;
      }
      .btn.small {
        padding: 0.25rem 0.5rem;
        font-size: 0.8rem;
      }
      .alert {
        padding: 0.75rem 1rem;
        border-radius: 6px;
        margin-bottom: 1rem;
      }
      .alert.danger {
        background: #fee2e2;
        color: #991b1b;
      }
      .alert.success {
        background: #d1fae5;
        color: #065f46;
      }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .modal-card {
        background: #fff;
        border-radius: 8px;
        padding: 1.5rem;
        width: 90%;
        max-width: 600px;
        max-height: 85vh;
        overflow-y: auto;
      }
      .code-block {
        background: #f3f4f6;
        padding: 1rem;
        border-radius: 6px;
        font-size: 0.8rem;
        overflow-x: auto;
      }
      .modal-actions {
        margin-top: 1rem;
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class OperacionesPendientesComponent implements OnInit, OnDestroy {
  private cambios?: Subscription;
  syncService: SincronizacionService;
  operacionesRepo: OperacionesLocalesRepository;
  private session: SessionService;

  constructor(
    syncService?: SincronizacionService,
    operacionesRepo?: OperacionesLocalesRepository,
    session?: SessionService,
  ) {
    this.syncService = syncService ?? inject(SincronizacionService);
    this.operacionesRepo = operacionesRepo ?? inject(OperacionesLocalesRepository);
    this.session = session ?? inject(SessionService);
  }

  operaciones = signal<OperacionPendiente[]>([]);
  filtroActual = signal<string>('TODAS');
  filtros = ['TODAS', 'PENDIENTE', 'CONFIRMADA', 'CONFLICTO', 'RECHAZADA'];
  mensajeExito = signal<string | null>(null);
  detalleSeleccionado = signal<OperacionConDetalle | null>(null);

  operacionesFiltradas = computed(() => {
    const f = this.filtroActual();
    const ops = this.operaciones();
    if (f === 'TODAS') return ops;
    return ops.filter((o) => o.estado === f);
  });

  async ngOnInit() {
    this.cambios = this.syncService.cambios?.subscribe(() => {
      void this.cargarOperaciones();
    });
    await this.cargarOperaciones();
  }
  ngOnDestroy() {
    this.cambios?.unsubscribe();
  }

  async cargarOperaciones() {
    const user = this.session.user();
    if (!user?.tenant) {
      this.operaciones.set([]);
      return;
    }
    const ops = await this.operacionesRepo.listarOperaciones({
      tenantId: user.tenant.id,
      usuarioId: user.id,
    });
    if (this.session.user()?.id !== user.id || this.session.user()?.tenant?.id !== user.tenant.id)
      return;
    this.operaciones.set(ops);
  }

  async sincronizar() {
    this.mensajeExito.set(null);
    const resultado = await this.syncService.sincronizarAhora();
    await this.cargarOperaciones();
    this.mensajeExito.set(
      `Sincronización finalizada: ${resultado.confirmadas} confirmadas, ${resultado.conflictos} conflictos, ${resultado.rechazadas} rechazadas.`,
    );
  }

  async verDetalle(id: string) {
    if (!this.operaciones().some((operation) => operation.id === id)) return;
    const detalle = await this.operacionesRepo.obtenerOperacion(id);
    this.detalleSeleccionado.set(detalle);
  }
}
