import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardAnaliticoComponent } from './dashboard-analitico.component';
import { ModelosAnaliticosComponent } from './modelos-analiticos.component';
import { MLApi } from '../infrastructure/ml.api';
import { MLDashboard, AnomaliaItem } from '../domain/ml.models';

describe('Componentes de Analítica ML', () => {
  describe('DashboardAnaliticoComponent', () => {
    let comp: DashboardAnaliticoComponent;
    let mockApi: Partial<MLApi>;

    const mockDashboard: MLDashboard = {
      tenant_id: 'tenant-123',
      modelo_activo: {
        id: 'mod-1',
        model_type: 'DEMAND',
        version: '1.0.0',
        is_active: true,
        r2_score: 0.94,
        mae: 8.5,
        rmse: 11.2,
        created_at: '2026-11-04T10:00:00Z',
        published_at: '2026-11-04T10:05:00Z',
      },
      kpis: {
        demanda_proxima_semana: 245,
        total_clientes_segmentados: 120,
        anomalias_pendientes: 1,
        precision_modelo_r2: 0.94,
        error_promedio_mae: 8.5,
      },
      serie_demanda: [
        {
          semana: 1,
          fecha: '2026-11-10T00:00:00Z',
          demanda_proyectada: 245,
          intervalo_inferior: 220,
          intervalo_superior: 270,
        },
      ],
      segmentos: [
        {
          segment_id: 0,
          segment_name: 'Clientes Campeones',
          customer_count: 35,
          avg_monetary: 1500,
          avg_frequency: 8,
          avg_recency_days: 12,
          percentage: 29.1,
        },
      ],
      anomalias_recientes: [
        {
          id: 'anom-1',
          branch_id: 'suc-1',
          anomaly_date: '2026-11-03T00:00:00Z',
          metric_name: 'daily_sales',
          metric_value: 50,
          expected_value: 300,
          anomaly_score: -0.25,
          resolved: false,
        },
      ],
    };

    beforeEach(() => {
      mockApi = {
        getDashboard: vi.fn().mockResolvedValue(mockDashboard),
        getSegments: vi.fn().mockResolvedValue([]),
        getAnomalies: vi.fn().mockResolvedValue([]),
        resolveAnomaly: vi.fn().mockResolvedValue({
          ...mockDashboard.anomalias_recientes[0],
          resolved: true,
          notes: 'Corte de luz',
        }),
      };

      comp = new DashboardAnaliticoComponent(mockApi as MLApi);
    });

    it('carga datos del dashboard al inicializar', async () => {
      await comp.ngOnInit();
      expect(comp.dashboard()).toEqual(mockDashboard);
      expect(comp.dashboard()?.kpis.demanda_proxima_semana).toBe(245);
      expect(comp.cargando()).toBe(false);
      expect(comp.error()).toBeNull();
    });

    it('permite iniciar y confirmar la resolución de una anomalía', async () => {
      await comp.ngOnInit();
      const anom = mockDashboard.anomalias_recientes[0];
      comp.iniciarResolucion(anom);
      expect(comp.anomaliaSeleccionada()).toEqual(anom);

      comp.notasResolucion = 'Corte de luz verificado';
      await comp.confirmarResolucion();

      expect(mockApi.resolveAnomaly).toHaveBeenCalledWith('anom-1', 'Corte de luz verificado');
      expect(comp.anomaliaSeleccionada()).toBeNull();
      expect(comp.mensajeExito()).toContain('Anomalía marcada como resuelta');
    });

    it('cancela la resolución de anomalía limpiando el estado', () => {
      const anom = mockDashboard.anomalias_recientes[0];
      comp.iniciarResolucion(anom);
      comp.notasResolucion = 'Texto temporal';
      comp.cancelarResolucion();
      expect(comp.anomaliaSeleccionada()).toBeNull();
      expect(comp.notasResolucion).toBe('');
    });
  });

  describe('DashboardAnaliticoComponent · CU-31 segmentos y anomalías', () => {
    const segmentos = [
      { id: 's1', customer_id: 'cliente-0001', segment_name: 'Campeones', recency_days: 5, frequency_orders: 9, monetary_total: 1800, cluster_id: 0 },
      { id: 's2', customer_id: 'cliente-0002', segment_name: 'En riesgo', recency_days: 120, frequency_orders: 1, monetary_total: 90, cluster_id: 2 },
    ];
    const anomalia = { id: 'an-9', branch_id: 'b1', sale_date: '2026-11-02', anomaly_score: -0.31, reason: 'Ventas muy por debajo de lo esperado', resolved: false, notes: null, created_at: '2026-11-03T00:00:00' };
    let api: Record<string, ReturnType<typeof vi.fn>>;
    beforeEach(() => {
      api = {
        getDashboard: vi.fn().mockResolvedValue(null),
        getSegments: vi.fn().mockResolvedValue(segmentos),
        getAnomalies: vi.fn().mockResolvedValue([anomalia]),
        resolveAnomaly: vi.fn().mockResolvedValue({ id: 'an-9', resolved: true }),
      };
    });

    it('carga segmentos y anomalías pendientes al iniciar y permite filtrar segmentos', async () => {
      const comp = new DashboardAnaliticoComponent(api as unknown as MLApi);
      comp.ngOnInit();
      await comp.cargarSegmentos();
      await comp.cargarAnomalias();
      expect(api['getAnomalies']).toHaveBeenCalledWith(false);
      expect(comp.segmentos()).toHaveLength(2);
      expect(comp.nombresSegmento()).toEqual(['Campeones', 'En riesgo']);
      comp.filtroSegmento = 'En riesgo';
      expect(comp.segmentosFiltrados().map((s) => s.id)).toEqual(['s2']);
      expect(comp.anomalias()[0].id).toBe('an-9');
      expect(comp.cargandoSegmentos()).toBe(false);
      expect(comp.cargandoAnomalias()).toBe(false);
    });

    it('consulta todas las anomalías sin filtro y maneja la lista vacía', async () => {
      api['getAnomalies'].mockResolvedValue([]);
      const comp = new DashboardAnaliticoComponent(api as unknown as MLApi);
      comp.filtroAnomalias = 'todas';
      await comp.cargarAnomalias();
      expect(api['getAnomalies']).toHaveBeenCalledWith(undefined);
      expect(comp.anomalias()).toEqual([]);
      expect(comp.errorAnomalias()).toBeNull();
    });

    it('muestra el error de cada sección sin romper la otra', async () => {
      api['getSegments'].mockRejectedValue(new Error('Servicio de segmentos caído'));
      const comp = new DashboardAnaliticoComponent(api as unknown as MLApi);
      await comp.cargarSegmentos();
      await comp.cargarAnomalias();
      expect(comp.errorSegmentos()).toContain('segmentos caído');
      expect(comp.segmentos()).toEqual([]);
      expect(comp.errorAnomalias()).toBeNull();
      expect(comp.anomalias()).toHaveLength(1);
    });

    it('resuelve una anomalía de la lista y la recarga', async () => {
      const comp = new DashboardAnaliticoComponent(api as unknown as MLApi);
      await comp.cargarAnomalias();
      comp.iniciarResolucionRegistro(anomalia);
      expect(comp.anomaliaSeleccionada()?.metric_name).toBe(anomalia.reason);
      comp.notasResolucion = 'Feriado local';
      await comp.confirmarResolucion();
      expect(api['resolveAnomaly']).toHaveBeenCalledWith('an-9', 'Feriado local');
      expect(api['getAnomalies']).toHaveBeenCalledTimes(2);
    });

    it('oculta la resolución sin permiso o en modo solo lectura', () => {
      const sinPermiso = { can: () => false, readOnly: () => false };
      const soloLectura = { can: () => true, readOnly: () => true };
      const conPermiso = { can: () => true, readOnly: () => false };
      expect(new DashboardAnaliticoComponent(api as unknown as MLApi, sinPermiso as never).puedeResolver()).toBe(false);
      expect(new DashboardAnaliticoComponent(api as unknown as MLApi, soloLectura as never).puedeResolver()).toBe(false);
      expect(new DashboardAnaliticoComponent(api as unknown as MLApi, conPermiso as never).puedeResolver()).toBe(true);
    });
  });

  describe('ModelosAnaliticosComponent', () => {
    let comp: ModelosAnaliticosComponent;
    let mockApi: Partial<MLApi>;

    beforeEach(() => {
      mockApi = {
        getPlatformModels: vi.fn().mockResolvedValue([
          {
            id: 'm-1',
            model_type: 'DEMAND',
            version: '1.0.0',
            is_active: true,
            r2_score: 0.92,
            mae: 9.1,
            created_at: '2026-11-04T10:00:00Z',
          },
        ]),
        getPlatformRuns: vi.fn().mockResolvedValue([
          {
            id: 'run-1',
            tenant_id: 't-1',
            model_type: 'DEMAND',
            version: '1.0.0',
            status: 'COMPLETED',
            r2_score: 0.92,
            mae: 9.1,
            created_at: '2026-11-04T10:00:00Z',
          },
        ]),
        initializeDemo: vi.fn().mockResolvedValue({ status: 'COMPLETED' }),
      };

      comp = new ModelosAnaliticosComponent(mockApi as MLApi);
    });

    it('carga modelos y runs al inicializar', async () => {
      await comp.cargarDatos();
      expect(comp.models()).toHaveLength(1);
      expect(comp.runs()).toHaveLength(1);
      expect(comp.cargando()).toBe(false);
    });

    it('dispara entrenamiento y recarga datos', async () => {
      await comp.entrenarModelos();
      expect(mockApi.initializeDemo).toHaveBeenCalledWith(42);
      expect(comp.mensajeExito()).toContain('completado');
    });
  });
});
