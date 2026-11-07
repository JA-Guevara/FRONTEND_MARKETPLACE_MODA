import '@angular/compiler';
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VentaOfflineComponent } from './venta-offline.component';
import { OfflineCatalogStore } from '../application/offline-catalog.store';
import { OperacionesLocalesRepository } from '../infrastructure/operaciones-locales.repository';
import { CatalogoLocalRepository } from '../infrastructure/catalogo-local.repository';
import { SessionService } from '../../usuarios-catalogo/application/session.service';

describe('VentaOfflineComponent · CU-18 cliente opcional', () => {
  let guardar: ReturnType<typeof vi.fn>;

  function crear() {
    const datos = signal({
      productos: [{ id: 'p1', nombre: 'Vestido', precio_base: 50 }],
      variantes: [{ id: 'v1', producto_id: 'p1', sku: 'V-M', talla: 'M', color: 'Rojo', precio: null, activa: true }],
      existencias: [{ variante_id: 'v1', sucursal_id: 's1', cantidad: 3 }],
      sucursales: [],
      clientes: [
        { id: 'c1', nombre: 'Ana Pérez', documento_final: '1234', telefono: null },
        { id: 'c2', nombre: 'Bruno Díaz', documento_final: '', telefono: null },
      ],
    });
    TestBed.configureTestingModule({
      imports: [VentaOfflineComponent],
      providers: [
        provideRouter([]),
        {
          provide: OfflineCatalogStore,
          useValue: {
            datos,
            meta: signal({ version: 'v1', descargadoEn: '2026-11-07T10:00:00Z', sucursalId: 's1' }),
            cargarLocal: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: OperacionesLocalesRepository, useValue: { guardarVentaLocal: guardar } },
        { provide: CatalogoLocalRepository, useValue: { meta: vi.fn().mockResolvedValue({ tenantId: 'otro' }) } },
        {
          provide: SessionService,
          useValue: {
            user: () => ({ id: 'u1', tenant: { id: 't1' } }),
            can: () => true,
            readOnly: () => false,
            hasFeature: () => true,
          },
        },
      ],
    });
    return TestBed.createComponent(VentaOfflineComponent).componentInstance;
  }

  beforeEach(() => {
    guardar = vi.fn().mockResolvedValue(undefined);
  });

  it('busca clientes descargados por nombre sin distinguir mayúsculas', () => {
    const c = crear();
    expect(c.clientesFiltrados()).toHaveLength(2);
    c.busquedaCliente.set('ana');
    expect(c.clientesFiltrados().map((x) => x.id)).toEqual(['c1']);
    expect(c.etiquetaCliente(c.clientesFiltrados()[0])).toContain('1234');
  });

  it('guarda la venta con el cliente elegido y limpia la selección', async () => {
    const c = crear();
    c.clienteId.set('c1');
    c.cajaId = 'caja-1';
    c.cantidad('v1', 1);
    c.recibido = 50;
    await c.confirmar();
    const venta = guardar.mock.calls[0][0];
    expect(venta.cliente_id).toBe('c1');
    expect(venta.cliente_nombre).toBe('Ana Pérez');
    expect(c.clienteId()).toBe('');
    expect(c.error()).toBe('');
  });

  it('sin cliente la venta se guarda como hoy, con cliente nulo', async () => {
    const c = crear();
    c.cajaId = 'caja-1';
    c.cantidad('v1', 2);
    c.recibido = 100;
    await c.confirmar();
    const venta = guardar.mock.calls[0][0];
    expect(venta.cliente_id).toBeNull();
    expect(venta.total).toBe(100);
  });
});
