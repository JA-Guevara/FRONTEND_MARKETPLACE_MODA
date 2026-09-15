import { Component, DestroyRef, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { CommerceService } from '../infrastructure/commerce.service';
import { SessionService } from '../../auth/application/session.service';
import { IconComponent } from '../../../shared/icon.component';
import { BotAvatarComponent, BotState } from '../../../shared/bot-avatar.component';
import { errorMessage } from '../../../shared/errors';

interface ChatEntry {
  from: 'user' | 'assistant';
  text: string;
}

const MODULE_LABELS: { prefix: string; label: string }[] = [
  { prefix: '/admin/reservas', label: 'Reservas (gestión)' },
  { prefix: '/admin/pedidos', label: 'Pedidos y pagos (gestión)' },
  { prefix: '/admin/stock', label: 'Existencias (gestión)' },
  { prefix: '/admin/bitacora', label: 'Bitácora' },
  { prefix: '/admin', label: 'Dashboard de reportes' },
  { prefix: '/agendar-visita', label: 'Agendar visita' },
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
    .ai-chip { color: var(--accent); border: 0; background: none; font-size: 12px; min-height: 0;
      padding: 0; }
    .ai-new { align-self: center; justify-self: end; margin-top: 6px; }
    .ai-msg--assistant .button-text { font-size: inherit; }
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
              @for (q of suggestions; track q) {
                <button type="button" (click)="send(q)">{{ q }}</button>
              }
            </div>
          }
          @for (m of history(); track $index) {
            <p [class]="'ai-msg ai-msg--' + m.from">{{ m.text }}</p>
          }
          @if (busy()) {
            <p class="ai-msg ai-msg--assistant" role="status"><fs-bot-avatar state="processing" />
            <span class="ai-msg--thinking">…</span></p>
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
            maxlength="500"
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
              (click)="toggleVoice()"
              aria-label="Hablar"
            >
              <fs-icon name="mic" />
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
      </section>
    }
  </div>`,
})
export class AssistantWidgetComponent implements OnDestroy {
  private commerce = inject(CommerceService);
  private session = inject(SessionService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  @ViewChild('log') private logRef?: ElementRef<HTMLDivElement>;
  open = signal(false);
  expanded = signal(false);
  draft = '';
  busy = signal(false);
  error = signal('');
  listening = signal(false);
  history = signal<ChatEntry[]>([]);
  showNew = signal(false);
  suggestions = SUGGESTIONS;
  currentModule = signal(this.resolveModule(this.router.url));
  private lastUserText = '';
  botState = signal<BotState>('idle');
  private recognition: any;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  readonly voiceSupported: boolean;

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.currentModule.set(this.resolveModule(e.urlAfterRedirects)));
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.voiceSupported = !!SpeechRecognitionCtor;
    if (SpeechRecognitionCtor) {
      this.recognition = new SpeechRecognitionCtor();
      this.recognition.lang = 'es-BO';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
      this.recognition.addEventListener('start', () => this.listening.set(true));
      this.recognition.addEventListener('end', () => this.listening.set(false));
      this.recognition.addEventListener('error', () => this.listening.set(false));
      this.recognition.addEventListener('result', (event: any) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
        text = text.trim();
        if (text) void this.send(text);
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
    this.open.set(false);
  }
  close() {
    this.stopVoice();
    this.open.set(false);
    this.history.set([]);
    this.error.set('');
  }
  toggleVoice() {
    if (!this.recognition) return;
    if (this.listening()) {
      this.recognition.stop();
      return;
    }
    try {
      this.recognition.start();
    } catch {
      /* ya estaba iniciado */
    }
  }
  stopVoice() {
    if (this.recognition && this.listening()) {
      try {
        this.recognition.stop();
      } catch {
        /* no estaba iniciado */
      }
    }
  }
  greetName() {
    const name = this.session.user()?.first_name;
    return name ? ', ' + name : '';
  }
  contextLabel() {
    return this.currentModule() || 'Te acompaño en toda la tienda';
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
    await this.sendToBackend();
  }
  async retry() {
    if (!this.lastUserText || this.busy()) return;
    // Reintento: no se agrega de nuevo el mensaje del usuario.
    this.error.set('');
    await this.sendToBackend();
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
    this.stopVoice();
    if (this.botTimer) clearTimeout(this.botTimer);
  }
}