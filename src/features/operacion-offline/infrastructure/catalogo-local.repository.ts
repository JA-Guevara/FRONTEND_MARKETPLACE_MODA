import { Injectable } from '@angular/core';
import { openOfflineDb } from '../../../app/core/offline/offline-db';
import { DatosLocales, OfflineSnapshot } from '../domain/offline.models';
@Injectable({ providedIn: 'root' })
export class CatalogoLocalRepository {
  async guardarInstantanea(s: OfflineSnapshot, sucursalId: string, usuarioId?: string) {
    const db = await openOfflineDb();
    const tx = db.transaction(
      [
        'productos',
        'variantes',
        'existencias',
        'sucursales',
        'clientes',
        'meta',
        'reservas_locales',
        'reserva_items_locales',
        'operaciones_pendientes',
      ],
      'readwrite',
    );
    try {
      const prior = (await tx.objectStore('meta').get('tenant_id'))?.valor;
      const branch = (await tx.objectStore('meta').get('sucursal_id'))?.valor;
      const changed = prior !== s.tenant.id || branch !== sucursalId;
      if (!s.full && changed)
        throw new Error('La instantánea incremental pertenece a otro catálogo.');
      if (s.full) {
        for (const name of [
          'productos',
          'variantes',
          'existencias',
          'sucursales',
          'clientes',
        ] as const)
          await tx.objectStore(name).clear();
      }
      for (const id of s.removed.products) {
        await tx.objectStore('productos').delete(id);
        for (const v of await tx.objectStore('variantes').index('producto_id').getAll(id)) {
          await tx.objectStore('variantes').delete(v.id);
          for (const stock of await tx.objectStore('existencias').getAll())
            if (stock.variante_id === v.id)
              await tx.objectStore('existencias').delete([v.id, stock.sucursal_id]);
        }
      }
      for (const id of s.removed.variants) {
        await tx.objectStore('variantes').delete(id);
        for (const x of await tx.objectStore('existencias').getAll())
          if (x.variante_id === id) await tx.objectStore('existencias').delete([id, x.sucursal_id]);
      }
      for (const p of s.products)
        await tx.objectStore('productos').put({
          id: p.id,
          nombre: p.name,
          slug: p.slug,
          categoria:
            typeof p.category === 'string'
              ? p.category
              : ((p.category as { name: string })?.name ?? ''),
          marca: p.brand,
          precio_base: Number(p.base_price),
          precio_oferta: p.offer_price == null ? null : Number(p.offer_price),
          imagen_url: p.image_url,
          destacado: p.is_featured,
          actualizado_en: s.generated_at,
        });
      for (const v of s.variants)
        await tx.objectStore('variantes').put({
          id: v.id,
          producto_id: v.product_id,
          sku: v.sku,
          talla: v.size,
          color: v.color,
          color_hex: v.color_hex,
          precio: v.price == null ? null : Number(v.price),
          activa: v.is_active,
        });
      const pendientes = (await tx.objectStore('operaciones_pendientes').getAll()).filter(
        (o) =>
          o.tenant_id === s.tenant.id && ['PENDIENTE', 'ENVIADA', 'CONFLICTO'].includes(o.estado),
      );
      for (const x of s.stock) {
        const apartadas = pendientes
          .filter((o) => o.sucursal_id === x.branch_id)
          .reduce(
            (n, o) =>
              n +
              o.payload.items
                .filter((i) => i.variant_id === x.variant_id)
                .reduce((m, i) => m + i.quantity, 0),
            0,
          );
        await tx.objectStore('existencias').put({
          variante_id: x.variant_id,
          sucursal_id: x.branch_id,
          cantidad: Math.max(0, x.quantity - apartadas),
        });
      }
      for (const b of s.branches)
        await tx
          .objectStore('sucursales')
          .put({ id: b.id, codigo: b.code, nombre: b.name, direccion: b.address });
      await tx.objectStore('clientes').clear();
      for (const c of s.customers)
        await tx
          .objectStore('clientes')
          .put({ id: c.id, nombre: c.name, documento_final: c.document_tail, telefono: c.phone });
      for (const [clave, valor] of Object.entries({
        version_instantanea: s.version,
        descargado_en: new Date().toISOString(),
        sucursal_id: sucursalId,
        tenant_id: s.tenant.id,
        ...(usuarioId ? { catalogo_usuario_id: usuarioId } : {}),
      }))
        await tx.objectStore('meta').put({ clave, valor });
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
  async leerDatos(sucursalId: string): Promise<DatosLocales> {
    const db = await openOfflineDb();
    try {
      return {
        productos: await db.getAll('productos'),
        variantes: await db.getAll('variantes'),
        existencias: (await db.getAll('existencias')).filter((x) => x.sucursal_id === sucursalId),
        sucursales: await db.getAll('sucursales'),
        clientes: await db.getAll('clientes'),
      };
    } finally {
      db.close();
    }
  }
  async meta() {
    const db = await openOfflineDb();
    try {
      const get = async (k: string) => ((await db.get('meta', k))?.valor as string | null) ?? null;
      return {
        version: await get('version_instantanea'),
        descargadoEn: await get('descargado_en'),
        sucursalId: await get('sucursal_id'),
        tenantId: await get('tenant_id'),
        usuarioId: await get('catalogo_usuario_id'),
      };
    } finally {
      db.close();
    }
  }
  async conteos() {
    const db = await openOfflineDb();
    try {
      const out: Record<string, number> = {};
      for (const k of ['productos', 'variantes', 'existencias', 'sucursales', 'clientes'] as const)
        out[k] = await db.count(k);
      return out;
    } finally {
      db.close();
    }
  }
}
