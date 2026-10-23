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
import { ConnectivityService } from '../../../app/core/offline/connectivity.service';
import { PwaInstallService } from '../../../app/core/pwa/pwa-install.service';
import { ApiService } from '../../../app/core/shared/api.service';
@Component({
  selector: 'fs-preparar-offline',
  imports: [CommonModule, FormsModule, RouterLink, ConnectionBadgeComponent, EmptyStateComponent],
  template: `<div class="sp2-page">
    <div class="offline-heading">
      <div>
        <p class="crumbs">Operación / Sin conexión</p>
        <h1>Prepara tu modo sin conexión</h1>
        <p>Tu catálogo y reservas, incluso cuando la señal no acompaña.</p>
      </div>
      <fs-connection-badge />
    </div>
    @if (store.error()) {
      <div class="alert danger" role="alert">{{ store.error() }}</div>
    }
    <div class="sp2-grid">
      <section class="panel">
        <span class="badge" [class.ok]="!!store.meta().version">{{
          store.meta().version ? 'Listo para usar sin conexión' : 'Aún no preparado'
        }}</span>
        <h2>Catálogo en este dispositivo</h2>
        <p>
          Última descarga:
          {{
            store.meta().descargadoEn
              ? (store.meta().descargadoEn | date: 'dd/MM/yyyy HH:mm')
              : 'Sin descargar'
          }}
        </p>
        <label class="f"
          >Sucursal<select class="input" [(ngModel)]="branch">
            <option value="">Seleccionar sucursal</option>
            @for (b of branches(); track b.id) {
              <option [value]="b.id">{{ b.name }}</option>
            }
          </select></label
        >
        <p class="muted">La existencia local corresponde a esta sucursal.</p>
        <button
          class="btn primary"
          [disabled]="
            store.descargando() ||
            !connection.online() ||
            session.readOnly() ||
            !session.hasFeature('offline') ||
            !branch
          "
          (click)="actualizar()"
        >
          {{ store.descargando() ? 'Descargando…' : 'Actualizar catálogo' }}
        </button>
        @if (store.descargando()) {
          <progress class="snapshot-progress" max="100" [value]="store.progreso()"></progress
          ><strong>{{ store.progreso() }} %</strong>
          <ol>
            <li>Sucursales y clientes</li>
            <li>Prendas y variantes</li>
            <li>Existencias</li>
            <li>Ofertas y almacenamiento</li>
          </ol>
        }
        @if (store.meta().version) {
          <p><a routerLink="/sin-conexion/catalogo">Abrir catálogo sin conexión →</a></p>
        }
      </section>
      <section class="panel">
        <h2>Qué se guarda</h2>
        <p>Solo datos necesarios para consultar y preparar reservas.</p>
        <table class="tbl">
          <tbody>
            @for (row of counts(); track row[0]) {
              <tr>
                <td>{{ row[0] }}</td>
                <td>{{ row[1] }}</td>
              </tr>
            }
          </tbody>
        </table>
        <div class="alert info">
          Las reservas creadas aquí son provisionales. Se guardan en este navegador y necesitan
          sincronizarse para confirmarse.
        </div>
        <a routerLink="/sin-conexion/reservas">Ver reservas locales →</a>
      </section>
      <section class="panel">
        <h2>Instala FashionStore</h2>
        <p>Abre la aplicación desde tu escritorio y accede al catálogo descargado sin red.</p>
        @if (pwa.installed()) {
          <span class="badge ok">Aplicación instalada</span>
        } @else if (pwa.canInstall()) {
          <button (click)="pwa.install()">Instalar aplicación</button>
        } @else {
          <p class="muted">
            Usa «Instalar aplicación» o «Añadir a pantalla de inicio» en el menú de tu navegador.
          </p>
        }
      </section>
    </div>
    @if (!store.meta().version && !connection.online()) {
      <fs-empty-state
        title="Aún no hay datos sin conexión"
        text="Conéctate al menos una vez para descargar el catálogo de tu empresa."
      />
    }
  </div>`,
  styleUrl: './preparar-offline.component.scss',
})
export class PrepararOfflineComponent {
  store = inject(OfflineCatalogStore);
  session = inject(SessionService);
  connection = inject(ConnectivityService);
  pwa = inject(PwaInstallService);
  private api = inject(ApiService);
  branches = signal<{ id: string; name: string }[]>([]);
  branch = '';
  counts = computed(() => Object.entries(this.store.conteos()));
  constructor() {
    void this.store.cargarLocal().then(() => {
      this.branch = this.store.meta().sucursalId ?? '';
      this.branches.set(this.store.datos().sucursales.map((b) => ({ id: b.id, name: b.nombre })));
    });
    if (this.connection.online())
      this.api
        .get<{ id: string; name: string }[] | { items: { id: string; name: string }[] }>(
          '/commerce/branches',
        )
        .subscribe({
          next: (r) => this.branches.set(Array.isArray(r) ? r : r.items),
          error: () => {},
        });
  }
  async actualizar() {
    await this.store.descargar(this.branch);
    this.branch = this.store.meta().sucursalId ?? this.branch;
  }
}
