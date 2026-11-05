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
      ['ventas_locales', 'venta_items_locales', 'operaciones_pendientes', 'existencias'],
      'readwrite',
    );
    try {
      await tx.objectStore('ventas_locales').add(venta);
      for (const item of items) {
        await tx.objectStore('venta_items_locales').add(item);
        const stock = await tx
          .objectStore('existencias')
          .get([item.variante_id, venta.sucursal_id]);
        if (stock) {
          const nuevaCantidad = Math.max(0, stock.cantidad - item.cantidad);
          await tx.objectStore('existencias').put({ ...stock, cantidad: nuevaCantidad });
        }
      }
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

  async tomarParaEnvio(ahora: Date, limite = 50): Promise<OperacionPendiente[]> {
    const db = await openOfflineDb();
    try {
      const ops = await db.getAll('operaciones_pendientes');
      const elegibles = ordenarParaEnvio(ops.filter((o) => listaParaEnviar(o, ahora)));
      return elegibles.slice(0, limite);
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
          const ventaId = op.payload?.client_request_id || op.id;
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
          const reservaId = op.payload?.client_key || op.id;
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

  async listarHistorialSync(limite = 20): Promise<HistorialSyncLocal[]> {
    const db = await openOfflineDb();
    try {
      const all = await db.getAll('historial_sync');
      return all.sort((a, b) => b.iniciado_en.localeCompare(a.iniciado_en)).slice(0, limite);
    } finally {
      db.close();
    }
  }

  async listarOperaciones(filtros?: {
    estado?: string;
    tipo?: string;
  }): Promise<OperacionPendiente[]> {
    const db = await openOfflineDb();
    try {
      let ops = await db.getAll('operaciones_pendientes');
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
