import { Component, computed } from '@angular/core';
import { OperacionViewState } from './operacion-view-state';

@Component({
  standalone: true, selector: 'fs-despliegues-page', styleUrl: './despliegues-page.component.scss',
  template: `<section class="operation-page"><header><div><p class="eyebrow">OPERACIÓN</p><h1>Despliegues y migraciones</h1></div><button (click)="reload()" [disabled]="loading() || !permitted()">Actualizar</button></header>
    @if (loading()) { <p role="status">Consultando revisión…</p> }
    @if (error()) { <p role="alert">{{ error() }}</p> }
    @if (estado(); as status) {
      <div class="kpis"><article><span>Ambiente</span><strong>{{ status.app_env }}</strong></article><article><span>Mantenimiento</span><strong>{{ status.mantenimiento ? 'Activo' : 'Inactivo' }}</strong></article></div>
      <article [class.danger]="status.migraciones_pendientes && !copiaValida()"><h2>{{ !status.migraciones_pendientes ? 'Sin migraciones pendientes' : copiaValida() ? 'Copia compatible disponible' : 'Puerta bloqueada sin copia compatible' }}</h2>
      <dl><dt>Revisión de la base</dt><dd>{{ status.revision_bd || 'No disponible' }}</dd><dt>Cabeza del código</dt><dd>{{ status.cabeza_codigo }}</dd><dt>Commit</dt><dd>{{ status.git_sha || 'No informado por el despliegue' }}</dd></dl></article>
      <article><h2>Condiciones de liberación</h2><ol><li>Pruebas de CI aprobadas.</li><li>Con migraciones pendientes, copia verificada de la misma revisión y con menos de 24 horas.</li><li>La excepción requiere autorización escrita y fecha de hoy en Bolivia; se registra en auditoría.</li></ol><p>Esta vista consulta el estado; no autoriza migraciones ni inicia despliegues.</p></article>
    }</section>`,
})
export class DesplieguesPageComponent extends OperacionViewState {
  readonly copiaValida = computed(() => {
    const s = this.estado(), b = s?.ultimo_respaldo;
    return !!b && b.age_hours < 24 && b.alembic_revision === s?.revision_bd;
  });
}
