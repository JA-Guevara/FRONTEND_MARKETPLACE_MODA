export type { Product, Entity, Page } from '../../../shared/models';
import type { Entity } from '../../../shared/models';

/**
 * Criterio único de disponibilidad del probador.
 *
 * Antes exigía una imagen `image_overlay` cargada a mano, y como ninguna prenda
 * del catálogo la tenía, el probador aparecía siempre como no disponible. Hoy la
 * prenda se dibuja sobre el cuerpo a partir de su tipo y color, así que toda
 * prenda publicada con variantes se puede probar; el recurso preparado, cuando
 * existe, solo mejora la vista mostrando la foto real.
 */
export function hasVestidor(product: { ar_assets?: Entity[]; variants?: Entity[] }): boolean {
  return (product.variants || []).some((v) => v['is_active'] !== false);
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
