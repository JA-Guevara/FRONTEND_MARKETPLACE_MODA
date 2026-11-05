import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { EstadoOperacion, OperacionApi } from '../infrastructure/operacion.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { DesplieguesPageComponent } from './despliegues-page.component';
import { ops_status_con_avisos, ops_status_ok, ops_status_sin_permiso } from './ps-correcciones.fixtures';

describe('Despliegues · configuración de producción', () => {
  const configure = (result: Observable<EstadoOperacion>) => {
    TestBed.configureTestingModule({ providers: [
      { provide: OperacionApi, useValue: { estado: () => result } },
      { provide: SessionService, useValue: { scope: () => 'platform', can: () => true } },
    ] });
    const fixture = TestBed.createComponent(DesplieguesPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('ordena cinco comprobaciones por error, warning e info y señala el bloqueo', () => {
    const fixture = configure(of(structuredClone(ops_status_con_avisos.data)));
    const rows = Array.from(fixture.nativeElement.querySelectorAll('[data-config-level]')) as HTMLElement[];
    expect(rows).toHaveLength(5);
    expect(rows.map(row => row.dataset['configLevel'])).toEqual(['error', 'warning', 'warning', 'warning', 'info']);
    expect(fixture.nativeElement.textContent).toContain('Hay configuración que debe corregirse antes de la próxima publicación.');
    expect(fixture.nativeElement.textContent).toContain('Configuración de producción');
  });

  it('solo información opcional muestra la configuración obligatoria completa sin alerta', () => {
    const fixture = configure(of(structuredClone(ops_status_ok.data)));
    expect(fixture.nativeElement.textContent).toContain('La configuración obligatoria está completa.');
    expect(fixture.nativeElement.textContent).not.toContain('Hay configuración que debe corregirse');
    expect(fixture.nativeElement.querySelector('[data-config-level="info"]')?.textContent).toContain('Información');
  });

  it('403 permission_denied conserva el texto específico de operación', () => {
    const fixture = configure(throwError(() => new HttpErrorResponse({ status: 403, error: ops_status_sin_permiso })));
    expect(fixture.nativeElement.textContent).toContain('No tienes permiso para ver la operación de la plataforma.');
    expect(fixture.nativeElement.textContent).not.toContain('La configuración obligatoria está completa.');
  });

  it('fallo de red muestra error y botón para reintentar', () => {
    const fixture = configure(throwError(() => new HttpErrorResponse({ status: 0 })));
    expect(fixture.nativeElement.textContent).toContain('No se pudo cargar el estado de la plataforma.');
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons.some(button => button.textContent?.includes('Reintentar') && !button.disabled)).toBe(true);
  });

  it('solo representa el contrato de comprobaciones, nunca valores de variables', () => {
    const data = { ...structuredClone(ops_status_con_avisos.data), values: { BACKUP_REPORT_TOKEN: 'valor-prueba-que-no-debe-mostrarse' } };
    const fixture = configure(of(data));
    expect(fixture.nativeElement.textContent).not.toContain(data.values.BACKUP_REPORT_TOKEN);
    expect(fixture.nativeElement.textContent).toContain('Solo se muestran nombres de variables; los valores nunca salen del servidor.');
  });
});
