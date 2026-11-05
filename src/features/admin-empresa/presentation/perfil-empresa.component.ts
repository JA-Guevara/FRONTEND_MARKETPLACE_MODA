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

      <div class="card" style="margin-top:14px;background:var(--surface, #fafafa);border:1px solid var(--line)">
        <h3 style="margin:0 0 6px">🌐 Tu Tienda y Catálogo Público Segmentado</h3>
        <p class="muted" style="margin:0 0 12px;font-size:13px">
          Comparte este enlace directo con tus clientes para que accedan exclusivamente al catálogo, sucursales y vestidor de <b>{{ p.trade_name }}</b>.
        </p>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <code class="mono" style="padding:8px 12px;background:var(--paper);border:1px solid var(--line);border-radius:6px;font-size:13.5px">
            {{ getStorefrontUrl(p.slug) }}
          </code>
          <button type="button" class="btn sm" (click)="copyStorefrontUrl(p.slug)">
            {{ copied() ? '✔ ¡Enlace copiado!' : '📋 Copiar enlace' }}
          </button>
          <a [href]="'/tienda/' + p.slug" target="_blank" class="btn sm primary">
            ↗ Ver mi catálogo en vivo
          </a>
        </div>
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
  readonly copied = signal(false);

  form = {
    trade_name: '',
    contact_email: '',
    phone: '',
  };

  canEdit(): boolean {
    return this.session.can('tenant_profile.write');
  }

  getStorefrontUrl(slug: string): string {
    if (typeof window !== 'undefined' && window.location) {
      return `${window.location.origin}/tienda/${slug}`;
    }
    return `/tienda/${slug}`;
  }

  async copyStorefrontUrl(slug: string) {
    const url = this.getStorefrontUrl(slug);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    } catch {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    }
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
