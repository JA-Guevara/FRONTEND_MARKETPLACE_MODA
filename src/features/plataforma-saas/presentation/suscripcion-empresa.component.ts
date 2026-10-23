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
import { SubscriptionDetail, expiryTone, downgradeCheck } from '../domain/suscripcion.models';
import { Plan, FEATURE_LABELS } from '../domain/plan.models';
@Component({
  selector: 'fs-suscripcion-empresa',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    StatusBadgeComponent,
    UsageMeterComponent,
    DrawerComponent,
    ConfirmDialogComponent,
  ],
  template: `<div class="sp2-heading">
      <div>
        <p class="crumbs">
          <a routerLink="/admin/plataforma/empresas">Empresas</a> /
          {{ detail()?.tenant?.trade_name }} / Suscripción
        </p>
        <h1>Suscripción de {{ detail()?.tenant?.trade_name }}</h1>
        <p>Administra la vigencia y capacidades de la empresa.</p>
      </div>
      @if (session.can('subscriptions.write')) {
        <div class="toolbar">
          <button (click)="changeOpen.set(true)">Cambiar plan</button
          ><button (click)="action.set('renew')">Renovar</button
          ><button class="btn danger" (click)="action.set('status')">
            {{ detail()?.current?.status === 'ACTIVA' ? 'Suspender' : 'Reactivar' }}
          </button>
        </div>
      }
    </div>
    @if (error()) {
      <p class="alert danger">{{ error() }}</p>
    }
    @if (detail(); as d) {
      <div class="sp2-grid">
        <section class="panel">
          <span class="badge plan">{{ d.current.plan_code }}</span>
          <h2>{{ d.current.plan_name }}</h2>
          @if (d.current.reference_price != null) { <p>Precio de referencia: Bs {{d.current.reference_price | number:'1.2-2'}}</p> }
          <fs-status-badge
            [tone]="tone(d.current.days_left, d.current.status)"
            [label]="d.current.status"
          />
          <p>
            Desde {{ d.current.start_date | date: 'dd/MM/yyyy' }} hasta
            {{ d.current.end_date | date: 'dd/MM/yyyy' }}
          </p>
          <strong>{{ d.current.days_left }} días restantes</strong
          ><fs-usage-meter [used]="d.usage.active_branches" [limit]="d.usage.max_active_branches" />
        </section>
        <section class="panel">
          <h2>Tu plan incluye</h2>
          <ul class="feature-list">
            @for (f of featureEntries(d.features); track f[0]) {
              <li>{{ f[1] ? '✓' : '—' }} {{ labels[f[0]] || f[0] }}</li>
            }
          </ul>
        </section>
      </div>
      <section class="panel" style="margin-top:20px">
        <h2>Historial de suscripción</h2>
        <ol class="timeline">
          @for (s of d.history; track s.id) {
            <li>
              <strong>{{ s.plan_name }} · {{ s.status }}</strong>
              <p>{{ s.start_date | date: 'dd/MM/yyyy' }} — {{ s.end_date | date: 'dd/MM/yyyy' }}</p>
              <small>{{ s.reason }}</small>
            </li>
          } @empty {
            <li>Esta es la primera suscripción de la empresa.</li>
          }
        </ol>
      </section>
    }
    <fs-drawer [open]="changeOpen()" title="Cambiar plan" (closed)="changeOpen.set(false)"
      ><div class="sp2-stack">
        @for (p of plans(); track p.id) {
          <label class="panel"
            ><input
              type="radio"
              name="targetPlan"
              [value]="p.code"
              [(ngModel)]="targetCode"
            /><strong>{{ p.name }}</strong>
            <p>
              Bs {{ p.reference_price }} / {{ p.duration_days }} días ·
              {{ p.limits['max_active_branches'] }} sucursales
            </p>
            <fs-status-badge
              [tone]="check(p).ok ? 'ok' : 'danger'"
              [label]="check(p).ok ? 'Compatible' : 'Límite superado'"
            />
            @if (!check(p).ok) {
              <div class="alert warn">
                Debes desactivar {{ check(p).mustDeactivate }} sucursales antes de cambiar a este
                plan. Tienes {{ detail()?.usage?.active_branches }} activas y el límite es
                {{ p.limits['max_active_branches'] }}.
              </div>
            }
          </label>
        }
        <label class="f"
          >Motivo<textarea
            class="input"
            required
            minlength="3"
            maxlength="300"
            [(ngModel)]="reason"
          ></textarea>
        </label>
      </div>
      <div drawer-footer>
        <button (click)="changeOpen.set(false)">Cancelar</button
        ><button class="btn primary" [disabled]="!canApply() || busy()" (click)="apply()">
          Aplicar cambio
        </button>
      </div></fs-drawer
    ><fs-confirm-dialog
      [open]="!!action()"
      [requireReason]="action() === 'status'"
      [title]="
        action() === 'renew'
          ? 'Renovar suscripción'
          : detail()?.current?.status === 'ACTIVA'
            ? 'Suspender suscripción'
            : 'Reactivar suscripción'
      "
      [message]="
        action() === 'renew'
          ? 'La vigencia se extiende 30 días desde su fecha final.'
          : 'La empresa suspendida puede consultar información; las operaciones de registro quedarán bloqueadas.'
      "
      (confirmed)="confirm($event)"
      (cancelled)="action.set('')"
    />`,
  styleUrl: './suscripcion-empresa.component.scss',
})
export class SuscripcionEmpresaComponent {
  private api = inject(PlataformaApi);
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  session = inject(SessionService);
  detail = signal<SubscriptionDetail | null>(null);
  plans = signal<Plan[]>([]);
  error = signal('');
  busy = signal(false);
  changeOpen = signal(false);
  action = signal('');
  targetCode = '';
  reason = '';
  tone = expiryTone;
  labels = FEATURE_LABELS;
  featureEntries = Object.entries;
  constructor() {
    void this.load();
  }
  async load() {
    try {
      const [d, p] = await Promise.all([
        firstValueFrom(this.api.subscription(this.id)),
        firstValueFrom(this.api.plans()),
      ]);
      this.detail.set(d);
      this.plans.set(p);
      this.targetCode = d.current.plan_code;
    } catch {
      this.error.set('No se pudo cargar la suscripción.');
    }
  }
  check(p: Plan) {
    return downgradeCheck(
      this.detail()?.usage ?? { active_branches: 0 },
      p.limits['max_active_branches'],
    );
  }
  canApply() {
    const p = this.plans().find((x) => x.code === this.targetCode);
    return (
      this.reason.trim().length >= 3 &&
      this.reason.trim().length <= 300 &&
      !!p &&
      p.code !== this.detail()?.current.plan_code &&
      this.check(p).ok
    );
  }
  async apply() {
    if (!this.canApply() || this.busy()) return;
    this.busy.set(true);
    try {
      const r = await firstValueFrom(
        this.api.changePlan(this.id, { plan_code: this.targetCode, reason: this.reason }),
      );
      this.detail.set(r.data);
      this.changeOpen.set(false);
    } catch (e: any) {
      this.error.set((e.error?.error ?? e.error)?.message ?? 'No se pudo cambiar el plan.');
    } finally {
      this.busy.set(false);
    }
  }
  async confirm(reason: string) {
    const action = this.action();
    this.action.set('');
    this.busy.set(true);
    try {
      const r = await firstValueFrom(
        action === 'renew'
          ? this.api.renew(this.id, { reason })
          : this.api.setStatus(this.id, {
              status: this.detail()?.current.status === 'ACTIVA' ? 'SUSPENDIDA' : 'ACTIVA',
              reason,
            }),
      );
      this.detail.set(r.data);
    } catch {
      this.error.set('No se pudo actualizar la suscripción.');
    } finally {
      this.busy.set(false);
    }
  }
}
