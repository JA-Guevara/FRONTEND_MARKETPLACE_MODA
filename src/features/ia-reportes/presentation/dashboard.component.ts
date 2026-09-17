import { Component, effect, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe, PercentPipe, DatePipe } from '@angular/common';
import { IconComponent } from '../../../shared/icon.component';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { DashboardService } from '../infrastructure/dashboard.service';
import { Dashboard, ExportReport, ReportQuery, InterpretResult, ExplainResult } from '../domain/dashboard';
import { TrendChartComponent, TrendPoint } from './trend-chart.component';
import { BarChartComponent, BarChartItem } from './bar-chart.component';
import { PieChartComponent, PieSlice } from './pie-chart.component';
import { DataTableComponent } from './data-table.component';
import { errorMessage } from '../../../shared/errors';
import { AssistantContextService } from '../../../shared/assistant-context.service';
import { CommerceService } from '../../ventas-pagos/infrastructure/commerce.service';
import { Branch } from '../../ventas-pagos/domain/commerce.models';
import { CatalogService } from '../../usuarios-catalogo/infrastructure/catalog.service';
import { Entity } from '../../usuarios-catalogo/domain/catalog.models';
import { queryForCommand } from '../../ventas-pagos/application/assistant-intent';

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
  shipped: 'En camino', delivered: 'Entregado', cancelled: 'Cancelado', expired: 'Vencido',
};
const METHOD_LABEL: Record<string, string> = { stripe: 'Stripe', manual: 'Manual', cash: 'Efectivo', transfer: 'Transferencia' };
const ALL_REPORTS: ExportReport[] = ['ventas', 'pedidos', 'pagos', 'prendas_vendidas', 'existencias', 'sucursales'];
/** A qué slide del carrusel saltar cuando la IA interpreta una consulta como
 * referida a esa "vista" (el backend sigue devolviendo el mismo vocabulario
 * de siempre; acá solo se traduce a gráficos (0) o tablas (1)). */
const VISTA_SLIDE: Record<string, 0 | 1> = {
  sucursales: 0, comparativas: 0, productos_inventario: 1, reservas: 1,
};

@Component({
  selector: 'fs-dashboard',
  imports: [
    CurrencyPipe, DecimalPipe, PercentPipe, DatePipe, FormsModule,
    TrendChartComponent, BarChartComponent, PieChartComponent, DataTableComponent, IconComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private service = inject(DashboardService);
  private commerce = inject(CommerceService);
  private catalog = inject(CatalogService);
  private assistantContext = inject(AssistantContextService);
  data = signal<Dashboard | null>(null);
  loading = signal(false); error = signal('');
  filters = signal<ReportQuery>({});
  compareMode = signal<'previous' | 'year_ago' | 'none'>('previous');
  customFrom = signal(''); customTo = signal('');
  slide = signal<0 | 1 | 2>(0);
  chartSlide = signal(0);
  readonly sections = ['Gráficos', 'Tablas', 'Análisis IA'];
  readonly chartSections = ['Ventas y evolución', 'Distribución y horarios', 'Operación y catálogo'];
  tableKind = signal('daily');
  readonly tableOptions = [
    {key:'daily', label:'Ventas diarias'}, {key:'products', label:'Prendas vendidas'},
    {key:'monthly', label:'Ventas mensuales'}, {key:'categories', label:'Categorías'},
    {key:'branches', label:'Sucursales'}, {key:'hours', label:'Horas'}, {key:'weekdays', label:'Días de la semana'},
    {key:'orders', label:'Estado de pedidos'}, {key:'payments', label:'Métodos de pago'},
    {key:'reservations', label:'Reservas'}, {key:'stock', label:'Stock bajo'},
  ];
  rangeFrom = ''; rangeTo = '';
  rangeError = signal('');
  setChart(n: number) { this.chartSlide.set(Math.max(0, Math.min(2, n))); }
  moveSlide(step: number) { this.setSlide(Math.max(0, Math.min(2, this.slide() + step)) as 0 | 1 | 2); }
  tabKey(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    this.setSlide(event.key === 'Home' ? 0 : event.key === 'End' ? 2 : ((this.slide() + (event.key === 'ArrowRight' ? 1 : 2)) % 3) as 0 | 1 | 2);
    (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')[this.slide()]?.focus();
  }
  applyDates() {
    if ((!this.rangeFrom && !this.rangeTo) || (this.rangeFrom && this.rangeTo && this.rangeFrom > this.rangeTo)) {
      this.rangeError.set('Elegí un rango válido; la fecha inicial no puede superar la final.'); return;
    }
    this.rangeError.set('');
    this.customFrom.set(this.rangeFrom ? this.rangeFrom + 'T00:00:00-04:00' : '');
    this.customTo.set(this.rangeTo ? this.rangeTo + 'T23:59:59.999-04:00' : '');
    void this.load();
  }
  cumulativeTrend(): TrendPoint[] {
    let total = 0;
    return this.actualTrend().map(p => ({ label: p.label, value: total += p.value }));
  }
  productBars(): BarChartItem[] { return (this.data()?.top_products ?? []).map(p => ({label:p.name, value:p.quantity})); }
  reservationPie(d: Dashboard): PieSlice[] { return d.reservations_by_status.map(r => ({label:this.label(r.status), value:r.count})); }
  tableData(d: Dashboard): {headers: string[]; rows: (string | number)[][]} {
    switch(this.tableKind()) {
      case 'products': return {headers:['Prenda','Unidades'], rows:d.top_products.map(p=>[p.name,p.quantity])};
      case 'monthly': return {headers:['Mes','Ingresos ('+d.currency+')','Pedidos'],rows:d.monthly_sales.map(m=>[m.month,Number(m.total),m.orders])};
      case 'categories': return {headers:['Categoría','Ingresos ('+d.currency+')','Unidades'],rows:d.category_breakdown.map(c=>[c.category,Number(c.total),c.quantity])};
      case 'branches': return {headers:['Sucursal','Ingresos ('+d.currency+')','Pedidos'],rows:d.branch_performance.map(b=>[b.branch,Number(b.total),b.orders])};
      case 'hours': return {headers:['Hora','Ingresos ('+d.currency+')','Pedidos'],rows:d.hourly_distribution.map(h=>[h.hour+':00',Number(h.total),h.orders])};
      case 'weekdays': return {headers:['Día','Ingresos ('+d.currency+')','Pedidos'],rows:d.weekday_distribution.map(w=>[w.weekday,Number(w.total),w.orders])};
      case 'orders': return {headers:['Estado','Pedidos'],rows:this.statuses(d).map(s=>[s.label,s.count])};
      case 'payments': return {headers:['Medio','Pedidos'],rows:d.payment_methods.map(m=>[this.label(m.method),m.orders])};
      case 'reservations': return {headers:['Estado','Reservas'],rows:d.reservations_by_status.map(r=>[this.label(r.status),r.count])};
      case 'stock': return {headers:['Prenda','SKU','Sucursal','Talla','Color','Stock'],rows:d.low_stock_variants.map(v=>[v.name,v.sku,v.branch,v.size,v.color,v.quantity])};
      default: return {headers:['Fecha','Ingresos ('+d.currency+')'],rows:d.daily_sales.map(day=>[day.date,Number(day.total)])};
    }
  }
  period = signal<Period>('90');
  periods = PERIODS;
  statusOptions = Object.entries(STATUS_LABEL).map(([key, label]) => ({ key, label }));
  branches = signal<Branch[]>([]);
  categories = signal<Entity[]>([]);
  trendLabel = (trend: string) => TREND_LABEL[trend] ?? trend;
  label = (key: string) => STATUS_LABEL[key] ?? METHOD_LABEL[key] ?? ({confirmed:'Confirmada', pending:'Pendiente', completed:'Completada', no_show:'No asistió'} as Record<string,string>)[key] ?? key;
  sectionKeys = ['hallazgo', 'cifras', 'interpretacion', 'accion', 'limitaciones'] as const;
  sectionLabel = (k: string) => ({ hallazgo: 'Hallazgo', cifras: 'Cifras', interpretacion: 'Interpretación', accion: 'Acción sugerida', limitaciones: 'Limitaciones' })[k] ?? k;
  exporting = signal(false); exportError = signal('');
  exportReportSel = signal<ExportReport>('ventas');
  exportOpen = signal(false);
  selReports = signal<ExportReport[]>([]);
  multiExporting = signal(false); multiError = signal(''); multiDone = signal('');
  exportOptions = ALL_REPORTS.map((value) => ({ value, label: ({ ventas: 'Ventas', pedidos: 'Pedidos', pagos: 'Pagos', prendas_vendidas: 'Prendas vendidas', existencias: 'Existencias', sucursales: 'Sucursales' })[value] }));
  thinking = signal(false); insight = signal(''); insightError = signal('');
  interpretDraft = ''; interpreting = signal(false);
  interpretResult = signal<InterpretResult | null>(null); interpretError = signal('');
  viewNote = signal('');
  explainDraft = ''; explaining = signal(false);
  explanation = signal<ExplainResult | null>(null); explainError = signal('');

  constructor() {
    effect(() => {
      const request = this.assistantContext.applyRequest();
      if (!request) return;
      this.assistantContext.consumeApply();
      this.applyFilterQuery(request.query);
    });
    void this.loadLists();
    void this.load();
  }
  /** Aplica en la pantalla un query pedido desde el chat (asistente): actualiza
   * los selects y el rango de fechas visibles y recalcula con esos filtros. */
  private applyFilterQuery(q: ReportQuery) {
    this.setSlide(0);
    this.filters.update((f) => ({
      ...f,
      branch_id: q.branch_id ?? null,
      category_id: q.category_id ?? null,
      status: q.status || undefined,
      low_stock_lt: q.low_stock_lt,
    }));
    this.customFrom.set(q.date_from ?? '');
    this.customTo.set(q.date_to ?? '');
    if (!q.date_from && !q.date_to) this.period.set('all');
    void this.load();
  }
  private async loadLists() {
    try {
      this.branches.set(await this.commerce.branches());
      this.categories.set(await firstValueFrom(this.catalog.reference('categories')));
    } catch { /* los filtros de catálogo fallan silenciosamente */ }
  }
  customRange() {
    if (this.customFrom() || this.customTo()) return (this.customFrom().slice(0, 10) || 'Inicio') + ' → ' + (this.customTo().slice(0, 10) || 'Hoy');
    return '';
  }
  setSlide(n: 0 | 1 | 2) {
    this.slide.set(n);
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
      this.assistantContext.setReport(q);
      this.viewNote.set('');
    } catch (error) {
      if (id !== this.seq) return;
      this.error.set(errorMessage(error));
    } finally {
      if (id === this.seq) this.loading.set(false);
    }
  }
  reservationsTotal() { return (this.data()?.reservations_by_status ?? []).reduce((sum, r) => sum + r.count, 0); }
  lowStockThreshold() { return this.appliedQuery().low_stock_lt ?? 5; }
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
  private dateLabel(iso: string): string {
    return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  private money(v: number | string, currency: string): string {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(v) || 0);
  }
  private num(v: number | string): string {
    return new Intl.NumberFormat('es-BO').format(Number(v) || 0);
  }
  monthlyBars(): BarChartItem[] { return (this.data()?.monthly_sales ?? []).map((m) => ({ label: this.monthLabel(m.month), value: m.total })); }
  categoryBars(): BarChartItem[] { return (this.data()?.category_breakdown ?? []).map((c) => ({ label: c.category, value: c.total })); }
  branchBars(): BarChartItem[] { return (this.data()?.branch_performance ?? []).map((b) => ({ label: b.branch, value: b.total })); }
  weekdayBars(): BarChartItem[] { return (this.data()?.weekday_distribution ?? []).map((w) => ({ label: w.weekday, value: w.total })); }
  hourBars(): BarChartItem[] { return (this.data()?.hourly_distribution ?? []).map((h) => ({ label: h.hour + ':00', value: h.total })); }
  dailySalesRows(d: Dashboard): (string | number)[][] { return d.daily_sales.map((day) => [this.dateLabel(day.date), this.money(day.total, d.currency)]); }
  topProductsRows(d: Dashboard): (string | number)[][] { return d.top_products.map((p, i) => [i + 1, p.name, `${this.num(p.quantity)} uds.`]); }
  statusRows(d: Dashboard): (string | number)[][] { return this.statuses(d).map((s) => [s.label, this.num(s.count)]); }
  reservationRows(d: Dashboard): (string | number)[][] { return d.reservations_by_status.map((r) => [this.label(r.status), this.num(r.count)]); }
  paymentRows(d: Dashboard): (string | number)[][] { return (d.payment_methods ?? []).map((m) => [this.label(m.method), this.num(m.orders)]); }
  categoryRows(d: Dashboard): (string | number)[][] { return (d.category_breakdown ?? []).map((c) => [c.category, this.money(c.total, d.currency)]); }
  branchRows(d: Dashboard): (string | number)[][] { return (d.branch_performance ?? []).map((b) => [b.branch, this.money(b.total, d.currency)]); }
  hourRows(d: Dashboard): (string | number)[][] { return (d.hourly_distribution ?? []).map((h) => [`${h.hour}:00`, this.money(h.total, d.currency)]); }
  weekdayRows(d: Dashboard): (string | number)[][] { return (d.weekday_distribution ?? []).map((w) => [w.weekday, this.money(w.total, d.currency)]); }
  monthlyRows(d: Dashboard): (string | number)[][] { return (d.monthly_sales ?? []).map((m) => [this.monthLabel(m.month), this.money(m.total, d.currency)]); }
  async exportReport(format: 'xlsx' | 'csv') {
    if (this.exporting()) return;
    this.exporting.set(true); this.exportError.set('');
    try {
      const blob = await firstValueFrom(this.service.exportUrl(this.exportReportSel(), format, this.appliedQuery()));
      this.downloadBlob(blob, `fashionstore_report.${format}`);
    } catch (error: any) {
      this.exportError.set(errorMessage(error));
    } finally { this.exporting.set(false); }
  }
  toggleReport(value: ExportReport, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selReports.update((sel) => (checked ? (sel.includes(value) ? sel : [...sel, value]) : sel.filter((r) => r !== value)));
  }
  selectAll() { this.selReports.set(ALL_REPORTS); }
  /** Resumen honesto de los filtros VISIBLES con los que el servidor calculó las
   * métricas; también son los que recibe la exportación múltiple. */
  exportSummary() {
    const q = this.appliedQuery();
    const parts: string[] = [];
    if (q.date_from || q.date_to) {
      parts.push(q.date_from ? 'desde ' + q.date_from.slice(0, 10) : 'desde el inicio');
      if (q.date_to) parts.push('hasta ' + q.date_to.slice(0, 10));
    } else {
      parts.push('todo el historial');
    }
    if (q.branch_id) parts.push('sucursal: ' + (this.branches().find((b) => b.id === q.branch_id)?.name ?? q.branch_id));
    if (q.category_id) parts.push('categoría: ' + ((this.categories().find((c) => c.id === q.category_id) as any)?.['name'] ?? q.category_id));
    if (q.status) parts.push('estado: ' + (STATUS_LABEL[q.status] ?? q.status));
    return parts.join(' · ');
  }
  async exportMultiple(format: 'xlsx' | 'pdf' | 'csv') {
    const reports = this.selReports();
    if (!reports.length || this.multiExporting()) return;
    this.multiExporting.set(true); this.multiError.set(''); this.multiDone.set('');
    try {
      const response = await firstValueFrom(this.service.exportMultiple(reports, format, this.appliedQuery()));
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `fashionstore_reportes.${format}`;
      const truncated = response.headers.get('X-Export-Truncated') === 'true';
      this.downloadBlob(response.body as Blob, filename);
      this.multiDone.set(
        `${reports.length} ${reports.length === 1 ? 'reporte exportado' : 'reportes exportados'} (${format.toUpperCase()}, con los filtros visibles).` +
        (truncated ? ' Advertencia: se aplicó el límite de filas por reporte; revisa el detalle en el archivo.' : ''),
      );
    } catch (error: any) {
      this.multiError.set(errorMessage(error));
    } finally { this.multiExporting.set(false); }
  }
  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    if (!r || !r.ok) return;
    const f = queryForCommand(this.interpretDraft, r.filtros, this.appliedQuery());
    this.filters.update((prev) => ({ ...prev, branch_id: f.branch_id ?? null, category_id: f.category_id ?? null, status: f.status ?? '', low_stock_lt: f.low_stock_lt }));
    this.customFrom.set(f.date_from ?? '');
    this.customTo.set(f.date_to ?? '');
    if (!f.date_from && !f.date_to) this.period.set('all');
    const target = VISTA_SLIDE[r.vista];
    if (target !== undefined) this.setSlide(target);
    if (r.vista === 'sucursales' || r.vista === 'comparativas') this.setChart(1);
    if (r.vista === 'productos_inventario') this.tableKind.set('stock');
    if (r.vista === 'reservas') this.tableKind.set('reservations');
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
