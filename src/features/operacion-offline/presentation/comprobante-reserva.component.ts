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
  selector: 'fs-comprobante-reserva',
  imports: [CommonModule, RouterLink, EmptyStateComponent, StatusBadgeComponent],
  template: `<div class="sp2-page">
    @if (reserva(); as r) {
      <article class="panel receipt">
        <p class="eyebrow">FASHIONSTORE · RESERVA LOCAL</p>
        <h1>Comprobante provisional</h1>
        <p class="receipt-code">{{ r.reserva.id }}</p>
        <fs-status-badge
          [tone]="r.operacion.estado === 'PENDIENTE' ? 'warn' : 'neutral'"
          [label]="
            r.operacion.estado === 'PENDIENTE' ? 'Pendiente de sincronizar' : r.operacion.estado
          "
        />
        <div class="alert warn">
          <strong>Esta reserva aún no está confirmada.</strong>
          <p>
            Se guardó en este dispositivo. La confirmación del servidor verificará las existencias y
            la visita.
          </p>
        </div>
        <dl>
          <dt>Empresa</dt>
          <dd>{{ session.tenant()?.trade_name }}</dd>
          <dt>Sucursal</dt>
          <dd>{{ branch(r.reserva.sucursal_id) }}</dd>
          <dt>Visita</dt>
          <dd>
            {{ r.reserva.agendada_para | date: 'fullDate' }} ·
            {{ r.reserva.agendada_para | date: 'shortTime' }}
          </dd>
          <dt>Creada localmente</dt>
          <dd>{{ r.reserva.creada_en | date: 'dd/MM/yyyy HH:mm' }}</dd>
          <dt>Dispositivo</dt>
          <dd class="receipt-code">{{ r.operacion.dispositivo_id }}</dd>
        </dl>
        <table class="tbl">
          <thead>
            <tr>
              <th>Prenda y variante</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            @for (i of r.items; track i.variante_id) {
              <tr>
                <td>
                  {{ name(i.variante_id) }}<br /><small
                    >{{ variant(i.variante_id)?.talla }} ·
                    {{ variant(i.variante_id)?.color }}</small
                  >
                </td>
                <td>{{ i.cantidad }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (r.reserva.notas) {
          <p>Notas: {{ r.reserva.notas }}</p>
        }
        <p class="muted">
          Conserva este comprobante. No constituye una confirmación de disponibilidad.
        </p>
      </article>
      <div class="print-actions">
        <button (click)="print()">Imprimir comprobante</button
        ><a class="btn primary" routerLink="/sin-conexion/reservas">Ver reservas locales</a>
      </div>
    } @else if (error()) {
      <fs-empty-state title="Reserva local no encontrada" [text]="error()" />
    } @else {
      <p>Cargando comprobante…</p>
    }
  </div>`,
  styleUrl: './comprobante-reserva.component.scss',
})
export class ComprobanteReservaComponent {
  private repo = inject(ReservasLocalesRepository);
  session = inject(SessionService);
  catalogo = inject(OfflineCatalogStore);
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  reserva = signal<ReservaLocalVista | null>(null);
  error = signal('');
  constructor() {
    void this.load();
  }
  async load() {
    if (!this.session.tenant()?.id || !this.session.user()?.id) { this.error.set('Inicia sesión para consultar el comprobante.'); return; }
    await this.catalogo.cargarLocal();
    const r = await this.repo.obtener(this.id, this.session.tenant()?.id, this.session.user()?.id);
    this.reserva.set(r);
    if (!r) this.error.set('El comprobante no está disponible para esta cuenta en este navegador.');
  }
  variant(id: string) {
    return this.catalogo.datos().variantes.find((v) => v.id === id);
  }
  name(id: string) {
    return (
      this.catalogo.datos().productos.find((p) => p.id === this.variant(id)?.producto_id)?.nombre ??
      id
    );
  }
  branch(id: string) {
    return this.catalogo.datos().sucursales.find((b) => b.id === id)?.nombre ?? id;
  }
  print() {
    window.print();
  }
}
