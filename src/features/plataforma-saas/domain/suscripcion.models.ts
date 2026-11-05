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
  lifecycle_state?: 'active' | 'expiring' | 'grace' | 'read_only' | 'canceled' | string;
  grace_until?: string | null;
  read_only_since?: string | null;
  canceled_at?: string | null;
  data_retention_until?: string | null;
  next_notice?: string | null;
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

export interface SubscriptionInvoice {
  id: string;
  number: string;
  tenant_id: string;
  subscription_id: string;
  period_start: string;
  period_end: string;
  amount: number;
  currency: string;
  status: 'issued' | 'paid' | 'overdue' | 'void' | string;
  issued_at: string;
  due_at: string;
  paid_at?: string | null;
  paid_reference?: string | null;
  plan_name?: string | null;
}

