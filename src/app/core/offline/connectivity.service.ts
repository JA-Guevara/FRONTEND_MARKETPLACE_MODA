import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  readonly online = signal(typeof navigator === 'undefined' || navigator.onLine);
  readonly lastChange = signal(new Date());
  readonly servidorAlcanzable = signal<boolean>(true);

  constructor() {
    const update = () => {
      this.online.set(navigator.onLine);
      this.lastChange.set(new Date());
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      try {
        inject(DestroyRef, { optional: true })?.onDestroy(() => {
          window.removeEventListener('online', update);
          window.removeEventListener('offline', update);
        });
      } catch {
        // Fuera de contexto de inyección
      }
    }
  }

  async comprobarServidor(timeoutMs = 4000): Promise<boolean> {
    if (!this.online()) {
      this.servidorAlcanzable.set(false);
      return false;
    }
    const proc = (globalThis as { process?: { env?: Record<string, string> } }).process;
    if (
      typeof window === 'undefined' ||
      (proc && (proc.env?.['NODE_ENV'] === 'test' || proc.env?.['VITEST']))
    ) {
      return this.servidorAlcanzable();
    }
    try {
      if (typeof fetch === 'undefined') {
        this.servidorAlcanzable.set(true);
        return true;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${environment.apiUrl}/offline/ping`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);
      const ok = res.ok;
      this.servidorAlcanzable.set(ok);
      return ok;
    } catch {
      this.servidorAlcanzable.set(false);
      return false;
    }
  }
}
