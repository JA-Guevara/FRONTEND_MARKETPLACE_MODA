import {TrendChartComponent} from './trend-chart.component';
describe('Escala temporal de gráficos',()=>{
  it('conserva la distancia entre fechas con días intermedios ausentes',()=>{
    const c=new TrendChartComponent();c.actual=[{label:'2026-09-01',value:10},{label:'2026-09-02',value:20},{label:'2026-09-11',value:30}];
    expect(c.x(1)-c.x(0)).toBeCloseTo((c.x(2)-c.x(0))/10);
  });
  it('comparte escala y conecta la proyección con el último dato real',()=>{
    const c=new TrendChartComponent();c.actual=[{label:'2026-09-01',value:0},{label:'2026-09-02',value:20}];c.projected=[{label:'2026-09-03',value:100}];
    expect(c.maxValue()).toBe(100);expect(c.projectedPoints().split(' ')[0]).toBe(c.actualPoints().split(' ').at(-1));
    expect(c.actualPoints()).not.toMatch(/NaN|Infinity/);
  });
});
