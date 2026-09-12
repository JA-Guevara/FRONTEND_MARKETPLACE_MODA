import { Injectable, signal } from '@angular/core';
import { TryOnEntry } from '../domain/reservas.models';

const STORAGE_KEY = 'fs-try-on-list';

function readStorage(): TryOnEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TryOnEntry[]) : [];
  } catch {
    return [];
  }
}

/** Lista, del lado del navegador, de las prendas que el cliente quiere
 * probarse en sucursal antes de agendar una visita (RF09: reservar varias
 * prendas). Se persiste en sessionStorage; el backend solo ve la lista final
 * cuando el cliente confirma la visita en /reservations. */
@Injectable({ providedIn: 'root' })
export class TryOnListService {
  items = signal<TryOnEntry[]>(readStorage());
  private persist() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.items()));
    } catch {
      /* almacenamiento no disponible; la lista sigue en memoria */
    }
  }
  add(entry: TryOnEntry) {
    const existing = this.items().find((i) => i.variant_id === entry.variant_id);
    if (existing) {
      this.items.update((list) =>
        list.map((i) =>
          i.variant_id === entry.variant_id ? { ...i, quantity: i.quantity + entry.quantity } : i,
        ),
      );
    } else {
      this.items.update((list) => [...list, entry]);
    }
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
