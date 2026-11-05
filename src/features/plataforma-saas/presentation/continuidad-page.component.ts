import { Component, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Respaldo } from '../infrastructure/operacion.api';
import { OperacionViewState } from './operacion-view-state';
import { RestaurarDrawerComponent } from './restaurar-drawer.component';
import { errorMessage } from '../../../shared/errors';

@Component({
  standalone: true, imports: [DatePipe, FormsModule, RestaurarDrawerComponent], selector: 'fs-continuidad-page',
  styleUrl: './continuidad-page.component.scss',
  template: `<section class="operation-page"><header><div><p class="eyebrow">OPERACIÓN</p><h1>Continuidad y respaldos</h1><p>Recuperar los datos empieza por comprobar que una copia se puede restaurar.</p></div><button (click)="reload(); cargar(page())" [disabled]="!permitted() || loading()">Actualizar</button></header>
    @if (error()) { <p role="alert">{{ error() }}</p> }
    @if (loading()) { <p role="status">Cargando estado…</p> }
    @if (estado(); as status) {
      <div class="kpis"><article [class.danger]="enPeligro()"><span>Última copia verificada</span><strong>{{ status.ultimo_respaldo ? status.ultimo_respaldo.age_hours.toFixed(1) + ' h' : 'Sin copia verificada' }}</strong></article>
      <article><span>Objetivo RPO</span><strong>24 h</strong></article><article><span>Objetivo RTO</span><strong>1 h</strong></article><article><span>Copias registradas</span><strong>{{ total() }}</strong></article></div>
      @if (session.can('platform.ops.write')) { <form (ngSubmit)="dispatch()"><label>Motivo de la copia manual<input name="reason" [(ngModel)]="reason" required minlength="3" maxlength="300"></label><button [disabled]="busy() || reason.trim().length < 3">{{ busy() ? 'Solicitando…' : 'Respaldar ahora' }}</button></form> }
      @if (message()) { <p role="status">{{ message() }}</p> }
      @if (historyError()) { <p role="alert">{{ historyError() }}</p> }
      @if (historyLoading()) { <p role="status">Cargando historial…</p> }
      @if (!historyLoading() && !historyError() && copias().length === 0) { <p>No hay copias registradas. Una copia solo cuenta después de restaurarla y verificarla.</p> }
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Revisión</th><th>Verificación</th><th>Detalle</th></tr></thead><tbody>
      @for (copy of copias(); track copy.id) { <tr><td>{{ copy.finished_at | date:'short' }}</td><td>{{ copy.kind }}</td><td>{{ copy.alembic_revision || 'No disponible' }}</td><td>{{ copy.verify_status === 'ok' ? 'Verificada' : copy.verify_status === 'failed' ? 'Fallida' : 'Pendiente' }}</td><td><button (click)="selected.set(copy)">Cómo se verifica</button><button (click)="guide.set(copy)" [disabled]="copy.verify_status !== 'ok'">Guía de restauración</button></td></tr> }
      </tbody></table></div><nav aria-label="Páginas de respaldos"><button (click)="cargar(page()-1)" [disabled]="page() <= 1 || historyLoading()">Anterior</button><span>Página {{ page() }}</span><button (click)="cargar(page()+1)" [disabled]="page()*20 >= total() || historyLoading()">Siguiente</button></nav>
      @if (selected(); as copy) { <article><h2>Cómo se verifica</h2><p>Tiempo de restauración de prueba: {{ copy.verify_report?.duration_seconds ?? 'No medido' }} s. No equivale a un simulacro de producción.</p><ul>@for (check of copy.verify_report?.checks ?? []; track check.name) { <li>{{ check.name }}: {{ check.ok ? 'Correcto' : 'Revisar' }}</li> }</ul></article> }
    }
    @if (guide(); as copy) { <fs-restaurar-drawer [copia]="copy" (close)="guide.set(null)" /> }
  </section>`,
})
export class ContinuidadPageComponent extends OperacionViewState {
  readonly copias = signal<Respaldo[]>([]); readonly total = signal(0); readonly page = signal(1);
  readonly historyLoading = signal(false); readonly historyError = signal(''); readonly busy = signal(false);
  readonly message = signal(''); readonly selected = signal<Respaldo | null>(null); readonly guide = signal<Respaldo | null>(null);
  readonly enPeligro = computed(() => !this.estado()?.ultimo_respaldo || this.estado()!.ultimo_respaldo!.age_hours > 26);
  reason = '';
  constructor() { super(); this.cargar(1); }
  cargar(page: number): void {
    if (!this.permitted()) return;
    this.historyLoading.set(true); this.historyError.set('');
    this.api.respaldos(page).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.historyLoading.set(false))).subscribe({
      next: result => { this.copias.set(result.items); this.total.set(result.total); this.page.set(page); },
      error: e => this.historyError.set(errorMessage(e)),
    });
  }
  dispatch(): void {
    if (!this.session.can('platform.ops.write') || this.busy() || this.reason.trim().length < 3) return;
    this.busy.set(true); this.message.set('');
    this.api.respaldarAhora(this.reason.trim()).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: () => this.message.set('Solicitud enviada. La copia aparecerá cuando termine la verificación.'),
      error: e => this.message.set(e instanceof HttpErrorResponse && e.status === 409 && e.error?.error?.code === 'dispatch_not_configured'
        ? 'Ejecución manual: GitHub → Actions → Respaldo BD → Run workflow. Un responsable debe configurar el token y las variables antes de usar esta acción.' : errorMessage(e)),
    });
  }
}
