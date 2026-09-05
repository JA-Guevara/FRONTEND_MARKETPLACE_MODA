import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../../shared/models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  get<T>(path: string, query: Record<string, unknown> = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== '' && value !== undefined && value !== null)
        params = params.set(key, String(value));
    }
    return this.http
      .get<ApiResponse<T>>(environment.apiUrl + path, { params })
      .pipe(map((r) => r.data));
  }
  write<T>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown) {
    return this.http.request<ApiResponse<T>>(method, environment.apiUrl + path, {
      body: body ?? null,
    });
  }
}
