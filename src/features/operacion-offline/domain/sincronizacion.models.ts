import { EstadoReservaLocal, EstadoVentaLocal } from '../../../app/core/offline/offline-db';
import { EstadoOperacion, OperacionPendiente } from './reserva-offline.models';

export interface SyncOperationWire {
  client_request_id: string;
  type: 'SALE' | 'RESERVATION';
  branch_id: string;
  device_id: string;
  client_created_at: string;
  payload: any;
}

export interface SyncResult {
  client_request_id: string;
  status: 'CONFIRMED' | 'CONFLICT' | 'REJECTED' | 'RETRY' | 'UNKNOWN';
  server_ref?: string | null;
  server_number?: string | null;
  conflict_id?: string | null;
  conflict_type?: string | null;
  reason_code?: string | null;
  message: string;
  replay?: boolean;
  refund_amount?: string | null;
  refund_status?: 'pending' | 'confirmed' | null;
}

export function aOperacionReserva(op: OperacionPendiente): SyncOperationWire {
  return {
    client_request_id: op.id,
    type: 'RESERVATION',
    branch_id: op.sucursal_id,
    device_id: op.dispositivo_id,
    client_created_at: op.creada_en,
    payload: op.payload,
  };
}

export function enLotes<T>(xs: T[], max = 50): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < xs.length; i += max) {
    result.push(xs.slice(i, i + max));
  }
  return result;
}

export function backoffMs(intentos: number): number {
  return Math.min(300000, 5000 * Math.pow(2, Math.max(0, intentos)));
}

export function listaParaEnviar(op: OperacionPendiente, ahora: Date): boolean {
  if (op.estado === 'ENVIADA') {
    return ahora.getTime() - Date.parse(op.actualizada_en ?? op.creada_en) > 120000;
  }
  if (op.estado !== 'PENDIENTE') return false;
  if (!op.proximo_intento_en) return true;
  return new Date(op.proximo_intento_en).getTime() <= ahora.getTime();
}

export function ordenarParaEnvio(ops: OperacionPendiente[]): OperacionPendiente[] {
  return [...ops].sort((a, b) => new Date(a.creada_en).getTime() - new Date(b.creada_en).getTime());
}

export function aplicarResultado(
  op: OperacionPendiente,
  r: SyncResult,
  ahora: Date,
): OperacionPendiente {
  const updated = {
    ...op,
    actualizada_en: ahora.toISOString(),
    refund_amount: r.refund_amount ?? op.refund_amount,
    refund_status: r.refund_status ?? op.refund_status,
  };

  if (r.status === 'CONFIRMED') {
    return {
      ...updated,
      estado: 'CONFIRMADA',
      server_ref: r.server_ref ?? null,
      server_numero: r.server_number ?? null,
      ultimo_error: null,
    };
  }

  if (r.status === 'CONFLICT') {
    return {
      ...updated,
      estado: 'CONFLICTO',
      conflicto_id: r.conflict_id ?? null,
      motivo_codigo: r.conflict_type ?? null,
      ultimo_error: r.message,
    };
  }

  if (r.status === 'REJECTED') {
    return {
      ...updated,
      estado: 'RECHAZADA',
      motivo_codigo: r.reason_code ?? null,
      ultimo_error: r.message,
    };
  }

  // RETRY u otro error transitorio
  const intentos = (op.intentos || 0) + 1;
  const prox = new Date(ahora.getTime() + backoffMs(intentos)).toISOString();
  return {
    ...updated,
    estado: 'PENDIENTE',
    intentos,
    proximo_intento_en: prox,
    ultimo_error: r.message,
  };
}

export function estadoVenta(op: OperacionPendiente): EstadoVentaLocal {
  switch (op.estado) {
    case 'CONFIRMADA':
      return 'CONFIRMADA';
    case 'CONFLICTO':
      return 'EN_CONFLICTO';
    case 'RECHAZADA':
      return 'RECHAZADA';
    case 'ANULADA':
      return 'ANULADA';
    default:
      return 'PENDIENTE_SINCRONIZAR';
  }
}

export function estadoReserva(op: OperacionPendiente): EstadoReservaLocal {
  switch (op.estado) {
    case 'CONFIRMADA':
      return 'CONFIRMADA';
    case 'RECHAZADA':
      return 'RECHAZADA';
    case 'ANULADA':
      return 'ANULADA_LOCAL';
    default:
      return 'PENDIENTE_CONFIRMACION';
  }
}

export type CodigoErrorSync = 'NETWORK' | 'TIMEOUT' | 'AUTH' | 'HTTP_4XX' | 'HTTP_5XX';

export function clasificarError(e: any): {
  codigo: CodigoErrorSync;
  http_status: number | null;
} {
  const status = typeof e?.status === 'number' ? e.status : null;
  if (!status || status === 0) {
    return { codigo: 'NETWORK', http_status: status };
  }
  if (status === 408 || e?.name === 'TimeoutError' || String(e?.message).includes('timeout')) {
    return { codigo: 'TIMEOUT', http_status: status };
  }
  if (status === 401 || status === 403) {
    return { codigo: 'AUTH', http_status: status };
  }
  if (status >= 400 && status < 500) {
    return { codigo: 'HTTP_4XX', http_status: status };
  }
  return { codigo: 'HTTP_5XX', http_status: status };
}

export type EstadoIndicador =
  | 'AL_DIA'
  | 'SINCRONIZANDO'
  | 'PENDIENTES'
  | 'SIN_CONEXION'
  | 'SESION_VENCIDA'
  | 'CONFLICTO'
  | 'SERVIDOR_NO_RESPONDE';

export interface EstadoIndicadorInput {
  sincronizando?: boolean;
  sesionVencida?: boolean;
  online?: boolean;
  servidorAlcanzable?: boolean;
  conflictosCount?: number;
  pendientesCount?: number;
}

export function estadoIndicador(input: EstadoIndicadorInput): EstadoIndicador {
  if (input.sincronizando) return 'SINCRONIZANDO';
  if (input.sesionVencida) return 'SESION_VENCIDA';
  if (input.online === false) return 'SIN_CONEXION';
  if (input.servidorAlcanzable === false) return 'SERVIDOR_NO_RESPONDE';
  if ((input.conflictosCount ?? 0) > 0) return 'CONFLICTO';
  if ((input.pendientesCount ?? 0) > 0) return 'PENDIENTES';
  return 'AL_DIA';
}

export interface DatosTextoIndicador {
  pendientesCount?: number;
  conflictosCount?: number;
  minutosDesdeDescarga?: number;
  fechaDatos?: Date | string | null;
  reintentoEnSegundos?: number;
  desactualizado?: boolean;
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function formatearFechaCorta(d: Date | string | null): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function textoIndicador(estado: EstadoIndicador, datos?: DatosTextoIndicador): string {
  const pCount = datos?.pendientesCount ?? 0;
  const cCount = datos?.conflictosCount ?? 0;
  const desactualizado =
    datos?.desactualizado ||
    (datos?.minutosDesdeDescarga !== undefined && datos.minutosDesdeDescarga > 1440);

  if (desactualizado && datos?.fechaDatos) {
    return `datos del ${formatearFechaCorta(datos.fechaDatos)}, pueden estar desactualizados`;
  }

  switch (estado) {
    case 'SINCRONIZANDO': {
      const n = pCount || 1;
      return n === 1 ? 'Sincronizando 1 operación…' : `Sincronizando ${n} operaciones…`;
    }
    case 'SESION_VENCIDA': {
      const n = pCount || 1;
      return `${n} ventas por subir · Iniciá sesión para enviarlas`;
    }
    case 'SIN_CONEXION': {
      if (pCount > 0) {
        return `Sin conexión · ${pCount} por subir · se enviarán solas`;
      }
      if (datos?.fechaDatos) {
        return `Sin conexión · datos del ${formatearFechaCorta(datos.fechaDatos)}`;
      }
      return 'Sin conexión';
    }
    case 'SERVIDOR_NO_RESPONDE':
      return 'El servidor no responde · reintentando';
    case 'CONFLICTO': {
      const n = cCount || 1;
      return n === 1 ? '1 operación necesita revisión' : `${n} operaciones necesitan revisión`;
    }
    case 'PENDIENTES': {
      const n = pCount || 1;
      if (datos?.reintentoEnSegundos !== undefined && datos.reintentoEnSegundos !== null) {
        return `${n} por subir · reintento en ${datos.reintentoEnSegundos} s`;
      }
      return `${n} por subir`;
    }
    case 'AL_DIA':
    default: {
      if (datos?.minutosDesdeDescarga !== undefined && datos.minutosDesdeDescarga !== null) {
        return `Todo sincronizado · datos de hace ${datos.minutosDesdeDescarga} min`;
      }
      return 'Todo sincronizado';
    }
  }
}

export function etiquetaEstado(estado: string): string {
  switch (estado) {
    case 'PENDIENTE':
      return 'Por subir';
    case 'ENVIADA':
      return 'Enviando';
    case 'CONFIRMADA':
      return 'Confirmada';
    case 'CONFLICTO':
      return 'Necesita revisión';
    case 'RECHAZADA':
      return 'Rechazada';
    case 'ANULADA':
      return 'Anulada';
    default:
      return estado;
  }
}

export function etiquetaTipo(tipo: string): string {
  switch (tipo) {
    case 'VENTA':
      return 'Venta de contado';
    case 'RESERVA':
      return 'Reserva';
    default:
      return tipo;
  }
}

export interface ParametrosActualizarCatalogo {
  online: boolean;
  sesionReal: boolean;
  tieneModuloOffline: boolean;
  versionLocal?: string | null;
  ultimaDescarga?: Date | string | null;
  ahora?: Date;
  evento?: 'login' | 'reconnect' | 'visible' | 'sync_confirmed';
}

export function debeActualizarCatalogo(p: ParametrosActualizarCatalogo): boolean {
  if (!p.online || !p.sesionReal || !p.tieneModuloOffline) return false;
  if (!p.versionLocal) return true;

  const ahoraMs = (p.ahora ? new Date(p.ahora) : new Date()).getTime();
  const ultimaMs = p.ultimaDescarga ? new Date(p.ultimaDescarga).getTime() : 0;
  const diffMs = ahoraMs - ultimaMs;

  if (p.evento === 'sync_confirmed') return true;
  if (p.evento === 'login' || p.evento === 'reconnect') return true;
  if (p.evento === 'visible') return diffMs >= 60000;

  return diffMs >= 300000;
}

export function proximoDisparo(
  proximoIntento: Date | string | null,
  intervaloNormalMs = 60000,
  ahora: Date = new Date(),
): number {
  if (!proximoIntento) return intervaloNormalMs;
  const targetMs = new Date(proximoIntento).getTime();
  const diff = targetMs - ahora.getTime();
  if (diff <= 0) return 0;
  return Math.min(intervaloNormalMs, diff);
}
