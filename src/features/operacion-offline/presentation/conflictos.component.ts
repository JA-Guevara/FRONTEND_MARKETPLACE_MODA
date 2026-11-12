import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SyncApi, SyncConflictItem, ResolveConflictPayload } from '../infrastructure/sync.api';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge.component';
import { SessionService } from '../../usuarios-catalogo/application/session.service';

@Component({
  selector: 'fs-conflictos-sync',
  imports: [CommonModule, FormsModule, EmptyStateComponent, StatusBadgeComponent],
  template: `
    <div class="sp2-page">
      <div class="header">
        <div>
          <p class="crumbs">Administración / Sincronización</p>
          <h1>Conflictos de sincronización</h1>
          <p>
            Resuelve inconsistencias de stock, precios o estado detectadas durante el envío de
            operaciones fuera de línea.
          </p>
        </div>
      </div>

      <div class="filters">
        <button
          class="chip"
          [class.on]="filtroEstado() === 'PENDING'"
          (click)="cambiarFiltro('PENDING')"
        >
          Pendientes
        </button>
        <button
          class="chip"
          [class.on]="filtroEstado() === 'RESOLVED'"
          (click)="cambiarFiltro('RESOLVED')"
        >
          Resueltos
        </button>
        <button
          class="chip"
          [class.on]="filtroEstado() === 'REFUNDS'"
          (click)="cambiarFiltro('REFUNDS')"
        >
          Reintegros pendientes
        </button>
        <button class="chip" [class.on]="filtroEstado() === ''" (click)="cambiarFiltro('')">
          Todos
        </button>
      </div>

      @if (mensajeExito()) {
        <p class="alert success">{{ mensajeExito() }}</p>
      }
      @if (errorMsg()) {
        <p class="alert danger">{{ errorMsg() }}</p>
      }

      @if (cargando()) {
        <p class="loading">Cargando conflictos...</p>
      } @else {
        <div class="conflicts-list">
          @for (c of conflictos(); track c.id) {
            <div class="conflict-card" [class.resolved]="c.status === 'RESOLVED'">
              <div class="card-header">
                <div>
                  <span class="badge-type">{{ c.operation_type }}</span>
                  <span class="badge-conflict danger">{{ c.conflict_type }}</span>
                  <span class="request-id"
                    >Operación: <code>{{ c.local_folio || (c.client_request_id.slice(0, 8) + '...') }}</code></span
                  >
                  <span class="branch-cashier" *ngIf="c.branch_name || c.cashier_name">
                    · {{ c.branch_name || 'Sucursal' }} · {{ c.cashier_name || 'Cajero' }} · {{ c.device_id }}
                  </span>
                </div>
                <div class="card-status">
                  <span class="date">{{ c.detected_at | date: 'short' }}</span>
                  <fs-status-badge
                    [label]="esPendiente(c) ? 'PENDIENTE' : 'RESUELTO'"
                    [tone]="esPendiente(c) ? 'warn' : 'ok'"
                  ></fs-status-badge>
                </div>
              </div>

              <!-- Lista de ítems en conflicto -->
              @if (c.lines && c.lines.length) {
                <div class="conflict-lines">
                  @for (l of c.lines; track l.variant_id) {
                    <div class="conflict-line-row">
                      <span class="line-product">{{ l.product_name }}</span>
                      <span class="line-qty">pedido {{ l.requested_quantity }}</span>
                      <span class="line-avail">disponible {{ l.available_quantity }}</span>
                    </div>
                  }
                </div>
              }

              <!-- Recuadro La unidad la tomó (solo para conflictos de STOCK) -->
              @if (c.conflict_type === 'STOCK') {
                @if (c.competing_operation) {
                  <div class="competing-box">
                    <div class="competing-title">La unidad la tomó</div>
                    <div class="competing-line1">
                      Venta {{ c.competing_operation.server_number }} · {{ c.competing_operation.cashier_name || 'Cajero' }} · dispositivo {{ c.competing_operation.device_id }}
                    </div>
                    <div class="competing-line2">
                      Registrada sin conexión {{ formatearFecha(c.competing_operation.client_created_at) }} · Sincronizada {{ formatearFecha(c.competing_operation.synchronized_at) }}
                    </div>
                    <div class="competing-rule">
                      Gana la primera venta confirmada por el servidor.
                    </div>
                  </div>
                } @else {
                  <div class="competing-null">
                    No se identificó la operación que tomó la unidad (puede ser un ajuste de inventario).
                  </div>
                }
              }

              <div class="diff-view">
                <div class="diff-col client">
                  <h4>Solicitud del cliente offline</h4>
                  <pre>{{ c.payload_snapshot | json }}</pre>
                </div>
                <div class="diff-col server">
                  <h4>Estado actual en el servidor</h4>
                  <pre>{{ c.server_state_snapshot | json }}</pre>
                </div>
              </div>

              @if (c.refund; as refund) {
                <div class="alert info">
                  <strong
                    >Reintegro {{ refund.status === 'confirmed' ? 'confirmado' : 'pendiente' }}:
                    {{ refund.currency }} {{ refund.amount }}</strong
                  >
                  @if (refund.status === 'pending') {
                    <p>
                      Entregá el dinero al cliente antes de confirmar. Esta acción registra la
                      devolución de efectivo; no envía dinero automáticamente.
                    </p>
                    <label
                      >Referencia de caja<input
                        class="input"
                        [(ngModel)]="refundReferences[c.id]"
                        minlength="3"
                        maxlength="255"
                    /></label>
                    <label
                      ><input type="checkbox" [(ngModel)]="refundConfirmed[c.id]" />Confirmo que
                      entregué el importe completo al cliente</label
                    >
                    <button
                      [disabled]="
                        enviando() ||
                        !refundConfirmed[c.id] ||
                        !(refundReferences[c.id] || '').trim()
                      "
                      (click)="confirmRefund(c)"
                    >
                      Confirmar reintegro entregado
                    </button>
                  } @else {
                    <p>Referencia: {{ refund.reference }}</p>
                  }
                </div>
              }

              @if (esPendiente(c) && puedeResolver()) {
                <div class="actions">
                  @if (c.operation_type === 'PURCHASE') {
                    <span class="compra-cliente-aviso">Compra de cliente: no se realizó ningún cobro.</span>
                    <button class="btn btn-action danger small" (click)="abrirModalResolucion(c, 'CANCEL')">
                      Anular
                    </button>
                  } @else {
                    <button
                      class="btn btn-action primary small"
                      [disabled]="c.conflict_type !== 'STOCK'"
                      (click)="abrirModalResolucion(c, 'ADJUST')"
                    >
                      Ajustar existencias
                    </button>
                    <button
                      class="btn btn-action secondary small"
                      [disabled]="c.conflict_type !== 'PRICE'"
                      (click)="abrirModalResolucion(c, 'AUTHORIZE_PRICE')"
                    >
                      Autorizar precio
                    </button>
                    @if (c.conflict_type === 'STOCK' || c.conflict_type === 'SUBSCRIPTION' || c.conflict_type === 'PRODUCT_INACTIVE') {
                      <button
                        class="btn btn-action small"
                        (click)="resolverReintentar(c)"
                        title="Usalo después de registrar el ingreso de mercadería."
                      >
                        Reintentar
                      </button>
                    }
                    <button class="btn btn-action danger small" (click)="abrirModalResolucion(c, 'CANCEL')">
                      Anular y reintegrar
                    </button>
                  }
                </div>
              } @else if (c.status === 'RESOLVED') {
                <div class="resolution-info">
                  <strong>Resuelto:</strong> {{ c.resolution }} -
                  {{ c.resolution_notes || 'Sin notas' }}
                  <span class="sub-date">({{ c.resolved_at | date: 'short' }})</span>
                </div>
              }
            </div>
          } @empty {
            <fs-empty-state
              title="Sin conflictos"
              description="No se encontraron discrepancias pendientes de resolver."
            ></fs-empty-state>
          }
        </div>
      }

      @if (modalConflicto()) {
        <div class="modal-backdrop" (click)="cerrarModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>Resolver conflicto: {{ tipoResolucion() }}</h3>
            <p><strong>Operación:</strong> {{ modalConflicto()!.client_request_id }}</p>
            <p><strong>Tipo de conflicto:</strong> {{ modalConflicto()!.conflict_type }}</p>

            <div class="form-group">
              <label>Notas de resolución:</label>
              <textarea [(ngModel)]="notasResolucion" rows="3" class="input"></textarea>
            </div>

            @if (tipoResolucion() === 'ADJUST') {
              @for (linea of modalConflicto()!.lines ?? []; track linea.variant_id) {
                <label
                  >{{ linea.product_name }} · Disponible {{ linea.available_quantity }}
                  <input
                    class="input"
                    type="number"
                    min="0"
                    [max]="linea.available_quantity"
                    [(ngModel)]="cantidades[linea.variant_id]"
                  />
                </label>
              }
              <div class="alert info">
                Se ajustarán las cantidades de los ítems a la existencia disponible del servidor.
              </div>
            }

            <div class="modal-actions">
              <button class="btn" (click)="cerrarModal()">Cancelar</button>
              <button
                class="btn primary"
                [disabled]="enviando() || notasResolucion.trim().length < 5"
                (click)="confirmarResolucion()"
              >
                {{ enviando() ? 'Guardando...' : 'Confirmar resolución' }}
              </button>
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
      .header {
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
      .filters {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
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
      .conflicts-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .conflict-card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1.25rem;
        border-left: 4px solid #f59e0b;
      }
      .conflict-card.resolved {
        border-left-color: #10b981;
      }
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .badge-type {
        background: #e0e7ff;
        color: #3730a3;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        margin-right: 0.5rem;
      }
      .badge-conflict {
        background: #fee2e2;
        color: #991b1b;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        margin-right: 0.5rem;
      }
      .branch-cashier {
        font-size: 0.85rem;
        color: #4b5563;
      }
      .conflict-lines {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        margin-bottom: 0.75rem;
        background: #fdfaf5;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
      }
      .conflict-line-row {
        display: flex;
        gap: 1rem;
        font-size: 0.875rem;
      }
      .line-product {
        font-weight: 600;
        color: #111827;
      }
      .line-qty {
        color: #6b7280;
      }
      .line-avail {
        color: #b45309;
        font-weight: 500;
      }
      .competing-box {
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 0.85rem 1rem;
        margin-bottom: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .competing-title {
        font-size: 0.85rem;
        font-weight: 700;
        color: #0f172a;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .competing-line1 {
        font-size: 0.9rem;
        font-weight: 600;
        color: #1e293b;
      }
      .competing-line2 {
        font-size: 0.85rem;
        color: #475569;
      }
      .competing-rule {
        font-size: 0.8rem;
        font-style: italic;
        color: #64748b;
        margin-top: 0.25rem;
      }
      .competing-null {
        font-size: 0.85rem;
        font-style: italic;
        color: #64748b;
        background: #f1f5f9;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        margin-bottom: 1rem;
      }
      .compra-cliente-aviso {
        font-size: 0.85rem;
        color: #6b7280;
        font-weight: 500;
        align-self: center;
      }
      .diff-view {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1rem;
        background: #f9fafb;
        padding: 0.75rem;
        border-radius: 6px;
      }
      @media (max-width: 768px) {
        .diff-view {
          grid-template-columns: 1fr;
        }
      }
      .diff-col h4 {
        margin: 0 0 0.5rem;
        font-size: 0.85rem;
        color: #4b5563;
      }
      .diff-col pre {
        margin: 0;
        font-size: 0.75rem;
        background: #fff;
        padding: 0.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        max-height: 180px;
        overflow-y: auto;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        align-items: center;
      }
      .resolution-info {
        font-size: 0.85rem;
        color: #065f46;
        background: #d1fae5;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
      }
      .sub-date {
        color: #6b7280;
        margin-left: 0.5rem;
      }
      .btn {
        padding: 0.4rem 0.8rem;
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
      .btn.secondary {
        background: #4b5563;
        color: #fff;
        border-color: #4b5563;
      }
      .btn.danger {
        background: #dc2626;
        color: #fff;
        border-color: #dc2626;
      }
      .btn.small {
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
      .alert.info {
        background: #e0f2fe;
        color: #0369a1;
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
        max-width: 500px;
      }
      .form-group {
        margin: 1rem 0;
      }
      .form-group label {
        display: block;
        font-size: 0.85rem;
        font-weight: 500;
        margin-bottom: 0.25rem;
      }
      .input {
        width: 100%;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 0.5rem;
        box-sizing: border-box;
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 1rem;
      }
    `,
  ],
})
export class ConflictosSyncComponent implements OnInit {
  private syncApi: SyncApi;
  private session: SessionService | null = null;
  private inicializado = false;

  refundReferences: Record<string, string> = {};
  refundConfirmed: Record<string, boolean> = {};
  private refundAttempts: Record<string, string> = {};

  conflictos = signal<SyncConflictItem[]>([]);
  filtroEstado = signal<string>('PENDING');
  cargando = signal<boolean>(false);
  mensajeExito = signal<string | null>(null);
  errorMsg = signal<string | null>(null);

  modalConflicto = signal<SyncConflictItem | null>(null);
  tipoResolucion = signal<'ADJUST' | 'AUTHORIZE_PRICE' | 'CANCEL' | 'RETRY'>('ADJUST');
  notasResolucion = '';
  cantidades: Record<string, number> = {};
  enviando = signal<boolean>(false);

  constructor(syncApi?: SyncApi, sessionService?: SessionService) {
    if (syncApi) {
      this.syncApi = syncApi;
    } else {
      try {
        this.syncApi = inject(SyncApi);
      } catch {
        this.syncApi = {} as SyncApi;
      }
    }
    if (sessionService) {
      this.session = sessionService;
    } else {
      try {
        this.session = inject(SessionService, { optional: true });
      } catch {
        this.session = null;
      }
    }
  }

  puedeResolver(): boolean {
    return this.session ? this.session.can('sync_conflicts.resolve') : true;
  }

  esPendiente(c: SyncConflictItem): boolean {
    return c.status === 'PENDING' || c.status === 'OPEN';
  }

  formatearFecha(iso?: string | null): string {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    } catch {
      return iso;
    }
  }

  async ngOnInit() {
    if (this.inicializado) return;
    this.inicializado = true;
    await this.cargarConflictos();
  }

  cambiarFiltro(estado: string) {
    this.filtroEstado.set(estado);
    this.cargarConflictos();
  }

  async cargarConflictos() {
    this.cargando.set(true);
    this.errorMsg.set(null);
    try {
      const res = await this.syncApi.getConflicts(undefined, this.filtroEstado() || undefined);
      this.conflictos.set(res.items || []);
    } catch (e: any) {
      this.errorMsg.set('No se pudieron cargar los conflictos.');
    } finally {
      this.cargando.set(false);
    }
  }

  abrirModalResolucion(c: SyncConflictItem, tipo: 'ADJUST' | 'AUTHORIZE_PRICE' | 'CANCEL') {
    this.modalConflicto.set(c);
    this.tipoResolucion.set(tipo);
    this.notasResolucion = '';
    this.cantidades = Object.fromEntries(
      (c.lines ?? []).map((line) => [
        line.variant_id,
        Math.min(line.requested_quantity, line.available_quantity),
      ]),
    );
  }

  cerrarModal() {
    this.modalConflicto.set(null);
  }

  async confirmarResolucion() {
    const c = this.modalConflicto();
    if (!c) return;

    this.enviando.set(true);
    this.errorMsg.set(null);
    try {
      const payload: ResolveConflictPayload = {
        resolution: this.tipoResolucion(),
        resolution_notes: this.notasResolucion || undefined,
        line_adjustments: this.tipoResolucion() === 'ADJUST' ? this.cantidades : undefined,
      };
      await this.syncApi.resolveConflict(c.id, payload);
      this.mensajeExito.set(`Conflicto resuelto con acción: ${this.tipoResolucion()}`);
      this.cerrarModal();
      await this.cargarConflictos();
    } catch (e: any) {
      const msg =
        e?.error?.message ||
        e?.error?.error?.message ||
        e?.message ||
        'Error al resolver el conflicto';
      this.errorMsg.set(msg);
    } finally {
      this.enviando.set(false);
    }
  }

  async resolverReintentar(c: SyncConflictItem) {
    this.enviando.set(true);
    this.errorMsg.set(null);
    try {
      await this.syncApi.resolveConflict(c.id, {
        resolution: 'RETRY',
        resolution_notes: 'Reintento tras ingreso de mercadería',
      });
      this.mensajeExito.set('Operación confirmada exitosamente tras reintento.');
      await this.cargarConflictos();
    } catch (e: any) {
      const msg =
        e?.error?.message ||
        e?.error?.error?.message ||
        e?.message ||
        'Error al programar reintento.';
      this.errorMsg.set(msg);
    } finally {
      this.enviando.set(false);
    }
  }

  async resolverRapido(c: SyncConflictItem, resolucion: 'RETRY') {
    return this.resolverReintentar(c);
  }

  async confirmRefund(c: SyncConflictItem) {
    if (this.enviando() || !c.refund || !this.refundConfirmed[c.id]) return;
    this.enviando.set(true);
    this.errorMsg.set(null);
    try {
      const request_id = this.refundAttempts[c.id] || crypto.randomUUID();
      this.refundAttempts[c.id] = request_id;
      await this.syncApi.confirmRefund(c.id, {
        request_id,
        amount: c.refund.amount,
        reference: this.refundReferences[c.id].trim(),
      });
      this.mensajeExito.set(
        'Reintegro de efectivo registrado. No vuelvas a entregar este importe.',
      );
      await this.cargarConflictos();
    } catch (e: any) {
      this.errorMsg.set(e?.error?.message || e?.message || 'No se pudo confirmar el reintegro.');
    } finally {
      this.enviando.set(false);
    }
  }
}
