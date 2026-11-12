import { describe, expect, it } from 'vitest';
import {
  aplicarResultado,
  backoffMs,
  clasificarError,
  debeActualizarCatalogo,
  enLotes,
  estadoIndicador,
  estadoReserva,
  estadoVenta,
  etiquetaEstado,
  etiquetaTipo,
  formatearFechaCorta,
  listaParaEnviar,
  ordenarParaEnvio,
  proximoDisparo,
  SyncResult,
  textoIndicador,
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

    const enviada = { ...op, estado: 'ENVIADA' as const, actualizada_en: ahora.toISOString() };
    expect(listaParaEnviar(enviada, ahora)).toBe(false);
    expect(listaParaEnviar({ ...enviada, actualizada_en: op.actualizada_en }, ahora)).toBe(true);
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

  describe('funciones puras MJ-02', () => {
    it('estadoIndicador respeta la prioridad de estados', () => {
      // Prioridad: SINCRONIZANDO > SESION_VENCIDA > SIN_CONEXION > SERVIDOR_NO_RESPONDE > CONFLICTO > PENDIENTES > AL_DIA
      expect(
        estadoIndicador({
          sincronizando: true,
          sesionVencida: true,
          online: false,
          conflictosCount: 1,
        }),
      ).toBe('SINCRONIZANDO');

      expect(
        estadoIndicador({
          sincronizando: false,
          sesionVencida: true,
          online: false,
          pendientesCount: 3,
        }),
      ).toBe('SESION_VENCIDA');

      expect(
        estadoIndicador({
          sincronizando: false,
          sesionVencida: false,
          online: false,
          servidorAlcanzable: false,
          pendientesCount: 2,
        }),
      ).toBe('SIN_CONEXION');

      expect(
        estadoIndicador({
          sincronizando: false,
          online: true,
          servidorAlcanzable: false,
          conflictosCount: 1,
        }),
      ).toBe('SERVIDOR_NO_RESPONDE');

      expect(
        estadoIndicador({
          sincronizando: false,
          online: true,
          servidorAlcanzable: true,
          conflictosCount: 2,
          pendientesCount: 5,
        }),
      ).toBe('CONFLICTO');

      expect(
        estadoIndicador({
          sincronizando: false,
          online: true,
          servidorAlcanzable: true,
          conflictosCount: 0,
          pendientesCount: 3,
        }),
      ).toBe('PENDIENTES');

      expect(
        estadoIndicador({
          sincronizando: false,
          online: true,
          servidorAlcanzable: true,
          conflictosCount: 0,
          pendientesCount: 0,
        }),
      ).toBe('AL_DIA');
    });

    it('textoIndicador genera los textos exactos del enmaquetado', () => {
      expect(textoIndicador('AL_DIA', { minutosDesdeDescarga: 2 })).toBe(
        'Todo sincronizado · datos de hace 2 min',
      );
      expect(textoIndicador('AL_DIA', {})).toBe('Todo sincronizado');

      expect(textoIndicador('SINCRONIZANDO', { pendientesCount: 1 })).toBe(
        'Sincronizando 1 operación…',
      );
      expect(textoIndicador('SINCRONIZANDO', { pendientesCount: 3 })).toBe(
        'Sincronizando 3 operaciones…',
      );

      expect(
        textoIndicador('PENDIENTES', { pendientesCount: 3, reintentoEnSegundos: 20 }),
      ).toBe('3 por subir · reintento en 20 s');
      expect(textoIndicador('PENDIENTES', { pendientesCount: 1 })).toBe('1 por subir');

      expect(textoIndicador('SIN_CONEXION', { pendientesCount: 3 })).toBe(
        'Sin conexión · 3 por subir · se enviarán solas',
      );
      expect(
        textoIndicador('SIN_CONEXION', {
          pendientesCount: 0,
          fechaDatos: new Date('2026-11-11T10:40:00'),
        }),
      ).toMatch(/Sin conexión · datos del 11\/11 10:40/);

      expect(textoIndicador('SESION_VENCIDA', { pendientesCount: 3 })).toBe(
        '3 ventas por subir · Iniciá sesión para enviarlas',
      );

      expect(textoIndicador('CONFLICTO', { conflictosCount: 1 })).toBe(
        '1 operación necesita revisión',
      );
      expect(textoIndicador('CONFLICTO', { conflictosCount: 2 })).toBe(
        '2 operaciones necesitan revisión',
      );

      expect(textoIndicador('SERVIDOR_NO_RESPONDE')).toBe(
        'El servidor no responde · reintentando',
      );

      // Desactualizado (> 24 h)
      expect(
        textoIndicador('AL_DIA', {
          minutosDesdeDescarga: 1500,
          fechaDatos: new Date('2026-11-10T09:12:00'),
        }),
      ).toMatch(/datos del 10\/11 09:12, pueden estar desactualizados/);
    });

    it('etiquetaEstado y etiquetaTipo devuelven las descripciones de negocio', () => {
      expect(etiquetaEstado('PENDIENTE')).toBe('Por subir');
      expect(etiquetaEstado('ENVIADA')).toBe('Enviando');
      expect(etiquetaEstado('CONFIRMADA')).toBe('Confirmada');
      expect(etiquetaEstado('CONFLICTO')).toBe('Necesita revisión');
      expect(etiquetaEstado('RECHAZADA')).toBe('Rechazada');
      expect(etiquetaEstado('ANULADA')).toBe('Anulada');

      expect(etiquetaTipo('VENTA')).toBe('Venta de contado');
      expect(etiquetaTipo('RESERVA')).toBe('Reserva');
    });

    it('debeActualizarCatalogo evalúa red, sesión, módulo, tiempo y eventos', () => {
      const base = {
        online: true,
        sesionReal: true,
        tieneModuloOffline: true,
        versionLocal: '2026-11-11T14:00:00Z',
        ultimaDescarga: new Date('2026-11-11T14:00:00Z'),
        ahora: new Date('2026-11-11T14:02:00Z'), // 2 min
      };

      // Sin red o sin sesión real o sin módulo -> no actualiza
      expect(debeActualizarCatalogo({ ...base, online: false })).toBe(false);
      expect(debeActualizarCatalogo({ ...base, sesionReal: false })).toBe(false);
      expect(debeActualizarCatalogo({ ...base, tieneModuloOffline: false })).toBe(false);

      // Sin versión local -> primera descarga
      expect(debeActualizarCatalogo({ ...base, versionLocal: null })).toBe(true);

      // Con 2 min y sin evento -> no descarga
      expect(debeActualizarCatalogo(base)).toBe(false);

      // Con 6 min y sin evento -> descarga
      expect(
        debeActualizarCatalogo({
          ...base,
          ahora: new Date('2026-11-11T14:06:00Z'),
        }),
      ).toBe(true);

      // Con 2 min y evento sync_confirmed -> descarga
      expect(debeActualizarCatalogo({ ...base, evento: 'sync_confirmed' })).toBe(true);

      // Con 2 min y evento login / reconnect -> descarga
      expect(debeActualizarCatalogo({ ...base, evento: 'login' })).toBe(true);
      expect(debeActualizarCatalogo({ ...base, evento: 'reconnect' })).toBe(true);

      // Con evento visible: >= 1 min descarga, < 1 min no
      expect(debeActualizarCatalogo({ ...base, evento: 'visible' })).toBe(true); // 2 min >= 1 min
      expect(
        debeActualizarCatalogo({
          ...base,
          ahora: new Date('2026-11-11T14:00:30Z'), // 30 s < 1 min
          evento: 'visible',
        }),
      ).toBe(false);
    });

    it('proximoDisparo calcula el tiempo de espera correctamente', () => {
      const ahora = new Date('2026-11-11T14:00:00Z');
      expect(proximoDisparo(null, 60000, ahora)).toBe(60000);
      expect(proximoDisparo('2026-11-11T14:00:20Z', 60000, ahora)).toBe(20000);
      expect(proximoDisparo('2026-11-11T13:59:50Z', 60000, ahora)).toBe(0);
    });
  });
});
