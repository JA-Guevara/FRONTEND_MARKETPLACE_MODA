import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SupportSession } from '../domain/soporte.models';

@Component({
  selector: 'fs-sesiones-soporte',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="crumbs">Personas y seguridad</div>
    <div class="page-h">
      <div>
        <h1>Sesiones de soporte</h1>
        <p>Registro de accesos de super administradores a empresas para tareas de asistencia técnica y soporte.</p>
      </div>
    </div>

    @if (notice()) {
      <div class="alert info" style="margin-bottom:12px"><span>ⓘ</span><div>{{ notice() }}</div></div>
    }
    @if (error()) {
      <div class="alert danger" style="margin-bottom:12px"><span>⚠</span><div>{{ error() }}</div></div>
    }

    <div class="card" style="padding:0">
      @if (loading()) {
        <p style="padding:16px" class="muted">Cargando sesiones de soporte…</p>
      } @else {
        <table class="tbl">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Quién</th>
              <th>Motivo</th>
              <th>Inicio</th>
              <th>Duración</th>
              <th>Acciones</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (s of sessions(); track s.id) {
              <tr [class.active-session]="s.is_active">
                <td>
                  <b>{{ s.tenant_name || 'Empresa' }}</b>
                </td>
                <td>{{ s.platform_user_name || 'Super administrador' }}</td>
                <td>{{ s.reason }}</td>
                <td class="muted" style="white-space:nowrap">{{ s.started_at | date:'dd/MM HH:mm' }}</td>
                <td>{{ s.duration_minutes }} min</td>
                <td>{{ s.actions_count }} cambio(s)</td>
                <td>
                  <span
                    class="badge"
                    [class.warn]="s.is_active"
                    [class.neutral]="!s.is_active"
                  >
                    {{ s.is_active ? 'Activa' : (s.end_reason === 'expired' ? 'Vencida' : 'Terminada') }}
                  </span>
                </td>
                <td style="text-align:right">
                  @if (s.is_active) {
                    <button class="btn sm danger" (click)="terminar(s.id)" [disabled]="actionLoading()">
                      Terminar
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="muted" style="text-align:center;padding:16px">No hay sesiones de soporte registradas.</td></tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styleUrl: './sesiones-soporte.component.scss',
})
export class SesionesSoporteComponent implements OnInit {
  private api = inject(PlataformaApi);

  readonly sessions = signal<SupportSession[]>([]);
  readonly loading = signal(true);
  readonly actionLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.error.set(null);

    this.api.supportSessions().subscribe({
      next: (page) => {
        // Ordenar activas primero
        const sorted = [...page.items].sort((a, b) => {
          if (a.is_active && !b.is_active) return -1;
          if (!a.is_active && b.is_active) return 1;
          return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
        });
        this.sessions.set(sorted);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Error al cargar sesiones.');
        this.loading.set(false);
      },
    });
  }

  terminar(id: string) {
    this.actionLoading.set(true);
    this.notice.set(null);
    this.error.set(null);

    this.api.endSupport(id).subscribe({
      next: () => {
        this.notice.set('Sesión de soporte terminada.');
        this.actionLoading.set(false);
        this.cargar();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Error al terminar la sesión.');
        this.actionLoading.set(false);
      },
    });
  }
}
