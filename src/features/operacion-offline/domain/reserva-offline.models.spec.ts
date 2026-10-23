import {
  puedeAgregar,
  validarVisita,
  construirPayload,
  puedeCancelarLocal,
  ReservaLocal,
} from './reserva-offline.models';
describe('Reserva offline', () => {
  it('rechaza existencia insuficiente', () =>
    expect(puedeAgregar([], 'v', 1, 0)).toBe('Sin existencia local suficiente'));
  it('máximo 20variantes', () =>
    expect(
      puedeAgregar(
        Array.from({ length: 20 }, (_, i) => ({ variante_id: String(i), cantidad: 1 })),
        'nueva',
        1,
        4,
      ),
    ).toContain('20 variantes'));
  it('máximo 10unidades acumuladas', () =>
    expect(puedeAgregar([{ variante_id: 'v', cantidad: 9 }], 'v', 2, 20)).toContain('10 unidades'));
  it('payload UTC usa UUID de la reserva como idempotencia', () => {
    const r = {
      id: 'uuid',
      sucursal_id: 'b',
      agendada_para: '2026-10-24T10:00:00-04:00',
      notas: '',
      creada_en: '2026-10-23T12:00:00Z',
      cliente_id: null,
    } as ReservaLocal;
    const p = construirPayload(
      r,
      [{ reserva_id: 'uuid', variante_id: 'v', cantidad: 2 }],
      'web-device',
    );
    expect(p.origin).toBe('OFFLINE');
    expect(p.client_key).toBe('uuid');
    expect(p.scheduled_at).toBe('2026-10-24T14:00:00.000Z');
    expect(p.customer_id).toBeUndefined();
  });
  it('no agenda en pasado', () => expect(validarVisita(new Date(0), new Date())).toBeTruthy());
  it('solo anula operaciones pendientes', () => {
    expect(puedeCancelarLocal({ estado: 'CONFIRMADA' })).toBe(false);
    expect(puedeCancelarLocal({ estado: 'PENDIENTE' })).toBe(true);
  });
});
