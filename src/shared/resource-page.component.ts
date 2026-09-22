import { DialogFocusDirective } from './dialog-focus.directive';
import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../app/core/shared/api.service';
import { SessionService } from '../features/usuarios-catalogo/application/session.service';
import { Entity, Page } from './models';
import { Field, Resource } from './form-schema';
import { EntityFormComponent } from './entity-form.component';
import { errorMessage } from './errors';
import { BulkExcelComponent, EXCEL_RESOURCES } from './bulk-excel.component';
import { ProductImagesComponent } from './product-images.component';
import { IconComponent } from './icon.component';

@Component({
  selector: 'fs-resource-page',
  imports: [
    FormsModule,
    RouterLink,
    EntityFormComponent,
    DialogFocusDirective,
    BulkExcelComponent,
    ProductImagesComponent,
    IconComponent,
  ],
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">{{ config.group }}</p>
        <h1>{{ config.title }}</h1>
        <p class="muted">{{ total() }} registros encontrados</p>
      </div>
      @if (canWrite()) {
        <button class="primary" (click)="open()">
          <fs-icon name="plus" />{{ config.feminine ? 'Nueva' : 'Nuevo' }} {{ config.singular }}
        </button>
      }
    </div>
    @if (error()) {
      <div class="alert error" role="alert">
        {{ error() }} <button (click)="load()"><fs-icon name="refresh" />Reintentar</button>
      </div>
    }
    @if (message()) {
      <div class="alert success" role="status">{{ message() }}</div>
    }
    <div class="toolbar">
      @if (config.search) {
        <form (ngSubmit)="page = 1; load()" class="search-inline">
          <input
            name="search"
            [(ngModel)]="search"
            aria-label="Buscar registros"
            placeholder="Buscar…"
          /><button><fs-icon name="search" />Buscar</button>
        </form>
      }
      @if (config.states && config.key !== 'products') {
        <label class="check"
          ><input
            type="checkbox"
            [(ngModel)]="includeInactive"
            (change)="page = 1; load()"
          />Mostrar inactivos</label
        >
      }
      @if (config.softDelete) {
        <label class="check"
          ><input type="checkbox" [(ngModel)]="includeDeleted" (change)="page = 1; load()" />Mostrar
          eliminados</label
        >
      }
      @if (config.key === 'users') {
        <label
          >Rol
          <input
            aria-label="Filtrar por código de rol"
            [(ngModel)]="roleFilter"
            placeholder="Ej.: client"
            (change)="page = 1; load()"
        /></label>
      }
      @if (config.key === 'cash-points') {
        <label
          >Sucursal
          <select aria-label="Filtrar por sucursal" [(ngModel)]="branchFilter" (change)="load()">
            <option value="">Todas</option>
            @for (b of branches(); track b.id) {
              <option [value]="b.id">{{ b['name'] }}</option>
            }
          </select></label
        >
      }
      <button (click)="load()" [disabled]="loading()">
        <fs-icon name="refresh" />{{ loading() ? 'Actualizando…' : 'Actualizar' }}
      </button>
    </div>
    @if (excelSupported()) {
      <fs-bulk-excel
        [resource]="config.key"
        [canWrite]="canWrite()"
        [filters]="{
          search: search,
          include_inactive: includeInactive,
          include_deleted: includeDeleted,
          branch_id: branchFilter,
        }"
        (imported)="load()"
      />
    }
    @if (loading()) {
      <div class="empty" role="status">Cargando {{ config.title.toLowerCase() }}…</div>
    } @else {
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              @for (column of config.columns; track column.key) {
                <th>{{ column.label }}</th>
              }
              @if (config.states) {
                <th>Estado</th>
              }
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (item of items(); track item.id) {
              <tr>
                @for (column of config.columns; track column.key) {
                  <td>
                    @if (column.key === 'hex_code') {
                      <span class="swatch" [style.background]="item[column.key]"></span>
                    }
                    {{ display(item[column.key], column.key) }}
                  </td>
                }
                @if (config.states) {
                  <td>
                    <span
                      class="badge"
                      [class.inactive]="!item['is_active'] || item['deleted_at']"
                      >{{
                        item['deleted_at'] ? 'Eliminado' : item['is_active'] ? 'Activo' : 'Inactivo'
                      }}</span
                    >
                  </td>
                }
                <td>
                  <div class="row-actions">
                    <button (click)="detail(item)"><fs-icon name="eye" />Ver</button>
                    @if (canWrite()) {
                      @if (!item['deleted_at']) {
                        <button (click)="open(item)"><fs-icon name="edit" />Editar</button>
                      }
                      @if (config.states) {
                        <button
                          (click)="
                            confirmAction(
                              item,
                              item['deleted_at']
                                ? config.key === 'users'
                                  ? 'restore'
                                  : 'activate'
                                : item['is_active']
                                  ? 'deactivate'
                                  : 'activate'
                            )
                          "
                          [disabled]="busy()"
                        >
                          <fs-icon
                            [name]="
                              item['deleted_at'] ? 'refresh' : item['is_active'] ? 'close' : 'check'
                            "
                          />{{
                            item['deleted_at']
                              ? 'Restaurar'
                              : item['is_active']
                                ? 'Desactivar'
                                : 'Activar'
                          }}
                        </button>
                      }
                      @if (!item['deleted_at']) {
                        <button class="danger-text" (click)="confirmAction(item, 'delete')">
                          <fs-icon name="trash" />Eliminar
                        </button>
                      }
                      @if (config.key === 'users' && !item['deleted_at']) {
                        <button (click)="assign(item, 'roles')"><fs-icon name="users" />Roles</button
                        ><button (click)="confirmAction(item, 'unlock')">
                          <fs-icon name="unlock" />Desbloquear
                        </button>
                      }
                      @if (config.key === 'roles') {
                        <button (click)="assign(item, 'permissions')">
                          <fs-icon name="lock" />Permisos
                        </button>
                      }
                    }
                    @if (config.key === 'products') {
                      <a class="button" [routerLink]="['/admin/products', item.id]">
                        <fs-icon name="box" />Variantes y recursos
                      </a>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="config.columns.length + 2">
                  <div class="empty">No hay registros con estos filtros.</div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
    @if (config.paginated) {
      <div class="pagination">
        <button (click)="page = page - 1; load()" [disabled]="page <= 1 || loading()">
          <fs-icon name="arrow-left" />Anterior</button
        ><span>Página {{ page }} de {{ pages() || 1 }}</span
        ><button (click)="page = page + 1; load()" [disabled]="page >= pages() || loading()">
          Siguiente<fs-icon name="arrow-right" />
        </button>
      </div>
    }
    @if (editing()) {
      <div class="modal-backdrop">
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="editor-title"
          [class.product-modal]="config.key === 'products' && !assignment"
          (dismissed)="close()"
        >
          <h2 id="editor-title">
            {{
              assignment
                ? 'Asignar ' + (assignment === 'roles' ? 'roles' : 'permisos')
                : current
                  ? 'Editar ' + config.singular
                  : (config.feminine ? 'Nueva ' : 'Nuevo ') + config.singular
            }}
          </h2>
          @if (formError()) {
            <p class="alert error" role="alert">{{ formError() }}</p>
          }
          <div [class.product-editor-columns]="config.key === 'products' && !assignment">
          @if (config.key === 'products' && !assignment) {
            <fs-product-images [existing]="productImages" [busy]="busy()" />
          }
          <fs-entity-form
            [fields]="editFields"
            [value]="current"
            [busy]="busy()"
            (saved)="save($event)"
            (cancel)="close()"
          />
          </div>
        </section>
      </div>
    }
    @if (viewing()) {
      <div class="modal-backdrop">
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-label="Detalle"
          (dismissed)="viewing.set(null)"
        >
          <h2>Detalle de {{ config.singular }}</h2>
          <dl class="detail-list">
            @for (field of config.fields; track field.key) {
              @if (field.type !== 'password' && !field.createOnly) {
                <dt>{{ field.label }}</dt>
                <dd>{{ display(viewing()![field.key], field.key) }}</dd>
              }
            }
            @if (config.key === 'users') {
              <dt>Roles</dt>
              <dd>{{ display(viewing()!['roles']) }}</dd>
              <dt>Intentos fallidos</dt>
              <dd>{{ viewing()!['failed_login_attempts'] }}</dd>
              <dt>Bloqueado hasta</dt>
              <dd>{{ display(viewing()!['locked_until']) }}</dd>
            }
            @if (config.key === 'roles') {
              <dt>Permisos</dt>
              <dd>{{ display(viewing()!['permissions']) }}</dd>
            }
          </dl>
          <button (click)="viewing.set(null)"><fs-icon name="close" />Cerrar</button>
        </section>
      </div>
    }
    @if (pending) {
      <div class="modal-backdrop">
        <section
          class="modal small"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          (dismissed)="close()"
        >
          <h2 id="confirm-title">{{ actionLabel(pending.action) }} {{ config.singular }}</h2>
          <p>
            Confirmá la operación sobre
            <strong>{{
              pending.item['name'] ||
                pending.item['email'] ||
                pending.item['business_name'] ||
                pending.item['label']
            }}</strong
            >.
          </p>
          @if (config.key === 'branches' && ['delete', 'deactivate'].includes(pending.action)) {
            <p>También se desactivarán las cajas de esta sucursal.</p>
          }
          @if (formError()) {
            <p class="alert error" role="alert">{{ formError() }}</p>
          }
          <div class="form-actions">
            <button class="primary" [disabled]="busy()" (click)="executeAction()">
              <fs-icon name="check" />{{ busy() ? 'Procesando…' : 'Confirmar' }}</button
            ><button [disabled]="busy()" (click)="pending = null">
              <fs-icon name="close" />Cancelar
            </button>
          </div>
        </section>
      </div>
    }
  `,
})
export class ResourcePageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  session = inject(SessionService);
  config!: Resource;
  items = signal<Entity[]>([]);
  total = signal(0);
  pages = signal(0);
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  message = signal('');
  formError = signal('');
  editing = signal(false);
  viewing = signal<Entity | null>(null);
  branches = signal<Entity[]>([]);
  current: Entity | null = null;
  productImages: Entity[] = [];
  @ViewChild(ProductImagesComponent) imageEditor?: ProductImagesComponent;
  editFields: Field[] = [];
  assignment = '';
  pending: { item: Entity; action: string } | null = null;
  page = 1;
  search = '';
  roleFilter = '';
  branchFilter = '';
  includeInactive = true;
  includeDeleted = false;
  private generation = 0;
  ngOnInit() {
    this.route.data.subscribe((data) => {
      this.config = data['resource'];
      this.page = 1;
      this.search = '';
      this.roleFilter = '';
      this.branchFilter = '';
      this.includeDeleted = false;
      this.close();
      void this.load();
    });
  }
  canWrite() {
    return this.session.can(this.config.writePermission);
  }
  excelSupported() {
    return EXCEL_RESOURCES.has(this.config.key);
  }
  async load() {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const query: Record<string, unknown> = {
        include_inactive: this.includeInactive,
        include_deleted: this.includeDeleted,
      };
      if (this.config.paginated) Object.assign(query, { page: this.page, page_size: 20 });
      if (this.config.search) query['search'] = this.search.trim();
      if (this.config.key === 'users') {
        query['role_code'] = this.roleFilter.trim();
        if (!this.includeInactive) query['is_active'] = true;
      }
      if (this.config.key === 'cash-points') query['branch_id'] = this.branchFilter;
      const response = await firstValueFrom(
        this.api.get<Entity[] | Page<Entity>>(this.config.listPath || this.config.path, query),
      );
      if (generation !== this.generation) return;
      const records = Array.isArray(response) ? response : response.items;
      this.items.set(
        this.includeInactive ? records : records.filter((v) => v['is_active'] !== false),
      );
      this.total.set(Array.isArray(response) ? this.items().length : response.total);
      this.pages.set(Array.isArray(response) ? 1 : response.pages);
      if (this.config.key === 'cash-points')
        this.branches.set(
          await firstValueFrom(
            this.api.get<Entity[]>('/organization/branches', {
              include_inactive: true,
              include_deleted: true,
            }),
          ),
        );
    } catch (e) {
      if (generation === this.generation) {
        this.error.set(errorMessage(e));
        this.items.set([]);
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async open(item: Entity | null = null) {
    if (this.config.key === 'products' && item) {
      try {
        item = await firstValueFrom(this.api.get<Entity>(this.config.path + '/' + item.id));
      } catch (error) {
        this.error.set(errorMessage(error));
        return;
      }
    }
    this.current = item;
    this.productImages = item?.['images'] || [];
    this.assignment = '';
    this.editFields = this.config.fields;
    this.formError.set('');
    this.editing.set(true);
  }
  close() {
    if (this.busy()) return;
    this.editing.set(false);
    this.viewing.set(null);
    this.current = null;
    this.assignment = '';
    this.pending = null;
  }
  async detail(item: Entity) {
    this.error.set('');
    try {
      this.viewing.set(
        ['addresses', 'permissions'].includes(this.config.key)
          ? item
          : await firstValueFrom(
              this.api.get<Entity>(`${this.config.path}/${item.id}`, { include_deleted: true }),
            ),
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
  assign(item: Entity, relation: 'roles' | 'permissions') {
    this.assignment = relation;
    this.current = {
      ...item,
      [relation === 'roles' ? 'role_ids' : 'permission_ids']: (item[relation] || []).map(
        (x: Entity) => x.id,
      ),
    };
    this.editFields = [
      {
        key: relation === 'roles' ? 'role_ids' : 'permission_ids',
        label: relation === 'roles' ? 'Roles' : 'Permisos',
        type: 'multi',
        lookup: relation === 'roles' ? '/roles' : '/roles/permissions/all',
        required: relation === 'roles',
      },
    ];
    this.formError.set('');
    this.editing.set(true);
  }
  async save(body: Record<string, unknown>) {
    if (this.busy() || !this.canWrite()) return;
    this.busy.set(true);
    this.formError.set('');
    try {
      const images = this.imageEditor ? await this.imageEditor.prepare() : [];
      if (this.imageEditor) body = { ...body, images };
      const path = `${this.config.path}${this.current ? '/' + this.current.id : ''}${this.assignment ? '/' + this.assignment : ''}`;
      const response = await firstValueFrom(
        this.api.write<Entity>(
          this.assignment ? 'PUT' : this.current ? 'PATCH' : 'POST',
          path,
          body,
        ),
      );
      this.message.set(response.message);
      this.editing.set(false);
      await this.load();
      if (this.config.key === 'products' && !this.current)
        this.message.set(
          'Prenda creada con sus imágenes. Podés agregar tallas, colores y proveedores desde «Variantes y recursos».',
        );
    } catch (e) {
      this.formError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  confirmAction(item: Entity, action: string) {
    this.pending = { item, action };
    this.formError.set('');
  }
  actionLabel(action: string) {
    return (
      {
        delete: 'Eliminar',
        activate: 'Activar',
        deactivate: 'Desactivar',
        restore: 'Restaurar',
        unlock: 'Desbloquear',
      } as Record<string, string>
    )[action];
  }
  async executeAction() {
    if (!this.pending || this.busy() || !this.canWrite()) return;
    this.busy.set(true);
    this.formError.set('');
    const { item, action } = this.pending;
    try {
      const r = await firstValueFrom(
        this.api.write(
          action === 'delete' ? 'DELETE' : 'POST',
          `${this.config.path}/${item.id}${action === 'delete' ? '' : '/' + action}`,
        ),
      );
      this.message.set(r.message);
      this.pending = null;
      await this.load();
    } catch (e) {
      this.formError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  display(value: any, key = ''): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (key === 'branch_id') return this.branches().find((b) => b.id === value)?.['name'] || value;
    if (Array.isArray(value))
      return value.map((v) => v.name || v.code || String(v)).join(', ') || 'Ninguno';
    if (typeof value === 'object')
      return (
        value.name ||
        value.code ||
        Object.entries(value)
          .map(
            ([k, v]) =>
              `${k}: ${v && typeof v === 'object' ? Object.values(v).join(' – ') : v || 'Cerrado'}`,
          )
          .join(' · ')
      );
    return String(value);
  }
}

