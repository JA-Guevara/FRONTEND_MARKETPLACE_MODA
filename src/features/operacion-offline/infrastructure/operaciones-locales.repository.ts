import { Injectable } from '@angular/core';
import {
  openOfflineDb,
  VentaLocal,
  VentaItemLocal,
  HistorialSyncLocal,
} from '../../../app/core/offline/offline-db';
import { OperacionPendiente } from '../domain/reserva-offline.models';
import {
  SyncResult,
  aplicarResultado,
  estadoVenta,
  estadoReserva,
  listaParaEnviar,
  ordenarParaEnvio,
} from '../domain/sincronizacion.models';

export interface OperacionConDetalle {
  operacion: OperacionPendiente;
  venta?: VentaLocal | null;
  itemsVenta?: VentaItemLocal[];
}

@Injectable({ providedIn: 'root' })
export class OperacionesLocalesRepository {
  async guardarVentaLocal(
    venta: VentaLocal,
    items: VentaItemLocal[],
    op: OperacionPendiente,
  ): Promise<void> {
    const db = await openOfflineDb();
    const tx = db.transaction(
      ['ventas_locales', 'venta_items_locales', 'operaciones_pendientes', 'existencias', 'meta', 'cajas', 'variantes', 'productos'],
      'readwrite',
    );
    try {
      const tenant = (await tx.objectStore('meta').get('tenant_id'))?.valor;
      const owner = (await tx.objectStore('meta').get('catalogo_usuario_id'))?.valor;
      const validUntil = (await tx.objectStore('meta').get('precio_vigente_hasta'))?.valor;
      const caja = venta.caja_id ? await tx.objectStore('cajas').get(venta.caja_id) : null;
      if (tenant !== venta.tenant_id || owner !== venta.usuario_id ||
          op.tenant_id !== tenant || op.usuario_id !== owner || op.venta_id !== venta.id ||
          op.id !== venta.id || op.sucursal_id !== venta.sucursal_id || op.estado !== 'PENDIENTE')
        throw new Error('La venta no corresponde a la cuenta y al catálogo descargado.');
      if (!caja?.activa || caja.sucursal_id !== venta.sucursal_id)
        throw new Error('Elegí una caja autorizada de la sucursal.');
      if (typeof validUntil !== 'string' || !(Date.parse(validUntil) > Date.now()))
        throw new Error('Actualizá el catálogo para obtener precios vigentes antes de vender.');
      if (!items.length || new Set(items.map(item => item.variante_id)).size !== items.length)
        throw new Error('La venta debe contener variantes únicas.');
      if (!Number.isFinite(venta.recibido) || venta.recibido < venta.total || venta.forma_pago !== 'EFECTIVO')
        throw new Error('Registrá efectivo suficiente para cubrir el total.');
      await tx.objectStore('ventas_locales').add(venta);
      for (const item of items) {
        const variant = await tx.objectStore('variantes').get(item.variante_id);
        const product = variant ? await tx.objectStore('productos').get(variant.producto_id) : null;
        if (!variant?.activa || !product || !Number.isInteger(item.cantidad) || item.cantidad <= 0 ||
            item.venta_id !== venta.id || !Number.isFinite(item.precio_unitario) || item.precio_unitario < 0)
          throw new Error('La venta contiene una prenda o una cantidad inválida.');
        await tx.objectStore('venta_items_locales').add(item);
        const stock = await tx
          .objectStore('existencias')
          .get([item.variante_id, venta.sucursal_id]);
        if (!stock || stock.cantidad < item.cantidad)
          throw new Error('Sin existencia local suficiente. Actualizá la selección.');
        if (stock) {
          const nuevaCantidad = stock.cantidad - item.cantidad;
          await tx.objectStore('existencias').put({ ...stock, cantidad: nuevaCantidad });
        }
      }
      const total = items.reduce((total, item) => total + Math.round(item.precio_unitario * 100) * item.cantidad, 0);
      if (total !== Math.round(venta.total * 100) || venta.subtotal !== venta.total || venta.descuento !== 0)
        throw new Error('El total de la venta no coincide con sus prendas.');
      await tx.objectStore('operaciones_pendientes').add(op);
      await tx.done;
    } catch (e) {
      try {
        tx.abort();
      } catch {}
      await tx.done.catch(() => {});
      throw e;
    } finally {
      db.close();
    }
  }

  async listarPendientes(tenantId?: string): Promise<OperacionPendiente[]> {
    const db = await openOfflineDb();
    try {
      const ops = await db.getAll('operaciones_pendientes');
      return ordenarParaEnvio(
        ops.filter(
          (o) =>
            o.estado === 'PENDIENTE' &&
            (!tenantId || o.tenant_id === tenantId),
        ),
      );
    } finally {
      db.close();
    }
  }

  async tomarParaEnvio(ahora: Date, limite = 50, tenantId?: string, usuarioId?: string): Promise<OperacionPendiente[]> {
    const db = await openOfflineDb();
    const tx = db.transaction(['operaciones_pendientes', 'ventas_locales', 'venta_items_locales'], 'readwrite');
    try {
      const ops = await tx.objectStore('operaciones_pendientes').getAll();
      const elegibles = ordenarParaEnvio(ops.filter((o) => listaParaEnviar(o, ahora) &&
        (!tenantId || o.tenant_id === tenantId) && (!usuarioId || o.usuario_id === usuarioId)));
      const selected = elegibles.slice(0, limite);
      for (const op of selected) {
        await tx.objectStore('operaciones_pendientes').put({ ...op, estado: 'ENVIADA', actualizada_en: ahora.toISOString() });
        if (!op.venta_id) continue;
        const venta = await tx.objectStore('ventas_locales').get(op.venta_id);
        if (!venta) throw new Error('Falta el documento de una venta pendiente.');
        const items = (await tx.objectStore('venta_items_locales').getAll()).filter(item => item.venta_id === venta.id);
        op.payload = {
          user_id: venta.usuario_id, cash_point_id: venta.caja_id, customer_id: venta.cliente_id ?? null,
          subtotal: venta.subtotal.toFixed(2), total: venta.total.toFixed(2), discount_total: '0.00',
          cash_received: venta.recibido.toFixed(2), payment_method: 'cash', local_folio: venta.folio,
          catalog_downloaded_at: venta.catalogo_descargado_en,
          items: items.map(item => ({ variant_id: item.variante_id, quantity: item.cantidad,
            unit_price: item.precio_unitario.toFixed(2), regular_price: item.precio_regular.toFixed(2) })),
        };
      }
      await tx.done;
      return selected;
    } catch (error) {
      try { tx.abort(); } catch {}
      await tx.done.catch(() => {});
      throw error;
    } finally {
      db.close();
    }
  }

  async aplicarResultados(resultados: SyncResult[], ahora: Date): Promise<void> {
    const db = await openOfflineDb();
    const tx = db.transaction(
      ['operaciones_pendientes', 'ventas_locales', 'reservas_locales'],
      'readwrite',
    );
    try {
      for (const res of resultados) {
        const op = await tx.objectStore('operaciones_pendientes').get(res.client_request_id);
        if (!op) continue;

        const opActualizada = aplicarResultado(op, res, ahora);
        await tx.objectStore('operaciones_pendientes').put(opActualizada);

        if (op.tipo === 'VENTA' || (op.tipo as string) === 'SALE') {
          const ventaId = op.venta_id || op.payload?.client_request_id || op.id;
          const venta = await tx.objectStore('ventas_locales').get(ventaId);
          if (venta) {
            const nuevoEstado = estadoVenta(opActualizada);
            await tx.objectStore('ventas_locales').put({
              ...venta,
              estado: nuevoEstado,
              server_ref: opActualizada.server_ref ?? venta.server_ref,
              server_numero: opActualizada.server_numero ?? venta.server_numero,
            });
          }
        } else if (op.tipo === 'RESERVA' || (op.tipo as string) === 'RESERVATION') {
          const reservaId = op.reserva_id || op.payload?.client_key || op.id;
          const reserva = await tx.objectStore('reservas_locales').get(reservaId);
          if (reserva) {
            const nuevoEstado = estadoReserva(opActualizada);
            await tx.objectStore('reservas_locales').put({
              ...reserva,
              estado: nuevoEstado,
              server_id: opActualizada.server_ref ?? reserva.server_id,
            });
          }
        }
      }
      await tx.done;
    } catch (e) {
      try {
        tx.abort();
      } catch {}
      await tx.done.catch(() => {});
      throw e;
    } finally {
      db.close();
    }
  }

  async guardarHistorialSync(registro: HistorialSyncLocal): Promise<number> {
    const db = await openOfflineDb();
    try {
      const key = await db.add('historial_sync', registro);
      return key as number;
    } finally {
      db.close();
    }
  }

  async listarHistorialSync(limite = 20, scope?: {tenantId: string; usuarioId: string}): Promise<HistorialSyncLocal[]> {
    const db = await openOfflineDb();
    try {
      const all = await db.getAll('historial_sync');
      return all.filter(row => !scope || (row.tenant_id === scope.tenantId && row.usuario_id === scope.usuarioId))
        .sort((a, b) => b.iniciado_en.localeCompare(a.iniciado_en)).slice(0, limite);
    } finally {
      db.close();
    }
  }

  async listarOperaciones(filtros?: {
    estado?: string;
    tipo?: string;
    tenantId?: string;
    usuarioId?: string;
  }): Promise<OperacionPendiente[]> {
    const db = await openOfflineDb();
    try {
      let ops = await db.getAll('operaciones_pendientes');
      if (filtros?.tenantId) ops = ops.filter(op => op.tenant_id === filtros.tenantId);
      if (filtros?.usuarioId) ops = ops.filter(op => op.usuario_id === filtros.usuarioId);
      if (filtros?.estado) {
        ops = ops.filter((o) => o.estado === filtros.estado);
      }
      if (filtros?.tipo) {
        ops = ops.filter((o) => o.tipo === filtros.tipo);
      }
      return ordenarParaEnvio(ops);
    } finally {
      db.close();
    }
  }

  async obtenerOperacion(id: string): Promise<OperacionConDetalle | null> {
    const db = await openOfflineDb();
    try {
      const op = await db.get('operaciones_pendientes', id);
      if (!op) return null;
      let venta: VentaLocal | null = null;
      let itemsVenta: VentaItemLocal[] = [];
      if (op.tipo === 'VENTA' || (op.tipo as string) === 'SALE') {
        const ventaId = op.payload?.client_request_id || op.id;
        venta = (await db.get('ventas_locales', ventaId)) ?? null;
        if (venta) {
          const allItems = await db.getAll('venta_items_locales');
          itemsVenta = allItems.filter((i) => i.venta_id === venta!.id);
        }
      }
      return { operacion: op, venta, itemsVenta };
    } finally {
      db.close();
    }
  }
}
