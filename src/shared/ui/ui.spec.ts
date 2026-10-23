import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { UsageMeterComponent } from './usage-meter.component';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { SessionService } from '../../features/usuarios-catalogo/application/session.service';
import { User } from '../models';
describe('Componentes compartidos SaaS', () => {
  it('muestra cupo agotado y proximidad con límites reales', () => {
    const f = TestBed.createComponent(UsageMeterComponent);
    f.componentRef.setInput('used', 2);
    f.componentRef.setInput('limit', 2);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.full')).toBeTruthy();
    f.componentRef.setInput('used', 9);
    f.componentRef.setInput('limit', 10);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.near')).toBeTruthy();
    expect(f.nativeElement.querySelector('.full')).toBeNull();
  });
  it('exige slug y motivo nuevos en cada apertura de confirmación', async () => {
    const f = TestBed.createComponent(ConfirmDialogComponent);
    f.componentRef.setInput('requireText', 'urbano');
    f.componentRef.setInput('open', true);
    f.detectChanges();
    const button = () => f.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement;
    expect(button().disabled).toBe(true);
    await f.whenStable();
    const typed = f.nativeElement.querySelector('input') as HTMLInputElement;
    const reason = f.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    typed.value = 'urbano';
    typed.dispatchEvent(new Event('input'));
    reason.value = 'Baja temporal';
    reason.dispatchEvent(new Event('input'));
    await f.whenStable();
    f.detectChanges();
    expect(button().disabled).toBe(false);
    f.componentRef.setInput('open', false);
    f.detectChanges();
    f.componentRef.setInput('open', true);
    f.detectChanges();
    expect(button().disabled).toBe(true);
    expect(f.componentInstance.typed).toBe('');
  });
  it('suscripción suspendida o vencida bloquea escrituras y respeta funciones', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const s = TestBed.inject(SessionService);
    const user = {
      id: 'u',
      email: 'u@example.com',
      first_name: 'U',
      last_name: 'Test',
      phone: null,
      is_active: true,
      is_verified: true,
      roles: [],
      subscription: {
        plan_code: 'BASICO',
        plan_name: 'Básico',
        status: 'SUSPENDIDA',
        start_date: '2030-01-01',
        end_date: '2030-12-31',
        days_left: 30,
        features: { ai_reports: false },
        limits: { max_active_branches: 2 },
      },
    } as User;
    s.user.set(user);
    expect(s.readOnly()).toBe(true);
    expect(s.hasFeature('ai_reports')).toBe(false);
    s.user.set({
      ...user,
      subscription: { ...user.subscription!, status: 'ACTIVA', end_date: '2000-01-01' },
    });
    expect(s.readOnly()).toBe(true);
    TestBed.inject(HttpTestingController).verify();
  });
});
