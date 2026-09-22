import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/icon.component';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { errorMessage } from '../../../shared/errors';
import { TryOnAiService } from '../infrastructure/tryon-ai.service';
import {
  TRYON_DISCLAIMER,
  TryOnJob,
  tryonActivo,
  tryonEstadoLabel,
} from '../domain/tryon-jobs.models';

/** Cada cuánto se consulta el estado de un trabajo que quedó en cola. */
const POLL_MS = 3000;

/**
 * Panel «Foto realista con IA» (plan de evolución, Fase 3).
 *
 * Pide un trabajo con la foto de la persona y consulta su estado hasta que
 * termina. La generación es perezosa (corre al consultar), así que este panel
 * hace polling; el trabajo es del usuario, por eso sin sesión solo se ofrece
 * entrar. Toda foto tiene su aviso de simulación visible y se borra del
 * servidor al cancelar, expirar o eliminar.
 */
@Component({
  selector: 'fs-foto-realista',
  imports: [DatePipe, FormsModule, RouterLink, IconComponent],
  styles: [
    `
      .foto-realista {
        display: grid;
        gap: 12px;
      }
      .foto-realista h4 {
        margin: 8px 0 0;
      }
      .file-row {
        flex-direction: row;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border: 1px dashed var(--line);
        border-radius: 9px;
        font-weight: 500;
      }
      .file-row input {
        display: none;
      }
      .file-row:hover {
        border-color: var(--accent);
      }
      .foto-lista {
        display: grid;
        gap: 10px;
      }
      .foto-realista .tryon-result {
        grid-template-columns: 96px minmax(0, 1fr) auto;
        gap: 12px;
      }
      .foto-vacio {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 96px;
        height: 112px;
        color: var(--muted);
        background: var(--paper);
      }
    `,
  ],
  template: `<section class="panel foto-realista">
    <h3>Foto realista con IA</h3>
    @if (productName) {
      <p class="muted">
        Subí una foto de cuerpo completo: generamos una imagen de
        «{{ productName }}» sobre ella. {{ disclaimer }}
      </p>
    }
    @if (!session.user()) {
      <p class="muted">Las fotos IA se guardan en tu cuenta. Iniciá sesión para pedir la tuya.</p>
      <a class="button primary" [routerLink]="'/iniciar-sesion'" [queryParams]="{ returnUrl: router.url }">
        <fs-icon name="lock" />Entrar para generar mi foto
      </a>
    } @else {
      <label class="file-row">
        <fs-icon name="upload" />
        <span>{{ fileName() || 'Elegí tu foto' }}</span>
        <input
          type="file"
          accept="image/*"
          [disabled]="generating()"
          (change)="onFile($event)"
        />
      </label>
      <label class="check">
        <input type="checkbox" [(ngModel)]="consent" name="consent" />
        Acepto que mi foto se procese con el proveedor de IA configurado para generar esta
        imagen y que se elimine del servidor al cancelar, expirar o eliminar el trabajo.
      </label>
      <div class="form-actions">
        <button class="primary" [disabled]="!canGenerate()" (click)="generate()">
          <fs-icon name="image" />{{ generating() ? 'Subiendo…' : 'Generar foto realista' }}
        </button>
      </div>
      @if (error()) {
        <p class="alert error" role="alert">{{ error() }}</p>
      }
      @if (message()) {
        <p class="alert success" role="status">{{ message() }}</p>
      }

      <h4>Mis fotos de esta prenda</h4>
      @if (loading()) {
        <p class="muted">Cargando tus fotos…</p>
      } @else {
        <div class="foto-lista">
          @for (job of jobs(); track job.id) {
            <article class="tryon-result" [class.failed]="job.status === 'failed' || job.status === 'expired'">
              @if (job.result_url) {
                <img [src]="job.result_url" [alt]="'Foto IA de ' + productName" (error)="job.result_url = null" />
              } @else {
                <div class="foto-vacio" aria-hidden="true"><fs-icon name="image" /></div>
              }
              <div>
                <strong>{{ label(job.status) }}</strong>
                <p>{{ estadoTexto(job) }}</p>
                <small>{{ job.created_at | date: 'dd/MM HH:mm' }}</small>
              </div>
              <div class="row-actions">
                @if (tryonActivo(job) && pollId() !== job.id) {
                  <button class="danger-text" [disabled]="generating()" (click)="cancelar(job.id)">
                    Cancelar
                  </button>
                }
                @if (pollId() === job.id) {
                  <span class="muted">Consultando…</span>
                }
                @if (!tryonActivo(job)) {
                  <button class="danger-text" [disabled]="generating()" (click)="eliminar(job)">
                    Eliminar
                  </button>
                }
                @if (job.status === 'ready' && job.result_url) {
                  <a [href]="job.result_url" target="_blank" rel="noopener noreferrer">Abrir ↗</a>
                }
              </div>
            </article>
          } @empty {
            <p class="muted">Todavía no pediste fotos para esta prenda.</p>
          }
        </div>
      }
    }
  </section>`,
})
export class FotoRealistaComponent implements OnInit {
  @Input() productId = '';
  @Input() colorId: string | null = null;
  @Input() productName = '';

  private api = inject(TryOnAiService);
  session = inject(SessionService);
  router = inject(Router);
  private destroyRef = inject(DestroyRef);

  jobs = signal<TryOnJob[]>([]);
  loading = signal(false);
  generating = signal(false);
  pollId = signal('');
  consent = signal(false);
  fileName = signal('');
  error = signal('');
  message = signal('');
  disclaimer = TRYON_DISCLAIMER;
  label = tryonEstadoLabel;
  tryonActivo = tryonActivo;

  private file: File | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPoll());
  }

  ngOnInit() {
    // El historial es de la propia cuenta, así que solo se pide con sesión.
    if (this.session.user()) void this.loadHistory();
  }

  canGenerate() {
    return !!this.file && this.consent() && !this.generating();
  }

  onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.file = file;
    this.fileName.set(file?.name || '');
    this.error.set('');
    this.message.set('');
  }

  async loadHistory() {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      const todos = await this.api.mine();
      // El backend guarda los trabajos por cuenta; acá se acotan a la prenda
      // que se está viendo para que el panel acompañe la experiencia.
      this.jobs.set(todos.filter((j) => j.product_id === this.productId));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async generate() {
    if (!this.canGenerate() || !this.file) return;
    this.generating.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const job = await this.api.create(this.file, this.productId, this.colorId, this.consent());
      this.file = null;
      this.fileName.set('');
      this.consent.set(false);
      this.startPoll(job.id);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.generating.set(false);
    }
  }

  private startPoll(id: string) {
    this.stopPoll();
    this.pollId.set(id);
    this.pollTimer = setInterval(() => void this.tick(id), POLL_MS);
    void this.tick(id);
  }

  private stopPoll() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    if (this.pollId()) this.pollId.set('');
  }

  private async tick(id: string) {
    try {
      const job = await this.api.one(id);
      if (this.pollId() !== id) return;
      if (!tryonActivo(job)) {
        this.stopPoll();
        this.message.set(
          job.status === 'ready'
            ? 'Tu foto realista está lista.'
            : job.error || 'La generación no pudo completarse.',
        );
        await this.loadHistory();
      } else {
        this.message.set(
          job.status === 'queued'
            ? 'Trabajo en cola: pronto empieza la generación.'
            : 'Generando tu foto…',
        );
      }
    } catch (e) {
      if (this.pollId() !== id) return;
      this.stopPoll();
      this.message.set('');
      this.error.set(errorMessage(e));
    }
  }

  async cancelar(id: string) {
    if (this.generating()) return;
    this.error.set('');
    try {
      await this.api.cancel(id);
      this.stopPoll();
      this.message.set('Trabajo cancelado: tu foto se eliminó del servidor por privacidad.');
      await this.loadHistory();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async eliminar(job: TryOnJob) {
    if (this.generating()) return;
    this.error.set('');
    try {
      await this.api.remove(job.id);
      this.message.set('Foto eliminada del servidor.');
      await this.loadHistory();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  estadoTexto(job: TryOnJob) {
    return (
      {
        ready: 'Simulación generada a partir de tu foto.',
        failed: job.error || 'La generación no pudo completarse.',
        cancelled: 'Cancelada por vos: la foto se eliminó del servidor.',
        expired: 'Expiró: la foto se eliminó por privacidad.',
        processing: 'Generando… suele tardar unos segundos.',
        queued: 'En cola: la generación empieza en breve.',
      } as Record<string, string>
    )[job.status] || job.status;
  }
}

