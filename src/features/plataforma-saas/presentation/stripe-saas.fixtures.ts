// Copias literales del contrato; solo para las pruebas, nunca para las vistas productivas.
export const billingCheckoutRespuesta = {
  "success": true,
  "data": {
    "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_ejemplo",
    "expires_at": "2026-11-07T15:30:00Z"
  }
} as const;
export const billingPortalRespuesta = {
  "success": true,
  "data": {
    "portal_url": "https://billing.stripe.com/p/session/test_ejemplo"
  }
} as const;
export const billingNoConfigurado = {
  "success": false,
  "error": {
    "code": "billing_not_configured",
    "message": "El cobro con tarjeta no está configurado. Usa el pago manual.",
    "details": null
  }
} as const;
export const billingPortalSinCliente = {
  "success": false,
  "error": {
    "code": "billing_customer_missing",
    "message": "Primero paga un plan con tarjeta.",
    "details": null
  }
} as const;
export const cuentaCobroNoConectada = {
  "success": true,
  "data": {
    "status": "not_connected",
    "charges_enabled": false,
    "payouts_enabled": false,
    "details_submitted": false,
    "account_ref": null,
    "updated_at": null
  }
} as const;
export const cuentaCobroActiva = {
  "success": true,
  "data": {
    "status": "active",
    "charges_enabled": true,
    "payouts_enabled": true,
    "details_submitted": true,
    "account_ref": "acct_…7Qx2",
    "updated_at": "2026-11-07T14:02:11Z"
  }
} as const;
export const cuentaCobroPendiente = {
  "success": true,
  "data": {
    "status": "pending",
    "charges_enabled": false,
    "payouts_enabled": false,
    "details_submitted": true,
    "account_ref": "acct_…7Qx2",
    "updated_at": "2026-11-07T14:00:00Z"
  }
} as const;
export const onboardingRespuesta = {
  "success": true,
  "data": {
    "onboarding_url": "https://connect.stripe.com/setup/e/acct_test/ejemplo",
    "expires_at": "2026-11-07T14:10:00Z"
  }
} as const;
export const precioPlanRespuesta = {
  "success": true,
  "data": {
    "plan_id": "b0b0b0b0-0000-4000-8000-000000000002",
    "code": "PROFESIONAL",
    "stripe_price_id_month": "price_test_profesional_mes",
    "stripe_ready": true
  }
} as const;
export const billingCheckoutPeticion = {
  "plan_code": "PROFESIONAL",
  "interval": "month"
} as const;
export const precioPlanPeticion = {
  "stripe_price_id_month": "price_test_profesional_mes"
} as const;
export const billingPlanesDisponibles = {
  "success": true,
  "data": [
    {
      "code": "PROFESIONAL",
      "name": "Profesional",
      "reference_price": "199.00",
      "stripe_ready": true
    }
  ]
} as const;
