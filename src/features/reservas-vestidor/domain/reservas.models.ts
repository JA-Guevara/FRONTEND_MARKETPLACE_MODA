export interface ReservationItem {
  variant_id: string;
  product_id: string;
  name: string;
  sku: string;
  size: string;
  color: string;
  image_url: string | null;
  quantity: number;
}
export interface Reservation {
  id: string;
  user_id: string;
  branch_id: string;
  status: string;
  scheduled_at: string;
  items: ReservationItem[];
  notes: string | null;
  tracking: { status: string; note: string; date: string }[];
  created_at: string;
  updated_at: string;
  /** Campos enriquecidos por el backend administrativo (solo lectura). */
  branch_name?: string | null;
  user_name?: string | null;
  user_email?: string | null;
}
/** Prenda elegida en el catálogo para probar en sucursal, antes de agendar. */
export interface TryOnEntry {
  variant_id: string;
  product_id: string;
  name: string;
  sku: string;
  size: string;
  color: string;
  image_url: string | null;
  quantity: number;
}
export const reservationLabel = (value: string): string =>
  ({
    pending: 'Pendiente de confirmación',
    confirmed: 'Confirmada',
    ready: 'Prendas preparadas',
    attended: 'Atendida',
    cancelled: 'Cancelada',
  })[value] || value;

/** Respuesta de /reservations/availability: si la sucursal alcanza la cantidad. */
export interface VariantAvailability {
  variant_id: string;
  available: boolean;
  quantity: number;
  requested: number;
  size: string | null;
  color: string | null;
  product: string | null;
  reason: string | null;
}

/** Límites compartidos con el backend (RF09/RF10). */
export const MAX_TRYON_ITEMS = 20;
export const MIN_ITEM_QUANTITY = 1;
export const MAX_ITEM_QUANTITY = 10;
