import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from './session.service';
import { SupportSessionStart } from '../../plataforma-saas/domain/soporte.models';
import { User } from '../../../shared/models';
import { clearOfflineProfile, readOfflineProfile } from '../../../app/core/offline/offline-session';
import { authInterceptor } from '../../../app/core/auth.interceptor';
import { HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

describe('SessionService - Soporte RFC 8693', () => {
  let service: SessionService;
  const mockSupport: SupportSessionStart = {
    session: {
      id: 'session-123',
      tenant_id: 'tenant-abc',
      tenant_name: 'Moda Test',
      platform_user_id: 'user-platform',
      platform_user_name: 'Super Admin',
      reason: 'Revisión técnica urgente',
      duration_minutes: 60,
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      ended_at: null,
      end_reason: null,
      actions_count: 0,
      is_active: true,
    },
    access_token: 'token-support-xyz',
    expires_in: 3600,
    tenant: {
      id: 'tenant-abc',
      slug: 'moda-test',
      trade_name: 'Moda Test',
      status: 'ACTIVA',
    },
    subscription: {
      plan_code: 'PROFESIONAL',
      plan_name: 'Profesional',
      status: 'ACTIVA',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      days_left: 300,
      features: { ai_reports: true },
      limits: { max_active_branches: 10 },
    },
    permissions: ['catalog.read', 'catalog.write', 'orders.read'],
  };

  const platformUser: User = {
    id: 'user-platform',
    email: 'admin@platform.bo',
    first_name: 'Admin',
    last_name: 'Plataforma',
    phone: null,
    is_active: true,
    is_verified: true,
    roles: [
      {
        id: 'r-plat',
        code: 'platform_admin',
        name: 'Plataforma',
        permissions: [{ id: 'p-1', code: 'tenants.read', name: 'tenants.read' }],
      },
    ],
    tenant: null,
    subscription: null,
  };

  beforeEach(async () => {
    sessionStorage.clear();
    await clearOfflineProfile();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionService);
  });

  it('inicia soporte actualizando tenant(), scope() y accessToken', () => {
    service.user.set(platformUser);
    expect(service.isPlatformAdmin()).toBe(true);
    expect(service.scope()).toBe('platform');

    service.startSupport(mockSupport);

    expect(service.isSupport()).toBe(true);
    expect(service.tenant()?.id).toBe('tenant-abc');
    expect(service.scope()).toBe('tenant');
    expect(service.accessToken).toBe('token-support-xyz');
    expect(service.permissions().has('catalog.write')).toBe(true);
    expect(service.permissions().has('tenants.read')).toBe(false);
    expect(sessionStorage.getItem('fashionstore.support')).toContain('token-support-xyz');
  });

  it('finaliza soporte restaurando el scope a platform y limpiando sessionStorage', () => {
    service.user.set(platformUser);
    service.startSupport(mockSupport);

    service.endSupport();

    expect(service.isSupport()).toBe(false);
    expect(service.scope()).toBe('platform');
    expect(service.tenant()).toBeNull();
    expect(sessionStorage.getItem('fashionstore.support')).toBeNull();
  });

  it('no invoca saveOfflineProfile mientras esté activo el modo soporte', async () => {
    await clearOfflineProfile();
    service.user.set(platformUser);
    service.startSupport(mockSupport);

    // Intentar aceptar sesión o actualizar usuario durante soporte
    (service as any).accept({
      access_token: 'tok',
      refresh_token: 'ref',
      expires_in: 3600,
      user: { ...platformUser, tenant: mockSupport.tenant },
    });

    const offlineUser = await readOfflineProfile();
    expect(offlineUser).toBeNull();
  });

  it('interceptor: 401 support_session_expired termina soporte y navega a /admin/plataforma sin llamar refresh', async () => {
    service.user.set(platformUser);
    service.startSupport(mockSupport);

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const refreshSpy = vi.spyOn(service, 'refresh');
    const endSupportSpy = vi.spyOn(service, 'endSupport');

    const req = new HttpRequest('GET', `${environment.apiUrl}/catalog/admin/categories`);
    const next: HttpHandlerFn = () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { error: { code: 'support_session_expired' } },
          }),
      );

    await new Promise<void>((resolve) => {
      TestBed.runInInjectionContext(() => {
        authInterceptor(req, next).subscribe({
          error: () => resolve(),
        });
      });
    });

    expect(endSupportSpy).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(['/admin/plataforma']);
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
