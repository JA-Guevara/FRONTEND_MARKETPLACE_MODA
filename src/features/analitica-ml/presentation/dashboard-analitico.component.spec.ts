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
        initialize: vi.fn().mockResolvedValue({ status: 'COMPLETED' }),
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
      expect(mockApi.initialize).toHaveBeenCalledWith(42);
      expect(comp.mensajeExito()).toContain('completado');
    });
  });
});
