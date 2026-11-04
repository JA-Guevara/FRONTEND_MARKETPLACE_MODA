import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { PlatformDashboard } from '../domain/consola.models';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';
import { UsageMeterComponent } from '../../../shared/ui/usage-meter.component';

@Component({
  selector: 'fs-tablero-plataforma',
  standalone: true,
  imports: [CommonModule, RouterLink, KpiCardComponent, UsageMeterComponent],
  template: `
    <div class="crumbs">Plataforma SaaS</div>
    <div class="page-h">
      <div>
        <h1>Tablero de la plataforma</h1>
        <p>
          @if (dashboard(); as d) {
            Estado del negocio SaaS · {{ d.tenants.active + d.tenants.inactive + d.tenants.suspended }} empresas registradas.
          } @else {
            Cargando indicadores de la plataforma…
          }
        </p>
      </div>
      <div class="acts">
        <a class="btn primary" routerLink="/admin/plataforma/empresas">＋ Nueva empresa</a>
      </div>
    </div>

    @if (loading()) {
      <div class="card"><p class="muted">Cargando métricas del negocio…</p></div>
    } @else if (error()) {
      <div class="alert danger"><span>⚠</span><div>{{ error() }}</div></div>
    } @else if (dashboard(); as d) {
      <div class="grid4">
        <fs-kpi-card
          label="Ingreso mensual estimado"
          [value]="formatCurrency(d.mrr_estimate)"
          hint="Estimación activa del mes"
        />
        <fs-kpi-card
          label="Empresas activas"
          [value]="d.tenants.active"
          [hint]="d.tenants.suspended + ' suspendida · ' + d.tenants.inactive + ' inactiva'"
        />
        <fs-kpi-card
          label="Por vencer en 7 días"
          [value]="d.tenants.expiring_7d"
          hint="Renovar o avisar"
          tone="warn"
        />
        <fs-kpi-card
          label="Uso cerca del límite"
          [value]="d.tenants.near_limit"
          hint="Candidatas a Profesional"
          tone="info"
        />
      </div>

      <div class="grid2" style="margin-top:14px;grid-template-columns:1.4fr 1fr">
        <div class="card">
          <h3>Altas de empresas por mes</h3>
          <div class="bars">
            @for (m of d.signups_by_month; track m.month; let last = $last) {
              <div class="bar-col">
                <div
                  class="bar-fill"
                  [class.current]="last"
                  [style.height.px]="calcBarHeight(m.count, maxSignups())"
                  [title]="m.count + ' altas en ' + m.month"
                ></div>
                <span class="muted" style="font-size:11px">{{ formatMonth(m.month) }}</span>
              </div>
            }
          </div>
        </div>

        <div class="card">
          <h3>Distribución por plan</h3>
          <div class="dist-bar">
            @for (slice of d.plan_distribution; track slice.plan_code; let idx = $index) {
              <i
                [style.width.%]="calcPlanPercent(slice.tenants, d.tenants.active)"
                [style.background]="idx === 0 ? 'var(--accent, #4f46e5)' : 'var(--accent-line, #93c5fd)'"
                [title]="slice.plan_name + ': ' + slice.tenants + ' empresas'"
              ></i>
            }
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px">
            @for (slice of d.plan_distribution; track slice.plan_code) {
              <span><b>{{ slice.plan_name }}</b> · {{ slice.tenants }} empresas</span>
            }
          </div>

          <h3 style="margin-top:18px">Consumo agregado del mes</h3>
          <div style="display:grid;gap:10px;margin-top:10px">
            <fs-usage-meter
              label="Sucursales activas"
              [used]="d.usage.active_branches"
              [limit]="d.usage.branch_capacity"
            />
            <fs-usage-meter
              label="Reportes con IA"
              [used]="d.usage.ai_reports_month"
              [limit]="1000"
            />
            <fs-usage-meter
              label="Pruebas del probador IA"
              [used]="d.usage.tryon_jobs_month"
              [limit]="3000"
            />
          </div>
        </div>
      </div>

      <div class="grid2" style="margin-top:14px">
        <div class="card">
          <h3>Requieren atención</h3>
          @if (d.attention.length === 0) {
            <p class="muted" style="margin-top:8px">No hay alertas pendientes en este momento.</p>
          } @else {
            <table class="tbl" style="margin-top:8px">
              <tbody>
                @for (item of d.attention; track item.tenant_id + item.kind) {
                  <tr>
                    <td>
                      <b>{{ item.trade_name }}</b>
                      <span class="sub">{{ item.detail }}</span>
                    </td>
                    <td>
                      <span
                        class="badge"
                        [class.warn]="item.kind === 'expiring'"
                        [class.danger]="item.kind === 'suspended' || item.kind === 'at_limit'"
                      >
                        {{ kindLabel(item.kind) }}
                      </span>
                    </td>
                    <td style="text-align:right">
                      <a class="btn sm" [routerLink]="['/admin/plataforma/empresas', item.tenant_id]">
                        {{ kindAction(item.kind) }}
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>

        <div class="card">
          <h3>Actividad reciente de la plataforma</h3>
          @if (d.recent_activity.length === 0) {
            <p class="muted" style="margin-top:12px">No hay actividad registrada reciente.</p>
          } @else {
            <ul class="tl" style="margin-top:12px">
              @for (act of d.recent_activity; track act.id) {
                <li>
                  <b>{{ act.action }}</b>
                  @if (act.tenant_name) {
                    · {{ act.tenant_name }}
                  }
                  <small>{{ act.description }} · {{ act.created_at | date:'short' }}</small>
                </li>
              }
            </ul>
          }
        </div>
      </div>
    }
  `,
  styleUrl: './tablero-plataforma.component.scss',
})
export class TableroPlataformaComponent implements OnInit {
  private api = inject(PlataformaApi);

  readonly dashboard = signal<PlatformDashboard | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly maxSignups = computed(() => {
    const list = this.dashboard()?.signups_by_month ?? [];
    return Math.max(1, ...list.map((m) => m.count));
  });

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.error.set(null);
    this.api.dashboard().subscribe({
      next: (d) => {
        this.dashboard.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo cargar el tablero.');
        this.loading.set(false);
      },
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2,
    }).format(value);
  }

  formatMonth(m: string): string {
    if (!m) return '';
    const parts = m.split('-');
    if (parts.length < 2) return m;
    const mes = parseInt(parts[1], 10);
    const nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return nombres[mes - 1] ?? m;
  }

  calcBarHeight(count: number, max: number): number {
    return Math.max(8, Math.round((count / max) * 110));
  }

  calcPlanPercent(tenants: number, total: number): number {
    return total > 0 ? Math.round((tenants / total) * 100) : 0;
  }

  kindLabel(kind: string): string {
    switch (kind) {
      case 'expiring':
        return 'Por vencer';
      case 'at_limit':
        return 'Al límite';
      case 'suspended':
        return 'Suspendida';
      default:
        return kind;
    }
  }

  kindAction(kind: string): string {
    switch (kind) {
      case 'expiring':
        return 'Renovar';
      case 'at_limit':
        return 'Ver 360°';
      case 'suspended':
        return 'Reactivar';
      default:
        return 'Ver';
    }
  }
}
