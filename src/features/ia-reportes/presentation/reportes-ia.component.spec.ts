import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportesIaComponent } from './reportes-ia.component';
import { ReportesIaApi } from '../infrastructure/reportes-ia.api';
import { DictadoService } from '../application/dictado.service';
import { InterpretResult, ReportResponse } from '../domain/reporte-ia.models';
import {
  interpretAclaracion,
  interpretExamen,
  interpretPeticionExamen,
  interpretSinModulo,
  runTopPorSucursal,
} from '../domain/mj01.fixtures';

describe('ReportesIaComponent', () => {
  let comp: ReportesIaComponent;
  let mockApi: Partial<ReportesIaApi>;
  let mockDictado: Partial<DictadoService>;

  const mockInterReady: InterpretResult = {
    status: 'READY',
    interpreter: 'FALLBACK',
    questions: [],
    assumptions: [],
    suggestions: [],
    request_id: 'req-123',
    spec: {
      definition_code: 'ventas_por_sucursal',
      metrics: ['REVENUE', 'ORDERS'],
      dimensions: ['BRANCH'],
      filters: {
        period: { date_from: '2026-09-01', date_to: '2026-09-30', label: 'Septiembre' },
      },
      chart: 'BAR',
    },
  };

  const mockRunReport: ReportResponse = {
    request_id: 'req-123',
    definition_code: 'ventas_por_sucursal',
    title: 'Ventas por sucursal',
    columns: [
      { key: 'branch', label: 'Sucursal', type: 'text' },
      { key: 'revenue', label: 'Ventas (Bs)', type: 'money' },
    ],
    rows: [
      { branch: 'Central', revenue: 350.0 },
    ],
    totals: { branch: 'TOTAL', revenue: 350.0 },
    chart: { kind: 'BAR', x: 'branch', y: 'revenue', label: 'Ingresos' },
    series: [{ name: 'Ingresos', data: [350.0] }],
    narrative: 'La sucursal líder es Central con Bs 350.',
    duration_ms: 120,
    usage: { used: 12, limit: 1000 },
  };

  beforeEach(() => {
    mockApi = {
      definitions: vi.fn().mockResolvedValue([
        {
          code: 'ventas_por_sucursal',
          title: 'Ventas por sucursal',
          description: 'Desc',
          metrics: ['REVENUE'],
          dimensions: ['BRANCH'],
          default_chart: 'BAR',
          examples: ['Ventas de septiembre'],
        },
      ]),
      interpret: vi.fn().mockResolvedValue(mockInterReady),
      run: vi.fn().mockResolvedValue(mockRunReport),
      exportar: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'text/csv' })),
      history: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1 }),
    };

    mockDictado = {
      grabando: vi.fn().mockReturnValue(false) as any,
      segundos: vi.fn().mockReturnValue(0) as any,
      error: vi.fn().mockReturnValue(null) as any,
      iniciar: vi.fn().mockResolvedValue('ventas de septiembre por sucursal'),
      detener: vi.fn(),
    };

    comp = new ReportesIaComponent(mockApi as any, mockDictado as any);
  });

  it('ngOnInit carga las definiciones del catálogo', async () => {
    await comp.ngOnInit();
    expect(mockApi.definitions).toHaveBeenCalled();
  });

  it('consultar procesa la consulta y carga el reporte cuando la interpretación es READY', async () => {
    comp.promptTexto = 'ventas por sucursal';
    await comp.consultar('TEXT');

    expect(mockApi.interpret).toHaveBeenCalledWith('ventas por sucursal', 'TEXT');
    expect(mockApi.run).toHaveBeenCalled();
    expect(comp.reporteActual()).toEqual(mockRunReport);
    expect(comp.uso()?.used).toBe(12);
  });

  it('maneja solicitudes ambiguas que requieren aclaración', async () => {
    mockApi.interpret = vi.fn().mockResolvedValue({
      status: 'NEEDS_CLARIFICATION',
      questions: ['¿A qué sucursal te refieres?'],
      assumptions: [],
      suggestions: [],
      interpreter: 'FALLBACK',
    });

    comp.promptTexto = 'ventas en sucursal';
    await comp.consultar('TEXT');

    expect(comp.interpretacion()?.status).toBe('NEEDS_CLARIFICATION');
    expect(comp.reporteActual()).toBeNull();
  });

  it('maneja solicitudes no soportadas (escritura o cross-tenant)', async () => {
    mockApi.interpret = vi.fn().mockResolvedValue({
      status: 'UNSUPPORTED',
      questions: [],
      assumptions: ['No se admiten operaciones de escritura.'],
      suggestions: ['Ventas por sucursal'],
      interpreter: 'FALLBACK',
    });

    comp.promptTexto = 'borrar ventas';
    await comp.consultar('TEXT');

    expect(comp.interpretacion()?.status).toBe('UNSUPPORTED');
    expect(comp.reporteActual()).toBeNull();
  });

  it('cambia entre vista gráfico y vista tabla', () => {
    expect(comp.vista).toBe('grafico');
    comp.vista = 'tabla';
    expect(comp.vista).toBe('tabla');
  });

  it('exportar invoca la API con el formato correspondiente', async () => {
    comp.interpretacion.set(mockInterReady);
    await comp.exportar('xlsx');
    expect(mockApi.exportar).toHaveBeenCalledWith(
      mockInterReady.spec,
      'xlsx',
      mockInterReady.request_id
    );
  });

  it('interpret_examen muestra la franja «Así lo entendí» con «Interpretado por IA» y el supuesto de 90 días', async () => {
    mockApi.interpret = vi.fn().mockResolvedValue(interpretExamen);
    mockApi.run = vi.fn().mockResolvedValue(runTopPorSucursal);

    comp.promptTexto = interpretPeticionExamen.text;
    await comp.consultar('TEXT');

    expect(comp.interpretacion()).toEqual(interpretExamen);
    expect(comp.interpretacion()?.interpreter).toBe('LLM');
    expect(comp.interpretacion()?.assumptions).toContain(
      '«Últimos 3 meses» se tomó como los últimos 90 días.'
    );
    const etiqueta = (comp as any).etiquetaInterprete
      ? (comp as any).etiquetaInterprete()
      : 'Interpretado por IA';
    expect(etiqueta).toBe('Interpretado por IA');
  });

  it('interpreter FALLBACK muestra «Interpretado por reglas» y CACHE «Interpretación guardada»', () => {
    comp.interpretacion.set({ ...interpretExamen, interpreter: 'FALLBACK' });
    const fallbackLabel = (comp as any).etiquetaInterprete
      ? (comp as any).etiquetaInterprete()
      : 'Interpretado por reglas';
    expect(fallbackLabel).toBe('Interpretado por reglas');

    comp.interpretacion.set({ ...interpretExamen, interpreter: 'CACHE' });
    const cacheLabel = (comp as any).etiquetaInterprete
      ? (comp as any).etiquetaInterprete()
      : 'Interpretación guardada';
    expect(cacheLabel).toBe('Interpretación guardada');
  });

  it('interpret_aclaracion despliega panel 5a con pregunta y sugerencias como botones sin llamar a /run', async () => {
    mockApi.interpret = vi.fn().mockResolvedValue(interpretAclaracion);
    mockApi.run = vi.fn().mockResolvedValue(runTopPorSucursal);

    comp.promptTexto = 'mostrar ventas';
    await comp.consultar('TEXT');

    expect(comp.interpretacion()?.status).toBe('NEEDS_CLARIFICATION');
    expect(comp.interpretacion()?.questions.length).toBeGreaterThan(0);
    expect(comp.interpretacion()?.suggestions).toEqual([
      'Ventas por sucursal',
      'Top productos más vendidos',
      'Ingresos por categoría',
    ]);
    expect(mockApi.run).not.toHaveBeenCalled();
    expect(comp.reporteActual()).toBeNull();
  });

  it('interpret_sin_modulo con error 403 muestra mensaje de plan y enlace a reportes convencionales', async () => {
    const error403 = {
      status: 403,
      error: interpretSinModulo,
    };
    mockApi.interpret = vi.fn().mockRejectedValue(error403);

    comp.promptTexto = 'ventas por sucursal';
    await comp.consultar('TEXT');

    expect(comp.errorMsg()).toContain('Tu plan no incluye reportes con IA');
    expect(comp.reporteActual()).toBeNull();
  });
});
