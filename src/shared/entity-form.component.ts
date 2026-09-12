import { Component, Input, Output, EventEmitter, OnChanges, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Field, Option } from './form-schema';
import { Entity } from './models';
import { ApiService } from '../app/core/shared/api.service';
import { errorMessage } from './errors';
import { IconComponent } from './icon.component';
import { passwordError } from '../features/auth/domain/password';

@Component({
  selector: 'fs-entity-form',
  imports: [ReactiveFormsModule, IconComponent],
  template: ` @if (lookupError()) {
      <div class="alert error" role="alert">
        {{ lookupError() }}
        <button type="button" (click)="loadOptions()">
          <fs-icon name="refresh" />Reintentar opciones
        </button>
      </div>
    }
    <form [formGroup]="form" (ngSubmit)="submit()" class="editor-form">
      @if (steps.length > 1) {
        <nav class="form-steps" aria-label="Secciones del formulario">
          @for (item of steps; track item.title; let i = $index) {
            <button
              type="button"
              class="form-step"
              [class.current]="i === step"
              [class.done]="i < step"
              [attr.aria-current]="i === step ? 'step' : null"
              [disabled]="busy"
              (click)="goTo(i)"
            >
              <span class="form-step-index" aria-hidden="true">{{ i + 1 }}</span>
              <span class="form-step-title">{{ item.title }}</span>
            </button>
          }
        </nav>
        <div class="form-progress" aria-live="polite">
          <span>Paso {{ step + 1 }} de {{ steps.length }} · {{ steps[step].title }}</span>
          <progress
            [value]="step + 1"
            [max]="steps.length"
            aria-label="Progreso del formulario"
          ></progress>
        </div>
      }
      <div class="form-grid">
        @for (field of visibleFields; track field.key) {
          <div
            class="field"
            [hidden]="!onStep(field.key)"
            [class.full]="
              field.type === 'textarea' || field.type === 'multi' || field.type === 'hours'
            "
          >
            @if (field.type === 'checkbox') {
              <label class="check"
                ><input type="checkbox" [formControlName]="field.key" />{{ field.label }}</label
              >
            } @else {
              <label [for]="'f-' + field.key"
                >{{ field.label }}
                @if (field.required) {
                  <span aria-hidden="true">*</span>
                }
              </label>
              @switch (field.type) {
                @case ('textarea') {
                  <textarea
                    [id]="'f-' + field.key"
                    [formControlName]="field.key"
                    rows="3"
                  ></textarea>
                }
                @case ('select') {
                  <select [id]="'f-' + field.key" [formControlName]="field.key">
                    <option value="">Seleccionar…</option>
                    @for (option of options[field.key] || field.options || []; track option.value) {
                      <option [value]="option.value">{{ option.label }}</option>
                    }
                  </select>
                }
                @case ('multi') {
                  <div class="choices" [id]="'f-' + field.key">
                    @for (option of options[field.key] || field.options || []; track option.value) {
                      <label class="check"
                        ><input
                          type="checkbox"
                          [checked]="selected(field.key, option.value)"
                          (change)="toggle(field.key, option.value)"
                        />{{ option.label }}</label
                      >
                    } @empty {
                      <span class="muted">No hay opciones disponibles.</span>
                    }
                  </div>
                }
                @case ('hours') {
                  <div [formGroupName]="field.key" [id]="'f-' + field.key" class="hours">
                    @for (day of days; track day.key) {
                      <div [formGroupName]="day.key" class="hour-row">
                        <label class="check"
                          ><input type="checkbox" formControlName="enabled" />{{ day.label }}</label
                        ><input
                          type="time"
                          formControlName="open"
                          [attr.aria-label]="'Apertura ' + day.label"
                        /><input
                          type="time"
                          formControlName="close"
                          [attr.aria-label]="'Cierre ' + day.label"
                        />
                      </div>
                    }
                  </div>
                }
                @default {
                  <input
                    [id]="'f-' + field.key"
                    [type]="field.type || 'text'"
                    [formControlName]="field.key"
                    [attr.min]="field.min ?? null"
                    [attr.max]="field.max ?? null"
                    [attr.maxlength]="field.maxLength ?? null"
                    [attr.step]="field.type === 'number' ? 'any' : null"
                    [attr.autocomplete]="field.type === 'password' ? 'new-password' : null"
                  />
                }
              }
            }
            @if (field.hint) {
              <small>{{ field.hint }}</small>
            }
            @if (form.get(field.key)?.invalid && form.get(field.key)?.touched) {
              <small class="field-error"
                >Revisá {{ field.label.toLowerCase() }}: es obligatorio o no tiene el formato
                esperado.</small
              >
            }
          </div>
        }
      </div>
      @if (localError()) {
        <p class="alert error" role="alert">{{ localError() }}</p>
      }
      <div class="form-actions">
        @if (step > 0) {
          <button type="button" (click)="previousStep()" [disabled]="busy">
            <fs-icon name="arrow-left" />Anterior
          </button>
        }
        @if (step < steps.length - 1) {
          <button
            class="primary"
            type="button"
            (click)="nextStep()"
            [disabled]="busy || loading() || !!lookupError()"
          >
            Continuar<fs-icon name="arrow-right" />
          </button>
        } @else {
          <button class="primary" type="submit" [disabled]="busy || loading() || !!lookupError()">
            <fs-icon name="save" />{{ busy ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        }
        <button type="button" (click)="cancel.emit()" [disabled]="busy">
          <fs-icon name="close" />Cancelar
        </button>
      </div>
    </form>`,
})
export class EntityFormComponent implements OnChanges {
  @Input() fields: Field[] = [];
  @Input() value: Entity | Record<string, unknown> | null = null;
  @Input() busy = false;
  @Output() saved = new EventEmitter<Record<string, unknown>>();
  @Output() cancel = new EventEmitter<void>();
  private api = inject(ApiService);
  form = new FormGroup<any>({});
  visibleFields: Field[] = [];
  step = 0;
  /** Pasos del asistente: uno por sección declarada, o bloques de seis campos. */
  steps: { title: string; keys: string[] }[] = [{ title: 'Datos principales', keys: [] }];
  private static readonly FIELDS_PER_STEP = 6;
  get stepCount() {
    return this.steps.length;
  }
  onStep(key: string) {
    return this.steps[this.step]?.keys.includes(key) ?? false;
  }
  /** Índice del paso que contiene el campo, para saltar al error correspondiente. */
  stepOf(key: string) {
    const index = this.steps.findIndex((s) => s.keys.includes(key));
    return index < 0 ? 0 : index;
  }
  private buildSteps() {
    const order: string[] = [];
    const byTitle = new Map<string, string[]>();
    const add = (title: string, key: string) => {
      if (!byTitle.has(title)) {
        byTitle.set(title, []);
        order.push(title);
      }
      byTitle.get(title)!.push(key);
    };
    if (this.visibleFields.some((f) => f.section)) {
      let currentSection = '';
      for (const field of this.visibleFields) {
        currentSection = field.section || currentSection || 'Datos principales';
        add(currentSection, field.key);
      }
    } else {
      const size = EntityFormComponent.FIELDS_PER_STEP;
      for (let i = 0; i < this.visibleFields.length; i += size)
        for (const field of this.visibleFields.slice(i, i + size))
          add(i === 0 ? 'Datos principales' : 'Información adicional', field.key);
    }
    this.steps = order.length
      ? order.map((title) => ({ title, keys: byTitle.get(title)! }))
      : [{ title: 'Datos principales', keys: [] }];
  }
  private validateStep(index: number) {
    const keys = this.steps[index]?.keys ?? [];
    keys.forEach((key) => this.form.get(key)?.markAllAsTouched());
    return !keys.some((key) => this.form.get(key)?.invalid);
  }
  previousStep() {
    if (this.busy) return;
    this.step = Math.max(0, this.step - 1);
  }
  nextStep() {
    if (this.busy || this.loading() || this.lookupError()) return;
    if (!this.validateStep(this.step)) return;
    this.step = Math.min(this.step + 1, this.steps.length - 1);
  }
  /** Permite volver a cualquier paso anterior; hacia adelante valida los intermedios. */
  goTo(index: number) {
    if (this.busy || index === this.step) return;
    if (index < this.step) {
      this.step = index;
      return;
    }
    for (let i = this.step; i < index; i++)
      if (!this.validateStep(i)) {
        this.step = i;
        return;
      }
    this.step = Math.min(index, this.steps.length - 1);
  }
  options: Record<string, Option[]> = {};
  localError = signal('');
  lookupError = signal('');
  loading = signal(false);
  private generation = 0;
  days = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ];
  ngOnChanges(changes: Record<string, unknown>) {
    if (!changes['fields'] && !changes['value']) return;
    this.visibleFields = this.fields.filter((f) => !this.value?.['id'] || !f.createOnly);
    this.buildSteps();
    this.step = 0;
    const controls: Record<string, any> = {};
    for (const f of this.visibleFields) {
      const v =
        this.value?.[f.key] ??
        f.default ??
        (f.type === 'checkbox' ? false : f.type === 'multi' ? [] : '');
      if (f.type === 'hours') {
        controls[f.key] = new FormGroup(
          Object.fromEntries(
            this.days.map((d) => {
              const hours = (v as any)?.[d.key];
              return [
                d.key,
                new FormGroup({
                  enabled: new FormControl(!!hours),
                  open: new FormControl(hours?.open || '09:00'),
                  close: new FormControl(hours?.close || '18:00'),
                }),
              ];
            }),
          ),
        );
      } else {
        const validators = [];
        if (f.required) validators.push(Validators.required);
        if (f.type === 'email') validators.push(Validators.email);
        if (f.type === 'url') validators.push(Validators.pattern(/^https?:\/\/[^\s]+$/));
        if (f.minLength) validators.push(Validators.minLength(f.minLength));
        if (f.maxLength) validators.push(Validators.maxLength(f.maxLength));
        if (f.min !== undefined) validators.push(Validators.min(f.min));
        if (f.max !== undefined) validators.push(Validators.max(f.max));
        if (f.pattern) validators.push(Validators.pattern(f.pattern));
        controls[f.key] = new FormControl(v, validators);
      }
    }
    this.form = new FormGroup(controls);
    this.localError.set('');
    void this.loadOptions();
  }
  async loadOptions() {
    const generation = ++this.generation;
    this.loading.set(true);
    this.lookupError.set('');
    this.options = {};
    const lookups = this.visibleFields.filter((f) => f.lookup);
    const results = await Promise.allSettled(
      lookups.map((f) =>
        firstValueFrom(this.api.get<Entity[]>(f.lookup!, { include_inactive: true })),
      ),
    );
    if (generation !== this.generation) return;
    results.forEach((result, i) => {
      const f = lookups[i];
      if (result.status === 'fulfilled')
        this.options[f.key] = result.value
          .filter((v) => v.id !== (f.key === 'parent_id' ? this.value?.['id'] : ''))
          .map((v) => ({
            value: v.id,
            label:
              String(v[f.lookupLabel || 'name'] || v['code'] || v.id) +
              (v['is_active'] === false ? ' (inactivo)' : ''),
          }));
      else
        this.lookupError.set(
          `No se pudieron cargar las opciones de ${f.label}. ${errorMessage(result.reason)}`,
        );
    });
    this.loading.set(false);
  }
  selected(key: string, value: string) {
    return (this.form.get(key)?.value || []).includes(value);
  }
  toggle(key: string, value: string) {
    const selected = this.form.get(key)?.value as string[];
    this.form
      .get(key)
      ?.setValue(
        selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
      );
  }
  /** Muestra el error y lleva al paso donde está el campo, para que sea visible. */
  private failAt(key: string, message: string) {
    this.localError.set(message);
    this.step = this.stepOf(key);
  }
  submit() {
    if (this.busy || this.loading() || this.lookupError()) return;
    this.form.markAllAsTouched();
    this.localError.set('');
    if (this.form.invalid) {
      const invalid = this.visibleFields.find((f) => this.form.get(f.key)?.invalid);
      if (invalid) this.step = this.stepOf(invalid.key);
      return;
    }
    const raw = this.form.getRawValue();
    const data: Record<string, unknown> = {};
    for (const f of this.visibleFields) {
      let value = raw[f.key];
      if (typeof value === 'string' && f.type !== 'password') value = value.trim();
      if (f.type === 'hours') {
        const hours: Record<string, unknown> = {};
        for (const day of this.days) {
          const h = value[day.key];
          if (h.enabled && (!h.open || !h.close || h.close <= h.open)) {
            this.failAt(
              f.key,
              `Revisá el horario del ${day.label.toLowerCase()}. El cierre debe ser posterior a la apertura.`,
            );
            return;
          }
          hours[day.key] = h.enabled ? { open: h.open, close: h.close } : null;
        }
        value = hours;
      }
      if (
        f.required &&
        typeof value === 'string' &&
        (!value || (f.minLength && value.length < f.minLength))
      ) {
        this.failAt(f.key, `Completá ${f.label.toLowerCase()} sin espacios vacíos.`);
        return;
      }
      if (f.type === 'password') {
        const error = passwordError(value, raw['email']);
        if (error) {
          this.failAt(f.key, error);
          return;
        }
      }
      if (value === '') {
        if (!this.value?.['id']) continue;
        value = null;
      }
      data[f.key] = value;
    }
    if (
      data['start_date'] &&
      data['end_date'] &&
      String(data['end_date']) < String(data['start_date'])
    ) {
      this.failAt('end_date', 'La fecha final debe ser posterior o igual a la inicial.');
      return;
    }
    this.saved.emit(data);
  }
}
