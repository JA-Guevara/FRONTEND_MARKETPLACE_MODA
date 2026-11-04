import { describe, it, expect } from 'vitest';
import {
  PERMISSION_GROUPS,
  toPermissionCodes,
} from './empresa-admin.models';

describe('empresa-admin.models', () => {
  it('toPermissionCodes({Ventas:{read:false,write:true}}) -> ["commerce.read","commerce.write"]', () => {
    const codes = toPermissionCodes({
      Ventas: { read: false, write: true },
    });
    expect(codes).toEqual(['commerce.read', 'commerce.write']);
  });

  it('PERMISSION_GROUPS no contiene permisos de plataforma', () => {
    const platformKeywords = [
      'tenant.',
      'tenants.',
      'plans.',
      'platform_users.',
      'platform_audit.',
      'support.access',
      'cities.',
    ];

    for (const group of PERMISSION_GROUPS) {
      expect(platformKeywords.some((pk) => group.read.startsWith(pk))).toBe(false);
      if (group.write) {
        expect(platformKeywords.some((pk) => group.write?.startsWith(pk))).toBe(false);
      }
    }
  });

  it('toPermissionCodes solo lectura agrega unicamente el codigo de lectura', () => {
    const codes = toPermissionCodes({
      Catálogo: { read: true, write: false },
    });
    expect(codes).toEqual(['catalog.read']);
  });

  it('toPermissionCodes para modulos de solo lectura (Reportes, Bitacora)', () => {
    const codes = toPermissionCodes({
      Reportes: { read: true, write: false },
      Bitácora: { read: true, write: false },
    });
    expect(codes).toEqual(['dashboard.read', 'audit.read']);
  });

  it('toPermissionCodes ignora modulos desmarcados', () => {
    const codes = toPermissionCodes({
      Personal: { read: false, write: false },
    });
    expect(codes).toEqual([]);
  });
});
