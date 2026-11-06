import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { describe, it, expect, vi } from 'vitest';
import { CrearTiendaComponent } from './crear-tienda.component';

describe('CrearTiendaComponent', () => {
  it('404 de disponibilidad cierra el alta, limpia la contraseña e impide nuevas solicitudes', async () => {
    const http = { get: vi.fn(() => throwError(() => ({ status: 404, error: { error: { code: 'signup_disabled' } } }))), post: vi.fn() };
    TestBed.configureTestingModule({ imports: [CrearTiendaComponent], providers: [provideRouter([]),
      { provide: HttpClient, useValue: http }, { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
    ] });
    const fixture = TestBed.createComponent(CrearTiendaComponent); fixture.detectChanges();
    fixture.componentInstance.password.set('Ejemplo123!'); fixture.componentInstance.onNameChange('Nueva Tienda'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('El registro de tiendas está cerrado por ahora.');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.componentInstance.password()).toBe('');
    fixture.componentInstance.onNameChange('Otra Tienda'); fixture.componentInstance.onSubmit(); fixture.componentInstance.verifyNow('token');
    expect(http.get).toHaveBeenCalledOnce(); expect(http.post).not.toHaveBeenCalled();
  });
  it('la respuesta tardía de un nombre anterior no habilita el nuevo slug', () => {
    const older = new Subject<{ data: { slug: string; available: boolean; reason: string } }>();
    const newer = new Subject<{ data: { slug: string; available: boolean; reason: string } }>();
    const http = { get: vi.fn().mockReturnValueOnce(older).mockReturnValueOnce(newer) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: HttpClient, useValue: http },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
    ] });
    const component = TestBed.createComponent(CrearTiendaComponent).componentInstance;
    component.onNameChange('Primera Tienda'); component.onNameChange('Segunda Tienda');
    older.next({ data: { slug: 'primera-tienda', available: true, reason: 'Disponible' } });
    expect(component.slug()).toBe('segunda-tienda'); expect(component.slugAvailable()).toBeNull();
    newer.next({ data: { slug: 'segunda-tienda', available: false, reason: 'Ocupado' } });
    expect(component.slugAvailable()).toBe(false); expect(component.slugReason()).toBe('Ocupado');
  });
  it('404 al verificar también muestra alta cerrada en vez de activar la empresa', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      { provide: HttpClient, useValue: { post: () => throwError(() => ({ status: 404 })) } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ token: 'ejemplo' }) } } },
    ] });
    const fixture = TestBed.createComponent(CrearTiendaComponent); fixture.detectChanges();
    expect(fixture.componentInstance.verifiedResult()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('El registro de tiendas está cerrado por ahora.');
  });
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
