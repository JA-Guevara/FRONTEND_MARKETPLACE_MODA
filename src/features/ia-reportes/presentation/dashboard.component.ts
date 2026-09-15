import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { DashboardService } from '../infrastructure/dashboard.service';
import { Dashboard, ExportReport, ViewId, ReportQuery, InterpretResult, ExplainResult } from '../domain/dashboard';
import { barPercent } from '../domain/dashboard.helpers';
import { TrendChartComponent, TrendPoint } from './trend-chart.component';
import { BarChartComponent, BarChartItem } from './bar-chart.component';
import { PieChartComponent, PieSlice } from './pie-chart.component';
import { errorMessage } from '../../../shared/errors';
import { CommerceService } from '../../ventas-pagos/infrastructure/commerce.service';
import { Branch } from '../../ventas-pagos/domain/commerce.models';
import { CatalogService } from '../../usuarios-catalogo/infrastructure/catalog.service';
import { Entity } from '../../usuarios-catalogo/domain/catalog.models';

type Period = '30' | '90' | '365' | 'ytd' | 'all';
const PERIODS: { key: Period; label: string }[] = [
  { key: '30', label: '30 días' },
  { key: '90', label: '90 días' },
  { key: '365', label: 'Últimos 365 días' },
  { key: 'ytd', label: 'Este año' },
  { key: 'all', label: 'Todo' },
];
const TREND_LABEL: Record<string, string> = { up: '↑ En alza', down: '↓ En baja', stable: '→ Estable' };
const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Pendiente de pago', paid: 'Pagado', processing: 'En preparación',
  shipped: 'En camino', delivered: 'Entregado', cancelled: 'Cancelado',
};
const METHOD_LABEL: Record<string, string> = { stripe: 'Stripe', manual: 'Manual', cash: 'Efectivo' };
const VIEWS: { key: ViewId; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'ventas', label: 'Ventas y horario' },
  { key: 'comparativas', label: 'Comparativas' },
  { key: 'sucursales', label: 'Sucursales' },
  { key: 'productos', label: 'Productos y pedidos' },
  { key: 'inventario', label: 'Stock bajo' },
  { key: 'reservas', label: 'Reservas' },
  { key: 'pagos', label: 'Pagos y métodos' },
];

@Component({
  selector: 'fs-dashboard',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, FormsModule, TrendChartComponent, BarChartComponent, PieChartComponent],
  template: `
    <section aria-label="Centro de reportes de la tienda" class="dashboard">
      <div class="heading">
        <div>
          <p class="eyebrow">REPORTES DE LA TIENDA</p>
          <h2>Centro de reportes</h2>
          <p class="muted">Métricas recalculadas por el servidor sobre el período y los filtros visibles.</p>
        </div>
        <div class="heading-actions">
          <label class="export-label">Exportar
            <select [ngModel]="exportReportSel()" (ngModelChange)="exportReportSel.set($event)" aria-label="Reporte a exportar">
              <option value="ventas">Ventas</option>
              <option value="pedidos">Pedidos</option>
              <option value="pagos">Pagos</option>
              <option value="prendas_vendidas">Prendas vendidas</option>
              <option value="existencias">Existencias</option>
              <option value="sucursales">Sucursales</option>
            </select>
          </label>
          <button type="button" class="ghost" (click)="exportReport('xlsx')" [disabled]="exporting()">{{ exporting() ? 'Generando…' : 'Excel' }}</button>
          <button type="button" class="ghost" (click)="exportReport('csv')" [disabled]="exporting()">CSV</button>
          <button type="button" (click)="load()" [disabled]="loading()">{{ loading() ? 'Actualizando…' : 'Actualizar' }}</button>
        </div>
      </div>
      @if (exportError()) { <p class="error" role="alert">{{ exportError() }}</p> }
      <nav class="view-tabs" aria-label="Vista del reporte">
        @for (v of views; track v.key) {
          <button type="button" [class.active]="view() === v.key" [attr.aria-current]="view() === v.key ? 'page' : null"
            (click)="setView(v.key)">{{ v.label }}</button>
        }
      </nav>
      <div class="filters" role="group" aria-label="Filtros y período del reporte">
        <div class="period-bar" role="group" aria-label="Período del reporte">
          @for (p of periods; track p.key) {
            <button type="button" [class.active]="!customRange() && period() === p.key" (click)="setPeriod(p.key)">{{ p.label }}</button>
          }
          @if (customRange()) {
            <button type="button" class="chip-clear" (click)="clearCustom()">☓ {{ customRange() }}</button>
          }
        </div>
        <select class="field" [ngModel]="filters().branch_id ?? ''" (ngModelChange)="set('branch_id', $event)" aria-label="Filtrar por sucursal">
          <option value="">Todas las sucursales</option>
          @for (b of branches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
        </select>
        <select class="field" [ngModel]="filters().category_id ?? ''" (ngModelChange)="set('category_id', $event)" aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          @for (c of categories(); track c.id) { <option [value]="c.id">{{ c['name'] }}</option> }
        </select>
        <select class="field" [ngModel]="filters().status ?? ''" (ngModelChange)="set('status', $event)" aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          @for (s of statusOptions; track s.key) { <option [value]="s.key">{{ s.label }}</option> }
        </select>
        <select class="field" [ngModel]="compareMode()" (ngModelChange)="compareMode.set($event)" aria-label="Comparación">
          <option value="previous">Vs período anterior</option>
          <option value="year_ago">Vs año pasado</option>
          <option value="none">Sin comparación</option>
        </select>
      </div>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (loading() && !data()) { <p role="status">Cargando actividad de tu tienda…</p> }
      @if (data(); as d) {
        @switch (view()) {
          @case ('resumen') {
            <div class="metrics">
              <article><span>Ingresos cobrados</span><strong>{{ d.period.revenue | currency:d.currency:'code':'1.2-2' }}</strong>
                <small>{{ d.period.paid_orders | number }} pedidos pagados</small>
                @if (comp(); as c) { <b class="delta" [class.good]="good(c.revenue_delta_pct)" [class.bad]="!good(c.revenue_delta_pct)">{{ delta(c.revenue_delta_pct) }}</b> }
              </article>
              <article><span>Pedidos creados</span><strong>{{ d.period.orders | number }}</strong>
                <small>{{ d.period.pending_orders | number }} pendientes de pago</small>
                @if (comp(); as c) { <b class="delta" [class.good]="good(c.paid_delta_pct)" [class.bad]="!good(c.paid_delta_pct)">{{ delta(c.paid_delta_pct) }}</b> }
              </article>
              <article><span>Ticket promedio</span><strong>{{ d.period.ticket_avg | currency:d.currency:'code':'1.2-2' }}</strong><small>Por pedido pagado</small></article>
              <article><span>Unidades vendidas</span><strong>{{ d.period.units_sold | number }}</strong><small>En el período</small></article>
              <article><span>Tasa de cancelación</span><strong>{{ d.period.cancellation_rate | percent:'1.0-1' }}</strong><small>Del período</small></article>
              <article><span>Reservas activas</span><strong>{{ reservationsTotal() | number }}</strong><small>Con horario en el período</small></article>
            </div>
            <div class="trend-grid">
              <article class="report trend-card">
                <div class="trend-heading">
                  <div><h3>Ventas diarias y proyección a 7 días</h3><p class="muted">Serie real + estimación lineal.</p></div>
                  @if (d.projection.values.length) { <span class="trend-badge">{{ trendLabel(d.projection.trend) }}</span> }
                </div>
                <fs-trend-chart [actual]="actualTrend()" [projected]="projectedTrend()" ariaLabel="Ventas diarias y proyección" />
              </article>
              <article class="report stock-alert">
                <h3>Alertas de stock</h3>
                <p class="muted">Variantes con menos de {{ lowStockThreshold() }} unidades en alguna sucursal.</p>
                <p class="alert-big" [class.alert-ok]="!d.low_stock_variants.length">{{ d.low_stock_variants.length | number }} variantes</p>
                @if (d.low_stock_variants.length) {
                  <button type="button" class="ghost" (click)="setView('inventario')">Ver detalle y exportar existencias</button>
                } @else { <p class="empty">Ninguna variante está bajo el umbral.</p> }
              </article>
            </div>
            <div class="reports">
              <article class="report"><h3>Prendas más vendidas</h3><p class="muted">Unidades incluidas en pedidos pagados</p>
                @for (product of d.top_products; track product.name; let index = $index) {
                  <div class="rank"><span class="position">{{ index + 1 }}</span><span>{{ product.name }}</span><b>{{ product.quantity | number }} <small>uds.</small></b></div>
                } @empty { <p class="empty">Todavía no hay prendas vendidas para comparar.</p> }
              </article>
              <article class="report"><h3>Por sucursal</h3><p class="muted">Facturación del período seleccionado</p>
                <fs-bar-chart [items]="branchBars()" format="currency" [currency]="d.currency" emptyText="Sin ventas por sucursal en este período." ariaLabel="Ingresos por sucursal" />
              </article>
            </div>
          }
          @case ('ventas') {
            <article class="report trend-card">
              <div class="trend-heading">
                <div><h3>Ventas diarias y proyección</h3><p class="muted">Hasta 30 días con ventas · {{ d.currency }}</p></div>
                @if (d.projection.values.length) { <span class="trend-badge">{{ trendLabel(d.projection.trend) }}</span> }
              </div>
              <fs-trend-chart [actual]="actualTrend()" [projected]="projectedTrend()" ariaLabel="Ventas diarias y proyección" />
              @if (d.projection.meta) { <p class="muted">Proyección: {{ d.projection.meta.method }}</p> }
            </article>
            <div class="reports">
              <article class="report"><h3>Ventas por día</h3><p class="muted">Hasta 30 días con ventas · {{ d.currency }}</p>
                @for (day of d.daily_sales; track day.date) {
                  <div class="bar-row"><span>{{ day.date | date:'dd/MM/yyyy':'UTC' }}</span><div class="bar" aria-hidden="true"><i [style.width.%]="percent(day.total, salesMax())"></i></div><b>{{ day.total | currency:d.currency:'code':'1.2-2' }}</b></div>
                } @empty { <p class="empty">Las ventas aparecerán aquí cuando se confirme el primer pago.</p> }
              </article>
              <article class="report"><h3>Horario de mayor venta</h3><p class="muted">Facturación por hora del día</p>
                <fs-bar-chart [items]="hourBars()" format="currency" [currency]="d.currency" emptyText="Sin ventas en este período." ariaLabel="Ingresos por hora del día" />
              </article>
            </div>
            <article class="report"><h3>Días de la semana</h3><p class="muted">Qué días vende más la tienda</p>
              <fs-bar-chart [items]="weekdayBars()" format="currency" [currency]="d.currency" emptyText="Sin ventas en este período." ariaLabel="Ingresos por día de la semana" />
            </article>
          }
          @case ('comparativas') {
            <article class="report"><h3>Comparativa mensual</h3><p class="muted">Últimos 12 meses · {{ d.currency }}</p>
              <fs-bar-chart [items]="monthlyBars()" format="currency" [currency]="d.currency" emptyText="Todavía no hay ventas registradas por mes." ariaLabel="Ingresos por mes" />
            </article>
            <div class="reports">
              <article class="report"><h3>Por categoría de prenda</h3><p class="muted">Facturación del período seleccionado</p>
                <fs-pie-chart [items]="categoryBars()" format="currency" [currency]="d.currency" emptyText="Sin ventas por categoría en este período." ariaLabel="Ingresos por categoría" />
              </article>
              <article class="report"><h3>Por hora</h3><p class="muted">Facturación por hora del día</p>
                <fs-bar-chart [items]="hourBars()" format="currency" [currency]="d.currency" emptyText="Sin ventas en este período." ariaLabel="Ingresos por hora del día" />
              </article>
            </div>
          }
          @case ('sucursales') {
            <article class="report"><h3>Comparativo por sucursal</h3><p class="muted">Facturación del período seleccionado</p>
              <fs-bar-chart [items]="branchBars()" format="currency" [currency]="d.currency" emptyText="Sin ventas por sucursal en este período." ariaLabel="Ingresos por sucursal" />
            </article>
            @if (comp(); as c) {
              <div class="compare-grid">
                <article class="report compare"><span class="muted">Comparación</span><p>{{ compareNote() }}</p>
                  <b>{{ delta(c.revenue_delta_pct) }}</b><span>en ingresos</span>
                  <b>{{ delta(c.paid_delta_pct) }}</b><span>en pedidos pagados</span>
                </article>
              </div>
            }
          }
          @case ('productos') {
            <div class="reports">
              <article class="report"><h3>Prendas más vendidas</h3><p class="muted">Unidades incluidas en pedidos pagados</p>
                @for (product of d.top_products; track product.name; let index = $index) {
                  <div class="rank"><span class="position">{{ index + 1 }}</span><span>{{ product.name }}</span><b>{{ product.quantity | number }} <small>uds.</small></b></div>
                } @empty { <p class="empty">Todavía no hay prendas vendidas para comparar.</p> }
                <h3 class="subheading">Estado de pedidos</h3>
                @for (state of statuses(d); track state.key) { <div class="status-row"><span>{{ state.label }}</span><b>{{ state.count | number }}</b></div> }
                @if (!statuses(d).length) { <p class="empty">Sin pedidos registrados.</p> }
              </article>
              <article class="report"><h3>Por categoría de prenda</h3><p class="muted">Facturación del período seleccionado</p>
                <fs-pie-chart [items]="categoryBars()" format="currency" [currency]="d.currency" emptyText="Sin ventas por categoría en este período." ariaLabel="Ingresos por categoría" />
              </article>
            </div>
          }
          @case ('inventario') {
            @if (d.low_stock_variants.length) {
              <div class="alert strip">
                <strong>{{ d.low_stock_variants.length | number }} variantes por reponer</strong>
                <span>Umbral configurado: menos de {{ lowStockThreshold() }} unidades. Instantánea del momento.</span>
              </div>
            }
            <article class="report">
              <h3>Variantes con stock bajo</h3>
              @if (d.low_stock_variants.length) {
                <div class="table" role="table" aria-label="Variantes con stock bajo">
                  <div class="row head" role="row"><span role="columnheader">Prenda</span><span role="columnheader">Sucursal</span><span role="columnheader">Talla</span><span role="columnheader">Color</span><span role="columnheader">Stock</span></div>
                  @for (v of d.low_stock_variants; track v.variant_id + '|' + v.branch_id) {
                    <div class="row" role="row"><span role="cell"><b>{{ v.name }}</b><small>{{ v.sku }}</small></span><span role="cell">{{ v.branch }}</span><span role="cell">{{ v.size }}</span><span role="cell">{{ v.color }}</span><span role="cell"><b class="qty-low">{{ v.quantity }}</b></span></div>
                  }
                </div>
              } @else {
                <p class="empty">Ninguna variante está bajo el umbral. Podés exportar el reporte de existencias completo.</p>
              }
            </article>
          }
          @case ('reservas') {
            <article class="report">
              <h3>Reservas por estado</h3>
              <p class="muted">Reservas por estado: se cuentan las visitas con horario dentro del período y las sucursales seleccionadas.</p>
              @for (r of d.reservations_by_status; track r.status) {
                <div class="status-row"><span>{{ label(r.status) }}</span><b>{{ r.count | number }}</b></div>
              } @empty { <p class="empty">Sin reservas registradas.</p> }
            </article>
          }
          @case ('pagos') {
            <div class="reports">
              <article class="report"><h3>Métodos de pago</h3><p class="muted">Pedidos del período según método</p>
                <fs-pie-chart [items]="paymentPie(d)" format="number" emptyText="Sin pedidos registrados en el período." ariaLabel="Pedidos por método de pago" />
              </article>
              <article class="report"><h3>Estado de pedidos</h3><p class="muted">Pedidos del período filtrado</p>
                <fs-pie-chart [items]="statusPie(d)" format="number" emptyText="Sin pedidos registrados." ariaLabel="Pedidos por estado" />
              </article>
            </div>
          }
          @default {
            <div class="metrics">
              <article><span>Ingresos cobrados</span><strong>{{ d.period.revenue | currency:d.currency:'code':'1.2-2' }}</strong><small>{{ d.period.paid_orders | number }} pedidos pagados</small></article>
              <article><span>Pedidos creados</span><strong>{{ d.period.orders | number }}</strong><small>{{ d.period.pending_orders | number }} pendientes de pago</small></article>
              <article><span>Ticket promedio</span><strong>{{ d.period.ticket_avg | currency:d.currency:'code':'1.2-2' }}</strong><small>Por pedido pagado</small></article>
              <article><span>Unidades vendidas</span><strong>{{ d.period.units_sold | number }}</strong><small>En el período</small></article>
              <article><span>Tasa de cancelación</span><strong>{{ d.period.cancellation_rate | percent:'1.0-1' }}</strong><small>Del período</small></article>
              <article><span>Productos registrados</span><strong>{{ d.products | number }}</strong><small>Catálogo de la tienda</small></article>
            </div>
          }
        }
        <article class="report ai-pad">
          <div class="ai-head"><div><p class="eyebrow">CENTRO DE IA</p><h3>Asistente de reportes</h3><p class="muted">Interpreta consultas y explica las métricas <b>recalculadas por el servidor</b> sobre el contexto visible.</p></div></div>
          <div class="ai-grid">
            <div class="ai-col">
              <h4>Hacé una pregunta en lenguaje natural</h4>
              <form (ngSubmit)="interpret()">
                <input name="q" [(ngModel)]="interpretDraft" maxlength="300" placeholder='Ej: "ventas del último mes por sucursal"' [disabled]="interpreting()" aria-label="Consulta para interpretar" />
                <button type="submit" [disabled]="interpreting() || !interpretDraft.trim()">{{ interpreting() ? 'Interpretando…' : 'Interpretar y filtrar' }}</button>
              </form>
              @if (interpretError()) { <p class="alert error" role="alert">{{ interpretError() }}</p> }
              @if (interpretResult(); as r) {
                <p class="insight-text" role="status">{{ r.respuesta }}</p>
                @if (r.aclaraciones.length) { <ul class="notes">@for (a of r.aclaraciones; track a) { <li>{{ a }}</li> }</ul> }
                <button type="button" class="ghost" (click)="applyInterpreted()">Aplicar vista y filtros interpretados</button>
                @if (viewNote()) { <p class="muted">{{ viewNote() }}</p> }
              }
              <h4>Recomendaciones</h4>
              @if (d.ai_ready) {
                <button type="button" class="ghost" (click)="ask()" [disabled]="thinking()">{{ thinking() ? 'Analizando…' : 'Generar recomendaciones del contexto' }}</button>
                @if (insight()) { <p class="insight-text" role="status">{{ insight() }}</p> }
                @if (insightError()) { <p class="alert error" role="alert">{{ insightError() }}</p> }
              } @else { <p class="empty">La IA explicativa no está configurada; las métricas reales ya están disponibles.</p> }
            </div>
            <div class="ai-col">
              <h4>Explicar una métrica de esta vista</h4>
              <form (ngSubmit)="explain()">
                <input name="e" [(ngModel)]="explainDraft" maxlength="500" placeholder="¿Por qué bajan los pedidos pagados este período?" [disabled]="explaining()" aria-label="Pregunta para explicar" />
                <button type="submit" [disabled]="explaining() || !explainDraft.trim()">{{ explaining() ? 'Analizando…' : 'Explicar' }}</button>
              </form>
              @if (explainError()) { <p class="alert error" role="alert">{{ explainError() }}</p> }
              @if (explanation(); as ex) {
                @if (ex.available && ex.sections) {
                  @for (sec of sectionKeys; track sec) {
                    <div class="explain-sec"><b>{{ sectionLabel(sec) }}</b><p>{{ ex.sections![sec] }}</p></div>
                  }
                } @else if (ex.message) { <p class="insight-text" role="status">{{ ex.message }}</p> }
              }
            </div>
          </div>
        </article>
      }
    </section>`,
  styles: [`
    :host{display:block;min-width:0}.dashboard{display:grid;gap:1rem;margin:1.5rem 0 2rem;min-width:0}.heading{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}.heading h2{font-size:1.65rem;margin:.25rem 0}.muted{font-size:.85rem;margin:.4rem 0;line-height:1.5}
    .eyebrow{font-size:.67rem}.heading-actions{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.export-label{font-size:.78rem;color:#645d55;display:inline-flex;gap:.4rem;align-items:center}
    select.field,.export-label select{font-size:.78rem;padding:.38rem .6rem;border-radius:8px;vertical-align:middle}
    .view-tabs{display:flex;gap:.4rem;flex-wrap:wrap;border-bottom:1px solid #e5ded5;padding-bottom:.6rem}.view-tabs button{font-size:.78rem;padding:.42rem .8rem;border-radius:20px;background:#fff;border:1px solid #e5ded5}.view-tabs button.active{background:#24231f;color:#fff;border-color:#24231f}
    .filters{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center}
    .period-bar{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}.period-bar button{font-size:.75rem;padding:.4rem .8rem;border-radius:20px}.period-bar button.active{background:#24231f;color:#fff;border-color:#24231f}
    .chip-clear{font-size:.75rem;padding:.4rem .8rem;border-radius:20px;background:#f5efe8;border-color:#e5ded5;color:#645d55}
    .metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.85rem}.metrics article,.report{background:#fff;border:1px solid #e5ded5;border-radius:16px;padding:1.15rem;min-width:0}.metrics article{display:grid;gap:.6rem;align-content:start}.metrics span{font-size:.8rem;color:#645d55}.metrics strong{font-size:clamp(1rem,1.8vw,1.5rem);line-height:1.2;overflow-wrap:anywhere}.metrics small{font-size:.73rem;color:#756c62;line-height:1.4}
    .delta{display:inline-block;font-size:.75rem;padding:.15rem .45rem;border-radius:12px;justify-self:start}.delta.good{color:#217A65;background:#e3f1ec}.delta.bad{color:#B93845;background:#fbe6e8}
    .trend-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:1rem;align-items:start}
    .reports{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:1rem;align-items:start}.report h3{font-size:1.1rem;margin:0 0 .45rem}.subheading{margin-top:1.5rem!important}
    .trend-card{display:grid;gap:.6rem}.trend-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap}.trend-heading h3{margin:0 0 .3rem}.trend-badge{font-size:.75rem;font-weight:600;background:#f5efe8;padding:.35rem .7rem;border-radius:20px;white-space:nowrap}
    .alert-big{font-size:2rem;font-weight:700;margin:.3rem 0}.alert-ok{color:#217A65}
    .alert.strip{display:flex;gap:1rem;align-items:center;flex-wrap:wrap;justify-content:space-between;background:#fbe6e8;border:1px solid #f3b6c0;border-radius:16px;padding:1rem 1.15rem}
    .bar-row{display:grid;grid-template-columns:80px minmax(25px,1fr) auto;gap:.65rem;align-items:center;margin:1rem 0;font-size:.73rem}.bar{height:8px;background:#f2eee8;border-radius:5px;overflow:hidden}.bar i{display:block;height:100%;background:#a87954;border-radius:5px}.bar-row b{font-size:.72rem;overflow-wrap:anywhere}
    .rank{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:.65rem;align-items:center;padding:.8rem 0;border-bottom:1px solid #eee8e1;font-size:.83rem}.rank>span{overflow-wrap:anywhere}.rank small{font-weight:400}.position{background:#f5efe8;border-radius:50%;width:26px;height:26px;display:grid;place-items:center}
    .status-row{display:flex;justify-content:space-between;gap:1rem;font-size:.82rem;padding:.45rem 0}.empty{color:#756c62;font-size:.85rem;line-height:1.6;padding:.75rem 0;margin:0}
    .compare-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.compare{display:grid;gap:.3rem}
    .table{border:1px solid #eee8e1;border-radius:12px;overflow:hidden;font-size:.8rem}.row{display:grid;grid-template-columns:minmax(0,2.2fr) minmax(0,1.4fr) 60px 100px 64px;gap:.5rem;padding:.5rem .75rem;align-items:center;border-bottom:1px solid #f2eee8}.row.head{background:#f5efe8;font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.03em}.row:last-child{border-bottom:0}.row span{display:grid;gap:.1rem;overflow-wrap:anywhere}.qty-low{color:#B93845}
    .ai-pad{display:grid;gap:1rem}.ai-head{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap}.ai-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;align-items:start}.ai-col h4{font-size:.9rem;margin:.6rem 0 .5rem}.ai-col form{display:flex;gap:.5rem;flex-wrap:wrap}.ai-col input{flex:1 1 220px;min-width:0}
    .notes{margin:.5rem 0;padding-left:1.2rem;font-size:.82rem;color:#645d55}.insight-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.9rem;line-height:1.7;margin:.5rem 0}.explain-sec{border-top:1px dashed #e5ded5;padding:.55rem 0}.explain-sec b{font-size:.78rem;text-transform:uppercase;color:#645d55}.explain-sec p{font-size:.84rem;line-height:1.6;margin:.2rem 0 0}
    button{min-height:40px;white-space:normal;font-size:.82rem}.button.ghost,button.ghost{background:#fff;border:1px solid #e5ded5;color:#24231f}
    @media(max-width:1000px){.metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.reports,.trend-grid,.ai-grid,.compare-grid{grid-template-columns:1fr}}
    @media(max-width:480px){.heading{align-items:flex-start;flex-direction:column}.heading h2{font-size:1.4rem}.metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem}.metrics article,.report{padding:.85rem;border-radius:12px}.metrics strong{font-size:1.1rem}.bar-row{grid-template-columns:67px minmax(15px,1fr);gap:.4rem}.bar-row b{grid-column:2}.dashboard{gap:.8rem}.row{grid-template-columns:1fr 1fr;grid-auto-rows:auto}.row.head{display:none}}
  `],
})
export class DashboardComponent {
  private service = inject(DashboardService);
  private commerce = inject(CommerceService);
  private catalog = inject(CatalogService);
  data = signal<Dashboard | null>(null);
  loading = signal(false); error = signal('');
  filters = signal<ReportQuery>({});
  compareMode = signal<'previous' | 'year_ago' | 'none'>('previous');
  customFrom = signal(''); customTo = signal('');
  view = signal<ViewId>('resumen');
  views = VIEWS;
  period = signal<Period>('90');
  periods = PERIODS;
  statusOptions = Object.entries(STATUS_LABEL).map(([key, label]) => ({ key, label }));
  branches = signal<Branch[]>([]);
  categories = signal<Entity[]>([]);
  percent = barPercent;
  trendLabel = (trend: string) => TREND_LABEL[trend] ?? trend;
  label = (key: string) => STATUS_LABEL[key] ?? METHOD_LABEL[key] ?? key;
  sectionKeys = ['hallazgo', 'cifras', 'interpretacion', 'accion', 'limitaciones'] as const;
  sectionLabel = (k: string) => ({ hallazgo: 'Hallazgo', cifras: 'Cifras', interpretacion: 'Interpretación', accion: 'Acción sugerida', limitaciones: 'Limitaciones' })[k] ?? k;
  exporting = signal(false); exportError = signal('');
  exportReportSel = signal<ExportReport>('ventas');
  thinking = signal(false); insight = signal(''); insightError = signal('');
  interpretDraft = ''; interpreting = signal(false);
  interpretResult = signal<InterpretResult | null>(null); interpretError = signal('');
  viewNote = signal('');
  explainDraft = ''; explaining = signal(false);
  explanation = signal<ExplainResult | null>(null); explainError = signal('');

  constructor() {
    void this.loadLists();
    void this.load();
  }
  private async loadLists() {
    try {
      this.branches.set(await this.commerce.branches());
      this.categories.set(await firstValueFrom(this.catalog.reference('categories')));
    } catch { /* los filtros de catálogo fallan silenciosamente */ }
  }
  customRange() {
    if (this.customFrom() || this.customTo()) return this.customFrom() || '…inicio' + (this.customTo() ? ' → ' + this.customTo().slice(0, 10) : '');
    return '';
  }
  setView(v: ViewId) {
    this.view.set(v);
    const map: Partial<Record<ViewId, ExportReport>> = {
      inventario: 'existencias', pagos: 'pagos', sucursales: 'sucursales', productos: 'prendas_vendidas', ventas: 'ventas',
    };
    this.exportReportSel.set(map[v] ?? 'ventas');
  }
  setPeriod(p: Period) {
    this.customFrom.set(''); this.customTo.set('');
    this.period.set(p);
    void this.load();
  }
  clearCustom() {
    this.customFrom.set(''); this.customTo.set('');
    void this.load();
  }
  set(key: 'branch_id' | 'category_id' | 'status', value: string) {
    this.filters.update((f) => ({ ...f, [key]: value || (key === 'status' ? undefined : null) }));
    void this.load();
  }
  private baseQuery(): ReportQuery {
    const f = this.filters();
    const q: ReportQuery = {
      branch_id: f.branch_id ?? null,
      category_id: f.category_id ?? null,
      status: f.status || undefined,
      low_stock_lt: f.low_stock_lt,
    };
    if (this.customFrom() || this.customTo()) {
      q.date_from = this.customFrom() || undefined;
      q.date_to = this.customTo() || undefined;
      return q;
    }
    const period = this.period();
    if (period === 'ytd') {
      const from = new Date();
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      q.date_from = from.toISOString();
      return q;
    }
    const days = { '30': 30, '90': 90, '365': 365, all: undefined }[period];
    if (days) {
      const from = new Date();
      from.setDate(from.getDate() - days);
      q.date_from = from.toISOString();
    }
    return q;
  }
  /** Contexto visible: el query con el que el servidor recalculó las métricas actuales. */
  appliedQuery = signal<ReportQuery>({});
  private seq = 0;
  async load() {
    const id = ++this.seq;
    this.loading.set(true); this.error.set('');
    const q = this.baseQuery();
    try {
      const data = await firstValueFrom(this.service.load(q));
      if (id !== this.seq) return;
      this.data.set(data);
      this.appliedQuery.set(q);
      this.viewNote.set('');
    } catch (error) {
      if (id !== this.seq) return;
      this.error.set(errorMessage(error));
    } finally {
      if (id === this.seq) this.loading.set(false);
    }
  }
  salesMax() { return Math.max(0, ...(this.data()?.daily_sales.map(d => Number(d.total)) ?? [])); }
  reservationsTotal() { return (this.data()?.reservations_by_status ?? []).reduce((sum, r) => sum + r.count, 0); }
  lowStockThreshold() { return 5; }
  statuses(d: Dashboard) {
    return Object.entries(d.by_status ?? {}).map(([key, count]) => ({ key, count, label: STATUS_LABEL[key] ?? key }));
  }
  statusPie(d: Dashboard): PieSlice[] {
    return this.statuses(d).map((s) => ({ label: s.label, value: s.count }));
  }
  paymentPie(d: Dashboard): PieSlice[] {
    return (d.payment_methods ?? []).map((m) => ({ label: this.label(m.method), value: m.orders }));
  }
  comp() {
    const c = this.data()?.comparison;
    const mode = this.compareMode();
    if (!c || !c.available || mode === 'none') return null;
    return c[mode] ?? null;
  }
  compareNote() {
    return this.data()?.comparison?.note ?? '';
  }
  good(v: number | null | undefined) { return v === null || v === undefined || v >= 0; }
  delta(v: number | null | undefined) {
    if (v === null || v === undefined) return 'Sin base comparable';
    const sign = v > 0 ? '+' : '';
    return `${sign}${(v * 100).toFixed(1)}%`;
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
  monthlyBars(): BarChartItem[] { return (this.data()?.monthly_sales ?? []).map((m) => ({ label: this.monthLabel(m.month), value: m.total })); }
  categoryBars(): BarChartItem[] { return (this.data()?.category_breakdown ?? []).map((c) => ({ label: c.category, value: c.total })); }
  branchBars(): BarChartItem[] { return (this.data()?.branch_performance ?? []).map((b) => ({ label: b.branch, value: b.total })); }
  weekdayBars(): BarChartItem[] { return (this.data()?.weekday_distribution ?? []).map((w) => ({ label: w.weekday, value: w.total })); }
  hourBars(): BarChartItem[] { return (this.data()?.hourly_distribution ?? []).map((h) => ({ label: h.hour + ':00', value: h.total })); }
  async exportReport(format: 'xlsx' | 'csv') {
    if (this.exporting()) return;
    this.exporting.set(true); this.exportError.set('');
    try {
      const blob = await firstValueFrom(this.service.exportUrl(this.exportReportSel(), format, this.appliedQuery()));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `fashionstore_report.${format}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error: any) {
      this.exportError.set(errorMessage(error));
    } finally { this.exporting.set(false); }
  }
  async ask() {
    if (this.thinking() || !this.data()?.ai_ready) return;
    this.thinking.set(true); this.insightError.set(''); this.insight.set('');
    try { this.insight.set((await firstValueFrom(this.service.insights(this.appliedQuery()))).message); }
    catch (error) { this.insightError.set(errorMessage(error)); }
    finally { this.thinking.set(false); }
  }
  async interpret() {
    const text = this.interpretDraft.trim();
    if (!text || this.interpreting()) return;
    this.interpreting.set(true); this.interpretError.set('');
    try {
      const r = await firstValueFrom(this.service.interpret(text, this.appliedQuery()));
      this.interpretResult.set(r);
      this.viewNote.set(r.ok ? 'Vista detectada: ' + r.vista : '');
    } catch (error) { this.interpretError.set(errorMessage(error)); }
    finally { this.interpreting.set(false); }
  }
  applyInterpreted() {
    const r = this.interpretResult();
    if (!r) return;
    const f = r.filtros;
    this.filters.update((prev) => ({ ...prev, branch_id: f.branch_id ?? null, category_id: f.category_id ?? null, status: f.status ?? '' }));
    if (f.date_from) this.customFrom.set(f.date_from);
    if (f.date_to) this.customTo.set(f.date_to);
    const map: Record<string, ViewId> = { productos_inventario: 'inventario', sucursales: 'sucursales', comparativas: 'comparativas', reservas: 'reservas' };
    const target = map[r.vista];
    if (target) this.setView(target);
    this.viewNote.set('');
    r.aclaraciones.length
      ? this.viewNote.set('Aclaraciones: ' + r.aclaraciones.join(' '))
      : this.viewNote.set(r.respuesta || 'Filtros aplicados.');
    void this.load();
  }
  async explain() {
    const text = this.explainDraft.trim();
    if (!text || this.explaining()) return;
    this.explaining.set(true); this.explainError.set('');
    try {
      this.explanation.set(await firstValueFrom(this.service.explain(text, this.appliedQuery())));
    } catch (error) { this.explainError.set(errorMessage(error)); }
    finally { this.explaining.set(false); }
  }
}