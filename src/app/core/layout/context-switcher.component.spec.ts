import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextSwitcherComponent } from './context-switcher.component';
import { SessionService } from '../../../features/usuarios-catalogo/application/session.service';
import { PlataformaApi } from '../../../features/plataforma-saas/infrastructure/plataforma.api';
import { SoporteService } from '../../../features/plataforma-saas/application/soporte.service';

const empresa = (id: string, trade_name: string) => ({
  id, trade_name, legal_name: trade_name, tax_id: '1', slug: id, contact_email: 'x@y.bo', phone: null,
  status: 'ACTIVA', plan_code: 'PRO', plan_name: 'Profesional', subscription_status: 'ACTIVA',
  end_date: null, active_branches: 2, admin_email: null,
});

describe('ContextSwitcher · selector de empresas del super admin', () => {
  let tenants: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    tenants = vi.fn(() => of({ items: [empresa('t1', 'Moda Cruceña'), empresa('t2', 'Urbano Boutique')], total: 2, page: 1, page_size: 8, pages: 1 }));
    await TestBed.configureTestingModule({
      imports: [ContextSwitcherComponent],
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: { isSupport: signal(false), isPlatformAdmin: signal(true), tenant: signal(null), subscription: signal(null) } },
        { provide: PlataformaApi, useValue: { tenants } },
        { provide: SoporteService, useValue: { terminar: vi.fn() } },
      ],
    }).compileComponents();
  });

  function abrir() {
    const fixture = TestBed.createComponent(ContextSwitcherComponent);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.ctx-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    return fixture;
  }

  it('al abrir lista las empresas sin escribir nada, con 360° y Asistir', () => {
    const el = abrir().nativeElement as HTMLElement;
    expect(tenants).toHaveBeenCalledWith({ search: undefined, page_size: 8 });
    expect(el.textContent).toContain('Moda Cruceña');
    expect(el.textContent).toContain('Urbano Boutique');
    expect(el.querySelectorAll('a[href*="/admin/plataforma/empresas/t1"]').length).toBe(1);
    expect(el.textContent).toContain('Asistir');
    expect(el.textContent).toContain('Empresas · 2');
  });

  it('si la API falla muestra un mensaje en lugar de quedar vacío', () => {
    tenants.mockReturnValueOnce(throwError(() => new Error('x')));
    const el = abrir().nativeElement as HTMLElement;
    expect(el.textContent).toContain('No se pudo cargar la lista de empresas.');
  });
});
