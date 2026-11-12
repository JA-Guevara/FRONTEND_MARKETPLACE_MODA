import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ConnectivityService } from '../../app/core/offline/connectivity.service';
import { SincronizacionService } from '../../features/operacion-offline/application/sincronizacion.service';
import { OfflineCatalogStore } from '../../features/operacion-offline/application/offline-catalog.store';
import {
  EstadoIndicador,
  estadoIndicador,
  textoIndicador,
} from '../../features/operacion-offline/domain/sincronizacion.models';

@Component({
  selector: 'fs-connection-badge',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="connection-badge-wrapper" [attr.data-estado]="estado()">
      @if (esSesionVencida()) {
        <a
          [routerLink]="['/iniciar-sesion']"
          [queryParams]="{ returnUrl: returnUrl() }"
          class="btn-iniciar-sesion"
        >
          Iniciar sesión
        </a>
      }
      <a
        routerLink="/sin-conexion/operaciones"
        class="badge-link"
        [class.on]="online()"
        [class.off]="!online()"
        [title]="texto()"
      >
        <span class="badge-dot" [class.dot-sync]="sincronizando()"></span>
        <span class="badge-text">{{ texto() }}</span>
      </a>
      @if (esConflicto()) {
        <a routerLink="/sin-conexion/operaciones" class="btn-ver">
          Ver
        </a>
      }
    </div>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
    }
    .connection-badge-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
    }
    .badge-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      text-decoration: none;
      color: inherit;
      background: var(--paper-hover, rgba(0, 0, 0, 0.05));
      border: 1px solid var(--line, rgba(0, 0, 0, 0.1));
      transition: background-color 0.2s;
    }
    .badge-link:hover {
      background: var(--line, rgba(0, 0, 0, 0.1));
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      display: inline-block;
    }
    .badge-link.off .badge-dot {
      background: #ef4444;
    }
    .dot-sync {
      background: #3b82f6;
      animation: pulse-sync 1s infinite alternate;
    }
    @keyframes pulse-sync {
      from { opacity: 0.4; }
      to { opacity: 1; }
    }
    .btn-iniciar-sesion, .btn-ver {
      font-size: 12px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--primary, #2563eb);
      color: #fff;
      text-decoration: none;
    }
    @media (max-width: 768px) {
      .badge-text {
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  `],
  styleUrl: './connection-badge.component.scss',
})
export class ConnectionBadgeComponent {
  connection = inject(ConnectivityService);
  syncService = inject(SincronizacionService, { optional: true });
  catalogStore = inject(OfflineCatalogStore, { optional: true });
  private router = inject(Router, { optional: true });

  readonly online = computed(() => this.connection?.online() ?? true);
  readonly sincronizando = computed(() => this.syncService?.sincronizando?.() ?? false);

  readonly estado = computed<EstadoIndicador>(() => {
    if (this.syncService?.estado) {
      return this.syncService.estado();
    }
    return estadoIndicador({
      online: this.online(),
      servidorAlcanzable: this.connection?.servidorAlcanzable?.() ?? true,
      sincronizando: this.sincronizando(),
      pendientesCount: this.syncService?.pendientesCount?.() ?? 0,
      conflictosCount: this.syncService?.conflictosCount?.() ?? 0,
    });
  });

  readonly returnUrl = computed(() => this.router?.url || '/');

  readonly esSesionVencida = computed(() => this.estado() === 'SESION_VENCIDA');
  readonly esConflicto = computed(() => this.estado() === 'CONFLICTO');

  readonly texto = computed(() => {
    const estado = this.estado();
    const meta = this.catalogStore?.meta?.();
    const descargadoEn = meta?.descargadoEn;
    const fechaDatos = descargadoEn ? new Date(descargadoEn) : null;
    let minutosDesdeDescarga: number | undefined;
    if (fechaDatos && !isNaN(fechaDatos.getTime())) {
      minutosDesdeDescarga = Math.max(0, Math.floor((Date.now() - fechaDatos.getTime()) / 60000));
    }

    return textoIndicador(estado, {
      pendientesCount: this.syncService?.pendientesCount?.() ?? 0,
      conflictosCount: this.syncService?.conflictosCount?.() ?? 0,
      minutosDesdeDescarga,
      fechaDatos,
    });
  });
}
