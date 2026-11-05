import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { LegalPageComponent } from './legal-page.component';

describe('LegalPageComponent', () => {
  it('muestra la página de Términos y Condiciones con versión y cláusulas', async () => {
    await TestBed.configureTestingModule({
      imports: [LegalPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { docType: 'terminos' },
              url: [{ path: 'terminos' }],
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LegalPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Términos y Condiciones');
    expect(text).toContain('1.0.0 (2026-11)');
    expect(text).toContain('14 Días');
    expect(text).toContain('Período de gracia');
    expect(text).toContain('Solo lectura');
  });

  it('muestra la página de Política de Privacidad con compromiso de aislamiento', async () => {
    await TestBed.configureTestingModule({
      imports: [LegalPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { docType: 'privacidad' },
              url: [{ path: 'privacidad' }],
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LegalPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Política de Privacidad');
    expect(text).toContain('Aislamiento Multitenant');
    expect(text).toContain('TenantScope');
    expect(text).toContain('Machine Learning');
  });
});
