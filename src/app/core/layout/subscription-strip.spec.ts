import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { SubscriptionStripComponent } from './subscription-strip.component';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { PlataformaApi } from '../../../features/plataforma-saas/infrastructure/plataforma.api';
import { SubscriptionDetail } from '../../../features/plataforma-saas/domain/suscripcion.models';
import { of } from 'rxjs';

describe('SubscriptionStripComponent', () => {
  let component: SubscriptionStripComponent;
  let fixture: ComponentFixture<SubscriptionStripComponent>;

  let mockSession: {
    tenant: ReturnType<typeof signal<any>>;
    subscription: ReturnType<typeof signal<any>>;
    readOnly: ReturnType<typeof signal<boolean>>;
  };

  let mockApi: {
    mySubscription: () => any;
  };

  beforeEach(async () => {
    mockSession = {
      tenant: signal({ id: 'tenant-1', name: 'Empresa Demo' }),
      subscription: signal({
        plan_code: 'BASICO',
        plan_name: 'Básico',
        status: 'ACTIVA',
        start_date: '2026-10-01',
        end_date: '2026-10-31',
        days_left: 10,
        lifecycle_state: 'active',
      }),
      readOnly: signal(false),
    };

    mockApi = {
      mySubscription: () => of(null),
    };

    await TestBed.configureTestingModule({
      imports: [SubscriptionStripComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: mockSession },
        { provide: PlataformaApi, useValue: mockApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionStripComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('Activa no muestra banner', () => {
    mockSession.subscription.set({
      plan_code: 'BASICO',
      plan_name: 'Básico',
      status: 'ACTIVA',
      start_date: '2026-10-01',
      end_date: '2026-11-30',
      days_left: 25,
      lifecycle_state: 'active',
    });
    fixture.detectChanges();

    const strip = fixture.nativeElement.querySelector('.grace-strip');
    expect(strip).toBeNull();
    expect(component.visible()).toBe(false);
  });

  it('Gracia muestra banner', () => {
    mockSession.subscription.set({
      plan_code: 'PROFESIONAL',
      plan_name: 'Profesional',
      status: 'VENCIDA',
      start_date: '2026-10-01',
      end_date: '2026-11-04',
      days_left: 2,
      lifecycle_state: 'grace',
    });
    fixture.detectChanges();

    expect(component.visible()).toBe(true);
    expect(component.isGrace()).toBe(true);

    const strip = fixture.nativeElement.querySelector('.grace-strip');
    expect(strip).not.toBeNull();
    expect(strip.textContent).toContain('Período de gracia');
    expect(strip.textContent).toContain('Solicitar renovación');
  });

  it('Solo lectura deshabilita escrituras y muestra banner restrictivo', () => {
    mockSession.subscription.set({
      plan_code: 'PROFESIONAL',
      plan_name: 'Profesional',
      status: 'VENCIDA',
      start_date: '2026-10-01',
      end_date: '2026-10-31',
      days_left: 0,
      lifecycle_state: 'read_only',
    });
    mockSession.readOnly.set(true);
    fixture.detectChanges();

    expect(component.visible()).toBe(true);
    expect(component.isReadOnly()).toBe(true);

    const strip = fixture.nativeElement.querySelector('.grace-strip');
    expect(strip).not.toBeNull();
    expect(strip.textContent).toContain('Modo solo lectura');
    expect(strip.textContent).toContain('ventas y modificaciones están bloqueadas');
  });

  it('Expiring con 3 días o menos muestra advertencia', () => {
    mockSession.subscription.set({
      plan_code: 'BASICO',
      plan_name: 'Básico',
      status: 'ACTIVA',
      start_date: '2026-10-01',
      end_date: '2026-11-08',
      days_left: 3,
      lifecycle_state: 'expiring',
    });
    fixture.detectChanges();

    expect(component.visible()).toBe(true);
    expect(component.isExpiring()).toBe(true);
    expect(component.tone()).toBe('warn');

    const strip = fixture.nativeElement.querySelector('.grace-strip');
    expect(strip).not.toBeNull();
    expect(strip.textContent).toContain('vence en 3 días');
  });
});
