import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SyncApi, SyncConflictItem, ResolveConflictPayload } from '../infrastructure/sync.api';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge.component';

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
                    >Operación: <code>{{ c.client_request_id.slice(0, 8) }}...</code></span
                  >
                </div>
                <div class="card-status">
                  <span class="date">{{ c.detected_at | date: 'short' }}</span>
                  <fs-status-badge
                    [label]="c.status === 'PENDING' ? 'PENDIENTE' : 'RESUELTO'"
                    [tone]="c.status === 'PENDING' ? 'warn' : 'ok'"
                  ></fs-status-badge>
                </div>
              </div>

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
              @if (c.status === 'PENDING') {
                <div class="actions">
                  <button
                    class="btn primary small"
                    [disabled]="c.conflict_type !== 'STOCK'"
                    (click)="abrirModalResolucion(c, 'ADJUST')"
                  >
                    Ajustar existencias
                  </button>
                  <button
                    class="btn secondary small"
                    [disabled]="c.conflict_type !== 'PRICE'"
                    (click)="abrirModalResolucion(c, 'AUTHORIZE_PRICE')"
                  >
                    Autorizar precio
                  </button>
                  <button class="btn danger small" (click)="abrirModalResolucion(c, 'CANCEL')">
                    Cancelar operación
                  </button>
                  <button
                    class="btn small"
                    [disabled]="!['SUBSCRIPTION', 'PRODUCT_INACTIVE'].includes(c.conflict_type)"
                    (click)="resolverRapido(c, 'RETRY')"
                  >
                    Reintentar
                  </button>
                </div>
              } @else {
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
  refundReferences: Record<string, string> = {};
  refundConfirmed: Record<string, boolean> = {};
  private refundAttempts: Record<string, string> = {};
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

  constructor(syncApi?: SyncApi) {
    this.syncApi = syncApi ?? inject(SyncApi);
  }

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

  async ngOnInit() {
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
      this.errorMsg.set(e?.message || 'Error al resolver el conflicto');
    } finally {
      this.enviando.set(false);
    }
  }

  async resolverRapido(c: SyncConflictItem, resolucion: 'RETRY') {
    try {
      await this.syncApi.resolveConflict(c.id, { resolution: resolucion });
      this.mensajeExito.set('Operación encolada para reintento.');
      await this.cargarConflictos();
    } catch (e: any) {
      this.errorMsg.set('Error al programar reintento.');
    }
  }
}
