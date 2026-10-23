import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { OfflineCatalogStore } from '../application/offline-catalog.store';
import { ReservaOfflineStore } from '../application/reserva-offline.store';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { ConnectionBadgeComponent } from '../../../shared/ui/connection-badge.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { ReservasLocalesRepository } from '../infrastructure/reservas-locales.repository';
import { ReservaLocalVista } from '../domain/reserva-offline.models';
@Component({
  selector: 'fs-reservas-locales',
  imports: [
    CommonModule,
    RouterLink,
    EmptyStateComponent,
    StatusBadgeComponent,
    ConfirmDialogComponent,
  ],
  template: `<div class="sp2-page">
    <div class="offline-heading">
      <div>
        <p class="crumbs">Sin conexión / Reservas locales</p>
        <h1>Reservas en este dispositivo</h1>
        <p>Consulta lo que guardaste y su estado de sincronización.</p>
      </div>
      <a class="btn primary" routerLink="/sin-conexion/catalogo">＋ Nueva reserva</a>
    </div>
    <div class="alert info">
      Las reservas pendientes son provisionales. Su confirmación depende del envío y validación en
      el servidor.
    </div>
    @if (error()) {
      <p class="alert danger">{{ error() }}</p>
    }
    <div class="toolbar">
      @for (s of statuses; track s) {
        <button class="chip" [class.on]="filter() === s" (click)="filter.set(s)">
          {{ s === 'TODAS' ? 'Todas' : s }}
        </button>
      }
    </div>
    <section class="panel">
      <div class="sp2-table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Reserva local</th>
              <th>Creada</th>
              <th>Cliente</th>
              <th>Prendas</th>
              <th>Visita</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of visible(); track r.reserva.id) {
              <tr>
                <td>
                  <a [routerLink]="['/sin-conexion/reservas', r.reserva.id]">{{
                    r.reserva.id.slice(0, 8)
                  }}</a>
                </td>
                <td>{{ r.reserva.creada_en | date: 'dd/MM HH:mm' }}</td>
                <td>{{ customer(r.reserva.cliente_id) }}</td>
                <td>{{ r.items.length }} variantes</td>
                <td>{{ r.reserva.agendada_para | date: 'dd/MM HH:mm' }}</td>
                <td>
                  <fs-status-badge
                    [tone]="r.operacion.estado === 'PENDIENTE' ? 'warn' : 'neutral'"
                    [label]="
                      r.operacion.estado === 'PENDIENTE'
                        ? 'Pendiente de sincronizar'
                        : r.operacion.estado
                    "
                  />
                </td>
                <td>
                  @if (r.operacion.estado === 'PENDIENTE') {
                    <button class="btn danger" (click)="target.set(r.reserva.id)">Anular</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7">
                  <fs-empty-state
                    title="No hay reservas locales"
                    text="Las reservas creadas sin conexión aparecerán aquí."
                  />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    <fs-confirm-dialog
      [open]="!!target()"
      title="¿Anular esta reserva local?"
      message="La reserva quedará anulada y se restaurará la existencia local. El historial se conserva en este dispositivo."
      tone="danger"
      confirmLabel="Anular reserva"
      (confirmed)="cancelar()"
      (cancelled)="target.set('')"
    />
  </div>`,
  styleUrl: './reservas-locales.component.scss',
})
export class ReservasLocalesComponent {
  private repo = inject(ReservasLocalesRepository);
  session = inject(SessionService);
  catalogo = inject(OfflineCatalogStore);
  items = signal<ReservaLocalVista[]>([]);
  filter = signal('TODAS');
  target = signal('');
  error = signal('');
  statuses = ['TODAS', 'PENDIENTE', 'ANULADA', 'CONFIRMADA', 'CONFLICTO', 'RECHAZADA'];
  visible = computed(() =>
    this.items().filter((r) => this.filter() === 'TODAS' || r.operacion.estado === this.filter()),
  );
  constructor() {
    void this.load();
    void this.catalogo.cargarLocal();
  }
  async load() {
    if (!this.session.tenant()?.id || !this.session.user()?.id) { this.items.set([]); return; }
    this.items.set(await this.repo.listar(this.session.tenant()?.id, this.session.user()?.id));
  }
  customer(id: string | null) {
    return (
      this.catalogo.datos().clientes.find((c) => c.id === id)?.nombre ??
      (id ? 'Cliente registrado' : 'Mi cuenta')
    );
  }
  async cancelar() {
    if (!this.session.tenant()?.id || !this.session.user()?.id) return;
    const id = this.target();
    this.target.set('');
    try {
      await this.repo.cancelar(id, this.session.tenant()?.id, this.session.user()?.id);
      await this.load();
      await this.catalogo.cargarLocal();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo anular la reserva.');
    }
  }
}
