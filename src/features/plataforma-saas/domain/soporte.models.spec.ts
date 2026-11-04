import { describe, expect, it } from 'vitest';
import { formatRemaining, isValidReason, remainingMs, SupportSession } from './soporte.models';
import { maskEmail, QuotaItem, quotaTone } from './consola.models';

describe('soporte.models', () => {
  it('valida motivos de 10 a 300 caracteres tras trim', () => {
    expect(isValidReason('   corto ')).toBe(false);
    expect(isValidReason('Revisar existencias')).toBe(true);
    expect(isValidReason('')).toBe(false);
    expect(isValidReason('a'.repeat(9))).toBe(false);
    expect(isValidReason('a'.repeat(10))).toBe(true);
    expect(isValidReason('a'.repeat(300))).toBe(true);
    expect(isValidReason('a'.repeat(301))).toBe(false);
  });

  it('formatea el tiempo restante con minutos:segundos u horas:minutos:segundos', () => {
    expect(formatRemaining(2832000)).toBe('47:12');
    expect(formatRemaining(3900000)).toBe('1:05:00');
    expect(formatRemaining(0)).toBe('00:00');
    expect(formatRemaining(59000)).toBe('00:59');
  });

  it('calcula los milisegundos restantes y devuelve 0 si ya expiró', () => {
    const now = 1000000;
    const futureSession: SupportSession = {
      id: 's-1',
      tenant_id: 't-1',
      tenant_name: 'Moda Uno',
      platform_user_id: 'u-1',
      platform_user_name: 'Admin',
      reason: 'Revisión técnica',
      duration_minutes: 60,
      started_at: new Date(now - 10000).toISOString(),
      expires_at: new Date(now + 50000).toISOString(),
      ended_at: null,
      end_reason: null,
      actions_count: 0,
      is_active: true,
    };
    expect(remainingMs(futureSession, now)).toBe(50000);

    const pastSession: SupportSession = {
      ...futureSession,
      expires_at: new Date(now - 5000).toISOString(),
    };
    expect(remainingMs(pastSession, now)).toBe(0);
  });
});

describe('consola.models', () => {
  it('enmascara correos de usuarios globales', () => {
    expect(maskEmail('mariana@urbano.bo')).toBe('ma***@urbano.bo');
    expect(maskEmail('c@test.com')).toBe('c***@test.com');
    expect(maskEmail('')).toBe('');
  });

  it('determina el tono del medidor según la cuota consumida', () => {
    const normal: QuotaItem = { code: 'branches', label: 'Sucursales', used: 5, limit: 10 };
    expect(quotaTone(normal)).toBe('');

    const near: QuotaItem = { code: 'branches', label: 'Sucursales', used: 8, limit: 10 };
    expect(quotaTone(near)).toBe('near');

    const full: QuotaItem = { code: 'branches', label: 'Sucursales', used: 10, limit: 10 };
    expect(quotaTone(full)).toBe('full');

    const exceeded: QuotaItem = { code: 'branches', label: 'Sucursales', used: 12, limit: 10 };
    expect(quotaTone(exceeded)).toBe('full');

    const unlimited: QuotaItem = { code: 'branches', label: 'Sucursales', used: 50, limit: null };
    expect(quotaTone(unlimited)).toBe('');
  });
});
