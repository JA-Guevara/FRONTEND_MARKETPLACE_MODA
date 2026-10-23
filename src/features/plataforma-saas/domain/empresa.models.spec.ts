import { slugify, isValidSlug, isValidTaxId, tenantTone, Tenant } from './empresa.models';
describe('Reglas de empresas', () => {
  it('normaliza el identificador sin tildes', () =>
    expect(slugify('Moda Cruceña S.R.L.')).toBe('moda-crucena-s-r-l'));
  it('valida longitud y extremos de slug', () => {
    expect(isValidSlug('ab')).toBe(false);
    expect(isValidSlug('moda-crucena')).toBe(true);
    expect(isValidSlug('-moda')).toBe(false);
    expect(isValidSlug('moda-')).toBe(false);
  });
  it('NIT solo numérico de 5 a20', () => {
    expect(isValidTaxId('10203')).toBe(true);
    expect(isValidTaxId('10A2')).toBe(false);
    expect(isValidTaxId('1'.repeat(21))).toBe(false);
  });
  it('inactiva usa tono neutral', () =>
    expect(tenantTone({ status: 'INACTIVA' } as Tenant)).toBe('neutral'));
});
