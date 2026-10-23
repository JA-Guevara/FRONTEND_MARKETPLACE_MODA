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
import { Tenant, slugify } from '../domain/empresa.models';
import { Plan } from '../domain/plan.models';
@Component({
  selector: 'fs-empresa-form',
  imports: [CommonModule, ReactiveFormsModule, DrawerComponent],
  template: `<fs-drawer
    [open]="true"
    [title]="tenant ? 'Editar empresa' : 'Nueva empresa'"
    [steps]="tenant ? [] : steps"
    [step]="step()"
    (closed)="closed.emit()"
    ><form class="sp2-form" [formGroup]="form" (ngSubmit)="submit()">
      @if (step() === 0) {
        @for (field of fields; track field[0]) {
          <label class="f"
            >{{ field[1]
            }}<input
              class="input"
              [type]="field[0] === 'contact_email' ? 'email' : 'text'"
              [formControlName]="field[0]"
              (input)="field[0] === 'slug' ? (slugEdited = true) : undefined"
            />
            @if (errors()[field[0]]) {
              <span class="sp2-error">{{ errors()[field[0]] }}</span>
            }
          </label>
        }
      }
      @if (step() === 1) {
        <div formGroupName="admin" class="sp2-form">
          <div class="alert info">
            El administrador recibirá una invitación para establecer su contraseña. No compartas
            contraseñas por correo.
          </div>
          <label class="f">Nombre<input class="input" formControlName="first_name" /></label
          ><label class="f">Apellido<input class="input" formControlName="last_name" /></label
          ><label class="f"
            >Correo del administrador<input class="input" type="email" formControlName="email"
          /></label>
        </div>
      }
      @if (step() === 2) {
        <label class="f"
          >Plan inicial<select class="input" formControlName="plan_code">
            @for (p of plans(); track p.code) {
              <option [value]="p.code">{{ p.name }} · Bs {{ p.reference_price }}</option>
            }
          </select></label
        ><label class="f"
          >Inicio de vigencia<input class="input" type="date" formControlName="start_date"
        /></label>
        <div class="alert info">
          La suscripción se activa al crear la empresa. Podrás cambiar el plan desde su detalle.
        </div>
      }
      @if (error()) {
        <p class="alert danger" role="alert">{{ error() }}</p>
      }
    </form>
    <div drawer-footer class="toolbar">
      <button (click)="step() > 0 ? step.set(step() - 1) : closed.emit()">
        {{ step() > 0 ? 'Atrás' : 'Cancelar' }}</button
      ><button class="btn primary" [disabled]="saving()" (click)="next()">
        {{
          saving()
            ? 'Guardando…'
            : tenant
              ? 'Guardar cambios'
              : step() === 2
                ? 'Crear empresa'
                : 'Continuar'
        }}
      </button>
    </div></fs-drawer
  >`,
  styleUrl: './empresa-form.component.scss',
})
export class EmpresaFormComponent implements OnInit {
  @Input() tenant: Tenant | null = null;
  @Output() saved = new EventEmitter<Tenant>();
  @Output() closed = new EventEmitter<void>();
  private api = inject(PlataformaApi);
  private fb = inject(FormBuilder);
  readonly step = signal(0);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly errors = signal<Record<string, string>>({});
  readonly plans = signal<Plan[]>([]);
  slugEdited = false;
  steps = ['Datos de la empresa', 'Administrador', 'Plan inicial'];
  fields = [
    ['legal_name', 'Razón social'],
    ['trade_name', 'Nombre comercial'],
    ['tax_id', 'NIT'],
    ['slug', 'Identificador'],
    ['contact_email', 'Correo de contacto'],
    ['phone', 'Teléfono'],
  ];
  form = this.fb.nonNullable.group({
    legal_name: ['', [Validators.required,Validators.minLength(3),Validators.maxLength(200)]],
    trade_name: ['', [Validators.required,Validators.minLength(2),Validators.maxLength(150)]],
    tax_id: ['', [Validators.required, Validators.pattern(/^[0-9]{5,20}$/)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$/)]],
    contact_email: ['', [Validators.required, Validators.email]],
    phone: ['',Validators.maxLength(30)],
    admin: this.fb.nonNullable.group({
      first_name: ['', [Validators.required,Validators.minLength(2),Validators.maxLength(80)]],
      last_name: ['', [Validators.required,Validators.minLength(2),Validators.maxLength(80)]],
      email: ['', [Validators.required, Validators.email]],
    }),
    plan_code: ['BASICO', Validators.required],
    start_date: [new Date().toLocaleDateString('en-CA')],
  });
  ngOnInit() {
    if (this.tenant) {
      this.form.patchValue({
        legal_name: this.tenant.legal_name,
        trade_name: this.tenant.trade_name,
        tax_id: this.tenant.tax_id,
        slug: this.tenant.slug,
        contact_email: this.tenant.contact_email,
        phone: this.tenant.phone ?? '',
      });
      this.form.controls.tax_id.disable();
      this.form.controls.slug.disable();
      this.form.controls.admin.disable();
    }
    this.form.controls.trade_name.valueChanges.subscribe((v) => {
      if (!this.slugEdited && !this.tenant) this.form.controls.slug.setValue(slugify(v));
    });
    this.api
      .plans()
      .subscribe({
        next: (p) => this.plans.set(p),
        error: () =>
          this.error.set('No se pudieron cargar los planes. Reintenta antes de registrar.'),
      });
  }
  next() {
    if (this.tenant) {
      this.submit();
      return;
    }
    const controls =
      this.step() === 0
        ? ['legal_name', 'trade_name', 'tax_id', 'slug', 'contact_email']
        : this.step() === 1
          ? ['admin']
          : ['plan_code', 'start_date'];
    controls.forEach((k) => this.form.get(k)?.markAllAsTouched());
    if (controls.some((k) => this.form.get(k)?.invalid)) {
      this.error.set('Revisa los campos obligatorios y sus formatos.');
      return;
    }
    this.error.set('');
    if (this.step() < 2) this.step.update((n) => n + 1);
    else this.submit();
  }
  async submit() {
    if (this.saving()) return;
    if (this.form.invalid) { this.form.markAllAsTouched();this.error.set('Revisa los campos obligatorios y sus formatos.');return; }
    this.saving.set(true);
    this.error.set('');
    this.errors.set({});
    try {
      const body = this.form.getRawValue();
      const response = this.tenant
        ? await firstValueFrom(
            this.api.updateTenant(this.tenant.id, {
              legal_name: body.legal_name,
              trade_name: body.trade_name,
              contact_email: body.contact_email,
              phone: body.phone,
            }),
          )
        : await firstValueFrom(this.api.createTenant(body));
      this.saved.emit(response.data);
    } catch (e: any) {
      const err = e.error?.error ?? e.error;
      const code = err?.code;
      const field =
        code === 'tenant_tax_id_taken' ? 'tax_id' : code === 'tenant_slug_taken' ? 'slug' : null;
      if (field) {
        this.errors.set({
          [field]:
            field === 'tax_id'
              ? 'Ya registrado por otra empresa.'
              : 'No disponible · prueba «' + this.form.controls.slug.value + '-sc»',
        });
        this.step.set(0);
      } else this.error.set(err?.message ?? 'No se pudo guardar la empresa.');
    } finally {
      this.saving.set(false);
    }
  }
}
