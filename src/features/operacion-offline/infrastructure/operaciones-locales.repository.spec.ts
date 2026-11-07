import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { openOfflineDb, OFFLINE_DB, VentaLocal, VentaItemLocal } from '../../../app/core/offline/offline-db';
import { OperacionesLocalesRepository } from './operaciones-locales.repository';
import { OperacionPendiente } from '../domain/reserva-offline.models';
import { SyncResult } from '../domain/sincronizacion.models';

describe('OperacionesLocalesRepository', () => {
  const repo = new OperacionesLocalesRepository();

  beforeEach(async () => {
    await deleteDB(OFFLINE_DB);
    const db = await openOfflineDb();
    for (const [clave, valor] of Object.entries({
      tenant_id: 'ten-1', catalogo_usuario_id: 'usr-1',
      precio_vigente_hasta: new Date(Date.now() + 3600000).toISOString(),
    })) await db.put('meta', { clave, valor });
    await db.put('cajas', { id: 'caja-1', sucursal_id: 'suc-1', codigo: 'C1', nombre: 'Caja', activa: true });
    await db.put('productos', { id: 'p1', nombre: 'Vestido', slug: 'vestido', categoria: 'Ropa', marca: '',
      precio_base: 50, precio_oferta: null, imagen_url: null, destacado: false, actualizado_en: new Date().toISOString() });
    await db.put('variantes', { id: 'var-1', producto_id: 'p1', sku: 'V-M', talla: 'M', color: 'Rojo',
      color_hex: '#ff0000', precio: null, activa: true });
    await db.put('existencias', { variante_id: 'var-1', sucursal_id: 'suc-1', cantidad: 10 });
    db.close();
  });

  afterEach(async () => {
    await deleteDB(OFFLINE_DB);
  });

  it('guarda venta local, items, operacion y descuenta existencias', async () => {
    const db = await openOfflineDb();
    await db.put('existencias', { variante_id: 'var-1', sucursal_id: 'suc-1', cantidad: 10 });
    db.close();

    const venta: VentaLocal = {
      id: 'vta-1',
      caja_id: 'caja-1',
      folio: 'FOL-001',
      tenant_id: 'ten-1',
      sucursal_id: 'suc-1',
      usuario_id: 'usr-1',
      subtotal: 100,
      descuento: 0,
      total: 100,
      recibido: 100,
      vuelto: 0,
      forma_pago: 'EFECTIVO',
      estado: 'PENDIENTE_SINCRONIZAR',
      creada_en: new Date().toISOString(),
    };

    const items: VentaItemLocal[] = [
      {
        venta_id: 'vta-1',
        variante_id: 'var-1',
        producto_nombre: 'Vestido',
        variante_desc: 'Rojo M',
        cantidad: 2,
        precio_unitario: 50,
        precio_regular: 50,
        total_linea: 100,
      },
    ];

    const op: OperacionPendiente = {
      id: 'vta-1',
      venta_id: 'vta-1',
      tipo: 'VENTA',
      tenant_id: 'ten-1',
      sucursal_id: 'suc-1',
      usuario_id: 'usr-1',
      dispositivo_id: 'dev-1',
      creada_en: new Date().toISOString(),
      actualizada_en: new Date().toISOString(),
      ultimo_error: null,
      estado: 'PENDIENTE',
      intentos: 0,
      payload: { client_request_id: 'vta-1' },
    };

    await repo.guardarVentaLocal(venta, items, op);

    const pendientes = await repo.listarPendientes('ten-1');
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].id).toBe('vta-1');

    const dbAfter = await openOfflineDb();
    const stock = await dbAfter.get('existencias', ['var-1', 'suc-1']);
    expect(stock?.cantidad).toBe(8);
    dbAfter.close();
    await expect(repo.guardarVentaLocal({ ...venta, id: 'exceso', total: 1000, subtotal: 1000, recibido: 1000 },
      [{ ...items[0], venta_id: 'exceso', cantidad: 20 }],
      { ...op, id: 'exceso', venta_id: 'exceso' })).rejects.toThrow('existencia');
    const check = await openOfflineDb();
    expect(await check.get('ventas_locales', 'exceso')).toBeUndefined();
    expect((await check.get('existencias', ['var-1', 'suc-1']))?.cantidad).toBe(8);
    check.close();
  });

  it('aplica resultados confirmando venta y actualizando estado', async () => {
    const venta: VentaLocal = {
      id: 'vta-2',
      caja_id: 'caja-1',
      folio: 'FOL-002',
      tenant_id: 'ten-1',
      sucursal_id: 'suc-1',
      usuario_id: 'usr-1',
      subtotal: 50,
      descuento: 0,
      total: 50,
      recibido: 50,
      vuelto: 0,
      forma_pago: 'EFECTIVO',
      estado: 'PENDIENTE_SINCRONIZAR',
      creada_en: new Date().toISOString(),
    };
    const op: OperacionPendiente = {
      id: 'vta-2',
      venta_id: 'vta-2',
      tipo: 'VENTA',
      tenant_id: 'ten-1',
      sucursal_id: 'suc-1',
      usuario_id: 'usr-1',
      dispositivo_id: 'dev-1',
      creada_en: new Date().toISOString(),
      actualizada_en: new Date().toISOString(),
      ultimo_error: null,
      estado: 'PENDIENTE',
      intentos: 0,
      payload: { client_request_id: 'vta-2' },
    };
    await repo.guardarVentaLocal(venta, [{
      venta_id: venta.id, variante_id: 'var-1', producto_nombre: 'Vestido', variante_desc: 'M Rojo',
      cantidad: 1, precio_unitario: 50, precio_regular: 50, total_linea: 50,
    }], op);

    const res: SyncResult = {
      client_request_id: 'vta-2',
      status: 'CONFIRMED',
      server_ref: 'srv-order-123',
      server_number: 'ORD-001',
      message: 'OK',
    };

    await repo.aplicarResultados([res], new Date());

    const detalle = await repo.obtenerOperacion('vta-2');
    expect(detalle?.operacion.estado).toBe('CONFIRMADA');
    expect(detalle?.operacion.server_ref).toBe('srv-order-123');
    expect(detalle?.venta?.estado).toBe('CONFIRMADA');
    expect(detalle?.venta?.server_ref).toBe('srv-order-123');
  });

  it('guarda y lista historial de sincronizaciones', async () => {
    await repo.guardarHistorialSync({
      tenant_id: 't', usuario_id: 'u',
      iniciado_en: '2026-11-04T12:00:00.000Z',
      terminado_en: '2026-11-04T12:00:01.000Z',
      enviadas: 5,
      confirmadas: 4,
      conflictos: 1,
      rechazadas: 0,
    });

    const historial = await repo.listarHistorialSync();
    expect(historial).toHaveLength(1);
    expect(historial[0].confirmadas).toBe(4);
    expect(historial[0].conflictos).toBe(1);
    expect(await repo.listarHistorialSync(30, {tenantId: 'other', usuarioId: 'u'})).toEqual([]);
    expect(await repo.listarHistorialSync(30, {tenantId: 't', usuarioId: 'other'})).toEqual([]);
    expect(await repo.listarHistorialSync(30, {tenantId: 't', usuarioId: 'u'})).toHaveLength(1);
  });
});
