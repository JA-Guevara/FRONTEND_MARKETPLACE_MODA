import { DialogFocusDirective } from '../../../shared/dialog-focus.directive';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, JsonPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { Entity, Page } from '../../../shared/models';
import { errorMessage } from '../../../shared/errors';
@Component({
  selector: 'fs-audit-page',
  imports: [FormsModule, DatePipe, JsonPipe, DialogFocusDirective],
  styles: [`
    :host { display: block; min-width: 0; }
    .audit-filters { display: flex; flex-wrap: wrap; gap: .75rem; align-items: end; }
    .audit-filters label { flex: 1 1 170px; min-width: 0; }
    .audit-filters input { width: 100%; min-width: 0; box-sizing: border-box; }
    .actor-email { display: block; color: var(--muted, #64748b); overflow-wrap: anywhere; }
    .table-wrap { max-width: 100%; overflow-x: auto; }
    table { min-width: 850px; }
    td { vertical-align: top; white-space: normal; overflow-wrap: anywhere; max-width: 260px; }
    .modal { width: min(720px, 100%); max-height: 90dvh; overflow-y: auto; box-sizing: border-box; }
    .detail-list dd { min-width: 0; overflow-wrap: anywhere; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; max-width: 100%; }
    @media (max-width: 520px) { .detail-list { display: block; } .detail-list dd { margin: .25rem 0 1rem; } .pagination { flex-wrap: wrap; } }
  `],
  template: `<p class="eyebrow">ACCESO Y SEGURIDAD</p>
    <h1>Bitácora</h1>
    <p class="muted">Historial de operaciones. Los eventos no se pueden editar ni eliminar.</p>
    <form class="toolbar audit-filters" (ngSubmit)="page = 1; load()">
      <label
        >Actor (nombre o correo)<input
          name="actor"
          [(ngModel)]="filters['actor_query']"
          placeholder="Nombre o correo del usuario" /></label
      ><label
        >Acción<input
          name="action"
          [(ngModel)]="filters['action']"
          placeholder="Ej.: auth.login" /></label
      ><label
        >Entidad<input
          name="entity"
          [(ngModel)]="filters['entity_type']"
          placeholder="Ej.: user" /></label
      ><label
        >Desde<input type="datetime-local" name="from" [(ngModel)]="filters['date_from']" /></label
      ><label>Hasta<input type="datetime-local" name="to" [(ngModel)]="filters['date_to']" /></label
      ><button class="primary">Filtrar</button
      ><button type="button" (click)="filters = {}; page = 1; load()">Limpiar</button>
    </form>
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <p class="empty" role="status">Cargando eventos…</p>
    } @else {
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th title="N�mero de fila seg�n los filtros actuales">N.�</th>
              <th>Fecha</th>
              <th>Actor</th>
              <th>Acción</th>
              <th>Módulo</th>
              <th>Descripción</th>
              <th>IP</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (event of result()?.items || []; track event.id; let index = $index) {
              <tr>
                <td>{{ (page - 1) * 30 + index + 1 }}</td>
                <td>{{ event['created_at'] | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  {{ event['actor_name'] || event['actor_email'] || 'Anónimo' }}
                </td>
                <td>{{ event['action'] }}</td>
                <td>{{ event['entity_type'] }}</td>
                <td>{{ event['description'] }}</td>
                <td>{{ event['ip_address'] || '—' }}</td>
                <td><button (click)="detail(event.id)">Ver detalle</button></td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8" class="empty">No hay eventos con estos filtros.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
    <div class="pagination">
      <button [disabled]="page <= 1 || loading()" (click)="page = page - 1; load()">Anterior</button
      ><span>{{ page }} / {{ result()?.pages || 1 }}</span
      ><button
        [disabled]="page >= (result()?.pages || 1) || loading()"
        (click)="page = page + 1; load()"
      >
        Siguiente
      </button>
    </div>
    @if (selected(); as e) {
      <div class="modal-backdrop">
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-label="Detalle de evento"
          (dismissed)="selected.set(null)"
        >
          <h2>{{ e['action'] }}</h2>
          <dl class="detail-list">
            <dt>ID del evento</dt><dd>{{ e.id }}</dd>
            <dt>Solicitud</dt><dd>{{ e['metadata_']?.request_id || 'No registrada (evento anterior o tarea interna)' }}</dd>
            <dt>Fecha</dt>
            <dd>{{ e['created_at'] | date: 'medium' }}</dd>
            <dt>Actor</dt>
            <dd>
              {{ e['actor_name'] || e['actor_email'] || 'Anónimo' }}
              @if (e['actor_user_id']) {
                <br /><small>{{ e['actor_user_id'] }}</small>
              }
            </dd>
            <dt>Entidad</dt>
            <dd>{{ e['entity_type'] }} / {{ e['entity_id'] }}</dd>
            <dt>Descripción</dt>
            <dd>{{ e['description'] }}</dd>
            <dt>IP</dt>
            <dd>{{ e['ip_address'] || '—' }}</dd>
            <dt>Agente</dt>
            <dd>{{ e['user_agent'] || '—' }}</dd>
          </dl>
          <h3>Datos del evento</h3>
          <pre>{{ e['metadata_'] | json }}</pre>
          <button (click)="selected.set(null)">Cerrar</button>
        </section>
      </div>
    }`,
})
export class AuditPageComponent {
  private api = inject(ApiService);
  filters: Record<string, string> = {};
  page = 1;
  result = signal<Page<Entity> | null>(null);
  error = signal('');
  loading = signal(false);
  selected = signal<Entity | null>(null);
  constructor() {
    void this.load();
  }
  actorLabel(event: Entity): string {
    return event['actor_name'] || event['actor_email'] || (event['actor_user_id'] ? 'Usuario no disponible' : 'Sin usuario asociado');
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      if (
        this.filters['date_from'] &&
        this.filters['date_to'] &&
        this.filters['date_from'] > this.filters['date_to']
      )
        throw new Error('Revisá el rango de fechas.');
      const query: Record<string, unknown> = { ...this.filters, page: this.page, page_size: 30 };
      for (const key of ['date_from', 'date_to'])
        if (query[key]) query[key] = new Date(String(query[key])).toISOString();
      this.result.set(await firstValueFrom(this.api.get<Page<Entity>>('/audit-log', query)));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  async detail(id: string) {
    try {
      this.selected.set(await firstValueFrom(this.api.get<Entity>('/audit-log/' + id)));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
