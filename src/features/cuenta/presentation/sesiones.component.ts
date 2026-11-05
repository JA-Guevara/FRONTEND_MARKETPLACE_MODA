import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../../shared/models';

export interface UserSession {
  id: string;
  device_label?: string | null;
  ip_prefix?: string | null;
  created_at: string;
  last_used_at?: string | null;
  expires_at: string;
}

@Component({
  selector: 'fs-sesiones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sesiones.component.html',
  styleUrls: ['./sesiones.component.scss'],
})
export class SesionesComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  readonly sessions = signal<UserSession[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly hasOtherSessions = computed(() => this.sessions().length > 1);

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<ApiResponse<UserSession[]>>(`${this.apiUrl}/auth/sessions`).subscribe({
      next: (res) => {
        this.sessions.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudieron cargar las sesiones activas.');
        this.loading.set(false);
      },
    });
  }

  revokeSession(id: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    this.http.delete<ApiResponse<null>>(`${this.apiUrl}/auth/sessions/${id}`).subscribe({
      next: () => {
        this.successMessage.set('Sesión cerrada correctamente.');
        this.busy.set(false);
        this.loadSessions();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo cerrar la sesión.');
        this.busy.set(false);
      },
    });
  }

  revokeOthers(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    const currentId = this.sessions().length > 0 ? this.sessions()[0].id : null;
    const body = currentId ? { session_id: currentId } : {};

    this.http.post<ApiResponse<{ revoked_count: number }>>(`${this.apiUrl}/auth/sessions/revoke-others`, body).subscribe({
      next: (res) => {
        const count = res.data?.revoked_count ?? 0;
        this.successMessage.set(`Se cerraron ${count} sesión(es) en otros dispositivos.`);
        this.busy.set(false);
        this.loadSessions();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudieron cerrar las otras sesiones.');
        this.busy.set(false);
      },
    });
  }

  isCurrent(index: number): boolean {
    return index === 0;
  }

  getDeviceIcon(label?: string | null): string {
    const l = (label || '').toLowerCase();
    if (l.includes('android') || l.includes('ios') || l.includes('móvil') || l.includes('app')) {
      return '▯';
    }
    return '◧';
  }

  formatRelativeTime(isoDate?: string | null): string {
    if (!isoDate) return 'Ahora';
    const date = new Date(isoDate);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 2) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  }
}
