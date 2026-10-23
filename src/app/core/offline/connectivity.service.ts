import { DestroyRef, Injectable, inject, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  readonly online = signal(typeof navigator === 'undefined' || navigator.onLine);
  readonly lastChange = signal(new Date());
  constructor() {
    const update = () => {
      this.online.set(navigator.onLine);
      this.lastChange.set(new Date());
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    });
  }
}
