import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SoporteService } from '../application/soporte.service';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import {
  SUPPORT_DURATIONS,
  SupportSession,
  isValidReason,
} from '../domain/soporte.models';

type DialogState = 'form' | 'waiting' | 'emergency';

@Component({
  selector: 'fs-iniciar-soporte-dialog',
  imports: [FormsModule],
  template: `
    <div class="dialog-backdrop" (click)="onBackdrop($event)">
      <div class="dialog-box" role="dialog" aria-modal="true">
        <!-- VISTA 1: FORMULARIO NORMAL -->
        @if (state() === 'form') {
          <h2 class="dialog-title">⛑ Asistir a {{ tenant.trade_name }}</h2>
          <p class="dialog-desc">
            Solicitarás acceso al panel de la empresa. La empresa debe aprobar la solicitud antes de que puedas ingresar.
          </p>

          <div class="reason-field">
            <label for="support-reason">Motivo *</label>
            <textarea
              id="support-reason"
              [(ngModel)]="reason"
              [class.err]="errorMessage()"
              placeholder="Ej. Revisar existencias negativas en sucursal Norte (ticket #482)"
              (input)="onInput()"
            ></textarea>
            @if (errorMessage()) {
              <span class="err-text">{{ errorMessage() }}</span>
            } @else {
              <span class="hint"
                >Mínimo 10 caracteres (actual: {{ reason.trim().length }}/300).
                Aparece en la bitácora de la empresa.</span
              >
            }
          </div>

          <div class="duration-selector">
            <span class="label">Duración</span>
            <div class="chips">
              @for (d of durations; track d) {
                <button
                  type="button"
                  class="chip"
                  [class.on]="duration() === d"
                  (click)="duration.set(d)"
                >
                  {{ formatDurationLabel(d) }}
                </button>
              }
            </div>
          </div>

          <div class="alert info">
            <span>ℹ</span>
            <div>
              <b>Aprobación requerida.</b> Al enviar la solicitud, la empresa recibirá un aviso en su panel para autorizar el acceso.
            </div>
          </div>

          <div class="alert warn" style="font-size:12px">
            <span>⚡</span>
            <div>
              ¿Incidente crítico que no puede esperar?
              <a href="javascript:void(0)" (click)="state.set('emergency')" style="font-weight:600;margin-left:4px">
                Usar acceso de emergencia…
              </a>
            </div>
          </div>

          <div class="dialog-actions">
            <button type="button" class="btn ghost" (click)="close()">
              Cancelar
            </button>
            <button
              type="button"
              class="btn primary"
              [disabled]="!canSubmit() || busy()"
              (click)="iniciar()"
            >
              {{ busy() ? 'Enviando…' : 'Solicitar acceso de soporte' }}
            </button>
          </div>
        }

        <!-- VISTA 2: ESPERANDO APROBACIÓN (px-espera) -->
        @if (state() === 'waiting') {
          <h2 class="dialog-title">Esperando a {{ tenant.trade_name }}</h2>
          <p class="dialog-desc">
            Enviamos la solicitud a los administradores de la empresa (aviso en su panel y por correo).
          </p>

          <div class="chk">
            <div>
              <span class="y">✔</span>
              <span>Solicitud enviada · {{ formatDurationLabel(duration()) }}</span>
              <span class="mono muted">Enviada</span>
            </div>
            <div>
              @if (sessionStatus() === 'approved') {
                <span class="y">✔</span>
                <span style="font-weight:600;color:var(--ok,#10b981)">Aprobada por la empresa</span>
                <span class="mono ok">Lista</span>
              } @else if (sessionStatus() === 'rejected') {
                <span style="color:var(--danger,#ef4444);font-weight:700">✖</span>
                <span style="color:var(--danger,#ef4444)">Rechazada: {{ rejectionReason() || 'Sin motivo' }}</span>
                <span class="mono danger">Rechazada</span>
              } @else if (sessionStatus() === 'request_expired') {
                <span style="color:var(--danger,#ef4444);font-weight:700">✖</span>
                <span style="color:var(--danger,#ef4444)">Expirada tras 10 minutos</span>
                <span class="mono danger">Vencida</span>
              } @else {
                <span class="w">…</span>
                <span>Aprobación de la empresa</span>
                <span class="mono muted">{{ countdown() }}</span>
              }
            </div>
            <div>
              @if (sessionStatus() === 'approved') {
                <span class="y">✔</span>
                <span>Sesión de soporte habilitada</span>
                <span class="mono ok">Habilitada</span>
              } @else {
                <span class="p">…</span>
                <span>Sesión de soporte</span>
                <span class="mono muted">—</span>
              }
            </div>
          </div>

          @if (errorMessage()) {
            <div class="alert danger"><span>⚠</span><div>{{ errorMessage() }}</div></div>
          }

          <div class="alert danger">
            <span>⛔</span>
            <div>
              <b>Acceso de emergencia</b> Solo si hay un incidente grave que no puede esperar. Requiere motivo (≥ 20 chars), avisa al instante y queda marcado en rojo.
              <a href="javascript:void(0)" (click)="state.set('emergency')" style="font-weight:600;margin-left:4px">
                Usar acceso de emergencia…
              </a>
            </div>
          </div>

          <div class="dialog-actions">
            <button type="button" class="btn ghost" (click)="close()">
              Cancelar solicitud
            </button>
            <button
              type="button"
              class="btn primary"
              [disabled]="sessionStatus() !== 'approved' || busy()"
              (click)="entrarAprobada()"
            >
              {{ busy() ? 'Entrando…' : 'Entrar (cuando aprueben)' }}
            </button>
          </div>
        }

        <!-- VISTA 3: ACCESO DE EMERGENCIA -->
        @if (state() === 'emergency') {
          <h2 class="dialog-title" style="color:var(--danger,#ef4444)">⛔ Acceso de emergencia a {{ tenant.trade_name }}</h2>
          <p class="dialog-desc">
            Este acceso entra de inmediato sin aprobación previa. Requiere un motivo detallado (mínimo 20 caracteres), envía un correo urgente a la empresa y queda marcado en rojo.
          </p>

          <div class="reason-field">
            <label for="emergency-reason">Motivo de emergencia *</label>
            <textarea
              id="emergency-reason"
              [(ngModel)]="emergencyReason"
              [class.err]="errorMessage()"
              placeholder="Ej. Caída crítica en servicio de facturación afectando cobros de la empresa"
              (input)="onEmergencyInput()"
            ></textarea>
            @if (errorMessage()) {
              <span class="err-text">{{ errorMessage() }}</span>
            } @else {
              <span class="hint"
                >Mínimo 20 caracteres (actual: {{ emergencyReason.trim().length }}/300).
                Obligatorio para auditoría.</span
              >
            }
          </div>

          <div class="duration-selector">
            <span class="label">Duración máxima de emergencia</span>
            <div class="chips">
              <button
                type="button"
                class="chip"
                [class.on]="emergencyDuration() === 15"
                (click)="emergencyDuration.set(15)"
              >
                15 min
              </button>
              <button
                type="button"
                class="chip"
                [class.on]="emergencyDuration() === 30"
                (click)="emergencyDuration.set(30)"
              >
                30 min
              </button>
            </div>
          </div>

          <div class="dialog-actions">
            <button type="button" class="btn ghost" (click)="state.set(pendingSessionId() ? 'waiting' : 'form')">
              Volver
            </button>
            <button
              type="button"
              class="btn danger"
              [disabled]="emergencyReason.trim().length < 20 || busy()"
              (click)="iniciarEmergencia()"
            >
              {{ busy() ? 'Entrando…' : 'Entrar con emergencia' }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './iniciar-soporte-dialog.component.scss',
})
export class IniciarSoporteDialogComponent implements OnDestroy {
  @Input({ required: true }) tenant!: { id: string; trade_name: string; slug?: string };
  @Output() closed = new EventEmitter<boolean>();

  private soporte = inject(SoporteService);
  private api = inject(PlataformaApi);

  readonly state = signal<DialogState>('form');
  readonly durations = SUPPORT_DURATIONS;
  readonly duration = signal<number>(60);
  reason = '';
  busy = signal(false);
  errorMessage = signal<string | null>(null);

  // Estado de espera
  readonly pendingSessionId = signal<string | null>(null);
  readonly sessionStatus = signal<string>('pending_approval');
  readonly rejectionReason = signal<string | null>(null);
  readonly countdown = signal<string>('10:00');
  private pollTimer: any = null;
  private countdownTimer: any = null;
  private requestExpiresAt: string | null = null;

  // Estado de emergencia
  emergencyReason = '';
  readonly emergencyDuration = signal<number>(30);

  ngOnDestroy() {
    this.detenerSondeo();
  }

  canSubmit(): boolean {
    return isValidReason(this.reason);
  }

  onInput(): void {
    if (this.errorMessage()) {
      this.errorMessage.set(null);
    }
  }

  onEmergencyInput(): void {
    if (this.errorMessage()) {
      this.errorMessage.set(null);
    }
  }

  formatDurationLabel(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = minutes / 60;
    return h === 1 ? '60 min' : `${h} h`;
  }

  onBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('dialog-backdrop')) {
      this.close();
    }
  }

  close(): void {
    this.detenerSondeo();
    this.closed.emit(false);
  }

  async iniciar(): Promise<void> {
    if (!this.canSubmit() || this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const result = await this.soporte.iniciar(this.tenant, this.reason.trim(), this.duration());
      this.busy.set(false);

      if (result.session?.status === 'pending_approval') {
        this.pendingSessionId.set(result.session.id);
        this.requestExpiresAt = result.session.request_expires_at || null;
        this.state.set('waiting');
        this.iniciarSondeo(result.session.id);
      } else {
        this.closed.emit(true);
      }
    } catch (err: any) {
      this.busy.set(false);
      this.errorMessage.set(err.error?.message || 'Error al iniciar la solicitud de soporte.');
    }
  }

  private iniciarSondeo(sessionId: string) {
    this.detenerSondeo();

    // Temporizador de cuenta regresiva
    this.countdownTimer = setInterval(() => {
      if (!this.requestExpiresAt) {
        this.countdown.set('10:00');
        return;
      }
      const diffMs = new Date(this.requestExpiresAt).getTime() - Date.now();
      if (diffMs <= 0) {
        this.countdown.set('vencida');
        this.sessionStatus.set('request_expired');
        this.detenerSondeo();
        return;
      }
      const s = Math.floor(diffMs / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      this.countdown.set(`vence en ${mm}:${ss}`);
    }, 1000);

    // Sondeo al backend cada 5 segundos
    this.pollTimer = setInterval(async () => {
      try {
        const session: SupportSession = await firstValueFrom(this.api.getSupportSession(sessionId));
        this.sessionStatus.set(session.status || 'pending_approval');
        if (session.status === 'approved') {
          this.detenerSondeo();
        } else if (session.status === 'rejected') {
          this.rejectionReason.set(session.decision_reason || null);
          this.detenerSondeo();
        } else if (session.status === 'request_expired') {
          this.detenerSondeo();
        }
      } catch {
        /* ignore polling errors */
      }
    }, 5000);
  }

  private detenerSondeo() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  async entrarAprobada(): Promise<void> {
    const id = this.pendingSessionId();
    if (!id || this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set(null);

    try {
      const start = await firstValueFrom(this.api.enterSupportSession(id));
      await this.soporte.entrar(start, this.tenant);
      this.closed.emit(true);
    } catch (err: any) {
      this.busy.set(false);
      this.errorMessage.set(err.error?.message || 'Error al entrar a la sesión aprobada.');
    }
  }

  async iniciarEmergencia(): Promise<void> {
    const reason = this.emergencyReason.trim();
    if (reason.length < 20 || this.busy()) return;

    this.busy.set(true);
    this.errorMessage.set(null);

    try {
      const start = await firstValueFrom(
        this.api.emergencySupport({
          tenant_id: this.tenant.id,
          reason,
          duration_minutes: this.emergencyDuration(),
        })
      );
      await this.soporte.entrar(start, this.tenant);
      this.closed.emit(true);
    } catch (err: any) {
      this.busy.set(false);
      this.errorMessage.set(err.error?.message || 'Error al iniciar sesión de emergencia.');
    }
  }
}
