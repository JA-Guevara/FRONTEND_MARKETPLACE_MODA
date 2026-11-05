import { describe, expect, it } from 'vitest';
import {
  calculateImpactSeverity,
  formatLifecycle,
  isModuleAvailableForPlans,
  TemplateImpact,
  etiquetaOrigen,
  vigencia,
} from './gobierno.models';

describe('Gobierno Models & Helpers', () => {
  it('etiqueta pruebas, bloqueo y ausencia de módulo sin confundir su origen', () => {
    expect(etiquetaOrigen({ origin: 'TRIAL', is_blocked: false })).toBe('Prueba');
    expect(etiquetaOrigen({ origin: 'PLAN', is_blocked: true })).toBe('Bloqueado');
    expect(etiquetaOrigen({ origin: 'NONE', is_blocked: false })).toBe('No incluido');
  });
  it('muestra vencimiento a seis días y distingue el instante ya vencido', () => {
    expect(vigencia({ expires_at: '2026-11-10T12:00:00Z' }, new Date('2026-11-04T12:00:00Z'))).toBe(
      'Vence 10/11 · 6 días',
    );
    expect(vigencia({ expires_at: '2026-11-04T12:00:00Z' }, new Date('2026-11-04T12:00:00Z'))).toBe(
      'Vencida',
    );
    expect(vigencia({ expires_at: null })).toBe('Sin vencimiento');
  });
  it('formatea correctamente las fases del ciclo de vida', () => {
    expect(formatLifecycle('BORRADOR')).toBe('Borrador');
    expect(formatLifecycle('BETA')).toBe('Fase Beta');
    expect(formatLifecycle('GA')).toBe('Disponible (GA)');
    expect(formatLifecycle('RETIRADO')).toBe('Retirado');
  });

  it('determina disponibilidad de módulo para planes', () => {
    expect(isModuleAvailableForPlans('GA')).toBe(true);
    expect(isModuleAvailableForPlans('BETA')).toBe(false);
    expect(isModuleAvailableForPlans('BORRADOR')).toBe(false);
    expect(isModuleAvailableForPlans('RETIRADO')).toBe(false);
  });

  it('calcula la severidad del impacto de plantillas', () => {
    const bajo: TemplateImpact = {
      role_id: '1',
      affected_tenants: 0,
      affected_users: 2,
      permissions_added: [],
      permissions_removed: ['catalog.write'],
    };
    expect(calculateImpactSeverity(bajo)).toBe('BAJO');

    const medio: TemplateImpact = {
      role_id: '1',
      affected_tenants: 3,
      affected_users: 8,
      permissions_added: [],
      permissions_removed: ['catalog.write'],
    };
    expect(calculateImpactSeverity(medio)).toBe('MEDIO');

    const alto: TemplateImpact = {
      role_id: '1',
      affected_tenants: 15,
      affected_users: 100,
      permissions_added: [],
      permissions_removed: ['catalog.write'],
    };
    expect(calculateImpactSeverity(alto)).toBe('ALTO');
  });
});
