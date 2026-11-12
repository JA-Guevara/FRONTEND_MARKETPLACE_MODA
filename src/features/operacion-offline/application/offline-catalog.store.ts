import { errorMessage } from '../../../shared/errors';
import { Injectable, computed, effect, inject, signal, untracked, DestroyRef } from '@angular/core';
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
import { ConnectivityService } from '../../../app/core/offline/connectivity.service';
import { SincronizacionService } from './sincronizacion.service';
import { debeActualizarCatalogo } from '../domain/sincronizacion.models';

@Injectable({ providedIn: 'root' })
export class OfflineCatalogStore {
  private repo = inject(CatalogoLocalRepository);
  private api = inject(SnapshotApi);
  private session = inject(SessionService);
  private connectivity = inject(ConnectivityService, { optional: true });
  private syncService = inject(SincronizacionService, { optional: true });
  private destroyRef = inject(DestroyRef, { optional: true });

  private readonly identity = computed(() => {
    const user = this.session.user();
    return user?.tenant ? user.tenant.id + ':' + user.id : null;
  });
  private reading = 0;
  private actualizandoAuto = false;
  private iniciado = false;
  private intervaloAuto: any = null;

  readonly meta = signal<{
    version: string | null;
    descargadoEn: string | null;
    sucursalId: string | null;
    tenantId: string | null;
    usuarioId: string | null;
    ultimo_intento_catalogo?: string | null;
    ultimo_error_catalogo?: string | null;
  }>({
    version: null,
    descargadoEn: null,
    sucursalId: null,
    tenantId: null,
    usuarioId: null,
    ultimo_intento_catalogo: null,
    ultimo_error_catalogo: null,
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
        ultimo_intento_catalogo: null,
        ultimo_error_catalogo: null,
      });
      this.datos.set({ ...DATOS_VACIOS });
      this.conteos.set({});
      untracked(() => {
        void this.cargarLocal().catch(() => this.error.set('No se pudo leer el catálogo local.'));
      });
    });

    try {
      this.destroyRef?.onDestroy(() => {
        if (this.intervaloAuto) {
          clearInterval(this.intervaloAuto);
          this.intervaloAuto = null;
        }
      });
    } catch {}
  }

  iniciar(): void {
    if (this.iniciado) return;
    this.iniciado = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void this.autoActualizar('reconnect');
      });

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          void this.autoActualizar('visible');
        }
      });

      this.intervaloAuto = setInterval(() => {
        if (typeof document === 'undefined' || !document.hidden) {
          void this.autoActualizar();
        }
      }, 300000);
    }

    try {
      effect(() => {
        const u = this.session.user();
        if (u?.tenant) {
          untracked(() => {
            void this.autoActualizar('login');
          });
        }
      });

      if (this.syncService) {
        effect(() => {
          const sync = this.syncService?.ultimoSync();
          if (sync) {
            untracked(() => {
              void this.autoActualizar('sync_confirmed');
            });
          }
        });
      }
    } catch {}
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
        ultimo_intento_catalogo: null,
        ultimo_error_catalogo: null,
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
    this.meta.set({
      ...meta,
      ultimo_intento_catalogo: this.meta().ultimo_intento_catalogo,
      ultimo_error_catalogo: this.meta().ultimo_error_catalogo,
    });
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
    this.meta.update(m => ({ ...m, ultimo_intento_catalogo: new Date().toISOString() }));
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
      this.meta.update(m => ({ ...m, ultimo_error_catalogo: null }));
    } catch (e: any) {
      if (identity === this.identity()) {
        const previous = this.meta().descargadoEn;
        const msg = errorMessage(e);
        this.meta.update(m => ({ ...m, ultimo_error_catalogo: msg }));
        this.error.set(previous
          ? 'Se conservó el catálogo descargado. ' + msg
          : 'No se pudo preparar el catálogo de tu empresa. ' + msg);
      }
    } finally {
      this.descargando.set(false);
    }
  }

  async autoActualizar(evento?: 'login' | 'reconnect' | 'visible' | 'sync_confirmed'): Promise<boolean> {
    const user = this.session.user();
    const online = this.connectivity ? this.connectivity.online() : (typeof navigator !== 'undefined' ? navigator.onLine : true);
    const sesionReal = !this.session.readOnly() && !!user?.tenant;
    const tieneModuloOffline = this.session.hasFeature('offline');
    const versionLocal = this.meta().version;
    const ultimaDescarga = this.meta().descargadoEn;

    if (!debeActualizarCatalogo({
      online,
      sesionReal,
      tieneModuloOffline,
      versionLocal,
      ultimaDescarga,
      evento,
    })) {
      return false;
    }

    if (this.descargando() || this.actualizandoAuto) return false;

    const doDownload = async () => {
      this.actualizandoAuto = true;
      try {
        await this.descargar(this.meta().sucursalId ?? '');
        return true;
      } finally {
        this.actualizandoAuto = false;
      }
    };

    if (typeof navigator !== 'undefined' && (navigator as any).locks?.request) {
      try {
        return await (navigator as any).locks.request(
          'offline-catalog-sync',
          { ifAvailable: true },
          async (lock: any) => {
            if (!lock) return false;
            return await doDownload();
          },
        );
      } catch {
        return await doDownload();
      }
    }
    return await doDownload();
  }

  setFiltro<K extends keyof FiltrosOffline>(k: K, v: FiltrosOffline[K]) {
    this.filtros.update((f) => ({ ...f, [k]: v }));
  }
}
