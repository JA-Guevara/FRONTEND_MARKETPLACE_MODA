import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConflictosSyncComponent } from './conflictos.component';
import { SyncApi } from '../infrastructure/sync.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { conflictosLista } from '../../ia-reportes/domain/mj01.fixtures';

describe('ConflictosSyncComponent · gestión de conflictos con operación competidora', () => {
  let fixture: ComponentFixture<ConflictosSyncComponent>;
  let comp: ConflictosSyncComponent;
  let mockSyncApi: Partial<SyncApi>;
  let canResolve = true;

  beforeEach(async () => {
    canResolve = true;
    mockSyncApi = {
      getConflicts: vi.fn().mockResolvedValue({
        items: conflictosLista.items.map((item: any) => ({
          ...item,
          conflict_type: item.type,
          detected_at: item.created_at,
          payload_snapshot: item.lines,
          server_state_snapshot: item.lines,
        })),
        total: 1,
        page: 1,
        page_size: 20,
      }),
      resolveConflict: vi.fn().mockResolvedValue(undefined),
      confirmRefund: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ConflictosSyncComponent],
      providers: [
        { provide: SyncApi, useValue: mockSyncApi },
        {
          provide: SessionService,
          useValue: {
            user: () => ({ id: 'u1', tenant: { id: 't1' } }),
            can: (perm: string) =>
              perm === 'sync_conflicts.resolve' ? canResolve : true,
            readOnly: () => false,
            hasFeature: () => true,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConflictosSyncComponent);
    comp = fixture.componentInstance;
  });

  it('conflictos_lista muestra el recuadro «La unidad la tomó» con «Venta FS-A8F3D1 · Ana Suárez · dispositivo web-caja-01»', async () => {
    await comp.ngOnInit();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('La unidad la tomó');
    expect(text).toContain('Venta FS-A8F3D1 · Ana Suárez · dispositivo web-caja-01');
  });

  it('muestra ambas horas en hora local y la regla «Gana la primera venta confirmada por el servidor.»', async () => {
    await comp.ngOnInit();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Gana la primera venta confirmada por el servidor.');
    expect(text).toMatch(/Registrada sin conexión/);
    expect(text).toMatch(/Sincronizada/);
  });

  it('competing_operation null muestra la línea «No se identificó la operación que tomó la unidad…»', async () => {
    mockSyncApi.getConflicts = vi.fn().mockResolvedValue({
      items: [
        {
          ...conflictosLista.items[0],
          conflict_type: 'STOCK',
          detected_at: '2026-11-11T15:00:04Z',
          competing_operation: null,
          payload_snapshot: [],
          server_state_snapshot: [],
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });

    await comp.ngOnInit();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain(
      'No se identificó la operación que tomó la unidad (puede ser un ajuste de inventario).'
    );
  });

  it('conflicto STOCK incluye botón «Reintentar» y ante 409 stock_still_insufficient muestra el texto de reintento_sin_stock', async () => {
    await comp.ngOnInit();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Reintentar');

    mockSyncApi.resolveConflict = vi.fn().mockRejectedValue({
      status: 409,
      error: {
        code: 'stock_still_insufficient',
        message:
          'Todavía no hay existencia suficiente. Registrá el ingreso de mercadería o ajustá las cantidades.',
      },
    });

    if ((comp as any).resolverReintentar) {
      await (comp as any).resolverReintentar(comp.conflictos()[0]);
    } else {
      await comp.resolverRapido(comp.conflictos()[0], 'RETRY');
    }
    fixture.detectChanges();

    expect(comp.errorMsg()).toContain(
      'Todavía no hay existencia suficiente. Registrá el ingreso de mercadería o ajustá las cantidades.'
    );
  });

  it('operation_type PURCHASE muestra solo botón «Anular» y el texto «Compra de cliente: no se realizó ningún cobro.»', async () => {
    mockSyncApi.getConflicts = vi.fn().mockResolvedValue({
      items: [
        {
          ...conflictosLista.items[0],
          operation_type: 'PURCHASE',
          conflict_type: 'STOCK',
          detected_at: '2026-11-11T15:00:04Z',
          payload_snapshot: [],
          server_state_snapshot: [],
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });

    await comp.ngOnInit();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Compra de cliente: no se realizó ningún cobro.');
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .map((b: any) => b.textContent.trim());
    expect(buttons).toContain('Anular');
    expect(buttons).not.toContain('Ajustar');
    expect(buttons).not.toContain('Reintentar');
  });

  it('usuario sin permiso sync_conflicts.resolve no ve botones de acción de resolución', async () => {
    canResolve = false;
    await comp.ngOnInit();
    fixture.detectChanges();

    const actionButtons = fixture.nativeElement.querySelectorAll('.btn-action, .btn-resolver');
    expect(actionButtons.length).toBe(0);
  });
});
