export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Clamp a pet statistic into the canonical 0–100 range, rounding to int. */
export function clampStat(value: number): number {
  return Math.round(clamp(value, 0, 100));
}
