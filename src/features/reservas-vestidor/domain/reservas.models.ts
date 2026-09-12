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
