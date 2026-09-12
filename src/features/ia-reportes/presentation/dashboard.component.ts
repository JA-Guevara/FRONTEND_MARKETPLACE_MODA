import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { DashboardService } from '../infrastructure/dashboard.service';
import { Dashboard } from '../domain/dashboard';
import { barPercent } from '../domain/dashboard.helpers';
import { MetricBarListComponent, BarItem } from './metric-bar-list.component';
import { TrendChartComponent, TrendPoint } from './trend-chart.component';
import { errorMessage } from '../../../shared/errors';

type Period = '30' | '90' | '365' | 'all';
const PERIODS: { key: Period; label: string }[] = [
  { key: '30', label: '30 días' },
  { key: '90', label: '90 días' },
  { key: '365', label: 'Este año' },
  { key: 'all', label: 'Todo' },
];
const TREND_LABEL: Record<string, string> = { up: '↑ En alza', down: '↓ En baja', stable: '→ Estable' };

@Component({
  selector: 'fs-dashboard',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, MetricBarListComponent, TrendChartComponent],
  template: `
    <section aria-label="Resumen de la tienda" class="dashboard">
      <div class="heading"><div><p class="eyebrow">TU TIENDA, EN NÚMEROS</p><h2>Resumen comercial</h2><p class="muted">Acumulado de operaciones registradas en FashionStore.</p></div>
        <button type="button" (click)="load()" [disabled]="loading()">{{ loading() ? 'Actualizando…' : 'Actualizar' }}</button></div>
      <div class="period-bar" role="group" aria-label="Período del reporte">
        @for (p of periods; track p.key) {
          <button type="button" [class.active]="period() === p.key" (click)="setPeriod(p.key)">{{ p.label }}</button>
        }
      </div>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (loading() && !data()) { <p role="status" class="panel">Cargando actividad de tu tienda…</p> }
      @if (data(); as d) {
        <div class="metrics">
          <article><span>Ingresos cobrados</span><strong>{{ d.revenue | currency:d.currency:'code':'1.2-2' }}</strong><small>{{ d.paid_orders | number }} pedidos pagados</small></article>
          <article><span>Pedidos</span><strong>{{ d.orders | number }}</strong><small>{{ d.pending_orders | number }} pendientes de pago</small></article>
          <article><span>Ticket promedio</span><strong>{{ d.average_ticket | currency:d.currency:'code':'1.2-2' }}</strong><small>Por pedido pagado</small></article>
          <article><span>Tasa de cancelación</span><strong>{{ d.cancellation_rate | percent:'1.0-1' }}</strong><small>Sobre el total de pedidos</small></article>
          <article><span>Productos registrados</span><strong>{{ d.products | number }}</strong><small>Catálogo de la tienda</small></article>
          <article><span>Stock bajo</span><strong>{{ d.low_stock | number }}</strong><small>Registros de sucursal con menos de 5 unidades</small></article>
        </div>
        <article class="report trend-card">
          <div class="trend-heading">
            <div><h3>Ventas diarias y proyección a 7 días</h3><p class="muted">Serie real (últimos 30 días con ventas) + estimación lineal.</p></div>
            @if (d.projection.values.length) { <span class="trend-badge">{{ trendLabel(d.projection.trend) }}</span> }
          </div>
          <fs-trend-chart [actual]="actualTrend()" [projected]="projectedTrend()" ariaLabel="Ventas diarias y proyección" />
        </article>
        <div class="reports">
          <article class="report"><h3>Ventas por día</h3><p class="muted">Hasta 30 días con ventas registradas · {{ d.currency }}</p>
            @for (day of d.daily_sales; track day.date) {
              <div class="bar-row"><span>{{ day.date | date:'dd/MM/yyyy':'UTC' }}</span><div class="bar" aria-hidden="true"><i [style.width.%]="percent(day.total, salesMax())"></i></div><b>{{ day.total | currency:d.currency:'code':'1.2-2' }}</b></div>
            } @empty { <p class="empty">Las ventas aparecerán aquí cuando se confirme el primer pago.</p> }
          </article>
          <article class="report"><h3>Prendas más vendidas</h3><p class="muted">Unidades incluidas en pedidos pagados</p>
            @for (product of d.top_products; track product.name; let index = $index) {
              <div class="rank"><span class="position">{{ index + 1 }}</span><span>{{ product.name }}</span><b>{{ product.quantity | number }} <small>uds.</small></b></div>
            } @empty { <p class="empty">Todavía no hay prendas vendidas para comparar.</p> }
            <h3 class="subheading">Estado de pedidos</h3>
            @for (state of statuses(); track state.key) { <div class="status-row"><span>{{ state.label }}</span><b>{{ state.count | number }}</b></div> }
            @if (!statuses().length) { <p class="empty">Sin pedidos registrados.</p> }
          </article>
        </div>
        <div class="reports">
          <article class="report"><h3>Comparativa mensual</h3><p class="muted">Últimos 12 meses · {{ d.currency }}</p>
            <fs-metric-bar-list [items]="monthlyBars()" format="currency" [currency]="d.currency" emptyText="Todavía no hay ventas registradas por mes." />
          </article>
          <article class="report"><h3>Por categoría de prenda</h3><p class="muted">Facturación del período seleccionado</p>
            <fs-metric-bar-list [items]="categoryBars()" format="currency" [currency]="d.currency" emptyText="Sin ventas por categoría en este período." />
          </article>
        </div>
        <div class="reports">
          <article class="report"><h3>Por sucursal</h3><p class="muted">Facturación del período seleccionado</p>
            <fs-metric-bar-list [items]="branchBars()" format="currency" [currency]="d.currency" emptyText="Sin ventas por sucursal en este período." />
          </article>
          <article class="report"><h3>Días de la semana</h3><p class="muted">Qué días vende más la tienda</p>
            <fs-metric-bar-list [items]="weekdayBars()" format="currency" [currency]="d.currency" emptyText="Sin ventas en este período." />
          </article>
        </div>
        <article class="report">
          <h3>Horario de mayor venta</h3><p class="muted">Facturación por hora del día (período seleccionado)</p>
          <fs-metric-bar-list [items]="hourBars()" format="currency" [currency]="d.currency" emptyText="Sin ventas en este período." />
        </article>
        <article class="insights report"><div><p class="eyebrow">ASISTENTE DE LA TIENDA</p><h3>Una mirada a tus resultados</h3><p class="muted">Recomendaciones bajo solicitud, basadas en las métricas agregadas.</p></div>
          @if (d.ai_ready) { <button type="button" (click)="ask()" [disabled]="thinking()">{{ thinking() ? 'Analizando…' : 'Generar recomendaciones' }}</button> }
          @else { <p class="empty">El asistente todavía no está habilitado. Podés consultar todas las métricas de la tienda.</p> }
          @if (insight()) { <p class="insight-text" role="status">{{ insight() }}</p> }
          @if (insightError()) { <p class="error" role="alert">{{ insightError() }}</p> }
        </article>
      }
    </section>`,
  styles: [`
    :host{display:block;min-width:0}.dashboard{display:grid;gap:1rem;margin:1.5rem 0 2rem;min-width:0}.heading{display:flex;align-items:center;justify-content:space-between;gap:1rem}.heading h2{font-size:1.65rem;margin:.25rem 0}.muted{font-size:.85rem;margin:.4rem 0;line-height:1.5}
    .period-bar{display:flex;gap:.5rem;flex-wrap:wrap}.period-bar button{font-size:.75rem;padding:.4rem .8rem;border-radius:20px}.period-bar button.active{background:#24231f;color:#fff;border-color:#24231f}
    .metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.85rem}.metrics article,.report{background:#fff;border:1px solid #e5ded5;border-radius:16px;padding:1.15rem;min-width:0}.metrics article{display:grid;gap:.6rem;align-content:start}.metrics span{font-size:.8rem;color:#645d55}.metrics strong{font-size:clamp(1rem,1.8vw,1.5rem);line-height:1.2;overflow-wrap:anywhere}.metrics small{font-size:.73rem;color:#756c62;line-height:1.4}
    .reports{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:1rem;align-items:start}.report h3{font-size:1.1rem;margin:0 0 .45rem}
    .trend-card{display:grid;gap:.6rem}.trend-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap}.trend-heading h3{margin:0 0 .3rem}.trend-badge{font-size:.75rem;font-weight:600;background:#f5efe8;padding:.35rem .7rem;border-radius:20px;white-space:nowrap}
    .bar-row{display:grid;grid-template-columns:80px minmax(25px,1fr) auto;gap:.65rem;align-items:center;margin:1rem 0;font-size:.73rem}.bar{height:8px;background:#f2eee8;border-radius:5px;overflow:hidden}.bar i{display:block;height:100%;background:#a87954;border-radius:5px}.bar-row b{font-size:.72rem;overflow-wrap:anywhere}
    .rank{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:.65rem;align-items:center;padding:.8rem 0;border-bottom:1px solid #eee8e1;font-size:.83rem}.rank>span{overflow-wrap:anywhere}.rank small{font-weight:400}.position{background:#f5efe8;border-radius:50%;width:26px;height:26px;display:grid;place-items:center}
    .status-row{display:flex;justify-content:space-between;gap:1rem;font-size:.82rem;padding:.45rem 0}.subheading{margin-top:1.5rem!important}.empty{color:#756c62;font-size:.85rem;line-height:1.6;padding:.75rem 0;margin:0}
    .insights{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem}.insights>div{flex:1 1 260px}.insight-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.9rem;line-height:1.7;width:100%;margin:0}.insights .error{width:100%}
    button{min-height:40px;white-space:normal;font-size:.82rem}.eyebrow{font-size:.67rem}
    @media(max-width:1000px){.metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.reports{grid-template-columns:1fr}}
    @media(max-width:480px){.heading{align-items:flex-start;flex-direction:column}.heading h2{font-size:1.4rem}.metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem}.metrics article,.report{padding:.85rem;border-radius:12px}.metrics strong{font-size:1.1rem}.bar-row{grid-template-columns:67px minmax(15px,1fr);gap:.4rem}.bar-row b{grid-column:2}.dashboard{gap:.8rem}.insights button{width:100%}}
  `],
})
export class DashboardComponent {
  private service = inject(DashboardService);
  data = signal<Dashboard | null>(null);
  loading = signal(false); error = signal(''); thinking = signal(false);
  insight = signal(''); insightError = signal(''); percent = barPercent;
  period = signal<Period>('90');
  periods = PERIODS;
  trendLabel = (trend: string) => TREND_LABEL[trend] ?? trend;
  constructor() { void this.load(); }
  setPeriod(p: Period) {
    if (this.period() === p) return;
    this.period.set(p);
    void this.load();
  }
  private dateFrom(): string | undefined {
    const days = { '30': 30, '90': 90, '365': 365, all: undefined }[this.period()];
    if (!days) return undefined;
    const from = new Date();
    from.setDate(from.getDate() - days);
    return from.toISOString();
  }
  async load() {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    try { this.data.set(await firstValueFrom(this.service.load(this.dateFrom()))); }
    catch (error) { this.error.set(errorMessage(error)); }
    finally { this.loading.set(false); }
  }
  salesMax() { return Math.max(0, ...(this.data()?.daily_sales.map(d => Number(d.total)) ?? [])); }
  statuses() {
    const labels: Record<string,string> = { pending_payment:'Pendiente de pago', paid:'Pagado', processing:'En preparación', shipped:'En camino', delivered:'Entregado', cancelled:'Cancelado' };
    return Object.entries(this.data()?.by_status ?? {}).map(([key,count]) => ({key,count,label:labels[key] ?? key}));
  }
  actualTrend(): TrendPoint[] {
    return (this.data()?.daily_sales ?? []).map((d) => ({ label: d.date, value: Number(d.total) }));
  }
  projectedTrend(): TrendPoint[] {
    const projection = this.data()?.projection;
    if (!projection) return [];
    return projection.values.map((value, i) => ({ label: projection.dates[i], value: Number(value) }));
  }
  private monthLabel(key: string): string {
    const [year, month] = key.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('es-BO', { month: 'short', year: '2-digit' });
  }
  monthlyBars(): BarItem[] {
    return (this.data()?.monthly_sales ?? []).map((m) => ({ label: this.monthLabel(m.month), value: m.total }));
  }
  categoryBars(): BarItem[] {
    return (this.data()?.category_breakdown ?? []).map((c) => ({ label: c.category, value: c.total }));
  }
  branchBars(): BarItem[] {
    return (this.data()?.branch_performance ?? []).map((b) => ({ label: b.branch, value: b.total }));
  }
  weekdayBars(): BarItem[] {
    return (this.data()?.weekday_distribution ?? []).map((w) => ({ label: w.weekday, value: w.total }));
  }
  hourBars(): BarItem[] {
    return (this.data()?.hourly_distribution ?? []).map((h) => ({ label: h.hour + ':00', value: h.total }));
  }
  async ask() {
    if (this.thinking() || !this.data()?.ai_ready) return;
    this.thinking.set(true); this.insightError.set(''); this.insight.set('');
    try { this.insight.set((await firstValueFrom(this.service.insights())).message); }
    catch (error) { this.insightError.set(errorMessage(error)); }
    finally { this.thinking.set(false); }
  }
}
