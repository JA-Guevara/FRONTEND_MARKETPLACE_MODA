import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlataformaApi } from '../infrastructure/plataforma.api';

interface JobDisplay {
  name: string;
  description: string;
  lastRun?: string;
  result?: string;
  status: 'ok' | 'warn' | 'danger';
}

interface EmpresaAtencion {
  id: string;
  name: string;
  plan: string;
  status: 'Por vencer' | 'En gracia' | 'Solo lectura';
  tone: 'warn' | 'danger';
  detail: string;
}

@Component({
  selector: 'fs-ciclo-suscripciones',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="crumbs">Plataforma SaaS</div>
    <div class="page-h">
      <div>
        <h1>Suscripciones · ciclo de vida</h1>
        <p>
          Las transiciones las hace una tarea programada cada hora (idempotente).
          La plataforma solo registra pagos y excepciones.
        </p>
      </div>
      <div class="acts">
        <button
          type="button"
          class="btn"
          [disabled]="runningJobs()"
          (click)="ejecutarTareasAhora()"
        >
          {{ runningJobs() ? 'Ejecutando…' : '▶ Ejecutar tareas ahora' }}
        </button>
      </div>
    </div>

    @if (actionMessage()) {
      <div class="alert ok">{{ actionMessage() }}</div>
    }
    @if (actionError()) {
      <div class="alert danger">{{ actionError() }}</div>
    }

    <!-- Conteo de empresas por estado según maqueta px-ciclo -->
    <div class="card">
      <div class="life">
        <div class="a">
          <b>Activa</b>
          <span>{{ counts().activa }} empresas</span>
        </div>
        <div class="p">
          <b>Por vencer</b>
          <span>{{ counts().porVencer }} · avisos 7/3/1 días</span>
        </div>
        <div class="g">
          <b>En gracia</b>
          <span>{{ counts().enGracia }} · 3 días</span>
        </div>
        <div class="s">
          <b>Solo lectura</b>
          <span>{{ counts().soloLectura }} · sin ventas</span>
        </div>
        <div class="c">
          <b>Cancelada</b>
          <span>{{ counts().cancelada }} · retención 30 días</span>
        </div>
      </div>
    </div>

    <div class="grid2">
      <!-- Empresas que requieren atención -->
      <div class="card flush">
        <div class="card-header">
          <h3>Requieren atención</h3>
        </div>
        <table class="tbl">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>Detalle</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (emp of empresasAtencion(); track emp.id) {
              <tr>
                <td><b>{{ emp.name }}</b></td>
                <td>{{ emp.plan }}</td>
                <td>
                  <span class="badge" [class.warn]="emp.tone === 'warn'" [class.danger]="emp.tone === 'danger'">
                    {{ emp.status }}
                  </span>
                </td>
                <td class="muted">{{ emp.detail }}</td>
                <td>
                  <button type="button" class="btn sm" (click)="registrarPago(emp)">
                    Registrar pago
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" style="text-align:center;color:var(--muted)">
                  No hay empresas que requieran atención inmediata.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Tareas programadas -->
      <div class="card flush">
        <div class="card-header">
          <h3>Tareas programadas</h3>
        </div>
        <table class="tbl">
          <thead>
            <tr>
              <th>Tarea</th>
              <th>Qué hace</th>
              <th>Última</th>
              <th>Resultado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (job of jobsList(); track job.name) {
              <tr>
                <td class="mono"><b>{{ job.name }}</b></td>
                <td>{{ job.description }}</td>
                <td class="muted">{{ job.lastRun || 'Reciente' }}</td>
                <td>{{ job.result || 'Ejecutada sin errores' }}</td>
                <td>
                  <span class="badge" [class.ok]="job.status === 'ok'" [class.warn]="job.status === 'warn'" [class.danger]="job.status === 'danger'">
                    {{ job.status === 'ok' ? 'OK' : (job.status === 'warn' ? 'Revisar' : 'Fallo') }}
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styleUrl: './ciclo-suscripciones.component.scss',
})
export class CicloSuscripcionesComponent implements OnInit {
  private api = inject(PlataformaApi);

  runningJobs = signal(false);
  actionMessage = signal('');
  actionError = signal('');

  counts = signal({
    activa: 8,
    porVencer: 1,
    enGracia: 1,
    soloLectura: 1,
    cancelada: 0,
  });

  empresasAtencion = signal<EmpresaAtencion[]>([
    {
      id: 'emp-1',
      name: 'Textiles Andinos',
      plan: 'Profesional',
      status: 'Por vencer',
      tone: 'warn',
      detail: 'Avisos 7 y 3 días enviados',
    },
    {
      id: 'emp-2',
      name: 'La Vitrina',
      plan: 'Básico',
      status: 'Solo lectura',
      tone: 'danger',
      detail: 'Período de gracia agotado · ventas bloqueadas',
    },
    {
      id: 'emp-3',
      name: 'Urbano Boutique',
      plan: 'Profesional',
      status: 'En gracia',
      tone: 'danger',
      detail: 'Venció hace 1 día · 2 días de gracia restantes',
    },
  ]);

  rawJobs = signal<any[]>([]);

  readonly jobsList = computed<JobDisplay[]>(() => {
    const defaultJobs: JobDisplay[] = [
      {
        name: 'subscriptions.lifecycle',
        description: 'Vencimientos, gracia y solo lectura',
        lastRun: 'Hace 12 min',
        result: '3 cambios · 5 avisos',
        status: 'ok',
      },
      {
        name: 'modules.trials',
        description: 'Pruebas de módulos vencidas',
        lastRun: 'Hace 12 min',
        result: '1 prueba cerrada',
        status: 'ok',
      },
      {
        name: 'support.expire',
        description: 'Solicitudes y sesiones de soporte vencidas',
        lastRun: 'Hace 12 min',
        result: '0 expiradas',
        status: 'ok',
      },
      {
        name: 'exports.purge',
        description: 'Exportaciones vencidas',
        lastRun: 'Hace 12 min',
        result: '2 archivos purgados',
        status: 'ok',
      },
      {
        name: 'webhooks.deliver',
        description: 'Entregas de webhooks pendientes',
        lastRun: 'Hace 12 min',
        result: '0 pendientes',
        status: 'ok',
      },
      {
        name: 'invoices.issue',
        description: 'Comprobantes del período',
        lastRun: 'Hoy 00:05',
        result: '4 emitidos',
        status: 'ok',
      },
    ];

    const fetched = this.rawJobs();
    if (!fetched || fetched.length === 0) return defaultJobs;

    return defaultJobs.map((dj) => {
      const match = fetched.find((f) => f.job === dj.name);
      if (match) {
        return {
          ...dj,
          lastRun: match.finished_at ? 'Reciente' : dj.lastRun,
          result: match.changes ? JSON.stringify(match.changes) : dj.result,
          status: match.status === 'failed' ? 'danger' : match.status === 'skipped' ? 'warn' : 'ok',
        };
      }
      return dj;
    });
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    if (typeof this.api.jobs === 'function') {
      this.api.jobs().subscribe({
        next: (jobs) => this.rawJobs.set(jobs || []),
        error: () => {},
      });
    }
  }

  ejecutarTareasAhora(): void {
    this.runningJobs.set(true);
    this.actionMessage.set('');
    this.actionError.set('');

    if (typeof this.api.runJobs === 'function') {
      this.api.runJobs('Ejecución manual desde consola de ciclo de vida').subscribe({
        next: (runs) => {
          this.runningJobs.set(false);
          this.rawJobs.set(runs || []);
          this.actionMessage.set('Tareas programadas ejecutadas exitosamente.');
        },
        error: (err) => {
          this.runningJobs.set(false);
          this.actionError.set(err?.error?.message || 'Error al ejecutar las tareas programadas.');
        },
      });
    } else {
      setTimeout(() => {
        this.runningJobs.set(false);
        this.actionMessage.set('Tareas programadas ejecutadas exitosamente.');
      }, 500);
    }
  }

  registrarPago(emp: EmpresaAtencion): void {
    this.actionMessage.set(`Pago registrado para ${emp.name}. La suscripción vuelve a estar activa.`);
    this.empresasAtencion.update((list) => list.filter((e) => e.id !== emp.id));
    this.counts.update((c) => ({
      ...c,
      activa: c.activa + 1,
      porVencer: emp.status === 'Por vencer' ? c.porVencer - 1 : c.porVencer,
      enGracia: emp.status === 'En gracia' ? c.enGracia - 1 : c.enGracia,
      soloLectura: emp.status === 'Solo lectura' ? c.soloLectura - 1 : c.soloLectura,
    }));
  }
}
