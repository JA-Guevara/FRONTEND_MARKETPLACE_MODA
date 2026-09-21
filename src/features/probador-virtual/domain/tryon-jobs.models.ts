/** Trabajo de foto IA realista del probador (plan de evolución, Fase 3).
 *
 * La creación vuelve en `queued`; la generación corre al consultar el estado
 * (`GET /tryon-ai/jobs/{id}`) y la foto se borra del servidor al cancelarla,
 * expirar o eliminarla. */
export interface TryOnJob {
  id: string;
  product_id: string;
  color_id: string | null;
  garment_type?: string | null;
  body_region?: string | null;
  status: string;
  provider?: string | null;
  result_url?: string | null;
  error?: string | null;
  expires_at?: string | null;
  created_at: string;
  is_simulation: boolean;
  disclaimer?: string;
}

/** Estados vivos del trabajo: todavía puede progresar o fallar. */
export const TRYON_ACTIVOS = new Set(['queued', 'processing']);

export function tryonActivo(job: { status: string }): boolean {
  return TRYON_ACTIVOS.has(job.status);
}

export const TRYON_ESTADO_LABEL: Record<string, string> = {
  queued: 'En cola',
  processing: 'Generando',
  ready: 'Lista',
  failed: 'Falló',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};

export function tryonEstadoLabel(status: string): string {
  return TRYON_ESTADO_LABEL[status] || status;
}

/** Aviso fijo que acompaña a cada foto IA: la experiencia no se muestra sin
 * aclarar que es una simulación visual y no confirma talla ni ajuste. */
export const TRYON_DISCLAIMER =
  'Esta imagen es una simulación visual generada con IA. No confirma talla, ' +
  'ajuste ni caída física de la prenda.';