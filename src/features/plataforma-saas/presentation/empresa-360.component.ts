import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { Tenant, ActivityItem } from '../domain/empresa.models';
import { TenantOverview, GlobalUser, BranchSummary, maskEmail } from '../domain/consola.models';
import { SupportSession } from '../domain/soporte.models';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';
import { UsageMeterComponent } from '../../../shared/ui/usage-meter.component';
import { IniciarSoporteDialogComponent } from './iniciar-soporte-dialog.component';
import { SuscripcionEmpresaComponent } from './suscripcion-empresa.component';

@Component({
  selector: 'fs-empresa-360',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    KpiCardComponent,
    UsageMeterComponent,
    IniciarSoporteDialogComponent,
    SuscripcionEmpresaComponent,
  ],
  template: `
    @if (loading() && !tenant()) {
      <div class="card"><p class="muted">Cargando información 360° de la empresa…</p></div>
    } @else if (error()) {
      <div class="alert danger"><span>⚠</span><div>{{ error() }}</div></div>
    } @else if (tenant(); as t) {
      <div class="crumbs">
        <a routerLink="/admin/plataforma">Plataforma SaaS</a> /
        <a routerLink="/admin/plataforma/empresas">Empresas</a> /
        {{ t.trade_name }}
      </div>

      <div class="page-h">
        <div style="display:flex;gap:14px;align-items:center">
          <span class="logo-t" style="background:#2f5f8a;width:52px;height:52px;font-size:18px">
            {{ getInitials(t.trade_name) }}
          </span>
          <div>
            <h1>{{ t.trade_name }}</h1>
            <p class="mono" style="margin:2px 0 0">
              NIT {{ t.tax_id }} · /{{ t.slug }} · admin: {{ maskEmail(t.contact_email || t.admin_email || '') }}
            </p>
          </div>
        </div>

        <div class="acts">
          <span
            class="badge"
            [class.ok]="t.status === 'ACTIVA' && t.subscription_status !== 'SUSPENDIDA'"
            [class.danger]="t.status === 'INACTIVA' || t.subscription_status === 'SUSPENDIDA'"
          >
            {{ t.status === 'INACTIVA' ? 'Inactiva' : (t.subscription_status === 'SUSPENDIDA' ? 'Suspendida' : 'Activa') }}
          </span>
          <span class="badge plan">{{ t.plan_name || 'Básico' }}</span>
          <button class="btn" (click)="resendInvitation()" [disabled]="actionLoading()">
            ✉ Reenviar invitación
          </button>
          <button class="btn" (click)="toggleSuspension()" [disabled]="actionLoading()">
            {{ t.status === 'ACTIVA' ? '⏸ Suspender' : '▶ Reactivar' }}
          </button>
          <button class="btn primary" (click)="supportOpen.set(true)">
            ⛑ Asistir a esta empresa
          </button>
        </div>
      </div>

      @if (actionNotice()) {
        <div class="alert info" style="margin-bottom:12px"><span>ⓘ</span><div>{{ actionNotice() }}</div></div>
      }

      <div class="tabs">
        <a [class.on]="activeTab() === 'resumen'" (click)="setTab('resumen')">Resumen</a>
        <a [class.on]="activeTab() === 'suscripcion'" (click)="setTab('suscripcion')">Suscripción</a>
        <a [class.on]="activeTab() === 'sucursales'" (click)="setTab('sucursales')">Sucursales</a>
        <a [class.on]="activeTab() === 'usuarios'" (click)="setTab('usuarios')">Usuarios</a>
        <a [class.on]="activeTab() === 'uso'" (click)="setTab('uso')">Uso</a>
        <a [class.on]="activeTab() === 'actividad'" (click)="setTab('actividad')">Actividad</a>
        <a [class.on]="activeTab() === 'soporte'" (click)="setTab('soporte')">Soporte</a>
      </div>

      <!-- Tab: Resumen -->
      @if (activeTab() === 'resumen') {
        @if (overview(); as o) {
          <div class="grid4">
            <fs-kpi-card
              label="Ventas 30 días"
              [value]="formatCurrency(o.sales_30d)"
              hint="Facturado en el período"
            />
            <fs-kpi-card
              label="Pedidos 30 días"
              [value]="o.orders_30d"
              [hint]="o.online_orders_30d + ' en línea · ' + o.pos_orders_30d + ' caja'"
            />
            <fs-kpi-card
              label="Reservas 30 días"
              [value]="o.reservations_30d"
              [hint]="o.offline_reservations_30d + ' sin conexión'"
              tone="info"
            />
            <fs-kpi-card
              label="Usuarios activos"
              [value]="o.active_users"
              [hint]="formatRolesHint(o.users_by_role)"
            />
          </div>

          <div class="grid2" style="margin-top:14px">
            <div class="card">
              <h3>Cuotas del plan {{ t.plan_name || 'Básico' }}</h3>
              <div style="display:grid;gap:12px;margin-top:12px">
                @for (q of o.quotas; track q.code) {
                  <fs-usage-meter
                    [label]="q.label"
                    [used]="q.used"
                    [limit]="q.limit ?? 0"
                  />
                }
              </div>
            </div>

            <div class="card">
              <h3>Actividad reciente</h3>
              <ul class="tl" style="margin-top:12px">
                @for (act of recentActivity(); track $index) {
                  <li>
                    <b>{{ act.action }}</b>
                    <small>{{ act.description || '' }} · {{ act.created_at | date:'short' }}</small>
                  </li>
                } @empty {
                  <li class="muted">No hay eventos recientes registrados.</li>
                }
              </ul>
            </div>
          </div>
        }
      }

      <!-- Tab: Suscripción -->
      @if (activeTab() === 'suscripcion') {
        <fs-suscripcion-empresa />
      }

      <!-- Tab: Sucursales -->
      @if (activeTab() === 'sucursales') {
        <div class="card" style="padding:0">
          <table class="tbl">
            <thead>
              <tr>
                <th>Sucursal</th>
                <th>Ciudad</th>
                <th>Cajas registradoras</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (b of branches(); track b.id) {
                <tr>
                  <td><b>{{ b.name }}</b></td>
                  <td>{{ b.city_name }}</td>
                  <td>{{ b.cash_points }} caja(s)</td>
                  <td>
                    <span class="badge" [class.ok]="b.is_active" [class.neutral]="!b.is_active">
                      {{ b.is_active ? 'Activa' : 'Inactiva' }}
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="muted" style="text-align:center;padding:16px">No hay sucursales registradas.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Tab: Usuarios -->
      @if (activeTab() === 'usuarios') {
        <div class="alert info" style="margin-bottom:12px">
          <span>ⓘ</span>
          <div>
            <b>Vista de consulta.</b>Para crear, editar o bloquear usuarios de esta empresa inicia una sesión de soporte. Desbloquear y reenviar verificación sí están disponibles desde «Usuarios globales».
          </div>
        </div>

        <div class="card" style="padding:0">
          <table class="tbl">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
              </tr>
            </thead>
            <tbody>
              @for (u of users(); track u.id) {
                <tr>
                  <td>
                    <div style="display:flex;gap:10px;align-items:center">
                      <span class="av">{{ getInitials(u.first_name + ' ' + u.last_name) }}</span>
                      <div>
                        <b>{{ u.first_name }} {{ u.last_name }}</b>
                        <span class="sub mono">{{ maskEmail(u.email) }}</span>
                      </div>
                    </div>
                  </td>
                  <td>{{ u.roles.join(', ') || 'Sin rol' }}</td>
                  <td>
                    <span
                      class="badge"
                      [class.ok]="u.is_active && !u.locked_until"
                      [class.warn]="!!u.locked_until"
                      [class.neutral]="!u.is_active"
                    >
                      {{ u.locked_until ? 'Bloqueado' : (u.is_active ? 'Activo' : 'Inactivo') }}
                    </span>
                  </td>
                  <td class="muted">{{ u.last_login_at ? (u.last_login_at | date:'short') : '—' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="muted" style="text-align:center;padding:16px">No hay usuarios registrados.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Tab: Uso -->
      @if (activeTab() === 'uso') {
        <div class="card">
          <h3>Consumo y cuotas detalladas</h3>
          @if (overview(); as o) {
            <div style="display:grid;gap:14px;margin-top:14px">
              @for (q of o.quotas; track q.code) {
                <fs-usage-meter
                  [label]="q.label"
                  [used]="q.used"
                  [limit]="q.limit ?? 0"
                />
              }
            </div>
          }
        </div>
      }

      <!-- Tab: Actividad -->
      @if (activeTab() === 'actividad') {
        <div class="card">
          <h3>Historial de actividad de la empresa</h3>
          <ul class="tl" style="margin-top:14px">
            @for (act of recentActivity(); track $index) {
              <li>
                <b>{{ act.action }}</b>
                <small>{{ act.description || '' }} · {{ act.created_at | date:'short' }}</small>
              </li>
            } @empty {
              <li class="muted">No hay actividad registrada.</li>
            }
          </ul>
        </div>
      }

      <!-- Tab: Soporte -->
      @if (activeTab() === 'soporte') {
        <div class="card" style="padding:0">
          <div style="padding:16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line, #e2e8f0)">
            <div>
              <h3 style="margin:0">Sesiones de soporte a esta empresa</h3>
              <p class="muted" style="margin:4px 0 0;font-size:12.5px">Historial de accesos autorizados realizados por personal de la plataforma.</p>
            </div>
            <button class="btn primary" (click)="supportOpen.set(true)">
              ⛑ Iniciar nueva sesión de soporte
            </button>
          </div>

          <table class="tbl">
            <thead>
              <tr>
                <th>Quién</th>
                <th>Motivo</th>
                <th>Inicio</th>
                <th>Duración</th>
                <th>Acciones</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (s of supportSessions(); track s.id) {
                <tr>
                  <td>
                    <b>{{ s.platform_user_name || 'Super administrador' }}</b>
                  </td>
                  <td>{{ s.reason }}</td>
                  <td class="muted">{{ s.started_at | date:'short' }}</td>
                  <td>{{ s.duration_minutes }} min</td>
                  <td>{{ s.actions_count }} cambio(s)</td>
                  <td>
                    <span class="badge" [class.ok]="s.is_active" [class.neutral]="!s.is_active">
                      {{ s.is_active ? 'Activa' : 'Terminada' }}
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="muted" style="text-align:center;padding:16px">No hay sesiones de soporte para esta empresa.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (supportOpen()) {
        <fs-iniciar-soporte-dialog
          [tenant]="{ id: tenantId, trade_name: t.trade_name }"
          (closed)="supportOpen.set(false); loadSupportSessions()"
        />
      }
    }
  `,
  styleUrl: './empresa-360.component.scss',
})
export class Empresa360Component implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(PlataformaApi);

  readonly tenantId = this.route.snapshot.paramMap.get('id') || '';
  readonly activeTab = signal<'resumen' | 'suscripcion' | 'sucursales' | 'usuarios' | 'uso' | 'actividad' | 'soporte'>('resumen');

  readonly tenant = signal<Tenant | null>(null);
  readonly overview = signal<TenantOverview | null>(null);
  readonly recentActivity = signal<ActivityItem[]>([]);
  readonly branches = signal<BranchSummary[]>([]);
  readonly users = signal<GlobalUser[]>([]);
  readonly supportSessions = signal<SupportSession[]>([]);

  readonly loading = signal(true);
  readonly actionLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionNotice = signal<string | null>(null);
  readonly supportOpen = signal(false);

  readonly maskEmail = maskEmail;

  ngOnInit() {
    this.route.queryParamMap.subscribe((params) => {
      const tabParam = params.get('tab') as any;
      if (tabParam && ['resumen', 'suscripcion', 'sucursales', 'usuarios', 'uso', 'actividad', 'soporte'].includes(tabParam)) {
        this.activeTab.set(tabParam);
      }
    });

    this.cargarBase();
  }

  setTab(tab: 'resumen' | 'suscripcion' | 'sucursales' | 'usuarios' | 'uso' | 'actividad' | 'soporte') {
    this.activeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'resumen' ? null : tab },
      queryParamsHandling: 'merge',
    });

    if (tab === 'sucursales' && !this.branches().length) this.loadBranches();
    if (tab === 'usuarios' && !this.users().length) this.loadUsers();
    if (tab === 'soporte' && !this.supportSessions().length) this.loadSupportSessions();
  }

  cargarBase() {
    this.loading.set(true);
    this.error.set(null);

    this.api.tenant(this.tenantId).subscribe({
      next: (t) => {
        this.tenant.set(t);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo cargar la información de la empresa.');
        this.loading.set(false);
      },
    });

    this.api.tenantOverview(this.tenantId).subscribe({
      next: (o) => this.overview.set(o),
      error: () => {},
    });

    this.api.tenantActivity(this.tenantId).subscribe({
      next: (act) => this.recentActivity.set(act),
      error: () => {},
    });

    if (this.activeTab() === 'sucursales') this.loadBranches();
    if (this.activeTab() === 'usuarios') this.loadUsers();
    if (this.activeTab() === 'soporte') this.loadSupportSessions();
  }

  loadBranches() {
    this.api.tenantBranches(this.tenantId).subscribe({
      next: (b) => this.branches.set(b),
      error: () => {},
    });
  }

  loadUsers() {
    this.api.tenantUsers(this.tenantId).subscribe({
      next: (p) => this.users.set(p.items),
      error: () => {},
    });
  }

  loadSupportSessions() {
    this.api.supportSessions({ tenant_id: this.tenantId }).subscribe({
      next: (p) => this.supportSessions.set(p.items),
      error: () => {},
    });
  }

  resendInvitation() {
    this.actionLoading.set(true);
    this.actionNotice.set(null);
    this.api.resendInvitation(this.tenantId).subscribe({
      next: () => {
        this.actionNotice.set('Invitación reenviada correctamente.');
        this.actionLoading.set(false);
      },
      error: (err) => {
        this.actionNotice.set(err?.error?.message ?? 'No se pudo reenviar la invitación.');
        this.actionLoading.set(false);
      },
    });
  }

  toggleSuspension() {
    const isActiva = this.tenant()?.status === 'ACTIVA';
    this.actionLoading.set(true);
    this.actionNotice.set(null);
    const req = isActiva
      ? this.api.deactivateTenant(this.tenantId, 'Suspensión administrativa desde consola')
      : this.api.activateTenant(this.tenantId);

    req.subscribe({
      next: (res: any) => {
        const updated = (res && 'data' in res) ? res.data : res;
        this.tenant.set(updated);
        this.actionNotice.set(isActiva ? 'Empresa suspendida.' : 'Empresa reactivada.');
        this.actionLoading.set(false);
      },
      error: (err) => {
        this.actionNotice.set(err?.error?.message ?? 'Error al modificar el estado.');
        this.actionLoading.set(false);
      },
    });
  }

  getInitials(name: string): string {
    if (!name) return 'FS';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2,
    }).format(value);
  }

  formatRolesHint(roles?: Record<string, number>): string {
    if (!roles) return 'Personal registrado';
    const parts = Object.entries(roles).map(([rol, cnt]) => `${cnt} ${rol}`);
    return parts.slice(0, 2).join(' · ') || 'Sin usuarios';
  }
}
