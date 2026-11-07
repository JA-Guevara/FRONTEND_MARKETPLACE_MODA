import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { errorMessage } from '../../../shared/errors';
import { EmpresaAdminApi } from '../infrastructure/empresa-admin.api';
import { RoleView } from '../domain/empresa-admin.models';
import { Permission } from '../../../shared/models';

@Component({
  selector: 'fs-roles-empresa',
  imports: [FormsModule],
  template: `
    <div class="crumbs">Personal</div>
    <div class="page-h">
      <div>
        <h1>{{ catalogOnly ? "Catálogo de permisos" : "Roles de empresa" }}</h1>
        <p>
          {{ catalogOnly ? "Consulta los permisos disponibles para tu empresa." : "Crea roles propios y asigna los permisos de tu empresa." }}
        </p>
      </div>
      @if (canWrite()) {
      <div class="acts">
        <button type="button" class="btn primary" (click)="abrirModalNuevo()">
          ＋ Nuevo rol
        </button>
      </div>
      }
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

    @if (loading()) {
      <p role="status">Cargando permisos…</p>
    } @else if (catalogOnly) {
      <table class="matrix">
        <thead><tr><th>Permiso</th><th>Módulo</th><th>Código</th></tr></thead>
        <tbody>
          @for (permission of allPermissions(); track permission.id) {
            <tr><td>{{ permission.name }}</td><td>{{ permission.module }}</td><td>{{ permission.code }}</td></tr>
          } @empty { <tr><td colspan="3">No hay permisos disponibles.</td></tr> }
        </tbody>
      </table>
    } @else {
    <div class="roles-layout">
      <!-- Panel izquierdo: lista de roles -->
      <div class="card role-list">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-secondary, #6b7280); padding: 8px 12px 4px;">
          Roles de empresa y plantillas ({{ roles().length }})
        </div>
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
                {{ r.is_template ? 'Plantilla sistema' : 'Propio de empresa' }} · {{ r.users_count }}
                usuario{{ r.users_count === 1 ? '' : 's' }}
              </span>
            </div>
            <span
              class="badge"
              [class.neutral]="r.is_template"
              [class.plan]="!r.is_template && r.is_active"
              [class.danger]="!r.is_template && !r.is_active"
            >
              {{ r.is_template ? 'Plantilla' : r.is_active ? 'Propio' : 'Inactivo' }}
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
            @if (canWrite() && !locked(rol)) {
              <button
                type="button"
                class="btn sm"
                [class.danger]="rol.is_active"
                (click)="toggleActivo(rol)"
              >
                {{ rol.is_active ? 'Desactivar' : 'Activar' }}
              </button>
              <button type="button" class="btn sm" (click)="editarRol(rol)">Editar</button>
              <button type="button" class="btn sm danger" (click)="pendingDelete.set(rol)">Eliminar</button>
            } @else if (canWrite()) {
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
              <div style="flex: 1">
                <b>Rol de plantilla del sistema.</b> Los permisos de esta plantilla son de solo lectura porque aplican como base. Para personalizar permisos para tu empresa, usa <b>«Duplicar como propio»</b>.
              </div>
              <button
                type="button"
                class="btn sm primary"
                (click)="duplicarComoPropio(rol)"
              >
                Duplicar como propio
              </button>
            </div>
          }

          <table class="matrix">
            <thead><tr><th>Módulo</th><th>Permiso</th><th>Asignado</th></tr></thead>
            <tbody>
              @for (permission of allPermissions(); track permission.id) {
                <tr>
                  <td>{{ permission.module }}</td>
                  <td>{{ permission.name }} <small>{{ permission.code }}</small></td>
                  <td><input type="checkbox" [attr.aria-label]="permission.name"
                    [checked]="selectedPermissions.has(permission.id)"
                    [disabled]="locked(rol) || !canWrite() || saving()"
                    (change)="togglePermission(permission.id)" /></td>
                </tr>
              }
            </tbody>
          </table>

          @if (canWrite() && !locked(rol) && catalogLoaded()) {
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

    }

    @if (pendingDelete(); as role) {
      <div class="sp2-scrim">
        <div class="sp2-dialog" role="dialog" aria-modal="true" aria-label="Eliminar rol">
          <h2>Eliminar {{ role.name }}</h2>
          <p>Solo se pueden eliminar roles que no están asignados a usuarios.</p>
          <button type="button" class="btn" (click)="pendingDelete.set(null)">Cancelar</button>
          <button type="button" class="btn danger" [disabled]="saving()" (click)="eliminarRol(role)">Eliminar rol</button>
        </div>
      </div>
    }

    <!-- Modal de rol -->
    @if (modalNuevoOpen()) {
      <div class="sp2-scrim" (click)="modalNuevoOpen.set(false)">
        <div class="sp2-dialog" (click)="$event.stopPropagation()">
          <h2>{{ editingRole ? 'Editar rol propio' : 'Nuevo rol propio' }}</h2>
          <p class="muted" style="margin: 4px 0 16px; font-size: 13px">
            Crea un perfil con los permisos que requiera el personal de tu empresa.
          </p>

          <label>
            <span>Nombre del rol *</span>
            <input
              type="text"
              [(ngModel)]="nuevoNombre" maxlength="100"
              placeholder="Ej. Vendedora de piso"
            />
          </label>

          <label style="margin-top: 10px">
            <span>Descripción</span>
            <textarea
              [(ngModel)]="nuevaDescripcion" maxlength="255"
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
              [disabled]="nuevoNombre.trim().length < 2 || saving()"
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
  private session = inject(SessionService);
  readonly catalogOnly = inject(ActivatedRoute).snapshot.data['permissionsCatalog'] === true;
  readonly roles = signal<RoleView[]>([]);
  readonly allPermissions = signal<Permission[]>([]);
  readonly selectedRole = signal<RoleView | null>(null);
  readonly catalogLoaded = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorAlert = signal<string | null>(null);
  readonly successAlert = signal<string | null>(null);
  readonly pendingDelete = signal<RoleView | null>(null);
  readonly modalNuevoOpen = signal(false);
  selectedPermissions = new Set<string>();
  editingRole: RoleView | null = null;
  private copiedPermissions: string[] = [];
  nuevoNombre = '';
  nuevaDescripcion = '';

  constructor() {
    this.cargarDatos();
  }

  canWrite(): boolean {
    return !this.catalogOnly && !this.session.readOnly()
      && this.session.can('roles.write');
  }

  locked(role: RoleView): boolean {
    return role.is_template || role.is_system === true;
  }

  cargarDatos(selectedId = this.selectedRole()?.id): void {
    this.loading.set(true);
    this.catalogLoaded.set(false);
    forkJoin({
      roles: this.catalogOnly ? of([] as RoleView[]) : this.api.roles(),
      permissions: this.api.permissions(),
    }).subscribe({
      next: ({ roles, permissions }) => {
        this.roles.set(roles);
        this.allPermissions.set(permissions);
        this.catalogLoaded.set(true);
        this.selectedRole.set(roles.find((role) => role.id === selectedId) ?? roles[0] ?? null);
        this.resetMatrix();
        this.loading.set(false);
      },
      error: (error) => {
        this.errorAlert.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  selectRole(role: RoleView): void {
    this.selectedRole.set(role);
    this.errorAlert.set(null);
    this.successAlert.set(null);
    this.resetMatrix();
  }

  resetMatrix(): void {
    this.selectedPermissions = new Set(this.selectedRole()?.permissions.map((permission) => permission.id));
  }

  togglePermission(id: string): void {
    const role = this.selectedRole();
    if (!role || !this.canWrite() || this.locked(role) || this.saving()) return;
    if (this.selectedPermissions.has(id)) this.selectedPermissions.delete(id);
    else this.selectedPermissions.add(id);
  }

  guardarPermisos(): void {
    const role = this.selectedRole();
    if (!role || !this.canWrite() || this.locked(role) || !this.catalogLoaded() || this.saving()) return;
    const ids = this.allPermissions().filter((permission) => this.selectedPermissions.has(permission.id))
      .map((permission) => permission.id);
    this.mutate(this.api.setRolePermissions(role.id, ids), 'Permisos actualizados.', () => this.cargarDatos(role.id));
  }

  toggleActivo(role: RoleView): void {
    if (!this.canWrite() || this.locked(role) || this.saving()) return;
    const action = role.is_active ? this.api.deactivateRole(role.id) : this.api.activateRole(role.id);
    this.mutate(action, role.is_active ? 'Rol desactivado.' : 'Rol activado.', () => this.cargarDatos(role.id));
  }

  eliminarRol(role: RoleView): void {
    if (!this.canWrite() || this.locked(role) || this.saving()) return;
    this.mutate(this.api.deleteRole(role.id), 'Rol eliminado.', () => {
      this.pendingDelete.set(null);
      this.cargarDatos();
    });
  }

  duplicarComoPropio(role: RoleView): void {
    this.abrirModalNuevo();
    this.nuevoNombre = `${role.name} (Copia)`.slice(0, 100);
    this.nuevaDescripcion = role.description ?? '';
    const available = new Set(this.allPermissions().map((permission) => permission.id));
    this.copiedPermissions = role.permissions.filter((permission) => available.has(permission.id))
      .map((permission) => permission.id);
  }

  editarRol(role: RoleView): void {
    if (!this.canWrite() || this.locked(role)) return;
    this.editingRole = role;
    this.nuevoNombre = role.name;
    this.nuevaDescripcion = role.description ?? '';
    this.modalNuevoOpen.set(true);
  }

  abrirModalNuevo(): void {
    if (!this.canWrite()) return;
    this.editingRole = null;
    this.copiedPermissions = [];
    this.nuevoNombre = '';
    this.nuevaDescripcion = '';
    this.modalNuevoOpen.set(true);
  }

  crearRol(): void {
    const name = this.nuevoNombre.trim();
    if (name.length < 2 || !this.canWrite() || this.saving()) return;
    const description = this.nuevaDescripcion.trim();
    const code = 'rol_' + name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 46);
    const request = this.editingRole
      ? this.api.updateRole(this.editingRole.id, { name, description })
      : this.api.createRole({ code, name, description, permission_ids: this.copiedPermissions });
    this.mutate(request, 'Rol guardado.', (role) => {
      this.modalNuevoOpen.set(false);
      this.cargarDatos(role.data.id);
    });
  }

  private mutate<T>(request: import('rxjs').Observable<T>, message: string, success: (result: T) => void): void {
    this.saving.set(true);
    this.errorAlert.set(null);
    this.successAlert.set(null);
    request.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.successAlert.set(message);
        success(result);
      },
      error: (error) => {
        this.saving.set(false);
        this.errorAlert.set(errorMessage(error));
      },
    });
  }
}
