import { Component, computed } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ConfigCheck } from '../infrastructure/operacion.api';
import { OperacionViewState } from './operacion-view-state';

@Component({
  standalone: true, selector: 'fs-despliegues-page', styleUrl: './despliegues-page.component.scss',
  template: `<section class="operation-page"><header><div><p class="eyebrow">OPERACIÓN</p><h1>Despliegues y migraciones</h1></div><button (click)="reload()" [disabled]="loading() || !permitted()">Actualizar</button></header>
    @if (loading()) {
      <div class="config-skeleton" role="status" aria-label="Cargando configuración de producción"><span></span><span></span><span></span></div>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      @if (permitted() && error() !== 'No tienes permiso para ver la operación de la plataforma.') {
        <button type="button" (click)="reload()">Reintentar</button>
      }
    }
    @if (estado(); as status) {
      @if (bloqueante()) {
        <p class="config-blocking" role="alert">Hay configuración que debe corregirse antes de la próxima publicación.</p>
      }
      <article class="production-config" aria-labelledby="production-config-title">
        <h2 id="production-config-title">Configuración de producción</h2>
        @if (obligatoriaCompleta()) {
          <p class="config-complete">La configuración obligatoria está completa.</p>
        }
        <ul class="config-checks">
          @for (check of configChecks(); track check.code) {
            <li [attr.data-config-level]="check.level" [attr.data-config-code]="check.code" [class]="'config-check config-check--' + check.level">
              <span class="config-level">{{ nivel(check.level) }}</span>
              <span>{{ check.message }}</span>
            </li>
          }
        </ul>
        <p class="config-footnote">Solo se muestran nombres de variables; los valores nunca salen del servidor.</p>
      </article>
      <div class="kpis"><article><span>Ambiente</span><strong>{{ status.app_env }}</strong></article><article><span>Mantenimiento</span><strong>{{ status.mantenimiento ? 'Activo' : 'Inactivo' }}</strong></article></div>
      <article [class.danger]="status.migraciones_pendientes && !copiaValida()"><h2>{{ !status.migraciones_pendientes ? 'Sin migraciones pendientes' : copiaValida() ? 'Copia compatible disponible' : 'Puerta bloqueada sin copia compatible' }}</h2>
      <dl><dt>Revisión de la base</dt><dd>{{ status.revision_bd || 'No disponible' }}</dd><dt>Cabeza del código</dt><dd>{{ status.cabeza_codigo }}</dd><dt>Commit</dt><dd>{{ status.git_sha || 'No informado por el despliegue' }}</dd></dl></article>
      <article><h2>Condiciones de liberación</h2><ol><li>Pruebas de CI aprobadas.</li><li>Con migraciones pendientes, copia verificada de la misma revisión y con menos de 24 horas.</li><li>La excepción requiere autorización escrita y fecha de hoy en Bolivia; se registra en auditoría.</li></ol><p>Esta vista consulta el estado; no autoriza migraciones ni inicia despliegues.</p></article>
    }</section>`,
})
export class DesplieguesPageComponent extends OperacionViewState {
  readonly configChecks = computed(() => {
    const order = { error: 0, warning: 1, info: 2 };
    return [...(this.estado()?.config_checks ?? [])].sort((a, b) => order[a.level] - order[b.level]);
  });
  readonly bloqueante = computed(() => this.configChecks().some(check => check.level === 'error'));
  readonly obligatoriaCompleta = computed(() => this.configChecks().every(check => check.level === 'info'));
  nivel(level: ConfigCheck['level']): string {
    return { error: 'Error', warning: 'Revisar', info: 'Información' }[level];
  }
  override reload(): void {
    this.estado.set(null);
    if (!this.permitted()) {
      this.error.set('No tienes permiso para ver la operación de la plataforma.');
      return;
    }
    this.error.set('');
    this.loading.set(true);
    this.api.estado().pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false))).subscribe({
      next: status => this.estado.set(status),
      error: error => this.error.set(error instanceof HttpErrorResponse && error.status === 403 && error.error?.error?.code === 'permission_denied'
        ? 'No tienes permiso para ver la operación de la plataforma.'
        : 'No se pudo cargar el estado de la plataforma.'),
    });
  }
  readonly copiaValida = computed(() => {
    const s = this.estado(), b = s?.ultimo_respaldo;
    return !!b && b.age_hours < 24 && b.alembic_revision === s?.revision_bd;
  });
}
