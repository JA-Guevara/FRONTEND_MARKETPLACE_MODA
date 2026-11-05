import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { PlatformModule, ModuleDetail, formatLifecycle } from '../domain/gobierno.models';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { ModuloDrawerComponent } from './modulo-drawer.component';
import { errorMessage } from '../../../shared/errors';

@Component({
  selector: 'fs-modulos-page',
  imports: [FormsModule, RouterLink, ModuloDrawerComponent],
  styleUrl: './modulos-page.component.scss',
  template: `<div class="heading">
      <div>
        <p class="crumbs">Producto</p>
        <h1>Módulos</h1>
        <p class="muted">
          Lo que se puede vender y habilitar. Cada módulo agrupa pantallas y permisos.
        </p>
      </div>
      <a class="btn" routerLink="/admin/plataforma/planes" [queryParams]="{ tab: 'modulos' }"
        >Planes × módulos</a
      >
    </div>
    <div class="filters">
      <label
        >Buscar módulo o permiso<input
          [ngModel]="search()"
          (ngModelChange)="find($event)"
          placeholder="Nombre, código o permiso…"
      /></label>
      <div class="chips">
        @for (item of filters; track item.key) {
          <button class="chip" [class.on]="filter() === item.key" (click)="filter.set(item.key)">
            {{ item.label }}
          </button>
        }
      </div>
    </div>
    @if (error()) {
      <p class="alert danger" role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <p role="status">Cargando catálogo de módulos…</p>
    } @else {
      <div class="modules-grid">
        @for (module of filtered(); track module.code) {
          <article class="module-card">
            <div class="card-head">
              <h3>{{ module.name }}</h3>
              <span class="badge" [class.beta]="module.lifecycle === 'BETA'">{{
                module.kind === 'BASE' ? 'Base' : formatLifecycle(module.lifecycle)
              }}</span>
            </div>
            <p class="muted">{{ module.description || 'Sin descripción' }}</p>
            <code>{{ module.code }}</code>
            <p class="metrics">
              {{ module.plans_count }} planes · {{ module.tenants_count }} empresas ·
              {{ module.permissions_count }} permisos
            </p>
            <footer>
              <button class="btn" (click)="selected.set(module.code)">Detalle</button>
              @if (session.can('sandbox.manage')) {
                <button
                  class="btn"
                  [disabled]="previewing() || module.lifecycle === 'RETIRADO'"
                  (click)="preview(module.code)"
                >
                  Vista previa
                </button>
              }
            </footer>
          </article>
        } @empty {
          <p class="empty">No hay módulos para estos filtros.</p>
        }
      </div>
    }
    @if (searching()) {
      <small role="status">Buscando en los permisos de los módulos…</small>
    }
    @if (selected(); as code) {
      <fs-modulo-drawer
        [code]="code"
        [modules]="modules()"
        (closed)="selected.set(null)"
        (changed)="loadModules()"
        (preview)="preview($event)"
      />
    }`,
})
export class ModulosPageComponent {
  private api = inject(PlataformaApi);
  private router = inject(Router);
  session = inject(SessionService);
  modules = signal<PlatformModule[]>([]);
  loading = signal(false);
  error = signal('');
  search = signal('');
  filter = signal('todos');
  selected = signal<string | null>(null);
  previewing = signal(false);
  searching = signal(false);
  private details = signal<Record<string, ModuleDetail>>({});
  private lookupVersion = 0;
  formatLifecycle = formatLifecycle;
  filters = [
    { key: 'todos', label: 'Todos' },
    { key: 'ga', label: 'Disponibles' },
    { key: 'beta', label: 'Beta' },
    { key: 'base', label: 'Base' },
  ];
  filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.modules().filter(
      (module) =>
        (this.filter() === 'todos' ||
          (this.filter() === 'ga' && module.lifecycle === 'GA') ||
          (this.filter() === 'beta' && module.lifecycle === 'BETA') ||
          (this.filter() === 'base' && module.kind === 'BASE')) &&
        (!term ||
          [
            module.name,
            module.code,
            module.description ?? '',
            ...(this.details()[module.code]?.permissions.map((p) => p.code) ?? []),
          ].some((value) => value.toLowerCase().includes(term))),
    );
  });
  constructor() {
    void this.loadModules();
  }
  async loadModules() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.modules.set(await firstValueFrom(this.api.modules()));
      this.details.set({});
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
  async find(value: string) {
    this.search.set(value);
    const version = ++this.lookupVersion;
    if (!value.trim()) {
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    const missing = this.modules().filter((module) => !this.details()[module.code]);
    const responses = await Promise.allSettled(
      missing.map((module) => firstValueFrom(this.api.module(module.code))),
    );
    if (version !== this.lookupVersion) return;
    const cache = { ...this.details() };
    let failed = false;
    responses.forEach((result) => {
      if (result.status === 'fulfilled') cache[result.value.code] = result.value;
      else failed = true;
    });
    this.details.set(cache);
    this.searching.set(false);
    if (failed)
      this.error.set('No se pudieron revisar todos los permisos. Puedes reintentar la búsqueda.');
  }
  async preview(code: string) {
    if (this.previewing()) return;
    this.previewing.set(true);
    this.error.set('');
    try {
      const start = await firstValueFrom(this.api.preview(code));
      this.session.startSupport(start);
      const module = this.modules().find((item) => item.code === code);
      await this.router.navigateByUrl(
        module?.web_routes.find(
          (path) => path.startsWith('/admin/') && !path.startsWith('/admin/plataforma'),
        ) ?? '/admin',
      );
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.previewing.set(false);
    }
  }
}
