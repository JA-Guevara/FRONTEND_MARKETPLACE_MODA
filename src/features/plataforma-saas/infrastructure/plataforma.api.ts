import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { Page } from '../../../shared/models';
import { Tenant, TenantCreate, TenantStats, ActivityItem } from '../domain/empresa.models';
import { Plan, PlanDraft, FeatureCatalogItem, PlanSaveResult } from '../domain/plan.models';
import { SubscriptionDetail } from '../domain/suscripcion.models';
import { SupportSession, SupportSessionStart } from '../domain/soporte.models';
import {
  PlatformModule,
  ModuleDetail,
  ModuleUpdate,
  ModuleMatrix,
  PlanImpact,
  TenantModule,
  TenantModuleGrant,
  TenantLimit,
  TenantLimitDraft,
  EffectiveTenantLimit,
  GlobalUserCreate,
  GlobalUserUpdate,
  EffectivePermissions,
  RoleTemplate,
  TemplateImpact,
  PlatformRoleDraft,
  PermissionCatalogItem,
  SandboxStatus,
  TenantRole,
} from '../domain/gobierno.models';
import {
  PlatformDashboard,
  TenantOverview,
  GlobalUser,
  BranchSummary,
  PlatformAuditEvent,
} from '../domain/consola.models';

@Injectable({ providedIn: 'root' })
export class PlataformaApi {
  private api = inject(ApiService);
  tenants(q: Record<string, unknown> = {}) {
    return this.api.get<Page<Tenant>>('/platform/tenants', q);
  }
  tenantStats() {
    return this.api.get<TenantStats>('/platform/tenants/stats');
  }
  tenant(id: string) {
    return this.api.get<Tenant>('/platform/tenants/' + id);
  }
  tenantActivity(id: string) {
    return this.api.get<ActivityItem[]>('/platform/tenants/' + id + '/activity');
  }
  createTenant(body: TenantCreate) {
    return this.api.write<Tenant>('POST', '/platform/tenants', body);
  }
  updateTenant(id: string, body: Partial<TenantCreate>) {
    return this.api.write<Tenant>('PATCH', '/platform/tenants/' + id, body);
  }
  deactivateTenant(id: string, reason: string) {
    return this.api.write<Tenant>('POST', '/platform/tenants/' + id + '/deactivate', { reason });
  }
  activateTenant(id: string) {
    return this.api.write<Tenant>('POST', '/platform/tenants/' + id + '/activate');
  }
  resendInvitation(id: string) {
    return this.api.write<null>('POST', '/platform/tenants/' + id + '/resend-invitation');
  }
  plans(includeInactive = false) {
    return this.api.get<Plan[]>('/platform/plans', { include_inactive: includeInactive });
  }
  featureCatalog() {
    return this.api.get<FeatureCatalogItem[]>('/platform/plans/features');
  }
  createPlan(d: PlanDraft) {
    return this.api.write<PlanSaveResult>('POST', '/platform/plans', serializePlan(d));
  }
  updatePlan(id: string, d: Partial<PlanDraft> & { reason?: string; confirm?: boolean }) {
    return this.api.write<PlanSaveResult>('PATCH', '/platform/plans/' + id, serializePlan(d));
  }
  deactivatePlan(id: string) {
    return this.api.write<Plan>('POST', '/platform/plans/' + id + '/deactivate');
  }
  activatePlan(id: string) {
    return this.api.write<Plan>('POST', '/platform/plans/' + id + '/activate');
  }
  deletePlan(id: string) {
    return this.api.write<boolean>('DELETE', '/platform/plans/' + id);
  }
  subscription(id: string) {
    return this.api.get<SubscriptionDetail>(this.subpath(id));
  }
  changePlan(id: string, body: { plan_code: string; reason?: string }) {
    return this.api.write<SubscriptionDetail>('POST', this.subpath(id) + '/change-plan', body);
  }
  renew(id: string, body: { reason?: string }) {
    return this.api.write<SubscriptionDetail>('POST', this.subpath(id) + '/renew', body);
  }
  setStatus(id: string, body: { status: string; reason: string }) {
    return this.api.write<SubscriptionDetail>('POST', this.subpath(id) + '/status', body);
  }
  mySubscription() {
    return this.api.get<SubscriptionDetail>('/tenant/subscription');
  }

  // --- Soporte ---
  startSupport(
    tenantId: string,
    body: { reason: string; duration_minutes: number },
  ): Observable<SupportSessionStart> {
    return this.api
      .write<SupportSessionStart>('POST', `/platform/tenants/${tenantId}/support-sessions`, body)
      .pipe(map((r) => r.data));
  }
  extendSupport(id: string, minutes = 30): Observable<SupportSession> {
    return this.api
      .write<SupportSession>('POST', `/platform/support-sessions/${id}/extend`, { minutes })
      .pipe(map((r) => r.data));
  }
  endSupport(id: string): Observable<SupportSession> {
    return this.api
      .write<SupportSession>('POST', `/platform/support-sessions/${id}/end`)
      .pipe(map((r) => r.data));
  }
  supportSessions(q: Record<string, unknown> = {}): Observable<Page<SupportSession>> {
    return this.api.get<Page<SupportSession>>('/platform/support-sessions', q);
  }

  // --- Consola de plataforma ---
  dashboard(): Observable<PlatformDashboard> {
    return this.api.get<PlatformDashboard>('/platform/dashboard');
  }
  tenantOverview(id: string): Observable<TenantOverview> {
    return this.api.get<TenantOverview>(`/platform/tenants/${id}/overview`);
  }
  tenantUsers(id: string, q: Record<string, unknown> = {}): Observable<Page<GlobalUser>> {
    return this.api.get<Page<GlobalUser>>(`/platform/tenants/${id}/users`, q);
  }
  tenantBranches(id: string): Observable<BranchSummary[]> {
    return this.api.get<BranchSummary[]>(`/platform/tenants/${id}/branches`);
  }
  users(q: Record<string, unknown> = {}): Observable<Page<GlobalUser>> {
    return this.api.get<Page<GlobalUser>>('/platform/users', q);
  }
  userAction(
    id: string,
    action: 'unlock' | 'resend-verification' | 'revoke-sessions' | 'deactivate' | 'activate',
  ): Observable<GlobalUser> {
    return this.api
      .write<GlobalUser>('POST', `/platform/users/${id}/${action}`)
      .pipe(map((r) => r.data));
  }
  admins(): Observable<GlobalUser[]> {
    return this.api.get<GlobalUser[]>('/platform/admins');
  }
  inviteAdmin(body: {
    email: string;
    first_name: string;
    last_name: string;
  }): Observable<GlobalUser> {
    return this.api.write<GlobalUser>('POST', '/platform/admins', body).pipe(map((r) => r.data));
  }
  deactivateAdmin(id: string): Observable<GlobalUser> {
    return this.api
      .write<GlobalUser>('POST', `/platform/admins/${id}/deactivate`)
      .pipe(map((r) => r.data));
  }
  activateAdmin(id: string): Observable<GlobalUser> {
    return this.api
      .write<GlobalUser>('POST', `/platform/admins/${id}/activate`)
      .pipe(map((r) => r.data));
  }
  updateAdmin(
    id: string,
    body: { first_name?: string; last_name?: string; phone?: string; email?: string }
  ): Observable<GlobalUser> {
    return this.api
      .write<GlobalUser>('PATCH', `/platform/admins/${id}`, body)
      .pipe(map((r) => r.data));
  }
  deleteAdmin(id: string): Observable<boolean> {
    return this.api
      .write<boolean>('DELETE', `/platform/admins/${id}`)
      .pipe(map((r) => r.data));
  }
  resetAdminPassword(id: string): Observable<GlobalUser> {
    return this.api
      .write<GlobalUser>('POST', `/platform/admins/${id}/reset-password`)
      .pipe(map((r) => r.data));
  }
  audit(q: Record<string, unknown> = {}): Observable<Page<PlatformAuditEvent>> {
    return this.api.get<Page<PlatformAuditEvent>>('/platform/audit', q);
  }

  // --- Módulos y Gobierno SaaS (RS2) ---
  modules(): Observable<PlatformModule[]> {
    return this.api.get<PlatformModule[]>('/platform/modules');
  }
  module(code: string): Observable<ModuleDetail> {
    return this.api.get<ModuleDetail>(`/platform/modules/${encodeURIComponent(code)}`);
  }
  updateModule(code: string, body: ModuleUpdate): Observable<ModuleDetail> {
    return this.api
      .write<ModuleDetail>('PATCH', `/platform/modules/${encodeURIComponent(code)}`, body)
      .pipe(map((r) => r.data));
  }
  setModulePermissions(code: string, permissionCodes: string[]): Observable<ModuleDetail> {
    return this.api
      .write<ModuleDetail>('PUT', `/platform/modules/${encodeURIComponent(code)}/permissions`, {
        permission_codes: permissionCodes,
      })
      .pipe(map((r) => r.data));
  }
  moduleMatrix(): Observable<ModuleMatrix> {
    return this.api.get<ModuleMatrix>('/platform/modules/matrix');
  }
  matrix() {
    return this.moduleMatrix();
  }
  planImpact(planId: string, features: Record<string, boolean>): Observable<PlanImpact> {
    return this.api
      .write<PlanImpact>('POST', `/platform/plans/${planId}/impact`, features)
      .pipe(map((r) => r.data));
  }
  tenantModules(tenantId: string): Observable<TenantModule[]> {
    return this.api.get<TenantModule[]>(`/platform/tenants/${tenantId}/modules`);
  }
  grantModule(tenantId: string, body: TenantModuleGrant): Observable<TenantModule> {
    return this.api
      .write<TenantModule>('POST', `/platform/tenants/${tenantId}/modules`, body)
      .pipe(map((r) => r.data));
  }
  revokeModule(tenantId: string, overrideId: string, reason: string): Observable<null> {
    return this.api
      .write<null>('POST', `/platform/tenants/${tenantId}/modules/${overrideId}/revoke`, { reason })
      .pipe(map((r) => r.data));
  }
  roleTemplates(): Observable<RoleTemplate[]> {
    return this.api.get<RoleTemplate[]>('/platform/roles/templates');
  }
  templateImpact(roleId: string, permissionCodes: string[]): Observable<TemplateImpact> {
    return this.api
      .write<TemplateImpact>('POST', `/platform/roles/templates/${roleId}/impact`, {
        permission_codes: permissionCodes,
        reason: 'Cálculo de impacto',
      })
      .pipe(map((r) => r.data));
  }
  setTemplatePermissions(
    roleId: string,
    body: { permission_codes: string[]; reason: string; confirm?: boolean },
  ): Observable<RoleTemplate> {
    return this.api
      .write<RoleTemplate>('PUT', `/platform/roles/templates/${roleId}/permissions`, body)
      .pipe(map((r) => r.data));
  }
  teamRoles(): Observable<RoleTemplate[]> {
    return this.api.get<RoleTemplate[]>('/platform/roles/team');
  }
  createTeamRole(body: PlatformRoleDraft): Observable<RoleTemplate> {
    return this.api
      .write<RoleTemplate>('POST', '/platform/roles/team', body)
      .pipe(map((r) => r.data));
  }
  permissionsCatalog(): Observable<PermissionCatalogItem[]> {
    return this.api.get<PermissionCatalogItem[]>('/platform/permissions');
  }
  updatePermission(
    id: string,
    body: { name?: string; description?: string | null; is_active?: boolean },
  ): Observable<PermissionCatalogItem> {
    return this.api
      .write<PermissionCatalogItem>('PATCH', `/platform/permissions/${id}`, body)
      .pipe(map((r) => r.data));
  }
  sandbox(): Observable<SandboxStatus> {
    return this.api.get<SandboxStatus>('/platform/sandbox');
  }
  sandboxPreview(moduleCode: string): Observable<SupportSessionStart> {
    return this.api
      .write<SupportSessionStart>('POST', '/platform/sandbox/preview', { module_code: moduleCode })
      .pipe(map((r) => r.data));
  }
  sandboxReset(confirm = true): Observable<SandboxStatus> {
    return this.api
      .write<SandboxStatus>('POST', '/platform/sandbox/reset', { confirm })
      .pipe(map((r) => r.data));
  }
  createUser(body: GlobalUserCreate): Observable<GlobalUser> {
    return this.api.write<GlobalUser>('POST', '/platform/users', body).pipe(map((r) => r.data));
  }
  updateUser(id: string, body: GlobalUserUpdate): Observable<GlobalUser> {
    return this.api
      .write<GlobalUser>('PATCH', `/platform/users/${id}`, body)
      .pipe(map((r) => r.data));
  }
  setUserRoles(id: string, roleIds: string[]): Observable<GlobalUser> {
    return this.api
      .write<GlobalUser>('PUT', `/platform/users/${id}/roles`, { role_ids: roleIds })
      .pipe(map((r) => r.data));
  }
  setUserBranches(
    id: string,
    branchIds: string[],
    defaultId?: string,
  ): Observable<BranchSummary[]> {
    return this.api
      .write<BranchSummary[]>('PUT', `/platform/users/${id}/branches`, {
        branch_ids: branchIds,
        default_id: defaultId,
      })
      .pipe(map((r) => r.data));
  }
  effectivePermissions(userId: string): Observable<EffectivePermissions> {
    return this.api.get<EffectivePermissions>(`/platform/users/${userId}/effective-permissions`);
  }
  resetPassword(id: string) {
    return this.api
      .write<GlobalUser>('POST', `/platform/users/${id}/reset-password`)
      .pipe(map((r) => r.data));
  }
  forcePasswordChange(id: string) {
    return this.api
      .write<GlobalUser>('POST', `/platform/users/${id}/force-password-change`)
      .pipe(map((r) => r.data));
  }
  updateTeamRole(id: string, body: PlatformRoleDraft) {
    return this.api
      .write<RoleTemplate>('PATCH', `/platform/roles/team/${id}`, body)
      .pipe(map((r) => r.data));
  }
  deactivateTeamRole(id: string) {
    return this.api
      .write<RoleTemplate>('POST', `/platform/roles/team/${id}/deactivate`)
      .pipe(map((r) => r.data));
  }
  tenantRoles(id: string) {
    return this.api.get<TenantRole[]>(`/platform/tenants/${id}/roles`);
  }
  createTenantRole(
    id: string,
    body: { code: string; name: string; description?: string; permission_ids: string[] },
  ) {
    return this.api
      .write<TenantRole>('POST', `/platform/tenants/${id}/roles`, body)
      .pipe(map((r) => r.data));
  }
  updateTenantRole(id: string, roleId: string, body: { name?: string; description?: string }) {
    return this.api
      .write<TenantRole>('PATCH', `/platform/tenants/${id}/roles/${roleId}`, body)
      .pipe(map((r) => r.data));
  }
  setTenantRolePermissions(
    id: string,
    roleId: string,
    body: { permission_codes: string[]; reason: string },
  ) {
    return this.api
      .write<TenantRole>('PUT', `/platform/tenants/${id}/roles/${roleId}/permissions`, body)
      .pipe(map((r) => r.data));
  }
  tenantLimits(id: string) {
    return this.api.get<EffectiveTenantLimit[]>(`/platform/tenants/${id}/limits`);
  }
  setTenantLimit(id: string, body: TenantLimitDraft) {
    return this.api
      .write<TenantLimit>('POST', `/platform/tenants/${id}/limits`, body)
      .pipe(map((r) => r.data));
  }
  revokeTenantLimit(id: string, limitId: string, reason: string) {
    return this.api
      .write<null>('POST', `/platform/tenants/${id}/limits/${limitId}/revoke`, { reason })
      .pipe(map((r) => r.data));
  }
  preview(moduleCode: string) {
    return this.sandboxPreview(moduleCode);
  }
  resetSandbox() {
    return this.sandboxReset();
  }
  permissions() {
    return this.permissionsCatalog();
  }

  private subpath(id: string) {
    return '/platform/tenants/' + id + '/subscription';
  }
}

export function serializePlan(d: Partial<PlanDraft> & { reason?: string; confirm?: boolean }) {
  const { features, limits, ...base } = d;
  return {
    ...base,
    ...(features || limits
      ? {
          features: [
            ...Object.entries(features ?? {}).map(([feature_code, enabled]) => ({
              feature_code,
              enabled,
              limit_value: null,
            })),
            ...Object.entries(limits ?? {}).map(([feature_code, limit_value]) => ({
              feature_code,
              enabled: true,
              limit_value,
            })),
          ],
        }
      : {}),
  };
}
