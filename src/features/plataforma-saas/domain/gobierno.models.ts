export type ModuleLifecycle = 'BORRADOR' | 'BETA' | 'GA' | 'RETIRADO';
export type ModuleKind = 'BASE' | 'ADDON';
export type OverrideMode = 'EXTRA' | 'TRIAL' | 'BLOQUEADO';
export type PermissionScope = 'platform' | 'tenant';
export type ModuleOrigin =
  'PLAN' | 'EXTRA' | 'TRIAL' | 'BLOQUEADO' | 'BASE' | 'SANDBOX' | 'NONE' | 'NO_INCLUIDO';

export interface ModulePermissionSummary {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}

export interface PlatformModule {
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  icon?: string | null;
  kind: ModuleKind;
  lifecycle: ModuleLifecycle;
  depends_on: string[];
  web_routes: string[];
  sort_order: number;
  plans_count: number;
  tenants_count: number;
  permissions_count: number;
  last_preview_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ModuleDetail extends PlatformModule {
  permissions: ModulePermissionSummary[];
  plans: { id: string; code: string; name: string }[];
  active_tenants: { id: string; trade_name: string; slug?: string }[];
  history: {
    id: string;
    action: string;
    description: string;
    created_at: string;
    actor_name?: string | null;
  }[];
}

export interface ModuleUpdate {
  name?: string;
  description?: string;
  category?: string;
  icon?: string;
  lifecycle?: ModuleLifecycle;
  depends_on?: string[];
  web_routes?: string[];
  sort_order?: number;
}

export interface ModuleMatrixPlan {
  id: string;
  code: string;
  name: string;
  modules: Record<string, boolean>;
  limits: Record<string, number>;
}

export interface ModuleMatrixTenant {
  id: string;
  trade_name: string;
  plan_code: string;
  plan_name: string;
  overrides: Record<string, OverrideMode>;
}

export interface ModuleMatrix {
  modules: PlatformModule[];
  plans: ModuleMatrixPlan[];
}

export interface PlanImpact {
  plan_id: string;
  affected_tenants: number;
  affected_users: number;
  modules_added: string[];
  modules_removed: string[];
  permissions_gained: string[];
  permissions_lost: string[];
}

export interface TenantModule {
  id: string | null;
  module_code: string;
  module_name: string;
  kind: ModuleKind;
  lifecycle: ModuleLifecycle;
  effective: boolean;
  origin: ModuleOrigin;
  mode: OverrideMode | null;
  starts_at: string | null;
  expires_at: string | null;
  reason: string | null;
  granted_by_name: string | null;
  is_blocked: boolean;
}

export interface TenantModuleGrant {
  module_code: string;
  mode: OverrideMode;
  days?: number | null;
  reason: string;
}

export interface TenantLimit {
  id: string;
  tenant_id: string;
  limit_code: string;
  value: number;
  expires_at: string | null;
  reason: string;
  created_at: string;
}

export interface TenantLimitDraft {
  limit_code: string;
  value: number;
  days?: number | null;
  reason: string;
}

export interface EffectiveTenantLimit {
  limit_code: string;
  plan_value: number | null;
  effective_value: number | null;
  usage: number;
  source: 'PLAN' | 'EMPRESA';
  subscription_end_date: string | null;
  override_active: boolean;
  override: TenantLimit | null;
}

export interface GlobalUserCreate {
  kind: 'tenant' | 'platform';
  tenant_id?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  role_ids: string[];
  branch_ids?: string[] | null;
  access?: 'invite' | 'temporary_password';
}

export interface GlobalUserUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
  is_active?: boolean;
}

export interface PlatformRoleDraft {
  code: string;
  name: string;
  description?: string | null;
  permission_codes: string[];
}

export interface PermissionCatalogItem extends ModulePermissionSummary {
  module: string;
  scope: PermissionScope;
  is_active: boolean;
}

export interface TenantRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  permissions: (ModulePermissionSummary & { is_active?: boolean })[];
}

export interface TenantModuleOverride {
  id: string;
  tenant_id: string;
  module_code: string;
  module_name: string;
  mode: OverrideMode;
  starts_at: string;
  expires_at?: string | null;
  reason: string;
  is_active: boolean;
}

export interface EffectivePermissionItem {
  code: string;
  name: string;
  module?: string | null;
  granted_by_role?: string | null;
  status: 'PERMITIDO' | 'TRIAL' | 'BLOQUEADO_MODULO' | 'SIN_ROL';
}

// Nombres del plan en español; los campos se mantienen espejo de la API.
export type Lifecycle = ModuleLifecycle;
export type ModuloPlataforma = PlatformModule;
export type ModuloDetalle = ModuleDetail;
export type MatrizModulos = ModuleMatrix;
export type ImpactoPlan = PlanImpact;
export type ModuloEmpresa = TenantModule;
export type UsuarioGlobalAlta = GlobalUserCreate;
export type PermisoEfectivo = EffectivePermissionItem;
export type PlantillaRol = RoleTemplate;
export type ImpactoPlantilla = TemplateImpact;
export type RolEquipo = RoleTemplate;
export type PermisoCatalogo = PermissionCatalogItem;
export type EstadoDemo = SandboxStatus;

export function etiquetaOrigen(module: Pick<TenantModule, 'origin' | 'is_blocked'>): string {
  if (module.is_blocked || module.origin === 'BLOQUEADO') return 'Bloqueado';
  return {
    PLAN: 'Plan',
    EXTRA: 'Extra',
    TRIAL: 'Prueba',
    BASE: 'Base',
    SANDBOX: 'Demo',
    NONE: 'No incluido',
    NO_INCLUIDO: 'No incluido',
    BLOQUEADO: 'Bloqueado',
  }[module.origin];
}

export function vigencia(
  module: { expires_at?: string | null },
  ahora: Date | number = Date.now(),
): string {
  if (!module.expires_at) return 'Sin vencimiento';
  const expires = new Date(module.expires_at);
  const now = typeof ahora === 'number' ? ahora : ahora.getTime();
  if (!Number.isFinite(expires.getTime())) return 'Fecha no disponible';
  const days = Math.ceil((expires.getTime() - now) / 86_400_000);
  if (days <= 0) return 'Vencida';
  const date = `${String(expires.getUTCDate()).padStart(2, '0')}/${String(expires.getUTCMonth() + 1).padStart(2, '0')}`;
  return `Vence ${date} · ${days} ${days === 1 ? 'día' : 'días'}`;
}

export interface EffectivePermissions {
  user_id: string;
  permissions: EffectivePermissionItem[];
}

export interface RoleTemplate {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  audience: 'PLATFORM' | 'TENANT';
  tenants_count: number;
  users_count: number;
  permissions: string[];
}

export interface TemplateImpact {
  role_id: string;
  affected_tenants: number;
  affected_users: number;
  permissions_added: string[];
  permissions_removed: string[];
}

export interface SandboxStatus {
  tenant_id: string | null;
  slug: string;
  trade_name: string;
  is_active: boolean;
  modules: {
    code: string;
    name: string;
    origin: string;
    lifecycle: string;
  }[];
  branches_count: number;
  products_count: number;
}

export function formatLifecycle(lifecycle: ModuleLifecycle): string {
  switch (lifecycle) {
    case 'BORRADOR':
      return 'Borrador';
    case 'BETA':
      return 'Fase Beta';
    case 'GA':
      return 'Disponible (GA)';
    case 'RETIRADO':
      return 'Retirado';
    default:
      return lifecycle;
  }
}

export function isModuleAvailableForPlans(lifecycle: ModuleLifecycle): boolean {
  return lifecycle === 'GA';
}

export function calculateImpactSeverity(impact: TemplateImpact): 'BAJO' | 'MEDIO' | 'ALTO' {
  if (impact.affected_tenants > 10 || impact.affected_users > 50) {
    return 'ALTO';
  }
  if (impact.affected_tenants > 0 || impact.affected_users > 5) {
    return 'MEDIO';
  }
  return 'BAJO';
}
