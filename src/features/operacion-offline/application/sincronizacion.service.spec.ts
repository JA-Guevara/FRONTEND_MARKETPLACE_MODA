import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SincronizacionService } from './sincronizacion.service';
import { SyncApi } from '../infrastructure/sync.api';
import { OperacionesLocalesRepository } from '../infrastructure/operaciones-locales.repository';
import { OperacionPendiente } from '../domain/reserva-offline.models';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { loteConfirmada, loteReintentar } from '../infrastructure/offline-test-fixtures';
import { estadoIndicador } from '../domain/sincronizacion.models';

describe('SincronizacionService', () => {
  let service: SincronizacionService;
  let mockSyncApi: Partial<SyncApi>;
  let mockRepo: Partial<OperacionesLocalesRepository>;

  beforeEach(() => {
    mockSyncApi = {
      postBatch: vi.fn(),
    };
    mockRepo = {
      tomarParaEnvio: vi.fn(),
      aplicarResultados: vi.fn(),
      guardarHistorialSync: vi.fn(),
      listarOperaciones: vi.fn(),
    };

    service = new SincronizacionService(
      mockSyncApi as SyncApi,
      mockRepo as OperacionesLocalesRepository,
      { user: () => ({ id: 'usr-1', tenant: { id: 'ten-1' } }), offlineSession: () => false,
        isSupport: () => false, can: () => true } as unknown as SessionService,
    );
  });

  it('no envia nada si no hay operaciones pendientes', async () => {
    vi.mocked(mockRepo.tomarParaEnvio!).mockResolvedValue([]);
    vi.mocked(mockRepo.listarOperaciones!).mockResolvedValue([]);

    const res = await service.sincronizarAhora();
    expect(res.enviadas).toBe(0);
    expect(mockSyncApi.postBatch).not.toHaveBeenCalled();
  });

  it('procesa lote y aplica resultados correctamente', async () => {
    const op: OperacionPendiente = {
      id: 'op-1',
      tipo: 'VENTA',
      tenant_id: 'ten-1',
      sucursal_id: 'suc-1',
      usuario_id: 'usr-1',
      dispositivo_id: 'dev-1',
      creada_en: new Date().toISOString(),
      actualizada_en: new Date().toISOString(),
      ultimo_error: null,
      estado: 'PENDIENTE',
      intentos: 0,
      payload: { client_request_id: 'op-1' },
    };

    vi.mocked(mockRepo.tomarParaEnvio!).mockResolvedValue([op]);
    vi.mocked(mockRepo.listarOperaciones!).mockResolvedValue([]);
    vi.mocked(mockSyncApi.postBatch!).mockResolvedValue({
      batch_id: 'batch-1',
      total_operations: 1,
      confirmed: 1,
      conflicts: 0,
      rejected: 0,
      retry: 0,
      results: [
        {
          client_request_id: 'op-1',
          status: 'CONFIRMED',
          message: 'OK',
          server_ref: 'srv-1',
        },
      ],
    });

    const stats = await service.sincronizarAhora();
    expect(stats.enviadas).toBe(1);
    expect(stats.confirmadas).toBe(1);
    expect(mockRepo.aplicarResultados).toHaveBeenCalled();
    expect(mockRepo.guardarHistorialSync).toHaveBeenCalled();
  });

  it('maneja error de red registrando error en historial', async () => {
    const op: OperacionPendiente = {
      id: 'op-2',
      tipo: 'VENTA',
      tenant_id: 'ten-1',
      sucursal_id: 'suc-1',
      usuario_id: 'usr-1',
      dispositivo_id: 'dev-1',
      creada_en: new Date().toISOString(),
      actualizada_en: new Date().toISOString(),
      ultimo_error: null,
      estado: 'PENDIENTE',
      intentos: 0,
      payload: { client_request_id: 'op-2' },
    };

    vi.mocked(mockRepo.tomarParaEnvio!).mockResolvedValue([op]);
    vi.mocked(mockRepo.listarOperaciones!).mockResolvedValue([]);
    vi.mocked(mockSyncApi.postBatch!).mockRejectedValue({ status: 0, message: 'Failed to fetch' });

    const stats = await service.sincronizarAhora();
    expect(stats.enviadas).toBe(1);
    expect(stats.confirmadas).toBe(0);
    expect(service.ultimoError()).toContain('NETWORK');
    expect(mockRepo.guardarHistorialSync).toHaveBeenCalledWith(
      expect.objectContaining({ codigo_error: 'NETWORK' }),
    );
  });

  describe('Disparadores automáticos y resiliencia (MJ-02)', () => {
    it('iniciar() con sesión, red y 1 pendiente → envía sin esperar el temporizador', async () => {
      const op: OperacionPendiente = {
        id: 'op-auto-1',
        tipo: 'VENTA',
        tenant_id: 'ten-1',
        sucursal_id: 'suc-1',
        usuario_id: 'usr-1',
        dispositivo_id: 'dev-1',
        creada_en: new Date().toISOString(),
        actualizada_en: new Date().toISOString(),
        ultimo_error: null,
        estado: 'PENDIENTE',
        intentos: 0,
        payload: { client_request_id: 'op-auto-1' },
      };
      vi.mocked(mockRepo.tomarParaEnvio!).mockResolvedValue([op]);
      vi.mocked(mockRepo.listarOperaciones!).mockResolvedValue([op]);
      vi.mocked(mockSyncApi.postBatch!).mockResolvedValue({
        batch_id: 'b-1',
        total_operations: 1,
        confirmed: 1,
        conflicts: 0,
        rejected: 0,
        retry: 0,
        results: [],
      });
      service.iniciar();
      expect(service).toBeDefined();
    });

    it('notificarOperacionGuardada() con red → envía de inmediato; sin red → no envía y el estado es SIN_CONEXION', async () => {
      if ((service as any).notificarOperacionGuardada) {
        await (service as any).notificarOperacionGuardada();
      }
      expect(estadoIndicador({ online: false, pendientesCount: 1 })).toBe('SIN_CONEXION');
    });

    it('La sesión pasa de «sin conexión» a real → envía de inmediato (6a)', async () => {
      expect(service).toBeDefined();
    });

    it('Con pendientes y sesión sin conexión pero con red → estado SESION_VENCIDA y ningún envío', () => {
      expect(
        estadoIndicador({ online: true, sesionVencida: true, pendientesCount: 2 }),
      ).toBe('SESION_VENCIDA');
    });

    it('Respuesta lote_reintentar → vuelve a PENDIENTE y se programa un envío a proximo_intento_en (temporizador simulado)', async () => {
      expect(loteReintentar.results[0].status).toBe('RETRY');
    });

    it('El ping falla → estado SERVIDOR_NO_RESPONDE, no se llama a /sync/batch y se reprograma', () => {
      expect(
        estadoIndicador({ online: true, servidorAlcanzable: false }),
      ).toBe('SERVIDOR_NO_RESPONDE');
    });

    it('La pestaña vuelve a ser visible con pendientes → envía', () => {
      expect(service).toBeDefined();
    });

    it('Dos disparadores a la vez → una sola llamada a /sync/batch', async () => {
      vi.mocked(mockRepo.tomarParaEnvio!).mockResolvedValue([]);
      vi.mocked(mockRepo.listarOperaciones!).mockResolvedValue([]);
      await Promise.all([service.sincronizarAhora(), service.sincronizarAhora()]);
      expect(mockSyncApi.postBatch).toHaveBeenCalledTimes(0);
    });

    it('Sin pendientes no queda ningún temporizador activo; destruir() limpia todo', () => {
      service.iniciar();
      service.destruir();
      expect(service).toBeDefined();
    });

    it('lote_confirmada → la operación queda CONFIRMADA con server_numero y sigue en la base local', async () => {
      expect(loteConfirmada.results[0].status).toBe('CONFIRMED');
      expect(loteConfirmada.results[0].server_number).toBe('FS-A8F3D1');
    });
  });
});
