import { TenantSummary } from '../../../shared/models';
export interface SubscriptionView {
  id: string;
  plan_code: string;
  plan_name: string;
  start_date: string;
  end_date: string;
  status: string;
  days_left: number;
  reason: string | null;
  reference_price?: number | string;
}
export interface SubscriptionDetail {
  tenant: TenantSummary;
  current: SubscriptionView;
  usage: { active_branches: number; max_active_branches: number };
  features: Record<string, boolean>;
  limits: Record<string, number>;
  history: SubscriptionView[];
}
export function downgradeCheck(usage: { active_branches: number }, targetLimit: number) {
  const mustDeactivate = Math.max(0, usage.active_branches - targetLimit);
  return { ok: mustDeactivate === 0, mustDeactivate };
}
export function expiryTone(daysLeft: number, status: string): 'ok' | 'warn' | 'danger' {
  return status !== 'ACTIVA' ? 'danger' : daysLeft <= 7 ? 'warn' : 'ok';
}
