import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EmpresaAdminApi } from '../infrastructure/empresa-admin.api';
import { SupportSession } from '../../plataforma-saas/domain/soporte.models';

@Component({
  selector: 'fs-accesos-soporte',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="crumbs">Mi empresa</div>
    <div class="page-h">
      <div>
        <h1>Accesos de soporte</h1>
        <p>Nadie de FashionStore entra a tus datos sin tu aprobación. Cada acceso dura poco, queda en tu bitácora y puedes cortarlo cuando quieras.</p>
      </div>
    </div>

    @if (hasActiveSession()) {
      <div class="alert warn" style="margin-bottom:12px">
        <span>⛑</span>
        <div>
          <b>Sesión de soporte activa.</b> Un super administrador está conectado asistiendo a tu empresa. Todo cambio se registra con su nombre.
        </div>
      </div>
    }

    <!-- Solicitud pendiente con cuenta regresiva -->
    @for (req of pendingRequests(); track req.id) {
      <div class="req" role="region" aria-label="Solicitud de soporte pendiente">
        <div style="display:flex;align-items:center;gap:10px">
          <span class="badge warn">Solicitud pendiente · expira en {{ countdownText() }}</span>
          <span style="flex:1"></span>
          <span class="muted" style="font-size:12px">Acceso solicitado</span>
        </div>

        <b style="font-size:15px">El equipo de soporte pide entrar a tu empresa</b>
        <span>«{{ req.reason }}»</span>

        <div class="meta">
          <div><b>Alcance</b>{{ req.mode === 'READ_ONLY' ? 'Solo lectura' : 'Escritura' }}</div>
          <div><b>Duración</b>{{ req.duration_minutes }} minutos</div>
          <div><b>Sucursales</b>Todas</div>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn ghost" (click)="abrirRechazo(req)">Rechazar…</button>
          <button type="button" class="btn" (click)="aprobar(req, 15)" [disabled]="busy()">Aprobar 15 min</button>
          <button type="button" class="btn primary" (click)="aprobar(req, 30)" [disabled]="busy()">Aprobar 30 min</button>
        </div>
      </div>
    }

    @if (error()) {
      <div class="alert danger" style="margin-bottom:12px"><span>⚠</span><div>{{ error() }}</div></div>
    }
    @if (successMessage()) {
      <div class="alert ok" style="margin-bottom:12px"><span>✔</span><div>{{ successMessage() }}</div></div>
    }

    <div class="grid2">
      <!-- Política de acceso -->
      <div class="card">
        <h3>Política de acceso</h3>
        <p class="muted" style="margin:0 0 12px;font-size:13px">Define cómo gestiona tu empresa las solicitudes de soporte técnico de FashionStore.</p>

        <div
          class="mode"
          [class.on]="policyMode() === 'require_approval'"
          role="button"
          tabindex="0"
          (click)="cambiarPolitica('require_approval')"
          (keydown.enter)="cambiarPolitica('require_approval')"
        >
          <i></i>
          <b>Pedir mi aprobación siempre</b>
          <small>Recomendado. La solicitud vence a los 10 minutos si nadie responde.</small>
        </div>

        <div
          class="mode"
          style="margin-top:8px"
          [class.on]="policyMode() === 'allow_read_only'"
          role="button"
          tabindex="0"
          (click)="cambiarPolitica('allow_read_only')"
          (keydown.enter)="cambiarPolitica('allow_read_only')"
        >
          <i></i>
          <b>Permitir solo lectura sin aprobación</b>
          <small>Para respuestas rápidas; igual se registra y se notifica.</small>
        </div>

        <div class="alert info" style="margin-top:14px">
          <span>ℹ</span>
          <div>
            <b>Acceso de emergencia</b>
            Solo ante incidentes graves: entra con motivo obligatorio (≥ 20 caracteres), te avisa al instante por correo y queda marcado en rojo.
          </div>
        </div>
      </div>

      <!-- Historial -->
      <div class="card" style="padding:0">
        <div style="padding:12px 14px;border-bottom:1px solid var(--line,#e2e8f0)">
          <h3 style="margin:0">Historial</h3>
        </div>

        @if (loading()) {
          <p style="padding:16px" class="muted">Cargando accesos de soporte…</p>
        } @else {
          <table class="tbl">
            <thead>
              <tr>
                <th>Fecha / Quién</th>
                <th>Alcance</th>
                <th>Resultado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (s of sessions(); track s.id) {
                <tr [class.active-row]="s.is_active" [class.emergency-row]="s.is_emergency">
                  <td>
                    <b>{{ s.started_at | date:'dd/MM HH:mm' }}</b>
                    <span class="sub">{{ s.platform_user_name || 'Soporte FashionStore' }}</span>
                  </td>
                  <td>
                    {{ s.mode === 'READ_ONLY' ? 'Solo lectura' : 'Asistencia' }} · {{ s.duration_minutes }} min
                    <div class="sub" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ s.reason }}</div>
                  </td>
                  <td>
                    @if (s.is_emergency) {
                      <span class="badge danger">Acceso de emergencia</span>
                    } @else if (s.status === 'approved' || s.is_active) {
                      <span class="badge ok">Aprobada por ti</span>
                    } @else if (s.status === 'rejected') {
                      <span class="badge neutral">Rechazada</span>
                    } @else if (s.status === 'request_expired') {
                      <span class="badge neutral">Expirada</span>
                    } @else {
                      <span class="badge neutral">{{ s.status || 'Finalizada' }}</span>
                    }
                  </td>
                  <td style="text-align:right">
                    <a
                      class="btn sm ghost"
                      [routerLink]="['/admin/bitacora']"
                      [queryParams]="{ support_session_id: s.id }"
                    >
                      Ver en bitácora
                    </a>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="muted" style="text-align:center;padding:16px">No hay accesos de soporte registrados.</td></tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>

    <!-- Modal para rechazar con motivo -->
    @if (rejectDialogSession()) {
      <div class="modal-backdrop" (click)="cerrarRechazo()">
        <div class="modal-box" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <h3 style="margin:0">Rechazar solicitud de soporte</h3>
          <p class="muted" style="margin:0;font-size:13px">
            Indica el motivo del rechazo. Este motivo quedará registrado en la bitácora y se informará al agente de soporte.
          </p>

          <div>
            <label for="reject-reason" style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Motivo del rechazo *</label>
            <textarea
              id="reject-reason"
              [ngModel]="rejectReason()"
              (ngModelChange)="rejectReason.set($event)"
              placeholder="Ej. Fuera de horario comercial o no solicitado"
            ></textarea>
            @if (rejectReason().trim().length > 0 && rejectReason().trim().length < 5) {
              <span style="font-size:11px;color:var(--danger,#ef4444)">El motivo debe tener al menos 5 caracteres.</span>
            }
          </div>

          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button type="button" class="btn ghost" (click)="cerrarRechazo()">Cancelar</button>
            <button
              type="button"
              class="btn primary"
              [disabled]="rejectReason().trim().length < 5 || busy()"
              (click)="confirmarRechazo()"
            >
              {{ busy() ? 'Rechazando…' : 'Rechazar solicitud' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './accesos-soporte.component.scss',
})
export class AccesosSoporteComponent implements OnInit, OnDestroy {
  private api = inject(EmpresaAdminApi);

  readonly sessions = signal<SupportSession[]>([]);
  readonly pendingRequests = signal<SupportSession[]>([]);
  readonly policyMode = signal<'require_approval' | 'allow_read_only'>('require_approval');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly rejectDialogSession = signal<SupportSession | null>(null);
  readonly rejectReason = signal<string>('');

  readonly countdownText = signal<string>('10:00');
  private timer: any = null;

  readonly hasActiveSession = computed(() => this.sessions().some((s) => s.is_active));

  ngOnInit() {
    this.cargar();
    this.iniciarTemporizador();
  }

  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  iniciarTemporizador() {
    this.timer = setInterval(() => {
      this.actualizarCuentaRegresiva();
    }, 1000);
  }

  actualizarCuentaRegresiva() {
    const pending = this.pendingRequests()[0];
    if (!pending || !pending.request_expires_at) {
      this.countdownText.set('10:00');
      return;
    }

    const diffMs = new Date(pending.request_expires_at).getTime() - Date.now();
    if (diffMs <= 0) {
      this.countdownText.set('expirada');
      return;
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    this.countdownText.set(`${m}:${s}`);
  }

  cargar() {
    this.loading.set(true);
    this.error.set(null);

    // Cargar historial
    if (typeof this.api.supportSessions === 'function') {
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
    } else {
      this.loading.set(false);
    }

    // Cargar solicitudes pendientes
    if (typeof this.api.supportRequests === 'function') {
      this.api.supportRequests().subscribe({
        next: (page) => {
          const pending = page.items.filter((s) => s.status === 'pending_approval');
          this.pendingRequests.set(pending);
          this.actualizarCuentaRegresiva();
        },
        error: () => {
          // Fallback no crítico
        },
      });
    }

    // Cargar política
    if (typeof this.api.supportPolicy === 'function') {
      this.api.supportPolicy().subscribe({
        next: (res) => {
          if (res?.support_access_mode === 'allow_read_only') {
            this.policyMode.set('allow_read_only');
          } else {
            this.policyMode.set('require_approval');
          }
        },
        error: () => {
          // Fallback
        },
      });
    }
  }

  aprobar(req: SupportSession, minutes: number = 30) {
    this.busy.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    this.api.approveSupportRequest(req.id, minutes).subscribe({
      next: () => {
        this.busy.set(false);
        this.successMessage.set(`Acceso de soporte aprobado por ${minutes} minutos.`);
        this.cargar();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.message ?? 'Error al aprobar la solicitud de soporte.');
      },
    });
  }

  abrirRechazo(req: SupportSession) {
    this.rejectDialogSession.set(req);
    this.rejectReason.set('');
  }

  cerrarRechazo() {
    this.rejectDialogSession.set(null);
    this.rejectReason.set('');
  }

  confirmarRechazo() {
    const session = this.rejectDialogSession();
    const reason = this.rejectReason().trim();
    if (!session || reason.length < 5) return;

    this.busy.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    this.api.rejectSupportRequest(session.id, reason).subscribe({
      next: () => {
        this.busy.set(false);
        this.cerrarRechazo();
        this.successMessage.set('Solicitud de soporte rechazada.');
        this.cargar();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.message ?? 'Error al rechazar la solicitud.');
      },
    });
  }

  cambiarPolitica(mode: 'require_approval' | 'allow_read_only') {
    if (this.policyMode() === mode) return;

    this.api.updateSupportPolicy(mode).subscribe({
      next: () => {
        this.policyMode.set(mode);
        this.successMessage.set('Política de soporte actualizada.');
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Error al actualizar la política de soporte.');
      },
    });
  }
}
