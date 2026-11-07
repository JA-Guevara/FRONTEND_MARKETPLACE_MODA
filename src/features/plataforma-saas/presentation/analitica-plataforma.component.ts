import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../app/core/shared/api.service';
import { environment } from '../../../environments/environment';
import { errorMessage } from '../../../shared/errors';
import { PieChartComponent } from '../../ia-reportes/presentation/pie-chart.component';
import { BarChartComponent } from '../../ia-reportes/presentation/bar-chart.component';
import { TrendChartComponent } from '../../ia-reportes/presentation/trend-chart.component';

interface PlatformReport {
  meta: {
    from: string;
    to: string;
    generated_at: string;
    note: string;
    plan_code: string | null;
    state: string | null;
  };
  kpis: {
    companies: number;
    active: number;
    collected: string;
    paid_invoices: number;
    mrr_estimate: string;
    receivable: string;
    overdue_invoices: number;
  };
  plans: { label: string; value: number }[];
  states: { label: string; value: number }[];
  collections_by_plan: { label: string; value: string }[];
  daily_collections: { date: string; value: string }[];
  projection: {
    available: boolean;
    points: { date: string; value: string }[];
    note: string;
    method: string;
  };
  companies: {
    id: string;
    name: string;
    slug: string;
    state: string;
    plan: string;
    end_date: string | null;
    collected: string;
    mrr_estimate: string;
    sales_volume: string;
    paid_sales: number;
  }[];
}

@Component({
  selector: 'fs-analitica-plataforma',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PieChartComponent,
    BarChartComponent,
    TrendChartComponent,
  ],
  styleUrl: './analitica-plataforma.component.scss',
  template: ` <section class="analytics">
    <header>
      <div>
        <p class="eyebrow">FASHIONSTORE / NEGOCIO SAAS</p>
        <h1>Panel ejecutivo</h1>
        <p>Entendé el negocio, detectá vencimientos y compartí sus resultados.</p>
      </div>
      <a class="link-button" routerLink="/admin/plataforma/empresas">Gestionar empresas ↗</a>
    </header>
    <form class="filters" (ngSubmit)="load()">
      <label>Desde<input type="date" name="from" [(ngModel)]="from" required /></label>
      <label>Hasta<input type="date" name="to" [(ngModel)]="to" required /></label>
      <label
        >Plan<select name="plan" [(ngModel)]="plan">
          <option value="">Todos los planes</option>
          @for (item of plans(); track item.code) {
            <option [value]="item.code">{{ item.name }}</option>
          }
        </select></label
      >
      <label
        >Estado<select name="state" [(ngModel)]="state">
          <option value="">Todas las empresas</option>
          <option value="ACTIVA">Activas</option>
          <option value="SUSPENDIDA">Suspendidas</option>
          <option value="INACTIVA">Inactivas</option>
        </select></label
      >
      <button class="primary" [disabled]="loading()">
        {{ loading() ? 'Consultando…' : 'Aplicar filtros' }}
      </button>
    </form>
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    @if (report(); as data) {
      <div class="report-info">
        <p>{{ data.meta.from }} — {{ data.meta.to }} · BOB · Hora de Bolivia</p>
        <div class="exports">
          <span>Exportar vista</span>
          @for (format of formats; track format) {
            <button type="button" [disabled]="exporting()" (click)="export(format)">
              {{ format.toUpperCase() }}
            </button>
          }
        </div>
      </div>
      <div class="kpis">
        <article class="featured">
          <span>Cobros de suscripciones</span><strong>{{ money(data.kpis.collected) }}</strong
          ><small>{{ data.kpis.paid_invoices }} facturas pagadas en el período</small>
        </article>
        <article>
          <span>MRR estimado actual</span><strong>{{ money(data.kpis.mrr_estimate) }}</strong
          ><small>Mensualizado a precios de referencia</small>
        </article>
        <article>
          <span>Empresas activas</span
          ><strong
            >{{ data.kpis.active }} <em>/ {{ data.kpis.companies }}</em></strong
          ><small>Situación actual de las empresas filtradas</small>
        </article>
        <article>
          <span>Pendiente de cobro al cierre</span><strong>{{ money(data.kpis.receivable) }}</strong
          ><small>{{ data.kpis.overdue_invoices }} facturas vencidas</small>
        </article>
      </div>
      <div class="charts">
        <article class="card trend">
          <div class="card-title">
            <div>
              <span class="eyebrow">EVOLUCIÓN</span>
              <h2>Cobros y tendencia</h2>
            </div>
            <span class="tag">{{
              data.projection.available ? 'Proyección orientativa' : 'Histórico'
            }}</span>
          </div>
          <fs-trend-chart
            [actual]="actual()"
            [projected]="projected()"
            ariaLabel="Cobros diarios de suscripciones y proyección estimada"
          />
          <p class="note">
            {{ data.projection.note }} {{ data.projection.available ? data.projection.method : '' }}
          </p>
        </article>
        <article class="card">
          <span class="eyebrow">COMPOSICIÓN</span>
          <h2>Empresas por plan</h2>
          <fs-pie-chart [items]="data.plans" ariaLabel="Distribución de empresas por plan" />
        </article>
        <article class="card">
          <span class="eyebrow">CARTERA</span>
          <h2>Estado de las empresas</h2>
          <fs-pie-chart [items]="data.states" ariaLabel="Distribución por estado de empresa" />
        </article>
        <article class="card wide">
          <span class="eyebrow">INGRESOS REGISTRADOS</span>
          <h2>Cobros por plan contratado</h2>
          <fs-bar-chart
            [items]="data.collections_by_plan"
            ariaLabel="Cobros de suscripciones por plan"
          />
        </article>
      </div>
      <article class="card detail">
        <div class="card-title">
          <div>
            <span class="eyebrow">DETALLE EXPLORABLE</span>
            <h2>Resultados por empresa</h2>
          </div>
          <label
            >Buscar en los resultados<input
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              placeholder="Empresa, código o plan"
          /></label>
        </div>
        <p class="note">
          {{ data.meta.note }} Se excluyen empresas de demostración. La búsqueda filtra esta tabla;
          las exportaciones incluyen todas las empresas del período y filtros aplicados.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Plan / vence</th>
                <th>Estado</th>
                <th>Cobrado</th>
                <th>MRR estimado</th>
                <th>Volumen comercial</th>
                <th>Ventas pagadas</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/admin/plataforma/empresas', row.id]">{{ row.name }}</a
                    ><small>{{ row.slug }}</small>
                  </td>
                  <td>
                    {{ row.plan }}<small>{{ row.end_date || 'Sin vencimiento' }}</small>
                  </td>
                  <td>
                    <span class="tag" [class.warning]="row.state !== 'ACTIVA'">{{
                      row.state
                    }}</span>
                  </td>
                  <td>{{ money(row.collected) }}</td>
                  <td>{{ money(row.mrr_estimate) }}</td>
                  <td>{{ money(row.sales_volume) }}</td>
                  <td>{{ row.paid_sales }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7">No hay empresas que coincidan con los filtros.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <footer>
          {{ rows().length }} empresas visibles · Actualizado
          {{ data.meta.generated_at | date: 'short' }}
        </footer>
      </article>
    } @else if (loading()) {
      <div class="loading" role="status">Preparando los indicadores y gráficos…</div>
    }
  </section>`,
})
export class AnaliticaPlataformaComponent {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  report = signal<PlatformReport | null>(null);
  plans = signal<{ code: string; name: string }[]>([]);
  loading = signal(false);
  exporting = signal(false);
  error = signal('');
  from = new Date(Date.now() - 89 * 86400000).toLocaleDateString('sv-SE', {
    timeZone: 'America/La_Paz',
  });
  to = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/La_Paz' });
  plan = '';
  state = '';
  search = signal('');
  readonly formats = ['xlsx', 'pdf', 'csv'] as const;
  private revision = 0;
  actual = computed(
    () =>
      this.report()?.daily_collections.map((point) => ({
        label: point.date,
        value: Number(point.value),
      })) ?? [],
  );
  projected = computed(
    () =>
      this.report()?.projection.points.map((point) => ({
        label: point.date,
        value: Number(point.value),
      })) ?? [],
  );
  rows = computed(() =>
    (this.report()?.companies ?? []).filter((row) =>
      (row.name + ' ' + row.slug + ' ' + row.plan)
        .toLocaleLowerCase()
        .includes(this.search().toLocaleLowerCase()),
    ),
  );
  constructor() {
    this.api
      .get<{ code: string; name: string }[]>('/platform/plans', { active_only: true })
      .subscribe({ next: (rows) => this.plans.set(rows), error: () => {} });
    void this.load();
  }
  money(value: string) {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      maximumFractionDigits: 2,
    }).format(Number(value));
  }
  async load() {
    const revision = ++this.revision;
    this.loading.set(true);
    this.error.set('');
    this.report.set(null);
    try {
      const data = await firstValueFrom(
        this.api.get<PlatformReport>('/platform/analytics', {
          date_from: this.from,
          date_to: this.to,
          plan_code: this.plan,
          state: this.state,
        }),
      );
      if (revision === this.revision) this.report.set(data);
    } catch (error) {
      if (revision === this.revision) this.error.set(errorMessage(error));
    } finally {
      if (revision === this.revision) this.loading.set(false);
    }
  }
  async export(format: 'xlsx' | 'pdf' | 'csv') {
    const meta = this.report()?.meta;
    if (!meta || this.exporting()) return;
    this.exporting.set(true);
    this.error.set('');
    try {
      let params = new HttpParams()
        .set('date_from', meta.from)
        .set('date_to', meta.to)
        .set('format', format);
      if (meta.plan_code) params = params.set('plan_code', meta.plan_code);
      if (meta.state) params = params.set('state', meta.state);
      const blob = await firstValueFrom(
        this.http.get(environment.apiUrl + '/platform/analytics/export', {
          params,
          responseType: 'blob',
        }),
      );
      const url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = 'fashionstore-plataforma.' + format;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.exporting.set(false);
    }
  }
}
