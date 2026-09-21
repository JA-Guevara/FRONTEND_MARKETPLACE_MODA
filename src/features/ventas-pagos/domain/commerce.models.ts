export interface CartItem {
  variant_id: string;
  product_id: string;
  name: string;
  sku: string;
  size: string;
  color: string;
  image_url: string | null;
  unit_price: string;
  quantity: number;
  available: number;
  line_total: string;
}
export interface Cart {
  items: CartItem[];
  subtotal?: string;
  discount_total?: string;
  discounts?: { promotion_id: string; name: string; code: string | null; type: string; amount: string; message?: string | null }[];
  coupon_code?: string | null;
  total: string;
  currency: string;
}
export interface Branch {
  id: string;
  name: string;
  address: string;
}
/** Dirección guardada en el perfil del cliente. */
export interface SavedAddress {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  city: string;
  postal_code: string | null;
  country: string;
  reference: string | null;
  is_default: boolean;
}
export interface DeliveryAddress {
  recipient: string;
  phone: string;
  line1: string;
  city: string;
  country: string;
  postal_code?: string;
}
export interface Order {
  id: string;
  number: string;
  customer_email: string;
  branch_id: string;
  /** 'web' o 'pos': una venta de caja se registra en la misma tabla. */
  sales_channel?: string;
  status: string;
  payment_status: string;
  payment_method: string;
  payment_reference: string | null;
  total: string;
  subtotal?: string;
  discount_total?: string;
  discounts?: { name: string; code: string | null; type: string; amount: string }[];
  currency: string;
  address: DeliveryAddress;
  items: CartItem[];
  tracking: { status: string; note: string; date: string }[];
  carrier: string | null;
  tracking_number: string | null;
  created_at: string;
  /** Solo en la bandeja de gestión: hay una devolución sin resolver. */
  has_open_return?: boolean;
}
/** Devolución de prendas de un pedido entregado (CU19). */
export interface OrderReturn {
  id: string;
  order_id: string;
  branch_id: string;
  status: 'requested' | 'approved' | 'rejected' | 'completed';
  reason: string;
  items: CartItem[];
  refund_amount: string;
  currency: string;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  // Contexto que agrega la bandeja de gestión: una devolución suelta no se
  // puede resolver sin saber de qué pedido y de quién viene.
  order_number?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  branch_name?: string | null;
  sales_channel?: string | null;
}
/** Qué puede devolver el cliente de un pedido, y si no puede, por qué. */
export interface ReturnAvailability {
  can_request: boolean;
  reason: string | null;
  /** Unidades que quedan por devolver, por variante. */
  units: Record<string, number>;
  returns: OrderReturn[];
}
/** Punto de caja de una sucursal. */
export interface CashPoint {
  id: string;
  code: string;
  name: string;
  branch_id: string;
}
/** Venta encontrada en el mostrador para atender una devolución (CU19). */
export interface PosLookup {
  order: Order;
  can_request: boolean;
  reason: string | null;
  /** Unidades que quedan por devolver, por variante. */
  units: Record<string, number>;
  returns: OrderReturn[];
}
export interface RecommendedProduct {
  id: string;
  slug: string;
  name: string;
  base_price: string;
  image_url: string | null;
  category: string;
}
export const commerceLabel = (value: string): string =>
  ({
    pending_payment: 'Pendiente de pago',
    paid: 'Pagado',
    processing: 'En preparación',
    shipped: 'En camino',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
    expired: 'Vencido',
    pending: 'Pendiente',
    stripe: 'Tarjeta · Stripe',
    manual: 'Pago coordinado',
    cash: 'Efectivo',
    qr: 'Pago con QR',
    card: 'Tarjeta en el local',
    transfer: 'Transferencia',
    requested: 'Devolución solicitada',
    approved: 'Devolución aprobada',
    rejected: 'Devolución rechazada',
    completed: 'Devolución cerrada',
  })[value] || value;
