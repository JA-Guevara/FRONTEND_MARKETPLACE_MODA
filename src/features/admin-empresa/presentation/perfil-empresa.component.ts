import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmpresaAdminApi } from '../infrastructure/empresa-admin.api';
import { TenantProfile } from '../domain/empresa-admin.models';
import { SessionService } from '../../usuarios-catalogo/application/session.service';

@Component({
  selector: 'fs-perfil-empresa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="crumbs">Mi empresa</div>
    <div class="page-h">
      <div>
        <h1>Perfil de la empresa</h1>
        <p>Datos identificatorios y de contacto de tu organización en FashionStore.</p>
      </div>
    </div>

    @if (notice()) {
      <div class="alert ok" style="margin-bottom:14px"><span>✔</span><div>{{ notice() }}</div></div>
    }
    @if (error()) {
      <div class="alert danger" style="margin-bottom:14px"><span>⚠</span><div>{{ error() }}</div></div>
    }

    @if (loading()) {
      <div class="card"><p class="muted">Cargando datos de la empresa…</p></div>
    } @else if (profile(); as p) {
      <div class="card">
        <form (ngSubmit)="guardar()" class="sp2-form">
          <div class="field">
            <label for="legal_name">Razón social (solo lectura)</label>
            <input id="legal_name" class="input" [value]="p.legal_name" disabled />
          </div>

          <div class="grid2">
            <div class="field">
              <label for="tax_id">NIT / Identificación fiscal (solo lectura)</label>
              <input id="tax_id" class="input" [value]="p.tax_id" disabled />
            </div>

            <div class="field">
              <label for="slug">Identificador URL / Slug (solo lectura)</label>
              <input id="slug" class="input mono" [value]="p.slug" disabled />
            </div>
          </div>

          <div class="field">
            <label for="trade_name">Nombre comercial *</label>
            <input
              id="trade_name"
              class="input"
              [(ngModel)]="form.trade_name"
              name="trade_name"
              required
              [disabled]="!canEdit()"
            />
          </div>

          <div class="grid2">
            <div class="field">
              <label for="contact_email">Correo de contacto *</label>
              <input
                id="contact_email"
                type="email"
                class="input"
                [(ngModel)]="form.contact_email"
                name="contact_email"
                required
                [disabled]="!canEdit()"
              />
            </div>

            <div class="field">
              <label for="phone">Teléfono de contacto</label>
              <input
                id="phone"
                class="input"
                [(ngModel)]="form.phone"
                name="phone"
                placeholder="Ej. +591 70000000"
                [disabled]="!canEdit()"
              />
            </div>
          </div>

          @if (!canEdit()) {
            <p class="muted" style="font-size:12px;margin:0">
              ℹ Tu rol actual no tiene permiso de edición de perfil (<code class="mono">tenant_profile.write</code>).
            </p>
          }

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px">
            <button
              type="submit"
              class="btn primary"
              [disabled]="saving() || !canEdit() || !isFormValid()"
            >
              {{ saving() ? 'Guardando…' : 'Guardar cambios' }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
  styleUrl: './perfil-empresa.component.scss',
})
export class PerfilEmpresaComponent implements OnInit {
  private api = inject(EmpresaAdminApi);
  readonly session = inject(SessionService);

  readonly profile = signal<TenantProfile | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  form = {
    trade_name: '',
    contact_email: '',
    phone: '',
  };

  canEdit(): boolean {
    return this.session.can('tenant_profile.write');
  }

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.error.set(null);
    this.api.profile().subscribe({
      next: (p) => {
        this.profile.set(p);
        this.form = {
          trade_name: p.trade_name || '',
          contact_email: p.contact_email || '',
          phone: p.phone || '',
        };
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Error al cargar perfil.');
        this.loading.set(false);
      },
    });
  }

  isFormValid(): boolean {
    return (
      this.form.trade_name.trim().length >= 2 &&
      this.form.contact_email.trim().length >= 5 &&
      this.form.contact_email.includes('@')
    );
  }

  guardar() {
    if (!this.canEdit() || !this.isFormValid()) return;
    this.saving.set(true);
    this.error.set(null);
    this.notice.set(null);

    this.api.updateProfile({
      trade_name: this.form.trade_name.trim(),
      contact_email: this.form.contact_email.trim(),
      phone: this.form.phone.trim() || undefined,
    }).subscribe({
      next: (res: any) => {
        const updated = (res && 'data' in res) ? res.data : res;
        this.profile.set(updated);
        this.saving.set(false);
        this.notice.set('Perfil de la empresa actualizado correctamente.');
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo actualizar el perfil.');
        this.saving.set(false);
      },
    });
  }
}
