import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { PlatformDashboard, GlobalUser, PlatformIntelligence } from '../domain/consola.models';
import { Plan } from '../domain/plan.models';
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
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn primary" routerLink="/admin/plataforma/empresas">🏢 + Nueva empresa</a>
        <a class="btn" routerLink="/admin/plataforma/planes">💳 + Nuevo plan</a>
        <a class="btn" routerLink="/admin/plataforma/equipo">🛡️ + Invitar superadmin</a>
        <a class="btn ghost" routerLink="/admin/plataforma/demo">🧪 Tienda demo</a>
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

      <!-- Sección de Inteligencia SaaS y Recomendaciones de Plataforma -->
      @if (intelligence(); as intel) {
        <div class="grid2" style="margin-top:14px;grid-template-columns:1.2fr 1fr">
          <div class="card" style="border:1px solid #c7d2fe;background:linear-gradient(180deg,#faf5ff 0%,#ffffff 100%)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <div>
                <h3 style="margin:0;color:#1e1b4b">Sugerencias de Crecimiento & Upsell SaaS</h3>
                <small class="muted">Detección automática de clientes listos para escalar plan</small>
              </div>
              <span class="badge ok" style="font-size:11px">IA Plataforma</span>
            </div>
            @if (intel.upgrade_recommendations.length === 0) {
              <p class="muted">Todas las empresas operan con holgura respecto a sus límites actuales.</p>
            } @else {
              <div style="display:grid;gap:10px">
                @for (u of intel.upgrade_recommendations; track u.tenant_id + u.reason) {
                  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                      <b>{{ u.trade_name }}</b>
                      <span class="badge" [class.warn]="u.urgency === 'ALTA'" [class.info]="u.urgency === 'MEDIA'">
                        {{ u.recommended_plan }}
                      </span>
                    </div>
                    <p style="margin:4px 0 6px;font-size:12.5px;color:#475569">{{ u.reason }}</p>
                    <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f1f5f9;padding-top:6px">
                      <small style="color:#047857;font-weight:600">{{ u.potential_impact }}</small>
                      <a class="btn sm ghost" [routerLink]="['/admin/plataforma/empresas', u.tenant_id]">Ver empresa →</a>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <h3 style="margin:0">Mayor Consumo y Saturación</h3>
              <small class="muted">Límites y cuotas de uso</small>
            </div>
            <table class="tbl">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Consumo</th>
                  <th>Saturación</th>
                </tr>
              </thead>
              <tbody>
                @for (c of intel.top_consumers; track c.tenant_id + c.consumption_type) {
                  <tr>
                    <td>
                      <b>{{ c.trade_name }}</b>
                      <span class="sub">{{ c.plan_name }}</span>
                    </td>
                    <td style="font-size:12px">{{ c.metric_value }}</td>
                    <td>
                      <span class="badge" [class.danger]="c.saturation_pct >= 85" [class.warn]="c.saturation_pct >= 60 && c.saturation_pct < 85" [class.ok]="c.saturation_pct < 60">
                        {{ c.saturation_pct }}%
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            <h4 style="margin:16px 0 8px;font-size:13px">Hojas de Ruta Recomendadas por IA</h4>
            <div style="display:grid;gap:6px">
              @for (f of intel.feature_recommendations; track f.feature_code) {
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:12px">
                  <div style="display:flex;justify-content:space-between">
                    <b>{{ f.title }}</b>
                    <span class="muted">{{ f.target_tenants_count }} empresas candidatas</span>
                  </div>
                  <span style="color:#64748b">{{ f.description }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <div class="grid2" style="margin-top:14px">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 style="margin:0">Planes de suscripción</h3>
            <a routerLink="/admin/plataforma/planes" class="btn sm">Gestionar planes →</a>
          </div>
          @if (plans().length === 0) {
            <p class="muted">No hay planes registrados o cargando…</p>
          } @else {
            <table class="tbl">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Precio</th>
                  <th>Empresas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (p of plans(); track p.id) {
                  <tr>
                    <td><b>{{ p.name }}</b> <span class="sub">{{ p.code }}</span></td>
                    <td>Bs {{ p.reference_price }} <small class="muted">/ {{ p.duration_days }}d</small></td>
                    <td>{{ p.tenants_count }}</td>
                    <td>
                      <span class="badge" [class.ok]="p.is_active" [class.neutral]="!p.is_active">
                        {{ p.is_active ? 'Activo' : 'Inactivo' }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>

        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 style="margin:0">Superadministradores</h3>
            <a routerLink="/admin/plataforma/equipo" class="btn sm">Gestionar equipo →</a>
          </div>
          @if (admins().length === 0) {
            <p class="muted">No hay administradores registrados o cargando…</p>
          } @else {
            <table class="tbl">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (adm of admins(); track adm.id) {
                  <tr>
                    <td><b>{{ adm.first_name }} {{ adm.last_name }}</b></td>
                    <td class="mono" style="font-size:12px">{{ adm.email }}</td>
                    <td>
                      <span class="badge" [class.ok]="adm.is_active" [class.neutral]="!adm.is_active">
                        {{ adm.is_active ? 'Activo' : 'Inactivo' }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
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
  readonly intelligence = signal<PlatformIntelligence | null>(null);
  readonly plans = signal<Plan[]>([]);
  readonly admins = signal<GlobalUser[]>([]);
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

    if (this.api.platformIntelligence) {
      this.api.platformIntelligence().subscribe({
        next: (intel) => this.intelligence.set(intel),
        error: () => {},
      });
    }

    if (this.api.plans) {
      this.api.plans(true).subscribe({
        next: (p) => this.plans.set(p),
        error: () => {},
      });
    }

    if (this.api.admins) {
      this.api.admins().subscribe({
        next: (a) => this.admins.set(a),
        error: () => {},
      });
    }
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
