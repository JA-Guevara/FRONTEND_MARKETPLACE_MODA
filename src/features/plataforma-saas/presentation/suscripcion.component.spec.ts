import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SuscripcionEmpresaComponent } from './suscripcion-empresa.component';
import { MiSuscripcionComponent } from './mi-suscripcion.component';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { plans, session, detail } from './saas-test-fixtures';
describe('Pantallas de suscripción', () => {
  it('bloquea downgrade y pide motivo antes de permitir cambio', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', 't1']]) } } },
        { provide: SessionService, useValue: session },
        {
          provide: PlataformaApi,
          useValue: { subscription: () => of(detail()), plans: () => of(plans) },
        },
      ],
    });
    const f = TestBed.createComponent(SuscripcionEmpresaComponent);
    f.detectChanges();
    await f.componentInstance.load();
    f.componentInstance.targetCode = 'BASICO';
    f.componentInstance.reason = 'Bajar plan';
    f.componentInstance.changeOpen.set(true);
    f.detectChanges();
    expect(f.componentInstance.canApply()).toBe(false);
    expect(f.nativeElement.textContent).toContain('desactivar 4');
  });
  it('mi suscripción avisa al quedar seis días de vigencia', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: session },
        { provide: PlataformaApi, useValue: { mySubscription: () => of(detail()) } },
      ],
    });
    const f = TestBed.createComponent(MiSuscripcionComponent);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelector('.alert.warn')).toBeTruthy();
    expect(f.nativeElement.textContent).toContain('6');
  });
});
