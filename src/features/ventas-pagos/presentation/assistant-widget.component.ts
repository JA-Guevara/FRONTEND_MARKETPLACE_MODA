import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommerceService } from '../infrastructure/commerce.service';
import { IconComponent } from '../../../shared/icon.component';
import { errorMessage } from '../../../shared/errors';

interface ChatEntry {
  from: 'user' | 'assistant';
  text: string;
}

/** Asistente virtual del cliente (CU24): widget flotante que consulta
 * POST /commerce/assistant, el mismo modelo de IA que ya usa el dashboard
 * admin para insights, pero con un prompt orientado al comprador. */
@Component({
  selector: 'fs-assistant-widget',
  imports: [FormsModule, IconComponent],
  template: `<div class="assistant-widget" [class.open]="open()">
    <button
      class="assistant-toggle"
      type="button"
      (click)="open.set(!open())"
      [attr.aria-expanded]="open()"
      aria-label="Asistente de FashionStore"
    >
      <fs-icon [name]="open() ? 'close' : 'chat'" />
    </button>
    @if (open()) {
      <div class="assistant-panel" role="dialog" aria-label="Asistente virtual">
        <h3>Asistente FashionStore</h3>
        <p class="muted">Preguntame sobre tallas, temporadas o cómo reservar una visita.</p>
        <div class="assistant-log">
          @for (m of history(); track $index) {
            <p [class]="'assistant-msg ' + m.from">{{ m.text }}</p>
          }
          @if (busy()) {
            <p class="assistant-msg assistant">Pensando…</p>
          }
        </div>
        @if (error()) {
          <p class="alert error" role="alert">{{ error() }}</p>
        }
        <form (ngSubmit)="send()">
          <input
            name="message"
            [(ngModel)]="draft"
            maxlength="1000"
            placeholder="Escribí tu consulta…"
            [disabled]="busy()"
          />
          <button class="primary" type="submit" [disabled]="busy() || !draft.trim()">Enviar</button>
        </form>
      </div>
    }
  </div>`,
})
export class AssistantWidgetComponent {
  private commerce = inject(CommerceService);
  open = signal(false);
  draft = '';
  busy = signal(false);
  error = signal('');
  history = signal<ChatEntry[]>([]);
  async send() {
    const message = this.draft.trim();
    if (!message || this.busy()) return;
    this.draft = '';
    this.error.set('');
    this.history.update((h) => [...h, { from: 'user', text: message }]);
    this.busy.set(true);
    try {
      const data = await this.commerce.write<{ available: boolean; reply: string }>(
        'POST',
        '/assistant',
        { message },
      );
      this.history.update((h) => [...h, { from: 'assistant', text: data.reply }]);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
