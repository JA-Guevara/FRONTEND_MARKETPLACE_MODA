import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { EmpresasPageComponent } from './empresas-page.component';
import { EmpresaFormComponent } from './empresa-form.component';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { tenant, plans, session } from './saas-test-fixtures';
describe('Empresas: pantallas y registro', () => {
  it('carga cuatro indicadores, fila real y filtra suscripciones suspendidas', async () => {
    const api = {
      tenants: vi.fn(() => of({ items: [tenant], total: 1, page: 1, pages: 1, page_size: 20 })),
      tenantStats: () => of({ active: 1, professional: 0, expiring_7d: 0, suspended: 0 }),
      plans: () => of(plans),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PlataformaApi, useValue: api },
        { provide: SessionService, useValue: session },
      ],
    });
    const f = TestBed.createComponent(EmpresasPageComponent);
    f.detectChanges();
    await f.componentInstance.store.load();
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('fs-kpi-card')).toHaveLength(4);
    expect(f.nativeElement.textContent).toContain('Moda Cruceña');
    f.componentInstance.store.setFilter('status', 'suspendidas');
    await f.whenStable();
    expect(api.tenants).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'SUSPENDIDA' }));
  });
  it('autocompleta slug y conserva formulario al recibir NIT duplicado', async () => {
    const api = {
      plans: () => of(plans),
      createTenant: vi.fn(() =>
        throwError(() => ({ error: { error: { code: 'tenant_tax_id_taken' } } })),
      ),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: PlataformaApi, useValue: api }],
    });
    const f = TestBed.createComponent(EmpresaFormComponent);
    f.detectChanges();
    f.componentInstance.form.controls.trade_name.setValue('Moda Cruceña');
    expect(f.componentInstance.form.controls.slug.value).toBe('moda-crucena');
    f.componentInstance.form.patchValue({legal_name:'Moda Cruceña SRL',tax_id:'1020304050',contact_email:'contacto@example.com',admin:{first_name:'Lucia',last_name:'Pruebas',email:'admin@example.com'}});
    f.componentInstance.step.set(2);
    await f.componentInstance.submit();
    f.detectChanges();
    expect(f.componentInstance.step()).toBe(0);
    expect(f.componentInstance.errors()['tax_id']).toContain('Ya registrado');
    expect(f.componentInstance.form.controls.trade_name.value).toBe('Moda Cruceña');
  });
});
