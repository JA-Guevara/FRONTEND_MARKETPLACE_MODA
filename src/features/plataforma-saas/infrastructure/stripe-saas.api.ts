import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../app/core/shared/api.service';

export interface BillingCheckoutRequest { plan_code: string; interval: 'month'; }
export interface BillingCheckout { checkout_url: string; expires_at: string; }
export interface BillingPortal { portal_url: string; }
export interface StripePaymentAccount {
  status: 'not_connected' | 'pending' | 'active' | 'restricted';
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  account_ref: string | null;
  updated_at: string | null;
}
export interface StripeOnboarding { onboarding_url: string; expires_at: string; }
export interface StripePlanPrice {
  plan_id: string; code: string; stripe_price_id_month: string | null; stripe_ready: boolean;
}
export interface TenantBillingPlan {
  code: string; name: string; reference_price: string; stripe_ready: boolean;
}
export type StripeDestination = 'checkout' | 'portal' | 'onboarding';

/** Los enlaces vienen de la API, pero solo se abre el origen oficial de cada flujo. */
export function safeStripeUrl(value: string, destination: StripeDestination): string | null {
  try {
    const url = new URL(value);
    const hosts = { checkout: 'checkout.stripe.com', portal: 'billing.stripe.com', onboarding: 'connect.stripe.com' };
    return url.protocol === 'https:' && url.hostname === hosts[destination] && !url.username && !url.password && !url.port
      ? url.href : null;
  } catch { return null; }
}

@Injectable({ providedIn: 'root' })
export class StripeSaasApi {
  private readonly api = inject(ApiService);
  private readonly document = inject(DOCUMENT);
  checkout(plan_code: string) {
    return this.api.post<BillingCheckout>('/tenant/billing/checkout', { plan_code, interval: 'month' } satisfies BillingCheckoutRequest);
  }
  portal() { return this.api.post<BillingPortal>('/tenant/billing/portal'); }
  account() { return this.api.get<StripePaymentAccount>('/tenant/payments/stripe-account'); }
  onboarding() { return this.api.post<StripeOnboarding>('/tenant/payments/stripe-account/onboarding'); }
  planPrice(planId: string, stripe_price_id_month: string | null) {
    return this.api.put<StripePlanPrice>(`/platform/plans/${encodeURIComponent(planId)}/stripe-price`, { stripe_price_id_month });
  }
  redirect(value: string, destination: StripeDestination): boolean {
    const url = safeStripeUrl(value, destination);
    const view = this.document.defaultView;
    if (!url || !view) return false;
    view.location.assign(url);
    return true;
  }
}
