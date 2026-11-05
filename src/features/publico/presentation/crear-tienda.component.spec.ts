import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { describe, it, expect } from 'vitest';
import { CrearTiendaComponent } from './crear-tienda.component';

describe('CrearTiendaComponent', () => {
  it('calcula el slug en vivo y consulta su disponibilidad', async () => {
    let slugQueried = '';
    await TestBed.configureTestingModule({
      imports: [CrearTiendaComponent],
      providers: [
        provideRouter([]),
        {
          provide: HttpClient,
          useValue: {
            get: (url: string) => {
              slugQueried = url;
              return of({ data: { slug: 'boutique-luz', available: true, reason: 'Disponible' } });
            },
            post: () => of({}),
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CrearTiendaComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.onNameChange('Boutique Luz');
    fixture.detectChanges();

    expect(fixture.componentInstance.slug()).toBe('boutique-luz');
    expect(fixture.componentInstance.slugAvailable()).toBe(true);
    expect(slugQueried).toContain('/public/signup/slug?name=boutique-luz');

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('fashionstore.app/tienda/');
    expect(text).toContain('disponible');
  });

  it('evalúa la fortaleza de la contraseña adecuadamente', async () => {
    await TestBed.configureTestingModule({
      imports: [CrearTiendaComponent],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: () => of({}), post: () => of({}) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CrearTiendaComponent);
    const comp = fixture.componentInstance;

    comp.password.set('123');
    expect(comp.pwdStrength().level).toBe('weak');

    comp.password.set('password123');
    expect(comp.pwdStrength().level).toBe('medium');

    comp.password.set('PasswordSuperSeguro123!');
    expect(comp.pwdStrength().level).toBe('strong');
  });

  it('envía solicitud de alta y muestra mensaje «Revisa tu correo»', async () => {
    let postBody: any = null;
    await TestBed.configureTestingModule({
      imports: [CrearTiendaComponent],
      providers: [
        provideRouter([]),
        {
          provide: HttpClient,
          useValue: {
            get: () => of({ data: { available: true } }),
            post: (url: string, body: any) => {
              postBody = body;
              return of({
                success: true,
                message: 'Instrucciones enviadas.',
                data: { email: 'admin@boutique.test', dev_token: 'fake-dev-token-999' },
              });
            },
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CrearTiendaComponent);
    const comp = fixture.componentInstance;

    comp.companyName.set('Boutique Chic');
    comp.slug.set('boutique-chic');
    comp.slugAvailable.set(true);
    comp.email.set('admin@boutique.test');
    comp.password.set('Segura123!');
    comp.acceptTerms.set(true);

    fixture.detectChanges();
    expect(comp.isFormValid()).toBe(true);

    comp.onSubmit();
    fixture.detectChanges();

    expect(postBody).toEqual({
      company_name: 'Boutique Chic',
      slug: 'boutique-chic',
      email: 'admin@boutique.test',
      password: 'Segura123!',
      accept_terms: true,
      accept_privacy: true,
    });

    expect(comp.submitted()).toBe(true);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Revisa tu correo');
    expect(text).toContain('admin@boutique.test');
  });
});
