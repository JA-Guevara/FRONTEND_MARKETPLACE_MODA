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
@Component({
  selector: 'fs-planes-page',
  imports: [CommonModule, FormsModule, ConfirmDialogComponent, PlanEditorComponent],
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
    }
    <div class="sp2-grid">
      @for (p of plans(); track p.id) {
        <article class="panel">
          <span class="badge plan">{{ p.code }}</span>
          <h2>{{ p.name }}</h2>
          <p class="plan-price">
            Bs {{ p.reference_price | number: '1.0-2' }}<small> / {{ p.duration_days }} días</small>
          </p>
          <p>{{ p.limits['max_active_branches'] }} sucursales activas</p>
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
              ><button (click)="target.set(p)">{{ p.is_active ? 'Desactivar' : 'Activar' }}</button>
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
    @if (editor()) {
      <fs-plan-editor
        [plan]="selected()"
        [catalog]="catalog()"
        (saved)="saved()"
        (closed)="saved()"
      />
    }
    <fs-confirm-dialog
      [open]="!!target()"
      [title]="target()?.is_active ? '¿Desactivar este plan?' : 'Activar plan'"
      message="Las empresas con suscripciones vigentes conservan su plan. Los planes desactivados no se ofrecen a nuevas empresas."
      (confirmed)="toggle()"
      (cancelled)="target.set(null)"
    />`,
  styleUrl: './planes-page.component.scss',
})
export class PlanesPageComponent {
  private api = inject(PlataformaApi);
  session = inject(SessionService);
  plans = signal<Plan[]>([]);
  catalog = signal<FeatureCatalogItem[]>([]);
  features = computed(() => this.catalog().filter((f) => f.kind === 'feature'));
  matrix = computed(() => featureMatrix(this.plans(), this.catalog()));
  inactive = signal(false);
  selected = signal<Plan | null>(null);
  editor = signal(false);
  target = signal<Plan | null>(null);
  error = signal('');
  constructor() {
    void this.load();
  }
  async load() {
    try {
      const [p, c] = await Promise.all([
        firstValueFrom(this.api.plans(this.inactive())),
        firstValueFrom(this.api.featureCatalog()),
      ]);
      this.plans.set(p);
      this.catalog.set(c);
    } catch {
      this.error.set('No se pudieron cargar los planes.');
    }
  }
  toggleInactive() {
    this.inactive.update((v) => !v);
    void this.load();
  }
  edit(p: Plan | null) {
    this.selected.set(p);
    this.editor.set(true);
  }
  saved() {
    this.editor.set(false);
    void this.load();
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
}
