import { Component, signal } from '@angular/core';
import { DatePipe, KeyValuePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { inject } from '@angular/core';
import { PlataformaApi } from '../infrastructure/plataforma.api';
import { PlatformAuditEvent } from '../domain/consola.models';
import { OperacionViewState } from './operacion-view-state';

@Component({
  standalone: true, imports: [DatePipe, KeyValuePipe, RouterLink], selector: 'fs-salud-page', styleUrl: './salud-page.component.scss',
  template: `<section class="operation-page"><header><div><p class="eyebrow">OPERACIÓN</p><h1>Salud y seguridad</h1></div><button (click)="reload(); check()" [disabled]="loading() || !permitted()">Actualizar</button></header>
    @if (loading()) { <p role="status">Consultando salud…</p> } @if (error()) { <p role="alert">{{ error() }}</p> }
    @if (estado(); as status) {
      <div class="kpis"><article [class.danger]="ready() === false"><span>API y base</span><strong>{{ ready() === null ? 'Comprobando…' : ready() ? 'Lista' : 'No lista' }}</strong></article>
      <article><span>Peticiones limitadas · proceso actual</span><strong>{{ status.contadores.rate_limited ?? 'No disponible' }}</strong></article><article><span>Errores 5xx · proceso actual</span><strong>{{ status.contadores.errors_5xx ?? 'No disponible' }}</strong></article>
      <article><span>Sync rechazadas · 24 h</span><strong>{{ status.contadores.sync_rechazadas_24h }}</strong></article></div>
      <article><h2>Controles de cuenta</h2><p>Cuentas bloqueadas: {{ status.contadores.cuentas_bloqueadas }}</p><p>Dos pasos del equipo: {{ status.contadores.mfa_adopcion.habilitadas ?? 'Aún no disponible' }} / {{ status.contadores.mfa_adopcion.total }}</p><p>Mantenimiento: {{ status.mantenimiento ? 'Activo' : 'Inactivo' }}</p></article>
      <article><h2>429 por política</h2><ul>@for (item of status.contadores.rate_limited_by_policy | keyvalue; track item.key) { <li>{{ item.key }}: {{ item.value }}</li> } @empty { <li>Sin eventos registrados en este proceso.</li> }</ul></article>
      @if (session.can('platform_audit.read')) { <article><h2>Excepciones de migración recientes</h2>@for (event of events(); track event.id) { <p>{{ event.created_at | date:'short' }} · {{ event.action }}</p> } @empty { <p>{{ auditError() || 'No se encontraron excepciones recientes.' }}</p> }<a routerLink="/admin/plataforma/auditoria">Abrir auditoría global</a></article> }
    }</section>`,
})
export class SaludPageComponent extends OperacionViewState {
  readonly ready = signal<boolean | null>(null); readonly events = signal<PlatformAuditEvent[]>([]); readonly auditError = signal('');
  private readonly platform = inject(PlataformaApi);
  constructor() { super(); this.check(); }
  check(): void {
    if (!this.permitted()) return;
    this.ready.set(null);
    this.api.ready().pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: r => this.ready.set(r.status === 'ready'), error: () => this.ready.set(false) });
    if (this.session.can('platform_audit.read')) this.platform.audit({ action: 'platform.migration_without_backup', page_size: 5 }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: page => { this.events.set(page.items); this.auditError.set(''); }, error: () => this.auditError.set('No se pudo consultar la auditoría.'),
    });
  }
}
