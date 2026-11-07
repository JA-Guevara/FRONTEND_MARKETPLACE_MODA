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
import { Plan, FeatureCatalogItem, featureMatrix } from '../domain/plan.models';
import { PlanEditorComponent } from './plan-editor.component';
import { ModuleMatrix, PlanImpact, PlatformModule } from '../domain/gobierno.models';
import { ImpactoDialogComponent } from './impacto-dialog.component';
import { IconComponent } from '../../../shared/icon.component';
import { errorMessage } from '../../../shared/errors';

@Component({
  selector: 'fs-planes-page',
  imports: [
    CommonModule,
    FormsModule,
    ConfirmDialogComponent,
    PlanEditorComponent,
    ImpactoDialogComponent,
    IconComponent,
  ],
  template: `
    <div class="planes-header">
      <div class="header-titles">
        <p class="crumbs">Plataforma SaaS / Planes</p>
        <h1 class="page-title">Planes de suscripción</h1>
        <p class="page-subtitle">Define lo que cada empresa puede hacer y cuánto puede crecer en la plataforma.</p>
      </div>
      <div class="header-actions">
        <label class="toggle-switch">
          <input type="checkbox" [ngModel]="inactive()" (ngModelChange)="toggleInactive()" />
          <span class="switch-indicator"></span>
          <span class="toggle-label">Ver desactivados</span>
        </label>
        @if (session.can('plans.write')) {
          <button type="button" class="btn btn-create-header" (click)="edit(null)">
            <fs-icon name="plus" />
            <span>Crear un plan</span>
          </button>
        }
      </div>
    </div>

    @if (error()) {
      <div class="alert alert-danger" role="alert">
        <span>{{ error() }}</span>
        <button class="btn btn-sm" (click)="load()">Reintentar</button>
      </div>
    }

    <nav class="plan-tabs-bar" aria-label="Vistas de planes">
      <button
        type="button"
        class="tab-pill"
        [class.on]="tab() === 'planes'"
        (click)="tab.set('planes')"
      >
        <fs-icon name="tag" />
        <span>Planes</span>
        @if (plans().length) {
          <span class="tab-count">{{ plans().length }}</span>
        }
      </button>
      <button
        type="button"
        class="tab-pill"
        [class.on]="tab() === 'modulos'"
        (click)="openMatrix()"
      >
        <fs-icon name="box" />
        <span>Planes × módulos</span>
      </button>
      <button
        type="button"
        class="tab-pill"
        [class.on]="tab() === 'limites'"
        (click)="openMatrix('limites')"
      >
        <fs-icon name="users" />
        <span>Límites</span>
      </button>
    </nav>

    @if (tab() === 'planes') {
      @if (plansLoading()) {
        <div class="loading-panel" role="status">
          <div class="spinner"></div>
          <span>Cargando planes de suscripción…</span>
        </div>
      }

      @if (!plansLoading() && !plans().some(planStripeReady)) {
        <div class="alert alert-info">
          <span class="alert-icon">ℹ️</span>
          <span>Ningún plan se puede pagar con tarjeta todavía. Configura las claves de Stripe para habilitar pagos en línea.</span>
        </div>
      }

      <div class="plans-grid">
        @for (p of plans(); track p.id) {
          <article class="pricing-card" [class.is-disabled]="!p.is_active">
            <div class="card-top">
              <span class="tier-pill" [attr.data-code]="p.code.toLowerCase()">{{ p.code }}</span>
              <span class="status-indicator" [class.active]="p.is_active">
                {{ p.is_active ? 'Activo' : 'Desactivado' }}
              </span>
            </div>

            <h2 class="plan-name">{{ p.name }}</h2>

            <div class="price-box">
              <span class="currency">Bs</span>
              <span class="amount">{{ p.reference_price | number: '1.0-2' }}</span>
              <span class="duration">/ {{ p.duration_days }} días</span>
            </div>

            <div class="limits-highlight">
              <span class="limit-icon">🏪</span>
              <span class="limit-text"><strong>{{ p.limits['max_active_branches'] }}</strong> sucursales activas</span>
            </div>

            <div class="stripe-row">
              <span class="stripe-label">Stripe:</span>
              <span class="stripe-badge" [class.ready]="p.stripe_ready">
                {{ p.stripe_ready ? 'Listo' : 'Sin precio' }}
              </span>
              @if (p.stripe_price_id_month) {
                <code class="stripe-id" [title]="p.stripe_price_id_month">{{ p.stripe_price_id_month }}</code>
              }
            </div>

            <div class="card-features-section">
              <h4 class="features-header">Funcionalidades incluidas</h4>
              <ul class="features-checklist">
                @for (f of features(); track f.code) {
                  <li [class.enabled]="p.features[f.code]" [class.disabled]="!p.features[f.code]">
                    <span class="check-mark">{{ p.features[f.code] ? '✓' : '—' }}</span>
                    <span class="feature-name">{{ f.label }}</span>
                  </li>
                }
              </ul>
            </div>

            <div class="card-bottom">
              <div class="tenants-metric">
                <span class="tenants-count"><strong>{{ p.tenants_count }}</strong></span>
                <span class="tenants-label">{{ p.tenants_count === 1 ? 'empresa suscrita' : 'empresas suscritas' }}</span>
              </div>

              @if (session.can('plans.write')) {
                <div class="card-actions">
                  <button type="button" class="btn btn-edit" (click)="edit(p)">
                    Editar
                  </button>
                  <button
                    type="button"
                    class="btn btn-status"
                    (click)="target.set(p)"
                  >
                    {{ p.is_active ? 'Desactivar' : 'Activar' }}
                  </button>
                  @if (p.tenants_count === 0) {
                    <button type="button" class="btn btn-delete" (click)="confirmDelete(p)">
                      Eliminar
                    </button>
                  }
                </div>
              }
            </div>
          </article>
        }

        @if (session.can('plans.write')) {
          <button type="button" class="create-plan-card" (click)="edit(null)">
            <div class="create-card-body">
              <div class="create-icon-bubble">＋</div>
              <h3 class="create-title">Crear un plan</h3>
              <p class="create-desc">Configura características, límites y vigencia para nuevas suscripciones.</p>
              <span class="create-cta-link">Nuevo plan →</span>
            </div>
          </button>
        }
      </div>

      <section class="matrix-section panel">
        <div class="matrix-header">
          <h2>Comparativa de funcionalidades</h2>
          <p class="matrix-subtitle">Resumen cruzado de módulos habilitados por cada nivel de suscripción.</p>
        </div>
        <div class="sp2-table-wrap">
          <table class="tbl matrix-table">
            <thead>
              <tr>
                <th>Característica</th>
                @for (p of plans(); track p.id) {
                  <th class="plan-col-head">{{ p.name }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of matrix(); track row.code) {
                <tr>
                  <td class="feature-col"><strong>{{ row.label }}</strong></td>
                  @for (v of row.values; track $index) {
                    <td class="val-col">
                      @if (v === true) {
                        <span class="badge-check">✓</span>
                      } @else if (v === false) {
                        <span class="badge-dash">—</span>
                      } @else {
                        <span class="badge-value">{{ v }}</span>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }

    @if (tab() !== 'planes') {
      @if (matrixLoading()) {
        <div class="loading-panel" role="status">
          <div class="spinner"></div>
          <span>Cargando matriz de planes…</span>
        </div>
      }
      @if (governance(); as g) {
        <section class="panel matrix-panel">
          <div class="matrix-header">
            <h2>{{ tab() === 'modulos' ? 'Matriz de Módulos por Plan' : 'Matriz de Límites Operativos' }}</h2>
            <p class="matrix-subtitle">Gestiona permisos y capacidades de forma simultánea.</p>
          </div>
          <div class="sp2-table-wrap">
            <table class="tbl matrix-table">
              <thead>
                <tr>
                  <th>{{ tab() === 'modulos' ? 'Módulo' : 'Límite' }}</th>
                  @for (p of g.plans; track p.id) {
                    <th class="plan-col-head">{{ p.name }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @if (tab() === 'modulos') {
                  @for (module of g.modules; track module.code) {
                    <tr>
                      <td>
                        <div class="module-title-box">
                          <b>{{ module.name }}</b>
                          <small class="module-state">{{ module.kind === 'BASE' ? 'Base obligatoria' : module.lifecycle }}</small>
                        </div>
                      </td>
                      @for (p of g.plans; track p.id) {
                        <td class="text-center">
                          <label class="matrix-checkbox-label">
                            <input
                              type="checkbox"
                              [attr.aria-label]="module.name + ' en ' + p.name"
                              [ngModel]="draftModules()[p.id]?.[module.code] ?? false"
                              (ngModelChange)="setModule(p.id, module.code, $event)"
                              [disabled]="
                                module.kind === 'BASE' ||
                                module.lifecycle !== 'GA' ||
                                !session.can('plans.write')
                              "
                            />
                          </label>
                        </td>
                      }
                    </tr>
                  }
                } @else {
                  @for (limit of limits(); track limit.code) {
                    <tr>
                      <td>
                        <div class="limit-title-box">
                          <b>{{ limit.label }}</b>
                          <small class="muted">Capacidad máxima por empresa</small>
                        </div>
                      </td>
                      @for (p of g.plans; track p.id) {
                        <td>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            class="input matrix-number-input"
                            [attr.aria-label]="limit.label + ' en ' + p.name"
                            [ngModel]="draftLimits()[p.id]?.[limit.code]"
                            (ngModelChange)="setLimit(p.id, limit.code, $event)"
                            [disabled]="!session.can('plans.write')"
                          />
                        </td>
                      }
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
          <footer class="matrix-footer">
            <button type="button" class="btn btn-secondary" (click)="resetMatrix()">Descartar cambios</button>
            @for (p of g.plans; track p.id) {
              @if (session.can('plans.write')) {
                <button type="button" class="btn btn-primary" [disabled]="matrixSaving()" (click)="review(p.id)">
                  Revisar {{ p.name }}
                </button>
              }
            }
          </footer>
        </section>
      }
    }

    @if (editor()) {
      <fs-plan-editor
        [plan]="selected()"
        [catalog]="catalog()"
        [modules]="governance()?.modules ?? []"
        (saved)="saved()"
        (priceUpdated)="load()"
        (closed)="saved()"
      />
    }

    @if (pendingImpact(); as impact) {
      <fs-impacto-dialog
        [impact]="impact"
        title="Actualizar módulos y límites del plan"
        [busy]="matrixSaving()"
        [error]="impactError()"
        (cancelled)="cancelReview()"
        (confirmed)="applyMatrix($event)"
      />
    }

    <fs-confirm-dialog
      [open]="!!target()"
      [title]="target()?.is_active ? '¿Desactivar este plan?' : 'Activar plan'"
      message="Las empresas con suscripciones vigentes conservan su plan. Los planes desactivados no se ofrecen a nuevas empresas."
      (confirmed)="toggle()"
      (cancelled)="target.set(null)"
    />

    <fs-confirm-dialog
      [open]="!!deletingPlan()"
      title="¿Eliminar plan definitivamente?"
      [message]="'¿Estás seguro de eliminar el plan ' + (deletingPlan()?.name ?? '') + '? Esta acción no se puede deshacer.'"
      (confirmed)="executeDeletePlan(deletingPlan()!.id)"
      (cancelled)="deletingPlan.set(null)"
    />
  `,
  styleUrl: './planes-page.component.scss',
})
export class PlanesPageComponent {
  private api = inject(PlataformaApi);
  private route = inject(ActivatedRoute);
  session = inject(SessionService);
  plans = signal<Plan[]>([]);
  catalog = signal<FeatureCatalogItem[]>([]);
  features = computed(() => this.catalog().filter((f) => f.kind === 'feature'));
  matrix = computed(() => featureMatrix(this.plans(), this.catalog()));
  inactive = signal(false);
  selected = signal<Plan | null>(null);
  editor = signal(false);
  target = signal<Plan | null>(null);
  deletingPlan = signal<Plan | null>(null);
  error = signal('');
  readonly plansLoading = signal(true);
  readonly planStripeReady = (plan: Plan) => plan.stripe_ready === true;
  tab = signal<'planes' | 'modulos' | 'limites'>('planes');
  governance = signal<ModuleMatrix | null>(null);
  draftModules = signal<Record<string, Record<string, boolean>>>({});
  draftLimits = signal<Record<string, Record<string, number>>>({});
  limits = computed(() => this.catalog().filter((item) => item.kind === 'limit'));
  matrixLoading = signal(false);
  matrixSaving = signal(false);
  pendingImpact = signal<PlanImpact | null>(null);
  impactError = signal('');
  private pendingChange: {
    id: string;
    features: Record<string, boolean>;
    limits: Record<string, number>;
  } | null = null;

  constructor() {
    void this.load();
    if (this.route.snapshot.queryParamMap.get('tab') === 'modulos') void this.openMatrix();
  }

  async load() {
    this.plansLoading.set(true);
    this.error.set('');
    try {
      const [p, c] = await Promise.all([
        firstValueFrom(this.api.plans(this.inactive())),
        firstValueFrom(this.api.featureCatalog()),
      ]);
      this.plans.set(p);
      this.catalog.set(c);
    } catch {
      this.error.set('No se pudo cargar la información.');
    } finally {
      this.plansLoading.set(false);
    }
  }

  toggleInactive() {
    this.inactive.update((v) => !v);
    void this.load();
  }

  edit(p: Plan | null) {
    this.selected.set(p);
    this.editor.set(true);
    if (!this.governance()) void this.loadMatrix();
  }

  saved() {
    this.editor.set(false);
    void this.load();
    if (this.governance()) void this.loadMatrix();
  }

  async openMatrix(tab: 'modulos' | 'limites' = 'modulos') {
    this.tab.set(tab);
    if (!this.governance()) await this.loadMatrix();
  }

  async loadMatrix() {
    this.matrixLoading.set(true);
    this.error.set('');
    try {
      this.governance.set(await firstValueFrom(this.api.matrix()));
      this.resetMatrix();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.matrixLoading.set(false);
    }
  }

  resetMatrix() {
    const modules: Record<string, Record<string, boolean>> = {};
    const limits: Record<string, Record<string, number>> = {};
    for (const plan of this.governance()?.plans ?? []) {
      modules[plan.id] = { ...plan.modules };
      limits[plan.id] = { ...plan.limits };
    }
    this.draftModules.set(modules);
    this.draftLimits.set(limits);
  }

  setModule(id: string, code: string, enabled: boolean) {
    this.draftModules.update((d) => ({ ...d, [id]: { ...d[id], [code]: enabled } }));
  }

  setLimit(id: string, code: string, value: number) {
    this.draftLimits.update((d) => ({ ...d, [id]: { ...d[id], [code]: value } }));
  }

  async review(id: string) {
    if (this.matrixSaving()) return;
    const limits = { ...this.draftLimits()[id] };
    if (Object.values(limits).some((value) => !Number.isInteger(value) || value < 1)) {
      this.error.set('Los límites deben ser números enteros positivos.');
      return;
    }
    this.matrixSaving.set(true);
    this.error.set('');
    this.impactError.set('');
    try {
      const features = { ...this.draftModules()[id] };
      this.pendingChange = { id, features, limits };
      this.pendingImpact.set(await firstValueFrom(this.api.planImpact(id, features)));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.matrixSaving.set(false);
    }
  }

  cancelReview() {
    if (this.matrixSaving()) return;
    this.pendingImpact.set(null);
    this.pendingChange = null;
  }

  async applyMatrix(reason: string) {
    if (this.matrixSaving() || !this.pendingChange || reason.trim().length < 3) return;
    this.matrixSaving.set(true);
    this.impactError.set('');
    try {
      const change = this.pendingChange;
      await firstValueFrom(
        this.api.updatePlan(change.id, {
          features: change.features,
          limits: change.limits,
          reason: reason.trim(),
          confirm: true,
        }),
      );
      this.pendingImpact.set(null);
      this.pendingChange = null;
      await Promise.all([this.load(), this.loadMatrix()]);
    } catch (error) {
      this.impactError.set(errorMessage(error));
    } finally {
      this.matrixSaving.set(false);
    }
  }

  async toggle() {
    const p = this.target();
    if (!p) return;
    this.target.set(null);
    try {
      await firstValueFrom(
        p.is_active ? this.api.deactivatePlan(p.id) : this.api.activatePlan(p.id),
      );
      await this.load();
    } catch {
      this.error.set('No se pudo cambiar el estado del plan.');
    }
  }

  confirmDelete(p: Plan) {
    this.deletingPlan.set(p);
  }

  async executeDeletePlan(id: string) {
    this.deletingPlan.set(null);
    this.error.set('');
    try {
      await firstValueFrom(this.api.deletePlan(id));
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo eliminar el plan.');
    }
  }
}
