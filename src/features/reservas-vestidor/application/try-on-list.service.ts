import { Injectable, signal } from '@angular/core';
import { TryOnEntry } from '../domain/reservas.models';
import {
  MAX_ITEM_QUANTITY,
  MAX_TRYON_ITEMS,
  MIN_ITEM_QUANTITY,
} from '../domain/reservas.models';

const STORAGE_KEY = 'fs-try-on-list';

function validEntry(value: unknown): value is TryOnEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['variant_id'] === 'string' &&
    typeof v['product_id'] === 'string' &&
    typeof v['name'] === 'string' &&
    typeof v['size'] === 'string' &&
    typeof v['color'] === 'string' &&
    typeof v['quantity'] === 'number' &&
    Number.isFinite(v['quantity'])
  );
}

function readStorage(): TryOnEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validEntry);
  } catch {
    return [];
  }
}

export type TryOnResult =
  | 'added'
  | 'quantity_updated'
  | 'limit_items'
  | 'limit_quantity';

/** Lista, del lado del navegador, de las prendas que el cliente quiere
 * probarse en sucursal antes de confirmar la reserva (RF09: reservar varias
 * prendas). Se persiste en sessionStorage; el backend solo ve la lista final
 * cuando el cliente confirma la reserva en /reservations. */
@Injectable({ providedIn: 'root' })
export class TryOnListService {
  items = signal<TryOnEntry[]>(readStorage());
  /** True si sessionStorage no está disponible; la lista sigue viva en memoria
   * pero no sobrevive a una recarga. Solo se muestra al usuario cuando altera
   * la experiencia, no como detalle interno. */
  memoryOnly = signal(false);
  private persist() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.items()));
      this.memoryOnly.set(false);
    } catch {
      this.memoryOnly.set(true);
    }
  }
  /** Cantidad de tallas/colores distintos, no de unidades ni de "prendas a
   * probar": se usa para el contador de la cabecera y para el límite de 20. */
  get distinctCount() {
    return this.items().length;
  }
  /** Cantidad de unidades solicitadas en total. */
  get totalQuantity() {
    return this.items().reduce((sum, i) => sum + i.quantity, 0);
  }
  canAdd(entry: TryOnEntry): boolean {
    return this.wouldExceed(entry) === null;
  }
  /** Motivo por el cual agregar esta entrada excedería un límite, o null. */
  wouldExceed(entry: TryOnEntry): 'limit_items' | 'limit_quantity' | null {
    const existing = this.items().find((i) => i.variant_id === entry.variant_id);
    if (existing) {
      return existing.quantity + entry.quantity > MAX_ITEM_QUANTITY ? 'limit_quantity' : null;
    }
    return this.items().length >= MAX_TRYON_ITEMS ? 'limit_items' : null;
  }
  add(entry: TryOnEntry): TryOnResult {
    const existing = this.items().find((i) => i.variant_id === entry.variant_id);
    if (existing) {
      const quantity = existing.quantity + entry.quantity;
      if (quantity > MAX_ITEM_QUANTITY) return 'limit_quantity';
      this.items.update((list) =>
        list.map((i) =>
          i.variant_id === entry.variant_id
            ? { ...i, quantity, image_url: entry.image_url || i.image_url }
            : i,
        ),
      );
    } else {
      if (this.items().length >= MAX_TRYON_ITEMS) return 'limit_items';
      this.items.update((list) => [
        ...list,
        { ...entry, quantity: Math.min(Math.max(entry.quantity, MIN_ITEM_QUANTITY), MAX_ITEM_QUANTITY) },
      ]);
    }
    this.persist();
    return existing ? 'quantity_updated' : 'added';
  }
  setQuantity(variant_id: string, quantity: number) {
    const normalized = Math.min(
      Math.max(Math.floor(quantity) || MIN_ITEM_QUANTITY, MIN_ITEM_QUANTITY),
      MAX_ITEM_QUANTITY,
    );
    this.items.update((list) =>
      list.map((i) => (i.variant_id === variant_id ? { ...i, quantity: normalized } : i)),
    );
    this.persist();
  }
  remove(variant_id: string) {
    this.items.update((list) => list.filter((i) => i.variant_id !== variant_id));
    this.persist();
  }
  clear() {
    this.items.set([]);
    this.persist();
  }
}