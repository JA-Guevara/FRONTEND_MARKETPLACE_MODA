import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CommerceService } from '../../ventas-pagos/infrastructure/commerce.service';
import { ReservasService } from '../infrastructure/reservas.service';
import { TryOnListService } from '../application/try-on-list.service';
import { NuevaReservaComponent } from './nueva-reserva.component';
import { VariantAvailability } from '../domain/reservas.models';

describe('Nueva reserva para probar prendas', () => {
  beforeEach(() => {
    sessionStorage.removeItem('fs-try-on-list');
  });
  function disponibilidad(variant: string, available: boolean): VariantAvailability {
    return {
      variant_id: variant,
      available,
      quantity: available ? 3 : 0,
      requested: 1,
      size: 'M',
      color: 'Arena',
      product: 'Camisa',
      reason: available ? null : 'Sin unidades en esta sucursal.',
    };
  }
  async function setup() {
    const commerce = { branches: vi.fn().mockResolvedValue([{ id: 'b1', name: 'Centro' }]) } as unknown as CommerceService;
    const reservas = {
      availability: vi.fn().mockResolvedValue([disponibilidad('v1', true)]),
      create: vi.fn().mockResolvedValue({ id: 'r1', status: 'pending' }),
    } as unknown as ReservasService;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CommerceService, useValue: commerce },
        { provide: ReservasService, useValue: reservas },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new NuevaReservaComponent());
    await Promise.resolve();
    return { component, reservas, tryOn: TestBed.inject(TryOnListService) };
  }
  it('no deja confirmar sin sucursal, horario futuro ni disponibilidad', async () => {
    const { component, tryOn } = await setup();
    expect(component.canConfirm()).toBe(false);
    tryOn.add({
      variant_id: 'v1',
      product_id: 'p1',
      name: 'Camisa',
      sku: 'SKU',
      size: 'M',
      color: 'Arena',
      image_url: null,
      quantity: 1,
    });
    expect(component.canConfirm()).toBe(false);
  });
  it('consulta disponibilidad con las cantidades pedidas y habilita confirmar', async () => {
    const { component, tryOn, reservas } = await setup();
    tryOn.add({
      variant_id: 'v1',
      product_id: 'p1',
      name: 'Camisa',
      sku: 'SKU',
      size: 'M',
      color: 'Arena',
      image_url: null,
      quantity: 2,
    });
    component.branchId = 'b1';
    await component.onBranchChange();
    expect(reservas.availability).toHaveBeenCalledWith('b1', expect.any(Array));
    expect(component.queryState()).toBe('idle');
    expect(component.statusOf('v1')?.available).toBe(true);
  });
  it('descartar la respuesta de una consulta anterior (respuestas obsoletas)', async () => {
    const { component, tryOn, reservas } = await setup();
    tryOn.add({
      variant_id: 'v1',
      product_id: 'p1',
      name: 'Camisa',
      sku: 'SKU',
      size: 'M',
      color: 'Arena',
      image_url: null,
      quantity: 1,
    });
    let resolver!: (v: VariantAvailability[]) => void;
    (reservas.availability as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise((resolve) => (resolver = resolve)),
    );
    component.branchId = 'b1';
    const primera = component.onBranchChange();
    (reservas.availability as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      disponibilidad('v1', true),
    ]);
    // La selección cambió: se dispara una consulta nueva que sí se resuelve.
    await component.onBranchChange();
    resolver([disponibilidad('v1', false)]);
    await primera;
    await Promise.resolve();
    // La primera respuesta llegó después de la nueva: no la pisa.
    expect(component.availability()[0]?.available).toBe(true);
    expect(component.queryState()).toBe('idle');
  });
  it('envía cliente, horario y clave idempotente, y navega con la reserva creada', async () => {
    const { component, tryOn, reservas } = await setup();
    tryOn.add({
      variant_id: 'v1',
      product_id: 'p1',
      name: 'Camisa',
      sku: 'SKU',
      size: 'M',
      color: 'Arena',
      image_url: null,
      quantity: 1,
    });
    component.branchId = 'b1';
    component.scheduledAt = '2099-01-01T10:00';
    await component.onBranchChange();
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await component.submit();
    expect(reservas.create).toHaveBeenCalledWith(
      'b1',
      expect.any(String),
      expect.any(Array),
      '',
      expect.any(String),
    );
    expect(nav).toHaveBeenCalledWith(['/mi-cuenta/reservas'], {
      queryParams: { nueva: 'r1' },
    });
    expect(tryOn.items()).toEqual([]);
  });
});
