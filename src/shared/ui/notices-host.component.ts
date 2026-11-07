import { Component, DestroyRef, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NoticesService } from '../../app/core/notices.service';
import { NotificationFeedService } from '../../app/core/notification-feed.service';
import { DialogFocusDirective } from '../dialog-focus.directive';

@Component({
  selector: 'fs-notices-host',
  imports: [RouterLink, DialogFocusDirective],
  template: `
    <aside class="notice-stack" aria-live="polite" aria-label="Avisos de operaciones">
      @for (notice of notices.toasts(); track notice.key) {
        <article class="notice-card" [attr.data-tone]="notice.tone" role="status">
          <strong>{{ notice.title }}</strong><p>{{ notice.detail }}</p>
          <button (click)="notices.dismiss(notice.key)" aria-label="Cerrar aviso">✕</button>
          @if (notice.link) { <a [routerLink]="notice.link" (click)="notices.dismiss(notice.key)">Ver detalle</a> }
        </article>
      }
    </aside>
    @if (notices.modal(); as notice) {
      <div class="notice-backdrop">
        <section role="alertdialog" aria-modal="true" aria-labelledby="operation-notice-title" aria-describedby="operation-notice-detail"
          class="notice-dialog" [attr.data-tone]="notice.tone" (dismissed)="notices.dismiss(notice.key)">
          <span class="notice-symbol" aria-hidden="true">{{ notice.tone === 'success' ? '✓' : notice.tone === 'error' ? '!' : 'i' }}</span>
          <h2 id="operation-notice-title">{{ notice.title }}</h2>
          <p id="operation-notice-detail">{{ notice.detail }}</p>
          <div class="notice-actions">
            <button class="primary" (click)="notices.dismiss(notice.key)">Entendido</button>
            @if (notice.link) { <a [routerLink]="notice.link" (click)="notices.dismiss(notice.key)">Ver detalle</a> }
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    .notice-stack { position:fixed; right:18px; top:85px; z-index:1500; display:grid; gap:12px; width:min(390px,calc(100vw - 36px)); pointer-events:none; }
    .notice-card,.notice-dialog { background:var(--surface,#fff); color:var(--ink,#24231f); border:1px solid var(--line,#ddd); border-top:5px solid var(--accent,#74394e); border-radius:18px; padding:22px; box-shadow:0 18px 60px #0003; pointer-events:auto; }
    .notice-card { position:relative; padding-right:45px; } .notice-card>button { position:absolute; right:8px; top:8px; border:0; background:none; }
    .notice-card p,.notice-dialog p { line-height:1.6; margin:10px 0 16px; overflow-wrap:anywhere; }
    .notice-backdrop { position:fixed; inset:0; z-index:1600; display:grid; place-items:center; background:#0007; padding:16px; }
    .notice-dialog { width:min(480px,100%); max-height:calc(100dvh - 32px); overflow:auto; text-align:center; }
    .notice-dialog h2 { font-size:24px; margin:12px 0; } .notice-actions { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; align-items:center; }
    .notice-symbol { display:grid; place-items:center; width:60px; height:60px; margin:auto; border-radius:50%; background:var(--accent-soft,#f4e9ed); font-size:32px; font-weight:700; }
    [data-tone=success] { border-top-color:#19754c; } [data-tone=warning] { border-top-color:#a36a04; } [data-tone=error] { border-top-color:#b83232; }
    @media(max-width:600px) { .notice-stack { right:12px; top:70px; width:calc(100vw - 24px); } }
  `,
})
export class NoticesHostComponent {
  readonly notices = inject(NoticesService);
  private feed = inject(NotificationFeedService);
  constructor() {
    effect(() => { this.notices.scope(); untracked(() => { this.feed.clear(); void this.feed.refresh(); }); });
    const refresh = () => void this.feed.refresh();
    const timer = setInterval(refresh, 45000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    inject(DestroyRef).onDestroy(() => { clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); });
  }
}
