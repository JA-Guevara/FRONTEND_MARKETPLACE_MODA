import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmpresaAdminApi } from '../infrastructure/empresa-admin.api';
import {
  PERMISSION_GROUPS,
  PermissionGroup,
  RoleView,
  toPermissionCodes,
} from '../domain/empresa-admin.models';
import { Permission } from '../../../shared/models';

@Component({
  selector: 'fs-roles-empresa',
  imports: [FormsModule],
  template: `
    <div class="crumbs">Personal</div>
    <div class="page-h">
      <div>
        <h1>Roles y permisos</h1>
        <p>
          Los roles de sistema son plantillas y no se editan. Crea roles propios
          combinando permisos de tu empresa.
        </p>
      </div>
      <div class="acts">
        <button type="button" class="btn primary" (click)="abrirModalNuevo()">
          ＋ Nuevo rol
        </button>
      </div>
    </div>

    @if (errorAlert()) {
      <div class="alert danger" style="margin-bottom: 14px">
        <span>⚠</span>
        <div><b>Error:</b> {{ errorAlert() }}</div>
      </div>
    }

    @if (successAlert()) {
      <div class="alert ok" style="margin-bottom: 14px">
        <span>✔</span>
        <div>{{ successAlert() }}</div>
      </div>
    }

    <div class="roles-layout">
      <!-- Panel izquierdo: lista de roles -->
      <div class="card role-list">
        @for (r of roles(); track r.id) {
          <button
            type="button"
            class="role-item"
            [class.on]="selectedRole()?.id === r.id"
            (click)="selectRole(r)"
          >
            <span>{{ r.is_template ? '🔒' : '◉' }}</span>
            <div style="flex:1">
              <b>{{ r.name }}</b>
              <span class="sub">
                {{ r.is_template ? 'Sistema' : 'Propio' }} · {{ r.users_count }}
                usuario{{ r.users_count === 1 ? '' : 's' }}
              </span>
            </div>
            <span
              class="badge"
              [class.neutral]="r.is_template"
              [class.plan]="!r.is_template && r.is_active"
              [class.danger]="!r.is_template && !r.is_active"
            >
              {{ r.is_template ? 'Sistema' : r.is_active ? 'Propio' : 'Inactivo' }}
            </span>
          </button>
        }
      </div>

      <!-- Panel derecho: detalle del rol -->
      @if (selectedRole(); as rol) {
        <div class="card">
          <div
            style="display: flex; justify-content: space-between; align-items: center"
          >
            <div>
              <h3>{{ rol.name }}</h3>
              <p class="muted" style="margin: 2px 0 0; font-size: 13px">
                {{ rol.description || 'Sin descripción' }}
              </p>
            </div>
            @if (!rol.is_template) {
              <button
                type="button"
                class="btn sm"
                [class.danger]="rol.is_active"
                (click)="toggleActivo(rol)"
              >
                {{ rol.is_active ? 'Desactivar' : 'Activar' }}
              </button>
            } @else {
              <button
                type="button"
                class="btn sm"
                (click)="duplicarComoPropio(rol)"
              >
                Duplicar como propio
              </button>
            }
          </div>

          @if (rol.is_template) {
            <div class="alert info" style="margin-top: 14px">
              <span>ⓘ</span>
              <div>
                <b>Rol de plantilla del sistema.</b> Los permisos son fijos. Para
                personalizarlo usa «Duplicar como propio».
              </div>
            </div>
          }

          <table class="matrix">
            <thead>
              <tr>
                <th>Módulo</th>
                <th>Ver</th>
                <th>Gestionar</th>
              </tr>
            </thead>
            <tbody>
              @for (grp of permissionGroups; track grp.module) {
                <tr>
                  <td><b>{{ grp.module }}</b></td>
                  <td>
                    <label
                      class="switch-label"
                      [class.disabled]="rol.is_template"
                    >
                      <input
                        type="checkbox"
                        [checked]="permMatrix[grp.module]?.read"
                        [disabled]="rol.is_template"
                        (change)="togglePerm(grp.module, 'read')"
                      />
                      <span>{{ grp.read }}</span>
                    </label>
                  </td>
                  <td>
                    @if (grp.write) {
                      <label
                        class="switch-label"
                        [class.disabled]="rol.is_template"
                      >
                        <input
                          type="checkbox"
                          [checked]="permMatrix[grp.module]?.write"
                          [disabled]="rol.is_template"
                          (change)="togglePerm(grp.module, 'write')"
                        />
                        <span>{{ grp.write }}</span>
                      </label>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>

          @if (!rol.is_template) {
            <div class="acts">
              <button type="button" class="btn ghost" (click)="resetMatrix()">
                Descartar
              </button>
              <button
                type="button"
                class="btn primary"
                [disabled]="saving()"
                (click)="guardarPermisos()"
              >
                {{ saving() ? 'Guardando…' : 'Guardar cambios' }}
              </button>
            </div>
          }
        </div>
      }
    </div>

    <!-- Modal nuevo rol -->
    @if (modalNuevoOpen()) {
      <div class="sp2-scrim" (click)="modalNuevoOpen.set(false)">
        <div class="sp2-dialog" (click)="$event.stopPropagation()">
          <h2>＋ Nuevo rol propio</h2>
          <p class="muted" style="margin: 4px 0 16px; font-size: 13px">
            Crea un perfil con los permisos que requiera el personal de tu empresa.
          </p>

          <label>
            <span>Nombre del rol *</span>
            <input
              type="text"
              [(ngModel)]="nuevoNombre"
              placeholder="Ej. Vendedora de piso"
            />
          </label>

          <label style="margin-top: 10px">
            <span>Descripción</span>
            <textarea
              [(ngModel)]="nuevaDescripcion"
              rows="2"
              placeholder="Breve detalle de las funciones asignadas a este rol…"
            ></textarea>
          </label>

          <footer style="display:flex; justify-content: flex-end; gap: 8px; margin-top: 20px">
            <button
              type="button"
              class="btn ghost"
              (click)="modalNuevoOpen.set(false)"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="btn primary"
              [disabled]="!nuevoNombre.trim() || saving()"
              (click)="crearRol()"
            >
              {{ saving() ? 'Creando…' : 'Crear rol' }}
            </button>
          </footer>
        </div>
      </div>
    }
  `,
  styleUrl: './roles-empresa.component.scss',
})
export class RolesEmpresaComponent {
  private api = inject(EmpresaAdminApi);

  readonly permissionGroups = PERMISSION_GROUPS;

  roles = signal<RoleView[]>([]);
  allPermissions = signal<Permission[]>([]);
  selectedRole = signal<RoleView | null>(null);

  permMatrix: Record<string, { read: boolean; write: boolean }> = {};
  saving = signal(false);
  errorAlert = signal<string | null>(null);
  successAlert = signal<string | null>(null);

  modalNuevoOpen = signal(false);
  nuevoNombre = '';
  nuevaDescripcion = '';

  constructor() {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.api.roles().subscribe({
      next: (list) => {
        this.roles.set(list);
        if (list.length > 0 && !this.selectedRole()) {
          this.selectRole(list[0]);
        } else if (this.selectedRole()) {
          const updated = list.find((r) => r.id === this.selectedRole()!.id);
          if (updated) this.selectRole(updated);
        }
      },
      error: () => {},
    });

    this.api.permissions().subscribe({
      next: (perms) => this.allPermissions.set(perms),
      error: () => {},
    });
  }

  selectRole(r: RoleView): void {
    this.selectedRole.set(r);
    this.errorAlert.set(null);
    this.successAlert.set(null);
    this.buildMatrix(r);
  }

  private buildMatrix(r: RoleView): void {
    const rolePermCodes = new Set(r.permissions.map((p) => p.code));
    const matrix: Record<string, { read: boolean; write: boolean }> = {};

    for (const grp of this.permissionGroups) {
      matrix[grp.module] = {
        read: rolePermCodes.has(grp.read),
        write: grp.write ? rolePermCodes.has(grp.write) : false,
      };
    }
    this.permMatrix = matrix;
  }

  resetMatrix(): void {
    const r = this.selectedRole();
    if (r) this.buildMatrix(r);
  }

  togglePerm(module: string, type: 'read' | 'write'): void {
    if (this.selectedRole()?.is_template) return;
    if (!this.permMatrix[module]) {
      this.permMatrix[module] = { read: false, write: false };
    }
    const current = this.permMatrix[module][type];
    this.permMatrix[module][type] = !current;

    // Si activa write, activar automáticamente read
    if (type === 'write' && this.permMatrix[module].write) {
      this.permMatrix[module].read = true;
    }
    // Si desactiva read, desactivar automáticamente write
    if (type === 'read' && !this.permMatrix[module].read) {
      this.permMatrix[module].write = false;
    }
  }

  guardarPermisos(): void {
    const r = this.selectedRole();
    if (!r || r.is_template || this.saving()) return;

    this.saving.set(true);
    this.errorAlert.set(null);
    this.successAlert.set(null);

    const targetCodes = toPermissionCodes(this.permMatrix);
    const targetIds = this.allPermissions()
      .filter((p) => targetCodes.includes(p.code))
      .map((p) => p.id);

    this.api.setRolePermissions(r.id, targetIds).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.successAlert.set('Permisos actualizados correctamente.');
        this.cargarDatos();
      },
      error: (err) => {
        this.saving.set(false);
        if (err.status === 409) {
          this.errorAlert.set('Los roles de sistema no se editan.');
        } else if (err.status === 403) {
          this.errorAlert.set('No tienes permiso para asignar permisos fuera de tu empresa.');
        } else {
          this.errorAlert.set(err.error?.message || 'Error al actualizar permisos.');
        }
      },
    });
  }

  toggleActivo(rol: RoleView): void {
    const action = rol.is_active
      ? this.api.deactivateRole(rol.id)
      : this.api.activateRole(rol.id);

    action.subscribe({
      next: () => {
        this.successAlert.set(`Rol ${rol.is_active ? 'desactivado' : 'activado'} correctamente.`);
        this.cargarDatos();
      },
      error: (err) => {
        this.errorAlert.set(err.error?.message || 'Error al cambiar estado del rol.');
      },
    });
  }

  duplicarComoPropio(plantilla: RoleView): void {
    this.nuevoNombre = `${plantilla.name} (Copia)`;
    this.nuevaDescripcion = plantilla.description ?? '';
    this.modalNuevoOpen.set(true);
  }

  abrirModalNuevo(): void {
    this.nuevoNombre = '';
    this.nuevaDescripcion = '';
    this.modalNuevoOpen.set(true);
  }

  crearRol(): void {
    if (!this.nuevoNombre.trim() || this.saving()) return;
    this.saving.set(true);
    this.errorAlert.set(null);

    this.api
      .createRole({
        name: this.nuevoNombre.trim(),
        description: this.nuevaDescripcion.trim() || undefined,
      })
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          this.modalNuevoOpen.set(false);
          this.successAlert.set('Rol creado exitosamente.');
          this.cargarDatos();
        },
        error: (err) => {
          this.saving.set(false);
          this.errorAlert.set(err.error?.message || 'Error al crear el rol.');
        },
      });
  }
}
