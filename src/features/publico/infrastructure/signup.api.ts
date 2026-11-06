import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface SlugResponse { data: { slug: string; available: boolean; reason: string; }; }
export interface SignupResponse { success: boolean; message: string; data: { email: string; dev_token?: string; }; }
export interface VerifyResponse { success: boolean; message: string; data: { tenant_id: string; slug: string; user_id: string; plan_code: string; trial_days: number; }; }
export interface SignupRequest { company_name: string; slug: string; email: string; password: string; accept_terms: boolean; accept_privacy: boolean; }

@Injectable({ providedIn: 'root' })
export class SignupApi {
  private readonly http = inject(HttpClient);
  slug(name: string) { return this.http.get<SlugResponse>(`${environment.apiUrl}/public/signup/slug?name=${encodeURIComponent(name)}`); }
  signup(body: SignupRequest) { return this.http.post<SignupResponse>(`${environment.apiUrl}/public/signup`, body); }
  verify(token: string) { return this.http.post<VerifyResponse>(`${environment.apiUrl}/public/signup/verify`, { token }); }
}
