import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { Tenant, TenantStats } from '../domain/empresa.models';
@Injectable()
export class EmpresasStore {
  private api = inject(PlataformaApi);
  readonly items = signal<Tenant[]>([]);
  readonly stats = signal<TenantStats | null>(null);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly filters = signal({ search: '', status: 'todas', plan: '' });
  private timer: ReturnType<typeof setTimeout> | undefined;
  private revision = 0;
  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }
  async load() {
    const version = ++this.revision;
    this.loading.set(true);
    this.error.set('');
    try {
      const f = this.filters();
      const status = (
        { activas: 'ACTIVA', inactivas: 'INACTIVA', suspendidas: 'SUSPENDIDA' } as Record<
          string,
          string
        >
      )[f.status];
      const [result, stats] = await Promise.all([
        firstValueFrom(
          this.api.tenants({
            search: f.search,
            status,
            expiring_7d: f.status === 'por_vencer' ? true : undefined,
            plan_code: f.plan,
            page: this.page(),
          }),
        ),
        firstValueFrom(this.api.tenantStats()),
      ]);
      if (version !== this.revision) return;
      this.items.set(result.items);
      this.total.set(result.total);
      this.pages.set(result.pages);
      this.stats.set(stats);
    } catch (e) {
      if (version === this.revision)
        this.error.set('No pudimos cargar las empresas. Intenta nuevamente.');
    } finally {
      if (version === this.revision) this.loading.set(false);
    }
  }
  setFilter(k: 'search' | 'status' | 'plan', v: string) {
    this.filters.update((f) => ({ ...f, [k]: v }));
    this.page.set(1);
    clearTimeout(this.timer);
    if (k === 'search') this.timer = setTimeout(() => void this.load(), 300);
    else void this.load();
  }
  next() {
    if (this.page() < this.pages()) {
      this.page.update((n) => n + 1);
      void this.load();
    }
  }
  prev() {
    if (this.page() > 1) {
      this.page.update((n) => n - 1);
      void this.load();
    }
  }
}
