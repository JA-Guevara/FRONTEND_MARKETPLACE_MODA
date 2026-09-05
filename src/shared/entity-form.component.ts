import { Component, Input, Output, EventEmitter, OnChanges, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Field, Option } from './form-schema';
import { Entity } from './models';
import { ApiService } from '../app/core/shared/api.service';
import { errorMessage } from './errors';
import { passwordError } from '../features/auth/domain/password';

@Component({
  selector: 'fs-entity-form',
  imports: [ReactiveFormsModule],
  template: ` @if (lookupError()) {
      <div class="alert error" role="alert">
        {{ lookupError() }}
        <button type="button" (click)="loadOptions()">Reintentar opciones</button>
      </div>
    }
    <form [formGroup]="form" (ngSubmit)="submit()" class="editor-form">
      <div class="form-grid">
        @for (field of visibleFields; track field.key) {
          <div
            class="field"
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
        <button class="primary" type="submit" [disabled]="busy || loading() || !!lookupError()">
          {{ busy ? 'Guardando…' : 'Guardar cambios' }}</button
        ><button type="button" (click)="cancel.emit()" [disabled]="busy">Cancelar</button>
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
  submit() {
    if (this.busy || this.loading() || this.lookupError()) return;
    this.form.markAllAsTouched();
    this.localError.set('');
    if (this.form.invalid) return;
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
            this.localError.set(
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
        this.localError.set(`Completá ${f.label.toLowerCase()} sin espacios vacíos.`);
        return;
      }
      if (f.type === 'password') {
        const error = passwordError(value, raw['email']);
        if (error) {
          this.localError.set(error);
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
      this.localError.set('La fecha final debe ser posterior o igual a la inicial.');
      return;
    }
    this.saved.emit(data);
  }
}
