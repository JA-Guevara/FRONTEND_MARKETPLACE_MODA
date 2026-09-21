import { Entity } from '../../../shared/models';

/** Recurso del probador preparado a partir de la foto del catálogo (plan de
 * evolución, Fase 1). Un recurso dudoso no se publica solo: queda en revisión
 * hasta que el administrador lo aprueba o lo descarta. */
export interface RecursoTryOn extends Entity {
  product_id: string;
  color_id: string;
  enabled: boolean;
  mode?: string;
  source_image_url: string;
  transparent_url?: string | null;
  mask_url?: string | null;
  preview_url?: string | null;
  model_3d_url?: string | null;
  garment_type?: string | null;
  body_region?: string | null;
  anchor_points?: Record<string, unknown> | null;
  ai_status: string;
  ai_metadata?: Record<string, unknown> | null;
  ai_error?: string | null;
  quality_score?: number | null;
  quality_reason?: string | null;
  reviewed_by?: string | null;
}

/** Resumen de la preparación masiva (POST /vestidor/admin/bulk-prepare). */
export interface PreparacionMasivaResult {
  processed: number;
  ready: number;
  review: number;
  failed: number;
  errors: number;
  details: Record<string, unknown>[];
}

export const RECURSO_ESTADO_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  ready: 'Listo para el vestidor',
  review: 'Esperando revisión',
  failed: 'Necesita otra foto',
  manual: 'Ajustado a mano',
};

export function recursoEstadoLabel(status: string): string {
  return RECURSO_ESTADO_LABEL[status] || status;
}

/** Regiones del cuerpo sobre las que puede trabajar el probador, en el mismo
 * orden y con las mismas claves que espera PATCH /vestidor/admin/assets/{id}. */
export const REGIONES_CUERPO: { id: string; label: string }[] = [
  { id: 'upper_body', label: 'Torso y brazos' },
  { id: 'lower_body', label: 'Cadera y piernas' },
  { id: 'full_body', label: 'Cuerpo completo' },
  { id: 'feet', label: 'Pies y calzado' },
];

export function cuerpoRegionLabel(region: string): string {
  return REGIONES_CUERPO.find((r) => r.id === region)?.label || region;
}