import { TestBed } from '@angular/core/testing';
import { AdminReturnsComponent } from './admin-returns.component';
import { CommerceService } from '../infrastructure/commerce.service';
import { SessionService } from '../../auth/application/session.service';
import { OrderReturn } from '../domain/commerce.models';

function devolucion(cambios: Partial<OrderReturn> = {}): OrderReturn {
  return {
    id: 'aaaabbbb-cccc-dddd-eeee-ffff00001111',
    order_id: 'o1',
    branch_id: 'b1',
    status: 'requested',
    reason: 'La talla no me quedó bien.',
    items: [
      {
        variant_id: 'v1', product_id: 'p1', name: 'Polera básica', sku: 'POL-001', size: 'M',
        color: 'Negro', image_url: null, unit_price: '100.00', quantity: 1, available: 3,
        line_total: '100.00',
      },
    ],
    refund_amount: '100.00',
    currency: 'BOB',
    resolution_note: null,
    resolved_at: null,
    created_at: '2026-09-18T10:00:00Z',
    order_number: 'FS-8A3C21',
    customer_email: 'ana@example.test',
    customer_name: 'Ana Perez',
    branch_name: 'Sucursal Centro',
    ...cambios,
  } as OrderReturn;
}

async function setup(filas: OrderReturn[] = [devolucion()]) {
  const api = {
    adminReturns: vi.fn().mockResolvedValue(filas),
    branches: vi.fn().mockResolvedValue([{ id: 'b1', name: 'Sucursal Centro', address: 'Av. 1' }]),
    resolveReturn: vi.fn().mockResolvedValue({}),
  };
  TestBed.configureTestingModule({
    imports: [AdminReturnsComponent],
    providers: [
      { provide: CommerceService, useValue: api },
      { provide: SessionService, useValue: { can: () => true } },
    ],
  });
  const fixture = TestBed.createComponent(AdminReturnsComponent);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, componente: fixture.componentInstance };
}

describe('Bandeja de devoluciones', () => {
  it('muestra de qué pedido y de quién es cada devolución', async () => {
    const { fixture } = await setup();
    const texto = fixture.nativeElement.textContent;
    // Sin esto la bandeja muestra un código suelto que no se puede gestionar.
    expect(texto).toContain('FS-8A3C21');
    expect(texto).toContain('Ana Perez');
    expect(texto).toContain('ana@example.test');
    expect(texto).toContain('Sucursal Centro');
  });

  it('distingue una devolución atendida en caja', async () => {
    const { fixture } = await setup([devolucion({ sales_channel: 'pos' })]);
    expect(fixture.nativeElement.textContent).toContain('Caja');
  });

  it('resume cuántas esperan decisión y cuánto dinero comprometen', async () => {
    const { fixture, componente } = await setup([
      devolucion({ id: 'r1', status: 'requested', refund_amount: '100.00' }),
      devolucion({ id: 'r2', status: 'approved', refund_amount: '250.50' }),
      devolucion({ id: 'r3', status: 'completed', refund_amount: '999.00' }),
    ]);
    expect(componente.pendientes().length).toBe(2);
    expect(componente.comprometido()).toBe(350.5);
    expect(fixture.nativeElement.textContent).toContain('350.50');
  });

  it('una bandeja sin pendientes no muestra el aviso', async () => {
    const { fixture } = await setup([devolucion({ status: 'completed' })]);
    expect(fixture.nativeElement.textContent).not.toContain('sin resolver');
  });

  it('manda los filtros al servidor', async () => {
    const { api, componente } = await setup();
    componente.filtro.set('requested');
    componente.sucursal.set('b1');
    componente.consulta = 'FS-8A3C21';
    componente.filtrar();

    const [filtros] = api.adminReturns.mock.calls.at(-1)!;
    expect(filtros).toEqual({ status: 'requested', branch_id: 'b1', q: 'FS-8A3C21' });
  });

  it('un filtro nuevo vuelve a la primera página', async () => {
    const { api, componente } = await setup();
    componente.page(1);
    expect(componente.offset()).toBe(50);

    componente.filtro.set('approved');
    componente.filtrar();
    expect(componente.offset()).toBe(0);
    expect(api.adminReturns.mock.calls.at(-1)![1]).toBe(0);
  });

  it('solo ofrece las acciones que el estado permite', async () => {
    const { componente } = await setup();
    expect(componente.acciones(devolucion({ status: 'requested' })).map((a) => a.status)).toEqual([
      'approved',
      'rejected',
    ]);
    expect(componente.acciones(devolucion({ status: 'approved' })).map((a) => a.status)).toEqual([
      'completed',
      'rejected',
    ]);
    // Una devolución cerrada ya no se toca.
    expect(componente.acciones(devolucion({ status: 'completed' }))).toEqual([]);
    expect(componente.acciones(devolucion({ status: 'rejected' }))).toEqual([]);
  });
});
