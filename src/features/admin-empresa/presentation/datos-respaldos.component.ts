import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { environment } from '../../../environments/environment';
import { SessionService } from '../../usuarios-catalogo/application/session.service';
import { errorMessage } from '../../../shared/errors';

interface Policy {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  hour: number;
  timezone: string;
  retention: number;
  next_run_at?: string | null;
}
interface BackupRun {
  id: string;
  status: string;
  kind: string;
  created_at: string;
  finished_at: string | null;
  size_bytes: number;
  error: string | null;
  report: {
    duration_seconds: number;
    rows: Record<string, number>;
    own_images: number;
    external_images: number;
    note: string;
  } | null;
}
interface BackupStatus {
  tenant: { id: string; name: string };
  configured: boolean;
  configuration_note: string | null;
  storage_note: string;
  policy: Policy;
  items: BackupRun[];
  page: number;
  total: number;
}

@Component({
  selector: 'fs-datos-respaldos',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `<section class="data-page">
    <header>
      <div>
        <p class="eyebrow">DATOS DE LA EMPRESA</p>
        <h1>Datos y respaldos</h1>
        <p>{{ data()?.tenant?.name || 'Resguardá la información de tu empresa' }}</p>
      </div>
      @if (platform) {
        <a [routerLink]="['/admin/plataforma/empresas', tenantId]">Volver a la empresa</a>
      }
      <button (click)="load()" [disabled]="loading()">Actualizar</button>
    </header>
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }
    @if (message()) {
      <p class="alert" role="status">{{ message() }}</p>
    }
    @if (data(); as status) {
      @if (!status.configured) {
        <p class="alert warning">
          El servicio de copias necesita activación por un operador de la plataforma. Podés
          consultar el historial; la creación se habilita al completar la configuración de custodia.
        </p>
      }
      <div class="summary">
        <article>
          <span>Alcance</span><strong>Tu empresa</strong>
          <p>
            Perfil, catálogo, clientes, sucursales, ventas, reservas e inventario con sus
            relaciones.
          </p>
        </article>
        <article>
          <span>Conservación</span><strong>{{ status.policy.retention }} copias</strong>
          <p>Se conserva la última copia válida si falla una nueva.</p>
        </article>
        <article>
          <span>Próxima ejecución</span
          ><strong>{{
            status.policy.enabled ? (status.policy.next_run_at | date: 'short') : 'Sin programación'
          }}</strong>
          <p>{{ status.policy.timezone }}</p>
        </article>
      </div>
      <article class="card">
        <h2>Crear una copia ahora</h2>
        <p>
          El trabajo se guarda en una cola y se verifica con una restauración aislada. Podés seguir
          utilizando el sistema.
        </p>
        <button
          class="primary"
          (click)="create()"
          [disabled]="busy() || !status.configured || !canWrite()"
        >
          {{ busy() ? 'Solicitando…' : platform ? 'Crear copia de esta empresa' : 'Crear copia de mi empresa' }}
        </button>
        <p class="muted">{{ status.storage_note }}</p>
      </article>
      <form class="card" (ngSubmit)="savePolicy()">
        <h2>Programar y conservar</h2>
        <label class="toggle"
          ><input
            type="checkbox"
            name="enabled"
            [(ngModel)]="policy.enabled"
            [disabled]="!canWrite()"
          />
          Activar copias programadas</label
        >
        <div class="form-grid">
          <label
            >Frecuencia<select name="frequency" [(ngModel)]="policy.frequency">
              <option value="daily">Diaria</option>
              <option value="weekly">Semanal</option>
            </select></label
          >
          <label
            >Hora local<select name="hour" [(ngModel)]="policy.hour">
              @for (hour of hours; track hour) {
                <option [ngValue]="hour">{{ hour.toString().padStart(2, '0') }}:00</option>
              }
            </select></label
          >
          <label
            >Zona horaria<select name="timezone" [(ngModel)]="policy.timezone">
              <option value="America/La_Paz">Bolivia</option>
              <option value="UTC">UTC</option>
            </select></label
          >
          <label
            >Copias a conservar<input
              type="number"
              name="retention"
              min="1"
              max="14"
              [(ngModel)]="policy.retention"
          /></label>
        </div>
        <p class="muted">
          La primera ejecución ocurre en la próxima hora elegida; las semanales se repiten cada
          siete días desde esa programación. La cola reintenta una ejecución interrumpida.
        </p>
        <button [disabled]="saving() || !canWrite() || (policy.enabled && !status.configured)">
          {{ saving() ? 'Guardando…' : 'Guardar programación' }}
        </button>
      </form>
      <article class="card">
        <h2>Historial y descarga</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Solicitud</th>
                <th>Origen</th>
                <th>Estado</th>
                <th>Tamaño</th>
                <th>Contenido y resultado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (run of status.items; track run.id) {
                <tr>
                  <td>{{ run.created_at | date: 'short' }}</td>
                  <td>{{ run.kind === 'manual' ? 'Manual' : 'Programada' }}</td>
                  <td>
                    <span class="badge" [class.ok]="run.status === 'verified'">{{
                      stateLabel(run.status)
                    }}</span>
                  </td>
                  <td>{{ run.size_bytes / 1024 | number: '1.0-1' }} KB</td>
                  <td>
                    @if (run.error) {
                      <p class="error">{{ run.error }}</p>
                    }
                    @if (run.report; as report) {
                      <details>
                        <summary>Ver contenido</summary>
                        <p>
                          {{ report.rows['products'] || 0 }} prendas ·
                          {{ report.rows['commerce_orders'] || 0 }} ventas ·
                          {{ report.rows['reservations'] || 0 }} reservas ·
                          {{ report.own_images }} imágenes propias
                        </p>
                        <p>Ensayo aislado: {{ report.duration_seconds | number: '1.1-2' }} s.</p>
                        @if (report.external_images) {
                          <p>
                            {{ report.external_images }} imágenes externas conservadas como enlaces.
                          </p>
                        }
                        <p>{{ report.note }}</p>
                      </details>
                    }
                  </td>
                  <td>
                    @if (run.status === 'verified' && canWrite()) {
                      <button [disabled]="downloading()" (click)="download(run)">
                        Descargar ZIP
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">Todavía no se solicitaron copias para esta empresa.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <nav aria-label="Historial de copias">
          <button [disabled]="status.page <= 1" (click)="load(status.page - 1)">Anterior</button
          ><span>Página {{ status.page }} · {{ status.total }} solicitudes</span
          ><button [disabled]="status.page * 20 >= status.total" (click)="load(status.page + 1)">
            Siguiente
          </button>
        </nav>
      </article>
      <aside class="card">
        <h2>Qué se puede recuperar</h2>
        <p>
          El ZIP contiene un manifiesto y los datos de negocio de esta empresa. No incluye
          contraseñas, sesiones, claves API, contratos de suscripción ni claves de cobro. Las
          cuentas del ensayo quedan inactivas.
        </p>
        <p>
          Una recuperación real necesita revisión del encargado: debe considerar ventas posteriores,
          pagos externos y dispositivos sin conexión. El botón de descarga no reemplaza datos del
          sistema.
        </p>
      </aside>
    } @else if (loading()) {
      <p role="status">Consultando las copias de la empresa…</p>
    }
  </section>`,
  styles: [
    `
      :host {
        display: block;
      }
      .data-page {
        max-width: 1250px;
        margin: auto;
        padding-bottom: 30px;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 24px;
      }
      h1 {
        font-size: 30px;
        margin: 4px 0;
      }
      h2 {
        font-size: 19px;
        margin: 0 0 14px;
      }
      p {
        line-height: 1.65;
        color: var(--muted);
      }
      .eyebrow {
        font-size: 10px;
        letter-spacing: 0.15em;
      }
      .card,
      .summary article {
        border: 1px solid var(--line);
        border-radius: 13px;
        background: var(--surface, #fff);
        padding: 23px;
        margin-bottom: 20px;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
      }
      .summary strong {
        display: block;
        font-size: 21px;
        margin-top: 12px;
      }
      .summary span {
        color: var(--muted);
        font-size: 12px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin: 20px 0;
      }
      label {
        display: grid;
        gap: 8px;
        font-size: 12px;
      }
      .toggle {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      button,
      input,
      select {
        font: inherit;
        color: var(--ink);
        background: var(--surface);
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 7px;
      }
      button {
        cursor: pointer;
        font-size: 12px;
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      button.primary {
        background: #204d60;
        color: #fff;
      }
      .alert {
        padding: 15px;
        border-radius: 8px;
        background: var(--surface);
        border: 1px solid var(--line);
      }
      .warning {
        background: #fff4df;
        color: #6c4b16;
      }
      .error {
        color: #a73333;
      }
      .table-wrap {
        overflow: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      td,
      th {
        padding: 15px;
        text-align: left;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }
      th {
        font-size: 10px;
        text-transform: uppercase;
        color: var(--muted);
      }
      .badge {
        white-space: nowrap;
        padding: 4px 8px;
        border-radius: 15px;
        background: var(--bg);
      }
      .badge.ok {
        background: #e0f2e7;
        color: #2c6d49;
      }
      .muted {
        font-size: 12px;
      }
      nav {
        display: flex;
        gap: 12px;
        justify-content: end;
        align-items: center;
        margin-top: 16px;
        font-size: 12px;
      }
      details {
        min-width: 210px;
        max-width: 400px;
      }
      summary {
        cursor: pointer;
        color: var(--ink);
      }
      @media (max-width: 720px) {
        .summary,
        .form-grid {
          grid-template-columns: 1fr;
        }
        .card {
          padding: 17px;
        }
        nav {
          flex-wrap: wrap;
        }
      }
    `,
  ],
})
export class DatosRespaldosComponent {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private session = inject(SessionService);
  private route = inject(ActivatedRoute);
  private destroy = inject(DestroyRef);
  readonly platform = this.session.scope() === 'platform';
  readonly tenantId = this.route.snapshot.paramMap.get('id');
  private base = this.platform
    ? '/platform/tenants/' + this.tenantId + '/backups'
    : '/tenant/backups';
  data = signal<BackupStatus | null>(null);
  loading = signal(false);
  busy = signal(false);
  saving = signal(false);
  downloading = signal(false);
  error = signal('');
  message = signal('');
  policy: Policy = {
    enabled: false,
    frequency: 'daily',
    hour: 3,
    timezone: 'America/La_Paz',
    retention: 7,
  };
  hours = Array.from({ length: 24 }, (_, i) => i);
  private timer?: ReturnType<typeof setTimeout>;
  private key: string | null = null;
  private alive = true;
  constructor() {
    this.destroy.onDestroy(() => {
      this.alive = false;
      clearTimeout(this.timer);
    });
    void this.load();
  }
  canWrite() {
    return this.session.can(this.platform ? 'platform.ops.write' : 'tenant.data_export');
  }
  async load(page = this.data()?.page ?? 1, refreshPolicy = true) {
    if (this.loading()) return;
    clearTimeout(this.timer);
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await firstValueFrom(this.api.get<BackupStatus>(this.base, { page }));
      if (!this.alive) return;
      this.data.set(data);
      if (refreshPolicy) this.policy = { ...data.policy };
      if (data.items.some((run) => ['queued', 'running'].includes(run.status)))
        this.timer = setTimeout(() => {
          void this.load(page, false);
        }, 10000);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
  async create() {
    if (this.busy() || !this.canWrite()) return;
    this.busy.set(true);
    this.error.set('');
    this.key ??= crypto.randomUUID();
    try {
      await firstValueFrom(this.api.post(this.base, { request_id: this.key }));
      this.key = null;
      this.message.set(
        'Solicitud guardada. La copia aparecerá verificada cuando termine el ensayo.',
      );
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  async savePolicy() {
    this.saving.set(true);
    this.error.set('');
    const { enabled, frequency, hour, timezone, retention } = this.policy;
    try {
      const data = await firstValueFrom(
        this.api.put<BackupStatus>(this.base + '/policy', {
          enabled,
          frequency,
          hour,
          timezone,
          retention,
        }),
      );
      this.data.set(data);
      this.policy = { ...data.policy };
      this.message.set('Programación guardada.');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async download(run: BackupRun) {
    this.downloading.set(true);
    this.error.set('');
    try {
      const blob = await firstValueFrom(
        this.http.get(environment.apiUrl + this.base + '/' + run.id + '/download', {
          responseType: 'blob',
        }),
      );
      const url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = 'fashionstore-empresa-' + run.id + '.zip';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.downloading.set(false);
    }
  }
  stateLabel(state: string) {
    return (
      (
        {
          queued: 'En cola',
          running: 'En preparación',
          verified: 'Verificada en ensayo',
          failed: 'Fallida',
          expired: 'Conservación vencida',
        } as Record<string, string>
      )[state] ?? state
    );
  }
}
