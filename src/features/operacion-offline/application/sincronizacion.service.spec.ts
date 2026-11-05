import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SincronizacionService } from './sincronizacion.service';
import { SyncApi } from '../infrastructure/sync.api';
import { OperacionesLocalesRepository } from '../infrastructure/operaciones-locales.repository';
import { OperacionPendiente } from '../domain/reserva-offline.models';

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
});
