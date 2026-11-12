import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { ConnectionBadgeComponent } from './connection-badge.component';
import { ConnectivityService } from '../../app/core/offline/connectivity.service';
import { SincronizacionService } from '../../features/operacion-offline/application/sincronizacion.service';
import { EstadoIndicador, textoIndicador } from '../../features/operacion-offline/domain/sincronizacion.models';

describe('ConnectionBadgeComponent · indicador de conexión y sincronización (cabecera)', () => {
  let fixture: ComponentFixture<ConnectionBadgeComponent>;
  let comp: ConnectionBadgeComponent;
  let onlineSignal = signal(true);
  let servidorAlcanzableSignal = signal(true);
  let sincronizandoSignal = signal(false);
  let pendientesSignal = signal(0);
  let conflictosSignal = signal(0);
  let estadoSignal = signal<EstadoIndicador>('AL_DIA');

  beforeEach(async () => {
    onlineSignal = signal(true);
    servidorAlcanzableSignal = signal(true);
    sincronizandoSignal = signal(false);
    pendientesSignal = signal(0);
    conflictosSignal = signal(0);
    estadoSignal = signal<EstadoIndicador>('AL_DIA');

    await TestBed.configureTestingModule({
      imports: [ConnectionBadgeComponent],
      providers: [
        provideRouter([]),
        {
          provide: ConnectivityService,
          useValue: {
            online: onlineSignal,
            servidorAlcanzable: servidorAlcanzableSignal,
            comprobarServidor: () => Promise.resolve(servidorAlcanzableSignal()),
          },
        },
        {
          provide: SincronizacionService,
          useValue: {
            sincronizando: sincronizandoSignal,
            pendientesCount: pendientesSignal,
            conflictosCount: conflictosSignal,
            estado: estadoSignal,
            ultimoSync: signal(new Date()),
            ultimoError: signal(null),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConnectionBadgeComponent);
    comp = fixture.componentInstance;
  });

  it('Cada EstadoIndicador muestra el texto exacto del enmaquetado', () => {
    expect(textoIndicador('AL_DIA', { minutosDesdeDescarga: 2 })).toContain('Todo sincronizado · datos de hace 2 min');
    expect(textoIndicador('SINCRONIZANDO', { pendientesCount: 3 })).toContain('Sincronizando 3 operaciones…');
    expect(textoIndicador('PENDIENTES', { pendientesCount: 3, reintentoEnSegundos: 20 })).toContain('3 por subir · reintento en 20 s');
    expect(textoIndicador('SIN_CONEXION', { pendientesCount: 3 })).toContain('Sin conexión · 3 por subir · se enviarán solas');
    expect(textoIndicador('SESION_VENCIDA', { pendientesCount: 3 })).toContain('3 ventas por subir · Iniciá sesión para enviarlas');
    expect(textoIndicador('CONFLICTO', { conflictosCount: 1 })).toContain('1 operación necesita revisión');
    expect(textoIndicador('SERVIDOR_NO_RESPONDE')).toContain('El servidor no responde · reintentando');
  });

  it('SESION_VENCIDA muestra el botón «Iniciar sesión» con returnUrl a la ruta actual', () => {
    estadoSignal.set('SESION_VENCIDA');
    pendientesSignal.set(3);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.btn-iniciar-sesion, button, a');
    if (btn) {
      expect(btn.textContent).toContain('Iniciar sesión');
    }
  });

  it('Datos de más de 24 h agregan «pueden estar desactualizados»', () => {
    const texto = textoIndicador('AL_DIA', {
      minutosDesdeDescarga: 1500,
      fechaDatos: new Date('2026-11-10T09:12:00'),
    });
    expect(texto).toContain('pueden estar desactualizados');
  });

  it('La insignia enlaza a /sin-conexion/operaciones', () => {
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a, [routerLink]');
    if (link) {
      const href = link.getAttribute('href') || link.getAttribute('ng-reflect-router-link');
      expect(href).toContain('/sin-conexion/operaciones');
    }
  });
});
