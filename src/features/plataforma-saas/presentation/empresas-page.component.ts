import { Plan } from '../domain/plan.models';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  OnInit,
  OnChanges,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge.component';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';
import { UsageMeterComponent } from '../../../shared/ui/usage-meter.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { DrawerComponent } from '../../../shared/ui/drawer.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { EmpresasStore } from '../application/empresas.store';
import { Tenant, tenantTone } from '../domain/empresa.models';
import { EmpresaFormComponent } from './empresa-form.component';
@Component({
  selector: 'fs-empresas-page',
  providers: [EmpresasStore],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    StatusBadgeComponent,
    KpiCardComponent,
    UsageMeterComponent,
    EmptyStateComponent,
    EmpresaFormComponent,
  ],
  template: `<div class="sp2-heading">
      <div>
        <p class="crumbs">Plataforma SaaS / Empresas</p>
        <h1>Empresas contratantes</h1>
        <p>Administra las empresas que confían en FashionStore.</p>
      </div>
      @if (session.can('tenants.write')) {
        <button class="btn primary" (click)="openNew()">＋ Nueva empresa</button>
      }
    </div>
    @if (store.stats(); as s) {
      <div class="empresa-kpis">
        <fs-kpi-card
          label="Empresas activas"
          [value]="s.active"
          hint="Operando en la plataforma"
        /><fs-kpi-card
          label="Plan Profesional"
          [value]="s.professional"
          hint="Con todas las funcionalidades"
        /><fs-kpi-card
          label="Por vencer"
          [value]="s.expiring_7d"
          hint="En los próximos 7 días"
        /><fs-kpi-card label="Suspendidas" [value]="s.suspended" hint="En modo solo consulta" />
      </div>
    }
    @if (created(); as t) {
      <div class="alert ok">
        Empresa creada. La cuenta {{ t.admin_email }} está pendiente de activación mediante invitación.
        <button (click)="resend(t)">Reenviar invitación</button>
      </div>
    }
    @if (notice()) { <p class="alert info">{{notice()}}</p> }
    @if (store.error()) {
      <div class="alert danger">
        {{ store.error() }}<button (click)="store.load()">Reintentar</button>
      </div>
    }
    <div class="panel">
      <div class="toolbar">
        <input
          class="input"
          aria-label="Buscar empresa"
          placeholder="Buscar por empresa, NIT o administrador…"
          [ngModel]="store.filters().search"
          (ngModelChange)="store.setFilter('search', $event)"
        /><select
          class="input"
          aria-label="Filtrar plan"
          [ngModel]="store.filters().plan"
          (ngModelChange)="store.setFilter('plan', $event)"
        >
          <option value="">Todos los planes</option>
          <option value="BASICO">Básico</option>
          <option value="PROFESIONAL">Profesional</option>
        </select>
      </div>
      <div class="toolbar">
        @for (chip of chips; track chip[0]) {
          <button
            class="chip"
            [class.on]="store.filters().status === chip[0]"
            (click)="store.setFilter('status', chip[0])"
          >
            {{ chip[1] }}
          </button>
        }
      </div>
      @if (store.loading()) {
        <p role="status">Cargando empresas…</p>
      } @else if (!store.items().length) {
        <fs-empty-state
          title="No encontramos empresas"
          text="Prueba otra búsqueda o registra tu primera empresa."
        />
      } @else {
        <div class="sp2-table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Sucursales activas</th>
                <th>Administrador</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (t of store.items(); track t.id) {
                <tr>
                  <td>
                    <strong>{{ t.trade_name }}</strong
                    ><br /><small>NIT {{ t.tax_id }} · {{ t.slug }}</small>
                  </td>
                  <td>
                    <span class="badge plan">{{ t.plan_name }}</span>
                  </td>
                  <td>
                    <fs-status-badge
                      [tone]="tone(t)"
                      [label]="
                        t.status === 'INACTIVA'
                          ? 'Inactiva'
                          : t.subscription_status || 'Sin suscripción'
                      "
                    />
                  </td>
                  <td>
                    <fs-usage-meter
                      label="Sucursales"
                      [used]="t.active_branches"
                      [limit]="limit(t.plan_code)"
                    />
                  </td>
                  <td>
                    {{ t.admin_email }}<br /><small>{{
                      t.admin_password_set ? 'Cuenta activa' : 'Invitación pendiente'
                    }}</small>
                  </td>
                  <td><a [routerLink]="['/admin/plataforma/empresas', t.id]">Ver detalle →</a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <div class="toolbar">
        <small
          >{{ store.total() }} empresas · Página {{ store.page() }} de {{ store.pages() }}</small
        ><button [disabled]="store.page() <= 1" (click)="store.prev()">Anterior</button
        ><button [disabled]="store.page() >= store.pages()" (click)="store.next()">
          Siguiente
        </button>
      </div>
    </div>
    @if (formOpen()) {
      <fs-empresa-form (saved)="afterCreated($event)" (closed)="formOpen.set(false)" />
    }`,
  styleUrl: './empresas-page.component.scss',
})
export class EmpresasPageComponent {
  readonly store = inject(EmpresasStore);
  session = inject(SessionService);
  private api = inject(PlataformaApi);
  plans = signal<Plan[]>([]);
  formOpen = signal(false);
  created = signal<Tenant | null>(null);
  notice = signal('');
  tone = tenantTone;
  chips = [
    ['todas', 'Todas'],
    ['activas', 'Activas'],
    ['por_vencer', 'Por vencer'],
    ['suspendidas', 'Suspendidas'],
    ['inactivas', 'Inactivas'],
  ];
  constructor() {
    void this.store.load();
    this.api.plans(true).subscribe({ next: (p) => this.plans.set(p), error: () => {} });
  }
  limit(code: string | null) {
    return this.plans().find((p) => p.code === code)?.limits['max_active_branches'] ?? 0;
  }
  openNew() {
    this.formOpen.set(true);
  }
  afterCreated(t: Tenant) {
    this.formOpen.set(false);
    this.created.set(t);
    void this.store.load();
  }
  async resend(t: Tenant) {
    try {
      const response = await firstValueFrom(this.api.resendInvitation(t.id));
      this.notice.set(response.message);
    } catch {
      this.store.error.set('No se pudo reenviar la invitación.');
    }
  }
}
