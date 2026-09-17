import { Component, Input } from '@angular/core';
export interface TrendPoint { label:string; value:number; }
@Component({
  selector:'fs-trend-chart',
  template:`
    @if(actual.length>1) {
      <svg viewBox="0 0 600 230" role="img" [attr.aria-label]="ariaLabel">
        @for (fraction of [0,0.5,1]; track fraction) {
          <line x1="54" x2="584" [attr.y1]="y(maxValue()*fraction)" [attr.y2]="y(maxValue()*fraction)" stroke="#eae4e1" stroke-dasharray="3 4" />
          <text x="47" [attr.y]="y(maxValue()*fraction)+4" text-anchor="end" class="tick">{{ short(maxValue()*fraction) }}</text>
        }
        <polygon [attr.points]="areaPoints()" fill="#74394e" opacity=".07" />
        <polyline [attr.points]="actualPoints()" fill="none" stroke="#74394e" stroke-width="2.5" stroke-linejoin="round" />
        @for (p of actual; track $index; let i=$index) {
          <circle [attr.cx]="x(i)" [attr.cy]="y(p.value)" r="3" fill="#74394e"><title>{{ p.label }} · {{ p.value }} {{ currency }}</title></circle>
        }
        @if(projected.length) {
          <polyline [attr.points]="projectedPoints()" fill="none" stroke="#267c78" stroke-width="2.5" stroke-dasharray="6 5" />
          @for (p of projected; track $index; let i=$index) { <circle [attr.cx]="x(actual.length+i)" [attr.cy]="y(p.value)" r="3" fill="#267c78"><title>Estimación {{ p.label }} · {{ p.value }} {{ currency }}</title></circle> }
        }
        <text x="54" y="217" class="tick">{{ actual[0].label.slice(0,10) }}</text>
        <text x="584" y="217" text-anchor="end" class="tick">{{ lastLabel() }}</text>
      </svg>
      <div class="legend"><span><i></i>Real · {{ currency }}</span>@if(projected.length) { <span><i class="projected"></i>Proyección orientativa</span> }</div>
    } @else { <p class="empty">Todavía no hay suficientes datos para graficar una tendencia.</p> }
  `,
  styles:[`:host{display:block;min-width:0}svg{width:100%;height:auto;max-height:260px;display:block}.tick{font-size:11px;fill:#706b68}.legend{display:flex;flex-wrap:wrap;gap:16px;font-size:.73rem;color:#706b68;margin-top:8px}.legend span{display:flex;align-items:center;gap:6px}i{width:17px;border-top:3px solid #74394e}i.projected{border-color:#267c78;border-top-style:dashed}.empty{color:#756c62;font-size:.85rem;line-height:1.6}`],
})
export class TrendChartComponent {
  @Input() actual:TrendPoint[]=[];
  @Input() projected:TrendPoint[]=[];
  @Input() ariaLabel='Gráfico de tendencia';
  @Input() currency='BOB';
  private points() { return [...this.actual,...this.projected]; }
  maxValue() { return Math.max(1,...this.points().map(p=>Number.isFinite(p.value) ? p.value : 0)); }
  y(value:number) { return 190-Math.max(0,Number.isFinite(value)?value:0)/this.maxValue()*170; }
  x(index:number) {
    const points=this.points();
    const first=Date.parse(points[0]?.label),last=Date.parse(points.at(-1)?.label??''),date=Date.parse(points[index]?.label??'');
    // Respect missing dates rather than drawing unequal intervals as equal days.
    const ratio=Number.isFinite(date) && Number.isFinite(first) && last>first ? (date-first)/(last-first) : index/Math.max(1,points.length-1);
    return 54+ratio*530;
  }
  short(value:number) { return new Intl.NumberFormat('es-BO',{notation:'compact',maximumFractionDigits:1}).format(value); }
  lastLabel() { return this.points().at(-1)?.label.slice(0,10)??''; }
  actualPoints() { return this.actual.map((p,i)=>`${this.x(i).toFixed(2)},${this.y(p.value).toFixed(2)}`).join(' '); }
  areaPoints() { return this.actual.length ? `${this.x(0)},190 ${this.actualPoints()} ${this.x(this.actual.length-1)},190` : ''; }
  projectedPoints() {
    const bridge=this.actual.length ? [`${this.x(this.actual.length-1).toFixed(2)},${this.y(this.actual.at(-1)!.value).toFixed(2)}`] : [];
    return [...bridge,...this.projected.map((p,i)=>`${this.x(this.actual.length+i).toFixed(2)},${this.y(p.value).toFixed(2)}`)].join(' ');
  }
}
