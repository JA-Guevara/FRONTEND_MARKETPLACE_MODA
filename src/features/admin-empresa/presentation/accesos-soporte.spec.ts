import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccesosSoporteComponent } from './accesos-soporte.component';
import { EmpresaAdminApi } from '../infrastructure/empresa-admin.api';
import { SupportSession } from '../../plataforma-saas/domain/soporte.models';

const mockPendingSession: SupportSession = {
  id: 'sup-pending-1',
  tenant_id: 't-1',
  tenant_name: 'Moda Cruceña',
  platform_user_id: 'u-plat-1',
  platform_user_name: 'Super Admin',
  reason: 'Revisión de stock negativo en sucursal Norte',
  duration_minutes: 60,
  started_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 3600000).toISOString(),
  request_expires_at: new Date(Date.now() + 600000).toISOString(),
  ended_at: null,
  end_reason: null,
  actions_count: 0,
  is_active: false,
  status: 'pending_approval',
  mode: 'WRITE',
};

const mockExpiredSession: SupportSession = {
  ...mockPendingSession,
  id: 'sup-expired-1',
  request_expires_at: new Date(Date.now() - 60000).toISOString(),
};

const mockHistorySessions: SupportSession[] = [
  {
    id: 'sup-h1',
    tenant_id: 't-1',
    tenant_name: 'Moda Cruceña',
    platform_user_id: 'u-plat-1',
    platform_user_name: 'Soporte Plataforma',
    reason: 'Acceso de emergencia ante caída de pasarela',
    duration_minutes: 30,
    started_at: '2026-11-04T10:00:00Z',
    expires_at: '2026-11-04T10:30:00Z',
    ended_at: '2026-11-04T10:30:00Z',
    end_reason: 'expired',
    actions_count: 2,
    is_active: false,
    status: 'active',
    is_emergency: true,
  },
];

describe('AccesosSoporteComponent (PX0.3)', () => {
  let mockApi: any;

  beforeEach(() => {
    mockApi = {
      supportSessions: vi.fn(() =>
        of({ items: mockHistorySessions, total: 1, page: 1, pages: 1, page_size: 20 })
      ),
      supportRequests: vi.fn(() =>
        of({ items: [mockPendingSession], total: 1, page: 1, pages: 1, page_size: 20 })
      ),
      supportPolicy: vi.fn(() => of({ support_access_mode: 'require_approval' })),
      approveSupportRequest: vi.fn(() => of({ ...mockPendingSession, status: 'approved' })),
      rejectSupportRequest: vi.fn(() => of({ ...mockPendingSession, status: 'rejected' })),
      updateSupportPolicy: vi.fn(() => of({ support_access_mode: 'allow_read_only' })),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: EmpresaAdminApi, useValue: mockApi },
      ],
    });
  });

  it('Aprobar 30 min: llama a approveSupportRequest con 30 minutos', async () => {
    const fixture = TestBed.createComponent(AccesosSoporteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    expect(comp.pendingRequests().length).toBe(1);

    // Click en botón Aprobar 30 min
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const btnApprove30 = buttons.find((b) => b.textContent?.includes('Aprobar 30 min'));
    expect(btnApprove30).toBeDefined();

    btnApprove30?.click();
    fixture.detectChanges();

    expect(mockApi.approveSupportRequest).toHaveBeenCalledWith('sup-pending-1', 30);
  });

  it('Rechazar exige motivo: botón deshabilitado si motivo < 5 caracteres', async () => {
    const fixture = TestBed.createComponent(AccesosSoporteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const comp = fixture.componentInstance;

    // Abrir modal de rechazo
    comp.abrirRechazo(mockPendingSession);
    fixture.detectChanges();

    expect(comp.rejectDialogSession()).not.toBeNull();

    // Motivo vacío o corto
    comp.rejectReason.set('abc');
    fixture.detectChanges();

    const modalBox = fixture.nativeElement.querySelector('.modal-box');
    expect(modalBox).not.toBeNull();

    const rejectButtons = Array.from(modalBox.querySelectorAll('button')) as HTMLButtonElement[];
    const btnConfirmReject = rejectButtons.find((b) => b.textContent?.includes('Rechazar solicitud'));
    expect(btnConfirmReject?.disabled).toBe(true);

    // Motivo válido >= 5 caracteres
    comp.rejectReason.set('No autorizamos acceso fuera de horario');
    fixture.detectChanges();
    expect(btnConfirmReject?.disabled).toBe(false);

    // Confirmar rechazo
    comp.confirmarRechazo();
    fixture.detectChanges();

    expect(mockApi.rejectSupportRequest).toHaveBeenCalledWith(
      'sup-pending-1',
      'No autorizamos acceso fuera de horario'
    );
  });

  it('Cuenta regresiva vence: muestra expirada si request_expires_at está en el pasado', async () => {
    mockApi.supportRequests = vi.fn(() =>
      of({ items: [mockExpiredSession], total: 1, page: 1, pages: 1, page_size: 20 })
    );

    const fixture = TestBed.createComponent(AccesosSoporteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    expect(comp.countdownText()).toBe('expirada');
  });

  it('Historial marca sesiones de emergencia con badge danger', async () => {
    const fixture = TestBed.createComponent(AccesosSoporteComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const badges = Array.from(fixture.nativeElement.querySelectorAll('.badge.danger')) as HTMLElement[];
    const emergencyBadge = badges.find((b) => b.textContent?.includes('Acceso de emergencia'));
    expect(emergencyBadge).toBeDefined();
  });
});
