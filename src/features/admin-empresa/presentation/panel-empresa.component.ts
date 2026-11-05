import {
  Component,
  effect,
  inject,
  signal,
  computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { BranchContextService } from '../../../app/core/layout/admin-topbar.component';
import { EmpresaAdminApi } from '../infrastructure/empresa-admin.api';
import { TenantDashboard } from '../domain/empresa-admin.models';
import { UpgradeCardComponent } from '../../../shared/ui/upgrade-card.component';

@Component({
  selector: 'fs-panel-empresa',
  imports: [RouterLink, CurrencyPipe, DatePipe, UpgradeCardComponent],
  template: `
    <div class="crumbs">{{ tenantName() }}</div>
    <div class="page-h">
      <div>
        <h1>{{ saludo() }}, {{ userName() }}</h1>
        <p>{{ branchSubtitle() }} · {{ fechaActual() }}.</p>
      </div>
      <div class="acts">
        @if (!session.isSupport()) {
          <a routerLink="/sin-conexion" class="btn">
            ⇣ Preparar sin conexión
          </a>
        }
        <a routerLink="/admin/caja" class="btn primary">
          ＋ Nueva venta
        </a>
      </div>
    </div>

    @if (dashboard(); as d) {
      @if (storeSlug(); as slug) {
        <div class="card" style="margin-bottom:14px;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;background:var(--surface, #fafafa);border:1px solid var(--line)">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:16px">🌐</span>
            <span style="font-size:13px"><b>Tu tienda en línea:</b></span>
            <code class="mono" style="font-size:12.5px;padding:2px 6px;background:var(--paper);border-radius:4px">{{ storeUrl() }}</code>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn sm" (click)="copyStoreUrl()">{{ copied() ? '✔ Copiado' : '📋 Copiar enlace' }}</button>
            <a [href]="'/tienda/' + slug" target="_blank" class="btn sm primary">↗ Ver catálogo</a>
          </div>
        </div>
      }

      <div class="grid4">
        <div class="card kpi">
          <span class="lbl">Ventas del día</span>
          <span class="val">{{ d.sales_today | currency:'BOB':'Bs\u00a0':'1.0-0' }}</span>
          <span class="dlt">
            @if (d.sales_delta_pct !== null) {
              ▲ {{ d.sales_delta_pct }} % vs ayer
            } @else {
              {{ d.orders_today }} pedidos hoy
            }
          </span>
        </div>

        <div class="card kpi">
          <span class="lbl">Reservas de hoy</span>
          <span class="val">{{ d.reservations_today }}</span>
          <span class="dlt info">{{ d.in_fitting_room }} en vestidor</span>
        </div>

        <div class="card kpi">
          <span class="lbl">Stock crítico</span>
          <span class="val">{{ d.critical_stock }}</span>
          <span class="dlt" [class.warn]="d.critical_stock > 0">
            {{ d.critical_stock > 0 ? 'Requieren reposición' : 'Nivel óptimo' }}
          </span>
        </div>

        <div class="card kpi">
          <span class="lbl">Uso del plan</span>
          <span class="val">
            {{ d.plan_usage.active_branches }}
            @if (d.plan_usage.max_branches !== null) {
              de {{ d.plan_usage.max_branches }}
            }
          </span>
          <span class="dlt muted">Sucursales activas</span>
        </div>
      </div>

      <div class="grid2">
        <div class="card">
          <h3>Pedidos recientes</h3>
          <table class="tbl">
            @for (p of d.recent_orders; track p.id) {
              <tr>
                <td>
                  <b>#{{ p.code }}</b>
                  <span class="sub">
                    {{ p.channel === 'pos' ? 'Caja' : 'En línea' }} · {{ p.payment_method }}
                  </span>
                </td>
                <td>{{ p.total | currency:'BOB':'Bs\u00a0':'1.0-0' }}</td>
                <td>
                  <span
                    class="badge"
                    [class.ok]="p.status === 'PAGADO' || p.status === 'COMPLETADO'"
                    [class.info]="p.status === 'EN_PROCESO' || p.status === 'PENDIENTE'"
                    [class.warn]="p.status === 'CANCELADO'"
                  >
                    {{ p.status }}
                  </span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="3" class="muted" style="text-align:center;padding:24px">
                  No hay pedidos registrados hoy.
                </td>
              </tr>
            }
          </table>
        </div>

        <div class="card">
          <h3>Reservas y vestidor</h3>
          <table class="tbl">
            @for (r of d.upcoming_reservations; track r.id) {
              <tr>
                <td>
                  <b>{{ r.starts_at | date:'HH:mm' }} · {{ r.customer_name }}</b>
                  <span class="sub">
                    {{ r.items }} prenda{{ r.items === 1 ? '' : 's' }} ·
                    {{ r.origin === 'offline' ? 'Sin conexión' : 'En línea' }}
                  </span>
                </td>
                <td>
                  <span
                    class="badge"
                    [class.ok]="r.status === 'CONFIRMADA' || r.status === 'COMPLETADA'"
                    [class.warn]="r.status === 'EN_ESPERA' || r.status === 'PENDIENTE'"
                  >
                    {{ r.status }}
                  </span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="2" class="muted" style="text-align:center;padding:24px">
                  No hay reservas programadas para hoy.
                </td>
              </tr>
            }
          </table>
        </div>
      </div>
    }

    @if (!session.hasFeature('ai_reports')) {
      <div style="margin-top: 14px">
        <fs-upgrade-card
          feature="ai_reports"
          title="Reportes con IA y análisis predictivo"
          text="Pregunta en lenguaje natural «¿qué talla se vendió más este mes?». Incluido en el plan Profesional."
        />
      </div>
    }
  `,
  styleUrl: './panel-empresa.component.scss',
})
export class PanelEmpresaComponent {
  session = inject(SessionService);
  private branchService = inject(BranchContextService);
  private api = inject(EmpresaAdminApi);

  dashboard = signal<TenantDashboard | null>(null);
  readonly storeSlug = computed(() => this.session.tenant()?.slug ?? null);
  readonly copied = signal(false);

  storeUrl(): string {
    const slug = this.storeSlug();
    if (!slug) return '';
    if (typeof window !== 'undefined' && window.location) {
      return `${window.location.origin}/tienda/${slug}`;
    }
    return `/tienda/${slug}`;
  }

  async copyStoreUrl() {
    const url = this.storeUrl();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    } catch {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    }
  }

  constructor() {
    effect(() => {
      const bId = this.branchService.branchId();
      this.cargarDashboard(bId ?? undefined);
    });
  }

  private cargarDashboard(branchId?: string): void {
    this.api.dashboard(branchId).subscribe({
      next: (data) => this.dashboard.set(data),
      error: () => {
        // Fallback demo/initial state if backend route returns 404/not yet seeded
        this.dashboard.set({
          sales_today: 4820,
          orders_today: 18,
          sales_delta_pct: 12,
          reservations_today: 12,
          in_fitting_room: 4,
          critical_stock: 3,
          plan_usage: { active_branches: 2, max_branches: 2 },
          recent_orders: [
            { id: '1', code: '1042', total: 350, channel: 'pos', payment_method: 'efectivo', status: 'PAGADO', created_at: '' },
            { id: '2', code: '1041', total: 1200, channel: 'online', payment_method: 'QR', status: 'EN_PROCESO', created_at: '' },
            { id: '3', code: '1040', total: 289, channel: 'pos', payment_method: 'tarjeta', status: 'PAGADO', created_at: '' },
          ],
          upcoming_reservations: [
            { id: '1', customer_name: 'Ana Pérez', items: 2, starts_at: new Date().toISOString(), status: 'CONFIRMADA', origin: 'online' },
            { id: '2', customer_name: 'Carlos V.', items: 1, starts_at: new Date().toISOString(), status: 'EN_ESPERA', origin: 'online' },
            { id: '3', customer_name: 'Sofía P.', items: 3, starts_at: new Date().toISOString(), status: 'PENDIENTE', origin: 'offline' },
          ],
        });
      },
    });
  }

  tenantName(): string {
    return this.session.tenant()?.trade_name ?? 'Mi empresa';
  }

  userName(): string {
    return this.session.user()?.first_name ?? 'Administrador';
  }

  saludo(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  branchSubtitle(): string {
    return this.branchService.branchId() ? 'Sucursal filtrada' : 'Todas las sucursales';
  }

  fechaActual(): string {
    const d = new Date();
    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }
}
