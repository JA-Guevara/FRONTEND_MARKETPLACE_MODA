import { downgradeCheck, expiryTone } from './suscripcion.models';
describe('Reglas de suscripción', () => {
  it('downgrade informa lo que debe desactivarse', () =>
    expect(downgradeCheck({ active_branches: 6 }, 2)).toEqual({ ok: false, mustDeactivate: 4 }));
  it('permite ampliar', () => expect(downgradeCheck({ active_branches: 2 }, 10).ok).toBe(true));
  it('distingue vencimiento y suspensión', () => {
    expect(expiryTone(6, 'ACTIVA')).toBe('warn');
    expect(expiryTone(30, 'SUSPENDIDA')).toBe('danger');
  });
});
