export type { Product, Entity, Page } from '../../../shared/models';
import type { Entity } from '../../../shared/models';

/** Criterio único de disponibilidad del probador: la prenda tiene una imagen
 * para superponer (image_overlay) activa. Lo usan catálogo, ficha y probador. */
export function hasVestidor(product: { ar_assets?: Entity[] }): boolean {
  return (product.ar_assets || []).some(
    (a) => a['is_active'] && a['asset_type'] === 'image_overlay',
  );
}

/** Borrador de prenda extraído por IA a partir de un pedido en lenguaje
 * natural (POST /catalog/admin/products/draft). No crea nada: el admin lo
 * revisa y confirma. */
export interface ProductDraft {
  available: boolean;
  name: string;
  base_price: number;
  category_id: string | null;
  category_name: string;
  brand: string | null;
  gender: string | null;
  description: string;
  matched: boolean;
}
/** Cuerpo mínimo para crear una prenda (POST /catalog/admin/products): sin
 * variantes/imágenes iniciales, se completan después en el editor. */
export interface ProductDraftInput {
  name: string;
  description: string;
  base_price: number;
  category_id: string;
  brand?: string | null;
  gender?: string | null;
}
