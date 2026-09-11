import { barPercent, chartPoints, localDate } from './dashboard.helpers';

describe('Gráficos del dashboard', () => {
  it('mantiene series vacías y cero sin coordenadas inválidas', () => {
    expect(chartPoints([])).toBe('');
    expect(chartPoints([0, 0])).toBe('10.00,150.00 590.00,150.00');
    expect(chartPoints([25])).toBe('300.00,20.00');
  });
  it('limita proporciones y evita divisiones por cero', () => {
    expect(barPercent(10, 0)).toBe(0);
    expect(barPercent(-1, 10)).toBe(0);
    expect(barPercent(30, 10)).toBe(100);
    expect(barPercent('5', 10)).toBe(50);
  });
  it('preserva el día local usado en los filtros', () => {
    expect(localDate(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02');
  });
});
