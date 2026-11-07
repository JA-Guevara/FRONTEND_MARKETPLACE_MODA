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
import { Plan, PlanDraft, FeatureCatalogItem, validatePlanDraft } from '../domain/plan.models';
import { PlatformModule, PlanImpact } from '../domain/gobierno.models';
import { ImpactoDialogComponent } from './impacto-dialog.component';
import { StripeSaasApi } from '../infrastructure/stripe-saas.api';

@Component({
  selector: 'fs-plan-editor',
  imports: [CommonModule, FormsModule, DrawerComponent, ImpactoDialogComponent],
  template: `
    <fs-drawer
      [open]="true"
      [title]="plan ? 'Editar ' + plan.name : 'Crear un plan'"
      (closed)="closed.emit()"
    >
      <div class="editor-content-wrapper">
        <div class="form-section">
          <h3 class="section-title">Información básica</h3>
          <div class="fields-stack">
            <label class="form-field">
              <span class="field-label">Código del plan</span>
              <input class="input" [disabled]="!!plan" [(ngModel)]="draft.code" placeholder="p. ej. corporativo" />
              @if (errors()['code']) {
                <span class="sp2-error">{{ errors()['code'] }}</span>
              }
            </label>
            <label class="form-field">
              <span class="field-label">Nombre para mostrar</span>
              <input class="input" [(ngModel)]="draft.name" placeholder="p. ej. Plan Corporativo" />
              @if (errors()['name']) {
                <span class="sp2-error">{{ errors()['name'] }}</span>
              }
            </label>
          </div>
        </div>

        <div class="form-section">
          <h3 class="section-title">Precios y vigencia</h3>
          <div class="fields-grid-2">
            <label class="form-field">
              <span class="field-label">Precio de referencia (Bs)</span>
              <input
                class="input"
                type="number"
                min="0"
                [(ngModel)]="draft.reference_price"
              />
            </label>
            <label class="form-field">
              <span class="field-label">Duración (días)</span>
              <input
                class="input"
                type="number"
                min="1"
                max="366"
                [(ngModel)]="draft.duration_days"
              />
            </label>
          </div>
          @if (errors()['duration_days']) {
            <span class="sp2-error">{{ errors()['duration_days'] }}</span>
          }

          @if (plan) {
            <div class="stripe-sync-box" aria-label="Precio de Stripe">
              <div class="sync-header">
                <span class="sync-title">Sincronización Stripe</span>
                <span class="stripe-ready-pill" [class.ready]="plan.stripe_ready">
                  {{ plan.stripe_ready ? 'Listo' : 'Sin precio' }}
                </span>
              </div>
              <label class="form-field" for="stripe-price-month">
                <span class="field-label">Precio mensual en Stripe (price_…)</span>
                <div class="input-with-button">
                  <input
                    id="stripe-price-month"
                    class="input"
                    [(ngModel)]="stripePrice"
                    [disabled]="!session.can('plans.write') || stripeSaving()"
                    maxlength="100"
                    autocomplete="off"
                    placeholder="price_1xxxxxxxxx"
                  />
                  @if (session.can('plans.write')) {
                    <button
                      class="btn btn-secondary"
                      type="button"
                      [disabled]="stripeSaving()"
                      (click)="saveStripePrice()"
                    >
                      {{ stripeSaving() ? 'Guardando…' : 'Vincular precio' }}
                    </button>
                  }
                </div>
              </label>
              <p class="field-hint">Créalo en el panel de Stripe (modo prueba) y pega aquí su identificador.</p>
              @if (stripeError()) { <p class="alert danger" role="alert">{{ stripeError() }}</p> }
              @if (stripeSaved()) { <p class="alert ok" role="status">Precio de Stripe actualizado.</p> }
            </div>
          } @else {
            <p class="field-hint muted">Guarda el plan para vincular después su precio de Stripe.</p>
          }
        </div>

        <div class="form-section">
          <h3 class="section-title">Límites operativos</h3>
          @for (f of catalog; track f.code) {
            @if (f.kind === 'limit') {
              <label class="form-field">
                <span class="field-label">{{ f.label }}</span>
                <input
                  class="input"
                  type="number"
                  min="1"
                  step="1"
                  [(ngModel)]="draft.limits[f.code]"
                />
                @if (errors()[f.code]) {
                  <span class="sp2-error">{{ errors()[f.code] }}</span>
                }
              </label>
            }
          }
        </div>

        <div class="form-section">
          <h3 class="section-title">Funcionalidades incluidas</h3>
          <p class="section-desc">Selecciona qué herramientas tendrán disponibles las empresas con este plan.</p>
          <div class="switches-list">
            @for (f of catalog; track f.code) {
              @if (f.kind === 'feature') {
                <label class="switch-row" [class.locked]="moduleLocked(f.code)">
                  <div class="switch-info">
                    <span class="switch-title">{{ f.label }}</span>
                    @if (moduleLocked(f.code)) {
                      <span class="badge-base">Base obligatoria</span>
                    }
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    class="switch-checkbox"
                    [(ngModel)]="draft.features[f.code]"
                    [disabled]="moduleLocked(f.code)"
                  />
                </label>
              }
            }
          </div>
        </div>

        <div class="form-notices">
          <div class="alert info">
            Los cambios se aplican a las empresas que ya utilizan este plan.
          </div>
          @if (exceeded().length) {
            <div class="alert warn">
              <strong>Plan guardado: hay empresas que superan el nuevo límite</strong>
              <p>{{ exceeded().join(', ') }}</p>
              <p>Podrán consultar sus datos y desactivar sucursales antes de volver a crecer.</p>
            </div>
          }
          @if (error()) {
            <p class="alert danger">{{ error() }}</p>
          }
        </div>
      </div>

      <div drawer-footer class="drawer-action-buttons">
        <button type="button" class="btn btn-secondary" (click)="closed.emit()">Cerrar</button>
        <button type="button" class="btn primary btn-submit" [disabled]="saving()" (click)="save()">
          {{ saving() ? 'Procesando…' : plan ? 'Revisar impacto y guardar' : 'Guardar plan' }}
        </button>
      </div>
    </fs-drawer>

    @if (impact(); as pendingImpact) {
      <fs-impacto-dialog
        [impact]="pendingImpact"
        [title]="'Actualizar ' + (plan?.name ?? 'plan')"
        [busy]="saving()"
        [error]="error()"
        (confirmed)="confirmSave($event)"
        (cancelled)="cancelImpact()"
      />
    }
  `,
  styleUrl: './plan-editor.component.scss',
})
export class PlanEditorComponent implements OnInit {
  @Input() plan: Plan | null = null;
  @Input() catalog: FeatureCatalogItem[] = [];
  @Input() modules: PlatformModule[] = [];
  @Output() saved = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @Output() priceUpdated = new EventEmitter<void>();
  private api = inject(PlataformaApi);
  private readonly stripe = inject(StripeSaasApi);
  readonly session = inject(SessionService);
  stripePrice = '';
  readonly stripeSaving = signal(false);
  readonly stripeSaved = signal(false);
  readonly stripeError = signal('');
  draft: PlanDraft = {
    code: '',
    name: '',
    reference_price: 0,
    duration_days: 30,
    features: {},
    limits: { max_active_branches: 2 },
  };
  errors = signal<Record<string, string>>({});
  error = signal('');
  exceeded = signal<string[]>([]);
  saving = signal(false);
  impact = signal<PlanImpact | null>(null);
  private pendingDraft: PlanDraft | null = null;

  ngOnInit() {
    this.stripePrice = this.plan?.stripe_price_id_month ?? '';
    if (this.plan)
      this.draft = {
        code: this.plan.code,
        name: this.plan.name,
        reference_price: Number(this.plan.reference_price),
        duration_days: this.plan.duration_days,
        features: { ...this.plan.features },
        limits: { ...this.plan.limits },
      };
    for (const module of this.modules) {
      if (module.kind === 'BASE') this.draft.features[module.code] = true;
    }
  }

  async saveStripePrice() {
    if (!this.plan || !this.session.can('plans.write') || this.stripeSaving()) return;
    const price = this.stripePrice.trim();
    this.stripeSaved.set(false);
    this.stripeError.set('');
    if (price && !/^price_[A-Za-z0-9_]{1,94}$/.test(price)) {
      this.stripeError.set('Ingresa un identificador de precio que empiece por price_.');
      return;
    }
    this.stripeSaving.set(true);
    try {
      const result = await firstValueFrom(this.stripe.planPrice(this.plan.id, price || null));
      this.plan = {
        ...this.plan,
        stripe_price_id_month: result.stripe_price_id_month,
        stripe_ready: result.stripe_ready,
      };
      this.stripeSaved.set(true);
      this.priceUpdated.emit();
    } catch {
      this.stripeError.set('No se pudo guardar el precio de Stripe. Reintenta.');
    } finally {
      this.stripeSaving.set(false);
    }
  }

  moduleLocked(code: string) {
    const module = this.modules.find((item) => item.code === code);
    return !!module && (module.kind === 'BASE' || module.lifecycle !== 'GA');
  }

  cancelImpact() {
    if (this.saving()) return;
    this.impact.set(null);
    this.pendingDraft = null;
    this.error.set('');
  }

  async save() {
    if (this.saving()) return;
    this.errors.set(validatePlanDraft(this.draft));
    if (Object.keys(this.errors()).length) return;
    this.saving.set(true);
    this.error.set('');
    try {
      if (this.plan) {
        this.pendingDraft = {
          ...this.draft,
          features: { ...this.draft.features },
          limits: { ...this.draft.limits },
        };
        this.impact.set(
          await firstValueFrom(this.api.planImpact(this.plan.id, this.pendingDraft.features)),
        );
        return;
      }
      const result = await firstValueFrom(this.api.createPlan(this.draft));
      this.exceeded.set(result.data.exceeded_tenants);
      if (!result.data.exceeded_tenants.length) this.saved.emit();
    } catch (e: any) {
      const body = e.error?.error ?? e.error;
      if (body?.code === 'plan_code_taken')
        this.errors.set({ code: 'Ya existe un plan con ese código.' });
      else if (body?.code === 'plan_limit_invalid')
        this.errors.set({ max_active_branches: 'Los límites deben ser números positivos.' });
      else this.error.set(body?.message ?? 'No se pudo guardar el plan.');
    } finally {
      this.saving.set(false);
    }
  }

  async confirmSave(reason: string) {
    if (this.saving() || !this.plan || !this.pendingDraft || reason.trim().length < 3) return;
    this.saving.set(true);
    this.error.set('');
    const { code, ...update } = this.pendingDraft;
    try {
      const result = await firstValueFrom(
        this.api.updatePlan(this.plan.id, { ...update, reason: reason.trim(), confirm: true }),
      );
      this.exceeded.set(result.data.exceeded_tenants);
      this.impact.set(null);
      this.pendingDraft = null;
      if (!result.data.exceeded_tenants.length) this.saved.emit();
    } catch (error: any) {
      this.error.set(error?.error?.error?.message ?? 'No se pudo guardar el plan.');
    } finally {
      this.saving.set(false);
    }
  }
}
