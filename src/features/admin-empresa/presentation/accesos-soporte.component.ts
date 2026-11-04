import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EmpresaAdminApi } from '../infrastructure/empresa-admin.api';
import { SupportSession } from '../../plataforma-saas/domain/soporte.models';

@Component({
  selector: 'fs-accesos-soporte',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="crumbs">Mi empresa</div>
    <div class="page-h">
      <div>
        <h1>Accesos de soporte</h1>
        <p>Personal de FashionStore que entró a tu empresa para ayudarte. Cada acción que hicieron está en tu bitácora.</p>
      </div>
    </div>

    @if (hasActiveSession()) {
      <div class="alert warn" style="margin-bottom:12px">
        <span>⛑</span>
        <div>
          <b>Sesión de soporte activa.</b> Un super administrador está conectado asistiendo a tu empresa. Todo cambio se registra con su nombre.
        </div>
      </div>
    } @else {
      <div class="alert info" style="margin-bottom:12px">
        <span>⛑</span>
        <div>
          <b>No hay sesiones activas.</b> Cuando un super administrador entre a tu empresa verás aquí la sesión en curso.
        </div>
      </div>
    }

    @if (error()) {
      <div class="alert danger" style="margin-bottom:12px"><span>⚠</span><div>{{ error() }}</div></div>
    }

    <div class="card" style="padding:0">
      @if (loading()) {
        <p style="padding:16px" class="muted">Cargando accesos de soporte…</p>
      } @else {
        <table class="tbl">
          <thead>
            <tr>
              <th>Quién</th>
              <th>Motivo</th>
              <th>Inicio</th>
              <th>Duración</th>
              <th>Acciones</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (s of sessions(); track s.id) {
              <tr [class.active-row]="s.is_active">
                <td>
                  <b>{{ s.platform_user_name || 'Super administrador' }}</b>
                  <span class="sub">Plataforma FashionStore</span>
                </td>
                <td>{{ s.reason }}</td>
                <td class="muted" style="white-space:nowrap">{{ s.started_at | date:'dd/MM HH:mm' }}</td>
                <td>
                  {{ s.duration_minutes }} min
                  <small class="muted">· {{ s.is_active ? 'activa' : (s.end_reason === 'expired' ? 'vencida' : 'terminada') }}</small>
                </td>
                <td>{{ s.actions_count }} cambio(s)</td>
                <td style="text-align:right">
                  <a
                    class="btn sm"
                    [routerLink]="['/admin/bitacora']"
                    [queryParams]="{ support_session_id: s.id }"
                  >
                    Ver en bitácora
                  </a>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="muted" style="text-align:center;padding:16px">No hay accesos de soporte registrados.</td></tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styleUrl: './accesos-soporte.component.scss',
})
export class AccesosSoporteComponent implements OnInit {
  private api = inject(EmpresaAdminApi);

  readonly sessions = signal<SupportSession[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly hasActiveSession = computed(() => this.sessions().some((s) => s.is_active));

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.error.set(null);
    this.api.supportSessions().subscribe({
      next: (page) => {
        this.sessions.set(page.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Error al cargar accesos de soporte.');
        this.loading.set(false);
      },
    });
  }
}
