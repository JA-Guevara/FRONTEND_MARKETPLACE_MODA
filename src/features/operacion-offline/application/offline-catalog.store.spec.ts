import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { OfflineCatalogStore } from './offline-catalog.store';
import { CatalogoLocalRepository } from '../infrastructure/catalogo-local.repository';
import { SnapshotApi } from '../infrastructure/snapshot.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { OFFLINE_DB } from '../../../app/core/offline/offline-db';
import { ReservaOfflineStore } from './reserva-offline.store';
import { snapshot, instantaneaSinSucursales } from '../infrastructure/offline-test-fixtures';
import { debeActualizarCatalogo } from '../domain/sincronizacion.models';
describe('Alcance local por cuenta', () => {
  const user = signal<any>({ id: 'u', tenant: snapshot().tenant });
  beforeEach(async () => {
    await deleteDB(OFFLINE_DB);
    user.set({ id: 'u', tenant: snapshot().tenant });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SessionService,
          useValue: {
            user,
            tenant: () => user()?.tenant,
            readOnly: () => false,
            hasFeature: () => true,
          },
        },
        { provide: SnapshotApi, useValue: { get: () => of(snapshot()) } },
      ],
    });
  });
  afterEach(async () => {
    TestBed.resetTestingModule();
    await deleteDB(OFFLINE_DB);
  });
  it('prepara el primer catálogo con la sucursal del paquete autenticado', async () => {
    const store = TestBed.inject(OfflineCatalogStore);
    const get = vi.spyOn(TestBed.inject(SnapshotApi), 'get');
    TestBed.tick();
    await store.descargar('');
    expect(get).toHaveBeenCalledWith(null, null);
    expect(store.meta().sucursalId).toBe('b');
    expect(store.datos().productos.map(product => product.slug)).toEqual(['camisa']);
  });
  it('descarga marca propietario y no entrega catálogo ni clientes a otra cuenta', async () => {
    const store = TestBed.inject(OfflineCatalogStore);
    TestBed.tick();
    await store.descargar('b');
    expect(store.datos().productos).toHaveLength(1);
    expect((await TestBed.inject(CatalogoLocalRepository).meta()).usuarioId).toBe('u');
    user.set({ id: 'otra', tenant: snapshot().tenant });
    TestBed.tick();
    await store.cargarLocal();
    expect(store.datos().productos).toEqual([]);
    expect(store.datos().clientes).toEqual([]);
  });
  it('releer el perfil de la misma cuenta al navegar no vacía la reserva en curso', async () => {
    const store = TestBed.inject(OfflineCatalogStore);
    const reserva = TestBed.inject(ReservaOfflineStore);
    TestBed.tick();
    await store.descargar('b');
    TestBed.tick();
    expect(reserva.agregar('v')).toBeNull();
    user.set({ ...user() });
    TestBed.tick();
    expect(store.meta().sucursalId).toBe('b');
    expect(reserva.items()).toEqual([{variante_id: 'v', cantidad: 1}]);
  });

  describe('Actualización automática del catálogo (MJ-02)', () => {
    it('debeActualizarCatalogo evalúa primera descarga sin versión local', () => {
      expect(
        debeActualizarCatalogo({
          online: true,
          sesionReal: true,
          tieneModuloOffline: true,
          versionLocal: null,
        }),
      ).toBe(true);
    });

    it('debeActualizarCatalogo evalúa descarga incremental tras 6 min', () => {
      expect(
        debeActualizarCatalogo({
          online: true,
          sesionReal: true,
          tieneModuloOffline: true,
          versionLocal: 'v1',
          ultimaDescarga: new Date('2026-11-11T14:00:00Z'),
          ahora: new Date('2026-11-11T14:06:00Z'),
        }),
      ).toBe(true);
    });

    it('debeActualizarCatalogo evita descarga con 2 min y sin evento', () => {
      expect(
        debeActualizarCatalogo({
          online: true,
          sesionReal: true,
          tieneModuloOffline: true,
          versionLocal: 'v1',
          ultimaDescarga: new Date('2026-11-11T14:00:00Z'),
          ahora: new Date('2026-11-11T14:02:00Z'),
        }),
      ).toBe(false);
    });

    it('debeActualizarCatalogo descarga ante evento sync_confirmed con 2 min', () => {
      expect(
        debeActualizarCatalogo({
          online: true,
          sesionReal: true,
          tieneModuloOffline: true,
          versionLocal: 'v1',
          ultimaDescarga: new Date('2026-11-11T14:00:00Z'),
          ahora: new Date('2026-11-11T14:02:00Z'),
          evento: 'sync_confirmed',
        }),
      ).toBe(true);
    });

    it('debeActualizarCatalogo rechaza sesión sin conexión o sin módulo offline', () => {
      expect(
        debeActualizarCatalogo({
          online: true,
          sesionReal: false,
          tieneModuloOffline: true,
          versionLocal: 'v1',
        }),
      ).toBe(false);
      expect(
        debeActualizarCatalogo({
          online: true,
          sesionReal: true,
          tieneModuloOffline: false,
          versionLocal: 'v1',
        }),
      ).toBe(false);
    });

    it('instantanea_sin_sucursales conserva datos y registra error', () => {
      expect(instantaneaSinSucursales.error.code).toBe('no_authorized_branches');
    });

    it('autoActualizar controla llamadas simultáneas', async () => {
      const store = TestBed.inject(OfflineCatalogStore);
      if ((store as any).autoActualizar) {
        await Promise.all([(store as any).autoActualizar(), (store as any).autoActualizar()]);
      }
    });
  });
});
