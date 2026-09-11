/** Scale finite, nonnegative values for charts; empty/all-zero series stay on baseline. */
export function barPercent(value: number | string, maximum: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(0, Math.min(100, (numeric / maximum) * 100));
}

export function chartPoints(values: Array<number | string>): string {
  const numbers = values.map((value) => Math.max(0, Number(value) || 0));
  const maximum = Math.max(0, ...numbers);
  return numbers.map((value, index) => {
    const x = numbers.length <= 1 ? 300 : 10 + (index / (numbers.length - 1)) * 580;
    return `${x.toFixed(2)},${(150 - barPercent(value, maximum) * 1.3).toFixed(2)}`;
  }).join(' ');
}

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
