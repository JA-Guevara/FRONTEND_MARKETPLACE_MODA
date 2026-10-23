export type TenantStatus = 'ACTIVA' | 'INACTIVA';
export interface Tenant {
  id: string;
  legal_name: string;
  trade_name: string;
  tax_id: string;
  slug: string;
  contact_email: string;
  phone: string | null;
  status: TenantStatus;
  plan_code: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  end_date: string | null;
  active_branches: number;
  admin_email: string | null;
  admin_password_set: boolean;
  created_at: string;
}
export interface TenantCreate {
  legal_name: string;
  trade_name: string;
  tax_id: string;
  slug: string;
  contact_email: string;
  phone?: string | null;
  admin: { first_name: string; last_name: string; email: string };
  plan_code: string;
  start_date?: string;
}
export interface TenantStats {
  active: number;
  professional: number;
  expiring_7d: number;
  suspended: number;
}
export interface ActivityItem {
  action: string;
  created_at: string;
  actor_email?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
export function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');
}
export function isValidSlug(s: string) {
  return /^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$/.test(s);
}
export function isValidTaxId(s: string) {
  return /^[0-9]{5,20}$/.test(s);
}
export function tenantTone(t: Tenant): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (t.status === 'INACTIVA') return 'neutral';
  if (['SUSPENDIDA', 'VENCIDA', 'CANCELADA'].includes(t.subscription_status ?? '')) return 'danger';
  const left = (Date.parse(t.end_date ?? '') - Date.now()) / 86400000;
  return left <= 7 ? 'warn' : 'ok';
}
