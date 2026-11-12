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

export const instantaneaCompleta = {
  version: '2026-11-11T14:40:00.000000+00:00',
  generated_at: '2026-11-11T14:40:00Z',
  full: true,
  tenant: {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    slug: 'urbano',
    trade_name: 'Urbano Boutique',
    status: 'ACTIVA',
  },
  branches: [
    {
      id: 'aaaaaaaa-0000-4000-8000-0000000000b1',
      code: 'SUC-CENTRO',
      name: 'Sucursal Centro',
      address: 'Av. Monseñor Rivero 120',
    },
  ],
  cash_points: [
    {
      id: 'aaaaaaaa-0000-4000-8000-0000000000c1',
      branch_id: 'aaaaaaaa-0000-4000-8000-0000000000b1',
      code: 'CAJA-01',
      name: 'Caja 1',
    },
  ],
  price_valid_until: '2026-11-12T14:40:00Z',
  products: [
    {
      id: 'aaaaaaaa-0000-4000-8000-0000000000d1',
      name: 'Vestido Aurora',
      slug: 'vestido-aurora',
      category: 'Vestidos',
      brand: 'Urbano',
      base_price: '300.00',
      offer_price: null,
      offer_id: null,
      offer_valid_until: null,
      image_url: null,
      is_featured: true,
    },
  ],
  variants: [
    {
      id: 'aaaaaaaa-0000-4000-8000-0000000000e1',
      product_id: 'aaaaaaaa-0000-4000-8000-0000000000d1',
      sku: 'VES-AUR-M-ROJ',
      size: 'M',
      color: 'Rojo',
      color_hex: '#C0392B',
      price: null,
      is_active: true,
    },
  ],
  stock: [
    {
      variant_id: 'aaaaaaaa-0000-4000-8000-0000000000e1',
      branch_id: 'aaaaaaaa-0000-4000-8000-0000000000b1',
      quantity: 3,
    },
  ],
  customers: [
    {
      id: 'aaaaaaaa-0000-4000-8000-0000000000f1',
      name: 'Lucía Peña',
      document_tail: '482',
      phone: null,
    },
  ],
  removed: {
    products: [],
    variants: [],
  },
};

export const instantaneaIncremental = {
  version: '2026-11-11T14:45:00.000000+00:00',
  generated_at: '2026-11-11T14:45:00Z',
  full: false,
  tenant: {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    slug: 'urbano',
    trade_name: 'Urbano Boutique',
    status: 'ACTIVA',
  },
  branches: [
    {
      id: 'aaaaaaaa-0000-4000-8000-0000000000b1',
      code: 'SUC-CENTRO',
      name: 'Sucursal Centro',
      address: 'Av. Monseñor Rivero 120',
    },
  ],
  cash_points: [
    {
      id: 'aaaaaaaa-0000-4000-8000-0000000000c1',
      branch_id: 'aaaaaaaa-0000-4000-8000-0000000000b1',
      code: 'CAJA-01',
      name: 'Caja 1',
    },
  ],
  price_valid_until: '2026-11-12T14:40:00Z',
  products: [],
  variants: [],
  stock: [
    {
      variant_id: 'aaaaaaaa-0000-4000-8000-0000000000e1',
      branch_id: 'aaaaaaaa-0000-4000-8000-0000000000b1',
      quantity: 2,
    },
  ],
  customers: [
    {
      id: 'aaaaaaaa-0000-4000-8000-0000000000f1',
      name: 'Lucía Peña',
      document_tail: '482',
      phone: null,
    },
  ],
  removed: {
    products: [],
    variants: [],
  },
};

export const instantaneaSinSucursales = {
  success: false,
  error: {
    code: 'no_authorized_branches',
    message:
      'Tu usuario no tiene sucursales asignadas. Pedile al administrador que te asigne una.',
  },
};

export const instantaneaSinModulo = {
  success: false,
  error: {
    code: 'feature_not_in_plan',
    message: 'Tu plan no incluye la operación sin conexión.',
    details: {
      module_code: 'offline',
    },
  },
};

export const lotePeticion = {
  device_id: 'web-caja-01',
  client_version: 'web-offline-v2',
  operations: [
    {
      client_request_id: 'bbbbbbbb-0000-4000-8000-000000000001',
      type: 'SALE',
      branch_id: 'aaaaaaaa-0000-4000-8000-0000000000b1',
      device_id: 'web-caja-01',
      client_created_at: '2026-11-11T14:15:00Z',
      payload: {
        user_id: 'aaaaaaaa-0000-4000-8000-0000000000a9',
        cash_point_id: 'aaaaaaaa-0000-4000-8000-0000000000c1',
        customer_id: null,
        subtotal: '300.00',
        total: '300.00',
        discount_total: '0.00',
        cash_received: '300.00',
        payment_method: 'cash',
        local_folio: 'OFF-BBBBBBBB',
        catalog_downloaded_at: '2026-11-11T14:00:00Z',
        items: [
          {
            variant_id: 'aaaaaaaa-0000-4000-8000-0000000000e1',
            quantity: 1,
            unit_price: '300.00',
            regular_price: '300.00',
          },
        ],
      },
    },
  ],
};

export const loteConfirmada = {
  batch_id: 'cccccccc-0000-4000-8000-000000000001',
  received_at: '2026-11-11T15:00:02Z',
  request_id: 'req-0001',
  results: [
    {
      client_request_id: 'bbbbbbbb-0000-4000-8000-000000000001',
      status: 'CONFIRMED',
      server_ref: 'dddddddd-0000-4000-8000-000000000001',
      server_number: 'FS-A8F3D1',
      conflict_id: null,
      conflict_type: null,
      reason_code: null,
      message: 'Venta sincronizada y confirmada exitosamente.',
      replay: false,
      refund_amount: null,
      refund_status: null,
    },
  ],
};

export const loteConflicto = {
  batch_id: 'cccccccc-0000-4000-8000-000000000002',
  received_at: '2026-11-11T15:00:04Z',
  request_id: 'req-0002',
  results: [
    {
      client_request_id: 'bbbbbbbb-0000-4000-8000-000000000001',
      status: 'CONFLICT',
      server_ref: null,
      server_number: null,
      conflict_id: 'c0ffee00-0000-4000-8000-000000000201',
      conflict_type: 'STOCK',
      reason_code: null,
      message: 'Stock insuficiente en 1 prenda(s).',
      replay: false,
      refund_amount: null,
      refund_status: null,
    },
  ],
};

export const loteReintentar = {
  batch_id: 'cccccccc-0000-4000-8000-000000000003',
  received_at: '2026-11-11T15:00:06Z',
  request_id: 'req-0003',
  results: [
    {
      client_request_id: 'bbbbbbbb-0000-4000-8000-000000000001',
      status: 'RETRY',
      server_ref: null,
      server_number: null,
      conflict_id: null,
      conflict_type: null,
      reason_code: 'server_error',
      message: 'No se pudo confirmar la operación. Se conserva para reintentar.',
      replay: false,
      refund_amount: null,
      refund_status: null,
    },
  ],
};

export const loteSesionVencida = {
  success: false,
  error: {
    code: 'unauthenticated',
    message: 'Tu sesión venció. Iniciá sesión para continuar.',
  },
};

export const estadoOperaciones = {
  operations: [
    {
      client_request_id: 'bbbbbbbb-0000-4000-8000-000000000001',
      status: 'CONFIRMED',
      server_ref: 'dddddddd-0000-4000-8000-000000000001',
      server_number: 'FS-A8F3D1',
      conflict_id: null,
      conflict_type: null,
      reason_code: null,
      message: 'Venta sincronizada y confirmada exitosamente.',
      replay: false,
      refund_amount: null,
      refund_status: null,
    },
  ],
};

export const pingOk = {
  status: 'ok',
};

