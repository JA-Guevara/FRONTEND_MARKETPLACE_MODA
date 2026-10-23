import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { Page } from '../../../shared/models';
import { Tenant, TenantCreate, TenantStats, ActivityItem } from '../domain/empresa.models';
import { Plan, PlanDraft, FeatureCatalogItem, PlanSaveResult } from '../domain/plan.models';
import { SubscriptionDetail } from '../domain/suscripcion.models';
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
