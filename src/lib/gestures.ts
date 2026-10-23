import type { Pt } from './types';

export interface Pose {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 12;

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * يحسب وضع العنصر الجديد انطلاقًا من وضعه الأساسي ولمسات البداية والحالية.
 * لمسة واحدة = سحب. لمستان = سحب + تكبير + تدوير حول نقطة المنتصف.
 */
export function poseFromTouches(base: Pose, start: Pt[], cur: Pt[]): Pose {
  if (start.length === 0 || cur.length === 0) return base;
  if (start.length < 2 || cur.length < 2) {
    return { ...base, x: base.x + (cur[0].x - start[0].x), y: base.y + (cur[0].y - start[0].y) };
  }
  const c0 = mid(start[0], start[1]);
  const c1 = mid(cur[0], cur[1]);
  const d0 = Math.hypot(start[1].x - start[0].x, start[1].y - start[0].y);
  const d1 = Math.hypot(cur[1].x - cur[0].x, cur[1].y - cur[0].y);
  const a0 = Math.atan2(start[1].y - start[0].y, start[1].x - start[0].x);
  const a1 = Math.atan2(cur[1].y - cur[0].y, cur[1].x - cur[0].x);
  const rawRatio = d0 < 1e-6 ? 1 : d1 / d0;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, base.scale * rawRatio));
  const r = scale / base.scale;
  const da = a1 - a0;
  const vx = base.x - c0.x;
  const vy = base.y - c0.y;
  const cos = Math.cos(da);
  const sin = Math.sin(da);
  return {
    x: c1.x + (vx * cos - vy * sin) * r,
    y: c1.y + (vx * sin + vy * cos) * r,
    scale,
    rotation: base.rotation + da,
  };
}
