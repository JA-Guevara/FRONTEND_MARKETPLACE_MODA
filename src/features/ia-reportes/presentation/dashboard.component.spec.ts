import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { DashboardService } from '../infrastructure/dashboard.service';
import { Dashboard } from '../domain/dashboard';
describe('Dashboard comercial', () => {
  const empty: Dashboard = { orders:0,paid_orders:0,pending_orders:0,revenue:'0',currency:'BOB',products:0,customers:0,low_stock:0,by_status:{},daily_sales:[],top_products:[],stripe_ready:false,ai_ready:false,
    average_ticket:'0',cancellation_rate:0,monthly_sales:[],hourly_distribution:[],weekday_distribution:[],category_breakdown:[],branch_performance:[],projection:{dates:[],values:[],trend:'stable'} };
  it('muestra el vacío real sin inventar ventas y no llama IA automáticamente', async () => {
    const insights = vi.fn();
    TestBed.configureTestingModule({imports:[DashboardComponent],providers:[{provide:DashboardService,useValue:{load:()=>of(empty),insights}}]});
    const fixture=TestBed.createComponent(DashboardComponent);
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay prendas vendidas');
    expect(fixture.nativeElement.textContent).toContain('Sin pedidos registrados');
    await fixture.componentInstance.ask();
    expect(insights).not.toHaveBeenCalled();
  });
  it('vuelve a pedir datos con el date_from del período elegido', async () => {
    const load = vi.fn().mockReturnValue(of(empty));
    TestBed.configureTestingModule({imports:[DashboardComponent],providers:[{provide:DashboardService,useValue:{load,insights:vi.fn()}}]});
    const fixture=TestBed.createComponent(DashboardComponent);
    await fixture.whenStable(); fixture.detectChanges();
    expect(load).toHaveBeenCalledTimes(1);
    const initialArg = load.mock.calls[0][0] as string;
    expect(new Date(initialArg).getTime()).toBeLessThan(Date.now());
    fixture.componentInstance.setPeriod('30');
    await fixture.whenStable(); fixture.detectChanges();
    expect(load).toHaveBeenCalledTimes(2);
    const narrowerArg = load.mock.calls[1][0] as string;
    expect(new Date(narrowerArg).getTime()).toBeGreaterThan(new Date(initialArg).getTime());
    fixture.componentInstance.setPeriod('all');
    await fixture.whenStable(); fixture.detectChanges();
    expect(load).toHaveBeenNthCalledWith(3, undefined);
  });
  it('presenta error recuperable sin sustituirlo por métricas ficticias', async () => {
    TestBed.configureTestingModule({imports:[DashboardComponent],providers:[{provide:DashboardService,useValue:{load:()=>throwError(()=>new Error('Servidor no disponible'))}}]});
    const fixture=TestBed.createComponent(DashboardComponent);
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Servidor no disponible');
    expect(fixture.nativeElement.querySelector('.metrics')).toBeNull();
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
