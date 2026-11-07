import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
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
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import {
  TenantModule,
  TenantModuleGrant,
  PlatformModule,
  TenantLimit,
  EffectiveTenantLimit,
  TenantRole,
  PermissionCatalogItem,
  etiquetaOrigen,
  vigencia,
} from '../domain/gobierno.models';
import { HabilitarModuloDialogComponent } from './habilitar-modulo-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { EmpresaFormComponent } from './empresa-form.component';
import { errorMessage } from '../../../shared/errors';

@Component({
  selector: 'fs-empresa-360',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HabilitarModuloDialogComponent,
    ConfirmDialogComponent,
    EmpresaFormComponent,
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
      <div class="alert danger">
        <span>⚠</span>
        <div>{{ error() }}</div>
      </div>
    } @else if (tenant(); as t) {
      <div class="crumbs">
        <a routerLink="/admin/plataforma">Plataforma SaaS</a> /
        <a routerLink="/admin/plataforma/empresas">Empresas</a> /
        {{ t.trade_name }}
      </div>

      <div class="page-h">
        <div style="display:flex;gap:14px;align-items:center">
          <span
            class="logo-t"
            style="background:var(--accent);color:var(--on-accent);width:52px;height:52px;font-size:18px"
          >
            {{ getInitials(t.trade_name) }}
          </span>
          <div>
            <h1>{{ t.trade_name }}</h1>
            <p class="mono" style="margin:2px 0 0">
              NIT {{ t.tax_id }} · /{{ t.slug }} · admin:
              {{ maskEmail(t.contact_email || t.admin_email || '') }}
            </p>
          </div>
        </div>

        <div class="acts">
          @if (session.can('platform.ops.read')) {
            <a class="btn" [routerLink]="['/admin/plataforma/empresas', t.id, 'datos']"
              >Datos y respaldos</a
            >
          }
          <span
            class="badge"
            [class.ok]="t.status === 'ACTIVA' && t.subscription_status !== 'SUSPENDIDA'"
            [class.danger]="t.status === 'INACTIVA' || t.subscription_status === 'SUSPENDIDA'"
          >
            {{
              t.status === 'INACTIVA'
                ? 'Inactiva'
                : t.subscription_status === 'SUSPENDIDA'
                  ? 'Suspendida'
                  : 'Activa'
            }}
          </span>
          <span class="badge plan">{{ t.plan_name || 'Básico' }}</span>
          @if (session.can('tenants.write')) {
            <button class="btn" (click)="editOpen.set(true)" title="Editar datos comerciales de la empresa">
              ✏ Editar datos
            </button>
          }
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
        <div class="alert info" style="margin-bottom:12px">
          <span>ⓘ</span>
          <div>{{ actionNotice() }}</div>
        </div>
      }

      <div class="tabs">
        <a [class.on]="activeTab() === 'resumen'" (click)="setTab('resumen')">Resumen</a>
        <a [class.on]="activeTab() === 'suscripcion'" (click)="setTab('suscripcion')"
          >Suscripción</a
        >
        <a [class.on]="activeTab() === 'modulos'" (click)="setTab('modulos')">Módulos</a>
        <a [class.on]="activeTab() === 'roles'" (click)="setTab('roles')">Roles</a>
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
                  <fs-usage-meter [label]="q.label" [used]="q.used" [limit]="q.limit ?? 0" />
                }
              </div>
            </div>

            <div class="card">
              <h3>Actividad reciente</h3>
              <ul class="tl" style="margin-top:12px">
                @for (act of recentActivity(); track $index) {
                  <li>
                    <b>{{ act.action }}</b>
                    <small
                      >{{ act.description || '' }} · {{ act.created_at | date: 'short' }}</small
                    >
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

      @if (activeTab() === 'modulos') {
        <div class="module-toolbar">
          <h2>Módulos de la empresa</h2>
          @if (session.can('subscriptions.write')) {
            <button class="primary" (click)="openGrant()">＋ Habilitar módulo</button>
          }
        </div>
        @if (moduleError()) {
          <p class="alert danger" role="alert">{{ moduleError() }}</p>
        }
        @if (modulesLoading()) {
          <p role="status">Cargando módulos y límites…</p>
        }
        <div class="card sp2-table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Módulo</th>
                <th>Origen</th>
                <th>Vigencia</th>
                <th>Motivo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (module of tenantModules(); track module.module_code) {
                <tr>
                  <td>
                    <b>{{ module.module_name }}</b
                    ><small class="sub"
                      >{{ module.effective ? 'Habilitado' : 'Sin acceso' }} ·
                      {{ module.lifecycle }}</small
                    >
                  </td>
                  <td>
                    <span
                      class="badge"
                      [class.warn]="module.origin === 'TRIAL'"
                      [class.danger]="module.is_blocked"
                      >{{ etiquetaOrigen(module) }}</span
                    >
                  </td>
                  <td>{{ vigencia(module) }}</td>
                  <td>{{ module.reason || '—' }}</td>
                  <td>
                    <div class="module-actions">
                      @if (session.can('subscriptions.write') && module.kind !== 'BASE') {
                        @if (module.is_blocked && module.id) {
                          <button (click)="requestAction(module, 'revoke')">Desbloquear</button>
                        } @else {
                          @if (module.id) {
                            <button (click)="requestAction(module, 'revoke')">Quitar</button>
                          }
                          <button (click)="requestAction(module, 'block')">Bloquear</button
                          ><button (click)="openGrant(module.module_code)">Dar prueba</button>
                        }
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">No hay módulos para mostrar.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <section class="card limits-card">
          <h3>Límites: plan y ajustes de esta empresa</h3>
          <p class="muted">Los ajustes tienen motivo y vigencia propios.</p>
          @if (limitError()) {
            <p class="alert danger" role="alert">{{ limitError() }}</p>
          }
          @for (limit of tenantLimits(); track limit.limit_code) {
            <article class="limit-row">
              <div>
                <b>{{ limit.limit_code }}: {{ limit.effective_value ?? 'Sin límite' }}</b>
                <small>
                  Plan: {{ limit.plan_value ?? 'Sin límite' }} ·
                  {{ limit.source === 'EMPRESA' ? 'Forzado por la empresa' : 'Valor del plan' }}
                  @if (limit.override_active && limit.override) {
                    · {{ limit.override.reason }} · {{ vigencia(limit.override) }}
                  }
                </small>
              </div>
              @if (limit.override_active && limit.override && session.can('subscriptions.write')) {
                <button (click)="requestLimitRemoval(limit.override!)">Quitar ajuste</button>
              }
            </article>
          } @empty {
            <p class="muted">No se pudieron consultar los límites de la empresa.</p>
          }
          @if (session.can('subscriptions.write')) {
            <div class="limit-form">
              <label
                >Límite<select [(ngModel)]="limitCode">
                  @for (limit of tenantLimits(); track limit.limit_code) {
                    <option [value]="limit.limit_code">
                      {{ etiquetaLimite(limit.limit_code) }}
                    </option>
                  }
                </select></label
              ><label>Valor<input type="number" [(ngModel)]="limitValue" min="1" step="1" /></label
              ><label
                >Días<input
                  type="number"
                  [(ngModel)]="limitDays"
                  min="1"
                  max="30"
                  step="1" /></label
              ><label>Motivo<input [(ngModel)]="limitReason" maxlength="300" /></label
              ><button [disabled]="moduleSaving()" (click)="saveLimit()">Fijar límite</button>
            </div>
          }
        </section>
      }
      @if (activeTab() === 'roles') {
        <h2>Roles propios de {{ t.trade_name }}</h2>
        <p class="muted">
          Los permisos se agrupan por módulo. Solo se modifica el rol de esta empresa.
        </p>
        @if (roleError()) {
          <p class="alert danger" role="alert">{{ roleError() }}</p>
        }
        @if (rolesLoading()) {
          <p role="status">Cargando roles…</p>
        }
        @for (role of tenantRoles(); track role.id) {
          <article class="card role-card">
            <header>
              <div>
                <h3>{{ role.name }}</h3>
                <p class="muted">{{ role.description || role.code }}</p>
              </div>
              @if (session.can('platform_roles.write')) {
                <button (click)="editRole(role)">Editar permisos</button>
              }
            </header>
            <p>{{ role.permissions.length }} permisos</p>
          </article>
        } @empty {
          <p>No hay roles de empresa para mostrar.</p>
        }
        @if (editingRole(); as role) {
          <section class="card">
            <h3>Permisos de {{ role.name }}</h3>
            @for (group of permissionGroups(); track group.code) {
              <fieldset>
                <legend>{{ group.name }}</legend>
                @for (permission of group.permissions; track permission.code) {
                  <label class="permission-check"
                    ><input
                      type="checkbox"
                      [checked]="selectedPermissions.includes(permission.code)"
                      (change)="togglePermission(permission.code)"
                      [disabled]="!permission.is_active"
                    /><code>{{ permission.code }}</code
                    ><span>{{ permission.name }}</span></label
                  >
                }
              </fieldset>
            }
            <div class="module-actions">
              <label class="role-reason"
                >Motivo del cambio
                <input
                  [(ngModel)]="roleReason"
                  maxlength="300"
                  placeholder="Explica por qué cambian los permisos"
                />
              </label>
              <button (click)="cancelRoleEdit()">Cancelar</button
              ><button class="primary" [disabled]="moduleSaving()" (click)="saveRole()">
                Guardar permisos
              </button>
            </div>
          </section>
        }
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
                  <td>
                    <b>{{ b.name }}</b>
                  </td>
                  <td>{{ b.city_name }}</td>
                  <td>{{ b.cash_points }} caja(s)</td>
                  <td>
                    <span class="badge" [class.ok]="b.is_active" [class.neutral]="!b.is_active">
                      {{ b.is_active ? 'Activa' : 'Inactiva' }}
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="muted" style="text-align:center;padding:16px">
                    No hay sucursales registradas.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Tab: Usuarios -->
      @if (activeTab() === 'usuarios') {
        <div class="module-toolbar">
          <h2>Usuarios</h2>
          @if (session.can('tenant_users.write')) {
            <button disabled title="El alta de usuarios para esta empresa aún no está disponible">
              ＋ Nuevo usuario
            </button>
          }
        </div>
        <div class="alert info" style="margin-bottom:12px">
          <span>ⓘ</span>
          <div>
            <b>Personal de esta empresa.</b>Las acciones de cuenta se gestionan desde «Usuarios
            globales».
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
                      {{ u.locked_until ? 'Bloqueado' : u.is_active ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td class="muted">
                    {{ u.last_login_at ? (u.last_login_at | date: 'short') : '—' }}
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="muted" style="text-align:center;padding:16px">
                    No hay usuarios registrados.
                  </td>
                </tr>
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
                <fs-usage-meter [label]="q.label" [used]="q.used" [limit]="q.limit ?? 0" />
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
                <small>{{ act.description || '' }} · {{ act.created_at | date: 'short' }}</small>
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
          <div
            style="padding:16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line, #e2e8f0)"
          >
            <div>
              <h3 style="margin:0">Sesiones de soporte a esta empresa</h3>
              <p class="muted" style="margin:4px 0 0;font-size:12.5px">
                Historial de accesos autorizados realizados por personal de la plataforma.
              </p>
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
                  <td class="muted">{{ s.started_at | date: 'short' }}</td>
                  <td>{{ s.duration_minutes }} min</td>
                  <td>{{ s.actions_count }} cambio(s)</td>
                  <td>
                    <span class="badge" [class.ok]="s.is_active" [class.neutral]="!s.is_active">
                      {{ s.is_active ? 'Activa' : 'Terminada' }}
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="muted" style="text-align:center;padding:16px">
                    No hay sesiones de soporte para esta empresa.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (grantOpen()) {
        <fs-habilitar-modulo-dialog
          [modules]="moduleCatalog()"
          [tenantName]="t.trade_name"
          [moduleCode]="grantCode"
          [busy]="moduleSaving()"
          [error]="grantError()"
          (closed)="grantOpen.set(false)"
          (confirmed)="grant($event)"
        />
      }
      @if (pendingAction(); as action) {
        <fs-confirm-dialog
          [open]="true"
          [title]="actionTitle(action)"
          message="Este cambio afecta únicamente a la empresa seleccionada y quedará registrado."
          [requireReason]="true"
          (confirmed)="confirmAction($event)"
          (cancelled)="pendingAction.set(null)"
        />
      }
      @if (supportOpen()) {
        <fs-iniciar-soporte-dialog
          [tenant]="{ id: tenantId, trade_name: t.trade_name }"
          (closed)="supportOpen.set(false); loadSupportSessions()"
        />
      }
      @if (editOpen()) {
        <fs-empresa-form
          [tenant]="t"
          (saved)="onTenantUpdated($event)"
          (closed)="editOpen.set(false)"
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
  session = inject(SessionService);

  readonly tenantId = this.route.snapshot.paramMap.get('id') || '';
  readonly activeTab = signal<
    | 'resumen'
    | 'suscripcion'
    | 'sucursales'
    | 'usuarios'
    | 'modulos'
    | 'roles'
    | 'uso'
    | 'actividad'
    | 'soporte'
  >('resumen');

  readonly tenant = signal<Tenant | null>(null);
  readonly overview = signal<TenantOverview | null>(null);
  readonly recentActivity = signal<ActivityItem[]>([]);
  readonly branches = signal<BranchSummary[]>([]);
  readonly users = signal<GlobalUser[]>([]);
  readonly supportSessions = signal<SupportSession[]>([]);

  readonly loading = signal(true);
  readonly actionLoading = signal(false);
  readonly editOpen = signal(false);
  readonly error = signal<string | null>(null);
  readonly actionNotice = signal<string | null>(null);
  readonly supportOpen = signal(false);

  readonly maskEmail = maskEmail;
  tenantModules = signal<TenantModule[]>([]);
  moduleCatalog = signal<PlatformModule[]>([]);
  tenantLimits = signal<EffectiveTenantLimit[]>([]);
  tenantRoles = signal<TenantRole[]>([]);
  permissions = signal<PermissionCatalogItem[]>([]);
  modulesLoading = signal(false);
  rolesLoading = signal(false);
  moduleSaving = signal(false);
  moduleError = signal('');
  limitError = signal('');
  roleError = signal('');
  grantOpen = signal(false);
  grantError = signal('');
  grantCode = '';
  editingRole = signal<TenantRole | null>(null);
  selectedPermissions: string[] = [];
  roleReason = '';
  pendingAction = signal<{
    kind: 'revoke' | 'block' | 'limit';
    id: string;
    code: string;
    name: string;
  } | null>(null);
  limitCode = '';
  limitValue = 1;
  limitDays = 7;
  limitReason = '';
  etiquetaOrigen = etiquetaOrigen;
  vigencia = vigencia;

  ngOnInit() {
    this.route.queryParamMap.subscribe((params) => {
      const tabParam = params.get('tab') as any;
      if (
        tabParam &&
        [
          'resumen',
          'suscripcion',
          'sucursales',
          'usuarios',
          'modulos',
          'roles',
          'uso',
          'actividad',
          'soporte',
        ].includes(tabParam)
      ) {
        this.activeTab.set(tabParam);
      }
    });

    this.cargarBase();
  }

  setTab(
    tab:
      | 'resumen'
      | 'suscripcion'
      | 'sucursales'
      | 'usuarios'
      | 'modulos'
      | 'roles'
      | 'uso'
      | 'actividad'
      | 'soporte',
  ) {
    this.activeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'resumen' ? null : tab },
      queryParamsHandling: 'merge',
    });

    if (tab === 'modulos') void this.loadModules();
    if (tab === 'roles') void this.loadRoles();
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

    if (this.activeTab() === 'modulos') void this.loadModules();
    if (this.activeTab() === 'roles') void this.loadRoles();
    if (this.activeTab() === 'sucursales') this.loadBranches();
    if (this.activeTab() === 'usuarios') this.loadUsers();
    if (this.activeTab() === 'soporte') this.loadSupportSessions();
  }

  async loadModules() {
    this.modulesLoading.set(true);
    this.moduleError.set('');
    this.limitError.set('');
    const [modules, catalog, limits] = await Promise.allSettled([
      firstValueFrom(this.api.tenantModules(this.tenantId)),
      firstValueFrom(this.api.modules()),
      firstValueFrom(this.api.tenantLimits(this.tenantId)),
    ]);
    if (modules.status === 'fulfilled') this.tenantModules.set(modules.value);
    else this.moduleError.set(errorMessage(modules.reason));
    if (catalog.status === 'fulfilled') this.moduleCatalog.set(catalog.value);
    else this.moduleError.set(errorMessage(catalog.reason));
    if (limits.status === 'fulfilled') this.tenantLimits.set(limits.value);
    else
      this.limitError.set(
        'No se pudieron consultar los ajustes de límites. ' + errorMessage(limits.reason),
      );
    this.modulesLoading.set(false);
  }
  async openGrant(code = '') {
    this.grantCode = code;
    this.grantError.set('');
    if (!this.moduleCatalog().length) {
      try {
        this.moduleCatalog.set(await firstValueFrom(this.api.modules()));
      } catch (error) {
        this.moduleError.set(errorMessage(error));
        return;
      }
    }
    this.grantOpen.set(true);
  }
  async grant(body: TenantModuleGrant) {
    if (this.moduleSaving()) return;
    this.moduleSaving.set(true);
    this.grantError.set('');
    try {
      await firstValueFrom(this.api.grantModule(this.tenantId, body));
      this.grantOpen.set(false);
      await this.loadModules();
    } catch (error) {
      this.grantError.set(errorMessage(error));
    } finally {
      this.moduleSaving.set(false);
    }
  }
  requestAction(module: TenantModule, kind: 'revoke' | 'block') {
    this.pendingAction.set({
      kind,
      id: module.id ?? '',
      code: module.module_code,
      name: module.module_name,
    });
  }
  requestLimitRemoval(limit: TenantLimit) {
    this.pendingAction.set({
      kind: 'limit',
      id: limit.id,
      code: limit.limit_code,
      name: limit.limit_code,
    });
  }
  actionTitle(action: { kind: string; name: string }) {
    return (
      (action.kind === 'block'
        ? 'Bloquear '
        : action.kind === 'limit'
          ? 'Quitar límite de '
          : 'Quitar asignación de ') + action.name
    );
  }
  async confirmAction(reason: string) {
    const action = this.pendingAction();
    if (!action || this.moduleSaving() || reason.trim().length < 3) return;
    this.moduleSaving.set(true);
    this.moduleError.set('');
    this.pendingAction.set(null);
    try {
      if (action.kind === 'block')
        await firstValueFrom(
          this.api.grantModule(this.tenantId, {
            module_code: action.code,
            mode: 'BLOQUEADO',
            reason: reason.trim(),
          }),
        );
      else if (action.kind === 'limit')
        await firstValueFrom(this.api.revokeTenantLimit(this.tenantId, action.id, reason.trim()));
      else await firstValueFrom(this.api.revokeModule(this.tenantId, action.id, reason.trim()));
      await this.loadModules();
    } catch (error) {
      this.moduleError.set(errorMessage(error));
    } finally {
      this.moduleSaving.set(false);
    }
  }
  async saveLimit() {
    if (this.moduleSaving()) return;
    if (
      !this.limitCode ||
      !Number.isInteger(this.limitValue) ||
      this.limitValue < 1 ||
      !Number.isInteger(this.limitDays) ||
      this.limitDays < 1 ||
      this.limitDays > 30 ||
      this.limitReason.trim().length < 3
    ) {
      this.limitError.set('Selecciona límite, valor positivo, vigencia de 1–30 días y motivo.');
      return;
    }
    this.moduleSaving.set(true);
    this.limitError.set('');
    try {
      await firstValueFrom(
        this.api.setTenantLimit(this.tenantId, {
          limit_code: this.limitCode,
          value: this.limitValue,
          days: this.limitDays,
          reason: this.limitReason.trim(),
        }),
      );
      this.limitReason = '';
      await this.loadModules();
    } catch (error) {
      this.limitError.set(errorMessage(error));
    } finally {
      this.moduleSaving.set(false);
    }
  }
  async loadRoles() {
    this.rolesLoading.set(true);
    this.roleError.set('');
    try {
      this.tenantRoles.set(await firstValueFrom(this.api.tenantRoles(this.tenantId)));
    } catch (error) {
      this.roleError.set(errorMessage(error));
    } finally {
      this.rolesLoading.set(false);
    }
  }
  async editRole(role: TenantRole) {
    this.roleError.set('');
    this.roleReason = '';
    try {
      this.permissions.set(
        (await firstValueFrom(this.api.permissions())).filter(
          (permission) => permission.scope === 'tenant',
        ),
      );
      this.selectedPermissions = role.permissions.map((permission) => permission.code);
      this.editingRole.set(role);
    } catch (error) {
      this.roleError.set(errorMessage(error));
    }
  }
  cancelRoleEdit() {
    this.editingRole.set(null);
    this.roleReason = '';
  }
  permissionGroups() {
    const groups = new Map<string, PermissionCatalogItem[]>();
    for (const permission of this.permissions()) {
      const key = permission.module || 'base';
      groups.set(key, [...(groups.get(key) ?? []), permission]);
    }
    return [...groups.entries()].map(([code, permissions]) => ({
      code,
      name: this.moduleCatalog().find((module) => module.code === code)?.name ?? code,
      permissions,
    }));
  }
  togglePermission(code: string) {
    this.selectedPermissions = this.selectedPermissions.includes(code)
      ? this.selectedPermissions.filter((value) => value !== code)
      : [...this.selectedPermissions, code];
  }
  async saveRole() {
    const role = this.editingRole();
    if (!role || this.moduleSaving()) return;
    const reason = this.roleReason.trim();
    if (reason.length < 3) {
      this.roleError.set('Escribe el motivo del cambio de permisos (mínimo 3 caracteres).');
      return;
    }
    this.moduleSaving.set(true);
    this.roleError.set('');
    try {
      await firstValueFrom(
        this.api.setTenantRolePermissions(this.tenantId, role.id, {
          permission_codes: this.selectedPermissions,
          reason,
        }),
      );
      this.editingRole.set(null);
      this.roleReason = '';
      await this.loadRoles();
    } catch (error) {
      this.roleError.set(errorMessage(error));
    } finally {
      this.moduleSaving.set(false);
    }
  }
  etiquetaLimite(code: string): string {
    return this.overview()?.quotas.find((quota) => quota.code === code)?.label ?? code;
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
        const updated = res && 'data' in res ? res.data : res;
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

  onTenantUpdated(updated: Tenant) {
    this.editOpen.set(false);
    this.tenant.set(updated);
    this.actionNotice.set(`Datos comerciales de ${updated.trade_name} actualizados exitosamente.`);
    this.cargarBase();
  }
}
