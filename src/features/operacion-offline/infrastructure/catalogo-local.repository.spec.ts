import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { openOfflineDb, OFFLINE_DB } from '../../../app/core/offline/offline-db';
import { CatalogoLocalRepository } from './catalogo-local.repository';
import { ReservasLocalesRepository } from './reservas-locales.repository';
import { snapshot, reservation } from './offline-test-fixtures';
describe('Transacciones de catálogo local', () => {
  const repo = new CatalogoLocalRepository();
  beforeEach(async () => {
    await deleteDB(OFFLINE_DB);
  });
  afterEach(async () => {
    await deleteDB(OFFLINE_DB);
  });
  it('completa persiste nueve almacenes y conteos al reabrir', async () => {
    await repo.guardarInstantanea(snapshot(), 'b');
    const db = await openOfflineDb();
    expect(db.objectStoreNames.length).toBe(9);
    db.close();
    const data = await new CatalogoLocalRepository().leerDatos('b');
    expect(data.productos).toHaveLength(1);
    expect(data.variantes[0].precio).toBeNull();
    expect((await repo.conteos())['existencias']).toBe(1);
  });
  it('incremental elimina productos y sus variantes/existencias', async () => {
    await repo.guardarInstantanea(snapshot(), 'b');
    await repo.guardarInstantanea(
      {
        ...snapshot(),
        full: false,
        products: [],
        variants: [],
        stock: [],
        removed: { products: ['p'], variants: [] },
      },
      'b',
    );
    const d = await repo.leerDatos('b');
    expect(d.productos).toHaveLength(0);
    expect(d.variantes).toHaveLength(0);
    expect(d.existencias).toHaveLength(0);
  });
  it('un error conserva versión y catálogo anterior', async () => {
    await repo.guardarInstantanea(snapshot(), 'b');
    const broken = {
      ...snapshot(),
      version: 'new',
      products: [{ ...snapshot().products[0], id: undefined }],
    } as any;
    await expect(repo.guardarInstantanea(broken, 'b')).rejects.toThrow();
    expect((await repo.meta()).version).toBe(snapshot().version);
    expect((await repo.leerDatos('b')).productos).toHaveLength(1);
  });
  it('refrescar no repone existencias apartadas por pendientes', async () => {
    await repo.guardarInstantanea(snapshot(), 'b');
    const { r, items, op } = reservation();
    await new ReservasLocalesRepository().registrar(r, items, op);
    await repo.guardarInstantanea({ ...snapshot(), full: false }, 'b');
    expect((await repo.leerDatos('b')).existencias[0].cantidad).toBe(3);
  });
  it('perder permiso de clientes reemplaza conjunto aun incremental', async () => {
    await repo.guardarInstantanea(snapshot(), 'b');
    await repo.guardarInstantanea({ ...snapshot(), full: false, customers: [] }, 'b');
    expect((await repo.leerDatos('b')).clientes).toEqual([]);
  });
  it('cambio empresa exige instantánea completa y no mezcla reservas', async () => {
    await repo.guardarInstantanea(snapshot(), 'b');
    await expect(
      repo.guardarInstantanea(
        { ...snapshot(), full: false, tenant: { ...snapshot().tenant, id: 'other' } },
        'b',
      ),
    ).rejects.toThrow();
    expect((await repo.meta()).tenantId).toBe('t');
  });
});
