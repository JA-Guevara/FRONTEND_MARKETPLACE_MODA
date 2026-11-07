import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CambiosPageComponent } from './cambios-page.component';
import { ExchangesApi } from '../infrastructure/exchanges.api';
import { ExchangeCalculation, ExchangeDetail, ExchangeOrderLookup } from '../domain/cambios.models';

describe('CambiosPageComponent', () => {
  let comp: CambiosPageComponent;
  let mockApi: Partial<ExchangesApi>;

  const mockOrder: ExchangeOrderLookup = {
    order_id: 'ord-123',
    order_number: 'ORD-001',
    purchase_date: '2026-11-01T10:00:00Z',
    deadline_days: 15,
    remaining_days: 12,
    can_exchange: true,
    customer_email: 'cliente@example.com',
    branch_id: 'branch-1',
    items: [
      {
        variant_id: 'var-orig-1',
        product_name: 'Vestido Lino',
        size: 'M',
        color: 'Rojo',
        original_quantity: 1,
        already_exchanged_quantity: 0,
        available_for_exchange: 1,
        unit_price: 150,
        subtotal: 150,
      },
    ],
  };

  const mockCalc: ExchangeCalculation = {
    total_returned_value: 150,
    total_delivered_value: 180,
    difference_amount: 30,
    tipo_diferencia: 'PAGO_CLIENTE',
    lineas: [],
  };

  const mockExchange: ExchangeDetail = {
    id: 'ex-999',
    tenant_id: 't-1',
    branch_id: 'branch-1',
    original_order_id: 'ord-123',
    original_order_number: 'ORD-001',
    difference_amount: 30,
    payment_method: 'cash',
    status: 'COMPLETED',
    created_at: '2026-11-04T12:00:00Z',
    lines: [],
  };

  beforeEach(() => {
    mockApi = {
      getPolicy: vi.fn().mockResolvedValue({ tenant_id: 't-1', exchange_days: 15 }),
      options: vi.fn().mockResolvedValue([]),
      lookupOrder: vi.fn().mockResolvedValue(mockOrder),
      calculate: vi.fn().mockResolvedValue(mockCalc),
      executeExchange: vi.fn().mockResolvedValue(mockExchange),
      listExchanges: vi
        .fn()
        .mockResolvedValue({ items: [mockExchange as any], total: 1, page: 1, page_size: 20 }),
    };

    comp = new CambiosPageComponent(mockApi as ExchangesApi);
  });

  it('inicializa y carga política de cambio', async () => {
    await comp.ngOnInit();
    expect(comp.policy()?.exchange_days).toBe(15);
  });

  it('busca una orden y muestra sus prendas disponibles para cambio', async () => {
    comp.busquedaOrden = 'ORD-001';
    await comp.buscarOrden();
    expect(mockApi.lookupOrder).toHaveBeenCalledWith('ORD-001');
    expect(comp.orden()).toEqual(mockOrder);
    expect(comp.orden()?.remaining_days).toBe(12);
  });

  it('permite seleccionar prenda para devolución y calcular diferencia', async () => {
    comp.orden.set(mockOrder);
    comp.seleccionarPrendaDevolucion(mockOrder.items[0]);
    expect(comp.prendaDevuelta()?.variant_id).toBe('var-orig-1');

    comp.nuevaVarianteId = 'var-nueva-2';
    comp.cantidadEntregar = 1;
    comp.nuevoPrecioUnitario = 180;

    await comp.calcularDiferencia();
    expect(mockApi.calculate).toHaveBeenCalled();
    expect(comp.calculo()?.difference_amount).toBe(30);
    expect(comp.calculo()?.tipo_diferencia).toBe('PAGO_CLIENTE');
  });

  it('ejecuta el cambio atómico con éxito y muestra el comprobante', async () => {
    comp.orden.set(mockOrder);
    comp.seleccionarPrendaDevolucion(mockOrder.items[0]);
    comp.nuevaVarianteId = 'var-nueva-2';
    comp.cantidadEntregar = 1;
    comp.nuevoPrecioUnitario = 180;
    comp.calculo.set(mockCalc);
    comp.metodoPago = 'cash';
    comp.efectivoRecibido = 50;

    await comp.ejecutarCambio();
    expect(mockApi.executeExchange).toHaveBeenCalled();
    expect(comp.cambioCompletado()?.id).toBe('ex-999');
    expect(comp.mensajeExito()).toContain('éxito');
  });

  it('carga el historial de cambios', async () => {
    await comp.cargarHistorial();
    expect(comp.tabActiva()).toBe('historial');
    expect(comp.historial()).toHaveLength(1);
  });
});
