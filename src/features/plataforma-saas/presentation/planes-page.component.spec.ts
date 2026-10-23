import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PlanesPageComponent } from './planes-page.component';
import { PlanEditorComponent } from './plan-editor.component';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { plans, session } from './saas-test-fixtures';
describe('Pantallas de planes', () => {
  it('muestra planes y creación con matriz por características', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: session },
        {
          provide: PlataformaApi,
          useValue: {
            plans: () => of(plans),
            featureCatalog: () => of([{ code: 'ai_reports', label: 'IA', kind: 'feature' }]),
          },
        },
      ],
    });
    const f = TestBed.createComponent(PlanesPageComponent);
    f.detectChanges();
    await f.componentInstance.load();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Básico');
    expect(f.nativeElement.textContent).toContain('Profesional');
    expect(f.nativeElement.textContent).toContain('Crear un plan');
    expect(f.nativeElement.querySelectorAll('tbody tr')).toHaveLength(1);
  });
  it('mantiene alerta de empresas excedidas y código de edición deshabilitado', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PlataformaApi,
          useValue: {
            updatePlan: () =>
              of({ data: { plan: plans[1], exceeded_tenants: ['Textiles Andinos'] } }),
          },
        },
      ],
    });
    const f = TestBed.createComponent(PlanEditorComponent);
    f.componentRef.setInput('plan', plans[1]);
    f.detectChanges();
    await f.componentInstance.save();
    f.detectChanges();
    expect((f.nativeElement.querySelector('input') as HTMLInputElement).disabled).toBe(true);
    expect(f.nativeElement.textContent).toContain('Textiles Andinos');
  });
  it('marca el código duplicado sin cerrar el editor', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PlataformaApi,
          useValue: {
            createPlan: () => throwError(() => ({ error: { error: { code: 'plan_code_taken' } } })),
          },
        },
      ],
    });
    const f = TestBed.createComponent(PlanEditorComponent);
    f.detectChanges();
    f.componentInstance.draft = { ...plans[0], reference_price: 350 };
    await f.componentInstance.save();
    expect(f.componentInstance.errors()['code']).toContain('Ya existe');
  });
});
