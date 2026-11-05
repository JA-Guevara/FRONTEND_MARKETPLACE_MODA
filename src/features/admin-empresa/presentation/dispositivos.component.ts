import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DispositivosApi } from '../infrastructure/dispositivos.api';
import { Dispositivo, DispositivoDetalle } from '../domain/dispositivos.models';
import { IconComponent } from '../../../shared/icon.component';
import { errorMessage } from '../../../shared/errors';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'fs-dispositivos',
  imports: [FormsModule, DatePipe, IconComponent],
  template: `
    <section class="commerce-page">
      <p class="eyebrow">ADMINISTRACIÓN DE LA EMPRESA</p>
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1>Dispositivos y terminales</h1>
          <p class="muted">
            Monitoreo y bloqueo de terminales PWA y Android que sincronizan ventas y descargan instantáneas del catálogo.
          </p>
        </div>
        <div>
          <a class="button secondary" [href]="exportUrl" download="dispositivos.csv">
            <fs-icon name="download" /> Exportar CSV
          </a>
        </div>
      </div>

      @if (error()) {
        <div class="alert error" role="alert">
          <p>{{ error() }}</p>
          <button type="button" (click)="load()" [disabled]="loading()">Reintentar</button>
        </div>
      }

      <!-- Filtros -->
      <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
        <label>
          Plataforma:
          <select [(ngModel)]="filtroPlataforma" (ngModelChange)="load()">
            <option value="">Todas</option>
            <option value="PWA">Navegador PWA</option>
            <option value="ANDROID">App Android</option>
          </select>
        </label>
        <label>
          Estado:
          <select [(ngModel)]="filtroEstado" (ngModelChange)="load()">
            <option value="">Todos</option>
            <option value="ACTIVO">Activos</option>
            <option value="BLOQUEADO">Bloqueados</option>
          </select>
        </label>
        <label>
          Buscar:
          <input
            type="search"
            [(ngModel)]="busqueda"
            (ngModelChange)="load()"
            placeholder="ID o etiqueta…"
          />
        </label>
      </div>

      <!-- Tabla de dispositivos -->
      <div class="commerce-card" style="overflow-x: auto;">
        @if (loading()) {
          <p>Cargando dispositivos…</p>
        } @else {
          <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
            <thead>
              <tr style="text-align: left; border-bottom: 2px solid #e5e7eb;">
                <th>Terminal</th>
                <th>Plataforma</th>
                <th>Estado</th>
                <th>Sucursal / Usuario</th>
                <th>Última sincronización</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (d of dispositivos(); track d.id) {
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 0.75rem 0.5rem;">
                    <strong>{{ d.label || d.device_id }}</strong>
                    @if (d.label) {
                      <br /><small class="muted">{{ d.device_id }}</small>
                    }
                  </td>
                  <td style="padding: 0.75rem 0.5rem;">
                    <span [class]="'badge ' + (d.platform === 'ANDROID' ? 'android' : 'pwa')">
                      {{ d.platform }}
                    </span>
                    <br /><small class="muted">{{ d.app_version || 's/d' }}</small>
                  </td>
                  <td style="padding: 0.75rem 0.5rem;">
                    <span [style.color]="d.status === 'BLOQUEADO' ? '#dc2626' : '#16a34a'" style="font-weight: 600;">
                      {{ d.status }}
                    </span>
                    @if (d.rejected_attempts > 0) {
                      <br /><small style="color: #dc2626;">{{ d.rejected_attempts }} intento(s) rechazado(s)</small>
                    }
                  </td>
                  <td style="padding: 0.75rem 0.5rem;">
                    {{ d.branch_name || 'Sin sucursal' }}
                    <br /><small class="muted">{{ d.user_name || 'Sin usuario' }}</small>
                  </td>
                  <td style="padding: 0.75rem 0.5rem;">
                    {{ d.last_sync_at ? (d.last_sync_at | date: 'dd/MM/yyyy HH:mm') : 'Nunca' }}
                  </td>
                  <td style="padding: 0.75rem 0.5rem;">
                    <div style="display: flex; gap: 0.25rem;">
                      <button type="button" (click)="verDetalle(d)" title="Ver detalle y auditoría">
                        Detalle
                      </button>
                      <button type="button" (click)="abrirRenombrar(d)" title="Cambiar etiqueta">
                        Renombrar
                      </button>
                      @if (d.status === 'BLOQUEADO') {
                        <button type="button" class="primary" (click)="desbloquear(d)" [disabled]="busy()">
                          Reactivar
                        </button>
                      } @else {
                        <button type="button" style="color: #dc2626;" (click)="abrirBloquear(d)" [disabled]="busy()">
                          Bloquear
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="muted" style="text-align: center; padding: 2rem;">
                    No se encontraron terminales registrados con los filtros seleccionados.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      <!-- Modal / Panel de detalle -->
      @if (detalleSeleccionado(); as det) {
        <div class="commerce-card" style="margin-top: 1.5rem; border-left: 4px solid #2563eb;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3>Detalle y auditoría del terminal: {{ det.label || det.device_id }}</h3>
            <button type="button" (click)="detalleSeleccionado.set(null)">Cerrar</button>
          </div>
          <p>
            <strong>ID:</strong> {{ det.device_id }} · <strong>Plataforma:</strong> {{ det.platform }} ·
            <strong>Estado:</strong> {{ det.status }} · <strong>Primer registro:</strong> {{ det.first_seen_at | date: 'short' }}
          </p>
          @if (det.block_reason) {
            <p style="color: #dc2626;"><strong>Motivo de bloqueo:</strong> {{ det.block_reason }} ({{ det.blocked_at | date: 'short' }})</p>
          }
          <h4>Actividad reciente de auditoría</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
            <thead>
              <tr style="text-align: left; border-bottom: 1px solid #ccc;">
                <th>Fecha</th><th>Acción</th><th>Descripción</th><th>Actor</th>
              </tr>
            </thead>
            <tbody>
              @for (act of det.recent_activity; track act.id) {
                <tr>
                  <td>{{ act.created_at | date: 'dd/MM/yy HH:mm' }}</td>
                  <td><code>{{ act.action }}</code></td>
                  <td>{{ act.description }}</td>
                  <td>{{ act.actor_name || 'Sistema' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="muted">Sin eventos registrados aún.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class DispositivosComponent {
  private api = inject(DispositivosApi);

  dispositivos = signal<Dispositivo[]>([]);
  detalleSeleccionado = signal<DispositivoDetalle | null>(null);
  loading = signal(true);
  busy = signal(false);
  error = signal('');

  filtroPlataforma = '';
  filtroEstado = '';
  busqueda = '';

  get exportUrl(): string {
    return `${environment.apiUrl}/tenant/devices/export.csv`;
  }

  constructor() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const res = await this.api.listar({
        platform: this.filtroPlataforma || undefined,
        status: this.filtroEstado || undefined,
        search: this.busqueda || undefined,
      });
      this.dispositivos.set(res.items);
    } catch (e) {
      this.error.set('No se pudieron cargar los dispositivos: ' + errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async verDetalle(d: Dispositivo) {
    this.busy.set(true);
    try {
      const det = await this.api.obtener(d.id);
      this.detalleSeleccionado.set(det);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async abrirRenombrar(d: Dispositivo) {
    const nuevo = prompt('Etiqueta para este terminal (ej. Caja Central 01):', d.label || '');
    if (!nuevo || !nuevo.trim()) return;
    this.busy.set(true);
    try {
      await this.api.renombrar(d.id, nuevo.trim());
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async abrirBloquear(d: Dispositivo) {
    const motivo = prompt('Motivo del bloqueo (obligatorio):', 'Terminal reportado extraviado o fuera de turno');
    if (!motivo || !motivo.trim()) return;
    this.busy.set(true);
    try {
      await this.api.bloquear(d.id, motivo.trim(), true);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async desbloquear(d: Dispositivo) {
    if (!confirm(`¿Reactivar el terminal ${d.label || d.device_id}?`)) return;
    this.busy.set(true);
    try {
      await this.api.desbloquear(d.id, 'Reactivado desde panel');
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
