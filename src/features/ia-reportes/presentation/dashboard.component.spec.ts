import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpResponse, HttpHeaders } from '@angular/common/http';
import { DashboardComponent } from './dashboard.component';
import { DashboardService } from '../infrastructure/dashboard.service';
import { Dashboard } from '../domain/dashboard';
describe('Centro de reportes', () => {
  const empty: Dashboard = {
    orders: 0, paid_orders: 0, pending_orders: 0, revenue: '0', currency: 'BOB', products: 0, customers: 0,
    low_stock: 0, by_status: {}, daily_sales: [], top_products: [], stripe_ready: false, ai_ready: false,
    average_ticket: '0', cancellation_rate: 0, monthly_sales: [], hourly_distribution: [], weekday_distribution: [],
    category_breakdown: [], branch_performance: [],
    projection: { dates: [], values: [], trend: 'stable', meta: { method: 'regresion lineal', horizon_days: 7 } },
    meta: { period: { from: null, to: null }, timezone: 'America/La_Paz', currency: 'BOB', generated_at: new Date().toISOString(), coverage: 'todo el historial', note: '' },
    period: { orders: 0, paid_orders: 0, pending_orders: 0, revenue: '0', units_sold: 0, ticket_avg: '0', cancellation_rate: 0 },
    units_sold: 0,
    comparison: { available: false, mode: 'none', note: '', previous: null, year_ago: null },
    low_stock_variants: [], reservations_by_status: [], payment_methods: [],
  };
  it('muestra el vacío real sin inventar ventas y no llama IA automáticamente', async () => {
    const insights = vi.fn();
    TestBed.configureTestingModule({ imports: [DashboardComponent], providers: [{ provide: DashboardService, useValue: { load: () => of(empty), insights } }] });
    const fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay prendas vendidas');
    expect(fixture.nativeElement.textContent).toContain('Ninguna variante está bajo el umbral');
    await fixture.componentInstance.ask();
    expect(insights).not.toHaveBeenCalled();
  });
  it('vuelve a pedir datos con el date_from del período elegido y sin ventana en "Todo"', async () => {
    const load = vi.fn().mockReturnValue(of(empty));
    TestBed.configureTestingModule({ imports: [DashboardComponent], providers: [{ provide: DashboardService, useValue: { load, insights: vi.fn() } }] });
    const fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable(); fixture.detectChanges();
    expect(load).toHaveBeenCalledTimes(1);
    const initialArg = load.mock.calls[0][0] as { date_from?: string };
    expect(new Date(initialArg.date_from!).getTime()).toBeLessThan(Date.now());
    fixture.componentInstance.setPeriod('30');
    await fixture.whenStable(); fixture.detectChanges();
    expect(load).toHaveBeenCalledTimes(2);
    const narrowerArg = load.mock.calls[1][0] as { date_from?: string };
    expect(new Date(narrowerArg.date_from!).getTime()).toBeGreaterThan(new Date(initialArg.date_from!).getTime());
    fixture.componentInstance.setPeriod('all');
    await fixture.whenStable(); fixture.detectChanges();
    expect((load.mock.calls[2][0] as { date_from?: string }).date_from).toBeUndefined();
  });
  it('mantiene un único panel activo al recorrer gráficos, tablas e IA', async () => {
    const insights=vi.fn();
    TestBed.configureTestingModule({imports:[DashboardComponent],providers:[{provide:DashboardService,useValue:{load:()=>of(empty),insights}}]});
    const fixture=TestBed.createComponent(DashboardComponent);
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[role="tabpanel"]').length).toBe(1);
    fixture.componentInstance.setSlide(1); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.metrics')).toBeNull();
    expect(fixture.nativeElement.querySelector('fs-data-table')).not.toBeNull();
    fixture.componentInstance.setSlide(2); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('fs-data-table')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Esta sección no entrena modelos');
    expect(insights).not.toHaveBeenCalled();
  });
  it('el carrusel de gráficos cambia el grupo sin perder el período ni recargar datos', async () => {
    const load=vi.fn().mockReturnValue(of(empty));
    TestBed.configureTestingModule({imports:[DashboardComponent],providers:[{provide:DashboardService,useValue:{load}}]});
    const fixture=TestBed.createComponent(DashboardComponent);
    await fixture.whenStable(); fixture.detectChanges();
    const query=fixture.componentInstance.appliedQuery();
    fixture.componentInstance.setChart(2); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('fs-pie-chart').length).toBe(4);
    expect(fixture.nativeElement.querySelector('fs-trend-chart')).toBeNull();
    expect(fixture.componentInstance.appliedQuery()).toEqual(query);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('rechaza un rango invertido y envía límites completos de los días de Bolivia', async () => {
    const load=vi.fn().mockReturnValue(of(empty));
    TestBed.configureTestingModule({imports:[DashboardComponent],providers:[{provide:DashboardService,useValue:{load}}]});
    const fixture=TestBed.createComponent(DashboardComponent);
    await fixture.whenStable();
    const c=fixture.componentInstance;
    c.rangeFrom='2026-09-17'; c.rangeTo='2026-09-01'; c.applyDates();
    expect(c.rangeError()).toBeTruthy(); expect(load).toHaveBeenCalledTimes(1);
    c.rangeTo='2026-09-18'; c.applyDates();
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({date_from:'2026-09-17T00:00:00-04:00',date_to:'2026-09-18T23:59:59.999-04:00'}));
  });
  it('permite cambiar las pestañas con teclado y conserva el foco', async () => {
    TestBed.configureTestingModule({imports:[DashboardComponent],providers:[{provide:DashboardService,useValue:{load:()=>of(empty)}}]});
    const fixture=TestBed.createComponent(DashboardComponent); await fixture.whenStable(); fixture.detectChanges();
    const tabs=fixture.nativeElement.querySelectorAll('[role="tab"]');
    tabs[0].focus(); tabs[0].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true})); fixture.detectChanges();
    expect(fixture.componentInstance.slide()).toBe(2);
    expect(document.activeElement).toBe(tabs[2]);
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
  });
  it('presenta error recuperable sin sustituirlo por métricas ficticias', async () => {
    TestBed.configureTestingModule({ imports: [DashboardComponent], providers: [{ provide: DashboardService, useValue: { load: () => throwError(() => new Error('Servidor no disponible')) } }] });
    const fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Servidor no disponible');
    expect(fixture.nativeElement.querySelector('.metrics')).toBeNull();
    expect(fixture.componentInstance.loading()).toBe(false);
  });
  it('deshabilita exportar sin selección y no llama a la exportación múltiple', async () => {
    TestBed.configureTestingModule({ imports: [DashboardComponent], providers: [{ provide: DashboardService, useValue: { load: () => of(empty), insights: vi.fn(), exportMultiple: vi.fn() } }] });
    const fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable(); fixture.detectChanges();
    fixture.componentInstance.exportOpen.set(true);
    fixture.componentInstance.selReports.set([]);
    fixture.detectChanges();
    const excel = Array.from(fixture.nativeElement.querySelectorAll('button') as HTMLButtonElement[]).find((b) => b.textContent?.trim() === 'Excel');
    expect(excel?.disabled).toBe(true);
    await fixture.componentInstance.exportMultiple('xlsx');
    const service = TestBed.inject(DashboardService) as unknown as { exportMultiple: ReturnType<typeof vi.fn> };
    expect(service.exportMultiple).not.toHaveBeenCalled();
  });
  it('exporta varios reportes en una sola solicitud con los filtros visibles y avisa truncamiento', async () => {
    const exportMultiple = vi.fn().mockReturnValue(of(new HttpResponse({
      body: new Blob(['pdf']),
      headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="fashionstore_reportes_20260916_100000.pdf"', 'X-Export-Truncated': 'true' }),
    })));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    TestBed.configureTestingModule({ imports: [DashboardComponent], providers: [{ provide: DashboardService, useValue: { load: () => of(empty), insights: vi.fn(), exportMultiple } }] });
    const fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable(); fixture.detectChanges();
    fixture.componentInstance.selReports.set(['ventas', 'pedidos']);
    await fixture.componentInstance.exportMultiple('pdf');
    const called = exportMultiple.mock.calls[0];
    expect(called[0]).toEqual(['ventas', 'pedidos']);
    expect(called[1]).toBe('pdf');
    expect(fixture.componentInstance.multiDone()).toContain('2 reportes exportados');
    expect(fixture.componentInstance.multiDone()).toContain('Advertencia');
  });
});
