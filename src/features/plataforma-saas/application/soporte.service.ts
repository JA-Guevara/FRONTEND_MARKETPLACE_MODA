import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import {
  SupportSessionStart,
  TenantLite,
  remainingMs,
} from '../domain/soporte.models';

@Injectable({ providedIn: 'root' })
export class SoporteService {
  private api = inject(PlataformaApi);
  private session = inject(SessionService);
  private router = inject(Router);

  private readonly recentKey = 'fashionstore.support.recent';
  private timer: any = null;

  readonly remaining = signal<number>(0);
  readonly recientes = signal<TenantLite[]>([]);

  constructor() {
    this.loadRecientes();
    if (this.session.isSupport()) {
      this.initCountdown();
    }
  }

  private loadRecientes(): void {
    try {
      const raw = sessionStorage.getItem(this.recentKey);
      if (raw) {
        this.recientes.set(JSON.parse(raw));
      }
    } catch {
      /* ignore */
    }
  }

  private addReciente(tenant: { id: string; trade_name: string; slug?: string }): void {
    const list = this.recientes().filter((t) => t.id !== tenant.id);
    const updated = [
      { id: tenant.id, trade_name: tenant.trade_name, slug: tenant.slug },
      ...list,
    ].slice(0, 5);
    this.recientes.set(updated);
    try {
      sessionStorage.setItem(this.recentKey, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
  }

  private initCountdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const sup = this.session.support();
    if (!sup) {
      this.remaining.set(0);
      return;
    }

    const update = () => {
      const activeSup = this.session.support();
      if (!activeSup) {
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        this.remaining.set(0);
        return;
      }
      const ms = remainingMs(activeSup.session);
      this.remaining.set(ms);
      if (ms <= 0) {
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        void this.terminar();
      }
    };

    update();
    this.timer = setInterval(update, 1000);
  }

  async iniciar(
    tenant: { id: string; trade_name: string; slug?: string },
    reason: string,
    minutes: number
  ): Promise<void> {
    const start = await firstValueFrom(
      this.api.startSupport(tenant.id, { reason, duration_minutes: minutes })
    );
    this.session.startSupport(start);
    this.addReciente(tenant);
    this.initCountdown();
    await this.router.navigate(['/admin']);
  }

  async extender(minutes = 30): Promise<void> {
    const sup = this.session.support();
    if (!sup) return;
    try {
      const updatedSession = await firstValueFrom(
        this.api.extendSupport(sup.session.id, minutes)
      );
      const updatedStart: SupportSessionStart = {
        ...sup,
        session: updatedSession,
        expires_in: Math.floor(remainingMs(updatedSession) / 1000),
      };
      this.session.startSupport(updatedStart);
      this.initCountdown();
    } catch (e) {
      console.error('Error al extender soporte:', e);
      throw e;
    }
  }

  async terminar(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const sup = this.session.support();
    if (sup) {
      try {
        await firstValueFrom(this.api.endSupport(sup.session.id));
      } catch {
        /* ignore error on backend; still clear session locally */
      }
    }
    this.session.endSupport();
    this.remaining.set(0);
    await this.router.navigate(['/admin/plataforma']);
  }
}
