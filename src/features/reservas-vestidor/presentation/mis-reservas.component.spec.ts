import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { ReservasService } from '../infrastructure/reservas.service';
import { MisReservasComponent } from './mis-reservas.component';
import { Reservation } from '../domain/reservas.models';

function reserva(id = 'r1'): Reservation {
  return {
    id,
    user_id: 'u1',
    branch_id: 'b1',
    status: 'pending',
    scheduled_at: '2026-09-20T15:00:00',
    items: [
      {
        variant_id: 'v1',
        product_id: 'p1',
        name: 'Camisa',
        sku: 'QA',
        size: 'M',
        color: 'Arena',
        image_url: null,
        quantity: 1,
      },
    ],
    notes: null,
    tracking: [],
    created_at: '2026-09-15T12:00:00',
    updated_at: '2026-09-15T12:00:00',
  };
}

describe('Mis reservas', () => {
  function setup(query: Record<string, string>, api: Partial<ReservasService> = {}) {
    const rx = {
      mine: vi.fn().mockResolvedValue({ items: [reserva()], total: 1, page: 1, page_size: 20, pages: 1 }),
      get: vi.fn().mockResolvedValue(reserva()),
      cancel: vi.fn().mockResolvedValue(reserva()),
      ...api,
    } as unknown as ReservasService;
    TestBed.configureTestingModule({
      providers: [
        { provide: ReservasService, useValue: rx },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (k: string) => query[k] ?? null } } },
        },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new MisReservasComponent());
    return { component, api: rx };
  }
  it('lista sin depender del parámetro agendada', async () => {
    const { component } = setup({});
    await component.load();
    expect(component.reservations().length).toBe(1);
    expect(component.confirmed()).toBe(false);
    expect(component.query).toBe('');
  });
  it('muestra el éxito solo cuando el backend devuelve la reserva recién creada', async () => {
    const { component } = setup({ nueva: 'r1' });
    await component.load();
    expect(component.confirmed()).toBe(true);
  });
  it('un parámetro inventado no fabrica una confirmación', async () => {
    const { component } = setup({ nueva: 'falso' }, { get: vi.fn().mockRejectedValue(new Error('no existe')) });
    await component.load();
    expect(component.query).toBe('falso');
    expect(component.confirmed()).toBe(false);
  });
  it('conserva los datos y avisa cuando la recarga falla', async () => {
    const { component } = setup(
      {},
      { mine: vi.fn().mockRejectedValue(new Error('Sin conexión')) },
    );
    component.reservations.set([reserva()]);
    await component.load();
    expect(component.error()).toBeTruthy();
    expect(component.reservations().length).toBe(1);
    expect(component.confirmed()).toBe(false);
  });
});