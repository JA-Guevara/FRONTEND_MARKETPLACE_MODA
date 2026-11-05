import { SubscriptionSummary, TenantSummary } from '../../../shared/models';

export interface SupportSession {
  id: string;
  tenant_id: string;
  tenant_name: string;
  platform_user_id: string;
  platform_user_name: string;
  reason: string;
  duration_minutes: number;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  end_reason: string | null;
  actions_count: number;
  is_active: boolean;
  mode?: 'WRITE' | 'READ_ONLY';
  landing_module?: string | null;
  status?: string;
  approved_by_user_id?: string | null;
  approved_at?: string | null;
  decision_reason?: string | null;
  request_expires_at?: string | null;
  is_emergency?: boolean;
}

export interface SupportSessionStart {
  session: SupportSession;
  access_token?: string;
  expires_in?: number;
  tenant: TenantSummary;
  subscription: SubscriptionSummary | null;
  permissions?: string[];
}

export interface TenantLite {
  id: string;
  trade_name: string;
  slug?: string;
  plan_name?: string;
  status?: string;
}

export const SUPPORT_DURATIONS = [15, 60, 120, 240] as const;

export function isValidReason(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return trimmed.length >= 10 && trimmed.length <= 300;
}

export function remainingMs(s: SupportSession, now = Date.now()): number {
  if (!s || !s.expires_at) return 0;
  return Math.max(0, new Date(s.expires_at).getTime() - now);
}

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}
