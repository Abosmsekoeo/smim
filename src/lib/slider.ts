import { clamp } from './geometry';

export function valueFromPosition(x: number, width: number, min: number, max: number, step: number): number {
  if (width <= 0) return min;
  const t = clamp(x / width, 0, 1);
  const raw = min + t * (max - min);
  const snapped = Math.round((raw - min) / step) * step + min;
  return Number(clamp(snapped, min, max).toFixed(4));
}

export function positionFromValue(v: number, width: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp((v - min) / (max - min), 0, 1) * width;
}
