export interface Plan {
  id: string;
  code: string;
  name: string;
  reference_price: number | string;
  duration_days: number;
  is_active: boolean;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  tenants_count: number;
}
export interface PlanDraft {
  code: string;
  name: string;
  reference_price: number;
  duration_days: number;
  features: Record<string, boolean>;
  limits: Record<string, number>;
}
export interface FeatureCatalogItem {
  code: string;
  label: string;
  kind: 'feature' | 'limit';
}
export interface PlanSaveResult {
  plan: Plan;
  exceeded_tenants: string[];
}
export interface MatrixRow {
  code: string;
  label: string;
  values: (boolean | number | null)[];
}
export function validatePlanDraft(d: Partial<PlanDraft>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!/^[A-Z][A-Z0-9_]{2,29}$/.test(d.code ?? ''))
    errors['code'] = 'Usa mayúsculas, números y guion bajo (3–30 caracteres).';
  if (!d.name?.trim()) errors['name'] = 'Ingresa el nombre del plan.';
  if (!Number.isInteger(d.duration_days) || d.duration_days! < 1 || d.duration_days! > 366)
    errors['duration_days'] = 'La duración debe estar entre 1 y 366 días.';
  if (
    d.reference_price === undefined ||
    !Number.isFinite(d.reference_price) ||
    d.reference_price < 0
  )
    errors['reference_price'] = 'El precio no puede ser negativo.';
  if (
    !d.limits?.['max_active_branches'] ||
    Object.values(d.limits).some((x) => !Number.isInteger(x) || x <= 0)
  )
    errors['max_active_branches'] = 'Los límites deben ser números enteros positivos.';
  return errors;
}
export function featureMatrix(plans: Plan[], catalog: FeatureCatalogItem[]): MatrixRow[] {
  return catalog.map((c) => ({
    code: c.code,
    label: c.label,
    values: plans.map((p) =>
      c.kind === 'limit' ? (p.limits[c.code] ?? null) : (p.features[c.code] ?? false),
    ),
  }));
}
export const FEATURE_LABELS: Record<string, string> = {
  products: 'Gestión de productos',
  sales: 'Ventas y caja',
  reservations: 'Reservas de vestidor',
  offline: 'Operación sin conexión',
  conventional_reports: 'Reportes convencionales',
  ai_reports: 'Reportes con IA',
  ml_analytics: 'Analítica predictiva',
  max_active_branches: 'Sucursales activas',
};
