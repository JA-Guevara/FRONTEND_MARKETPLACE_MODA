import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BackgroundSync {
  readonly supported = signal<boolean>(false);
  readonly lastRegisteredTag = signal<string | null>(null);

  constructor() {
    this.checkSupport();
  }

  private checkSupport(): boolean {
    const isAvailable =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      'SyncManager' in window;
    this.supported.set(isAvailable);
    return isAvailable;
  }

  /**
   * Registra una etiqueta de sincronización en segundo plano con el Service Worker (Chromium).
   * Si el navegador no lo soporta (Firefox, Safari), activa el respaldo por evento online.
   */
  async registrarSync(tag = 'fs-sync', fallbackOnOnline?: () => void): Promise<'registered' | 'fallback' | 'unsupported'> {
    if (this.checkSupport()) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if ('sync' in registration && typeof (registration as any).sync?.register === 'function') {
          await (registration as any).sync.register(tag);
          this.lastRegisteredTag.set(tag);
          return 'registered';
        }
      } catch {
        // En caso de fallo en registro, usar respaldo
      }
    }

    // Respaldo para Firefox/Safari o cuando Background Sync API no está disponible
    if (typeof window !== 'undefined' && fallbackOnOnline) {
      if (navigator.onLine) {
        fallbackOnOnline();
      } else {
        const handler = () => {
          fallbackOnOnline();
          window.removeEventListener('online', handler);
        };
        window.addEventListener('online', handler);
      }
      return 'fallback';
    }

    return 'unsupported';
  }
}
