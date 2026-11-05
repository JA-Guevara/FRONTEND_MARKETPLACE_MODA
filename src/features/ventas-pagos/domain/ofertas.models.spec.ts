import { describe, it, expect } from 'vitest';
import { Oferta, estadoOferta, esVigente, aplicaACanal, calcularPrecio } from './ofertas.models';

describe('ofertas.models domain logic', () => {
  const baseOferta: Oferta = {
    id: 'off-1',
    name: 'Liquidación Verano',
    code: null,
    description: 'Promoción de fin de temporada',
    discount_type: 'percent',
    discount_value: 20,
    minimum_order: 0,
    customer_scope: 'all',
    applies_online: true,
    applies_pos: true,
    applies_offline: false,
    starts_at: '2026-11-01T00:00:00Z',
    ends_at: '2026-11-30T23:59:59Z',
    max_uses: 100,
    uses_count: 5,
    per_user_limit: 1,
    is_active: true,
  };

  it('calcula estado de oferta vigente correctamente', () => {
    const ahora = new Date('2026-11-15T12:00:00Z');
    expect(estadoOferta(baseOferta, ahora)).toBe('vigente');
    expect(esVigente(baseOferta, ahora)).toBe(true);
  });

  it('detecta oferta pausada', () => {
    const pausada = { ...baseOferta, is_active: false };
    expect(estadoOferta(pausada)).toBe('pausada');
    expect(esVigente(pausada)).toBe(false);
  });

  it('detecta oferta agotada por usos', () => {
    const agotada = { ...baseOferta, uses_count: 100, max_uses: 100 };
    expect(estadoOferta(agotada)).toBe('agotada');
  });

  it('detecta oferta programada para el futuro', () => {
    const ahora = new Date('2026-10-31T23:59:59Z');
    expect(estadoOferta(baseOferta, ahora)).toBe('programada');
  });

  it('detecta oferta vencida', () => {
    const ahora = new Date('2026-12-01T00:00:00Z');
    expect(estadoOferta(baseOferta, ahora)).toBe('vencida');
    expect(esVigente(baseOferta, ahora)).toBe(false);
  });

  it('verifica soporte por canal', () => {
    expect(aplicaACanal(baseOferta, 'online')).toBe(true);
    expect(aplicaACanal(baseOferta, 'pos')).toBe(true);
    expect(aplicaACanal(baseOferta, 'offline')).toBe(false);
  });

  it('calcula precios con descuento porcentual', () => {
    expect(calcularPrecio(150, { ...baseOferta, discount_type: 'percent', discount_value: 20 })).toBe(120);
    expect(calcularPrecio(100, { ...baseOferta, discount_type: 'percent', discount_value: 33.33 })).toBe(66.67);
  });

  it('calcula precios con monto fijo', () => {
    expect(calcularPrecio(150, { ...baseOferta, discount_type: 'fixed', discount_value: 30 })).toBe(120);
    expect(calcularPrecio(25, { ...baseOferta, discount_type: 'fixed', discount_value: 30 })).toBe(0);
  });

  it('calcula precios con liquidación (clearance)', () => {
    expect(calcularPrecio(200, { ...baseOferta, discount_type: 'clearance', discount_value: 75 })).toBe(75);
  });
});
