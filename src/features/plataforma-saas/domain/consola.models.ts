export interface TenantCounters {
  active: number;
  inactive: number;
  suspended: number;
  expiring_7d: number;
  near_limit: number;
}

export interface PlanSlice {
  plan_code: string;
  plan_name: string;
  tenants: number;
}

export interface MonthCount {
  month: string;
  count: number;
}

export interface PlatformUsage {
  active_branches: number;
  branch_capacity: number;
  ai_reports_month: number;
  tryon_jobs_month: number;
  orders_30d: number;
  reservations_30d: number;
}

export interface AttentionItem {
  tenant_id: string;
  trade_name: string;
  kind: 'expiring' | 'at_limit' | 'suspended';
  detail: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  description: string;
  created_at: string;
  tenant_name?: string | null;
}

export interface PlatformDashboard {
  mrr_estimate: number;
  currency: string;
  tenants: TenantCounters;
  plan_distribution: PlanSlice[];
  signups_by_month: MonthCount[];
  usage: PlatformUsage;
  attention: AttentionItem[];
  recent_activity: ActivityItem[];
}

export interface QuotaItem {
  code: string;
  label: string;
  used: number;
  limit: number | null;
}

export interface TenantOverview {
  sales_30d: number;
  orders_30d: number;
  online_orders_30d: number;
  pos_orders_30d: number;
  reservations_30d: number;
  offline_reservations_30d: number;
  active_users: number;
  users_by_role: Record<string, number>;
  quotas: QuotaItem[];
  last_activity_at: string | null;
}

export interface GlobalUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  tenant_id: string | null;
  tenant_name: string | null;
  roles: string[];
  is_active: boolean;
  is_verified: boolean;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface BranchSummary {
  id: string;
  name: string;
  city_name: string;
  is_active: boolean;
  cash_points: number;
}

export interface PlatformAuditEvent {
  id: string;
  tenant_id: string | null;
  tenant_name?: string | null;
  support_session_id: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  metadata?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export function maskEmail(email: string): string {
  if (!email) return '';
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return email;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  const prefix = local.length <= 2 ? local : local.slice(0, 2);
  return `${prefix}***${domain}`;
}

export function quotaTone(q: QuotaItem): '' | 'near' | 'full' {
  if (q.limit === null || q.limit === undefined || q.limit <= 0) {
    return '';
  }
  const ratio = q.used / q.limit;
  if (ratio >= 1) return 'full';
  if (ratio >= 0.8) return 'near';
  return '';
}
