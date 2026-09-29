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
    const commerce = { branches: vi.fn().mockResolvedValue([
      { id: 'b1', name: 'Las Brisas' },
      { id: 'b2', name: 'Costanera' },
    ]) } as unknown as CommerceService;
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
    const fixture = TestBed.createComponent(NuevaReservaComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { component: fixture.componentInstance, fixture, reservas, tryOn: TestBed.inject(TryOnListService) };
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
  it('propone un horario con tiempo para completar el formulario y avisa si venció', async () => {
    const { component } = await setup();
    const minutesAhead = (new Date(component.scheduledAt).getTime() - Date.now()) / 60000;
    expect(minutesAhead).toBeGreaterThan(28);
    expect(minutesAhead).toBeLessThan(31);
    component.scheduledAt = '2000-01-01T10:00';
    expect(component.scheduleExpired()).toBe(true);
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
  it('muestra sin stock en una sucursal y habilita reservar al elegir otra con stock', async () => {
    const { component, fixture, tryOn, reservas } = await setup();
    tryOn.add({
      variant_id: 'v1', product_id: 'p1', name: 'Polera POLO', sku: 'SKU',
      size: 'XS', color: 'Azul marino', image_url: null, quantity: 1,
    });
    expect(component.branchId).toBe('');

    (reservas.availability as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      disponibilidad('v1', false),
    ]);
    component.branchId = 'b1';
    await component.onBranchChange();
    fixture.detectChanges();
    const submit = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(fixture.nativeElement.textContent).toContain('Sin unidades en esta sucursal');
    expect(submit.disabled).toBe(true);

    (reservas.availability as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      disponibilidad('v1', true),
    ]);
    component.branchId = 'b2';
    await component.onBranchChange();
    fixture.detectChanges();
    expect(reservas.availability).toHaveBeenLastCalledWith('b2', expect.any(Array));
    expect(fixture.nativeElement.textContent).toContain('Disponible');
    expect(submit.disabled).toBe(false);
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
