import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResultadoReporteComponent } from './resultado-reporte.component';
import { runTopPorSucursal, runVacio } from '../domain/mj01.fixtures';
import { ReportResponse } from '../domain/reporte-ia.models';

describe('ResultadoReporteComponent · visualización agrupada y tablas', () => {
  let fixture: ComponentFixture<ResultadoReporteComponent>;
  let comp: ResultadoReporteComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultadoReporteComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ResultadoReporteComponent);
    comp = fixture.componentInstance;
  });

  it('con run_top_por_sucursal renderiza dos bloques con título Sucursal Centro y Sucursal Norte', () => {
    comp.report = runTopPorSucursal;
    comp.vista = 'grafico';
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Sucursal Centro');
    expect(text).toContain('Sucursal Norte');
  });

  it('la barra de Vestido Aurora tiene ancho 100 % y la de Falda Brisa ≈ 43 %', () => {
    comp.report = runTopPorSucursal;
    comp.vista = 'grafico';
    fixture.detectChanges();

    const fills = fixture.nativeElement.querySelectorAll('.bar-fill');
    const widths = Array.from(fills).map((el: any) => el.style.width);
    expect(widths).toContain('100%');
    expect(widths.some((w: string) => w.startsWith('42.') || w.startsWith('43'))).toBe(true);
  });

  it('los valores se muestran como 14, 9, 11, 6 sin Bs para métricas enteras', () => {
    comp.report = runTopPorSucursal;
    comp.vista = 'grafico';
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('14');
    expect(text).toContain('9');
    expect(text).toContain('11');
    expect(text).toContain('6');
    const barVals = Array.from(fixture.nativeElement.querySelectorAll('.bar-val, .sub-val'))
      .map((el: any) => el.textContent.trim());
    expect(barVals.some((v: string) => v.includes('Bs'))).toBe(false);
  });

  it('cada bloque muestra Subtotal 23 unidades y Subtotal 17 unidades', () => {
    comp.report = runTopPorSucursal;
    comp.vista = 'grafico';
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Subtotal 23 unidades');
    expect(text).toContain('Subtotal 17 unidades');
  });

  it('la tabla incluye una fila Subtotal Sucursal Centro y la fila TOTAL con 40', () => {
    comp.report = runTopPorSucursal;
    comp.vista = 'tabla';
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Subtotal Sucursal Centro');
    expect(text).toContain('TOTAL');
    expect(text).toContain('40');
  });

  it('con run_vacio muestra texto de período sin ventas y ningún bloque', () => {
    comp.report = runVacio;
    comp.vista = 'grafico';
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No se registraron movimientos');
    const groupBlocks = fixture.nativeElement.querySelectorAll('.grouped-item, .group-card, .group-block');
    expect(groupBlocks.length).toBe(0);
  });

  it('con un reporte de una dimensión sin groups muestra barras simples como hoy', () => {
    const reporteSimple: ReportResponse = {
      ...runTopPorSucursal,
      groups: undefined,
      chart: { kind: 'BAR', x: 'product', y: 'units', label: 'Top productos' },
      rows: [
        { product: 'Vestido Aurora', units: 14 },
        { product: 'Camisa Lino', units: 9 },
      ],
    };
    comp.report = reporteSimple;
    comp.vista = 'grafico';
    fixture.detectChanges();

    const chartBars = fixture.nativeElement.querySelector('.chart-bars');
    expect(chartBars).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Vestido Aurora');
  });
});
