import { TestBed } from '@angular/core/testing';
import { TryOnListService } from './try-on-list.service';
import { TryOnEntry } from '../domain/reservas.models';

describe('Lista de prendas para probar en sucursal', () => {
  beforeEach(() => {
    sessionStorage.removeItem('fs-try-on-list');
  });
  function entry(variant: string, quantity = 1): TryOnEntry {
    return {
      variant_id: variant,
      product_id: 'p' + variant,
      name: 'Prenda',
      sku: 'SKU-' + variant,
      size: 'M',
      color: 'Arena',
      image_url: null,
      quantity,
    };
  }
  function make(): { service: TryOnListService } {
    const service = TestBed.runInInjectionContext(() => new TryOnListService());
    return { service };
  }
  it('suma la cantidad al repetir la misma talla y persiste', () => {
    const { service } = make();
    expect(service.add(entry('v1', 2))).toBe('added');
    expect(service.add(entry('v1', 3))).toBe('quantity_updated');
    expect(service.items().length).toBe(1);
    expect(service.items()[0].quantity).toBe(5);
    expect(sessionStorage.getItem('fs-try-on-list')).toContain('"quantity":5');
  });
  it('respeta el máximo de 10 unidades por talla tras la fusión', () => {
    const { service } = make();
    service.add(entry('v1', 10));
    expect(service.wouldExceed(entry('v1', 1))).toBe('limit_quantity');
    expect(service.add(entry('v1', 1))).toBe('limit_quantity');
  });
  it('respeta el máximo de 20 variantes distintas', () => {
    const { service } = make();
    for (let i = 1; i <= 20; i++) service.add(entry('v' + i));
    expect(service.distinctCount).toBe(20);
    expect(service.wouldExceed(entry('v21'))).toBe('limit_items');
    expect(service.add(entry('v21'))).toBe('limit_items');
  });
  it('recorta la cantidad pedida a 1..10', () => {
    const { service } = make();
    service.setQuantity('v1', 99);
    expect(service.items().length).toBe(0);
    service.add(entry('v1', 99));
    expect(service.items()[0].quantity).toBe(10);
    service.setQuantity('v1', 0);
    expect(service.items()[0].quantity).toBe(1);
  });
  it('quita y limpia la selección', () => {
    const { service } = make();
    service.add(entry('v1'));
    service.remove('v1');
    expect(service.items()).toEqual([]);
    service.add(entry('v1'));
    service.clear();
    expect(service.items()).toEqual([]);
    expect(JSON.parse(sessionStorage.getItem('fs-try-on-list')!)).toEqual([]);
  });
  it('sigue viviendo en memoria si el almacenamiento falla, con aviso', () => {
    const original = Storage.prototype.setItem;
    const { service } = make();
    service.add(entry('v1'));
    expect(service.items().length).toBe(1);
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceeded');
    };
    expect(service.add(entry('v2'))).toBe('added');
    expect(service.items().length).toBe(2);
    expect(service.memoryOnly()).toBe(true);
    Storage.prototype.setItem = original;
    service.add(entry('v3'));
    expect(service.memoryOnly()).toBe(false);
  });
});