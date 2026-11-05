import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { OperacionesPendientesComponent } from './operaciones-pendientes.component';
import { ConflictosSyncComponent } from './conflictos.component';
import { SincronizacionService } from '../application/sincronizacion.service';
import { OperacionesLocalesRepository } from '../infrastructure/operaciones-locales.repository';
import { SyncApi } from '../infrastructure/sync.api';

describe('Componentes de Sincronización', () => {
  describe('OperacionesPendientesComponent', () => {
    let comp: OperacionesPendientesComponent;
    let mockSyncService: Partial<SincronizacionService>;
    let mockRepo: Partial<OperacionesLocalesRepository>;

    beforeEach(() => {
      mockSyncService = {
        sincronizando: signal(false),
        pendientesCount: signal(2),
        conflictosCount: signal(1),
        ultimoSync: signal(new Date('2026-11-04T12:00:00Z')),
        ultimoError: signal(null),
        sincronizarAhora: vi.fn().mockResolvedValue({
          enviadas: 2,
          confirmadas: 2,
          conflictos: 0,
          rechazadas: 0,
        }),
      };
      mockRepo = {
        listarOperaciones: vi.fn().mockResolvedValue([
          {
            id: 'op-1',
            tipo: 'VENTA',
            estado: 'PENDIENTE',
            creada_en: '2026-11-04T10:00:00Z',
            intentos: 0,
            payload: {},
          },
          {
            id: 'op-2',
            tipo: 'RESERVA',
            estado: 'CONFIRMADA',
            creada_en: '2026-11-04T09:00:00Z',
            intentos: 1,
            payload: {},
          },
        ]),
        obtenerOperacion: vi.fn(),
      };

      comp = new OperacionesPendientesComponent(
        mockSyncService as SincronizacionService,
        mockRepo as OperacionesLocalesRepository,
      );
    });

    it('inicializa y carga operaciones', async () => {
      await comp.ngOnInit();
      expect(comp.operaciones()).toHaveLength(2);
      expect(comp.operacionesFiltradas()).toHaveLength(2);
    });

    it('filtra operaciones por estado', async () => {
      await comp.ngOnInit();
      comp.filtroActual.set('PENDIENTE');
      expect(comp.operacionesFiltradas()).toHaveLength(1);
      expect(comp.operacionesFiltradas()[0].id).toBe('op-1');
    });

    it('ejecuta sincronizacion manual', async () => {
      await comp.ngOnInit();
      await comp.sincronizar();
      expect(mockSyncService.sincronizarAhora).toHaveBeenCalled();
      expect(comp.mensajeExito()).toContain('2 confirmadas');
    });
  });

  describe('ConflictosSyncComponent', () => {
    let comp: ConflictosSyncComponent;
    let mockSyncApi: Partial<SyncApi>;

    beforeEach(() => {
      mockSyncApi = {
        getConflicts: vi.fn().mockResolvedValue({
          items: [
            {
              id: 'conf-1',
              tenant_id: 'ten-1',
              branch_id: 'br-1',
              client_request_id: 'req-1',
              operation_type: 'SALE',
              conflict_type: 'STOCK_INSUFICIENTE',
              status: 'PENDING',
              detected_at: '2026-11-04T10:00:00Z',
              payload_snapshot: {},
              server_state_snapshot: {},
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
        }),
        resolveConflict: vi.fn().mockResolvedValue({
          id: 'conf-1',
          status: 'RESOLVED',
        } as any),
      };

      comp = new ConflictosSyncComponent(mockSyncApi as SyncApi);
    });

    it('carga lista de conflictos inicial', async () => {
      await comp.ngOnInit();
      expect(comp.conflictos()).toHaveLength(1);
      expect(comp.conflictos()[0].conflict_type).toBe('STOCK_INSUFICIENTE');
    });

    it('resuelve conflicto con accion elegida', async () => {
      await comp.ngOnInit();
      comp.abrirModalResolucion(comp.conflictos()[0], 'ADJUST');
      comp.notasResolucion = 'Ajustado a stock real';
      await comp.confirmarResolucion();

      expect(mockSyncApi.resolveConflict).toHaveBeenCalledWith('conf-1', {
        resolution: 'ADJUST',
        resolution_notes: 'Ajustado a stock real',
      });
      expect(comp.modalConflicto()).toBeNull();
    });
  });
});
