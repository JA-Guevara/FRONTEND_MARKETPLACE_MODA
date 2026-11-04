import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { AdminLayoutComponent } from './admin-layout.component';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { ConnectivityService } from '../offline/connectivity.service';
import { SupportSessionStart } from '../../../features/plataforma-saas/domain/soporte.models';
import { User, SubscriptionSummary } from '../../../shared/models';

describe('AdminShell (Layout, Topbar, Sidebar)', () => {
  let fixture: ComponentFixture<AdminLayoutComponent>;
  let mockSession: {
    user: ReturnType<typeof signal<User | null>>;
    support: ReturnType<typeof signal<SupportSessionStart | null>>;
    scope: ReturnType<typeof signal<'platform' | 'tenant'>>;
    isSupport: ReturnType<typeof signal<boolean>>;
    isPlatformAdmin: ReturnType<typeof signal<boolean>>;
    can: (p?: string) => boolean;
    hasFeature: (f: string) => boolean;
    readOnly: ReturnType<typeof signal<boolean>>;
    subscription: ReturnType<typeof signal<any>>;
    tenant: ReturnType<typeof signal<any>>;
    logout: () => any;
  };

  beforeEach(async () => {
    mockSession = {
      user: signal<User | null>(null),
      support: signal<SupportSessionStart | null>(null),
      scope: signal<'platform' | 'tenant'>('platform'),
      isSupport: signal(false),
      isPlatformAdmin: signal(true),
      can: (p?: string) => true,
      hasFeature: (f: string) => false,
      readOnly: signal(false),
      subscription: signal(null),
      tenant: signal(null),
      logout: () => ({ subscribe: (fn: any) => fn() }),
    };

    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: mockSession },
        { provide: ConnectivityService, useValue: { online: signal(true) } },
      ],
    }).compileComponents();
  });

  it('Sesión plataforma → sidebar con «Tablero» y topbar «elegir empresa»', () => {
    mockSession.user.set({
      id: 'u1',
      first_name: 'José',
      last_name: 'Guevara',
      email: 'jose@fashionstore.bo',
      tenant: null,
      phone: null,
      roles: [{ id: 'r1', code: 'platform_admin', name: 'Super administrador', is_active: true, permissions: [] }],
      is_active: true,
      is_verified: true,
    });
    mockSession.isPlatformAdmin.set(true);
    mockSession.isSupport.set(false);
    mockSession.scope.set('platform');

    fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Tablero');
    expect(compiled.textContent).toContain('elegir empresa');
    // La barra de la consola es la única: el layout del sitio no agrega otra (sin «Salir» suelto).
    expect(compiled.querySelectorAll('header').length).toBe(1);
  });

  it('Sesión soporte → fs-support-strip visible con nombre de la empresa y enlace «Volver a la consola»', () => {
    const fakeSupport: SupportSessionStart = {
      session: {
        id: 'ss1',
        tenant_id: 't-urbano',
        tenant_name: 'Urbano Boutique',
        platform_user_id: 'u1',
        platform_user_name: 'José Guevara',
        reason: 'Revisar existencias negativas en sucursal Norte (ticket #482)',
        duration_minutes: 60,
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        ended_at: null,
        end_reason: null,
        actions_count: 0,
        is_active: true,
      },
      access_token: 'fake-token',
      expires_in: 3600,
      tenant: { id: 't-urbano', trade_name: 'Urbano Boutique', slug: 'urbano', status: 'ACTIVA' },
      subscription: {
        plan_code: 'pro',
        plan_name: 'Profesional',
        status: 'ACTIVA',
        start_date: '2026-10-15',
        end_date: '2026-11-14',
        days_left: 10,
        features: {},
        limits: {},
      },
      permissions: ['commerce.read', 'commerce.write', 'stock.read', 'stock.write', 'dashboard.read'],
    };

    mockSession.support.set(fakeSupport);
    mockSession.isSupport.set(true);
    mockSession.isPlatformAdmin.set(true);
    mockSession.scope.set('tenant');
    mockSession.tenant.set(fakeSupport.tenant);
    mockSession.subscription.set(fakeSupport.subscription);

    fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const strip = compiled.querySelector('fs-support-strip');
    expect(strip).not.toBeNull();
    expect(strip?.textContent).toContain('Urbano Boutique');
    expect(compiled.textContent).toContain('Volver a la consola');
  });

  it('Sesión empresa Básico → ítem «Reportes con IA» con PRO', () => {
    mockSession.user.set({
      id: 'u2',
      first_name: 'Lucía',
      last_name: 'Gómez',
      email: 'lucia@modacrucena.bo',
      tenant: { id: 't-moda', trade_name: 'Moda Cruceña', slug: 'moda-crucena', status: 'ACTIVA' },
      phone: null,
      roles: [{ id: 'r2', code: 'tenant_admin', name: 'Administradora de empresa', is_active: true, permissions: [] }],
      is_active: true,
      is_verified: true,
    });
    mockSession.isPlatformAdmin.set(false);
    mockSession.isSupport.set(false);
    mockSession.scope.set('tenant');
    mockSession.subscription.set({
      plan_code: 'basic',
      plan_name: 'Básico',
      status: 'ACTIVA',
      start_date: '2026-10-15',
      end_date: '2026-11-14',
      days_left: 10,
      features: { ai_reports: false },
      limits: {},
    });
    mockSession.hasFeature = (feat: string) => feat !== 'ai_reports';

    fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Reportes con IA');
    const lock = compiled.querySelector('.nav-lock');
    expect(lock).not.toBeNull();
    expect(lock?.textContent).toContain('PRO');
  });
});
