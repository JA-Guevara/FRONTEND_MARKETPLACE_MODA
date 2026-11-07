import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SessionService } from '../../features/usuarios-catalogo/application/session.service';

export interface AppNotice {
  key: string;
  title: string;
  detail: string;
  tone?: 'success' | 'warning' | 'error' | 'info';
  important?: boolean;
  link?: string;
}

@Injectable({ providedIn: 'root' })
export class NoticesService {
  private session = inject(SessionService);
  readonly scope = computed(() => [this.session.user?.()?.id ?? 'guest', this.session.tenant?.()?.id ?? 'platform', this.session.support?.()?.session.id ?? ''].join(':'));
  readonly messages = signal<AppNotice[]>([]);
  readonly modal = computed(() => this.messages().find(message => message.important));
  readonly toasts = computed(() => this.messages().filter(message => !message.important).slice(-3));
  private seen = new Set<string>();
  private activeScope = '';

  constructor() {
    effect(() => this.ensureScope(this.scope()));
  }

  private ensureScope(scope: string) {
    if (scope === this.activeScope) return;
    this.activeScope = scope;
    this.messages.set([]);
    try { this.seen = new Set(JSON.parse(localStorage.getItem('fashionstore.popups.' + scope) || '[]')); }
    catch { this.seen = new Set(); }
  }

  show(notice: AppNotice) {
    this.ensureScope(this.scope());
    if (this.seen.has(notice.key)) return;
    this.seen.add(notice.key);
    this.seen = new Set([...this.seen].slice(-200));
    try { localStorage.setItem('fashionstore.popups.' + this.activeScope, JSON.stringify([...this.seen])); } catch { /* memoria de esta sesión */ }
    const link = notice.link?.startsWith('/') && !notice.link.startsWith('//') ? notice.link : undefined;
    this.messages.update(messages => [...messages, { ...notice, link }].slice(-10));
  }

  dismiss(key: string) { this.messages.update(messages => messages.filter(message => message.key !== key)); }
}
