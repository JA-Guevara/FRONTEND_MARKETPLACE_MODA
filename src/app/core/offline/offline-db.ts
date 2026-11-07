import { DBSchema, IDBPDatabase, openDB } from 'idb';

export const OFFLINE_DB = 'fashionstore-offline';
export const OFFLINE_DB_VERSION = 2;

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

export interface CajaLocal {
  id: string;
  sucursal_id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
}

export type EstadoVentaLocal =
  | 'PENDIENTE_SINCRONIZAR'
  | 'CONFIRMADA'
  | 'EN_CONFLICTO'
  | 'RECHAZADA'
  | 'ANULADA';

export interface VentaLocal {
  id: string;
  folio: string;
  tenant_id: string;
  sucursal_id: string;
  caja_id?: string;
  usuario_id: string;
  cliente_id?: string | null;
  cliente_nombre?: string | null;
  subtotal: number;
  descuento: number;
  total: number;
  recibido: number;
  vuelto: number;
  forma_pago: string;
  estado: EstadoVentaLocal;
  catalogo_descargado_en?: string;
  creada_en: string;
  anulada_en?: string | null;
  motivo_anulacion?: string | null;
  server_ref?: string | null;
  server_numero?: string | null;
}

export interface VentaItemLocal {
  venta_id: string;
  variante_id: string;
  producto_nombre: string;
  variante_desc: string;
  cantidad: number;
  precio_unitario: number;
  precio_regular: number;
  total_linea: number;
}

export interface HistorialSyncLocal {
  tenant_id?: string;
  usuario_id?: string;
  id?: number;
  iniciado_en: string;
  terminado_en: string;
  enviadas: number;
  confirmadas: number;
  conflictos: number;
  rechazadas: number;
  codigo_error?: string | null;
  http_status?: number | null;
  request_id?: string | null;
  lote_id?: string | null;
}

import type {
  ReservaLocal,
  ItemReservaLocal,
  OperacionPendiente,
} from '../../../features/operacion-offline/domain/reserva-offline.models';

export type { EstadoReservaLocal } from '../../../features/operacion-offline/domain/reserva-offline.models';

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
  cajas: { key: string; value: CajaLocal; indexes: { sucursal_id: string } };
  ventas_locales: { key: string; value: VentaLocal; indexes: { estado: string } };
  venta_items_locales: { key: [string, string]; value: VentaItemLocal };
  historial_sync: { key: number; value: HistorialSyncLocal; autoIncrement: true };
}

export function openOfflineDb(): Promise<IDBPDatabase<OfflineSchema>> {
  return openDB<OfflineSchema>(OFFLINE_DB, OFFLINE_DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
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
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('cajas')) {
          db.createObjectStore('cajas', { keyPath: 'id' }).createIndex('sucursal_id', 'sucursal_id');
        }
        if (!db.objectStoreNames.contains('ventas_locales')) {
          db.createObjectStore('ventas_locales', { keyPath: 'id' }).createIndex('estado', 'estado');
        }
        if (!db.objectStoreNames.contains('venta_items_locales')) {
          db.createObjectStore('venta_items_locales', { keyPath: ['venta_id', 'variante_id'] });
        }
        if (!db.objectStoreNames.contains('historial_sync')) {
          db.createObjectStore('historial_sync', { keyPath: 'id', autoIncrement: true });
        }
      }
    },
  });
}
