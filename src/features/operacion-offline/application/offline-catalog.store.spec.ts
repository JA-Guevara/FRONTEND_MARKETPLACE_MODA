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
import { snapshot } from '../infrastructure/offline-test-fixtures';
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
});
