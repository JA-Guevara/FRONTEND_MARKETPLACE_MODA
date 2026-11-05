export type Metric = 'REVENUE' | 'UNITS' | 'ORDERS' | 'AVG_TICKET' | 'STOCK' | 'RESERVATIONS';

export type Dimension = 'BRANCH' | 'CATEGORY' | 'PRODUCT' | 'DAY' | 'WEEK' | 'MONTH' | 'PAYMENT_METHOD' | 'STATUS';

export type ChartKind = 'BAR' | 'GROUPED_BAR' | 'LINE' | 'PIE' | 'TABLE';

export interface Period {
  date_from: string;
  date_to: string;
  label?: string;
}

export interface Filters {
  period?: Period | null;
  branch_names?: string[];
  category_names?: string[];
  product_names?: string[];
  status?: string | null;
  low_stock_lt?: number | null;
}

export interface ReportSpec {
  definition_code: string;
  metrics: Metric[];
  dimensions: Dimension[];
  filters: Filters;
  top_n?: number | null;
  order?: 'asc' | 'desc';
  compare_previous?: boolean;
  chart?: ChartKind | null;
}

export interface InterpretResult {
  status: 'READY' | 'NEEDS_CLARIFICATION' | 'UNSUPPORTED';
  spec?: ReportSpec | null;
  questions: string[];
  assumptions: string[];
  suggestions: string[];
  interpreter: 'LLM' | 'FALLBACK';
  request_id?: string;
}

export interface ColumnMeta {
  key: string;
  label: string;
  type: 'text' | 'money' | 'int' | 'pct';
}

export interface ReportResponse {
  request_id?: string | null;
  definition_code: string;
  title: string;
  columns: ColumnMeta[];
  rows: Record<string, any>[];
  totals: Record<string, any>;
  chart: {
    kind: string;
    x: string;
    y: string;
    label?: string;
  };
  series: {
    name: string;
    data: any[];
  }[];
  narrative: string;
  truncated?: boolean;
  duration_ms?: number;
  usage: {
    used: number;
    limit: number;
  };
}

export interface DefinicionReporte {
  code: string;
  title: string;
  description: string;
  metrics: string[];
  dimensions: string[];
  default_chart: string;
  examples: string[];
}

export interface SolicitudHistorial {
  id: string;
  created_at: string;
  prompt_text: string;
  title: string;
  definition_code?: string;
  user_name: string;
  channel: string;
  status: string;
  rows?: number;
  export_format?: string;
  spec?: any;
}

export function chipsDeSpec(spec: ReportSpec): { etiqueta: string; valor: string }[] {
  const chips: { etiqueta: string; valor: string }[] = [];

  if (spec.filters.period) {
    const f = spec.filters.period;
    chips.push({
      etiqueta: 'Período',
      valor: f.label || `${f.date_from} al ${f.date_to}`,
    });
  }

  if (spec.filters.branch_names && spec.filters.branch_names.length > 0) {
    chips.push({
      etiqueta: 'Sucursales',
      valor: spec.filters.branch_names.join(', '),
    });
  }

  if (spec.filters.category_names && spec.filters.category_names.length > 0) {
    chips.push({
      etiqueta: 'Categorías',
      valor: spec.filters.category_names.join(', '),
    });
  }

  if (spec.filters.product_names && spec.filters.product_names.length > 0) {
    chips.push({
      etiqueta: 'Prendas',
      valor: spec.filters.product_names.join(', '),
    });
  }

  if (spec.top_n) {
    chips.push({
      etiqueta: 'Límite',
      valor: `Top ${spec.top_n}`,
    });
  }

  if (spec.filters.low_stock_lt) {
    chips.push({
      etiqueta: 'Umbral stock',
      valor: `< ${spec.filters.low_stock_lt} u.`,
    });
  }

  if (spec.compare_previous) {
    chips.push({
      etiqueta: 'Comparación',
      valor: 'vs. período previo',
    });
  }

  return chips;
}

export function aplicarAclaracion(spec: ReportSpec, respuesta: Partial<Filters>): ReportSpec {
  return {
    ...spec,
    filters: {
      ...spec.filters,
      ...respuesta,
    },
  };
}

export function formatoCelda(valor: unknown, tipo: 'money' | 'int' | 'pct' | 'text'): string {
  if (valor === null || valor === undefined || valor === '') {
    return '-';
  }

  const num = typeof valor === 'number' ? valor : parseFloat(String(valor));

  switch (tipo) {
    case 'money':
      return isNaN(num)
        ? String(valor)
        : `Bs ${num.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'int':
      return isNaN(num) ? String(valor) : num.toLocaleString('es-BO', { maximumFractionDigits: 0 });
    case 'pct':
      return isNaN(num) ? String(valor) : `${num.toFixed(1)}%`;
    case 'text':
    default:
      return String(valor);
  }
}
