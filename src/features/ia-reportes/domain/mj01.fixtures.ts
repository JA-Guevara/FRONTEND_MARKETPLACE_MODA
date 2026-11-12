import { InterpretResult, ReportResponse } from './reporte-ia.models';

export const interpretPeticionExamen = {
  text: 'mostrar los 10 productos mas vendidos durante los ultimos 3 meses agrupados por sucursal',
  channel: 'TEXT' as const,
};

export const interpretExamen: InterpretResult = {
  status: 'READY',
  interpreter: 'LLM',
  request_id: '7a1e0c9e-0000-4000-8000-000000000101',
  questions: [],
  suggestions: [],
  assumptions: ['«Últimos 3 meses» se tomó como los últimos 90 días.'],
  spec: {
    definition_code: 'top_productos',
    metrics: ['UNITS', 'REVENUE'],
    dimensions: ['PRODUCT', 'BRANCH'],
    top_n: 10,
    order: 'desc',
    compare_previous: false,
    chart: 'GROUPED_BAR',
    filters: {
      period: {
        date_from: '2026-08-14',
        date_to: '2026-11-11',
        label: 'last_period',
      },
      branch_names: [],
      category_names: [],
      product_names: [],
      status: null,
      low_stock_lt: null,
    },
  },
};

export const interpretAclaracion: InterpretResult = {
  status: 'NEEDS_CLARIFICATION',
  interpreter: 'LLM',
  request_id: '7a1e0c9e-0000-4000-8000-000000000102',
  spec: null,
  assumptions: [],
  suggestions: [
    'Ventas por sucursal',
    'Top productos más vendidos',
    'Ingresos por categoría',
  ],
  questions: [
    '¿Qué querés ver: ventas, productos más vendidos, existencias o ingresos por categoría?',
  ],
};

export const interpretNoSoportado: InterpretResult = {
  status: 'UNSUPPORTED',
  interpreter: 'FALLBACK',
  request_id: '7a1e0c9e-0000-4000-8000-000000000103',
  spec: null,
  questions: [],
  assumptions: [
    'No se admiten operaciones de escritura ni modificación de datos.',
  ],
  suggestions: [
    'Ventas por sucursal',
    'Top productos más vendidos',
    'Ventas por semana',
  ],
};

export const interpretSinModulo = {
  success: false,
  error: {
    code: 'feature_not_in_plan',
    message: 'Tu plan no incluye reportes con IA.',
    details: {
      module_code: 'ai_reports',
    },
  },
};

export const runPeticionExamen = {
  request_id: '7a1e0c9e-0000-4000-8000-000000000101',
  spec: interpretExamen.spec!,
};

export const runTopPorSucursal: ReportResponse = {
  request_id: '7a1e0c9e-0000-4000-8000-000000000101',
  definition_code: 'top_productos',
  title: 'Top productos más vendidos por sucursal',
  columns: [
    { key: 'branch', label: 'Sucursal', type: 'text' },
    { key: 'product', label: 'Producto', type: 'text' },
    { key: 'sku', label: 'SKU', type: 'text' },
    { key: 'units', label: 'Unidades vendidas', type: 'int' },
    { key: 'revenue', label: 'Total recaudado (Bs)', type: 'money' },
  ],
  rows: [
    {
      branch: 'Sucursal Centro',
      product: 'Vestido Aurora',
      sku: 'VES-AUR-M-ROJ',
      units: 14,
      revenue: 4200.0,
    },
    {
      branch: 'Sucursal Centro',
      product: 'Camisa Lino',
      sku: 'CAM-LIN-L-BLA',
      units: 9,
      revenue: 1350.0,
    },
    {
      branch: 'Sucursal Norte',
      product: 'Camisa Lino',
      sku: 'CAM-LIN-L-BLA',
      units: 11,
      revenue: 1650.0,
    },
    {
      branch: 'Sucursal Norte',
      product: 'Falda Brisa',
      sku: 'FAL-BRI-S-AZU',
      units: 6,
      revenue: 1080.0,
    },
  ],
  groups: [
    {
      key: 'Sucursal Centro',
      label: 'Sucursal Centro',
      subtotal: {
        units: 23,
        revenue: 5550.0,
      },
      rows: [
        {
          product: 'Vestido Aurora',
          sku: 'VES-AUR-M-ROJ',
          units: 14,
          revenue: 4200.0,
        },
        {
          product: 'Camisa Lino',
          sku: 'CAM-LIN-L-BLA',
          units: 9,
          revenue: 1350.0,
        },
      ],
    },
    {
      key: 'Sucursal Norte',
      label: 'Sucursal Norte',
      subtotal: {
        units: 17,
        revenue: 2730.0,
      },
      rows: [
        {
          product: 'Camisa Lino',
          sku: 'CAM-LIN-L-BLA',
          units: 11,
          revenue: 1650.0,
        },
        {
          product: 'Falda Brisa',
          sku: 'FAL-BRI-S-AZU',
          units: 6,
          revenue: 1080.0,
        },
      ],
    },
  ],
  totals: {
    branch: 'TOTAL',
    product: '-',
    sku: '-',
    units: 40,
    revenue: 8280.0,
  },
  chart: {
    kind: 'GROUPED_BAR',
    x: 'product',
    y: 'units',
    group: 'branch',
    item: 'product',
    label: 'Top productos más vendidos por sucursal',
  },
  series: [
    {
      name: 'Unidades',
      data: [14, 9, 11, 6],
    },
  ],
  narrative:
    'En Sucursal Centro lidera «Vestido Aurora» con 14 unidades; en Sucursal Norte, «Camisa Lino» con 11. En total se vendieron 40 unidades por Bs 8.280,00.',
  truncated: false,
  duration_ms: 180,
  usage: {
    used: 12,
    limit: 1000,
  },
};

export const runVacio: ReportResponse = {
  request_id: null,
  definition_code: 'top_productos',
  title: 'Top productos más vendidos por sucursal',
  columns: [
    { key: 'branch', label: 'Sucursal', type: 'text' },
    { key: 'product', label: 'Producto', type: 'text' },
    { key: 'sku', label: 'SKU', type: 'text' },
    { key: 'units', label: 'Unidades vendidas', type: 'int' },
    { key: 'revenue', label: 'Total recaudado (Bs)', type: 'money' },
  ],
  rows: [],
  groups: [],
  totals: {
    branch: 'TOTAL',
    product: '-',
    sku: '-',
    units: 0,
    revenue: 0.0,
  },
  chart: {
    kind: 'GROUPED_BAR',
    x: 'product',
    y: 'units',
    group: 'branch',
    item: 'product',
    label: 'Top productos más vendidos por sucursal',
  },
  series: [
    {
      name: 'Unidades',
      data: [],
    },
  ],
  narrative:
    "No se registraron movimientos para el reporte 'Top productos más vendidos por sucursal' en el período seleccionado.",
  truncated: false,
  duration_ms: 40,
  usage: {
    used: 12,
    limit: 1000,
  },
};

export const conflictosLista = {
  total: 1,
  page: 1,
  page_size: 20,
  pages: 1,
  items: [
    {
      id: 'c0ffee00-0000-4000-8000-000000000201',
      operation_id: 'c0ffee00-0000-4000-8000-000000000202',
      client_request_id: 'c0ffee00-0000-4000-8000-000000000203',
      operation_type: 'SALE',
      type: 'STOCK',
      status: 'OPEN',
      branch_id: 'c0ffee00-0000-4000-8000-0000000002b1',
      branch_name: 'Sucursal Centro',
      cashier_name: 'Bruno Rojas',
      device_id: 'web-caja-02',
      local_folio: 'OFF-9E32A1C4',
      created_at: '2026-11-11T15:00:04Z',
      refund: null,
      resolution: null,
      resolution_note: null,
      resolved_by_name: null,
      resolved_at: null,
      competing_operation: {
        server_number: 'FS-A8F3D1',
        device_id: 'web-caja-01',
        synchronized_at: '2026-11-11T15:00:02Z',
        client_created_at: '2026-11-11T14:15:00Z',
        cashier_name: 'Ana Suárez',
        origin: 'OFFLINE',
      },
      lines: [
        {
          variant_id: 'c0ffee00-0000-4000-8000-0000000002a1',
          product_name: 'Vestido Aurora',
          requested_quantity: 1,
          available_quantity: 0,
          unit_price: '300.00',
          current_price: '300.00',
          competing_operation: {
            server_number: 'FS-A8F3D1',
            device_id: 'web-caja-01',
            synchronized_at: '2026-11-11T15:00:02Z',
            client_created_at: '2026-11-11T14:15:00Z',
            cashier_name: 'Ana Suárez',
            origin: 'OFFLINE',
          },
        },
      ],
    },
  ],
};

export const resolverReintentarPeticion = {
  action: 'RETRY',
  note: 'Ingresó mercadería: 3 unidades registradas hoy.',
};

export const resolverReintentarOk = {
  id: 'c0ffee00-0000-4000-8000-000000000201',
  operation_id: 'c0ffee00-0000-4000-8000-000000000202',
  client_request_id: 'c0ffee00-0000-4000-8000-000000000203',
  operation_type: 'SALE',
  type: 'STOCK',
  status: 'RESOLVED',
  branch_id: 'c0ffee00-0000-4000-8000-0000000002b1',
  branch_name: 'Sucursal Centro',
  cashier_name: 'Bruno Rojas',
  device_id: 'web-caja-02',
  local_folio: 'OFF-9E32A1C4',
  created_at: '2026-11-11T15:00:04Z',
  refund: null,
  resolution: 'RETRY',
  resolution_note: 'Ingresó mercadería: 3 unidades registradas hoy.',
  resolved_by_name: 'Carla Méndez',
  resolved_at: '2026-11-11T16:10:00Z',
  competing_operation: null,
  lines: [
    {
      variant_id: 'c0ffee00-0000-4000-8000-0000000002a1',
      product_name: 'Vestido Aurora',
      requested_quantity: 1,
      available_quantity: 2,
      unit_price: '300.00',
      current_price: '300.00',
      competing_operation: null,
    },
  ],
};

export const resolverReintentarSinStock = {
  success: false,
  error: {
    code: 'stock_still_insufficient',
    message:
      'Todavía no hay existencia suficiente. Registrá el ingreso de mercadería o ajustá las cantidades.',
  },
};

export const resolverCompraCliente = {
  success: false,
  error: {
    code: 'validation_error',
    message: 'Las compras de clientes en conflicto solo admiten cancelación.',
  },
};
