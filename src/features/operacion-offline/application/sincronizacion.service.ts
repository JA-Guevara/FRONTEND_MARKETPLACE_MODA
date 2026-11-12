import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subject } from 'rxjs';
import { SyncApi, SyncBatchResponse } from '../infrastructure/sync.api';
import { OperacionesLocalesRepository } from '../infrastructure/operaciones-locales.repository';
import {
  SyncOperationWire,
  enLotes,
  clasificarError,
  EstadoIndicador,
  estadoIndicador,
  proximoDisparo,
} from '../domain/sincronizacion.models';
import { OperacionPendiente } from '../domain/reserva-offline.models';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { ConnectivityService } from '../../../app/core/offline/connectivity.service';
import { NoticesService } from '../../../app/core/notices.service';

@Injectable({ providedIn: 'root' })
export class SincronizacionService {
  private syncApi: SyncApi;
  private operacionesRepo: OperacionesLocalesRepository;
  private session: SessionService;
  private connectivity: ConnectivityService;
  private notices?: NoticesService | null;
  private destroyRef: DestroyRef | null = null;

  constructor(
    syncApi?: SyncApi,
    operacionesRepo?: OperacionesLocalesRepository,
    session?: SessionService,
    connectivity?: ConnectivityService,
    notices?: NoticesService,
  ) {
    if (syncApi) {
      this.syncApi = syncApi;
    } else {
      try {
        this.syncApi = inject(SyncApi);
      } catch {
        this.syncApi = null as any;
      }
    }

    if (operacionesRepo) {
      this.operacionesRepo = operacionesRepo;
    } else {
      try {
        this.operacionesRepo = inject(OperacionesLocalesRepository);
      } catch {
        this.operacionesRepo = null as any;
      }
    }

    if (session) {
      this.session = session;
    } else {
      try {
        this.session = inject(SessionService);
      } catch {
        this.session = null as any;
      }
    }

    if (connectivity) {
      this.connectivity = connectivity;
    } else {
      try {
        this.connectivity = inject(ConnectivityService);
      } catch {
        this.connectivity = new ConnectivityService();
      }
    }

    if (notices !== undefined) {
      this.notices = notices;
    } else {
      try {
        this.notices = inject(NoticesService, { optional: true });
      } catch {
        this.notices = null;
      }
    }

    try {
      this.destroyRef = inject(DestroyRef, { optional: true });
      this.destroyRef?.onDestroy(() => this.destruir());
    } catch {
      this.destroyRef = null;
    }

    try {
      effect(() => {
        const offline = this.session?.offlineSession?.();
        const user = this.session?.user?.();
        if (!offline && user?.tenant && this.pendientesCount() > 0 && this.connectivity?.online?.()) {
          untracked(() => {
            void this.sincronizarAhora();
          });
        }
      });
    } catch {
      // Fuera de contexto de inyección reactiva
    }
  }

  readonly sincronizando = signal<boolean>(false);
  readonly cambios = new Subject<void>();
  readonly pendientesCount = signal<number>(0);
  readonly conflictosCount = signal<number>(0);
  readonly ultimoSync = signal<Date | null>(null);
  readonly ultimoError = signal<string | null>(null);
  readonly proximoIntentoEn = signal<Date | null>(null);

  readonly estado = computed<EstadoIndicador>(() => {
    const isSesionVencida =
      Boolean(this.session?.offlineSession?.()) &&
      this.pendientesCount() > 0 &&
      Boolean(this.connectivity?.online?.());
    return estadoIndicador({
      sincronizando: this.sincronizando(),
      sesionVencida: isSesionVencida,
      online: this.connectivity?.online?.() ?? true,
      servidorAlcanzable: this.connectivity?.servidorAlcanzable?.() ?? true,
      conflictosCount: this.conflictosCount(),
      pendientesCount: this.pendientesCount(),
    });
  });

  private timerId: any = null;
  private onlineListener: (() => void) | null = null;
  private visibilityListener: (() => void) | null = null;

  iniciar(intervaloMs = 60000) {
    this.destruir();
    void this.actualizarContadores().then(() => {
      if (
        this.connectivity?.online?.() &&
        !this.session?.offlineSession?.() &&
        this.pendientesCount() > 0
      ) {
        void this.sincronizarAhora();
      } else {
        this.programarProximoDisparo();
      }
    });

    if (typeof window !== 'undefined') {
      this.onlineListener = () => {
        if (this.connectivity?.online?.()) {
          void this.sincronizarAhora();
        }
      };
      window.addEventListener('online', this.onlineListener);

      if (typeof document !== 'undefined') {
        this.visibilityListener = () => {
          if (
            document.visibilityState === 'visible' &&
            this.pendientesCount() > 0 &&
            this.connectivity?.online?.()
          ) {
            void this.sincronizarAhora();
          }
        };
        document.addEventListener('visibilitychange', this.visibilityListener);
      }
    }
  }

  destruir() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (typeof window !== 'undefined' && this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
      this.onlineListener = null;
    }
    if (typeof document !== 'undefined' && this.visibilityListener) {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
  }

  programarProximoDisparo(proximo?: Date | null) {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.pendientesCount() === 0) return;
    const delay = proximoDisparo(proximo ?? this.proximoIntentoEn(), 60000);
    this.timerId = setTimeout(() => {
      if (
        this.connectivity?.online?.() &&
        !this.sincronizando() &&
        !this.session?.offlineSession?.()
      ) {
        void this.sincronizarAhora();
      } else {
        this.programarProximoDisparo();
      }
    }, delay);
  }

  async notificarOperacionGuardada(): Promise<void> {
    await this.actualizarContadores();
    if (this.connectivity?.online?.() && !this.session?.offlineSession?.()) {
      await this.sincronizarAhora();
    } else {
      this.programarProximoDisparo();
    }
  }

  async actualizarContadores(): Promise<void> {
    try {
      const user = this.session?.user?.();
      if (!user?.tenant) {
        this.pendientesCount.set(0);
        this.conflictosCount.set(0);
        return;
      }
      const ops = await this.operacionesRepo.listarOperaciones({
        tenantId: user.tenant.id,
        usuarioId: user.id,
      });
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
      if (this.connectivity?.online?.()) {
        const servidorAlcanzable = await this.connectivity.comprobarServidor();
        if (!servidorAlcanzable) {
          this.ultimoError.set('El servidor no responde · reintentando');
          this.programarProximoDisparo(new Date(Date.now() + 10000));
          return stats;
        }
      }

      if (this.session?.offlineSession?.()) await this.session?.restore?.();
      const user = this.session?.user?.();
      if (
        !user?.tenant ||
        this.session?.offlineSession?.() ||
        this.session?.isSupport?.() ||
        !this.session?.can?.('sync.write')
      ) {
        this.ultimoError.set(
          'Ingresá con conexión a tu empresa para sincronizar las operaciones guardadas.',
        );
        return stats;
      }
      const scope = { tenantId: user.tenant.id, usuarioId: user.id };
      const previous = await this.operacionesRepo.listarOperaciones(scope);
      const unsettled = previous
        .filter(
          (op) => ['CONFLICTO', 'ENVIADA'].includes(op.estado) || op.refund_status === 'pending',
        )
        .slice(0, 200);
      if (unsettled.length) {
        const status = await this.syncApi.getStatus(unsettled.map((op) => op.id));
        await this.operacionesRepo.aplicarResultados(
          status.operations.filter((result) => result.status !== 'UNKNOWN'),
          ahora,
        );
      }
      const pendientes = await this.operacionesRepo.tomarParaEnvio(
        ahora,
        50,
        user.tenant.id,
        user.id,
      );
      if (pendientes.length === 0) {
        await this.actualizarContadores();
        this.proximoIntentoEn.set(null);
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
            const received = new Set(resp.results.map((result) => result.client_request_id));
            const missing = lote
              .filter((op) => !received.has(op.id))
              .map((op) => ({
                client_request_id: op.id,
                status: 'RETRY' as const,
                message: 'El servidor no confirmó esta operación.',
              }));
            if (missing.length) await this.operacionesRepo.aplicarResultados(missing, new Date());
            stats.confirmadas += resp.confirmed || 0;
            stats.conflictos += resp.conflicts || 0;
            stats.rechazadas += resp.rejected || 0;

            const hasRetry = resp.results.some((r) => r.status === 'RETRY');
            if (hasRetry) {
              this.proximoIntentoEn.set(new Date(Date.now() + 5000));
            } else {
              this.proximoIntentoEn.set(null);
            }

            if ((resp.confirmed ?? 0) > 0) {
              this.notices?.show({
                key: `sync:confirmed:${Date.now()}`,
                title: '¡Operación sin conexión procesada!',
                detail: `Se sincronizaron y confirmaron exitosamente ${resp.confirmed} venta(s) guardada(s) localmente en el servidor.`,
                tone: 'success',
                important: true,
              });
            }
            if ((resp.conflicts ?? 0) > 0 || (resp.rejected ?? 0) > 0) {
              this.notices?.show({
                key: `sync:conflict:${Date.now()}`,
                title: 'Aviso: Prenda no disponible en inventario',
                detail: `Una o más prendas de tu compra sin conexión no contaban con existencias disponibles en el servidor (${(resp.conflicts ?? 0) + (resp.rejected ?? 0)} caso(s)).`,
                tone: 'warning',
                important: true,
              });
            }
          }

          await this.operacionesRepo.guardarHistorialSync({
            tenant_id: user.tenant.id,
            usuario_id: user.id,
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
          this.proximoIntentoEn.set(new Date(Date.now() + 10000));
          await this.operacionesRepo.aplicarResultados(
            lote.map((op) => ({
              client_request_id: op.id,
              status: 'RETRY' as const,
              message: 'El envío no se completó. Se conserva la operación para reintentar.',
            })),
            new Date(),
          );

          await this.operacionesRepo.guardarHistorialSync({
            tenant_id: user.tenant.id,
            usuario_id: user.id,
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
    } catch {
      this.ultimoError.set(
        'No se pudo contactar al servidor. Las operaciones siguen guardadas en este dispositivo.',
      );
    } finally {
      this.sincronizando.set(false);
      await this.actualizarContadores();
      this.programarProximoDisparo();
      this.cambios.next();
    }

    return stats;
  }
}
