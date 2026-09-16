import { describe, expect, it } from 'vitest';
import { hasVestidor } from './catalog.models';

describe('hasVestidor (criterio compartido de disponibilidad del probador)', () => {
  it('solo habilita la prenda con un recurso activo de tipo image_overlay', () => {
    expect(
      hasVestidor({
        ar_assets: [{ id: 'a1', is_active: true, asset_type: 'image_overlay', asset_url: '/p.webp' }],
      }),
    ).toBe(true);
  });
  it('ignora recursos inactivos, de tipo 3D o sin assets', () => {
    expect(
      hasVestidor({ ar_assets: [{ id: 'a1', is_active: false, asset_type: 'image_overlay' }] }),
    ).toBe(false);
    expect(hasVestidor({ ar_assets: [{ id: 'a1', is_active: true, asset_type: 'glb' }] })).toBe(
      false,
    );
    expect(hasVestidor({ ar_assets: [] })).toBe(false);
    expect(hasVestidor({})).toBe(false);
  });
});