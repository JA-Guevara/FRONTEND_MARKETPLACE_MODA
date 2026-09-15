export type { Product, Entity, Page } from '../../../shared/models';

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
