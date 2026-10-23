import { Injectable } from '@angular/core';
import { openOfflineDb } from '../../../app/core/offline/offline-db';
import {
  ReservaLocal,
  ItemReservaLocal,
  OperacionPendiente,
  ReservaLocalVista,
  puedeCancelarLocal,
  puedeAgregar,
  validarVisita,
} from '../domain/reserva-offline.models';
@Injectable({ providedIn: 'root' })
export class ReservasLocalesRepository {
  async registrar(r: ReservaLocal, items: ItemReservaLocal[], op: OperacionPendiente) {
    const db = await openOfflineDb();
    const tx = db.transaction(
      [
        'reservas_locales',
        'reserva_items_locales',
        'operaciones_pendientes',
        'existencias',
        'meta',
        'variantes',
      ],
      'readwrite',
    );
    try {
      if (
        r.estado !== 'PENDIENTE_CONFIRMACION' ||
        op.estado !== 'PENDIENTE' ||
        op.tipo !== 'RESERVA' ||
        op.tenant_id !== r.tenant_id ||
        op.usuario_id !== r.usuario_id ||
        op.sucursal_id !== r.sucursal_id ||
        op.payload.client_key !== r.id ||
        op.payload.branch_id !== r.sucursal_id ||
        items.some((i) => i.reserva_id !== r.id)
      )
        throw new Error('La operación no corresponde a esta reserva local.');
      if (!items.length) throw new Error('Selecciona al menos una prenda.');
      if (items.length > 20 || new Set(items.map((i) => i.variante_id)).size !== items.length)
        throw new Error('La selección de variantes no es válida.');
      const tenant = (await tx.objectStore('meta').get('tenant_id'))?.valor;
      const branch = (await tx.objectStore('meta').get('sucursal_id'))?.valor;
      if (tenant !== r.tenant_id || branch !== r.sucursal_id)
        throw new Error('El catálogo pertenece a otra empresa o sucursal.');
      const dateError = validarVisita(new Date(r.agendada_para), new Date());
      if (dateError) throw new Error(dateError);
      await tx.objectStore('reservas_locales').add(r);
      await tx.objectStore('operaciones_pendientes').add(op);
      for (const item of items) {
        const variant = await tx.objectStore('variantes').get(item.variante_id);
        if (!variant?.activa)
          throw new Error('La variante no está disponible en el catálogo local.');
        const stock = await tx.objectStore('existencias').get([item.variante_id, r.sucursal_id]);
        const error = puedeAgregar([], item.variante_id, item.cantidad, stock?.cantidad ?? 0);
        if (error) throw new Error(error);
        await tx.objectStore('reserva_items_locales').add(item);
        await tx
          .objectStore('existencias')
          .put({ ...stock!, cantidad: stock!.cantidad - item.cantidad });
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
  async listar(tenantId?: string, usuarioId?: string): Promise<ReservaLocalVista[]> {
    const db = await openOfflineDb();
    try {
      const rs = await db.getAll('reservas_locales'),
        items = await db.getAll('reserva_items_locales'),
        ops = await db.getAll('operaciones_pendientes');
      return rs
        .filter(
          (r) =>
            (!tenantId || r.tenant_id === tenantId) && (!usuarioId || r.usuario_id === usuarioId),
        )
        .sort((a, b) => b.creada_en.localeCompare(a.creada_en))
        .map((reserva) => ({
          reserva,
          items: items.filter((i) => i.reserva_id === reserva.id),
          operacion: ops.find((o) => o.payload.client_key === reserva.id)!,
        }));
    } finally {
      db.close();
    }
  }
  async obtener(id: string, tenantId?: string, usuarioId?: string) {
    return (await this.listar(tenantId, usuarioId)).find((x) => x.reserva.id === id) ?? null;
  }
  async cancelar(id: string, tenantId?: string, usuarioId?: string) {
    const db = await openOfflineDb();
    const tx = db.transaction(
      [
        'reservas_locales',
        'reserva_items_locales',
        'operaciones_pendientes',
        'existencias',
        'meta',
      ],
      'readwrite',
    );
    try {
      const r = await tx.objectStore('reservas_locales').get(id);
      const op = (await tx.objectStore('operaciones_pendientes').getAll()).find(
        (o) => o.payload.client_key === id,
      );
      if (
        !r ||
        !op ||
        !puedeCancelarLocal(op) ||
        (tenantId && r.tenant_id !== tenantId) ||
        (usuarioId && r.usuario_id !== usuarioId)
      )
        throw new Error('Solo puedes anular una reserva pendiente de sincronizar.');
      await tx.objectStore('reservas_locales').put({ ...r, estado: 'ANULADA_LOCAL' });
      await tx
        .objectStore('operaciones_pendientes')
        .put({ ...op, estado: 'ANULADA', actualizada_en: new Date().toISOString() });
      const catalogTenant = (await tx.objectStore('meta').get('tenant_id'))?.valor;
      if (catalogTenant === r.tenant_id)
        for (const item of (await tx.objectStore('reserva_items_locales').getAll()).filter(
          (i) => i.reserva_id === id,
        )) {
          const stock = await tx.objectStore('existencias').get([item.variante_id, r.sucursal_id]);
          if (stock)
            await tx
              .objectStore('existencias')
              .put({ ...stock, cantidad: stock.cantidad + item.cantidad });
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
}
