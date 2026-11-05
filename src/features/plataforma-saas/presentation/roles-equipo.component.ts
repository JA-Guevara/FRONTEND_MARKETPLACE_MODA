import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { RoleTemplate } from '../domain/gobierno.models';

@Component({
  selector: 'fs-roles-equipo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="equipo-container">
      <header class="header">
        <div>
          <h2>Roles del Equipo de Plataforma</h2>
          <p class="subtitle">Roles con alcance global para la administración técnica y soporte del SaaS</p>
        </div>
        <button class="btn btn-secondary" (click)="loadTeamRoles()">Actualizar</button>
      </header>

      @if (loading()) {
        <div class="loading">Cargando roles de equipo...</div>
      } @else if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      } @else {
        <div class="roles-list">
          @for (role of roles(); track role.id) {
            <div class="role-item">
              <div class="role-info">
                <div class="role-title-row">
                  <h3>{{ role.name }}</h3>
                  <code>{{ role.code }}</code>
                  @if (role.is_system) {
                    <span class="badge system">Sistema</span>
                  }
                </div>
                <p class="role-desc">{{ role.description || 'Sin descripción' }}</p>
                <div class="role-perms">
                  <span class="count-tag">{{ role.permissions.length }} permisos asignados</span>
                </div>
              </div>
              <div class="role-users-count">
                <span class="num">{{ role.users_count }}</span>
                <span class="lbl">Usuarios</span>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .equipo-container { padding: 1.5rem; max-width: 1000px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .header h2 { margin: 0 0 0.25rem 0; color: var(--color-text-primary, #111827); }
    .subtitle { margin: 0; color: var(--color-text-secondary, #6b7280); font-size: 0.875rem; }
    .btn { padding: 0.5rem 1rem; border-radius: 0.375rem; font-weight: 500; cursor: pointer; border: 1px solid transparent; }
    .btn-secondary { background: var(--color-surface, #fff); border-color: var(--color-border, #d1d5db); color: var(--color-text-primary, #374151); }
    .roles-list { display: flex; flex-direction: column; gap: 1rem; }
    .role-item {
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e5e7eb);
      border-radius: 0.5rem;
      padding: 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .role-title-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.375rem; }
    .role-title-row h3 { margin: 0; font-size: 1.125rem; color: var(--color-text-primary, #111827); }
    .badge.system { background: #e0e7ff; color: #3730a3; font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 9999px; }
    .role-desc { margin: 0 0 0.5rem 0; font-size: 0.875rem; color: var(--color-text-secondary, #4b5563); }
    .count-tag { font-size: 0.75rem; color: var(--color-text-secondary, #6b7280); background: #f3f4f6; padding: 0.125rem 0.5rem; border-radius: 0.25rem; }
    .role-users-count { text-align: center; min-width: 80px; }
    .role-users-count .num { font-size: 1.5rem; font-weight: 700; color: var(--color-text-primary, #111827); display: block; }
    .role-users-count .lbl { font-size: 0.75rem; color: var(--color-text-secondary, #6b7280); }
    .loading { text-align: center; padding: 3rem; color: var(--color-text-secondary, #6b7280); }
    .alert-error { background: #fee2e2; color: #991b1b; padding: 1rem; border-radius: 0.375rem; }
  `]
})
export class RolesEquipoComponent implements OnInit {
  private api = inject(PlataformaApi);

  roles = signal<RoleTemplate[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadTeamRoles();
  }

  loadTeamRoles(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.teamRoles().subscribe({
      next: (data) => {
        this.roles.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Error al cargar roles de equipo.');
        this.loading.set(false);
      }
    });
  }
}
