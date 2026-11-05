import { Component, Input, Output, EventEmitter, OnChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DrawerComponent } from '../../../shared/ui/drawer.component';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import {
  ModuleDetail,
  PlatformModule,
  ModuleLifecycle,
  formatLifecycle,
} from '../domain/gobierno.models';
import { errorMessage } from '../../../shared/errors';

@Component({
  selector: 'fs-modulo-drawer',
  imports: [CommonModule, FormsModule, RouterLink, DrawerComponent],
  styleUrl: './modulo-drawer.component.scss',
  template: `<fs-drawer
    [open]="true"
    [title]="detail()?.name || 'Detalle del módulo'"
    (closed)="closed.emit()"
  >
    @if (loading()) {
      <p role="status">Cargando módulo…</p>
    }
    @if (error()) {
      <p class="alert danger" role="alert">{{ error() }}</p>
    }
    @if (detail(); as module) {
      <p>
        <span class="badge">{{ formatLifecycle(module.lifecycle) }}</span>
        <code>{{ module.code }}</code>
      </p>
      <nav aria-label="Detalle del módulo">
        @for (item of tabs; track item) {
          <button type="button" [class.on]="tab === item" (click)="tab = item">{{ item }}</button>
        }
      </nav>
      @if (tab === 'General') {
        <label>Nombre<input [(ngModel)]="name" [disabled]="!canWrite()" maxlength="100" /></label>
        <label
          >Descripción para el cliente<textarea
            [(ngModel)]="description"
            rows="3"
            [disabled]="!canWrite()"
          ></textarea>
        </label>
        <label
          >Estado de lanzamiento<select
            [(ngModel)]="lifecycle"
            [disabled]="!canWrite() || module.kind === 'BASE'"
          >
            @for (state of states; track state) {
              <option [value]="state">{{ formatLifecycle(state) }}</option>
            }
          </select></label
        >
        <fieldset [disabled]="!canWrite()">
          <legend>Depende de</legend>
          @for (item of modules; track item.code) {
            @if (item.code !== module.code) {
              <label class="check"
                ><input
                  type="checkbox"
                  [checked]="dependencies.includes(item.code)"
                  (change)="toggleDependency(item.code)"
                />{{ item.name }}</label
              >
            }
          }
        </fieldset>
        <p class="notice">
          Borrador → Beta → Disponible → Retirado. Publicar como disponible exige una vista previa
          registrada en la empresa demo.
        </p>
      }
      @if (tab === 'Permisos') {
        <p class="muted">Un permiso pertenece a un único módulo. Se admiten permisos de empresa.</p>
        @for (permission of module.permissions; track permission.code) {
          <div class="row">
            <code>{{ permission.code }}</code
            ><span>{{ permission.name }}</span>
          </div>
        } @empty {
          <p>No tiene permisos asignados.</p>
        }
        @if (canWrite()) {
          <label
            >Códigos de permisos (uno por línea)<textarea
              [(ngModel)]="permissionCodes"
              rows="7"
            ></textarea></label
          ><button type="button" [disabled]="saving()" (click)="savePermissions()">
            Guardar permisos
          </button>
        }
      }
      @if (tab === 'Pantallas') {
        @for (path of module.web_routes; track path) {
          <div class="row">
            <code>{{ path }}</code>
          </div>
        } @empty {
          <p>No tiene pantallas registradas.</p>
        }
      }
      @if (tab === 'Empresas') {
        @for (tenant of module.active_tenants; track tenant.id) {
          <a class="row" [routerLink]="['/admin/plataforma/empresas', tenant.id]"
            >{{ tenant.trade_name }} →</a
          >
        } @empty {
          <p>No hay empresas con este módulo activo.</p>
        }
      }
      @if (tab === 'Historial') {
        @for (event of module.history; track event.id) {
          <article class="event">
            <b>{{ event.description }}</b
            ><small
              >{{ event.actor_name || 'Plataforma' }} ·
              {{ event.created_at | date: 'short' }}</small
            >
          </article>
        } @empty {
          <p>No hay eventos registrados para este módulo.</p>
        }
      }
    }
    <div drawer-footer>
      <button type="button" (click)="closed.emit()">Cerrar</button>
      @if (detail(); as module) {
        @if (session.can('sandbox.manage')) {
          <button type="button" (click)="preview.emit(module.code)">Probar en empresa demo</button>
        }
        @if (canWrite() && tab === 'General') {
          <button
            type="button"
            class="primary"
            [disabled]="saving() || !name.trim()"
            (click)="save()"
          >
            {{ saving() ? 'Guardando…' : 'Guardar' }}
          </button>
        }
      }
    </div>
  </fs-drawer>`,
})
export class ModuloDrawerComponent implements OnChanges {
  @Input({ required: true }) code = '';
  @Input() modules: PlatformModule[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() changed = new EventEmitter<void>();
  @Output() preview = new EventEmitter<string>();
  private api = inject(PlataformaApi);
  session = inject(SessionService);
  detail = signal<ModuleDetail | null>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  tabs = ['General', 'Permisos', 'Pantallas', 'Empresas', 'Historial'];
  tab = 'General';
  states: ModuleLifecycle[] = ['BORRADOR', 'BETA', 'GA', 'RETIRADO'];
  name = '';
  description = '';
  lifecycle: ModuleLifecycle = 'BORRADOR';
  dependencies: string[] = [];
  permissionCodes = '';
  formatLifecycle = formatLifecycle;
  canWrite() {
    return this.session.can('modules.write');
  }
  ngOnChanges() {
    void this.load();
  }
  private accept(detail: ModuleDetail) {
    this.detail.set(detail);
    this.name = detail.name;
    this.description = detail.description ?? '';
    this.lifecycle = detail.lifecycle;
    this.dependencies = [...detail.depends_on];
    this.permissionCodes = detail.permissions.map((p) => p.code).join('\n');
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.accept(await firstValueFrom(this.api.module(this.code)));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
  toggleDependency(code: string) {
    this.dependencies = this.dependencies.includes(code)
      ? this.dependencies.filter((value) => value !== code)
      : [...this.dependencies, code];
  }
  async save() {
    if (this.saving() || !this.canWrite()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      this.accept(
        await firstValueFrom(
          this.api.updateModule(this.code, {
            name: this.name.trim(),
            description: this.description.trim(),
            lifecycle: this.lifecycle,
            depends_on: this.dependencies,
          }),
        ),
      );
      this.changed.emit();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async savePermissions() {
    if (this.saving() || !this.canWrite()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      this.accept(
        await firstValueFrom(
          this.api.setModulePermissions(this.code, [
            ...new Set(this.permissionCodes.split(/[\s,]+/).filter(Boolean)),
          ]),
        ),
      );
      this.changed.emit();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
}
