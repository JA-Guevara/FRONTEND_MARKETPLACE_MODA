import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ContinuidadPageComponent } from './continuidad-page.component';
import { DesplieguesPageComponent } from './despliegues-page.component';
import { OperacionApi, EstadoOperacion } from '../infrastructure/operacion.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { ADMIN_NAV, visibleSections } from '../../../app/core/layout/admin-nav';

describe('Consola de Operación', () => {
  let status: EstadoOperacion;
  let api: { estado: ReturnType<typeof vi.fn>; respaldos: ReturnType<typeof vi.fn>; respaldarAhora: ReturnType<typeof vi.fn> };
  const session = { scope: () => 'platform', can: (p?: string) => !p || ['platform.ops.read', 'platform.ops.write'].includes(p) };
  beforeEach(() => {
    status = { config_checks: [], version: '1', git_sha: 'sha', app_env: 'test', revision_bd: '0031', cabeza_codigo: '0032', migraciones_pendientes: true, mantenimiento: false,
      ultimo_respaldo: { id: 'b1', finished_at: '2026-11-04T00:00:00Z', age_hours: 27, alembic_revision: '0031' },
      contadores: { rate_limited: 0, sync_rechazadas_24h: 0, cuentas_bloqueadas: 0, mfa_adopcion: { total: 1, habilitadas: null } } };
    api = { estado: vi.fn(() => of(status)), respaldos: vi.fn(() => of({ items: [], total: 0, page: 1, page_size: 20, pages: 0 })), respaldarAhora: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: OperacionApi, useValue: api }, { provide: SessionService, useValue: session }] });
  });

  it('una copia de 27 horas se muestra en peligro', () => {
    const fixture = TestBed.createComponent(ContinuidadPageComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.enPeligro()).toBe(true);
    expect(fixture.nativeElement.querySelector('.danger').textContent).toContain('27.0 h');
    expect(fixture.nativeElement.textContent).toContain('No hay copias registradas');
  });

  it('dispatch no configurado muestra instrucciones sin simular una copia', () => {
    api.respaldarAhora.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { error: { code: 'dispatch_not_configured' } } })));
    const fixture = TestBed.createComponent(ContinuidadPageComponent);
    fixture.componentInstance.reason = 'Comprobación autorizada';
    fixture.componentInstance.dispatch(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('GitHub → Actions → Respaldo BD');
    expect(fixture.componentInstance.copias()).toEqual([]);
  });

  it('una copia reciente de otra revisión no se considera compatible', () => {
    status.ultimo_respaldo!.age_hours = 3; status.ultimo_respaldo!.alembic_revision = '0030';
    const fixture = TestBed.createComponent(DesplieguesPageComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.copiaValida()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Puerta bloqueada');
  });

  it('sin permiso no hay grupo de operación ni llamadas a sus APIs', () => {
    const limited = { ...session, can: () => false };
    expect(visibleSections(ADMIN_NAV, { scope: 'platform', isSupport: false, can: () => false }).some(s => s.title === 'Operación')).toBe(false);
    TestBed.overrideProvider(SessionService, { useValue: limited });
    const fixture = TestBed.createComponent(ContinuidadPageComponent); fixture.detectChanges();
    expect(api.estado).not.toHaveBeenCalled(); expect(api.respaldos).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('No tenés permiso');
  });
});
