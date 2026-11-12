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
import {
  etiquetaEstado,
  etiquetaTipo,
  formatearFechaCorta,
} from '../domain/sincronizacion.models';

@Component({
  selector: 'fs-operaciones-pendientes',
  imports: [CommonModule, RouterLink, EmptyStateComponent, StatusBadgeComponent],
  template: `
    <div class="sp2-page">
      <div class="offline-heading">
        <div>
          <p class="crumbs">Sin conexión / Sincronización</p>
          <h1>Operaciones locales</h1>
          <p>Supervisa las ventas y reservas generadas fuera de línea y su estado de envío.</p>
        </div>
      </div>

      @if (esSesionVencida()) {
        <div class="alert warning banner-sesion">
          <span>Tenés {{ syncService.pendientesCount() }} ventas por subir. Iniciá sesión para enviarlas.</span>
          <a routerLink="/iniciar-sesion" class="btn small primary">Iniciar sesión</a>
        </div>
      }

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
                <th>Detalle</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              @for (op of operacionesFiltradas(); track op.id) {
                <tr [class.row-conflict]="op.estado === 'CONFLICTO'">
                  <td>
                    <span
                      class="badge-type"
                      [class.sale]="op.tipo === 'VENTA'"
                      [class.res]="op.tipo === 'RESERVA'"
                    >
                      {{ etiquetaTipo(op.tipo) }}
                    </span>
                  </td>
                  <td>
                    <code>{{ op.payload?.local_folio || op.id.slice(0, 8) }}</code>
                  </td>
                  <td>{{ fechaCorta(op.creada_en) }}</td>
                  <td>
                    @if (op.tipo === 'VENTA') {
                      <span>Bs {{ op.payload?.total || '0.00' }}</span>
                    } @else {
                      <span>{{ op.payload?.prendas || op.payload?.items?.length || 1 }} prenda(s)</span>
                    }
                    @if (op.refund_amount) {
                      <small class="d-block text-muted">
                        Reintegro {{ op.refund_status === 'confirmed' ? 'confirmado' : 'pendiente' }}: Bs {{ op.refund_amount }}
                      </small>
                    }
                  </td>
                  <td>
                    @if (op.estado === 'CONFLICTO' && canResolveConflicts()) {
                      <a routerLink="/admin/conflictos" class="conflict-link">
                        {{ etiquetaEstado(op.estado) }} →
                      </a>
                    } @else {
                      <span
                        class="status-pill"
                        [class.status-pending]="op.estado === 'PENDIENTE' || op.estado === 'ENVIADA'"
                        [class.status-confirmed]="op.estado === 'CONFIRMADA'"
                        [class.status-conflict]="op.estado === 'CONFLICTO'"
                        [class.status-rejected]="op.estado === 'RECHAZADA' || op.estado === 'ANULADA'"
                      >
                        {{ etiquetaEstado(op.estado) }}
                        @if (op.estado === 'CONFIRMADA' && op.server_numero) {
                          <strong> {{ op.server_numero }}</strong>
                        }
                      </span>
                    }
                  </td>
                  <td>
                    <button class="btn small" (click)="verDetalle(op.id)">Ver</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <fs-empty-state
                      title="No hay operaciones guardadas en este dispositivo."
                      description="Las ventas y reservas generadas en este navegador aparecerán aquí."
                    ></fs-empty-state>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="panel-footer">
          <div class="footer-sync-info">
            <span>Última sincronización: {{ fechaCorta(syncService.ultimoSync()) || 'Sin sincronizaciones' }}</span>
          </div>
          <div class="footer-actions">
            <button
              class="btn secondary"
              [disabled]="syncService.sincronizando()"
              (click)="sincronizar()"
            >
              {{ syncService.sincronizando() ? 'Sincronizando...' : 'Sincronizar ahora' }}
            </button>
          </div>
        </div>
      </section>

      @if (detalleSeleccionado()) {
        <div class="modal-backdrop" (click)="detalleSeleccionado.set(null)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>Detalle de la operación</h3>
            <p><strong>ID:</strong> {{ detalleSeleccionado()!.operacion.id }}</p>
            <p><strong>Tipo:</strong> {{ etiquetaTipo(detalleSeleccionado()!.operacion.tipo) }}</p>
            <p><strong>Estado:</strong> {{ etiquetaEstado(detalleSeleccionado()!.operacion.estado) }}</p>
            <p>
              <strong>Creada en:</strong>
              {{ fechaCorta(detalleSeleccionado()!.operacion.creada_en) }}
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
      .banner-sesion {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fde68a;
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
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 500;
      }
      .status-pending {
        background: #fef3c7;
        color: #92400e;
      }
      .status-confirmed {
        background: #d1fae5;
        color: #065f46;
      }
      .status-conflict {
        background: #fee2e2;
        color: #991b1b;
      }
      .status-rejected {
        background: #f3f4f6;
        color: #4b5563;
      }
      .conflict-link {
        color: #dc2626;
        font-weight: 600;
        text-decoration: underline;
      }
      .panel-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
        font-size: 0.85rem;
        color: #6b7280;
      }
      .btn {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid #d1d5db;
        background: #fff;
        text-decoration: none;
      }
      .btn.secondary {
        background: #fff;
        color: #374151;
        border: 1px solid #d1d5db;
      }
      .btn.secondary:hover {
        background: #f3f4f6;
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
      .alert.warning {
        background: #fef3c7;
        color: #92400e;
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
  session: SessionService;

  etiquetaTipo = etiquetaTipo;
  etiquetaEstado = etiquetaEstado;

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
  filtroActual = signal<string>('Todas');
  filtros = ['Todas', 'Por subir', 'Confirmadas', 'Necesitan revisión'];
  mensajeExito = signal<string | null>(null);
  detalleSeleccionado = signal<OperacionConDetalle | null>(null);

  readonly esSesionVencida = computed(() => {
    return this.syncService.estado?.() === 'SESION_VENCIDA';
  });

  canResolveConflicts(): boolean {
    return this.session?.can?.('sync_conflicts.read') ?? false;
  }

  fechaCorta(fecha: string | Date | null | undefined): string {
    if (!fecha) return '';
    return formatearFechaCorta(fecha);
  }

  operacionesFiltradas = computed(() => {
    const f = this.filtroActual();
    const ops = this.operaciones();
    if (f === 'Todas') return ops;
    if (f === 'Por subir') return ops.filter((o) => o.estado === 'PENDIENTE' || o.estado === 'ENVIADA');
    if (f === 'Confirmadas') return ops.filter((o) => o.estado === 'CONFIRMADA');
    if (f === 'Necesitan revisión') return ops.filter((o) => o.estado === 'CONFLICTO');
    return ops;
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
