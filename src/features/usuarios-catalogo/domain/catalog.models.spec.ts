import { describe, expect, it } from 'vitest';
import { hasVestidor } from './catalog.models';

/**
 * El probador dibuja la prenda sobre el cuerpo a partir de su tipo y color, así
 * que no depende de que alguien haya cargado una imagen a mano: alcanza con que
 * la prenda esté publicada con variantes.
 */
describe('hasVestidor (criterio compartido de disponibilidad del probador)', () => {
  it('habilita cualquier prenda con variantes publicadas, sin recurso cargado', () => {
    expect(hasVestidor({ variants: [{ id: 'v1', is_active: true }] })).toBe(true);
    // Incluso sin ar_assets, que era lo que antes lo bloqueaba.
    expect(hasVestidor({ variants: [{ id: 'v1' }], ar_assets: [] })).toBe(true);
  });

  it('no lo ofrece cuando la prenda no tiene variantes que probarse', () => {
    expect(hasVestidor({ variants: [] })).toBe(false);
    expect(hasVestidor({})).toBe(false);
    expect(hasVestidor({ variants: [{ id: 'v1', is_active: false }] })).toBe(false);
  });
});
