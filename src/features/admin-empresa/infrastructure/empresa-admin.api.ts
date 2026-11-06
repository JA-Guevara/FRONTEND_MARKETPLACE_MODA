import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { Page, Permission } from '../../../shared/models';
import {
  TenantDashboard,
  TenantProfile,
  TenantProfileUpdate,
  RoleView,
} from '../domain/empresa-admin.models';
import { SupportSession } from '../../plataforma-saas/domain/soporte.models';

@Injectable({ providedIn: 'root' })
export class EmpresaAdminApi {
  private api = inject(ApiService);

  dashboard(branchId?: string): Observable<TenantDashboard> {
    return this.api.get<TenantDashboard>('/tenant/dashboard', { branch_id: branchId });
  }

  profile(): Observable<TenantProfile> {
    return this.api.get<TenantProfile>('/tenant/profile');
  }

  updateProfile(body: TenantProfileUpdate) {
    return this.api.write<TenantProfile>('PATCH', '/tenant/profile', body);
  }

  supportSessions(page = 1): Observable<Page<SupportSession>> {
    return this.api.get<Page<SupportSession>>('/tenant/support-sessions', { page });
  }

  supportRequests(page = 1): Observable<Page<SupportSession>> {
    return this.api.get<Page<SupportSession>>('/tenant/support/requests', { page });
  }

  approveSupportRequest(sessionId: string, minutes: number = 30) {
    return this.api.write<SupportSession>('POST', `/tenant/support/requests/${sessionId}/approve`, { minutes });
  }

  rejectSupportRequest(sessionId: string, reason: string) {
    return this.api.write<SupportSession>('POST', `/tenant/support/requests/${sessionId}/reject`, { reason });
  }

  supportPolicy(): Observable<{ support_access_mode: string }> {
    return this.api.get<{ support_access_mode: string }>('/tenant/support/policy');
  }

  updateSupportPolicy(mode: string) {
    return this.api.write<{ support_access_mode: string }>('PUT', '/tenant/support/policy', { mode });
  }

  roles(): Observable<RoleView[]> {
    return this.api.get<RoleView[]>('/roles', { include_inactive: true });
  }

  permissions(): Observable<Permission[]> {
    return this.api.get<Permission[]>('/roles/permissions/all');
  }

  createRole(body: { code: string; name: string; description?: string; permission_ids?: string[] }) {
    return this.api.write<RoleView>('POST', '/roles', body);
  }

  updateRole(id: string, body: { name?: string; description?: string }) {
    return this.api.write<RoleView>('PATCH', `/roles/${id}`, body);
  }

  setRolePermissions(id: string, permissionIds: string[]) {
    return this.api.write<RoleView>('PUT', `/roles/${id}/permissions`, { permission_ids: permissionIds });
  }

  deactivateRole(id: string) {
    return this.api.write<RoleView>('POST', `/roles/${id}/deactivate`);
  }

  deleteRole(id: string) {
    return this.api.write<null>('DELETE', `/roles/${id}`);
  }

  activateRole(id: string) {
    return this.api.write<RoleView>('POST', `/roles/${id}/activate`);
  }
}
