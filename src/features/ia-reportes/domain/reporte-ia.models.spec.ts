import { describe, expect, it } from 'vitest';
import {
  aplicarAclaracion,
  chipsDeSpec,
  formatoCelda,
  formatoValor,
  ReportSpec,
} from './reporte-ia.models';

describe('ReporteIaModels', () => {
  it('chipsDeSpec genera etiquetas comprensibles para los filtros activos', () => {
    const spec: ReportSpec = {
      definition_code: 'ventas_por_sucursal',
      metrics: ['REVENUE', 'ORDERS'],
      dimensions: ['BRANCH'],
      filters: {
        period: { date_from: '2026-09-01', date_to: '2026-09-30', label: 'Septiembre' },
        branch_names: ['Central', 'Norte'],
        low_stock_lt: 5,
      },
      top_n: 10,
      compare_previous: true,
    };

    const chips = chipsDeSpec(spec);
    expect(chips.length).toBeGreaterThanOrEqual(4);
    expect(chips.some((c) => c.etiqueta === 'Período' && c.valor === 'Septiembre')).toBe(true);
    expect(chips.some((c) => c.etiqueta === 'Sucursales' && c.valor === 'Central, Norte')).toBe(true);
    expect(chips.some((c) => c.etiqueta === 'Límite' && c.valor === 'Top 10')).toBe(true);
  });

  it('aplicarAclaracion actualiza los filtros sin mutar la especificación original', () => {
    const original: ReportSpec = {
      definition_code: 'top_productos',
      metrics: ['UNITS'],
      dimensions: ['PRODUCT'],
      filters: { branch_names: ['Central'] },
    };

    const actualizada = aplicarAclaracion(original, {
      category_names: ['Vestidos'],
    });

    expect(actualizada).not.toBe(original);
    expect(actualizada.filters.branch_names).toEqual(['Central']);
    expect(actualizada.filters.category_names).toEqual(['Vestidos']);
    expect(original.filters.category_names).toBeUndefined();
  });

  it('formatoCelda formatea valores con formato boliviano', () => {
    expect(formatoCelda(1250.5, 'money')).toContain('Bs');
    expect(formatoCelda(1250.5, 'money')).toContain('1.250,50');
    expect(formatoCelda(42, 'int')).toBe('42');
    expect(formatoCelda(15.67, 'pct')).toBe('15.7%');
    expect(formatoCelda('Santa Cruz', 'text')).toBe('Santa Cruz');
    expect(formatoCelda(null, 'money')).toBe('-');
  });

  it('formatoValor formatea enteros y dinero correctamente', () => {
    expect(formatoValor(14, 'int')).toBe('14');
    expect(formatoValor(1350, 'money')).toBe('Bs 1.350,00');
  });
});
