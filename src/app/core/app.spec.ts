import { DeferBlockState, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

@Component({ template: '<p>Vista de prueba</p>' })
class TestPage {}

describe('FashionStore shell', () => {
  it('muestra acceso al directorio de tiendas y la cuenta', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Tiendas');
    expect(element.textContent).toContain('Crear cuenta');
    expect(element.querySelector('main')).toBeTruthy();
  });

  it('conserva un solo asistente al navegar por tienda, plataforma, empresa, offline y acceso', async () => {
    const paths = [
      '',
      'admin/plataforma',
      'admin/empresa/configuracion',
      'sin-conexion',
      'iniciar-sesion',
    ];
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(paths.map((path) => ({ path, component: TestPage }))),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const blocks = await fixture.getDeferBlocks();
    await blocks[0].render(DeferBlockState.Complete);
    const assistant = fixture.nativeElement.querySelector('fs-assistant-widget');
    expect(assistant).toBeTruthy();
    for (const path of paths) {
      await TestBed.inject(Router).navigateByUrl('/' + path);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('fs-assistant-widget').length).toBe(1);
      expect(fixture.nativeElement.querySelector('fs-assistant-widget')).toBe(assistant);
      expect(assistant.querySelector('[aria-label="Asistente de FashionStore"]')).toBeTruthy();
    }
  });
});
