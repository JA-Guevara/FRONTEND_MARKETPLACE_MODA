import { errorMessage } from '../../../shared/errors';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CatalogoLocalRepository } from '../infrastructure/catalogo-local.repository';
import { SnapshotApi } from '../infrastructure/snapshot.api';
import {
  DATOS_VACIOS,
  FILTROS_VACIOS,
  FiltrosOffline,
  filtrarCatalogo,
  isStale,
} from '../domain/offline.models';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
@Injectable({ providedIn: 'root' })
export class OfflineCatalogStore {
  private repo = inject(CatalogoLocalRepository);
  private api = inject(SnapshotApi);
  private session = inject(SessionService);
  private readonly identity = computed(() => {
    const user = this.session.user();
    return user?.tenant ? user.tenant.id + ':' + user.id : null;
  });
  private reading = 0;
  readonly meta = signal({
    version: null as string | null,
    descargadoEn: null as string | null,
    sucursalId: null as string | null,
    tenantId: null as string | null,
    usuarioId: null as string | null,
  });
  readonly conteos = signal<Record<string, number>>({});
  readonly descargando = signal(false);
  readonly progreso = signal(0);
  readonly error = signal('');
  readonly filtros = signal({ ...FILTROS_VACIOS });
  readonly datos = signal({ ...DATOS_VACIOS });
  readonly vista = computed(() => filtrarCatalogo(this.datos(), this.filtros()));
  readonly desactualizado = computed(() => isStale(this.meta().descargadoEn, new Date()));
  constructor() {
    effect(() => {
      // El servicio es singleton: no conservar datos visibles al cambiar cuenta.
      this.identity();
      this.filtros.set({ ...FILTROS_VACIOS });
      this.meta.set({
        version: null,
        descargadoEn: null,
        sucursalId: null,
        tenantId: null,
        usuarioId: null,
      });
      this.datos.set({ ...DATOS_VACIOS });
      this.conteos.set({});
      void this.cargarLocal().catch(() => this.error.set('No se pudo leer el catálogo local.'));
    });
  }
  async cargarLocal() {
    const user = this.session.user();
    const identity = this.identity();
    const reading = ++this.reading;
    const meta = await this.repo.meta();
    if (identity !== this.identity() || reading !== this.reading) return;
    if (!user || meta.tenantId !== user.tenant?.id || meta.usuarioId !== user.id) {
      this.meta.set({
        version: null,
        descargadoEn: null,
        sucursalId: null,
        tenantId: null,
        usuarioId: null,
      });
      this.datos.set({ ...DATOS_VACIOS });
      this.conteos.set({});
      return;
    }
    const [datos, conteos] = await Promise.all([
      this.repo.leerDatos(meta.sucursalId ?? ''),
      this.repo.conteos(),
    ]);
    if (identity !== this.identity() || reading !== this.reading) return;
    this.meta.set(meta);
    this.datos.set(datos);
    this.conteos.set(conteos);
  }
  async descargar(sucursalId: string) {
    if (this.descargando()) return;
    const user = this.session.user();
    if (!user?.tenant || this.session.readOnly() || !this.session.hasFeature('offline')) {
      this.error.set('Tu suscripción no permite descargar datos sin conexión.');
      return;
    }
    const identity = this.identity();
    this.descargando.set(true);
    this.error.set('');
    this.progreso.set(10);
    try {
      const old = await this.repo.meta();
      const since =
        old.tenantId === user.tenant.id &&
        old.usuarioId === user.id &&
        old.sucursalId === sucursalId
          ? old.version
          : null;
      const snapshot = await firstValueFrom(this.api.get(sucursalId || null, since));
      if (identity !== this.identity()) return;
      if (snapshot.tenant.id !== user.tenant.id)
        throw new Error('La instantánea pertenece a otra empresa.');
      this.progreso.set(45);
      const branch = sucursalId || snapshot.branches[0]?.id;
      if (!branch) throw new Error('Tu empresa no tiene sucursales disponibles.');
      this.progreso.set(70);
      await this.repo.guardarInstantanea(snapshot, branch, user.id);
      this.progreso.set(90);
      await this.cargarLocal();
      this.progreso.set(100);
    } catch (e) {
      if (identity === this.identity()) {
        const previous = this.meta().descargadoEn;
        this.error.set(previous
          ? 'Se conservó el catálogo descargado. ' + errorMessage(e)
          : 'No se pudo preparar el catálogo de tu empresa. ' + errorMessage(e));
      }
    } finally {
      this.descargando.set(false);
    }
  }
  setFiltro<K extends keyof FiltrosOffline>(k: K, v: FiltrosOffline[K]) {
    this.filtros.update((f) => ({ ...f, [k]: v }));
  }
}
