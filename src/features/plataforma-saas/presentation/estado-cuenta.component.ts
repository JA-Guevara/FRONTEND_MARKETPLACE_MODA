import {
  Component,
  Input,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SubscriptionInvoice } from '../domain/suscripcion.models';
import { SessionService } from '../../usuarios-catalogo/application/session.service';

@Component({
  selector: 'fs-estado-cuenta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="estado-cuenta-card">
      <div class="card-header">
        <div>
          <h3>Estado de cuenta</h3>
          <span class="disclaimer">Comprobantes de suscripción · no son facturas fiscales</span>
        </div>
        @if (canRegisterPayment()) {
          <span class="badge info">Consola de plataforma</span>
        }
      </div>

      @if (successMessage()) {
        <div class="alert ok">{{ successMessage() }}</div>
      }

      @if (error()) {
        <div class="alert danger">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="empty-state">Cargando comprobantes...</div>
      } @else if (invoices().length === 0) {
        <div class="empty-state">No se han emitido comprobantes aún.</div>
      } @else {
        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Número</th>
                <th>Período</th>
                <th>Monto</th>
                <th>Estado</th>
                <th style="text-align: right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (inv of invoices(); track inv.id) {
                <tr>
                  <td class="mono">
                    <strong>{{ inv.number }}</strong>
                    @if (inv.paid_reference) {
                      <br><small class="mono text-muted">Ref: {{ inv.paid_reference }}</small>
                    }
                  </td>
                  <td>{{ formatPeriod(inv.period_start, inv.period_end) }}</td>
                  <td class="mono">
                    {{ inv.currency }} {{ inv.amount | number:'1.2-2' }}
                  </td>
                  <td>
                    <span class="badge" [ngClass]="statusClass(inv.status)">
                      {{ statusLabel(inv.status) }}
                    </span>
                  </td>
                  <td class="actions-cell">
                    <button
                      type="button"
                      class="btn sm"
                      (click)="downloadPdf(inv)"
                      [disabled]="downloadingId() === inv.id"
                      title="Descargar comprobante en PDF"
                    >
                      @if (downloadingId() === inv.id) {
                        <span>⏳ Descargando...</span>
                      } @else {
                        <span>⇩ PDF</span>
                      }
                    </button>

                    @if (canRegisterPayment() && inv.status !== 'paid') {
                      <button
                        type="button"
                        class="btn sm primary"
                        (click)="openPayModal(inv)"
                      >
                        Registrar pago
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (payingInvoice(); as inv) {
      <div class="pay-modal-backdrop" (click)="closePayModal()">
        <div class="pay-modal" (click)="$event.stopPropagation()">
          <h4>Registrar pago de suscripción</h4>
          <div class="pay-meta">
            <div><strong>Comprobante:</strong> {{ inv.number }}</div>
            <div><strong>Monto:</strong> {{ inv.currency }} {{ inv.amount | number:'1.2-2' }}</div>
            <div><strong>Período:</strong> {{ formatPeriod(inv.period_start, inv.period_end) }}</div>
          </div>

          <div class="form-group">
            <label for="pay-ref">Referencia o folio de pago (transferencia, depósito):</label>
            <input
              id="pay-ref"
              type="text"
              placeholder="Ej. TRANS-BNB-481923"
              [(ngModel)]="paymentReference"
              [disabled]="submittingPayment()"
            />
          </div>

          @if (paymentError()) {
            <div class="alert danger">{{ paymentError() }}</div>
          }

          <div class="modal-actions">
            <button
              type="button"
              class="btn ghost"
              (click)="closePayModal()"
              [disabled]="submittingPayment()"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="btn primary"
              (click)="confirmPayment()"
              [disabled]="!paymentReference().trim() || submittingPayment()"
            >
              @if (submittingPayment()) {
                <span>Procesando...</span>
              } @else {
                <span>Confirmar pago</span>
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './estado-cuenta.component.scss',
})
export class EstadoCuentaComponent implements OnInit {
  @Input() tenantId?: string;
  @Input() showConsoleActions = false;

  private api = inject(PlataformaApi);
  private session = inject(SessionService);
  private route = inject(ActivatedRoute);

  invoices = signal<SubscriptionInvoice[]>([]);
  loading = signal(false);
  error = signal('');
  successMessage = signal('');
  downloadingId = signal<string | null>(null);

  payingInvoice = signal<SubscriptionInvoice | null>(null);
  paymentReference = signal('');
  submittingPayment = signal(false);
  paymentError = signal('');

  readonly effectiveTenantId = computed(() => {
    return this.tenantId || this.route.snapshot.paramMap.get('id') || undefined;
  });

  readonly isPlatformContext = computed(() => {
    return Boolean(this.effectiveTenantId()) && (this.showConsoleActions || this.session.can('subscriptions.write'));
  });

  readonly canRegisterPayment = computed(() => {
    return this.isPlatformContext() || this.session.can('subscriptions.write');
  });

  ngOnInit(): void {
    this.loadInvoices();
  }

  loadInvoices(): void {
    this.loading.set(true);
    this.error.set('');

    const targetId = this.effectiveTenantId();
    let req;
    if (targetId) {
      req = typeof this.api.tenantInvoices === 'function' ? this.api.tenantInvoices(targetId) : of([]);
    } else {
      req = typeof this.api.myInvoices === 'function' ? this.api.myInvoices() : of([]);
    }

    req.subscribe({
      next: (items) => {
        this.invoices.set(items || []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los comprobantes de suscripción.');
        this.loading.set(false);
      },
    });
  }

  formatPeriod(start: string, end: string): string {
    if (!start) return '';
    try {
      const dStart = new Date(start);
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const month = months[dStart.getUTCMonth()];
      const year = dStart.getUTCFullYear();
      return `${month} ${year}`;
    } catch {
      return `${start} – ${end}`;
    }
  }

  statusLabel(status: string): string {
    switch (status?.toLowerCase()) {
      case 'paid': return 'Pagado';
      case 'overdue': return 'Vencido';
      case 'issued': return 'Emitido';
      case 'void': return 'Anulado';
      default: return status || 'Emitido';
    }
  }

  statusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'paid': return 'ok';
      case 'overdue': return 'danger';
      case 'issued': return 'warn';
      default: return 'info';
    }
  }

  downloadPdf(inv: SubscriptionInvoice): void {
    if (this.downloadingId()) return;
    this.downloadingId.set(inv.id);

    this.api.downloadInvoicePdf(inv.id).subscribe({
      next: (blob) => {
        this.downloadingId.set(null);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comprobante-${inv.number}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.downloadingId.set(null);
        this.error.set(`No se pudo descargar el PDF del comprobante ${inv.number}.`);
      },
    });
  }

  openPayModal(inv: SubscriptionInvoice): void {
    this.payingInvoice.set(inv);
    this.paymentReference.set('');
    this.paymentError.set('');
  }

  closePayModal(): void {
    this.payingInvoice.set(null);
    this.paymentReference.set('');
    this.paymentError.set('');
  }

  confirmPayment(): void {
    const inv = this.payingInvoice();
    const ref = this.paymentReference().trim();
    const targetTenantId = this.effectiveTenantId() || inv?.tenant_id;

    if (!inv || !ref || !targetTenantId) return;

    this.submittingPayment.set(true);
    this.paymentError.set('');

    this.api.markInvoicePaid(targetTenantId, inv.id, ref).subscribe({
      next: (updated) => {
        this.submittingPayment.set(false);
        this.closePayModal();
        this.successMessage.set(`Pago registrado para ${inv.number} (Ref: ${ref}). Suscripción reactivada.`);
        this.loadInvoices();
        setTimeout(() => this.successMessage.set(''), 6000);
      },
      error: () => {
        this.submittingPayment.set(false);
        this.paymentError.set('Error al registrar el pago. Verifica los permisos de plataforma.');
      },
    });
  }
}
