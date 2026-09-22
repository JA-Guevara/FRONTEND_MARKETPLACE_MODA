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
import { assistantIntent, clearsFilter, commandText, queryForCommand, requestedReports } from '../application/assistant-intent';

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
  draftCategories = signal<Entity[]>([]);
  draftBusy = signal(false);
  currentModule = signal(this.resolveModule(this.router.url));
  private lastUserText = '';
  private conversationVersion = 0;
  private sessionUserId = this.session.user()?.id ?? null;
  /** A qué handler reintentar: los pedidos de reporte y el borrador de prenda
   * usan flujos distintos al chat general, y "Reintentar" debe repetir el
   * mismo y no caer en el chat general. */
  private lastIntent: 'chat' | 'draft' | 'export' | 'explain' | 'apply' = 'chat';
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
    const intent = assistantIntent(text);
    const required = intent === 'draft' ? 'catalog.write' : intent !== 'chat' ? 'dashboard.read' : null;
    if (required && !this.session.can(required)) {
      this.history.update(h => [...h, { from: 'assistant', text: 'Tu cuenta no tiene permiso para realizar esa operación. Iniciá sesión con una cuenta autorizada.' }]);
      return;
    }
    if (intent === 'draft') {
      this.lastIntent = 'draft';
      await this.requestProductDraft(text);
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
  async retry() {
    if (!this.lastUserText || this.busy()) return;
    // Reintento: no se agrega de nuevo el mensaje del usuario, y repite el
    // mismo tipo de pedido (borrador de prenda, chat, exportar o explicar).
    this.error.set('');
    if (this.lastIntent === 'export') await this.requestExport(this.lastUserText);
    else if (this.lastIntent === 'explain') await this.requestExplain(this.lastUserText);
    else if (this.lastIntent === 'apply') await this.requestApply(this.lastUserText);
    else if (this.lastIntent === 'draft') await this.requestProductDraft(this.lastUserText);
    else await this.sendToBackend();
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

