import { DBSchema, IDBPDatabase, openDB } from 'idb';
export const OFFLINE_DB = 'fashionstore-offline';
export const OFFLINE_DB_VERSION = 1;
export interface ProductoLocal {
  id: string;
  nombre: string;
  slug: string;
  categoria: string;
  marca: string;
  precio_base: number;
  precio_oferta: number | null;
  imagen_url: string | null;
  destacado: boolean;
  actualizado_en: string;
}
export interface VarianteLocal {
  id: string;
  producto_id: string;
  sku: string;
  talla: string;
  color: string;
  color_hex: string;
  precio: number | null;
  activa: boolean;
}
export interface ExistenciaLocal {
  variante_id: string;
  sucursal_id: string;
  cantidad: number;
}
export interface SucursalLocal {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string;
}
export interface ClienteLocal {
  id: string;
  nombre: string;
  documento_final: string;
  telefono: string | null;
}
import type {
  ReservaLocal,
  ItemReservaLocal,
  OperacionPendiente,
} from '../../../features/operacion-offline/domain/reserva-offline.models';
export interface OfflineSchema extends DBSchema {
  productos: { key: string; value: ProductoLocal };
  variantes: { key: string; value: VarianteLocal; indexes: { producto_id: string } };
  existencias: { key: [string, string]; value: ExistenciaLocal };
  sucursales: { key: string; value: SucursalLocal };
  clientes: { key: string; value: ClienteLocal };
  meta: { key: string; value: { clave: string; valor: unknown } };
  reservas_locales: { key: string; value: ReservaLocal };
  reserva_items_locales: { key: [string, string]; value: ItemReservaLocal };
  operaciones_pendientes: { key: string; value: OperacionPendiente; indexes: { estado: string } };
}
export function openOfflineDb(): Promise<IDBPDatabase<OfflineSchema>> {
  return openDB<OfflineSchema>(OFFLINE_DB, OFFLINE_DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('productos', { keyPath: 'id' });
      db.createObjectStore('variantes', { keyPath: 'id' }).createIndex(
        'producto_id',
        'producto_id',
      );
      db.createObjectStore('existencias', { keyPath: ['variante_id', 'sucursal_id'] });
      db.createObjectStore('sucursales', { keyPath: 'id' });
      db.createObjectStore('clientes', { keyPath: 'id' });
      db.createObjectStore('meta', { keyPath: 'clave' });
      db.createObjectStore('reservas_locales', { keyPath: 'id' });
      db.createObjectStore('reserva_items_locales', { keyPath: ['reserva_id', 'variante_id'] });
      db.createObjectStore('operaciones_pendientes', { keyPath: 'id' }).createIndex(
        'estado',
        'estado',
      );
    },
  });
}
