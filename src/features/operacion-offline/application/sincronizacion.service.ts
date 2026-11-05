import { Injectable, inject, signal } from '@angular/core';
import { SyncApi, SyncBatchResponse } from '../infrastructure/sync.api';
import { OperacionesLocalesRepository } from '../infrastructure/operaciones-locales.repository';
import {
  SyncOperationWire,
  enLotes,
  clasificarError,
} from '../domain/sincronizacion.models';
import { OperacionPendiente } from '../domain/reserva-offline.models';

@Injectable({ providedIn: 'root' })
export class SincronizacionService {
  private syncApi: SyncApi;
  private operacionesRepo: OperacionesLocalesRepository;

  constructor(
    syncApi?: SyncApi,
    operacionesRepo?: OperacionesLocalesRepository,
  ) {
    this.syncApi = syncApi ?? inject(SyncApi);
    this.operacionesRepo = operacionesRepo ?? inject(OperacionesLocalesRepository);
  }

  readonly sincronizando = signal<boolean>(false);
  readonly pendientesCount = signal<number>(0);
  readonly conflictosCount = signal<number>(0);
  readonly ultimoSync = signal<Date | null>(null);
  readonly ultimoError = signal<string | null>(null);

  private timerId: any = null;
  private onlineListener: (() => void) | null = null;

  iniciar(intervaloMs = 300000) {
    this.actualizarContadores();

    if (typeof window !== 'undefined') {
      this.onlineListener = () => {
        if (navigator.onLine) {
          this.sincronizarAhora();
        }
      };
      window.addEventListener('online', this.onlineListener);

      if (intervaloMs > 0) {
        this.timerId = setInterval(() => {
          if (navigator.onLine && !this.sincronizando()) {
            this.sincronizarAhora();
          }
        }, intervaloMs);
      }
    }
  }

  destruir() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (typeof window !== 'undefined' && this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
      this.onlineListener = null;
    }
  }

  async actualizarContadores(): Promise<void> {
    try {
      const ops = await this.operacionesRepo.listarOperaciones();
      const pendientes = ops.filter((o) => o.estado === 'PENDIENTE').length;
      const conflictos = ops.filter((o) => o.estado === 'CONFLICTO').length;
      this.pendientesCount.set(pendientes);
      this.conflictosCount.set(conflictos);
    } catch {
      // Ignorar si db no está inicializada
    }
  }

  async sincronizarAhora(): Promise<{
    enviadas: number;
    confirmadas: number;
    conflictos: number;
    rechazadas: number;
  }> {
    if (this.sincronizando()) {
      return { enviadas: 0, confirmadas: 0, conflictos: 0, rechazadas: 0 };
    }

    if (typeof navigator !== 'undefined' && (navigator as any).locks?.request) {
      return await (navigator as any).locks.request(
        'fashionstore-sync',
        { ifAvailable: true },
        async (lock: any) => {
          if (!lock) {
            return { enviadas: 0, confirmadas: 0, conflictos: 0, rechazadas: 0 };
          }
          return await this.ejecutarSincronizacion();
        },
      );
    }

    return await this.ejecutarSincronizacion();
  }

  private async ejecutarSincronizacion(): Promise<{
    enviadas: number;
    confirmadas: number;
    conflictos: number;
    rechazadas: number;
  }> {
    this.sincronizando.set(true);
    this.ultimoError.set(null);

    const ahora = new Date();
    const stats = { enviadas: 0, confirmadas: 0, conflictos: 0, rechazadas: 0 };

    try {
      const pendientes = await this.operacionesRepo.tomarParaEnvio(ahora, 50);
      if (pendientes.length === 0) {
        await this.actualizarContadores();
        return stats;
      }

      const lotes = enLotes(pendientes, 50);

      for (const lote of lotes) {
        const wireOperations: SyncOperationWire[] = lote.map((op: OperacionPendiente) => ({
          client_request_id: op.id,
          type: op.tipo === 'VENTA' || (op.tipo as string) === 'SALE' ? 'SALE' : 'RESERVATION',
          branch_id: op.sucursal_id,
          device_id: op.dispositivo_id,
          client_created_at: op.creada_en,
          payload: op.payload,
        }));

        stats.enviadas += wireOperations.length;

        try {
          const resp: SyncBatchResponse = await this.syncApi.postBatch(wireOperations);
          if (resp && resp.results) {
            await this.operacionesRepo.aplicarResultados(resp.results, new Date());
            stats.confirmadas += resp.confirmed || 0;
            stats.conflictos += resp.conflicts || 0;
            stats.rechazadas += resp.rejected || 0;
          }

          await this.operacionesRepo.guardarHistorialSync({
            iniciado_en: ahora.toISOString(),
            terminado_en: new Date().toISOString(),
            enviadas: wireOperations.length,
            confirmadas: resp?.confirmed ?? 0,
            conflictos: resp?.conflicts ?? 0,
            rechazadas: resp?.rejected ?? 0,
            lote_id: resp?.batch_id,
            http_status: 200,
          });
        } catch (err: any) {
          const clasif = clasificarError(err);
          this.ultimoError.set(`Error de sincronización (${clasif.codigo})`);

          await this.operacionesRepo.guardarHistorialSync({
            iniciado_en: ahora.toISOString(),
            terminado_en: new Date().toISOString(),
            enviadas: wireOperations.length,
            confirmadas: 0,
            conflictos: 0,
            rechazadas: 0,
            codigo_error: clasif.codigo,
            http_status: clasif.http_status,
          });

          if (clasif.codigo === 'NETWORK' || clasif.codigo === 'TIMEOUT') {
            break;
          }
        }
      }

      this.ultimoSync.set(new Date());
    } finally {
      this.sincronizando.set(false);
      await this.actualizarContadores();
    }

    return stats;
  }
}
