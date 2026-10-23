import { Injectable, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class PlanNoticeService {
  readonly notice = signal<{ code: string; details: Record<string, unknown> } | null>(null);
  show(code: string, details: Record<string, unknown> = {}) {
    this.notice.set({ code, details });
  }
  close() {
    this.notice.set(null);
  }
}
