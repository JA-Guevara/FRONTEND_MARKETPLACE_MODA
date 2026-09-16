import { Component, DestroyRef, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { CommerceService } from '../infrastructure/commerce.service';
import { SessionService } from '../../auth/application/session.service';
import { CatalogService } from '../../usuarios-catalogo/infrastructure/catalog.service';
import { Entity, ProductDraftInput } from '../../usuarios-catalogo/domain/catalog.models';
import { DashboardService } from '../../ia-reportes/infrastructure/dashboard.service';
import { ExportReport, InterpretResult, ReportQuery } from '../../ia-reportes/domain/dashboard';
import { IconComponent } from '../../../shared/icon.component';
import { BotAvatarComponent, BotState } from '../../../shared/bot-avatar.component';
import { AssistantContextService } from '../../../shared/assistant-context.service';
import { errorMessage } from '../../../shared/errors';

/** Pedidos de alta de prenda ("registrame una campera...", "creá un producto
 * nuevo..."): se detectan por palabras clave, nunca por IA, para decidir de
 * forma predecible si se muestra el borrador editable en vez de la respuesta
 * de texto normal. */
const PRODUCT_INTENT = /\b(registra|registrar|registrame|crea|crear|creame|agrega|agregar|agregame|da(?:me)? de alta|alta de)\b.*\b(prenda|producto|camisa|remera|pantalon|campera|chaqueta|vestido|falda|short|buzo|casaca|polera)\b/i;
/** Palabras que indican que el pedido es sobre un reporte del dashboard
 * (ventas, pedidos, existencias, etc.), para distinguir "exportame el reporte
 * de ventas" o "explicame por qué bajaron los pedidos" de una pregunta
 * general de la tienda. */
const REPORT_NOUNS = 'reporte|dashboard|ventas|ingresos|pedidos|pagos|existencias|stock|sucursales|prendas vendidas|ticket|reservas|tendencia';
/** Referencias al contexto visible del dashboard: "exportá esto", "explicame
 * eso mismo". Sin un sustantivo de reporte, estas frases le dicen al asistente
 * que trabaje con los filtros que la pantalla ya está mostrando. */
const CONTEXT_TERMS = 'esto|eso|eso mismo|lo que estoy viendo|lo que veo|en pantalla|el contexto actual|este contexto|este dashboard';
/** Fin de palabra tolerante a acentos: "exportá" termina en "á", que JS no
 * considera palabra, así que \b no existe ahí. El lookahead impide que la
 * conjugación sea parte de una palabra más larga ("exportarx"). */
const UI_WORD_END = '(?![a-z0-9_])';
const EXPORT_INTENT = new RegExp(
  `\\b(export[aá](me)?|exportar|descarga(me)?|descargar|b[aá]jame|mand[aá]me|envi[aá]me|pasame)${UI_WORD_END}(?:[^.!?]){0,60}?\\b(${REPORT_NOUNS}|${CONTEXT_TERMS})\\b`,
  'i',
);
const EXPLAIN_INTENT = new RegExp(
  `\\b(explic[aá](me)?|explicar|analiza(me)?|analizame|interpreta(me)?|por ?qu[eé])${UI_WORD_END}(?:[^.!?]){0,60}?\\b(${REPORT_NOUNS}|${CONTEXT_TERMS})\\b`,
  'i',
);
/** Pedidos de ver un reporte con un filtro en la pantalla: "mostrame ventas de
 * la sucursal norte", "filtrá el dashboard por la categoría camisas". Se
 * interpretan igual que los demás y el filtro resuelto se APLICA en el
 * dashboard (Etapa 3), además de responder por chat. */
const APPLY_INTENT = new RegExp(
  `\\b(mostr[ae](me)?|muestr[ae](me)?|filtr[ae](me)?|aplic[aá]\\s+(el\\s+|este\\s+|los\\s+)?filtros?)\\b(?:[^.!?]){0,80}?\\b(${REPORT_NOUNS}|${CONTEXT_TERMS})\\b`,
  'i',
);
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
    .ai-msg--typing { display: inline-flex; align-items: center; gap: 5px; }
    .ai-msg--typing .ai-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
      animation: ai-dot-blink 1.2s ease-in-out infinite; }
    .ai-msg--typing .ai-dot:nth-child(2) { animation-delay: 0.15s; }
    .ai-msg--typing .ai-dot:nth-child(3) { animation-delay: 0.3s; }
    .ai-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;
      clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    @keyframes ai-dot-blink {
      0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-3px); }
    }
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
  history = signal<ChatEntry[]>([]);
  showNew = signal(false);
  /** Borrador de prenda pendiente de revisión (null = no hay ninguno abierto). */
  productDraft = signal<ProductDraftInput | null>(null);
  draftCategories = signal<Entity[]>([]);
  draftBusy = signal(false);
  currentModule = signal(this.resolveModule(this.router.url));
  private lastUserText = '';
  /** A qué handler reintentar: los pedidos de reporte y el borrador de prenda
   * usan flujos distintos al chat general, y "Reintentar" debe repetir el
   * mismo y no caer en el chat general. */
  private lastIntent: 'chat' | 'draft' | 'export' | 'explain' | 'apply' = 'chat';
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
        if (text) this.draft = text;
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
    if (PRODUCT_INTENT.test(text) && this.session.can('catalog.write')) {
      this.lastIntent = 'draft';
      await this.requestProductDraft(text);
    } else if (EXPORT_INTENT.test(text) && this.session.can('dashboard.read')) {
      this.lastIntent = 'export';
      await this.requestExport(text);
    } else if (EXPLAIN_INTENT.test(text) && this.session.can('dashboard.read')) {
      this.lastIntent = 'explain';
      await this.requestExplain(text);
    } else if (APPLY_INTENT.test(text) && this.session.can('dashboard.read')) {
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
    this.busy.set(true);
    this.setBot('processing');
    try {
      const current = this.assistantContext.report();
      const interpreted = await firstValueFrom(this.dashboard.interpret(text, current));
      const format: 'xlsx' | 'csv' = /\bcsv\b/i.test(text) ? 'csv' : 'xlsx';
      const report = exportReportType(text, interpreted);
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
      // El intérprete gana por campo; lo que dejó sin resolver cae al contexto
      // visible del dashboard ("exportá esto" = exactamente lo que se ve).
      const q: ReportQuery = {
        branch_id: interpreted.filtros.branch_id ?? current.branch_id ?? null,
        category_id: interpreted.filtros.category_id ?? current.category_id ?? null,
        status: interpreted.filtros.status ?? current.status ?? undefined,
        date_from: interpreted.filtros.date_from ?? current.date_from ?? undefined,
        date_to: interpreted.filtros.date_to ?? current.date_to ?? undefined,
      };
      // No exportar "todo" silenciosamente si el usuario mencionó un filtro
      // que no se pudo resolver y el contexto visible tampoco lo aporta.
      // No exportar "todo" silenciosamente si el usuario mencionó una sucursal
      // puntual que no se pudo resolver y el contexto visible tampoco la aporta.
      // "por sucursal" es una agrupación, no una sucursal concreta: no aplica.
      const mentionsBranchButNotGrouping =
        /sucursal|local|tienda\s+de/i.test(text) && !/por\s+sucursal/i.test(text);
      if (report !== 'sucursales' && mentionsBranchButNotGrouping && !q.branch_id) {
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
      if (/categor[íi]a|rubro|departamento/i.test(text) && !q.category_id) {
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
        this.dashboard.executeTool(requestId, 'export_report', [report], format, q),
      );
      const blob = response.body;
      if (!blob) throw new Error('El servidor no devolvió el archivo.');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `fashionstore_${report}.${format}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const replayed = response.headers.get('X-Idempotent-Replay') === 'true';
      const aclaraciones = interpreted.aclaraciones.length ? ' ' + interpreted.aclaraciones.join(' ') : '';
      this.history.update((h) => [
        ...h,
        {
          from: 'assistant',
          text:
            (replayed ? 'Enviaste la misma solicitud dos veces: ' : 'Descargando el reporte de ') +
            `${EXPORT_REPORT_LABEL[report]} en ${format.toUpperCase()}.${aclaraciones}` +
            (replayed ? ' No lo generé de nuevo para no duplicar nada.' : ''),
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
    this.busy.set(true);
    this.setBot('processing');
    try {
      const result = await firstValueFrom(this.dashboard.explain(text, this.assistantContext.report()));
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
    this.busy.set(true);
    this.setBot('processing');
    try {
      const current = this.assistantContext.report();
      const interpreted = await firstValueFrom(this.dashboard.interpret(text, current));
      const q: ReportQuery = {
        branch_id: interpreted.filtros.branch_id ?? current.branch_id ?? null,
        category_id: interpreted.filtros.category_id ?? current.category_id ?? null,
        status: interpreted.filtros.status ?? current.status ?? undefined,
        date_from: interpreted.filtros.date_from ?? current.date_from ?? undefined,
        date_to: interpreted.filtros.date_to ?? current.date_to ?? undefined,
      };
      const mentionsBranchButNotGrouping =
        /sucursal|local|tienda\s+de/i.test(text) && !/por\s+sucursal/i.test(text);
      if (mentionsBranchButNotGrouping && !q.branch_id) {
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
      if (/categor[íi]a|rubro|departamento/i.test(text) && !q.category_id) {
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
      if (!parts.length) {
        this.history.update((h) => [
          ...h,
          {
            from: 'assistant',
            text: 'No encontré un filtro claro para aplicar. Decime, por ejemplo, "mostrame las ventas de la sucursal norte" o "filtrá por la categoría camisas".',
          },
        ]);
        this.setBot('idle');
        return;
      }
      this.assistantContext.applyToScreen(q, 'widget');
      const alreadyThere = this.router.url.split('?')[0] === '/admin';
      if (!alreadyThere) await this.router.navigate(['/admin']);
      const aclaraciones = interpreted.aclaraciones.length ? ' ' + interpreted.aclaraciones.join(' ') : '';
      this.history.update((h) => [
        ...h,
        {
          from: 'assistant',
          text: `Apliqué el filtro de ${parts.join(' y ')} en el dashboard y lo ${alreadyThere ? 'actualicé' : 'abrí'}.${aclaraciones}`,
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
    this.stopVoice();
    if (this.botTimer) clearTimeout(this.botTimer);
  }
}