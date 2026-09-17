import { ExportReport, ReportQuery } from '../../ia-reportes/domain/dashboard';

export const REPORTS: ExportReport[] = ['ventas', 'pedidos', 'pagos', 'prendas_vendidas', 'existencias', 'sucursales'];

/** Normalize commands, never stored product data. Keep routing testable and
 * tolerate common dictation/typing variants without granting permissions. */
export function commandText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\besport/g, 'export').replace(/\brpeortes?\b/g, 'reporte')
    .replace(/\bexcell?\b/g, 'excel').replace(/\bregis?trar\b/g, 'registrar')
    .replace(/\s+/g, ' ').trim();
}

export function assistantIntent(value: string): 'chat' | 'export' | 'apply' | 'draft' | 'explain' {
  const t = commandText(value);
  if (/\b(como|donde)\b.*\b(export|descarg|registr|crea|filtr)/.test(t)) return 'chat';
  if (/\bmi(s)? (pedido|reserva|carrito)/.test(t)) return 'chat';
  if (/\b(registr\w*|crea\w*|agrega\w*|alta)\b.*\b(prenda|producto|ropa|polera|camisa|camiseta|remera|pantalon|campera|chaqueta|vestido|falda|short|buzo|casaca)s?\b/.test(t)) return 'draft';
  if (/\b(export\w*|descarg\w*|bajame|enviame|mandame|pasame)\b/.test(t)
      || /\b(quiero|necesito|gener\w*|dame|ahora)\b.*\b(excel|xlsx|pdf|csv)\b/.test(t)) return 'export';
  if (/\b(explic\w*|analiz\w*|interpret\w*|por que)\b/.test(t)) return 'explain';
  if (/\b(mostra\w*|muestra\w*|filtr\w*|aplica\w*|quita\w*|limpia\w*)\b/.test(t) || /\belimina\w*\b.*\bfiltros?\b/.test(t)) return 'apply';
  return 'chat';
}

export function requestedReports(value: string): ExportReport[] {
  const t = commandText(value);
  if (/\b(todos? los reportes|todos? los informes)\b/.test(t) || /\b(export\w*|descarg\w*)\s+(todo|todos)(\s+en\s+(excel|xlsx|pdf|csv))?[.!?]*$/.test(t)) return [...REPORTS];
  const result: ExportReport[] = [];
  if (/\bventas?|ingresos\b/.test(t)) result.push('ventas');
  if (/\bpedidos?|ordenes\b/.test(t)) result.push('pedidos');
  if (/\bpagos?\b/.test(t)) result.push('pagos');
  if (/prendas vendidas|mas vendid/.test(t)) result.push('prendas_vendidas');
  if (/\bexistencias?|stock|inventario\b/.test(t)) result.push('existencias');
  // Singular "sucursal Centro" is a filter, not another report.
  if (/\bsucursales\b/.test(t) || (!result.length && /\bsucursal\b/.test(t))) result.push('sucursales');
  return result;
}

export function clearsFilter(value: string, field: string): boolean {
  const t = commandText(value);
  return /\b(quita\w*|elimina\w*|limpia\w*|sin)\s+(todos?\s+los\s+)?filtros?\s*$/.test(t)
    || new RegExp(`\\b(quita\\w*|elimina\\w*|limpia\\w*|sin)\\b.*\\b(${field})\\b`).test(t);
}

export function queryForCommand(text: string, filters: ReportQuery, current: ReportQuery): ReportQuery {
  return {
    branch_id: clearsFilter(text, 'sucursal') ? null : filters.branch_id ?? current.branch_id ?? null,
    category_id: clearsFilter(text, 'categoria') ? null : filters.category_id ?? current.category_id ?? null,
    status: clearsFilter(text, 'estado') ? undefined : filters.status ?? current.status ?? undefined,
    date_from: clearsFilter(text, 'fecha|fechas|periodo') ? undefined : filters.date_from ?? current.date_from ?? undefined,
    date_to: clearsFilter(text, 'fecha|fechas|periodo') ? undefined : filters.date_to ?? current.date_to ?? undefined,
    low_stock_lt: clearsFilter(text, 'stock|umbral') ? undefined : filters.low_stock_lt ?? current.low_stock_lt,
  };
}
