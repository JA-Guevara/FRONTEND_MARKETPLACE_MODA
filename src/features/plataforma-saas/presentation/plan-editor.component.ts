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
@Component({
  selector: 'fs-plan-editor',
  imports: [CommonModule, FormsModule, DrawerComponent],
  template: `<fs-drawer
    [open]="true"
    [title]="plan ? 'Editar ' + plan.name : 'Crear un plan'"
    (closed)="closed.emit()"
    ><div class="sp2-form">
      <label class="f"
        >Código<input class="input" [disabled]="!!plan" [(ngModel)]="draft.code" />
        @if (errors()['code']) {
          <span class="sp2-error">{{ errors()['code'] }}</span>
        }</label
      ><label class="f"
        >Nombre<input class="input" [(ngModel)]="draft.name" />
        @if (errors()['name']) {
          <span class="sp2-error">{{ errors()['name'] }}</span>
        }
      </label>
      <div class="sp2-grid">
        <label class="f"
          >Precio de referencia (Bs)<input
            class="input"
            type="number"
            min="0"
            [(ngModel)]="draft.reference_price" /></label
        ><label class="f"
          >Duración (días)<input
            class="input"
            type="number"
            min="1"
            max="366"
            [(ngModel)]="draft.duration_days"
        /></label>
      </div>
      @if (errors()['duration_days']) {
        <span class="sp2-error">{{ errors()['duration_days'] }}</span>
      }
      <h3>Funcionalidades incluidas</h3>
      @for (f of catalog; track f.code) {
        @if (f.kind === 'feature') {
          <label class="switch-row"
            ><span>{{ f.label }}</span
            ><input type="checkbox" role="switch" [(ngModel)]="draft.features[f.code]"
          /></label>
        } @else {
          <label class="f"
            >{{ f.label
            }}<input
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
      <div class="alert info">Los cambios se aplican a las empresas que ya utilizan este plan.</div>
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
    <div drawer-footer>
      <button (click)="closed.emit()">Cerrar</button
      ><button class="btn primary" [disabled]="saving()" (click)="save()">
        {{ saving() ? 'Guardando…' : 'Guardar plan' }}
      </button>
    </div></fs-drawer
  >`,
  styleUrl: './plan-editor.component.scss',
})
export class PlanEditorComponent implements OnInit {
  @Input() plan: Plan | null = null;
  @Input() catalog: FeatureCatalogItem[] = [];
  @Output() saved = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  private api = inject(PlataformaApi);
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
  ngOnInit() {
    if (this.plan)
      this.draft = {
        code: this.plan.code,
        name: this.plan.name,
        reference_price: Number(this.plan.reference_price),
        duration_days: this.plan.duration_days,
        features: { ...this.plan.features },
        limits: { ...this.plan.limits },
      };
  }
  async save() {
    if (this.saving()) return;
    this.errors.set(validatePlanDraft(this.draft));
    if (Object.keys(this.errors()).length) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const { code, ...update } = this.draft;
      const result = await firstValueFrom(
        this.plan ? this.api.updatePlan(this.plan.id, update) : this.api.createPlan(this.draft),
      );
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
}
