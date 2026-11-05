import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DictadoService {
  grabando = signal(false);
  segundos = signal(0);
  error = signal<string | null>(null);

  private recognition: any = null;
  private timer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'es-BO';
      }
    }
  }

  get disponible(): boolean {
    return Boolean(this.recognition);
  }

  iniciar(): Promise<string> {
    this.error.set(null);
    this.segundos.set(0);

    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        this.error.set('El reconocimiento por voz no está disponible en este navegador.');
        reject(new Error('No compatible'));
        return;
      }

      this.grabando.set(true);
      this.timer = setInterval(() => {
        const seg = this.segundos() + 1;
        this.segundos.set(seg);
        if (seg >= 30) {
          this.detener();
        }
      }, 1000);

      this.recognition.onresult = (event: any) => {
        this.limpiar();
        const texto = event.results?.[0]?.[0]?.transcript || '';
        resolve(texto);
      };

      this.recognition.onerror = (event: any) => {
        this.limpiar();
        const msg = event.error === 'not-allowed'
          ? 'Permiso de micrófono denegado.'
          : 'Error al capturar audio.';
        this.error.set(msg);
        reject(new Error(msg));
      };

      this.recognition.onend = () => {
        if (this.grabando()) {
          this.limpiar();
          resolve('');
        }
      };

      try {
        this.recognition.start();
      } catch (err: any) {
        this.limpiar();
        this.error.set('No se pudo iniciar el micrófono.');
        reject(err);
      }
    });
  }

  detener(): void {
    if (this.recognition && this.grabando()) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.limpiar();
  }

  private limpiar(): void {
    this.grabando.set(false);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
