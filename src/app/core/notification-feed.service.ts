import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './shared/api.service';
import { SessionService } from '../../features/usuarios-catalogo/application/session.service';
import { NoticesService } from './notices.service';

export interface AccountNotice {
  id: string; event_key?: string; tipo: string; estado: string; titulo: string;
  detalle: string; fecha: string; enlace: string; referencia: string;
  importante?: boolean; tono?: 'success' | 'warning' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class NotificationFeedService {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private notices = inject(NoticesService);
  readonly items = signal<AccountNotice[]>([]);
  private pendingScope: string | null = null;

  async refresh() {
    const scope = this.notices.scope();
    if (!this.session.user?.() || !navigator.onLine || document.visibilityState === 'hidden') return;
    if (this.pendingScope === scope) return;
    this.pendingScope = scope;
    try {
      const items = await firstValueFrom(this.api.get<AccountNotice[]>('/notifications', { limit: 30 }));
      if (scope !== this.notices.scope()) return;
      this.items.set(items);
      const recent = items.filter(item => item.importante && Date.parse(item.fecha) >= Date.now() - 86400000);
      for (const item of recent.slice(0, 3).reverse()) this.notices.show({
        key: item.event_key || item.id, title: item.titulo,
        detail: item.referencia + ' · ' + item.detalle, important: true,
        tone: item.tono || 'info', link: item.enlace,
      });
    } catch { /* Fallar el aviso no cambia el resultado del pago ni la pantalla. */ }
    finally { if (this.pendingScope === scope) this.pendingScope = null; }
  }

  clear() { this.items.set([]); this.pendingScope = null; }
}
