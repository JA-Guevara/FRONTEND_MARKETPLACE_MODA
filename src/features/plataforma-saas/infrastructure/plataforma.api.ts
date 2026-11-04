import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { Page } from '../../../shared/models';
import { Tenant, TenantCreate, TenantStats, ActivityItem } from '../domain/empresa.models';
import { Plan, PlanDraft, FeatureCatalogItem, PlanSaveResult } from '../domain/plan.models';
import { SubscriptionDetail } from '../domain/suscripcion.models';
import { SupportSession, SupportSessionStart } from '../domain/soporte.models';
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
  updatePlan(id: string, d: Partial<PlanDraft>) {
    return this.api.write<PlanSaveResult>('PATCH', '/platform/plans/' + id, serializePlan(d));
  }
  deactivatePlan(id: string) {
    return this.api.write<Plan>('POST', '/platform/plans/' + id + '/deactivate');
  }
  activatePlan(id: string) {
    return this.api.write<Plan>('POST', '/platform/plans/' + id + '/activate');
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
  startSupport(tenantId: string, body: { reason: string; duration_minutes: number }): Observable<SupportSessionStart> {
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
    action: 'unlock' | 'resend-verification' | 'revoke-sessions' | 'deactivate' | 'activate'
  ): Observable<GlobalUser> {
    return this.api
      .write<GlobalUser>('POST', `/platform/users/${id}/${action}`)
      .pipe(map((r) => r.data));
  }
  admins(): Observable<GlobalUser[]> {
    return this.api.get<GlobalUser[]>('/platform/admins');
  }
  inviteAdmin(body: { email: string; first_name: string; last_name: string }): Observable<GlobalUser> {
    return this.api
      .write<GlobalUser>('POST', '/platform/admins', body)
      .pipe(map((r) => r.data));
  }
  deactivateAdmin(id: string): Observable<GlobalUser> {
    return this.api
      .write<GlobalUser>('POST', `/platform/admins/${id}/deactivate`)
      .pipe(map((r) => r.data));
  }
  audit(q: Record<string, unknown> = {}): Observable<Page<PlatformAuditEvent>> {
    return this.api.get<Page<PlatformAuditEvent>>('/platform/audit', q);
  }

  private subpath(id: string) {
    return '/platform/tenants/' + id + '/subscription';
  }
}

export function serializePlan(d: Partial<PlanDraft>) {
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
