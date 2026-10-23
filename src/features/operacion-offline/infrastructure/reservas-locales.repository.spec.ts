import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { openOfflineDb, OFFLINE_DB } from '../../../app/core/offline/offline-db';
import { CatalogoLocalRepository } from './catalogo-local.repository';
import { ReservasLocalesRepository } from './reservas-locales.repository';
import { snapshot, reservation } from './offline-test-fixtures';
describe('Reservas locales atómicas', () => {
  const repo = new ReservasLocalesRepository(),
    catalogo = new CatalogoLocalRepository();
  beforeEach(async () => {
    await deleteDB(OFFLINE_DB);
    await catalogo.guardarInstantanea(snapshot(), 'b');
  });
  afterEach(async () => {
    await deleteDB(OFFLINE_DB);
  });
  it('registra reserva,items,operación y descuento', async () => {
    const { r, items, op } = reservation();
    await repo.registrar(r, items, op);
    const saved = await new ReservasLocalesRepository().obtener(r.id);
    expect(saved?.items).toHaveLength(1);
    expect(saved?.operacion.estado).toBe('PENDIENTE');
    expect((await catalogo.leerDatos('b')).existencias[0].cantidad).toBe(3);
  });
  it('anular conserva historial y restaura una sola vez', async () => {
    const { r, items, op } = reservation();
    await repo.registrar(r, items, op);
    await repo.cancelar(r.id, 't', 'u');
    const saved = await repo.obtener(r.id);
    expect(saved?.reserva.estado).toBe('ANULADA_LOCAL');
    expect(saved?.operacion.estado).toBe('ANULADA');
    expect((await catalogo.leerDatos('b')).existencias[0].cantidad).toBe(5);
    await expect(repo.cancelar(r.id)).rejects.toThrow();
  });
  it('no anula una confirmada ni modifica stock', async () => {
    const { r, items, op } = reservation();
    await repo.registrar(r, items, op);
    const db = await openOfflineDb();
    await db.put('operaciones_pendientes', { ...op, estado: 'CONFIRMADA' });
    db.close();
    await expect(repo.cancelar(r.id)).rejects.toThrow();
    expect((await catalogo.leerDatos('b')).existencias[0].cantidad).toBe(3);
  });
  it('fallo de stock revierte todas las filas', async () => {
    const { r, items, op } = reservation();
    items[0].cantidad = 8;
    await expect(repo.registrar(r, items, op)).rejects.toThrow();
    expect(await repo.listar()).toEqual([]);
    const db = await openOfflineDb();
    expect(await db.count('reserva_items_locales')).toBe(0);
    expect(await db.count('operaciones_pendientes')).toBe(0);
    db.close();
    expect((await catalogo.leerDatos('b')).existencias[0].cantidad).toBe(5);
  });
  it('mismo UUID no duplica ni descuenta dos veces', async () => {
    const { r, items, op } = reservation();
    await repo.registrar(r, items, op);
    await expect(repo.registrar(r, items, op)).rejects.toThrow();
    expect((await repo.listar()).length).toBe(1);
    expect((await catalogo.leerDatos('b')).existencias[0].cantidad).toBe(3);
  });
  it('usuario o empresa ajenos no ven ni anulan comprobante', async () => {
    const { r, items, op } = reservation();
    await repo.registrar(r, items, op);
    expect(await repo.obtener(r.id, 'other', 'u')).toBeNull();
    await expect(repo.cancelar(r.id, 't', 'other')).rejects.toThrow();
  });
});
