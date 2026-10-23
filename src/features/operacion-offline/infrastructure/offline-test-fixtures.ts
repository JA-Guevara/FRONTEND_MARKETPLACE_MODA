import { OfflineSnapshot } from '../domain/offline.models';
import {
  ReservaLocal,
  OperacionPendiente,
  ItemReservaLocal,
  construirPayload,
} from '../domain/reserva-offline.models';
export function snapshot(): OfflineSnapshot {
  return {
    version: '2026-10-23T10:00:00Z',
    generated_at: '2026-10-23T10:00:00Z',
    full: true,
    tenant: { id: 't', slug: 'test', trade_name: 'Test', status: 'ACTIVA' },
    branches: [{ id: 'b', code: 'B', name: 'Centro', address: 'Av.1' }],
    products: [
      {
        id: 'p',
        name: 'Camisa',
        slug: 'camisa',
        category: 'Camisas',
        brand: 'FS',
        base_price: '100',
        offer_price: null,
        image_url: null,
        is_featured: false,
      },
    ],
    variants: [
      {
        id: 'v',
        product_id: 'p',
        sku: 'CAM-M',
        size: 'M',
        color: 'Azul',
        color_hex: '#00f',
        price: null,
        is_active: true,
      },
    ],
    stock: [{ variant_id: 'v', branch_id: 'b', quantity: 5 }],
    customers: [{ id: 'c', name: 'Ana', document_tail: '1234', phone: null }],
    removed: { products: [], variants: [] },
  };
}
export function reservation(id = 'r') {
  const now = new Date().toISOString();
  const r: ReservaLocal = {
    id,
    tenant_id: 't',
    sucursal_id: 'b',
    usuario_id: 'u',
    cliente_id: null,
    agendada_para: new Date(Date.now() + 86400000).toISOString(),
    notas: '',
    estado: 'PENDIENTE_CONFIRMACION',
    creada_en: now,
  };
  const items: ItemReservaLocal[] = [{ reserva_id: id, variante_id: 'v', cantidad: 2 }];
  const op: OperacionPendiente = {
    id: 'op-' + id,
    tipo: 'RESERVA',
    estado: 'PENDIENTE',
    tenant_id: 't',
    sucursal_id: 'b',
    usuario_id: 'u',
    dispositivo_id: 'web-d',
    payload: construirPayload(r, items, 'web-d'),
    intentos: 0,
    ultimo_error: null,
    creada_en: now,
    actualizada_en: now,
  };
  return { r, items, op };
}
