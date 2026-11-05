import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { RoleTemplate, TemplateImpact, calculateImpactSeverity } from '../domain/gobierno.models';

@Component({
  selector: 'fs-plantillas-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="roles-container">
      <header class="header">
        <div>
          <h2>Plantillas de Roles de Empresa</h2>
          <p class="subtitle">Gestiona los permisos predeterminados propagados a todas las empresas del SaaS</p>
        </div>
        <button class="btn btn-secondary" (click)="loadTemplates()">Actualizar</button>
      </header>

      @if (loading()) {
        <div class="loading">Cargando plantillas de roles...</div>
      } @else if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      } @else {
        <div class="templates-grid">
          @for (tpl of templates(); track tpl.id) {
            <div class="template-card">
              <div class="card-top">
                <span class="badge system">{{ tpl.is_system ? 'Sistema' : 'Personalizado' }}</span>
                <span class="role-code"><code>{{ tpl.code }}</code></span>
              </div>
              <h3>{{ tpl.name }}</h3>
              <p class="desc">{{ tpl.description || 'Sin descripción' }}</p>

              <div class="impact-stats">
                <div class="stat">
                  <span class="val">{{ tpl.tenants_count }}</span>
                  <span class="lbl">Empresas que lo usan</span>
                </div>
                <div class="stat">
                  <span class="val">{{ tpl.users_count }}</span>
                  <span class="lbl">Usuarios asignados</span>
                </div>
              </div>

              <div class="perms-summary">
                <strong>{{ tpl.permissions.length }} permisos asignados:</strong>
                <div class="chips">
                  @for (p of tpl.permissions.slice(0, 8); track p) {
                    <span class="chip">{{ p }}</span>
                  }
                  @if (tpl.permissions.length > 8) {
                    <span class="chip more">+{{ tpl.permissions.length - 8 }} más</span>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .roles-container { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .header h2 { margin: 0 0 0.25rem 0; color: var(--color-text-primary, #111827); }
    .subtitle { margin: 0; color: var(--color-text-secondary, #6b7280); font-size: 0.875rem; }
    .btn { padding: 0.5rem 1rem; border-radius: 0.375rem; font-weight: 500; cursor: pointer; border: 1px solid transparent; }
    .btn-secondary { background: var(--color-surface, #fff); border-color: var(--color-border, #d1d5db); color: var(--color-text-primary, #374151); }
    .templates-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1.25rem; }
    .template-card {
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e5e7eb);
      border-radius: 0.5rem;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
    .badge { font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 9999px; font-weight: 600; }
    .badge.system { background: #e0e7ff; color: #3730a3; }
    .template-card h3 { margin: 0 0 0.25rem 0; color: var(--color-text-primary, #111827); }
    .desc { font-size: 0.875rem; color: var(--color-text-secondary, #4b5563); margin: 0 0 1rem 0; flex-grow: 1; }
    .impact-stats {
      display: flex;
      gap: 1.5rem;
      background: var(--color-surface-hover, #f9fafb);
      padding: 0.75rem;
      border-radius: 0.375rem;
      margin-bottom: 1rem;
    }
    .stat .val { font-size: 1.125rem; font-weight: 700; color: var(--color-text-primary, #111827); display: block; }
    .stat .lbl { font-size: 0.75rem; color: var(--color-text-secondary, #6b7280); }
    .perms-summary strong { font-size: 0.8125rem; color: var(--color-text-secondary, #374151); display: block; margin-bottom: 0.5rem; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.375rem; }
    .chip { font-size: 0.75rem; background: #f3f4f6; color: #374151; padding: 0.125rem 0.375rem; border-radius: 0.25rem; }
    .chip.more { font-weight: 600; color: #4f46e5; }
    .loading { text-align: center; padding: 3rem; color: var(--color-text-secondary, #6b7280); }
    .alert-error { background: #fee2e2; color: #991b1b; padding: 1rem; border-radius: 0.375rem; }
  `]
})
export class PlantillasRolesComponent implements OnInit {
  private api = inject(PlataformaApi);

  templates = signal<RoleTemplate[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.roleTemplates().subscribe({
      next: (data) => {
        this.templates.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Error al cargar plantillas de roles.');
        this.loading.set(false);
      }
    });
  }
}
