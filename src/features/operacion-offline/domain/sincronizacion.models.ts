import {
  EstadoReservaLocal,
  EstadoVentaLocal,
} from '../../../app/core/offline/offline-db';
import {
  EstadoOperacion,
  OperacionPendiente,
} from './reserva-offline.models';

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
  if (op.estado !== 'PENDIENTE') return false;
  if (!op.proximo_intento_en) return true;
  return new Date(op.proximo_intento_en).getTime() <= ahora.getTime();
}

export function ordenarParaEnvio(ops: OperacionPendiente[]): OperacionPendiente[] {
  return [...ops].sort(
    (a, b) => new Date(a.creada_en).getTime() - new Date(b.creada_en).getTime(),
  );
}

export function aplicarResultado(
  op: OperacionPendiente,
  r: SyncResult,
  ahora: Date,
): OperacionPendiente {
  const updated = { ...op, actualizada_en: ahora.toISOString() };

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

export type CodigoErrorSync =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'AUTH'
  | 'HTTP_4XX'
  | 'HTTP_5XX';

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
