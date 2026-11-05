export type TipoDescuento = 'percent' | 'fixed' | 'clearance' | 'free_shipping';
export type TipoObjetivo = 'PRODUCT' | 'VARIANT' | 'CATEGORY' | 'SEASON' | 'COLLECTION' | 'ALL';
export type CanalOferta = 'online' | 'pos' | 'offline';
export type EstadoOferta = 'vigente' | 'programada' | 'vencida' | 'pausada' | 'agotada';

export interface ObjetivoOferta {
  id?: string;
  target_type: TipoObjetivo;
  target_id?: string | null;
}

export interface Oferta {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  discount_type: TipoDescuento;
  discount_value: number | string;
  minimum_order: number | string;
  customer_scope: 'all' | 'frequent';
  minimum_paid_orders?: number;
  applies_online: boolean;
  applies_pos: boolean;
  applies_offline: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  uses_count: number;
  per_user_limit: number | null;
  is_active: boolean;
  targets?: ObjetivoOferta[];
}

export interface PrevisualizacionItem {
  variant_id: string;
  product_name: string;
  variant_sku?: string;
  regular: number;
  final: number;
  discount_applied: number;
}

export interface PrevisualizacionOferta {
  items: PrevisualizacionItem[];
  errors: string[];
}

/**
 * Determina el estado operacional de una oferta según vigencia, límite y pausa.
 */
export function estadoOferta(oferta: Oferta, ahora: Date = new Date()): EstadoOferta {
  if (!oferta.is_active) {
    return 'pausada';
  }
  if (oferta.max_uses !== null && oferta.max_uses !== undefined && oferta.uses_count >= oferta.max_uses) {
    return 'agotada';
  }
  const timestamp = ahora.getTime();
  if (oferta.starts_at) {
    const inicio = new Date(oferta.starts_at).getTime();
    if (timestamp < inicio) {
      return 'programada';
    }
  }
  if (oferta.ends_at) {
    const fin = new Date(oferta.ends_at).getTime();
    if (timestamp > fin) {
      return 'vencida';
    }
  }
  return 'vigente';
}

/**
 * Valida si la oferta está disponible para aplicarse en un momento dado.
 */
export function esVigente(oferta: Oferta, ahora: Date = new Date()): boolean {
  return estadoOferta(oferta, ahora) === 'vigente';
}

/**
 * Valida si la oferta aplica a un canal específico.
 */
export function aplicaACanal(oferta: Oferta, canal: CanalOferta): boolean {
  switch (canal) {
    case 'online':
      return oferta.applies_online;
    case 'pos':
      return oferta.applies_pos;
    case 'offline':
      return oferta.applies_offline;
    default:
      return false;
  }
}

/**
 * Calcula el precio unitario final aplicando una oferta sobre el precio regular.
 */
export function calcularPrecio(precioBase: number, oferta: Oferta): number {
  if (precioBase <= 0) return 0;
  const valor = Number(oferta.discount_value) || 0;

  let final = precioBase;
  switch (oferta.discount_type) {
    case 'percent': {
      const porcentaje = Math.min(Math.max(valor, 0), 100);
      final = precioBase * (1 - porcentaje / 100);
      break;
    }
    case 'fixed': {
      final = Math.max(0, precioBase - valor);
      break;
    }
    case 'clearance': {
      final = Math.max(0, valor);
      break;
    }
    case 'free_shipping':
    default: {
      final = precioBase;
      break;
    }
  }
  return Math.round(final * 100) / 100;
}
