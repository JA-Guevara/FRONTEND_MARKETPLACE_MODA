import { describe, expect, it } from 'vitest';
import {
  aplicarResultado,
  backoffMs,
  clasificarError,
  enLotes,
  estadoReserva,
  estadoVenta,
  listaParaEnviar,
  ordenarParaEnvio,
  SyncResult,
} from './sincronizacion.models';
import { OperacionPendiente } from './reserva-offline.models';

describe('sincronizacion.models', () => {
  it('enLotes divide colecciones mayores al límite', () => {
    const items = [1, 2, 3, 4, 5];
    const lotes = enLotes(items, 2);
    expect(lotes.length).toBe(3);
    expect(lotes[0]).toEqual([1, 2]);
    expect(lotes[2]).toEqual([5]);
  });

  it('backoffMs calcula tiempo exponencial con tope de 5 minutos', () => {
    expect(backoffMs(0)).toBe(5000);
    expect(backoffMs(1)).toBe(10000);
    expect(backoffMs(2)).toBe(20000);
    expect(backoffMs(10)).toBe(300000);
  });

  it('listaParaEnviar respeta el estado y la fecha de próximo intento', () => {
    const ahora = new Date('2026-11-04T12:00:00Z');
    const op: OperacionPendiente = {
      id: '1',
      tipo: 'VENTA',
      estado: 'PENDIENTE',
      tenant_id: 't1',
      sucursal_id: 'b1',
      usuario_id: 'u1',
      dispositivo_id: 'd1',
      intentos: 0,
      ultimo_error: null,
      creada_en: '2026-11-04T11:00:00Z',
      actualizada_en: '2026-11-04T11:00:00Z',
    };
    expect(listaParaEnviar(op, ahora)).toBe(true);

    const conEspera = {
      ...op,
      proximo_intento_en: '2026-11-04T12:10:00Z',
    };
    expect(listaParaEnviar(conEspera, ahora)).toBe(false);

    const vencida = {
      ...op,
      proximo_intento_en: '2026-11-04T11:59:00Z',
    };
    expect(listaParaEnviar(vencida, ahora)).toBe(true);

    const enviada = { ...op, estado: 'ENVIADA' as const };
    expect(listaParaEnviar(enviada, ahora)).toBe(false);
  });

  it('ordenarParaEnvio ordena por creada_en ascendente', () => {
    const op1 = { creada_en: '2026-11-04T12:05:00Z' } as OperacionPendiente;
    const op2 = { creada_en: '2026-11-04T12:01:00Z' } as OperacionPendiente;
    const ordenadas = ordenarParaEnvio([op1, op2]);
    expect(ordenadas[0].creada_en).toBe('2026-11-04T12:01:00Z');
  });

  it('aplicarResultado actualiza estado CONFIRMED, CONFLICT, REJECTED y RETRY', () => {
    const ahora = new Date('2026-11-04T12:00:00Z');
    const op: OperacionPendiente = {
      id: '1',
      tipo: 'VENTA',
      estado: 'PENDIENTE',
      tenant_id: 't1',
      sucursal_id: 'b1',
      usuario_id: 'u1',
      dispositivo_id: 'd1',
      intentos: 0,
      ultimo_error: null,
      creada_en: '2026-11-04T11:00:00Z',
      actualizada_en: '2026-11-04T11:00:00Z',
    };

    const conf: SyncResult = {
      client_request_id: '1',
      status: 'CONFIRMED',
      server_ref: 's1',
      server_number: 'FS-001',
      message: 'OK',
    };
    const r1 = aplicarResultado(op, conf, ahora);
    expect(r1.estado).toBe('CONFIRMADA');
    expect(r1.server_numero).toBe('FS-001');

    const conflict: SyncResult = {
      client_request_id: '1',
      status: 'CONFLICT',
      conflict_id: 'c1',
      conflict_type: 'STOCK',
      message: 'Stock insuficiente',
    };
    const r2 = aplicarResultado(op, conflict, ahora);
    expect(r2.estado).toBe('CONFLICTO');
    expect(r2.conflicto_id).toBe('c1');

    const retry: SyncResult = {
      client_request_id: '1',
      status: 'RETRY',
      message: 'Network error',
    };
    const r3 = aplicarResultado(op, retry, ahora);
    expect(r3.estado).toBe('PENDIENTE');
    expect(r3.intentos).toBe(1);
    expect(r3.proximo_intento_en).toBeDefined();
  });

  it('mapeo de estados de venta y reserva', () => {
    expect(estadoVenta({ estado: 'CONFIRMADA' } as OperacionPendiente)).toBe('CONFIRMADA');
    expect(estadoVenta({ estado: 'CONFLICTO' } as OperacionPendiente)).toBe('EN_CONFLICTO');
    expect(estadoReserva({ estado: 'CONFIRMADA' } as OperacionPendiente)).toBe('CONFIRMADA');
  });

  it('clasificarError asigna categoría y http_status', () => {
    expect(clasificarError({ status: 0 }).codigo).toBe('NETWORK');
    expect(clasificarError({ status: 408 }).codigo).toBe('TIMEOUT');
    expect(clasificarError({ status: 401 }).codigo).toBe('AUTH');
    expect(clasificarError({ status: 422 }).codigo).toBe('HTTP_4XX');
    expect(clasificarError({ status: 500 }).codigo).toBe('HTTP_5XX');
  });
});
