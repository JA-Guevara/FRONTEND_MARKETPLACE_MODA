import { Component, DestroyRef, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { CommerceService } from '../infrastructure/commerce.service';
import { SessionService } from '../../auth/application/session.service';
import { CatalogService } from '../../usuarios-catalogo/infrastructure/catalog.service';
import { Entity, ProductDraftInput } from '../../usuarios-catalogo/domain/catalog.models';
import { IconComponent } from '../../../shared/icon.component';
import { BotAvatarComponent, BotState } from '../../../shared/bot-avatar.component';
import { errorMessage } from '../../../shared/errors';

/** Pedidos de alta de prenda ("registrame una campera...", "creá un producto
 * nuevo..."): se detectan por palabras clave, nunca por IA, para decidir de
 * forma predecible si se muestra el borrador editable en vez de la respuesta
 * de texto normal. */
const PRODUCT_INTENT = /\b(registra|registrar|registrame|crea|crear|creame|agrega|agregar|agregame|da(?:me)? de alta|alta de)\b.*\b(prenda|producto|camisa|remera|pantalon|campera|chaqueta|vestido|falda|short|buzo|casaca|polera)\b/i;

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
  private catalog = inject(CatalogService);
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
  /** Borrador de prenda pendiente de revisión (null = no hay ninguno abierto). */
  productDraft = signal<ProductDraftInput | null>(null);
  draftCategories = signal<Entity[]>([]);
  draftBusy = signal(false);
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
    this.productDraft.set(null);
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
    if (PRODUCT_INTENT.test(text) && this.session.can('catalog.write')) {
      await this.requestProductDraft(text);
    } else {
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