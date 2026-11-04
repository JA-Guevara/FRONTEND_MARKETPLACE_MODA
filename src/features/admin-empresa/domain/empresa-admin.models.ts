import { Permission } from '../../../shared/models';

export interface PlanUsage {
  active_branches: number;
  max_branches: number | null;
}

export interface OrderBrief {
  id: string;
  code: string;
  total: number;
  channel: 'online' | 'pos';
  payment_method: string;
  status: string;
  created_at: string;
}

export interface ReservationBrief {
  id: string;
  customer_name: string;
  items: number;
  starts_at: string;
  status: string;
  origin: 'online' | 'offline';
}

export interface TenantDashboard {
  sales_today: number;
  orders_today: number;
  sales_delta_pct: number | null;
  reservations_today: number;
  in_fitting_room: number;
  critical_stock: number;
  plan_usage: PlanUsage;
  recent_orders: OrderBrief[];
  upcoming_reservations: ReservationBrief[];
}

export interface TenantProfile {
  id: string;
  legal_name: string;
  trade_name: string;
  tax_id: string;
  slug: string;
  contact_email: string;
  phone?: string | null;
}

export interface TenantProfileUpdate {
  trade_name?: string;
  contact_email?: string;
  phone?: string;
}

export interface RoleView {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  is_template: boolean;
  is_active: boolean;
  users_count: number;
  permissions: Permission[];
}

export interface PermissionGroup {
  module: string;
  read: string;
  write?: string;
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  { module: 'Ventas', read: 'commerce.read', write: 'commerce.write' },
  { module: 'Existencias', read: 'stock.read', write: 'stock.write' },
  { module: 'Reservas', read: 'reservations.read', write: 'reservations.write' },
  { module: 'Catálogo', read: 'catalog.read', write: 'catalog.write' },
  { module: 'Sucursales', read: 'branches.read', write: 'branches.write' },
  { module: 'Proveedores', read: 'suppliers.read', write: 'suppliers.write' },
  { module: 'Personal', read: 'users.read', write: 'users.write' },
  { module: 'Roles', read: 'roles.read', write: 'roles.write' },
  { module: 'Reportes', read: 'dashboard.read' },
  { module: 'Bitácora', read: 'audit.read' },
];

export function toPermissionCodes(
  matrix: Record<string, { read: boolean; write: boolean }>
): string[] {
  const codes: string[] = [];
  for (const group of PERMISSION_GROUPS) {
    const entry = matrix[group.module] || matrix[group.read.split('.')[0]];
    if (!entry) continue;

    if (entry.write && group.write) {
      if (!codes.includes(group.read)) {
        codes.push(group.read);
      }
      if (!codes.includes(group.write)) {
        codes.push(group.write);
      }
    } else if (entry.read) {
      if (!codes.includes(group.read)) {
        codes.push(group.read);
      }
    }
  }
  return codes;
}
