import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartItem } from '../domain/commerce.models';
import { ExchangesApi } from '../infrastructure/exchanges.api';
import {
  ExchangeCalculation,
  ExchangeDetail,
  ExchangeOrderLookup,
  ExchangePolicy,
  ExchangeSummaryItem,
  BranchStockAvailability,
} from '../domain/cambios.models';

function susalId(id: string): string { return id; }
@Component({
  selector: 'app-cambios-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cambios-container">
      <header class="page-header">
        <div>
          <h1>Gestión de Cambios de Prenda</h1>
          <p class="subtitle">
            Validación de política de plazo de cambio, recálculo de diferencias y actualización dual
            de existencias.
          </p>
        </div>
        <div class="policy-badge" *ngIf="policy()">
          <span>Plazo máximo de cambio:</span>
          <strong>{{ policy()?.exchange_days }} días</strong>
        </div>
      </header>

      <!-- Pestañas de navegación -->
      <div class="tabs">
        <button
          class="tab-btn"
          [class.active]="tabActiva() === 'nuevo'"
          (click)="tabActiva.set('nuevo')"
        >
          Nuevo Cambio de Prenda
        </button>
        <button
          class="tab-btn"
          [class.active]="tabActiva() === 'historial'"
          (click)="cargarHistorial()"
        >
          Historial de Cambios
        </button>
      </div>

      <!-- Alertas -->
      <div *ngIf="error()" class="alert alert-error">
        {{ error() }}
      </div>
      <div *ngIf="mensajeExito()" class="alert alert-success">
        {{ mensajeExito() }}
      </div>

      <!-- ================= PESTAÑA: NUEVO CAMBIO ================= -->
      <div *ngIf="tabActiva() === 'nuevo'" class="tab-content">
        <!-- Paso 1: Búsqueda del pedido original -->
        <section class="section-card">
          <h2>1. Buscar Pedido Original</h2>
          <div class="search-bar">
            <input
              type="text"
              class="form-control"
              [(ngModel)]="busquedaOrden"
              placeholder="Ingrese número de folio o código de orden (ej. ORD-001)..."
              (keyup.enter)="buscarOrden()"
            />
            <button
              class="btn btn-primary"
              (click)="buscarOrden()"
              [disabled]="!busquedaOrden.trim() || buscando()"
            >
              <span *ngIf="buscando()">Buscando...</span>
              <span *ngIf="!buscando()">Buscar Pedido</span>
            </button>
          </div>

          <!-- Información del pedido encontrado -->
          <div *ngIf="orden()" class="order-found-box">
            <div class="order-header-info">
              <div>
                <strong>Pedido: {{ orden()?.order_number }}</strong>
                <span class="text-muted"> ({{ orden()?.customer_email }})</span>
              </div>
              <div>
                Fecha de Compra: <strong>{{ orden()?.purchase_date | date: 'mediumDate' }}</strong>
              </div>
              <div [class.text-danger]="(orden()?.remaining_days ?? 0) <= 0">
                Días restantes de cambio: <strong>{{ orden()?.remaining_days }} días</strong>
              </div>
            </div>

            <!-- Advertencia si plazo vencido -->
            <div
              *ngIf="!orden()?.can_exchange && (orden()?.remaining_days ?? 0) <= 0"
              class="alert alert-error mt-2"
            >
              El plazo para realizar cambios para este pedido ha expirado (Límite:
              {{ orden()?.deadline_days }} días).
            </div>

            <!-- Tabla de prendas del pedido -->
            <div *ngIf="orden()?.items?.length" class="table-responsive mt-3">
              <h4>Prendas adquiridas en este pedido:</h4>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Prenda</th>
                    <th>Talla / Color</th>
                    <th>Precio Pagado</th>
                    <th>Cant. Original</th>
                    <th>Ya Cambiado</th>
                    <th>Disponible p/ Cambio</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let it of orden()?.items">
                    <td>
                      <strong>{{ it.product_name }}</strong>
                    </td>
                    <td>{{ it.size ?? '-' }} / {{ it.color ?? '-' }}</td>
                    <td>{{ it.unit_price | currency: 'BOB' : 'symbol' : '1.2-2' }}</td>
                    <td>{{ it.original_quantity }}</td>
                    <td>{{ it.already_exchanged_quantity }}</td>
                    <td>
                      <span class="badge" [class.badge-success]="it.available_for_exchange > 0">
                        {{ it.available_for_exchange }} u.
                      </span>
                    </td>
                    <td>
                      <button
                        *ngIf="it.available_for_exchange > 0 && orden()?.can_exchange"
                        class="btn btn-sm btn-outline"
                        [disabled]="prendaDevuelta()?.variant_id === it.variant_id"
                        (click)="seleccionarPrendaDevolucion(it)"
                      >
                        {{
                          prendaDevuelta()?.variant_id === it.variant_id
                            ? 'Seleccionada'
                            : 'Seleccionar'
                        }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- Paso 2: Configurar Cambio y Prenda de Reemplazo -->
        <section *ngIf="prendaDevuelta() as dev" class="section-card">
          <h2>2. Configurar Prenda de Reemplazo</h2>

          <div class="grid-2-cols">
            <!-- Prenda a entregar (Devolución) -->
            <div class="card-column">
              <h3>Prenda a Devolver</h3>
              <div class="line-summary">
                <p>
                  <strong>{{ dev.product_name }}</strong> (Talla: {{ dev.size }}, Color:
                  {{ dev.color }})
                </p>
                <div class="form-group">
                  <label>Cantidad a Devolver (Máx: {{ dev.available_for_exchange }}):</label>
                  <input
                    type="number"
                    class="form-control"
                    [(ngModel)]="cantidadDevolver"
                    [min]="1"
                    [max]="dev.available_for_exchange"
                    (change)="limpiarCalculo()"
                  />
                </div>
                <p>
                  Precio Unitario Original:
                  <strong>{{ dev.unit_price | currency: 'BOB' : 'symbol' : '1.2-2' }}</strong>
                </p>
                <p>
                  Valor total devuelto:
                  <strong>{{
                    dev.unit_price * cantidadDevolver | currency: 'BOB' : 'symbol' : '1.2-2'
                  }}</strong>
                </p>
              </div>
            </div>

            <!-- Prenda nueva que se lleva el cliente -->
            <div class="card-column">
              <h3>Nueva Prenda a Entregar</h3>
              <div class="form-group">
                <label>Prenda disponible en la sucursal:</label>
                <select
                  class="form-control"
                  [(ngModel)]="nuevaVarianteId"
                  (ngModelChange)="selectReplacement($event)"
                >
                  <option value="">Seleccioná una prenda</option>
                  @for (item of replacements(); track item.variant_id) {
                    @if (item.variant_id !== dev.variant_id && item.available > 0) {
                      <option [value]="item.variant_id">
                        {{ item.name }} · {{ item.size }} · {{ item.color }} ·
                        {{ item.unit_price }} BOB · {{ item.available }} disponibles
                      </option>
                    }
                  }
                </select>
                <button
                  type="button"
                  class="btn btn-outline sm"
                  style="margin-top:6px;font-size:12px;display:inline-flex;align-items:center;gap:4px"
                  (click)="consultarStockMultisucursal()"
                  [disabled]="!nuevaVarianteId || consultandoStock()"
                >
                  📍 {{ consultandoStock() ? 'Consultando sucursales...' : 'Ver stock en otras sucursales / Trasladar' }}
                </button>
              </div>
              <div class="form-group">
                <label>Cantidad a Entregar:</label>
                <input
                  type="number"
                  class="form-control"
                  [(ngModel)]="cantidadEntregar"
                  [min]="1"
                  (change)="limpiarCalculo()"
                />
              </div>
              <div class="form-group">
                <label>Precio Unitario de la Nueva Prenda (BOB):</label>
                <input
                  type="number"
                  class="form-control"
                  [(ngModel)]="nuevoPrecioUnitario"
                  readonly
                  step="0.01"
                  [min]="0"
                  (change)="limpiarCalculo()"
                />
              </div>
              <p>
                Valor total a entregar:
                <strong>{{
                  nuevoPrecioUnitario * cantidadEntregar | currency: 'BOB' : 'symbol' : '1.2-2'
                }}</strong>
              </p>
            </div>
          </div>

          <div class="action-row mt-3">
            <button
              class="btn btn-secondary"
              (click)="calcularDiferencia()"
              [disabled]="
                !nuevaVarianteId.trim() ||
                cantidadDevolver <= 0 ||
                cantidadEntregar <= 0 ||
                nuevoPrecioUnitario < 0 ||
                calculando()
              "
            >
              <span *ngIf="calculando()">Calculando...</span>
              <span *ngIf="!calculando()">Calcular Diferencia de Precio</span>
            </button>
          </div>

          <!-- Resultado del cálculo de diferencia -->
          <div
            *ngIf="calculo()"
            class="calculation-result-box mt-3"
            [ngClass]="calculo()?.tipo_diferencia"
          >
            <div class="calc-header">
              <span class="calc-label">Resultado del Recálculo:</span>
              <strong class="calc-amount">{{
                calculo()?.difference_amount | currency: 'BOB' : 'symbol' : '1.2-2'
              }}</strong>
            </div>

            <div *ngIf="calculo()?.tipo_diferencia === 'PAGO_CLIENTE'" class="calc-msg">
              <strong>El cliente debe pagar una diferencia</strong> de
              {{ calculo()?.difference_amount | currency: 'BOB' : 'symbol' : '1.2-2' }}
              por llevar una prenda de mayor valor.
            </div>

            <div *ngIf="calculo()?.tipo_diferencia === 'REINTEGRO_O_SALDO'" class="calc-msg">
              <strong>Diferencia a favor del cliente:</strong>
              {{ (calculo()?.difference_amount ?? 0) * -1 | currency: 'BOB' : 'symbol' : '1.2-2' }}.
              El reintegro se confirma al finalizar. Los pagos Stripe se reintegran a la cuenta
              original; el efectivo se entrega en caja.
            </div>

            <div *ngIf="calculo()?.tipo_diferencia === 'CAMBIO_DIRECTO'" class="calc-msg">
              <strong>Cambio directo (mismo valor):</strong> No existe diferencia de pago.
            </div>

            <!-- Paso 3: Confirmación y cobro de diferencia -->
            <div class="payment-form mt-3">
              <div class="form-group" *ngIf="calculo()?.tipo_diferencia === 'PAGO_CLIENTE'">
                <label>Método de pago de la diferencia:</label>
                <select class="form-control" [(ngModel)]="metodoPago">
                  <option value="cash">Efectivo</option>
                </select>
              </div>

              <div
                class="form-group"
                *ngIf="calculo()?.tipo_diferencia === 'PAGO_CLIENTE' && metodoPago === 'cash'"
              >
                <label>Efectivo recibido del cliente (BOB):</label>
                <input
                  type="number"
                  class="form-control"
                  [(ngModel)]="efectivoRecibido"
                  step="0.01"
                  [min]="calculo()?.difference_amount ?? 0"
                />
                <small
                  *ngIf="efectivoRecibido >= (calculo()?.difference_amount ?? 0)"
                  class="text-success"
                >
                  Cambio a devolver:
                  {{
                    efectivoRecibido - (calculo()?.difference_amount ?? 0)
                      | currency: 'BOB' : 'symbol' : '1.2-2'
                  }}
                </small>
              </div>

              <div class="form-group">
                <label>Notas o motivo del cambio:</label>
                <input
                  type="text"
                  class="form-control"
                  [(ngModel)]="notasCambio"
                  placeholder="Ej. Cambio de talla M a L por ajuste en hombros..."
                />
              </div>

              <button
                class="btn btn-primary btn-lg mt-2"
                (click)="ejecutarCambio()"
                [disabled]="ejecutando() || !puedeConfirmar()"
              >
                <span *ngIf="ejecutando()">Procesando Cambio Atómico...</span>
                <span *ngIf="!ejecutando()">Confirmar Cambio y Actualizar Existencias</span>
              </button>
            </div>
          </div>
        </section>

        <!-- Comprobante / Recibo de Cambio Exitoso -->
        <section *ngIf="cambioCompletado() as ex" class="section-card receipt-card">
          <div class="receipt-header">
            <h2>Comprobante de Cambio de Prenda</h2>
            <span class="pill pill-success">COMPLETADO</span>
          </div>
          <p>
            Folio de Cambio: <strong>#{{ ex.id.substring(0, 8) }}</strong>
          </p>
          <p>
            Pedido Original: <strong>{{ ex.original_order_number ?? ex.original_order_id }}</strong>
          </p>
          <p>
            Fecha: <strong>{{ ex.created_at | date: 'medium' }}</strong>
          </p>

          <table class="data-table mt-2">
            <thead>
              <tr>
                <th>Operación</th>
                <th>Prenda / SKU</th>
                <th>Cantidad</th>
                <th>Precio Unitario</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngFor="let l of ex.lines">
                <tr class="row-return">
                  <td><span class="pill pill-warning">Devuelta</span></td>
                  <td>{{ l.original_product_name ?? l.original_sku ?? l.original_variant_id }}</td>
                  <td>{{ l.returned_quantity }}</td>
                  <td>{{ l.original_unit_price | currency: 'BOB' : 'symbol' : '1.2-2' }}</td>
                  <td>-{{ l.returned_total | currency: 'BOB' : 'symbol' : '1.2-2' }}</td>
                </tr>
                <tr class="row-delivery">
                  <td><span class="pill pill-success">Entregada</span></td>
                  <td>{{ l.new_product_name ?? l.new_sku ?? l.new_variant_id }}</td>
                  <td>{{ l.delivered_quantity }}</td>
                  <td>{{ l.new_unit_price | currency: 'BOB' : 'symbol' : '1.2-2' }}</td>
                  <td>+{{ l.delivered_total | currency: 'BOB' : 'symbol' : '1.2-2' }}</td>
                </tr>
              </ng-container>
            </tbody>
          </table>

          <div class="receipt-summary mt-3">
            <div>
              Diferencia total:
              <strong>{{ ex.difference_amount | currency: 'BOB' : 'symbol' : '1.2-2' }}</strong>
            </div>
            <div>
              Método: <strong>{{ ex.payment_method }}</strong>
            </div>
            <div *ngIf="ex.cash_received">
              Efectivo recibido:
              <strong>{{ ex.cash_received | currency: 'BOB' : 'symbol' : '1.2-2' }}</strong>
            </div>
            <div *ngIf="ex.cash_returned">
              Cambio entregado:
              <strong>{{ ex.cash_returned | currency: 'BOB' : 'symbol' : '1.2-2' }}</strong>
            </div>
          </div>

          <div class="receipt-actions mt-3">
            <button class="btn btn-secondary" (click)="imprimirComprobante()">
              Imprimir Comprobante
            </button>
            <button class="btn btn-primary" (click)="resetFormulario()">
              Realizar Otro Cambio
            </button>
          </div>
        </section>
      </div>

      
      <!-- Modal: Disponibilidad en Otras Sucursales y Traslado Intersucursal -->
      <div *ngIf="modalDisponibilidad() as sucursales" class="pos-modal-backdrop" role="dialog" aria-modal="true">
        <div class="pos-modal-card" style="max-width: 620px;">
          <div class="pos-recibo-header">
            <div class="pos-badge-success" style="background:#eff6ff;color:#1e40af">📍</div>
            <h2>Disponibilidad en Otras Sucursales</h2>
            <p class="receipt-code">Catálogo global de la empresa · Existencias en tiempo real</p>
          </div>

          <div class="table-responsive mt-2" style="max-height:280px;overflow-y:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Sucursal</th>
                  <th>Ciudad</th>
                  <th>Stock</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of sucursales">
                  <td>
                    <strong>{{ s.branch_name }}</strong>
                    <div class="text-muted" style="font-size:11.5px">{{ s.address }}</div>
                  </td>
                  <td>{{ s.city }}</td>
                  <td>
                    <strong [class.text-success]="s.available_quantity > 0" [class.text-danger]="s.available_quantity === 0">
                      {{ s.available_quantity }} uds
                    </strong>
                  </td>
                  <td>
                    <button
                      *ngIf="s.can_transfer && s.branch_id !== orden()?.branch_id"
                      type="button"
                      class="btn btn-primary sm"
                      (click)="trasladarPrenda(s)"
                      [disabled]="trasladando()"
                      style="font-size:12px;padding:4px 8px"
                    >
                      {{ trasladando() ? 'Trasladando...' : '🚚 Trasladar 1 ud' }}
                    </button>
                    <span *ngIf="s.branch_id === orden()?.branch_id" class="pill">Sucursal actual</span>
                    <span *ngIf="!s.can_transfer && s.branch_id !== orden()?.branch_id" class="text-muted" style="font-size:12px">Agotado</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pos-actions" style="margin-top:14px;justify-content:flex-end">
            <button type="button" class="btn btn-outline" (click)="cerrarModalDisponibilidad()">Cerrar</button>
          </div>
        </div>
      </div>

      <!-- ================= PESTAÑA: HISTORIAL ================= -->
      <div *ngIf="tabActiva() === 'historial'" class="tab-content">
        <section class="section-card">
          <h2>Historial de Cambios Realizados</h2>

          <div *ngIf="cargandoHistorial()" class="loading-state">
            <div class="spinner"></div>
            <p>Cargando historial de cambios...</p>
          </div>

          <div *ngIf="!cargandoHistorial() && !historial().length" class="empty-state">
            No se registran cambios de prendas realizados aún.
          </div>

          <div *ngIf="historial().length" class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Pedido Original</th>
                  <th>Fecha</th>
                  <th>Líneas</th>
                  <th>Diferencia</th>
                  <th>Método Pago</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let h of historial()">
                  <td>
                    <code>#{{ h.id.substring(0, 8) }}</code>
                  </td>
                  <td>
                    <strong>{{
                      h.original_order_number ?? h.original_order_id.substring(0, 8)
                    }}</strong>
                  </td>
                  <td>{{ h.created_at | date: 'short' }}</td>
                  <td>{{ h.lines_count }} prenda(s)</td>
                  <td>
                    <strong [class.text-primary]="h.difference_amount > 0">
                      {{ h.difference_amount | currency: 'BOB' : 'symbol' : '1.2-2' }}
                    </strong>
                  </td>
                  <td>{{ h.payment_method }}</td>
                  <td>
                    <span class="pill pill-success">{{ h.status }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .cambios-container {
        padding: 1.5rem;
        max-width: 1100px;
        margin: 0 auto;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .page-header h1 {
        margin: 0;
        font-size: 1.6rem;
        color: #1f2937;
      }
      .subtitle {
        margin: 0.25rem 0 0;
        color: #6b7280;
        font-size: 0.9rem;
      }
      .policy-badge {
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 8px;
        padding: 0.5rem 1rem;
        font-size: 0.85rem;
        color: #1e40af;
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      .tabs {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
        border-bottom: 2px solid #e5e7eb;
      }
      .tab-btn {
        padding: 0.75rem 1.25rem;
        border: none;
        background: none;
        font-size: 0.95rem;
        font-weight: 600;
        color: #6b7280;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
      }
      .tab-btn.active {
        color: #2563eb;
        border-bottom-color: #2563eb;
      }
      .section-card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
      .section-card h2 {
        margin-top: 0;
        font-size: 1.2rem;
        color: #1f2937;
      }
      .search-bar {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .order-found-box {
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 1rem;
      }
      .order-header-info {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1rem;
        font-size: 0.9rem;
      }
      .grid-2-cols {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
      }
      @media (max-width: 768px) {
        .grid-2-cols {
          grid-template-columns: 1fr;
        }
      }
      .card-column {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 1rem;
      }
      .card-column h3 {
        margin-top: 0;
        font-size: 1rem;
        color: #334155;
      }
      .form-group {
        margin-bottom: 0.85rem;
      }
      .form-group label {
        display: block;
        font-size: 0.85rem;
        font-weight: 500;
        margin-bottom: 0.25rem;
        color: #4b5563;
      }
      .form-control {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-family: inherit;
        box-sizing: border-box;
      }
      .calculation-result-box {
        border: 2px solid #cbd5e1;
        border-radius: 8px;
        padding: 1.25rem;
        background: #f8fafc;
      }
      .calculation-result-box.PAGO_CLIENTE {
        border-color: #3b82f6;
        background: #eff6ff;
      }
      .calculation-result-box.REINTEGRO_O_SALDO {
        border-color: #f59e0b;
        background: #fffbeb;
      }
      .calculation-result-box.CAMBIO_DIRECTO {
        border-color: #10b981;
        background: #ecfdf5;
      }
      .calc-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }
      .calc-amount {
        font-size: 1.5rem;
      }
      .calc-msg {
        font-size: 0.95rem;
        margin-bottom: 1rem;
      }
      .receipt-card {
        border-left: 6px solid #10b981;
      }
      .receipt-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .row-return {
        background: #fffbeb;
      }
      .row-delivery {
        background: #f0fdf4;
      }
      .receipt-summary {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 1rem;
        display: flex;
        gap: 2rem;
        flex-wrap: wrap;
      }
      .receipt-actions {
        display: flex;
        gap: 0.75rem;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }
      .data-table th,
      .data-table td {
        padding: 0.6rem 0.85rem;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }
      .data-table th {
        background: #f1f5f9;
        color: #475569;
      }
      .badge {
        display: inline-block;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        background: #e2e8f0;
      }
      .badge-success {
        background: #dcfce7;
        color: #166534;
      }
      .pill {
        display: inline-block;
        padding: 0.2rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .pill-success {
        background: #dcfce7;
        color: #166534;
      }
      .pill-warning {
        background: #fef3c7;
        color: #92400e;
      }
      .alert {
        padding: 0.75rem 1rem;
        border-radius: 6px;
        margin-bottom: 1rem;
        font-size: 0.9rem;
      }
      .alert-error {
        background: #fee2e2;
        color: #991b1b;
        border: 1px solid #f87171;
      }
      .alert-success {
        background: #dcfce7;
        color: #166534;
        border: 1px solid #86efac;
      }
      .btn {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid transparent;
      }
      .btn-sm {
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
      }
      .btn-lg {
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        font-weight: 600;
      }
      .btn-primary {
        background: #2563eb;
        color: white;
      }
      .btn-secondary {
        background: #e5e7eb;
        color: #1f2937;
      }
      .btn-outline {
        background: white;
        border-color: #cbd5e1;
        color: #334155;
      }
      .btn-outline:hover {
        background: #f1f5f9;
      }
      .text-danger {
        color: #dc2626;
      }
      .text-success {
        color: #16a34a;
      }
      .text-primary {
        color: #2563eb;
      }
      .text-muted {
        color: #6b7280;
      }
      .mt-2 {
        margin-top: 0.5rem;
      }
      .mt-3 {
        margin-top: 1rem;
      }
      .loading-state,
      .empty-state {
        text-align: center;
        padding: 2rem;
        color: #6b7280;
      }
      .spinner {
        width: 28px;
        height: 28px;
        border: 3px solid #e5e7eb;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 0.75rem;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .pos-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(5px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        z-index: 1000;
      }
      .pos-modal-card {
        width: 100%;
        background: var(--surface, #ffffff);
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
        border: 1px solid var(--line);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .pos-recibo-header {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      .pos-badge-success {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #ecfdf5;
        color: #059669;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        margin-bottom: 4px;
      }
      .pos-recibo-header h2 {
        font-size: 19px;
        font-weight: 700;
        margin: 0;
        color: #0f172a;
      }
      .receipt-code {
        font-size: 13px;
        color: #64748b;
        margin: 0;
      }
      .pos-actions {
        display: flex;
        gap: 10px;
      }
    `,
  ],
})
export class CambiosPageComponent implements OnInit {
  tabActiva = signal<'nuevo' | 'historial'>('nuevo');
  policy = signal<ExchangePolicy | null>(null);

  // Formulario nuevo cambio
  busquedaOrden = '';
  buscando = signal<boolean>(false);
  orden = signal<ExchangeOrderLookup | null>(null);

  prendaDevuelta = signal<any | null>(null);
  cantidadDevolver = 1;

  nuevaVarianteId = '';
  cantidadEntregar = 1;
  nuevoPrecioUnitario = 0;

  calculando = signal<boolean>(false);
  calculo = signal<ExchangeCalculation | null>(null);

  metodoPago = 'cash';
  efectivoRecibido = 0;
  notasCambio = '';

  ejecutando = signal<boolean>(false);
  cambioCompletado = signal<ExchangeDetail | null>(null);

  // Historial
  cargandoHistorial = signal<boolean>(false);
  historial = signal<ExchangeSummaryItem[]>([]);

  error = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  replacements = signal<CartItem[]>([]);
  private pendingAttempt?: { fingerprint: string; id: string };
  
  modalDisponibilidad = signal<BranchStockAvailability[] | null>(null);
  consultandoStock = signal<boolean>(false);
  trasladando = signal<boolean>(false);

  async consultarStockMultisucursal(): Promise<void> {
    if (!this.nuevaVarianteId) return;
    this.consultandoStock.set(true);
    this.error.set(null);
    try {
      const data = await this.exchangesApi.getAvailability(this.nuevaVarianteId);
      this.modalDisponibilidad.set(data);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo consultar el stock en otras sucursales.');
    } finally {
      this.consultandoStock.set(false);
    }
  }

  cerrarModalDisponibilidad(): void {
    this.modalDisponibilidad.set(null);
  }

  async trasladarPrenda(sucursal: BranchStockAvailability): Promise<void> {
    const ord = this.orden();
    if (!ord || !this.nuevaVarianteId) return;
    this.trasladando.set(true);
    this.error.set(null);
    try {
      const res = await this.exchangesApi.transferStock({
        variant_id: this.nuevaVarianteId,
        from_branch_id: susalId(sucursal.branch_id),
        to_branch_id: ord.branch_id,
        quantity: 1,
        notes: `Traslado para cambio en pedido #${ord.order_number}`,
      });
      this.mensajeExito.set(res.message);
      this.modalDisponibilidad.set(null);
      this.replacements.set(await this.exchangesApi.options(ord.branch_id));
      this.selectReplacement(this.nuevaVarianteId);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Error al trasladar la prenda entre sucursales.');
    } finally {
      this.trasladando.set(false);
    }
  }

  constructor(private exchangesApi: ExchangesApi) {}
  selectReplacement(id: string) {
    this.nuevoPrecioUnitario = Number(
      this.replacements().find((i) => i.variant_id === id)?.unit_price || 0,
    );
    this.limpiarCalculo();
  }

  ngOnInit(): void {
    this.cargarPolitica();
  }

  async cargarPolitica(): Promise<void> {
    try {
      const pol = await this.exchangesApi.getPolicy();
      this.policy.set(pol);
    } catch {
      // Ignorar error no crítico
    }
  }

  async buscarOrden(): Promise<void> {
    if (!this.busquedaOrden.trim()) return;
    this.buscando.set(true);
    this.error.set(null);
    this.limpiarSeleccion();
    try {
      const data = await this.exchangesApi.lookupOrder(this.busquedaOrden);
      this.orden.set(data);
      this.replacements.set(await this.exchangesApi.options(data.branch_id));
    } catch (err: any) {
      this.error.set(
        err?.error?.message ?? err?.message ?? 'No se encontró el pedido o expiró el plazo.',
      );
      this.orden.set(null);
    } finally {
      this.buscando.set(false);
    }
  }

  seleccionarPrendaDevolucion(item: any): void {
    this.prendaDevuelta.set(item);
    this.cantidadDevolver = 1;
    this.nuevoPrecioUnitario = item.unit_price;
    this.limpiarCalculo();
  }

  limpiarCalculo(): void {
    this.calculo.set(null);
  }

  limpiarSeleccion(): void {
    this.prendaDevuelta.set(null);
    this.limpiarCalculo();
    this.cambioCompletado.set(null);
  }

  async calcularDiferencia(): Promise<void> {
    const dev = this.prendaDevuelta();
    const ord = this.orden();
    if (!dev || !ord) return;

    this.calculando.set(true);
    this.error.set(null);
    try {
      const lines = [
        {
          original_variant_id: dev.variant_id,
          returned_quantity: this.cantidadDevolver,
          original_unit_price: dev.unit_price,
          new_variant_id: this.nuevaVarianteId.trim(),
          delivered_quantity: this.cantidadEntregar,
          new_unit_price: this.nuevoPrecioUnitario,
        },
      ];
      const res = await this.exchangesApi.calculate(ord.branch_id, lines,ord.order_id);
      this.calculo.set(res);
      this.efectivoRecibido = Math.max(0, res.difference_amount);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Error al calcular la diferencia.');
    } finally {
      this.calculando.set(false);
    }
  }

  puedeConfirmar(): boolean {
    const c = this.calculo();
    if (!c) return false;
    if (c.tipo_diferencia === 'PAGO_CLIENTE' && this.metodoPago === 'cash') {
      return this.efectivoRecibido >= c.difference_amount;
    }
    return true;
  }

  async ejecutarCambio(): Promise<void> {
    const ord = this.orden();
    const dev = this.prendaDevuelta();
    const calc = this.calculo();
    if (!ord || !dev || !calc) return;

    this.ejecutando.set(true);
    this.error.set(null);
    try {
      const fingerprint = JSON.stringify({
        order: ord.order_id,
        old: dev.variant_id,
        next: this.nuevaVarianteId,
        qty: this.cantidadDevolver,
        qtyNew: this.cantidadEntregar,
        method: this.metodoPago,
        received: this.efectivoRecibido,
        notes: this.notasCambio,
      });
      if (this.pendingAttempt?.fingerprint !== fingerprint)
        this.pendingAttempt = { fingerprint, id: crypto.randomUUID() };
      const cambio = await this.exchangesApi.executeExchange({
        client_request_id: this.pendingAttempt.id,
        original_order_id: ord.order_id,
        branch_id: ord.branch_id,
        payment_method: this.metodoPago,
        cash_received:
          this.metodoPago === 'cash' && calc.difference_amount > 0 ? this.efectivoRecibido : 0,
        cash_returned:
          calc.difference_amount < 0
            ? -calc.difference_amount
            : this.metodoPago === 'cash'
              ? Number((this.efectivoRecibido - calc.difference_amount).toFixed(2))
              : 0,
        notes: this.notasCambio,
        lines: [
          {
            original_variant_id: dev.variant_id,
            returned_quantity: this.cantidadDevolver,
            original_unit_price: dev.unit_price,
            new_variant_id: this.nuevaVarianteId.trim(),
            delivered_quantity: this.cantidadEntregar,
            new_unit_price: this.nuevoPrecioUnitario,
          },
        ],
      });

      this.cambioCompletado.set(cambio);
      this.mensajeExito.set('Cambio de prenda realizado con éxito. Existencias actualizadas.');
      this.prendaDevuelta.set(null);
      this.calculo.set(null);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Error al ejecutar el cambio.');
    } finally {
      this.ejecutando.set(false);
    }
  }

  resetFormulario(): void {
    this.busquedaOrden = '';
    this.orden.set(null);
    this.prendaDevuelta.set(null);
    this.calculo.set(null);
    this.cambioCompletado.set(null);
    this.mensajeExito.set(null);
  }

  imprimirComprobante(): void {
    window.print();
  }

  async cargarHistorial(): Promise<void> {
    this.tabActiva.set('historial');
    this.cargandoHistorial.set(true);
    try {
      const res = await this.exchangesApi.listExchanges(1, 50);
      this.historial.set(res.items);
    } catch (err: any) {
      this.error.set('No se pudo cargar el historial de cambios.');
    } finally {
      this.cargandoHistorial.set(false);
    }
  }
}
