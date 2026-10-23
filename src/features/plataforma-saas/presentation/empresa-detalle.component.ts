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
import { Tenant, ActivityItem } from '../domain/empresa.models';
import { EmpresaFormComponent } from './empresa-form.component';
@Component({
  selector: 'fs-empresa-detalle',
  imports: [
    CommonModule,
    RouterLink,
    StatusBadgeComponent,
    ConfirmDialogComponent,
    EmpresaFormComponent,
  ],
  template: `@if (tenant(); as t) {
      <div class="sp2-heading">
        <div>
          <p class="crumbs">
            <a routerLink="/admin/plataforma/empresas">Empresas</a> / {{ t.trade_name }}
          </p>
          <h1>{{ t.trade_name }}</h1>
          <p>{{ t.legal_name }} · NIT {{ t.tax_id }} · {{ t.slug }}</p>
        </div>
        <fs-status-badge [tone]="t.status === 'ACTIVA' ? 'ok' : 'neutral'" [label]="t.status" />
      </div>
      @if (message()) {
        <div class="alert info">{{ message() }}</div>
      }
      <div class="sp2-grid">
        <section class="panel">
          <h2>Suscripción</h2>
          <h3>{{ t.plan_name }}</h3>
          <p>{{ t.subscription_status }} · Hasta {{ t.end_date | date: 'dd/MM/yyyy' }}</p>
          <a [routerLink]="['/admin/plataforma/empresas', t.id, 'suscripcion']"
            >Gestionar suscripción →</a
          >
        </section>
        <section class="panel">
          <h2>Uso de la empresa</h2>
          <p>{{ t.active_branches }} sucursales activas</p>
          <p>{{ t.contact_email }}<br />{{ t.phone }}</p>
        </section>
        <section class="panel">
          <h2>Administrador</h2>
          <p>{{ t.admin_email }}</p>
          <fs-status-badge
            [tone]="t.admin_password_set ? 'ok' : 'warn'"
            [label]="t.admin_password_set ? 'Cuenta activa' : 'Invitación pendiente'"
          />
            @if (session.can('tenants.write') && !t.admin_password_set) {
            <button (click)="resend()">Reenviar invitación</button>
          }
        </section>
      </div>
      <div class="toolbar">
        @if (session.can('tenants.write')) {
          <button (click)="editing.set(true)">Editar datos</button
          ><button class="btn danger" (click)="confirm.set(true)">
            {{ t.status === 'ACTIVA' ? 'Desactivar empresa' : 'Reactivar empresa' }}
          </button>
        }
      </div>
      <section class="panel">
        <h2>Actividad reciente</h2>
        <ol class="timeline">
          @for (item of activity(); track $index) {
            <li>
              <strong>{{ item.description || item.action }}</strong
              ><br /><small
                >{{ item.created_at | date: 'dd/MM/yyyy HH:mm' }} · {{ item.actor_email }}</small
              >
            </li>
          } @empty {
            <li>Aún no hay actividad registrada.</li>
          }
        </ol>
      </section>
      @if (editing()) {
        <fs-empresa-form [tenant]="t" (saved)="updated($event)" (closed)="editing.set(false)" />
      }
      <fs-confirm-dialog
        [open]="confirm()"
        [title]="t.status === 'ACTIVA' ? '¿Desactivar ' + t.trade_name + '?' : 'Reactivar empresa'"
        message="El cambio se aplica a los usuarios de la empresa. Sus datos e historial se conservan."
        [requireText]="t.status === 'ACTIVA' ? t.slug : undefined"
        [tone]="t.status === 'ACTIVA' ? 'danger' : 'primary'"
        [confirmLabel]="t.status === 'ACTIVA' ? 'Desactivar empresa' : 'Reactivar'"
        (confirmed)="changeStatus($event)"
        (cancelled)="confirm.set(false)"
      />
    } @else if (error()) {
      <div class="alert danger">{{ error() }}</div>
    } @else {
      <p>Cargando empresa…</p>
    }`,
  styleUrl: './empresa-detalle.component.scss',
})
export class EmpresaDetalleComponent {
  private api = inject(PlataformaApi);
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  session = inject(SessionService);
  tenant = signal<Tenant | null>(null);
  activity = signal<ActivityItem[]>([]);
  editing = signal(false);
  confirm = signal(false);
  error = signal('');
  message = signal('');
  constructor() {
    void this.load();
  }
  async load() {
    try {
      const [t, a] = await Promise.all([
        firstValueFrom(this.api.tenant(this.id)),
        firstValueFrom(this.api.tenantActivity(this.id)),
      ]);
      this.tenant.set(t);
      this.activity.set(a);
    } catch {
      this.error.set('No se pudo cargar la empresa.');
    }
  }
  updated(t: Tenant) {
    this.editing.set(false);
    this.tenant.set(t);
    void this.load();
  }
  async resend() {
    try {
      const response = await firstValueFrom(this.api.resendInvitation(this.id));
      this.message.set(response.message);
    } catch {
      this.message.set('No se pudo reenviar la invitación.');
    }
  }
  async changeStatus(reason: string) {
    this.confirm.set(false);
    try {
      const r = await firstValueFrom(
        this.tenant()?.status === 'ACTIVA'
          ? this.api.deactivateTenant(this.id, reason)
          : this.api.activateTenant(this.id),
      );
      this.tenant.set(r.data);
      void this.load();
    } catch {
      this.message.set('No se pudo cambiar el estado de la empresa.');
    }
  }
}
