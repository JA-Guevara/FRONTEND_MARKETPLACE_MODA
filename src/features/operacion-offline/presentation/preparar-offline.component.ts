import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OfflineCatalogStore } from '../application/offline-catalog.store';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { ConnectionBadgeComponent } from '../../../shared/ui/connection-badge.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ConnectivityService } from '../../../app/core/offline/connectivity.service';
import { PwaInstallService } from '../../../app/core/pwa/pwa-install.service';

@Component({
  selector: 'fs-preparar-offline',
  imports: [CommonModule, FormsModule, RouterLink, ConnectionBadgeComponent, EmptyStateComponent],
  template: `<div class="sp2-page">
    <div class="offline-heading">
      <div>
        <p class="crumbs">Operación / Sin conexión</p>
        <h1>Datos sin conexión</h1>
        <p>Tu catálogo, reservas y ventas de contado, incluso cuando la señal no acompaña.</p>
      </div>
      <fs-connection-badge />
    </div>

    @if (sinSesion()) {
      <div class="alert warning" role="alert">
        Iniciá sesión con conexión para descargar el catálogo de tu empresa.
        <a routerLink="/iniciar-sesion" class="btn-iniciar-sesion">Iniciar sesión</a>
      </div>
    } @else if (sinModulo()) {
      <div class="alert danger" role="alert">
        Tu plan no incluye la operación sin conexión.
      </div>
    } @else if (sinSucursales()) {
      <div class="alert danger" role="alert">
        Tu usuario no tiene sucursales asignadas. Pedile al administrador que te asigne una.
      </div>
    } @else if (errorActualizacion(); as msg) {
      <div class="alert warning" role="alert">{{ msg }}</div>
    } @else if (store.error()) {
      <div class="alert danger" role="alert">{{ store.error() }}</div>
    }

    <div class="sp2-grid">
      <section class="panel">
        <div class="header-line">
          <span class="badge" [class.ok]="!!store.meta().version">
            {{
              store.descargando()
                ? 'Descargando…'
                : store.meta().version
                  ? 'Listo para usar sin conexión'
                  : 'Aún no preparado'
            }}
          </span>
          <span class="help-text">Se actualiza solo con red</span>
        </div>

        <h2>Catálogo en este dispositivo</h2>
        <p class="muted">{{ textoActualizacion() }}</p>

        <label class="f"
          >Sucursal<select class="input" [(ngModel)]="branch">
            <option value="">Primera sucursal disponible</option>
            @for (b of branches(); track b.id) {
              <option [value]="b.id">{{ b.name }}</option>
            }
          </select></label
        >
        <p class="muted">La existencia local corresponde a esta sucursal.</p>

        @if (store.meta().version) {
          <p class="counts-summary"><strong>{{ resumenConteos() }}</strong></p>
        }

        <div class="actions-row">
          <button
            class="btn secondary"
            [disabled]="
              store.descargando() ||
              !connection.online() ||
              session.readOnly() ||
              !session.hasFeature('offline')
            "
            (click)="actualizar()"
          >
            {{ store.descargando() ? 'Descargando…' : 'Actualizar ahora' }}
          </button>
        </div>

        @if (store.descargando()) {
          <div class="downloading-box">
            <p class="progress-title">⟳ Descargando el catálogo de tu empresa…</p>
            <progress class="snapshot-progress" max="100" [value]="store.progreso()"></progress
            ><strong>{{ store.progreso() }} %</strong>
            <ol>
              <li>Sucursales y clientes</li>
              <li>Prendas y variantes</li>
              <li>Existencias</li>
              <li>Ofertas y almacenamiento</li>
            </ol>
          </div>
        }

        @if (store.meta().version) {
          <div class="links-list">
            <p><a routerLink="/sin-conexion/catalogo">Abrir catálogo →</a></p>
            @if (session.can('commerce.write')) {
              <p><a routerLink="/sin-conexion/venta">Venta de contado →</a></p>
            }
            <p><a routerLink="/sin-conexion/operaciones">Operaciones →</a></p>
          </div>
        }
      </section>

      <section class="panel">
        <h2>Qué se guarda</h2>
        <p>Datos de tu empresa y sucursal para consultar prendas, preparar reservas y vender en efectivo.</p>
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
          Las reservas y ventas creadas aquí son provisionales. Se guardan en este navegador y
          necesitan sincronizarse para confirmarse.
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
        title="Aún no hay datos sin conexión. Se descargarán solos cuando haya red."
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
  branches = signal<{ id: string; name: string }[]>([]);
  branch = '';
  counts = computed(() => Object.entries(this.store.conteos()));

  readonly sinSesion = computed(() => !this.session.user());
  readonly sinModulo = computed(() => !!this.session.user() && !this.session.hasFeature('offline'));
  readonly sinSucursales = computed(() => {
    const err = (this.store.error() || this.store.meta().ultimo_error_catalogo || '').toLowerCase();
    return err.includes('no tiene sucursales') || err.includes('no_authorized_branches');
  });

  readonly errorActualizacion = computed(() => {
    const err = this.store.meta().ultimo_error_catalogo;
    const d = this.store.meta().descargadoEn;
    if (err && d) {
      const fecha = new Date(d);
      const strFecha = !isNaN(fecha.getTime())
        ? `${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : d;
      return `No se pudo actualizar. Seguís usando los datos del ${strFecha}. Se reintentará solo.`;
    }
    return null;
  });

  readonly textoActualizacion = computed(() => {
    const d = this.store.meta().descargadoEn;
    if (!d) return 'Sin descargar';
    const fecha = new Date(d);
    if (isNaN(fecha.getTime())) return 'Sin descargar';
    const minutos = Math.max(0, Math.floor((Date.now() - fecha.getTime()) / 60000));
    return `Actualizado hace ${minutos} min · ${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  });

  readonly resumenConteos = computed(() => {
    const c = this.store.conteos();
    const productos = c['productos'] ?? 0;
    const variantes = c['variantes'] ?? 0;
    const cajas = c['cajas'] ?? 0;
    const clientes = c['clientes'] ?? 0;
    return `${productos} prendas · ${variantes} variantes · ${cajas} caja · ${clientes} clientes`;
  });

  constructor() {
    void this.store.cargarLocal().then(() => {
      this.branch = this.store.meta().sucursalId ?? '';
      this.actualizarSucursales();
    });
  }

  private actualizarSucursales() {
    this.branches.set(this.store.datos().sucursales.map((branch) => ({ id: branch.id, name: branch.nombre })));
  }

  async actualizar() {
    await this.store.descargar(this.branch);
    this.branch = this.store.meta().sucursalId ?? this.branch;
    this.actualizarSucursales();
  }
}
