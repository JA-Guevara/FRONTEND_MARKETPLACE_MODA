import { Tenant } from '../domain/empresa.models';
import { Plan } from '../domain/plan.models';
import { SubscriptionDetail } from '../domain/suscripcion.models';
export const tenant: Tenant = {
  id: 't1',
  legal_name: 'Moda Cruceña SRL',
  trade_name: 'Moda Cruceña',
  tax_id: '1020304050',
  slug: 'moda-crucena',
  contact_email: 'moda@example.com',
  phone: null,
  status: 'ACTIVA',
  plan_code: 'BASICO',
  plan_name: 'Básico',
  subscription_status: 'ACTIVA',
  end_date: '2030-11-30',
  active_branches: 2,
  admin_email: 'admin@example.com',
  admin_password_set: false,
  created_at: '2030-10-01T12:00:00Z',
};
export const plans: Plan[] = [
  {
    id: 'p1',
    code: 'BASICO',
    name: 'Básico',
    reference_price: 350,
    duration_days: 30,
    is_active: true,
    features: { products: true, ai_reports: false },
    limits: { max_active_branches: 2 },
    tenants_count: 1,
  },
  {
    id: 'p2',
    code: 'PROFESIONAL',
    name: 'Profesional',
    reference_price: 890,
    duration_days: 30,
    is_active: true,
    features: { products: true, ai_reports: true },
    limits: { max_active_branches: 10 },
    tenants_count: 1,
  },
];
export function detail(): SubscriptionDetail {
  return {
    tenant: { id: 't1', slug: 'moda-crucena', trade_name: 'Moda Cruceña', status: 'ACTIVA' },
    current: {
      id: 's1',
      plan_code: 'PROFESIONAL',
      plan_name: 'Profesional',
      start_date: '2030-11-01',
      end_date: '2030-11-30',
      status: 'ACTIVA',
      days_left: 6,
      reason: null,
    },
    usage: { active_branches: 6, max_active_branches: 10 },
    features: { products: true, ai_reports: true },
    limits: { max_active_branches: 10 },
    history: [],
  };
}
export const session = {
  can: () => true,
  user: () => null,
  isPlatformAdmin: () => true,
  tenant: () => null,
  subscription: () => null,
  readOnly: () => false,
  hasFeature: () => true,
};
