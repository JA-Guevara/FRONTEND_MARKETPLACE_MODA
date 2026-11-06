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
import { errorMessage } from '../../../shared/errors';
@Component({
  selector: 'fs-planes-page',
  imports: [
    CommonModule,
    FormsModule,
    ConfirmDialogComponent,
    PlanEditorComponent,
    ImpactoDialogComponent,
  ],
  template: `<div class="sp2-heading">
      <div>
        <p class="crumbs">Plataforma SaaS / Planes</p>
        <h1>Planes de suscripción</h1>
        <p>Define lo que cada empresa puede hacer y cuánto puede crecer.</p>
      </div>
      <label
        ><input type="checkbox" [ngModel]="inactive()" (ngModelChange)="toggleInactive()" /> Ver
        desactivados</label
      >
    </div>
    @if (error()) {
      <p class="alert danger">{{ error() }}</p>
      <button class="btn" (click)="load()">Reintentar</button>
    }
    <nav class="plan-tabs" aria-label="Vistas de planes">
      <button [class.on]="tab() === 'planes'" (click)="tab.set('planes')">Planes</button>
      <button [class.on]="tab() === 'modulos'" (click)="openMatrix()">Planes × módulos</button>
      <button [class.on]="tab() === 'limites'" (click)="openMatrix('limites')">Límites</button>
    </nav>
    @if (tab() === 'planes') {
      @if (plansLoading()) { <div class="panel" role="status">Cargando planes…</div> }
      @if (!plansLoading() && !plans().some(planStripeReady)) {
        <p class="alert info">Ningún plan se puede pagar con tarjeta todavía.</p>
      }
      <div class="sp2-grid">
        @for (p of plans(); track p.id) {
          <article class="panel">
            <span class="badge plan">{{ p.code }}</span>
            <h2>{{ p.name }}</h2>
            <p class="plan-price">
              Bs {{ p.reference_price | number: '1.0-2'
              }}<small> / {{ p.duration_days }} días</small>
            </p>
            <p>{{ p.limits['max_active_branches'] }} sucursales activas</p>
            <p>Stripe: <strong>{{ p.stripe_ready ? 'Listo' : 'Sin precio' }}</strong>
              @if (p.stripe_price_id_month) { <code>{{ p.stripe_price_id_month }}</code> }
            </p>
            <ul class="feature-list">
              @for (f of features(); track f.code) {
                <li>{{ p.features[f.code] ? '✓' : '—' }} {{ f.label }}</li>
              }
            </ul>
            <small
              >{{ p.tenants_count }} empresas · {{ p.is_active ? 'Activo' : 'Desactivado' }}</small
            >
            @if (session.can('plans.write')) {
              <div class="toolbar">
                <button (click)="edit(p)">Editar</button
                ><button (click)="target.set(p)">
                  {{ p.is_active ? 'Desactivar' : 'Activar' }}
                </button>
                @if (p.tenants_count === 0) {
                  <button class="btn danger" (click)="confirmDelete(p)">Eliminar</button>
                }
              </div>
            }
          </article>
        }
        @if (session.can('plans.write')) {
          <button class="panel" (click)="edit(null)">
            <h2>＋ Crear un plan</h2>
            <p>Configura características, límites y vigencia.</p>
          </button>
        }
      </div>
      <section class="panel" style="margin-top:24px">
        <h2>Comparativa de funcionalidades</h2>
        <div class="sp2-table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Característica</th>
                @for (p of plans(); track p.id) {
                  <th>{{ p.name }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of matrix(); track row.code) {
                <tr>
                  <td>{{ row.label }}</td>
                  @for (v of row.values; track $index) {
                    <td>{{ v === true ? '✓' : v === false ? '—' : v }}</td>
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
        <p role="status">Cargando matriz de planes…</p>
      }
      @if (governance(); as g) {
        <section class="panel matrix-panel">
          <div class="sp2-table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>{{ tab() === 'modulos' ? 'Módulo' : 'Límite' }}</th>
                  @for (p of g.plans; track p.id) {
                    <th>{{ p.name }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @if (tab() === 'modulos') {
                  @for (module of g.modules; track module.code) {
                    <tr>
                      <td>
                        <b>{{ module.name }}</b
                        ><small class="module-state">{{
                          module.kind === 'BASE' ? 'Base' : module.lifecycle
                        }}</small>
                      </td>
                      @for (p of g.plans; track p.id) {
                        <td>
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
                        </td>
                      }
                    </tr>
                  }
                } @else {
                  @for (limit of limits(); track limit.code) {
                    <tr>
                      <td>{{ limit.label }}</td>
                      @for (p of g.plans; track p.id) {
                        <td>
                          <input
                            type="number"
                            min="1"
                            step="1"
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
          <footer>
            <button (click)="resetMatrix()">Descartar cambios</button>
            @for (p of g.plans; track p.id) {
              @if (session.can('plans.write')) {
                <button class="primary" [disabled]="matrixSaving()" (click)="review(p.id)">
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
    />`,
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
    this.plansLoading.set(true); this.error.set('');
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
    const modules: Record<string, Record<string, boolean>> = {},
      limits: Record<string, Record<string, number>> = {};
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
