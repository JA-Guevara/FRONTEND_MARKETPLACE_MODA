import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { StockPageComponent } from './stock-page.component';
import { CommerceService } from '../infrastructure/commerce.service';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { CartItem } from '../domain/commerce.models';

describe('StockPageComponent · CU-13 movimientos de inventario', () => {
  const item = { variant_id: 'v1', name: 'Blusa', sku: 'BL-1', size: 'M', color: 'Rojo', available: 2 } as CartItem;
  let commerce: { branches: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn> };
  let readOnly = false;

  function create() {
    TestBed.configureTestingModule({
      imports: [StockPageComponent],
      providers: [
        { provide: CommerceService, useValue: commerce },
        { provide: SessionService, useValue: { can: () => true, readOnly: () => readOnly } },
      ],
    });
    const fixture = TestBed.createComponent(StockPageComponent);
    fixture.componentInstance.branch = 'b1';
    return fixture;
  }

  beforeEach(() => {
    readOnly = false;
    commerce = {
      branches: vi.fn().mockResolvedValue([{ id: 'b1', name: 'Centro' }]),
      get: vi.fn((path: string) =>
        Promise.resolve(
          path === '/admin/stock'
            ? [item]
            : [{ id: 'm1', variant_id: 'v1', delta: 5, quantity_before: 2, quantity_after: 7, kind: 'receipt', reason: 'Compra', reference: null, actor_email: 'a@demo.test', created_at: '2026-11-07T10:00:00' }],
        ),
      ),
      write: vi.fn().mockResolvedValue({ quantity: 7 }),
    };
  });

  it('registra una entrada con POST y recarga el kardex', async () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.openMovement(item);
    c.movement = { kind: 'receipt', quantity: 5, reason: 'Compra a proveedor', reference: 'F-12' };
    await c.registerMovement();
    expect(commerce.write).toHaveBeenCalledWith('POST', '/admin/stock/v1/movements', {
      branch_id: 'b1', kind: 'receipt', quantity: 5, reason: 'Compra a proveedor', reference: 'F-12',
    });
    expect(commerce.get).toHaveBeenCalledWith('/admin/stock/movements', { branch_id: 'b1' });
    expect(c.movementItem()).toBeNull();
    expect(c.message()).toContain('Saldo actual: 7');
    expect(c.movements()[0].kind).toBe('receipt');
    expect(c.kindLabel('issue')).toBe('Salida');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Historial reciente');
  });

  it('muestra un mensaje claro ante 409 de stock insuficiente y conserva el diálogo', async () => {
    commerce.write.mockRejectedValue(
      new HttpErrorResponse({ status: 409, error: { error: { message: 'Stock insuficiente.' } } }),
    );
    const c = create().componentInstance;
    c.openMovement(item);
    c.movement = { kind: 'issue', quantity: 10, reason: 'Merma', reference: '' };
    await c.registerMovement();
    expect(c.movementItem()).toBe(item);
    expect(c.movementError()).toContain('Stock insuficiente');
    expect(c.movementError()).toContain('solo hay 2 disponibles');
    expect(c.busy()).toBe(false);
  });

  it('valida cantidad y motivo sin llamar al backend', async () => {
    const c = create().componentInstance;
    c.openMovement(item);
    c.movement = { kind: 'receipt', quantity: 0, reason: 'Compra', reference: '' };
    await c.registerMovement();
    expect(c.movementError()).toContain('cantidad entera');
    c.movement = { kind: 'receipt', quantity: 3, reason: 'x', reference: '' };
    await c.registerMovement();
    expect(c.movementError()).toContain('motivo');
    expect(commerce.write).not.toHaveBeenCalled();
  });

  it('en modo solo lectura no abre el registro de movimientos', () => {
    readOnly = true;
    const c = create().componentInstance;
    c.openMovement(item);
    expect(c.movementItem()).toBeNull();
  });
});
