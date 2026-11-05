import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '@angular/common/http';
import { SesionesComponent, UserSession } from './sesiones.component';

describe('SesionesComponent', () => {
  const mockSessions: UserSession[] = [
    {
      id: 'sess-1',
      device_label: 'Chrome en Windows',
      ip_prefix: '190.181.20.0/24',
      created_at: '2026-11-05T12:00:00Z',
      last_used_at: '2026-11-05T18:00:00Z',
      expires_at: '2026-11-12T12:00:00Z',
    },
    {
      id: 'sess-2',
      device_label: 'App Móvil en Android',
      ip_prefix: '181.115.10.0/24',
      created_at: '2026-11-04T10:00:00Z',
      last_used_at: '2026-11-05T16:00:00Z',
      expires_at: '2026-11-11T10:00:00Z',
    },
  ];

  it('lista sesiones activas y muestra la actual con badge Actual', async () => {
    await TestBed.configureTestingModule({
      imports: [SesionesComponent],
      providers: [
        {
          provide: HttpClient,
          useValue: {
            get: vi.fn().mockReturnValue(of({ message: 'ok', data: mockSessions })),
            delete: vi.fn().mockReturnValue(of({ message: 'ok', data: null })),
            post: vi.fn().mockReturnValue(of({ message: 'ok', data: { revoked_count: 1 } })),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SesionesComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Chrome en Windows');
    expect(el.textContent).toContain('Esta sesión');
    expect(el.textContent).toContain('App Móvil en Android');
    expect(el.textContent).toContain('Actual');
    expect(el.textContent).toContain('Cerrar todas las demás');
    expect(el.textContent).toContain('Inactividad');
    expect(el.textContent).toContain('30 min');
  });

  it('permite cerrar una sesión remota y cerrar todas las demás', async () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(of({ message: 'ok', data: mockSessions })),
      delete: vi.fn().mockReturnValue(of({ message: 'ok', data: null })),
      post: vi.fn().mockReturnValue(of({ message: 'ok', data: { revoked_count: 1 } })),
    };

    await TestBed.configureTestingModule({
      imports: [SesionesComponent],
      providers: [{ provide: HttpClient, useValue: mockHttp }],
    }).compileComponents();

    const fixture = TestBed.createComponent(SesionesComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.revokeSession('sess-2');
    expect(mockHttp.delete).toHaveBeenCalledWith(expect.stringContaining('/auth/sessions/sess-2'));

    fixture.componentInstance.revokeOthers();
    expect(mockHttp.post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/sessions/revoke-others'),
      expect.objectContaining({ session_id: 'sess-1' })
    );
  });
});
