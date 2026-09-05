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
  template: `<p class="eyebrow">ACCESO Y SEGURIDAD</p>
    <h1>Bitácora</h1>
    <p class="muted">Historial de operaciones. Los eventos no se pueden editar ni eliminar.</p>
    <form class="toolbar audit-filters" (ngSubmit)="page = 1; load()">
      <label
        >Actor (ID)<input
          name="actor"
          [(ngModel)]="filters['actor_user_id']"
          placeholder="UUID del usuario" /></label
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
              <th>Fecha</th>
              <th>Acción</th>
              <th>Entidad</th>
              <th>Descripción</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (event of result()?.items || []; track event.id) {
              <tr>
                <td>{{ event['created_at'] | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>{{ event['action'] }}</td>
                <td>{{ event['entity_type'] }}</td>
                <td>{{ event['description'] }}</td>
                <td><button (click)="detail(event.id)">Ver detalle</button></td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="empty">No hay eventos con estos filtros.</td>
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
            <dt>Fecha</dt>
            <dd>{{ e['created_at'] | date: 'medium' }}</dd>
            <dt>Actor</dt>
            <dd>{{ e['actor_user_id'] || 'Anónimo' }}</dd>
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
