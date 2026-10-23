import { DestroyRef, Injectable, inject, signal } from '@angular/core';
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  readonly canInstall = signal(false);
  readonly installed = signal(
    typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches,
  );
  private promptEvent: InstallEvent | null = null;
  constructor() {
    const prompt = (e: Event) => {
      e.preventDefault();
      this.promptEvent = e as InstallEvent;
      this.canInstall.set(true);
    };
    const installed = () => {
      this.installed.set(true);
      this.canInstall.set(false);
      this.promptEvent = null;
    };
    window.addEventListener('beforeinstallprompt', prompt);
    window.addEventListener('appinstalled', installed);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', prompt);
      window.removeEventListener('appinstalled', installed);
    });
  }
  async install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.promptEvent) return 'unavailable';
    const event = this.promptEvent;
    await event.prompt();
    const choice = await event.userChoice;
    this.canInstall.set(false);
    this.promptEvent = null;
    return choice.outcome;
  }
}
