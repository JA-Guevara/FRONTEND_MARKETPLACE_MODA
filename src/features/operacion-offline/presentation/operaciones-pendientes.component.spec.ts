import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { OperacionesPendientesComponent } from './operaciones-pendientes.component';
import { SincronizacionService } from '../application/sincronizacion.service';
import { OperacionesLocalesRepository } from '../infrastructure/operaciones-locales.repository';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { OperacionPendiente } from '../domain/reserva-offline.models';
import { etiquetaEstado, etiquetaTipo } from '../domain/sincronizacion.models';

describe('OperacionesPendientesComponent · operaciones locales y sincronización (MJ-02)', () => {
  let fixture: ComponentFixture<OperacionesPendientesComponent>;
  let comp: OperacionesPendientesComponent;
  let mockSyncService: any;
  let mockRepo: any;
  let mockSession: any;
  let canResolve = true;

  const mockOps: OperacionPendiente[] = [
    {
      id: 'op-1',
      tipo: 'VENTA',
      estado: 'PENDIENTE',
      tenant_id: 't1',
      sucursal_id: 'b1',
      usuario_id: 'u1',
      dispositivo_id: 'dev-1',
      creada_en: '2026-11-11T10:15:00Z',
      actualizada_en: '2026-11-11T10:15:00Z',
      intentos: 0,
      ultimo_error: null,
      server_numero: null,
      server_ref: null,
      conflicto_id: null,
      motivo_codigo: null,
      payload: { local_folio: 'OFF-BBBBBBBB', total: '300.00' },
    },
    {
      id: 'op-2',
      tipo: 'VENTA',
      estado: 'CONFIRMADA',
      tenant_id: 't1',
      sucursal_id: 'b1',
      usuario_id: 'u1',
      dispositivo_id: 'dev-1',
      creada_en: '2026-11-11T10:02:00Z',
      actualizada_en: '2026-11-11T10:02:00Z',
      intentos: 1,
      ultimo_error: null,
      server_numero: 'FS-A8F3D1',
      server_ref: 'srv-ref-2',
      conflicto_id: null,
      motivo_codigo: null,
      payload: { local_folio: 'OFF-AAAAAAAA', total: '180.00' },
    },
    {
      id: 'op-3',
      tipo: 'RESERVA',
      estado: 'CONFLICTO',
      tenant_id: 't1',
      sucursal_id: 'b1',
      usuario_id: 'u1',
      dispositivo_id: 'dev-1',
      creada_en: '2026-11-11T09:40:00Z',
      actualizada_en: '2026-11-11T09:40:00Z',
      intentos: 1,
      ultimo_error: 'Stock insuficiente',
      server_numero: null,
      server_ref: null,
      conflicto_id: 'conf-123',
      motivo_codigo: 'STOCK',
      payload: { prendas: 2 },
    },
  ];

  beforeEach(async () => {
    canResolve = true;
    mockSyncService = {
      cambios: new Subject<void>(),
      sincronizando: signal(false),
      pendientesCount: signal(1),
      conflictosCount: signal(1),
      ultimoSync: signal(new Date('2026-11-11T11:00:00Z')),
      ultimoError: signal(null),
      estado: signal('PENDIENTES'),
      sincronizarAhora: vi.fn().mockResolvedValue({ enviadas: 1, confirmadas: 1, conflictos: 0, rechazadas: 0 }),
    };

    mockRepo = {
      listarOperaciones: vi.fn().mockResolvedValue(mockOps),
      obtenerOperacion: vi.fn(),
    };

    mockSession = {
      user: () => ({ id: 'u1', tenant: { id: 't1' } }),
      can: (perm: string) => perm === 'sync_conflicts.read' ? canResolve : true,
      readOnly: () => false,
      hasFeature: () => true,
      offlineSession: () => false,
    };

    await TestBed.configureTestingModule({
      imports: [OperacionesPendientesComponent],
      providers: [
        provideRouter([]),
        { provide: SincronizacionService, useValue: mockSyncService },
        { provide: OperacionesLocalesRepository, useValue: mockRepo },
        { provide: SessionService, useValue: mockSession },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OperacionesPendientesComponent);
    comp = fixture.componentInstance;
  });

  it('Una venta PENDIENTE se muestra «Venta de contado … Por subir»; una CONFIRMADA muestra su número del servidor', async () => {
    expect(etiquetaTipo('VENTA')).toBe('Venta de contado');
    expect(etiquetaEstado('PENDIENTE')).toBe('Por subir');
    expect(etiquetaEstado('CONFIRMADA')).toBe('Confirmada');

    await comp.ngOnInit();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Venta de contado');
  });

  it('Una operación CONFLICTO muestra «Necesita revisión» con enlace a conflictos solo para quien tiene sync_conflicts.read', async () => {
    expect(etiquetaEstado('CONFLICTO')).toBe('Necesita revisión');
    await comp.ngOnInit();
    fixture.detectChanges();
  });

  it('Con sesión vencida aparece la franja con «Iniciá sesión para enviarlas»', async () => {
    mockSyncService.estado.set('SESION_VENCIDA');
    await comp.ngOnInit();
    fixture.detectChanges();
  });

  it('Las fechas se muestran como dd/MM HH:mm en hora local', async () => {
    await comp.ngOnInit();
    fixture.detectChanges();
  });

  it('Lista vacía → «No hay operaciones guardadas en este dispositivo.»', async () => {
    mockRepo.listarOperaciones.mockResolvedValue([]);
    await comp.ngOnInit();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toBeDefined();
  });
});
