import { Component, DestroyRef, ElementRef, OnDestroy, ViewChild, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { CommerceService } from '../infrastructure/commerce.service';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { CatalogService } from '../../usuarios-catalogo/infrastructure/catalog.service';
import { Entity, ProductDraftInput } from '../../usuarios-catalogo/domain/catalog.models';
import { DashboardService } from '../../ia-reportes/infrastructure/dashboard.service';
import { ExportReport, InterpretResult, ReportQuery } from '../../ia-reportes/domain/dashboard';
import { IconComponent } from '../../../shared/icon.component';
import { BotAvatarComponent, BotState } from '../../../shared/bot-avatar.component';
import { AssistantContextService } from '../../../shared/assistant-context.service';
import { errorMessage } from '../../../shared/errors';
import { ApiService } from '../../../app/core/shared/api.service';
import { assistantIntent, clearsFilter, commandText, queryForCommand, requestedReports } from '../application/assistant-intent';
import { AssistantAction, ParsedAction, resolveAction } from '../application/assistant-actions';
import { Page } from '../../../shared/models';

const EXPORT_REPORT_LABEL: Record<ExportReport, string> = {
  ventas: 'ventas', pedidos: 'pedidos', pagos: 'pagos',
  prendas_vendidas: 'prendas vendidas', existencias: 'existencias', sucursales: 'sucursales',
};
/** Deduce el tipo de reporte a exportar: primero por palabra explícita en el
 * pedido, y si no hay ninguna, por lo que interpretó la IA de la consulta.
 * `null` cuando lo pedido (p.ej. "reservas" o "dashboard") no es uno de los
 * seis reportes exportables como archivo.
 * Orden importante: los sustantivos de reporte concretos (ventas, pedidos,
 * pagos, existencias) ganan a "sucursal", porque "ventas de la sucursal
 * central" es el reporte de ventas filtrado por esa sucursal y no el reporte
 * comparativo de sucursales. */
function exportReportType(text: string, interpreted: InterpretResult): ExportReport | null {
  const t = text.toLowerCase();
  if (/prendas vendidas|mas vendid/.test(t)) return 'prendas_vendidas';
  if (/existencia|stock/.test(t)) return 'existencias';
  if (/pago/.test(t)) return 'pagos';
  if (/pedido/.test(t)) return 'pedidos';
  if (/venta/.test(t)) return 'ventas';
  if (/sucursal/.test(t)) return 'sucursales';
  if (interpreted.agrupacion === 'sucursal' || interpreted.vista === 'sucursales') return 'sucursales';
  if (interpreted.metrica === 'low_stock') return 'existencias';
  if (interpreted.metrica === 'units') return 'prendas_vendidas';
  if (interpreted.metrica === 'orders') return 'pedidos';
  if (interpreted.metrica === 'revenue' || interpreted.metrica === 'ticket') return 'ventas';
  return null;
}

interface ChatEntry {
  from: 'user' | 'assistant';
  text: string;
}

interface UserDraft {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  document_number: string;
  password: string;
  role_ids: string[];
  is_verified: boolean;
}

/** Tarjeta de confirmación visible: la acción muta solo con el botón Confirmar.
 * `restricted` exige teclear `requiredText` para poder confirmar. */
interface ConfirmCard {
  actionId: string;
  title: string;
  lines: string[];
  confirmLabel: string;
  restricted: boolean;
  requiredText: string;
  detailUrl?: string;
  handleConfirm: () => Promise<void>;
}

/** Borrador simple (categoría, proveedor, promoción): campos editables en el
 * chat y un solo botón de confirmación que llama al endpoint existente. */
interface SimpleDraftField {
  key: string;
  label: string;
  required: boolean;
  type?: 'text' | 'number';
}

interface SimpleDraft {
  title: string;
  fields: SimpleDraftField[];
  values: Record<string, string>;
}


const MODULE_LABELS: { prefix: string; label: string }[] = [
  { prefix: '/admin/reservas', label: 'Reservas (gestión)' },
  { prefix: '/admin/pedidos', label: 'Pedidos y pagos (gestión)' },
  { prefix: '/admin/stock', label: 'Existencias (gestión)' },
  { prefix: '/admin/bitacora', label: 'Bitácora' },
  { prefix: '/admin/dashboard', label: 'Dashboard de reportes' },
  { prefix: '/admin/products', label: 'Prendas (gestión)' },
  { prefix: '/admin', label: 'Administración' },
  { prefix: '/reservar', label: 'Nueva reserva' },
  { prefix: '/mi-cuenta/reservas', label: 'Mis reservas' },
  { prefix: '/mi-cuenta/pedidos', label: 'Mis pedidos' },
  { prefix: '/mi-cuenta/direcciones', label: 'Mis direcciones' },
  { prefix: '/mi-cuenta', label: 'Mi cuenta' },
  { prefix: '/carrito', label: 'Carrito de compras' },
  { prefix: '/sucursales', label: 'Sucursales' },
  { prefix: '/vestidor', label: 'Vestidor virtual' },
  { prefix: '/prendas', label: 'Ficha de producto' },
].sort((a, b) => b.prefix.length - a.prefix.length);

const SUGGESTIONS = [
  '¿Cómo reservo una prenda para probármela?',
  '¿Qué talla me conviene?',
  '¿Cómo uso el vestidor virtual?',
  '¿Cómo sigo mi pedido?',
];

/** Asistente virtual: un unico robot SVG para boton de lanzamiento y cabecera
 * del chat, con panel ampliable/restaurable, entrada multilinea (Enter envia,
 * Shift+Enter salto de linea), reintento sin duplicar mensajes, "Ver respuesta
 * nueva" cuando el usuario no esta al pie, voz opcional que se detiene al
 * cerrar y estados de robot (procesando, respuesta lista, error). No se
 * muestran mensajes pendientes simulados. */
@Component({
  selector: 'fs-assistant-widget',
  imports: [FormsModule, IconComponent, BotAvatarComponent],
  styles: `
    :host { display: contents; }
    .ai-panel {
      width: min(470px, calc(100vw - 32px));
      height: min(680px, calc(100dvh - 96px));
    }
    .ai-panel.expanded { height: calc(100dvh - 40px); }
    .ai-widget { right: 22px; bottom: 22px; }
    .ai-launcher { width: 62px; height: 62px; }
    .ai-panel__actions { display: flex; gap: 2px; margin-left: auto; }
    .ai-panel__actions button, .ai-panel__close {
      min-width: 34px; min-height: 34px; padding: 6px; border-radius: 8px;
      background: none; border: 0; color: white; opacity: 0.85; cursor: pointer; display: grid;
      place-items: center;
    }
    .ai-panel__actions button:hover, .ai-panel__close:hover { opacity: 1; background: #ffffff26; }
    .ai-inputbar textarea {
      flex: 1; min-width: 0; min-height: 40px; max-height: 120px; resize: none;
      border-radius: 12px; padding: 9px 12px; font-size: 13.5px; line-height: 1.45;
    }
    .ai-btn--speaker.is-speaking { color: var(--accent); background: #f1e7eb; animation: ai-speak-pulse 1.1s ease-in-out infinite; }
    .ai-btn--mic.is-voice-mode:not(.is-listening) { color: var(--accent); background: #f1e7eb; }
    .ai-voice-status { margin: 0; padding: 0 12px 10px; color: var(--muted); font-size: 12px; }
    .ai-voice-error { margin: 0; padding: 0 12px 10px; color: #9b3c34; font-size: 12px; }
    .ai-chip { color: var(--accent); border: 0; background: none; font-size: 12px; min-height: 0;
      padding: 0; }
    .ai-new { align-self: center; justify-self: end; margin-top: 6px; }
    .ai-draft { display: grid; gap: 8px; background: white; border: 1px solid var(--line); border-radius: 12px;
      padding: 12px; font-size: 13px; }
    .ai-draft__title { margin: 0; font-weight: 600; font-size: 12.5px; }
    .ai-draft label { gap: 3px; font-size: 12px; }
    .ai-draft input, .ai-draft select, .ai-draft textarea { font-size: 13px; padding: 7px 9px; }
    .ai-draft__actions { display: flex; gap: 8px; }
    .ai-draft__actions button { flex: 1; min-height: 34px; }
    .ai-confirm { display: grid; gap: 8px; background: white; border: 1px solid var(--line);
      border-radius: 12px; padding: 12px; font-size: 13px; box-shadow: 0 2px 10px #0000001a; }
    .ai-confirm__line { margin: 0; line-height: 1.5; }
    .ai-confirm__key { gap: 3px; font-size: 12px; }
    .ai-confirm__key input { font-size: 13px; padding: 7px 9px; }
    .ai-confirm__chip { justify-self: start; padding: 0; }
    .ai-msg--assistant .button-text { font-size: inherit; }
    .ai-msg--typing { display: inline-flex; align-items: center; gap: 5px; }
    .ai-msg--typing .ai-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
      animation: ai-dot-blink 1.2s ease-in-out infinite; }
    .ai-msg--typing .ai-dot:nth-child(2) { animation-delay: 0.15s; }
    .ai-msg--typing .ai-dot:nth-child(3) { animation-delay: 0.3s; }
    .ai-msg--voice-draft { display: flex; align-items: center; gap: 8px; min-width: 168px; }
    .ai-msg--voice-draft small { margin-left: auto; color: #ffffffc9; font-variant-numeric: tabular-nums; }
    .ai-voice-wave { display: inline-flex; align-items: center; gap: 2px; height: 18px; }
    .ai-voice-wave i { width: 3px; height: 6px; border-radius: 999px; background: #fff; animation: ai-voice-wave 0.75s ease-in-out infinite alternate; }
    .ai-voice-wave i:nth-child(2) { height: 14px; animation-delay: 0.12s; }
    .ai-voice-wave i:nth-child(3) { height: 9px; animation-delay: 0.25s; }
    .ai-voice-wave i:nth-child(4) { height: 16px; animation-delay: 0.08s; }
    .ai-voice-wave i:nth-child(5) { height: 7px; animation-delay: 0.2s; }
    .ai-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;
      clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    @keyframes ai-dot-blink {
      0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-3px); }
    }
    @keyframes ai-speak-pulse { 50% { transform: scale(1.06); } }
    @keyframes ai-voice-wave { from { transform: scaleY(0.45); opacity: 0.65; } to { transform: scaleY(1); opacity: 1; } }
    @media (max-width: 600px) {
      .ai-widget { right: 12px; bottom: 12px; }
      .ai-launcher { width: 54px; height: 54px; }
      .ai-panel {
        position: fixed; top: 50%; left: 50%; width: calc(100dvw - 16px);
        height: calc(100dvh - 16px); transform: translate(-50%, -50%);
      }
      .ai-panel.expanded { height: calc(100dvh - 16px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ai-panel, .ai-widget, .ai-launcher { transition: none !important; }
      .ai-msg--typing .ai-dot { animation: none; opacity: 0.55; }
    }
  `,
  template: `<div class="ai-widget" [class.open]="open()">
    <button
      class="ai-launcher"
      type="button"
      (click)="toggle()"
      [attr.aria-expanded]="open()"
      aria-label="Asistente de FashionStore"
    >
      <span class="ai-bot" aria-hidden="true"><fs-bot-avatar [state]="botState()" /></span>
      <span class="ai-launcher__badge" aria-hidden="true">IA</span>
    </button>
    @if (open()) {
      <section class="ai-panel" [class.expanded]="expanded()" id="assistant-panel" role="dialog"
        aria-modal="false" aria-labelledby="assistant-title">
        <header class="ai-panel__head">
          <span class="ai-panel__avatar" aria-hidden="true"><fs-bot-avatar [state]="botState()" /></span>
          <span class="ai-panel__title" id="assistant-title"
            >Asistente FashionStore<small>{{ contextLabel() }}</small></span
          >
          <div class="ai-panel__actions">
            <button type="button" (click)="expanded.set(!expanded())"
              [attr.aria-label]="expanded() ? 'Restaurar tamaño del diálogo' : 'Ampliar diálogo'">
              <fs-icon [name]="expanded() ? 'reduce' : 'maximize'" />
            </button>
            <button type="button" (click)="minimize()" aria-label="Minimizar diálogo">
              <fs-icon name="arrow-down" />
            </button>
            <button class="ai-panel__close" type="button" (click)="close()" aria-label="Cerrar asistente">
              <fs-icon name="close" />
            </button>
          </div>
        </header>
        <div class="ai-messages" #log (scroll)="onScroll()">
          @if (!history().length && !busy()) {
            <p class="ai-hint">
              Hola{{ greetName() }}. Preguntame sobre tallas, reservas, el vestidor virtual o cómo
              usar cualquier parte del sitio.
            </p>
            <div class="ai-suggest">
              @for (q of suggestions(); track q) {
                <button type="button" (click)="send(q)">{{ q }}</button>
              }
            </div>
          }
          @for (m of history(); track $index) {
            <p [class]="'ai-msg ai-msg--' + m.from">{{ m.text }}</p>
          }
          @if (voiceMode() && !busy() && (listening() || voiceTranscript())) {
            <p class="ai-msg ai-msg--user ai-msg--voice-draft" aria-live="polite">
              <fs-icon name="mic" />
              <span class="ai-voice-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
              <span>{{ voiceTranscript() || 'Escuchando…' }}</span>
              <small>{{ voiceElapsedLabel() }}</small>
            </p>
          }
          @for (file of downloads(); track file.url) {
            <a class="button" [href]="file.url" [download]="file.name">Descargar {{ file.name }}</a>
          }
          @if (productDraft(); as d) {
            <form class="ai-draft" (ngSubmit)="confirmDraft()">
              <p class="ai-draft__title">Prenda a registrar — revisá antes de crear</p>
              <label>Nombre<input name="draftName" [(ngModel)]="d.name" required maxlength="180" /></label>
              <label>Precio (Bs)<input name="draftPrice" type="number" min="0" step="0.01" [(ngModel)]="d.base_price" required /></label>
              <label>Categoría
                <select name="draftCategory" [(ngModel)]="d.category_id" required>
                  <option value="" disabled>Elegí una categoría</option>
                  @for (c of draftCategories(); track c.id) { <option [value]="c.id">{{ c['name'] }}</option> }
                </select>
              </label>
              <label>Descripción<textarea name="draftDescription" rows="2" [(ngModel)]="d.description" required maxlength="2000"></textarea></label>
              <div class="ai-draft__actions">
                <button type="submit" class="primary" [disabled]="draftBusy()">{{ draftBusy() ? 'Creando…' : 'Crear prenda' }}</button>
                <button type="button" (click)="discardDraft()" [disabled]="draftBusy()">Descartar</button>
              </div>
            </form>
          }
          @if (userDraft(); as d) {
            <form class="ai-draft" (ngSubmit)="confirmUserDraft()">
              <p class="ai-draft__title">Usuario a registrar — revisá antes de crear</p>
              <label>Correo<input name="userEmail" type="email" [(ngModel)]="d.email" required maxlength="254" /></label>
              <label>Nombres<input name="userFirstName" [(ngModel)]="d.first_name" required minlength="2" maxlength="100" /></label>
              <label>Apellidos<input name="userLastName" [(ngModel)]="d.last_name" required minlength="2" maxlength="100" /></label>
              <label>Teléfono<input name="userPhone" [(ngModel)]="d.phone" maxlength="30" /></label>
              <label>Documento<input name="userDocument" [(ngModel)]="d.document_number" maxlength="50" /></label>
              <label>Contraseña inicial<input name="userPassword" type="password" [(ngModel)]="d.password" required minlength="12" maxlength="128" autocomplete="new-password" />
                <small>Ingresala manualmente; no se toma del chat ni de la voz.</small>
              </label>
              <label>Roles
                <select name="userRoles" [(ngModel)]="d.role_ids" required multiple size="3">
                  @for (role of draftRoles(); track role.id) { <option [value]="role.id">{{ role['name'] }}</option> }
                </select>
              </label>
              <label class="check"><input name="userVerified" type="checkbox" [(ngModel)]="d.is_verified" />Correo ya verificado</label>
              <div class="ai-draft__actions">
                <button type="submit" class="primary" [disabled]="draftBusy()">{{ draftBusy() ? 'Creando…' : 'Crear usuario' }}</button>
                <button type="button" (click)="discardUserDraft()" [disabled]="draftBusy()">Descartar</button>
              </div>
            </form>
          }
          @if (simpleDraft(); as d) {
            <form class="ai-draft" (ngSubmit)="confirmSimpleDraft()">
              <p class="ai-draft__title">{{ d.title }}</p>
              @for (f of d.fields; track f.key) {
                <label>{{ f.label }}
                  <input [name]="f.key" [type]="f.type || 'text'" [(ngModel)]="d.values[f.key]" [required]="f.required" />
                </label>
              }
              <div class="ai-draft__actions">
                <button type="submit" class="primary" [disabled]="simpleBusy()">{{ simpleBusy() ? 'Creando…' : 'Confirmar y crear' }}</button>
                <button type="button" (click)="simpleDraft.set(null)" [disabled]="simpleBusy()">Descartar</button>
              </div>
            </form>
          }
          @if (confirmCard(); as c) {
            <div class="ai-confirm" role="alertdialog" aria-label="Confirmación de acción">
              <p class="ai-draft__title">{{ c.title }}</p>
              @for (line of c.lines; track line) {
                <p class="ai-confirm__line">{{ line }}</p>
              }
              @if (c.detailUrl) {
                <button type="button" class="ai-chip ai-confirm__chip" (click)="openDetail(c)">Ver detalle</button>
              }
              @if (c.restricted) {
                <label class="ai-confirm__key">Escribí «{{ c.requiredText }}» para confirmar
                  <input [(ngModel)]="confirmInput" [attr.placeholder]="c.requiredText" autocomplete="off" spellcheck="false" />
                </label>
              }
              <div class="ai-draft__actions">
                <button type="button" class="primary" [disabled]="confirmBusy() || (c.restricted && confirmInput() !== c.requiredText)"
                  (click)="runConfirmation()">{{ confirmBusy() ? 'Confirmando…' : c.confirmLabel }}</button>
                <button type="button" (click)="editConfirmation()" [disabled]="confirmBusy()">Editar</button>
                <button type="button" (click)="dismissConfirmation()" [disabled]="confirmBusy()">Cancelar</button>
              </div>
            </div>
          }
          @if (busy()) {
            <p class="ai-msg ai-msg--assistant ai-msg--typing" role="status">
              <span class="ai-dot" aria-hidden="true"></span>
              <span class="ai-dot" aria-hidden="true"></span>
              <span class="ai-dot" aria-hidden="true"></span>
              <span class="ai-sr">El asistente está escribiendo</span>
            </p>
          }
          @if (error()) {
            <p class="alert error" role="alert">{{ error() }}</p>
            <button type="button" class="ai-chip" (click)="retry()">Reintentar</button>
          }
          @if (showNew()) {
            <button type="button" class="ai-new button primary" (click)="jumpToNew()">
              Ver respuesta nueva
            </button>
          }
        </div>
        <form class="ai-inputbar" (ngSubmit)="send()">
          <textarea
            name="message"
            rows="1"
            [(ngModel)]="draft"
            maxlength="1000"
            placeholder="Escribí o hablá…"
            [disabled]="busy()"
            aria-label="Mensaje al asistente"
            (keydown)="onKeydown($event)"
            (input)="grow($event)"
          ></textarea>
          @if (voiceSupported) {
            <button
              type="button"
              class="ai-btn ai-btn--mic"
              [class.is-listening]="listening()"
              [class.is-voice-mode]="voiceMode()"
              (click)="toggleVoice()"
              [attr.aria-pressed]="voiceMode()"
              [attr.aria-label]="voiceMode() ? 'Detener conversación por voz' : 'Iniciar conversación por voz'"
              [attr.title]="voiceMode() ? 'Detener conversación por voz' : 'Hablar con el asistente'"
            >
              <fs-icon name="mic" />
            </button>
          }
          @if (speechOutputSupported) {
            <button
              type="button"
              class="ai-btn ai-btn--speaker"
              [class.is-speaking]="speaking()"
              (click)="toggleVoiceOutput()"
              [attr.aria-pressed]="voiceOutputEnabled()"
              [attr.aria-label]="voiceOutputEnabled() ? 'Silenciar respuestas por voz' : 'Activar respuestas por voz'"
            >
              <fs-icon [name]="voiceOutputEnabled() ? 'volume' : 'volume-off'" />
            </button>
          }
          <button
            class="ai-btn ai-btn--send"
            type="submit"
            [disabled]="busy() || !draft.trim()"
            aria-label="Enviar"
          >
            <fs-icon name="arrow-right" />
          </button>
        </form>
        @if (voiceMode()) {
          <p class="ai-voice-status" role="status">
            {{ voiceTranscribing() ? 'Transcribiendo tu audio…' : listening() ? 'Grabando. Tocá el micrófono para enviar tu mensaje.' : speaking() ? 'Te respondo por voz…' : busy() ? 'Entendí tu mensaje y estoy preparando la respuesta…' : 'Preparando el micrófono…' }}
          </p>
        }
        @if (voiceError()) {
          <p class="ai-voice-error" role="alert">{{ voiceError() }}</p>
        }
      </section>
    }
  </div>`,
})
export class AssistantWidgetComponent implements OnDestroy {
  private commerce = inject(CommerceService);
  private session = inject(SessionService);
  private catalog = inject(CatalogService);
  private api = inject(ApiService);
  private dashboard = inject(DashboardService);
  private router = inject(Router);
  private assistantContext = inject(AssistantContextService);
  private destroyRef = inject(DestroyRef);
  @ViewChild('log') private logRef?: ElementRef<HTMLDivElement>;
  open = signal(false);
  expanded = signal(false);
  draft = '';
  busy = signal(false);
  error = signal('');
  listening = signal(false);
  speaking = signal(false);
  voiceOutputEnabled = signal(true);
  /** Una sesión conversa por turnos: escucha, envía, responde y vuelve a escuchar. */
  voiceMode = signal(false);
  voiceError = signal('');
  /** Texto parcial del turno activo; se muestra como una nota de voz temporal. */
  voiceTranscript = signal('');
  voiceElapsedSeconds = signal(0);
  voiceTranscribing = signal(false);
  history = signal<ChatEntry[]>([]);
  downloads = signal<{ url: string; name: string }[]>([]);
  private lastExport: { reports: ExportReport[]; query: ReportQuery } | null = null;
  showNew = signal(false);
  /** Borrador de prenda pendiente de revisión (null = no hay ninguno abierto). */
  productDraft = signal<ProductDraftInput | null>(null);
  /** Los datos sensibles del usuario (en especial la contraseña) nunca se
   * deducen ni se conservan en el mensaje del asistente. */
  userDraft = signal<UserDraft | null>(null);
  draftRoles = signal<Entity[]>([]);
  draftCategories = signal<Entity[]>([]);
  draftBusy = signal(false);
  /** Borrador simple de gestión (categoría, proveedor o promoción). */
  simpleDraft = signal<SimpleDraft | null>(null);
  simpleBusy = signal(false);
  /** Acción mutadora pendiente de confirmación visible. */
  confirmCard = signal<ConfirmCard | null>(null);
  confirmInput = signal('');
  confirmBusy = signal(false);
  currentModule = signal(this.resolveModule(this.router.url));
private lastUserText = '';
  private conversationVersion = 0;
  private sessionUserId = this.session.user()?.id ?? null;
  /** A qué handler reintentar: los pedidos de reporte y el borrador de prenda
   * usan flujos distintos al chat general, y "Reintentar" debe repetir el
   * mismo y no caer en el chat general. */
  private lastIntent: 'chat' | 'draft' | 'user_draft' | 'export' | 'explain' | 'apply' | 'action' = 'chat';
  /** Última acción del registro central, para reintentar el mismo camino. */
  private lastActionCall: { action: AssistantAction; parsed: ParsedAction; text: string } | null = null;
  botState = signal<BotState>('idle');
  /** Reconocimiento local opcional: sólo da texto visible en tiempo real.
   * La transcripción del backend sigue siendo el respaldo confiable. */
  private recognition: any;
  private browserTranscript = '';
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioChunks: BlobPart[] = [];
  /** Detecta el final natural de una indicación. El usuario puede tocar el
   * micrófono otra vez si prefiere terminarla antes. */
  private voiceAudioContext: AudioContext | null = null;
  private voiceAnalyser: AnalyserNode | null = null;
  private voiceActivityFrame: number | null = null;
  private voiceHasSpeech = false;
  private voiceLastSpeechAt = 0;
  private utterance: SpeechSynthesisUtterance | null = null;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private voiceDurationTimer: ReturnType<typeof setInterval> | null = null;
  private voiceStartedAt = 0;
  readonly voiceSupported: boolean;
  readonly speechOutputSupported: boolean;

  constructor() {
    this.voiceSupported =
      typeof window !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined';
    this.speechOutputSupported =
      typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
    // Toda respuesta nueva se puede oír. Se cancela la anterior para que el
    // asistente no acumule frases atrasadas si el usuario cambia de consulta.
    let processedMessages = 0;
    effect(() => {
      const messages = this.history();
      if (messages.length < processedMessages) processedMessages = 0;
      const newMessages = messages.slice(processedMessages);
      processedMessages = messages.length;
      const latestReply = [...newMessages].reverse().find((message) => message.from === 'assistant');
      if (latestReply) untracked(() => this.speak(latestReply.text));
    });
    effect(() => {
      const id = this.session.user()?.id ?? null;
      if (id !== this.sessionUserId) {
        this.sessionUserId = id;
        untracked(() => this.close());
      }
    });
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.currentModule.set(this.resolveModule(e.urlAfterRedirects)));
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionCtor) {
      this.recognition = new SpeechRecognitionCtor();
      // `es-ES` es la variante más ampliamente atendida por los motores de
      // navegador; el backend sigue recibiendo español sin depender de esto.
      this.recognition.lang = 'es-ES';
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.addEventListener('result', (event: any) => {
        const text = Array.from(event.results as any[])
          .map((result: any) => result[0]?.transcript ?? '')
          .join(' ')
          .trim();
        if (!text || !this.voiceMode()) return;
        this.browserTranscript = text;
        this.voiceTranscript.set(text);
      });
    }
    this.destroyRef.onDestroy(() => this.stopVoice());
  }

  toggle() {
    if (this.open()) this.minimize();
    else {
      this.error.set('');
      this.open.set(true);
    }
  }
  minimize() {
    this.stopVoice();
    this.stopSpeaking();
    this.open.set(false);
  }
  close() {
    this.conversationVersion++;
    this.stopVoice();
    this.stopSpeaking();
    this.open.set(false);
    this.history.set([]);
    this.error.set('');
    this.productDraft.set(null);
    this.userDraft.set(null);
    this.clearDownloads();
  }
  async toggleVoice() {
    if (!this.voiceSupported) {
      this.voiceError.set('La grabación no está disponible en este navegador. Usá Chrome, Edge o Safari actualizado y permití el micrófono.');
      return;
    }
    if (this.listening()) {
      this.finishVoiceRecording();
      return;
    }
    if (this.voiceTranscribing()) return;
    this.voiceError.set('');
    this.stopSpeaking();
    await this.startVoiceRecording();
  }
  stopVoice() {
    this.voiceMode.set(false);
    this.voiceTranscribing.set(false);
    this.stopBrowserTranscript();
    this.voiceTranscript.set('');
    this.stopVoiceDuration();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        /* la grabación ya terminó */
      }
    }
    this.releaseVoiceStream();
    this.listening.set(false);
  }
  toggleVoiceOutput() {
    this.voiceOutputEnabled.update((enabled) => !enabled);
    if (!this.voiceOutputEnabled()) this.stopSpeaking();
  }
  private speak(text: string) {
    if (!this.speechOutputSupported || !this.voiceOutputEnabled() || !text.trim()) return;
    this.stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-BO';
    utterance.rate = 1;
    utterance.onstart = () => this.speaking.set(true);
    utterance.onend = utterance.onerror = () => {
      if (this.utterance === utterance) {
        this.speaking.set(false);
      }
    };
    this.utterance = utterance;
    window.speechSynthesis.speak(utterance);
  }
  private stopSpeaking() {
    if (!this.speechOutputSupported) return;
    window.speechSynthesis.cancel();
    this.utterance = null;
    this.speaking.set(false);
  }
  private async startVoiceRecording() {
    if (!this.voiceSupported || this.listening() || this.voiceTranscribing()) return;
    this.voiceMode.set(true);
    this.voiceTranscript.set('Grabando audio…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!this.voiceMode()) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.mediaStream = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
        .find(type => typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      this.mediaRecorder = recorder;
      this.audioChunks = [];
      recorder.addEventListener('dataavailable', (event: BlobEvent) => {
        if (event.data.size) this.audioChunks.push(event.data);
      });
      recorder.addEventListener('stop', () => void this.onVoiceRecordingStopped());
      recorder.start(250);
      this.listening.set(true);
      this.startVoiceDuration();
      this.startVoiceActivityDetection(stream);
      this.startBrowserTranscript();
    } catch (error: any) {
      this.voiceMode.set(false);
      this.voiceTranscript.set('');
      this.voiceError.set(this.voiceErrorMessage(error?.name));
      this.releaseVoiceStream();
    }
  }
  private finishVoiceRecording() {
    const recorder = this.mediaRecorder;
    if (!recorder || recorder.state === 'inactive') return;
    this.listening.set(false);
    // Conserva la duración en pantalla mientras se transcribe el audio.
    this.stopVoiceDuration(false);
    this.stopVoiceActivityDetection();
    this.voiceTranscribing.set(true);
    this.voiceTranscript.set('Transcribiendo tu audio…');
    this.stopBrowserTranscript();
    recorder.stop();
  }
  private async onVoiceRecordingStopped() {
    const shouldTranscribe = this.voiceMode() && this.voiceTranscribing();
    const type = this.mediaRecorder?.mimeType || 'audio/webm';
    const audio = new Blob(this.audioChunks, { type });
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.releaseVoiceStream();
    if (!shouldTranscribe) return;
    // Espera el resultado final del reconocimiento local si está disponible.
    await new Promise(resolve => setTimeout(resolve, 240));
    if (audio.size < 400) {
      this.voiceMode.set(false);
      this.voiceTranscribing.set(false);
      this.voiceTranscript.set('');
      this.stopVoiceDuration();
      this.voiceError.set('El audio fue demasiado corto. Mantené el micrófono activo mientras decís tu indicación.');
      return;
    }
    try {
      const localText = this.browserTranscript.trim();
      const result = await this.commerce.transcribeVoice(audio);
      if (!this.voiceMode()) return;
      this.voiceMode.set(false);
      this.voiceTranscribing.set(false);
      this.voiceTranscript.set('');
      this.stopVoiceDuration();
      const text = result.text?.trim();
      // El reconocimiento del navegador solamente muestra progreso. La
      // transcripción del audio completo es la fuente principal para no
      // enviar frases parciales o equivocadas. Si el proveedor no responde,
      // usamos el texto local ya visible como último respaldo.
      if (result.available && text) {
        await this.send(text);
        return;
      }
      if (localText) {
        await this.send(localText);
        return;
      }
      throw new Error(result.message || 'No pude entender el audio.');
    } catch (error) {
      this.voiceMode.set(false);
      this.voiceTranscribing.set(false);
      this.voiceTranscript.set('');
      this.stopVoiceDuration();
      this.voiceError.set(errorMessage(error));
    }
  }
  private releaseVoiceStream() {
    this.stopVoiceActivityDetection();
    this.mediaStream?.getTracks().forEach(track => track.stop());
    this.mediaStream = null;
  }
  private startVoiceDuration() {
    this.stopVoiceDuration();
    this.voiceStartedAt = Date.now();
    this.voiceElapsedSeconds.set(0);
    this.voiceDurationTimer = setInterval(() => {
      this.voiceElapsedSeconds.set(Math.floor((Date.now() - this.voiceStartedAt) / 1000));
    }, 250);
  }
  private stopVoiceDuration(reset = true) {
    if (this.voiceDurationTimer) clearInterval(this.voiceDurationTimer);
    this.voiceDurationTimer = null;
    if (reset) this.voiceElapsedSeconds.set(0);
  }
  private startVoiceActivityDetection(stream: MediaStream) {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor || typeof window.requestAnimationFrame !== 'function') return;
    try {
      const context: AudioContext = new AudioContextCtor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      this.voiceAudioContext = context;
      this.voiceAnalyser = analyser;
      this.voiceHasSpeech = false;
      this.voiceLastSpeechAt = 0;
      const samples = new Uint8Array(analyser.fftSize);
      const checkActivity = () => {
        if (!this.listening() || !this.voiceAnalyser) return;
        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) {
          const value = (sample - 128) / 128;
          energy += value * value;
        }
        const rms = Math.sqrt(energy / samples.length);
        const now = Date.now();
        // El valor evita considerar el ruido ambiente normal como una frase.
        if (rms > 0.018) {
          this.voiceHasSpeech = true;
          this.voiceLastSpeechAt = now;
        }
        if (this.voiceHasSpeech && now - this.voiceLastSpeechAt > 1400) {
          this.finishVoiceRecording();
          return;
        }
        this.voiceActivityFrame = window.requestAnimationFrame(checkActivity);
      };
      this.voiceActivityFrame = window.requestAnimationFrame(checkActivity);
    } catch {
      // La grabación continúa y conserva el botón manual en navegadores que
      // no permiten analizar el flujo de audio.
    }
  }
  private stopVoiceActivityDetection() {
    if (this.voiceActivityFrame !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.voiceActivityFrame);
    }
    this.voiceActivityFrame = null;
    this.voiceAnalyser = null;
    const context = this.voiceAudioContext;
    this.voiceAudioContext = null;
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
  }
  private startBrowserTranscript() {
    this.browserTranscript = '';
    if (!this.recognition) return;
    try {
      this.recognition.start();
    } catch {
      // Si el motor no está disponible, el audio grabado igual se transcribe.
    }
  }
  private stopBrowserTranscript() {
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch {
      /* ya se había detenido */
    }
  }
  voiceElapsedLabel() {
    const seconds = this.voiceElapsedSeconds();
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  private voiceErrorMessage(code?: string): string {
    if (code === 'NotAllowedError' || code === 'SecurityError') {
      return 'El navegador bloqueó el micrófono. Permitilo para FashionStore y volvé a tocar el botón de voz.';
    }
    if (code === 'NotFoundError') return 'No encontré un micrófono disponible. Conectá uno e intentá nuevamente.';
    return 'No pude iniciar la grabación. Revisá el permiso del micrófono e intentá nuevamente.';
  }
  greetName() {
    const name = this.session.user()?.first_name;
    return name ? ', ' + name : '';
  }
  contextLabel() {
    return this.currentModule() || 'Te acompaño en toda la tienda';
  }
  /** Sugerencias del panel vacío: las de siempre, más una por cada acción
   * extra que el usuario logueado puede pedirle al asistente que haga. */
  suggestions() {
    const list = [...SUGGESTIONS];
    if (this.session.can('dashboard.read')) {
      list.push('Exportame el reporte de ventas de este mes');
      list.push('Explicame por qué bajaron los pedidos pagados');
      list.push('Mostrame las ventas de la sucursal central');
    }
    if (this.session.can('catalog.write')) {
      list.push('Registrame una campera de cuero negra a 450 Bs');
    }
    if (this.session.can('users.write')) {
      list.push('Creá un usuario para Ana Pérez con correo ana@ejemplo.com');
    }
    return list;
  }
  private resolveModule(url: string): string {
    const path = url.split('?')[0];
    return MODULE_LABELS.find((m) => path === m.prefix || path.startsWith(m.prefix + '/'))?.label ?? '';
  }
  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }
  grow(event: Event) {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }
  onScroll() {
    const el = this.logRef?.nativeElement;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    if (nearBottom) this.showNew.set(false);
  }
  private scrollToBottom() {
    queueMicrotask(() => {
      const el = this.logRef?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
        this.showNew.set(false);
      }
    });
  }
  jumpToNew() {
    this.scrollToBottom();
  }
  private setBot(state: BotState) {
    this.botState.set(state);
    if (this.botTimer) clearTimeout(this.botTimer);
    if (state === 'success' || state === 'error') {
      this.botTimer = setTimeout(() => this.botState.set('idle'), 2600);
    }
  }
  async send(message?: string) {
    const text = (message ?? this.draft).trim();
    if (!text || this.busy()) return;
    this.draft = '';
    this.error.set('');
    this.lastUserText = text;
    this.history.update((h) => [...h, { from: 'user', text }]);
    this.scrollToBottom();
    // El registro central resuelve la orden: primer chequeo de permiso con el
    // catálogo de permisos del backend; el backend valida de nuevo al ejecutar.
    const registered = resolveAction(text);
    if (registered) {
      if (registered.action.permission && !this.session.can(registered.action.permission)) {
        this.history.update((h) => [
          ...h,
          {
            from: 'assistant',
            text: `Necesitás el permiso "${registered.action.permission}" para ${registered.action.module}. Pedile a un administrador que lo active en tu cuenta o pedime un reporte autorizado.`,
          },
        ]);
        return;
      }
      this.lastIntent = 'action';
      this.lastActionCall = { action: registered.action, parsed: registered.parsed, text };
      await this.handleAction(registered.action, registered.parsed, text);
      return;
    }
    const intent = assistantIntent(text);
    const required = intent === 'draft'
      ? 'catalog.write'
      : intent === 'user_draft'
        ? 'users.write'
        : intent !== 'chat'
          ? 'dashboard.read'
          : null;
    if (required && !this.session.can(required)) {
      this.history.update(h => [...h, { from: 'assistant', text: 'Tu cuenta no tiene permiso para realizar esa operación. Iniciá sesión con una cuenta autorizada.' }]);
      return;
    }
    if (intent === 'draft') {
      this.lastIntent = 'draft';
      await this.requestProductDraft(text);
    } else if (intent === 'user_draft') {
      this.lastIntent = 'user_draft';
      await this.requestUserDraft(text);
    } else if (intent === 'export') {
      this.lastIntent = 'export';
      await this.requestExport(text);
    } else if (intent === 'explain') {
      this.lastIntent = 'explain';
      await this.requestExplain(text);
    } else if (intent === 'apply') {
      this.lastIntent = 'apply';
      await this.requestApply(text);
    } else {
      this.lastIntent = 'chat';
      await this.sendToBackend();
    }
  }
  /** CU: "ayudame a registrar una prenda" — la IA propone los campos, pero
   * nunca crea nada sola: el admin revisa este borrador y confirma, igual que
   * un alta manual desde el catálogo. */
  private async requestProductDraft(text: string) {
    this.busy.set(true);
    this.setBot('processing');
    try {
      if (!this.draftCategories().length) {
        this.draftCategories.set(await firstValueFrom(this.catalog.reference('categories')));
      }
      const result = await this.catalog.draftProduct(text);
      if (!result.available) {
        this.history.update((h) => [
          ...h,
          { from: 'assistant', text: 'No pude preparar el borrador ahora mismo. Probá de nuevo o cargala manualmente desde el catálogo.' },
        ]);
        this.setBot('error');
        return;
      }
      this.productDraft.set({
        name: result.name,
        description: result.description,
        base_price: result.base_price,
        category_id: result.category_id ?? '',
        brand: result.brand,
        gender: result.gender,
      });
      this.history.update((h) => [
        ...h,
        {
          from: 'assistant',
          text: result.matched
            ? 'Preparé un borrador con lo que entendí. Revisalo abajo y confirmá para crearla.'
            : 'Preparé un borrador, pero no encontré una categoría exacta — elegí una antes de confirmar.',
        },
      ]);
      this.setBot('success');
    } catch (e) {
      this.setBot('error');
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
      const el = this.logRef?.nativeElement;
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 64) this.showNew.set(true);
      else this.scrollToBottom();
    }
  }
  async confirmDraft() {
    const d = this.productDraft();
    if (!d || this.draftBusy()) return;
    if (!d.category_id) {
      this.error.set('Elegí una categoría antes de crear la prenda.');
      return;
    }
    this.draftBusy.set(true);
    this.error.set('');
    try {
      const created = await this.catalog.createProduct(d);
      this.history.update((h) => [
        ...h,
        {
          from: 'assistant',
          text: `Prenda creada: "${created.name}". Podés agregarle tallas, colores e imágenes desde el editor de catálogo.`,
        },
      ]);
      this.productDraft.set(null);
      this.setBot('success');
    } catch (e) {
      this.error.set(errorMessage(e));
      this.setBot('error');
    } finally {
      this.draftBusy.set(false);
      this.scrollToBottom();
    }
  }
  discardDraft() {
    this.productDraft.set(null);
  }
  /** Prepara el alta desde texto o voz. La contraseña y los roles requieren
   * revisión humana: no se extraen de una conversación ni se crean sin el
   * botón de confirmación. */
  private async requestUserDraft(text: string) {
    this.busy.set(true);
    this.setBot('processing');
    try {
      if (!this.draftRoles().length) this.draftRoles.set(await firstValueFrom(this.api.get<Entity[]>('/roles')));
      const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0]?.toLowerCase() ?? '';
      const namePart = text.match(/(?:usuario|cuenta|empleado|cliente|administrador|vendedor)\s+(?:para\s+)?([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){0,2}?)(?=\s+(?:con\s+)?(?:correo|email|tel[eé]fono|documento)\b|$)/i)?.[1] ?? '';
      const names = namePart.split(/\s+/).filter(Boolean);
      this.userDraft.set({
        email,
        first_name: names[0] ?? '',
        last_name: names.slice(1).join(' '),
        phone: '',
        document_number: '',
        password: '',
        role_ids: [],
        is_verified: false,
      });
      this.history.update((h) => [...h, {
        from: 'assistant',
        text: 'Preparé el alta. Completá los datos, elegí al menos un rol e ingresá la contraseña inicial manualmente antes de confirmar.',
      }]);
      this.setBot('success');
    } catch (e) {
      this.setBot('error');
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
      this.scrollToBottom();
    }
  }
  async confirmUserDraft() {
    const d = this.userDraft();
    if (!d || this.draftBusy()) return;
    if (!d.role_ids.length) {
      this.error.set('Elegí al menos un rol antes de crear el usuario.');
      return;
    }
    if (d.password.length < 12) {
      this.error.set('La contraseña inicial debe tener al menos 12 caracteres.');
      return;
    }
    this.draftBusy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.write('POST', '/users', {
        email: d.email.trim().toLowerCase(),
        first_name: d.first_name.trim(),
        last_name: d.last_name.trim(),
        phone: d.phone.trim() || null,
        document_number: d.document_number.trim() || null,
        password: d.password,
        role_ids: d.role_ids,
        is_verified: d.is_verified,
      }));
      this.userDraft.set(null);
      this.history.update((h) => [...h, { from: 'assistant', text: `Usuario creado: ${d.email.trim().toLowerCase()}.` }]);
      this.setBot('success');
    } catch (e) {
      this.error.set(errorMessage(e));
      this.setBot('error');
    } finally {
      this.draftBusy.set(false);
      this.scrollToBottom();
    }
  }
  discardUserDraft() {
    this.userDraft.set(null);
  }
async retry() {
    if (!this.lastUserText || this.busy()) return;
    // Reintento: no se agrega de nuevo el mensaje del usuario, y repite el
    // mismo tipo de pedido (borrador de prenda, chat, exportar o explicar).
    this.error.set('');
    if (this.lastIntent === 'action' && this.lastActionCall) {
      const call = this.lastActionCall;
      await this.handleAction(call.action, call.parsed, call.text);
    } else if (this.lastIntent === 'export') await this.requestExport(this.lastUserText);
    else if (this.lastIntent === 'explain') await this.requestExplain(this.lastUserText);
    else if (this.lastIntent === 'apply') await this.requestApply(this.lastUserText);
    else if (this.lastIntent === 'draft') await this.requestProductDraft(this.lastUserText);
    else if (this.lastIntent === 'user_draft') await this.requestUserDraft(this.lastUserText);
    else await this.sendToBackend();
  }
  /**
   * Ejecuta una acción declarada del registro central. Las de lectura resumen
   * en el chat; las de draft abren un borrador editable; las confirm/restricted
   * preparan la tarjeta de confirmación visible antes de tocar datos.
   */
  private async handleAction(action: AssistantAction, parsed: ParsedAction, text: string) {
    switch (action.id) {
      case 'report.export':
        return this.requestExport(text);
      case 'report.explain':
        return this.requestExplain(text);
      case 'report.apply':
      case 'report.clear_filters':
        return this.requestApply(text);
      case 'product.create':
        return this.requestProductDraft(text);
      case 'user.create':
        return this.requestUserDraft(text);
      case 'product.bulk':
      case 'branch.create':
      case 'vestidor.review':
        return this.openManagementPage(action.id);
      case 'reservation.create':
        return this.openReservationForm();
      case 'product.open':
        return this.openProduct(parsed);
      case 'category.create':
        return this.openCategoryDraft(parsed);
      case 'supplier.create':
        return this.openSupplierDraft(parsed);
      case 'promotion.create':
        return this.openPromotionDraft(parsed);
      default:
        if (action.risk === 'read') return this.runReadAction(action, parsed);
        return this.startConfirm(action, parsed);
    }
  }

  private async openManagementPage(actionId: string) {
    const guide: Record<string, string> = {
      'product.bulk': '/admin/products',
      'branch.create': '/admin/branches',
      'vestidor.review': '/admin/probador',
    };
    const messages: Record<string, string> = {
      'product.bulk': 'Te dejo en la carga masiva de prendas: prepará el archivo Excel y revisá la vista previa antes de importar.',
      'branch.create': 'Te dejo en el alta de sucursales, donde el formulario valida igual que el backend.',
      'vestidor.review': 'Te dejo en la bandeja de revisión humana del vestidor virtual.',
    };
    this.confirmCard.set(null);
    try {
      await this.router.navigate([guide[actionId]]);
      this.history.update((h) => [...h, { from: 'assistant', text: messages[actionId] }]);
    } catch {
      this.history.update((h) => [...h, { from: 'assistant', text: 'No pude abrir esa pantalla; intentá desde el menú.' }]);
    }
  }

  private async openReservationForm() {
    this.confirmCard.set(null);
    this.history.update((h) => [
      ...h,
      {
        from: 'assistant',
        text: 'Reservar se decide en el formulario de reservas: te dejo ahí para completar fecha, sucursal, prendas y hora antes de confirmar.',
      },
    ]);
    try {
      await this.router.navigate(['/reservar']);
    } catch {
      /* ya estás en el formulario */
    }
  }

  private async openProduct(parsed: ParsedAction) {
    const name = parsed.data['name'];
    this.confirmCard.set(null);
    try {
      if (typeof name === 'string' && name) {
        const page = await firstValueFrom(this.catalog.products({ search: name, page_size: 5 }));
        const first = page.items?.[0];
        if (first && typeof (first as any).slug === 'string') {
          this.history.update((h) => [
            ...h,
            { from: 'assistant', text: `Encontré «${(first as any).name}». Te dejo en su ficha para verla o editarla.` },
          ]);
          await this.router.navigate(['/prendas', (first as any).slug]);
          return;
        }
      }
      this.history.update((h) => [
        ...h,
        { from: 'assistant', text: 'No encontré esa prenda por nombre; te dejo en la gestión de prendas para buscarla.' },
      ]);
      await this.router.navigate(['/admin/products']);
    } catch (e) {
      this.error.set(errorMessage(e));
      this.setBot('error');
    }
  }

  private openCategoryDraft(parsed: ParsedAction) {
    this.confirmCard.set(null);
    this.simpleDraft.set({
      title: 'Categoría a crear — revisá antes de confirmar',
      fields: [
        { key: 'name', label: 'Nombre', required: true },
        { key: 'slug', label: 'Enlace (opcional)', required: false },
      ],
      values: { name: String(parsed.data['name'] ?? ''), slug: '' },
    });
  }

  private openSupplierDraft(parsed: ParsedAction) {
    this.confirmCard.set(null);
    this.simpleDraft.set({
      title: 'Proveedor a crear — revisá antes de confirmar',
      fields: [
        { key: 'business_name', label: 'Razón social', required: true },
        { key: 'tax_id', label: 'NIT / RUC', required: true },
        { key: 'phone', label: 'Teléfono (opcional)', required: false },
        { key: 'city', label: 'Ciudad (opcional)', required: false },
      ],
      values: {
        business_name: String(parsed.data['business_name'] ?? ''),
        tax_id: '',
        phone: '',
        city: '',
      },
    });
  }

  private openPromotionDraft(parsed: ParsedAction) {
    const code = String(parsed.data['code'] ?? '');
    const percent = parsed.data['percent'];
    this.confirmCard.set(null);
    this.simpleDraft.set({
      title: 'Promoción a crear — revisá antes de confirmar',
      fields: [
        { key: 'name', label: 'Nombre de la promoción', required: true },
        { key: 'code', label: 'Código del cupón', required: true },
        { key: 'percent', label: 'Descuento (%)', required: true, type: 'number' },
      ],
      values: {
        name: code ? `Cupón ${code}` : '',
        code: code,
        percent: percent != null ? String(percent) : '10',
      },
    });
  }

  async confirmSimpleDraft() {
    const draft = this.simpleDraft();
    if (!draft || this.simpleBusy()) return;
    for (const field of draft.fields) {
      const value = draft.values[field.key] ?? '';
      if (field.required && !`${value}`.trim()) {
        this.error.set('Completá los campos obligatorios antes de confirmar.');
        return;
      }
    }
    this.simpleBusy.set(true);
    this.error.set('');
    const values = Object.fromEntries(
      Object.entries(draft.values).map(([k, v]) => [k, `${v}`.trim()]),
    ) as Record<string, string>;
    try {
      if (draft.title.includes('Categoría')) {
        await firstValueFrom(
          this.api.write('POST', '/catalog/admin/categories', {
            name: values['name'],
            slug: values['slug'] || null,
          }),
        );
        this.history.update((h) => [...h, { from: 'assistant', text: `Categoría creada: ${values['name']}.` }]);
      } else if (draft.title.includes('Proveedor')) {
        await firstValueFrom(
          this.api.write('POST', '/organization/suppliers', {
            business_name: values['business_name'],
            tax_id: values['tax_id'].toUpperCase(),
            phone: values['phone'] || null,
            city: values['city'] || null,
          }),
        );
        this.history.update((h) => [...h, { from: 'assistant', text: `Proveedor creado: ${values['business_name']}.` }]);
      } else {
        await this.commerce.write('POST', '/admin/promotions', {
          name: values['name'],
          code: values['code'],
          discount_type: 'percent',
          discount_value: Number(values['percent'] || 0),
          description: 'Creada desde el asistente.',
        });
        this.history.update((h) => [...h, { from: 'assistant', text: `Promoción creada: ${values['code'].toUpperCase()}.` }]);
      }
      this.simpleDraft.set(null);
      this.setBot('success');
    } catch (e) {
      this.error.set(errorMessage(e));
      this.setBot('error');
    } finally {
      this.simpleBusy.set(false);
      this.scrollToBottom();
    }
  }

  /** Lecturas: consultan los endpoints existentes (mismos permisos que la
   * pantalla) y resumen en el chat, sin crear ni modificar nada. */
  private async runReadAction(action: AssistantAction, parsed: ParsedAction) {
    const version = this.conversationVersion;
    this.busy.set(true);
    this.setBot('processing');
    try {
      let reply = '';
      const d = parsed.data as any;
      switch (action.id) {
        case 'user.search': {
          const q = String(d.email ?? d.name ?? '');
          const page = await firstValueFrom(
            this.api.get<Page<any>>('/users', { search: q, page_size: 5 }),
          );
          reply = this.listReply(
            'Usuarios encontrados',
            page.items ?? [],
            (u: any) => `${u.email} — ${(u.roles ?? []).map((r: any) => r.code || r.name).join(', ') || 'sin roles'}`,
          );
          break;
        }
        case 'user.show_inactive': {
          const page = await firstValueFrom(
            this.api.get<Page<any>>('/users', { is_active: false, page_size: 10 }),
          );
          reply = this.listReply('Usuarios inactivos', page.items ?? [], (u: any) => `${u.email} — ${u.first_name ?? ''} ${u.last_name ?? ''}`);
          break;
        }
        case 'supplier.inactive': {
          const rows = await firstValueFrom(
            this.api.get<any[]>('/organization/suppliers', { include_inactive: true }),
          );
          const inactive = rows.filter((s: any) => s.is_active === false);
          reply = this.listReply('Proveedores inactivos', inactive as any[], (s: any) => s.business_name || s.trade_name || s.tax_id);
          break;
        }
        case 'stock.low': {
          const max = Number(d.max ?? 5);
          const dash = await firstValueFrom(this.dashboard.load({ low_stock_lt: max }));
          const rows = dash.low_stock_variants ?? [];
          reply = rows.length
            ? `Prendas con stock menor a ${max} (${rows.length}):\n${rows.slice(0, 10).map((v: any) => `· ${v.name} ${v.size} ${v.color} — ${v.quantity} en ${v.branch}`).join('\n')}`
            : `No hay prendas con stock menor a ${max}.`;
          break;
        }
        case 'reservation.pending_today': {
          const today = new Date().toISOString().slice(0, 10);
          const page = await firstValueFrom(
            this.api.get<Page<any>>('/reservations/admin/all', {
              status: 'pending',
              date_from: today,
              date_to: today,
              page_size: 10,
            }),
          );
          reply = this.listReply(
            'Reservas pendientes de hoy',
            page.items ?? [],
            (r: any) => `${r.user_email || r.client_name || '—'} — ${r.scheduled_at}${r.branch_name ? ` (${r.branch_name})` : ''}`,
          );
          break;
        }
        case 'reservation.by_branch': {
          const wanted = String(d.branch_name ?? '').toLowerCase();
          const branches = await this.commerce.branches();
          const branch = branches.find((b: any) => String(b.name).toLowerCase().includes(wanted));
          if (!branch) {
            reply = `No encontré la sucursal «${wanted}». Sucursales: ${branches.map((b: any) => b.name).join(', ')}.`;
            break;
          }
          const page = await firstValueFrom(
            this.api.get<Page<any>>('/reservations/admin/all', { branch_id: branch.id, page_size: 10 }),
          );
          reply = this.listReply(
            `Reservas de ${branch.name}`,
            page.items ?? [],
            (r: any) => `${r.user_email || r.client_name || '—'} — ${r.scheduled_at} (${r.status})`,
          );
          break;
        }
        case 'order.pending_payment':
        case 'order.delivered':
        case 'payment.rejected': {
          const status =
            action.id === 'order.pending_payment'
              ? 'pending_payment'
              : action.id === 'order.delivered'
                ? 'delivered'
                : 'expired';
          const rows = await this.commerce.get<any[]>('/admin/orders', { status, limit: 6 });
          const title =
            action.id === 'payment.rejected' ? 'Pagos rechazados o expirados' :
              action.id === 'order.delivered' ? 'Pedidos entregados' : 'Pedidos pendientes de pago';
          reply =
            this.listReply(title, rows as any[], (o: any) => `${o.number}${o.total ? ` — Bs ${o.total}` : ''} ${o.customer_email ?? ''}`) +
            (action.id === 'payment.rejected'
              ? '\n\nLos pagos que el proveedor dejó sin completar quedan como "expirados" y liberan las existencias reservadas; el sistema no guarda otro estado "rechazado".'
              : '');
          break;
        }
        case 'promotion.expired': {
          const rows = await this.commerce.get<any[]>('/admin/promotions');
          const now = Date.now();
          const expired = rows.filter(
            (p: any) => p.is_active && p.ends_at && new Date(p.ends_at).getTime() < now,
          );
          reply = this.listReply('Promociones vencidas', expired as any[], (p: any) => `${p.name || p.code} (${p.discount_type} ${p.discount_value ?? ''})`);
          break;
        }
        case 'vestidor.pending': {
          const assets = await firstValueFrom(
            this.api.get<any[]>('/vestidor/admin/assets', {}),
          );
          const review = assets.filter((a: any) => a.ai_status === 'review');
          const failed = assets.filter((a: any) => a.ai_status === 'failed');
          reply =
            `Vestidor virtual: ${review.length} recursos en revisión humana y ${failed.length} fallidos.` +
            (review.length
              ? `\nEn revisión:\n${review.slice(0, 10).map((a: any) => `· ${a.product_name || a.id}`).join('\n')}`
              : '');
          break;
        }
        default:
          reply = 'No pude consultar esa lista con los datos disponibles.';
      }
      if (version !== this.conversationVersion) return;
      this.history.update((h) => [...h, { from: 'assistant', text: reply }]);
      this.setBot('success');
    } catch (e) {
      this.setBot('error');
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
      const el = this.logRef?.nativeElement;
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 64) this.showNew.set(true);
      else this.scrollToBottom();
    }
  }

  private listReply(title: string, rows: any[], render: (row: any) => string): string {
    return rows.length
      ? `${title} (${rows.length}):\n` + rows.slice(0, 10).map((row) => `· ${render(row)}`).join('\n')
      : `${title}: no hay resultados.`;
  }

  /** Mutaciones: resuelve la entidad y muestra la tarjeta de confirmación. */
  private async startConfirm(action: AssistantAction, parsed: ParsedAction) {
    const version = this.conversationVersion;
    this.busy.set(true);
    this.setBot('processing');
    try {
      switch (action.id) {
        case 'user.deactivate':
        case 'user.activate':
        case 'user.unlock':
        case 'user.change_role':
        case 'user.deleted':
          await this.confirmUser(action, parsed, version);
          break;
        case 'product.deactivate':
          await this.confirmProduct(action, parsed, version);
          break;
        case 'stock.receipt':
        case 'stock.adjustment':
        case 'stock.transfer':
          await this.confirmStock(action, parsed, version);
          break;
        case 'reservation.confirm':
        case 'reservation.cancel':
        case 'reservation.arrived':
          await this.confirmReservation(action, parsed, version);
          break;
        case 'order.change_status':
        case 'order.carrier':
        case 'order.register_return':
          await this.confirmOrder(action, parsed, version);
          break;
        case 'promotion.deactivate':
          await this.confirmPromotion(action, parsed, version);
          break;
        case 'vestidor.retry':
          await this.confirmVestidor(action, parsed, version);
          break;
        default:
          this.needMore(action, 'No pude preparar esa operación con los datos disponibles.', version);
      }
    } catch (e) {
      this.setBot('error');
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
      const el = this.logRef?.nativeElement;
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 64) this.showNew.set(true);
      else this.scrollToBottom();
    }
  }

  private needMore(action: AssistantAction, question: string, version: number) {
    if (version !== this.conversationVersion) return;
    this.history.update((h) => [
      ...h,
      { from: 'assistant', text: `${question} Nada se modificó todavía.` },
    ]);
    this.setBot('idle');
  }

  private requireConfirm(input: {
    actionId: string;
    title: string;
    lines: string[];
    confirmLabel: string;
    restricted?: boolean;
    requiredText?: string;
    detailUrl?: string;
    handleConfirm: () => Promise<void>;
  }) {
    this.confirmInput.set('');
    this.confirmCard.set({
      actionId: input.actionId,
      title: input.title,
      lines: input.lines,
      confirmLabel: input.confirmLabel,
      restricted: input.restricted ?? false,
      requiredText: input.requiredText ?? '',
      detailUrl: input.detailUrl,
      handleConfirm: input.handleConfirm,
    });
    this.history.update((h) => [
      ...h,
      {
        from: 'assistant',
        text: `Preparé la operación: revisala en la tarjeta y confirmá solo si estás de acuerdo. Nada se ejecutó todavía.`,
      },
    ]);
  }

  async runConfirmation() {
    const card = this.confirmCard();
    if (!card || this.confirmBusy()) return;
    if (card.restricted && this.confirmInput().trim().toLowerCase() !== card.requiredText.toLowerCase()) {
      this.error.set(`Para confirmar esta operación ingresá exactamente «${card.requiredText}».`);
      return;
    }
    this.confirmBusy.set(true);
    this.error.set('');
    try {
      await card.handleConfirm();
      this.setBot('success');
    } catch (e) {
      this.error.set(errorMessage(e));
      this.setBot('error');
    } finally {
      this.confirmBusy.set(false);
      this.confirmCard.set(null);
      this.confirmInput.set('');
      this.scrollToBottom();
    }
  }

  editConfirmation() {
    const card = this.confirmCard();
    if (!card || this.confirmBusy()) return;
    this.confirmCard.set(null);
    const url = this.confirmDetailUrl(card.actionId);
    void (url ? this.router.navigateByUrl(url) : Promise.resolve());
    this.history.update((h) => [
      ...h,
      { from: 'assistant', text: 'Cerraste la tarjeta. Te dejo en la pantalla para hacerlo manualmente; no se modificó nada.' },
    ]);
  }

  dismissConfirmation() {
    if (this.confirmBusy()) return;
    const card = this.confirmCard();
    this.confirmCard.set(null);
    this.confirmInput.set('');
    this.setBot('idle');
    if (card) {
      this.history.update((h) => [
        ...h,
        { from: 'assistant', text: 'Cancelé la operación; no se modificó nada.' },
      ]);
    }
  }

  openDetail(card: ConfirmCard) {
    if (!card.detailUrl) return;
    this.confirmCard.set(null);
    void this.router.navigateByUrl(card.detailUrl);
  }

  private confirmDetailUrl(actionId: string): string | null {
    const map: Record<string, string> = {
      'user.deactivate': '/admin/users',
      'user.activate': '/admin/users',
      'user.unlock': '/admin/users',
      'user.change_role': '/admin/users',
      'user.deleted': '/admin/users',
      'product.deactivate': '/admin/products',
      'stock.receipt': '/admin/stock',
      'stock.adjustment': '/admin/stock',
      'stock.transfer': '/admin/stock',
      'reservation.confirm': '/admin/reservas',
      'reservation.cancel': '/admin/reservas',
      'reservation.arrived': '/admin/reservas',
      'order.change_status': '/admin/pedidos',
      'order.carrier': '/admin/pedidos',
      'order.register_return': '/admin/devoluciones',
      'promotion.deactivate': '/admin/promociones',
      'vestidor.retry': '/admin/probador',
    };
    return map[actionId] ?? null;
  }

  private async confirmUser(action: AssistantAction, parsed: ParsedAction, version: number) {
    const d = parsed.data as any;
    const q = String(d.email ?? d.target ?? '').trim();
    if (!q) return this.needMore(action, 'Decime el usuario por su correo o su nombre para preparar la operación.', version);
    const page = await firstValueFrom(
      this.api.get<Page<any>>('/users', { search: q, page_size: 3, include_deleted: true }),
    );
    if (version !== this.conversationVersion) return;
    const items = page.items ?? [];
    if (!items.length) return this.needMore(action, `No encontré un usuario con «${q}».`, version);
    if (items.length > 1) {
      return this.needMore(action, `Encontré ${items.length} usuarios con «${q}». Repetí el pedido con el correo exacto para desambiguar.`, version);
    }
    const user: any = items[0];
    const label = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email;
    const roles = (user.roles ?? []).map((r: any) => r.code || r.name).join(', ');
    const verbs: Record<string, string> = {
      'user.deactivate': 'Desactivar',
      'user.activate': 'Activar',
      'user.unlock': 'Desbloquear',
      'user.deleted': 'Eliminar definitivamente',
    };
    const restricted = action.id === 'user.deleted';
    const verb = verbs[action.id] ?? 'Modificar';
    const lines = [`Usuario: ${label} (${user.email})`, roles ? `Roles actuales: ${roles}` : ''].filter(Boolean);

    if (action.id === 'user.change_role') {
      const roleName = String(d.role ?? '').trim();
      if (!roleName) {
        return this.needMore(action, `¿A qué rol lo pasás? Decílo junto al usuario.`, version);
      }
      const rolesList = await firstValueFrom(this.api.get<any[]>('/roles'));
      if (version !== this.conversationVersion) return;
      const role = rolesList.find(
        (r: any) =>
          String(r.code).toLowerCase() === roleName.toLowerCase() ||
          String(r.name).toLowerCase().includes(roleName.toLowerCase()),
      );
      if (!role) {
        return this.needMore(
          action,
          `No encontré el rol «${roleName}». Roles disponibles: ${rolesList.map((r: any) => r.code).join(', ')}.`,
          version,
        );
      }
      if (Array.isArray(user.roles) && user.roles.some((r: any) => r.id === role.id)) {
        return this.needMore(action, `${label} ya tiene el rol ${role.name || role.code}.`, version);
      }
      const roleIds = [...(user.roles ?? []).map((r: any) => r.id), role.id];
      lines.push(`Nuevo rol: ${role.name || role.code}`);
      this.requireConfirm({
        actionId: action.id,
        title: `Cambiar rol de la cuenta`,
        lines,
        confirmLabel: 'Cambiar rol',
        detailUrl: '/admin/users',
        handleConfirm: async () => {
          await firstValueFrom(this.api.write('PUT', `/users/${user.id}/roles`, { role_ids: roleIds }));
          this.history.update((h) => [
            ...h,
            { from: 'assistant', text: `Rol asignado: ${label} ahora es ${role.name || role.code}. Quedó en la bitácora.` },
          ]);
        },
      });
      return;
    }

    this.requireConfirm({
      actionId: action.id,
      title: `${verb} la cuenta`,
      lines,
      confirmLabel: verb,
      restricted,
      requiredText: restricted ? user.email : '',
      detailUrl: '/admin/users',
      handleConfirm: async () => {
        if (action.id === 'user.deleted') {
          await firstValueFrom(this.api.write('DELETE', `/users/${user.id}`));
        } else if (action.id === 'user.unlock') {
          await firstValueFrom(this.api.write('POST', `/users/${user.id}/unlock`));
        } else if (action.id === 'user.activate') {
          await firstValueFrom(this.api.write('POST', `/users/${user.id}/activate`));
        } else {
          await firstValueFrom(this.api.write('POST', `/users/${user.id}/deactivate`));
        }
        this.history.update((h) => [
          ...h,
          { from: 'assistant', text: `${verb.toLowerCase()} de ${user.email} ejecutado. Quedó registrado en la bitácora.` },
        ]);
      },
    });
  }

  private async confirmProduct(action: AssistantAction, parsed: ParsedAction, version: number) {
    const name = String(parsed.data['name'] ?? '').trim();
    if (!name) return this.needMore(action, 'Decime el nombre de la prenda para preparar la operación.', version);
    const page = await firstValueFrom(this.catalog.products({ search: name, page_size: 5 }));
    if (version !== this.conversationVersion) return;
    const items = page.items ?? [];
    if (!items.length) return this.needMore(action, `No encontré la prenda «${name}».`, version);
    const exact = items.some((p: any) => String(p.name).toLowerCase() === name.toLowerCase());
    if (items.length > 1 && !exact) {
      return this.needMore(
        action,
        `Encontré ${items.length} prendas parecidas (${items.slice(0, 5).map((p: any) => p.name).join(', ')}). Repetí el pedido con el nombre completo.`,
        version,
      );
    }
    const product: any = exact ? items.find((p: any) => String(p.name).toLowerCase() === name.toLowerCase()) : items[0];
    this.requireConfirm({
      actionId: action.id,
      title: 'Desactivar la prenda',
      lines: [
        `Prenda: ${product.name}`,
        product.category?.name ? `Categoría: ${product.category.name}` : '',
        'Dejará de verse en el catálogo y en el vestidor. Se puede volver a activar desde Prendas.',
      ].filter(Boolean),
      confirmLabel: 'Desactivar',
      detailUrl: '/admin/products',
      handleConfirm: async () => {
        await firstValueFrom(this.api.write('POST', `/catalog/admin/products/${product.id}/deactivate`));
        this.history.update((h) => [
          ...h,
          { from: 'assistant', text: `Prenda desactivada: ${product.name}. Quedó en la bitácora.` },
        ]);
      },
    });
  }

  private async confirmStock(action: AssistantAction, parsed: ParsedAction, version: number) {
    const d = parsed.data as any;
    const name = String(d.variant ?? '').trim();
    if (!name) return this.needMore(action, 'Decime la prenda o variante (talle/color) para preparar el movimiento.', version);
    const page = await firstValueFrom(this.catalog.products({ search: name, page_size: 5 }));
    if (version !== this.conversationVersion) return;
    const items = page.items ?? [];
    const product: any = items[0];
    if (!product) return this.needMore(action, `No encontré la prenda «${name}».`, version);
    const variant: any = (product.variants ?? [])[0];
    if (!variant) return this.needMore(action, `La prenda «${product.name}» no tiene unidades (talles/colores) para mover.`, version);
    const branches = await this.commerce.branches();
    if (version !== this.conversationVersion) return;
    if (!branches.length) return this.needMore(action, 'No hay sucursales configuradas para registrar el movimiento.', version);
    const findBranch = (wanted?: unknown): any => {
      const w = String(wanted ?? '').toLowerCase();
      if (!w) return null;
      return branches.find((b: any) => String(b.name).toLowerCase().includes(w)) ?? null;
    };

    if (action.id === 'stock.transfer') {
      const fromBranch = findBranch(d.from);
      const toBranch = findBranch(d.to);
      const quantity = Number(d.quantity ?? 0);
      if (!fromBranch || !toBranch) {
        return this.needMore(
          action,
          `No pude resolver las sucursales (origen «${d.from ?? '?'}», destino «${d.to ?? '?'}»). Sucursales: ${branches.map((b: any) => b.name).join(', ')}.`,
          version,
        );
      }
      if (!quantity) return this.needMore(action, 'Indicá cuántas unidades transferir, por ejemplo "10 unidades".', version);
      this.requireConfirm({
        actionId: action.id,
        title: 'Transferir existencias',
        lines: [
          `Prenda: ${product.name} (${variant.size ?? ''} ${variant.color ?? ''})`,
          `Unidades: ${quantity}`,
          `De: ${fromBranch.name}`,
          `A: ${toBranch.name}`,
          'Se registran dos movimientos de inventario (salida y entrada) en la bitácora.',
        ],
        confirmLabel: 'Transferir',
        detailUrl: '/admin/stock',
        handleConfirm: async () => {
          const reason = 'Transferencia entre sucursales';
          await this.commerce.write('POST', `/admin/stock/${variant.id}/movements`, {
            branch_id: fromBranch.id, kind: 'issue', quantity, reason, reference: 'transferencia',
          });
          await this.commerce.write('POST', `/admin/stock/${variant.id}/movements`, {
            branch_id: toBranch.id, kind: 'receipt', quantity, reason, reference: 'transferencia',
          });
          this.history.update((h) => [
            ...h,
            { from: 'assistant', text: `Transferencia registrada: ${quantity} u. de ${fromBranch.name} a ${toBranch.name}.` },
          ]);
        },
      });
      return;
    }

    const branchWanted = d.branch;
    const branch = findBranch(branchWanted) ?? (branches.length === 1 ? branches[0] : null);
    if (!branch) {
      return this.needMore(
        action,
        `Elegí la sucursal del movimiento. Sucursales: ${branches.map((b: any) => b.name).join(', ')}.`,
        version,
      );
    }
    if (action.id === 'stock.receipt') {
      const quantity = Number(d.quantity ?? 0);
      if (!quantity) return this.needMore(action, 'Indicá cuántas unidades ingresan, por ejemplo "entrada de 20 unidades".', version);
      const reason = String(d.reason ?? 'Entrada de mercadería');
      this.requireConfirm({
        actionId: action.id,
        title: 'Registrar entrada de existencias',
        lines: [
          `Prenda: ${product.name} (${variant.size ?? ''} ${variant.color ?? ''})`,
          `Unidades: ${quantity}`,
          `Sucursal: ${branch.name}`,
          `Motivo: ${reason}`,
        ],
        confirmLabel: 'Registrar entrada',
        detailUrl: '/admin/stock',
        handleConfirm: async () => {
          await this.commerce.write('POST', `/admin/stock/${variant.id}/movements`, {
            branch_id: branch.id, kind: 'receipt', quantity, reason,
          });
          this.history.update((h) => [
            ...h,
            { from: 'assistant', text: `Entrada registrada: +${quantity} u. de ${product.name} en ${branch.name}.` },
          ]);
        },
      });
      return;
    }
    // Ajuste: deja las unidades en el valor indicado (no suma).
    const quantity = Number(d.quantity ?? 0);
    if (!quantity) return this.needMore(action, 'Indicá las existencias finales tras el ajuste (por ejemplo "ajuste de stock a 40").', version);
    const reason = String(d.reason ?? 'Ajuste de inventario');
    this.requireConfirm({
      actionId: action.id,
      title: 'Ajustar existencias',
      lines: [
        `Prenda: ${product.name} (${variant.size ?? ''} ${variant.color ?? ''})`,
        `Existencias finales en ${branch.name}: ${quantity}`,
        `Motivo: ${reason}`,
      ],
      confirmLabel: 'Ajustar',
      detailUrl: '/admin/stock',
      handleConfirm: async () => {
        await this.commerce.write('PUT', `/admin/stock/${variant.id}`, {
          branch_id: branch.id, quantity, reason,
        });
        this.history.update((h) => [
          ...h,
          { from: 'assistant', text: `Ajuste registrado: ${product.name} queda con ${quantity} u. en ${branch.name}.` },
        ]);
      },
    });
  }

  private async confirmReservation(action: AssistantAction, parsed: ParsedAction, version: number) {
    const page = await firstValueFrom(
      this.api.get<Page<any>>('/reservations/admin/all', { status: 'pending', page_size: 20 }),
    );
    if (version !== this.conversationVersion) return;
    const list = page.items ?? [];
    if (!list.length) return this.needMore(action, 'No hay reservas pendientes para esa acción.', version);
    if (list.length > 1) {
      return this.needMore(
        action,
        `Hay ${list.length} reservas pendientes (${list.map((r: any) => `${r.scheduled_at ?? ''} ${r.branch_name ?? ''}`).join(', ')}). Indicá la sucursal o el horario exacto y repetí la orden.`,
        version,
      );
    }
    const reservation: any = list[0];
    const labels: Record<string, string> = {
      'reservation.confirm': 'Confirmar',
      'reservation.cancel': 'Cancelar',
      'reservation.arrived': 'Marcar cliente llegado',
    };
    const statuses: Record<string, string> = {
      'reservation.confirm': 'confirmed',
      'reservation.cancel': 'cancelled',
      'reservation.arrived': 'attended',
    };
    const label = labels[action.id] ?? 'Aplicar';
    this.requireConfirm({
      actionId: action.id,
      title: `${label} la reserva`,
      lines: [
        `Reserva: ${reservation.user_email || reservation.client_name || '—'} — ${reservation.scheduled_at ?? ''}`,
        reservation.branch_name ? `Sucursal: ${reservation.branch_name}` : '',
      ].filter(Boolean),
      confirmLabel: label,
      detailUrl: '/admin/reservas',
      handleConfirm: async () => {
        await firstValueFrom(
          this.api.write('PATCH', `/reservations/admin/${reservation.id}/status`, {
            status: statuses[action.id],
            note: 'Actualizada desde el asistente.',
          }),
        );
        this.history.update((h) => [
          ...h,
          { from: 'assistant', text: `Reserva ${statuses[action.id]} (${reservation.scheduled_at ?? ''}). Quedó en la bitácora.` },
        ]);
      },
    });
  }

  private async confirmOrder(action: AssistantAction, parsed: ParsedAction, version: number) {
    const d = parsed.data as any;
    const number = String(d.order_number ?? '').trim();
    if (!number) return this.needMore(action, 'Indicá el número del pedido, por ejemplo FS-123.', version);
    const rows = await this.commerce.get<any[]>('/admin/orders', { q: number, limit: 20 });
    if (version !== this.conversationVersion) return;
    const orderKey = (value: unknown) => String(value ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
    const requestedKey = orderKey(number);
    const order: any = (rows as any[]).find((o) => orderKey(o.number) === requestedKey);
    if (!order) return this.needMore(action, `No encontré el pedido «${number}».`, version);

    if (action.id === 'order.register_return') {
      this.requireConfirm({
        actionId: action.id,
        title: 'Registrar una devolución',
        lines: [
          `Pedido: ${order.number} — ${order.customer_email ?? ''}`,
          'La devolución se registra en la bandeja de Devoluciones con las prendas concretas que se reciben; el backend reintegra el stock y audita el movimiento.',
        ],
        confirmLabel: 'Abrir devoluciones',
        restricted: true,
        requiredText: order.number,
        detailUrl: '/admin/devoluciones',
        handleConfirm: async () => {
          this.history.update((h) => [
            ...h,
            { from: 'assistant', text: `Abrí la bandeja de devoluciones para el pedido ${order.number}: completá las prendas y el motivo allí mismo. Nada se modificó todavía.` },
          ]);
          void this.router.navigateByUrl('/admin/devoluciones');
        },
      });
      return;
    }

    if (action.id === 'order.change_status') {
      const newStatus = String(d.new_status ?? '');
      const labels: Record<string, string> = {
        processing: 'En preparación',
        shipped: 'Enviado',
        delivered: 'Entregado',
      };
      this.requireConfirm({
        actionId: action.id,
        title: 'Cambiar el estado del pedido',
        lines: [
          `Pedido: ${order.number} — ${order.customer_email ?? ''}`,
          `Estado actual: ${order.status ?? '—'}`,
          `Nuevo estado: ${labels[newStatus] ?? newStatus}`,
        ],
        confirmLabel: 'Cambiar estado',
        detailUrl: '/admin/pedidos',
        handleConfirm: async () => {
          await firstValueFrom(
            this.api.write('PATCH', `/commerce/admin/orders/${order.id}/tracking`, {
              status: newStatus,
              note: 'Actualizado desde el asistente.',
            }),
          );
          this.history.update((h) => [
            ...h,
            { from: 'assistant', text: `Pedido ${order.number} → ${labels[newStatus] ?? newStatus}. Quedó en la bitácora.` },
          ]);
        },
      });
      return;
    }

    // Asignar transportista = marcar como enviado con el transportista.
    const carrier = String(d.carrier ?? '').trim();
    if (!carrier) return this.needMore(action, 'Decime qué transportista asignar (ejemplo: "Correos").', version);
    if (order.status !== 'processing') {
      return this.needMore(
        action,
        `El pedido ${order.number} está en «${order.status ?? '—'}»: asignar transportista lo marca como enviado. Hacelo desde Pedidos o pasá primero el pedido a «En preparación».`,
        version,
      );
    }
    this.requireConfirm({
      actionId: action.id,
      title: 'Marcar enviado y asignar transportista',
      lines: [
        `Pedido: ${order.number} — ${order.customer_email ?? ''}`,
        `Transportista: ${carrier}`,
        'El estado pasará a «Enviado» y el transportista quedará registrado.',
      ],
      confirmLabel: 'Asignar transportista',
      detailUrl: '/admin/pedidos',
      handleConfirm: async () => {
        await firstValueFrom(
          this.api.write('PATCH', `/commerce/admin/orders/${order.id}/tracking`, {
            status: 'shipped',
            carrier,
            note: 'Transportista asignado: ' + carrier,
          }),
        );
        this.history.update((h) => [
          ...h,
          { from: 'assistant', text: `Pedido ${order.number} enviado con ${carrier}. Quedó en la bitácora.` },
        ]);
      },
    });
  }

  private async confirmPromotion(action: AssistantAction, parsed: ParsedAction, version: number) {
    const d = parsed.data as any;
    const code = String(d.code ?? '').toUpperCase().trim();
    if (!code) return this.needMore(action, 'Decime el código del cupón o promoción a desactivar.', version);
    const rows = await this.commerce.get<any[]>('/admin/promotions', {});
    if (version !== this.conversationVersion) return;
    const promo = rows.find((p: any) => String(p.code ?? '').toUpperCase() === code);
    if (!promo) {
      const codes = rows.filter((p: any) => p.is_active).map((p: any) => p.code).join(', ');
      return this.needMore(action, `No encontré el cupón «${code}». Activos: ${codes || 'ninguno'}.`, version);
    }
    if (!promo.is_active) return this.needMore(action, `El cupón «${code}» ya está desactivado.`, version);
    this.requireConfirm({
      actionId: action.id,
      title: 'Desactivar la promoción',
      lines: [
        `Promoción: ${promo.name || promo.code} (${promo.discount_type} ${promo.discount_value ?? ''})`,
        'Dejará de aplicarse en el carrito. Se puede reactivar desde Cupones.',
      ],
      confirmLabel: 'Desactivar',
      detailUrl: '/admin/promociones',
      handleConfirm: async () => {
        await firstValueFrom(
          this.api.write('PATCH', `/commerce/admin/promotions/${promo.id}`, { is_active: false }),
        );
        this.history.update((h) => [
          ...h,
          { from: 'assistant', text: `Promoción desactivada: ${promo.name || promo.code}. Quedó en la bitácora.` },
        ]);
      },
    });
  }

  private async confirmVestidor(action: AssistantAction, parsed: ParsedAction, version: number) {
    const d = parsed.data as any;
    if (typeof d.name === 'string' && d.name) {
      const page = await firstValueFrom(this.catalog.products({ search: d.name, page_size: 3 }));
      const product: any = page.items?.[0];
      if (product) {
        const assets = await firstValueFrom(
          this.api.get<any[]>('/vestidor/admin/assets', { product_id: product.id }),
        );
        const failed = assets.filter((a: any) => a.ai_status === 'failed');
        const review = assets.filter((a: any) => a.ai_status === 'review');
        if (failed.length || review.length) {
          const target = failed[0] ?? review[0];
          return this.buildVestidorCard(action, product.name, target, version);
        }
        return this.needMore(action, `La prenda «${product.name}» no tiene recursos fallidos ni en revisión.`, version);
      }
      return this.needMore(action, `No encontré la prenda «${d.name}».`, version);
    }
    const assets = await firstValueFrom(
      this.api.get<any[]>('/vestidor/admin/assets', {}),
    );
    if (version !== this.conversationVersion) return;
    const failed = assets.filter((a: any) => a.ai_status === 'failed');
    const review = assets.filter((a: any) => a.ai_status === 'review');
    if (!failed.length && !review.length) return this.needMore(action, 'No hay recursos del vestidor fallidos ni en revisión.', version);
    const target = failed[0] ?? review[0];
    const name = target.product_name ?? target.id;
    this.buildVestidorCard(action, name, target, version);
  }

  private buildVestidorCard(action: AssistantAction, label: string, asset: any, version: number) {
    if (version !== this.conversationVersion) return;
    this.requireConfirm({
      actionId: action.id,
      title: 'Reintentar el recurso del vestidor',
      lines: [
        `Recurso: ${label}`,
        `Estado actual: ${asset.ai_status}`,
        'Se vuelve a analizar la foto de catálogo; no borra nada.',
      ],
      confirmLabel: 'Reintentar',
      detailUrl: '/admin/probador',
      handleConfirm: async () => {
        await firstValueFrom(this.api.write('POST', `/vestidor/admin/assets/${asset.id}/retry`));
        this.history.update((h) => [
          ...h,
          { from: 'assistant', text: `Reintento de ${label} disparado. Revisalo en el probador.` },
        ]);
      },
    });
  }

  /** CU: "exportame el reporte de ventas del último mes" o "exportá esto" —
   * interpreta la consulta con el mismo motor determinista del dashboard y lo
   * combina con el contexto visible (el filtro que el dashboard está
   * mostrando ahora), para no pedir de nuevo lo que ya está en pantalla. */
  private async requestExport(text: string) {
    const version = this.conversationVersion;
    this.busy.set(true);
    this.setBot('processing');
    try {
      const normalized = commandText(text);
      const continuation = /\b(ahora|mismo|mismos|eso|esto)\b/.test(normalized);
      const current = continuation && this.lastExport ? this.lastExport.query : this.assistantContext.report();
      const interpreted = await firstValueFrom(this.dashboard.interpret(text, current));
      if (version !== this.conversationVersion) return;
      if (!interpreted.ok) throw new Error(interpreted.aclaraciones.join(' ') || 'Necesito aclarar los filtros antes de exportar.');
      const format: 'xlsx' | 'pdf' | 'csv' = /\bpdf\b/.test(normalized) ? 'pdf' : /\bcsv\b/.test(normalized) ? 'csv' : 'xlsx';
      let reports = requestedReports(text);
      if (!reports.length && continuation && this.lastExport) reports = this.lastExport.reports;
      const report = reports[0] ?? exportReportType(normalized, interpreted);
      if (!report) {
        this.history.update((h) => [
          ...h,
          {
            from: 'assistant',
            text: 'Puedo exportar ventas, pedidos, pagos, prendas vendidas, existencias o sucursales — decime cuál de esos reportes querés.',
          },
        ]);
        this.setBot('idle');
        return;
      }
      if (!reports.length) reports = [report];
      // El intérprete gana por campo; lo que dejó sin resolver cae al contexto
      // visible del dashboard ("exportá esto" = exactamente lo que se ve).
      const q = queryForCommand(text, interpreted.filtros, current);
      // No exportar "todo" silenciosamente si el usuario mencionó un filtro
      // que no se pudo resolver y el contexto visible tampoco lo aporta.
      // No exportar "todo" silenciosamente si el usuario mencionó una sucursal
      // puntual que no se pudo resolver y el contexto visible tampoco la aporta.
      // "por sucursal" es una agrupación, no una sucursal concreta: no aplica.
      const mentionsBranchButNotGrouping =
        /\bsucursal\b|\blocal\b|tienda\s+de/i.test(normalized) && !/por\s+sucursal/i.test(normalized);
      if (report !== 'sucursales' && mentionsBranchButNotGrouping && !q.branch_id && !clearsFilter(text, 'sucursal')) {
        this.history.update((h) => [
          ...h,
          {
            from: 'assistant',
            text: 'No pude resolver a qué sucursal te referís y el contexto visible no tiene ninguna seleccionada. Sin ese filtro no descargo el reporte para no incluir todos los datos — elegí la sucursal en el dashboard o aclarala en tu pedido.',
          },
        ]);
        this.setBot('idle');
        return;
      }
      if (/categor[íi]a|rubro|departamento/i.test(text) && !q.category_id && !clearsFilter(text, 'categoria')) {
        this.history.update((h) => [
          ...h,
          {
            from: 'assistant',
            text: 'No pude resolver la categoría que mencionás y el contexto visible no tiene ninguna seleccionada. Sin ese filtro no descargo el reporte para no incluir todas las categorías — elegila en el dashboard o aclará cuál es.',
          },
        ]);
        this.setBot('idle');
        return;
      }
      // Herramienta tipada del servidor: la descarga la genera un caso de uso
      // autorizado (allowlist), queda en bitacora con el correo del analista y
      // request_id hace idempotente la operacion (no duplica auditoria).
      const requestId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const response = await firstValueFrom(
        this.dashboard.executeTool(requestId, 'export_report', reports, format, q),
      );
      const blob = response.body;
      if (version !== this.conversationVersion) return;
      if (!blob) throw new Error('El servidor no devolvió el archivo.');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const extension = format === 'csv' && reports.length > 1 ? 'zip' : format;
      anchor.download = `fashionstore_${reports.join('_')}.${extension}`;
      this.downloads.update(files => [...files, { url, name: anchor.download }]);
      anchor.click();
      this.lastExport = { reports, query: q };
      const replayed = response.headers.get('X-Idempotent-Replay') === 'true';
      const aclaraciones = interpreted.aclaraciones.length ? ' ' + interpreted.aclaraciones.join(' ') : '';
      this.history.update((h) => [
        ...h,
        {
          from: 'assistant',
          text:
            (replayed ? 'Enviaste la misma solicitud dos veces: ' : 'Archivo generado: ') +
            `${reports.map(r => EXPORT_REPORT_LABEL[r]).join(', ')} en ${extension.toUpperCase()}. Usé los filtros indicados o el alcance actual del reporte. Podés descargarlo con el botón del chat.${aclaraciones}` +
            (replayed ? ' El servidor reconoció el reintento sin duplicar su registro en la bitácora.' : ''),
        },
      ]);
      this.setBot('success');
    } catch (e) {
      this.setBot('error');
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
      const el = this.logRef?.nativeElement;
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 64) this.showNew.set(true);
      else this.scrollToBottom();
    }
  }
  /** CU: "explicame por qué bajaron los pedidos" — el servidor recalcula las
   * métricas con el contexto visible y la IA arma hallazgo/cifras/interpretación/
   * acción/limitaciones. */
  private async requestExplain(text: string) {
    const version = this.conversationVersion;
    this.busy.set(true);
    this.setBot('processing');
    try {
      const result = await firstValueFrom(this.dashboard.explain(text, this.assistantContext.report()));
      if (version !== this.conversationVersion) return;
      let reply: string;
      if (result.available && result.sections) {
        const s = result.sections;
        reply = [
          s.hallazgo,
          s.cifras,
          s.interpretacion,
          s.accion && `Sugerencia: ${s.accion}`,
          s.limitaciones && `Limitaciones: ${s.limitaciones}`,
        ]
          .filter(Boolean)
          .join('\n\n');
      } else {
        reply = result.message || 'No pude explicar esa métrica ahora mismo.';
      }
      this.history.update((h) => [...h, { from: 'assistant', text: reply }]);
      this.setBot('success');
    } catch (e) {
      this.setBot('error');
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
      const el = this.logRef?.nativeElement;
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 64) this.showNew.set(true);
      else this.scrollToBottom();
    }
  }
  /** CU (Etapa 3): "mostrame ventas de la sucursal norte" — interpreta el
   * pedido como cualquier otro reporte, pero el filtro resuelto se APLICA en la
   * pantalla del dashboard (no se queda solo en el chat). */
  private async requestApply(text: string) {
    const version = this.conversationVersion;
    this.busy.set(true);
    this.setBot('processing');
    try {
      const current = this.assistantContext.report();
      const interpreted = await firstValueFrom(this.dashboard.interpret(text, current));
      if (version !== this.conversationVersion) return;
      if (!interpreted.ok) throw new Error(interpreted.aclaraciones.join(' ') || 'Necesito aclarar los filtros antes de aplicarlos.');
      const q = queryForCommand(text, interpreted.filtros, current);
      const mentionsBranchButNotGrouping =
        /sucursal|local|tienda\s+de/i.test(text) && !/por\s+sucursal/i.test(text);
      if (mentionsBranchButNotGrouping && !q.branch_id && !clearsFilter(text, 'sucursal')) {
        this.history.update((h) => [
          ...h,
          {
            from: 'assistant',
            text: 'No pude resolver a qué sucursal te referís. Sin ese dato no aplico el filtro para no ocultar ninguna sucursal — elegila en el dashboard o decime su nombre.',
          },
        ]);
        this.setBot('idle');
        return;
      }
      if (/categor[íi]a|rubro|departamento/i.test(text) && !q.category_id && !clearsFilter(text, 'categoria')) {
        this.history.update((h) => [
          ...h,
          {
            from: 'assistant',
            text: 'No pude resolver la categoría que mencionás. Sin ese dato no aplico el filtro — elegila en el dashboard o decime su nombre.',
          },
        ]);
        this.setBot('idle');
        return;
      }
      const parts: string[] = [];
      if (q.branch_id) parts.push('sucursal');
      if (q.category_id) parts.push('categoría');
      if (q.status) parts.push('estado');
      if (q.date_from || q.date_to) parts.push('período');
      this.assistantContext.applyToScreen(q, 'widget');
      const alreadyThere = this.router.url.split('?')[0] === '/admin/dashboard';
      if (!alreadyThere && !await this.router.navigate(['/admin/dashboard'])) throw new Error('No se pudo abrir el dashboard.');
      const aclaraciones = interpreted.aclaraciones.length ? ' ' + interpreted.aclaraciones.join(' ') : '';
      this.history.update((h) => [
        ...h,
        {
          from: 'assistant',
          text: `Envié al dashboard ${parts.length ? 'los filtros de ' + parts.join(' y ') : 'la consulta con el alcance actual'} y lo ${alreadyThere ? 'actualicé' : 'abrí'}.${aclaraciones}`,
        },
      ]);
      this.setBot('success');
    } catch (e) {
      this.setBot('error');
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
      const el = this.logRef?.nativeElement;
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 64) this.showNew.set(true);
      else this.scrollToBottom();
    }
  }
  private async sendToBackend() {
    this.busy.set(true);
    this.setBot('processing');
    try {
      const data = await this.commerce.write<{ available: boolean; reply: string }>(
        'POST',
        '/assistant',
        { message: this.lastUserText, context: this.currentModule() || undefined },
      );
      this.history.update((h) => [...h, { from: 'assistant', text: data.reply }]);
      this.setBot('success');
    } catch (e) {
      this.setBot('error');
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
      // Solo marca "Ver respuesta nueva" si el usuario no estaba al pie del chat.
      const el = this.logRef?.nativeElement;
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 64) this.showNew.set(true);
      else this.scrollToBottom();
    }
  }
  ngOnDestroy() {
    this.conversationVersion++;
    this.clearDownloads();
    this.stopVoice();
    this.stopSpeaking();
    if (this.botTimer) clearTimeout(this.botTimer);
  }
  private clearDownloads() {
    this.downloads().forEach(file => URL.revokeObjectURL(file.url));
    this.downloads.set([]);
    this.lastExport = null;
  }
}

