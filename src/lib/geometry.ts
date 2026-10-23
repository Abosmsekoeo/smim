import type { Mat2, Pt, Rect } from './types';

export const IDENTITY: Mat2 = [1, 0, 0, 1];
/** تدوير 90° مع عقارب الساعة (محور y لأسفل). */
export const ROT_CW: Mat2 = [0, -1, 1, 0];
export const ROT_CCW: Mat2 = [0, 1, -1, 0];
export const FLIP_H: Mat2 = [-1, 0, 0, 1];
export const FLIP_V: Mat2 = [1, 0, 0, -1];

export const deg2rad = (d: number): number => (d * Math.PI) / 180;
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** a·b */
export function mulMat(a: Mat2, b: Mat2): Mat2 {
  // «+ 0» يحوّل -0 إلى 0 حتى تتطابق المصفوفات بالمقارنة الصارمة.
  return [
    a[0] * b[0] + a[1] * b[2] + 0,
    a[0] * b[1] + a[1] * b[3] + 0,
    a[2] * b[0] + a[3] * b[2] + 0,
    a[2] * b[1] + a[3] * b[3] + 0,
  ];
}

export const det = (m: Mat2): number => m[0] * m[3] - m[1] * m[2];
export const swapsAxes = (m: Mat2): boolean => m[0] === 0;

export function orientedSize(w: number, h: number, m: Mat2): { w: number; h: number } {
  return swapsAxes(m) ? { w: h, h: w } : { w, h };
}

export function matEquals(a: Mat2, b: Mat2): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

function rotPow(k: number): Mat2 {
  let m: Mat2 = IDENTITY;
  for (let i = 0; i < k; i++) m = mulMat(ROT_CW, m);
  return m;
}

/** يحلل m إلى R^turns · F^flip حيث F هو القلب الأفقي ويُطبَّق أولًا. */
export function decompose(m: Mat2): { turns: number; flip: boolean } {
  for (let turns = 0; turns < 4; turns++) {
    for (const flip of [false, true]) {
      const cand = mulMat(rotPow(turns), flip ? FLIP_H : IDENTITY);
      if (matEquals(cand, m)) return { turns, flip };
    }
  }
  throw new Error('invalid orientation matrix');
}

/** يطبّق خطوة (تدوير/قلب) حول مركز إطار w×h ويعيد النقطة في الإطار الجديد. */
export function applyStep(step: Mat2, p: Pt, w: number, h: number): Pt {
  const vx = p.x - w / 2;
  const vy = p.y - h / 2;
  const nx = step[0] * vx + step[1] * vy;
  const ny = step[2] * vx + step[3] * vy;
  const nw = swapsAxes(step) ? h : w;
  const nh = swapsAxes(step) ? w : h;
  return { x: nx + nw / 2, y: ny + nh / 2 };
}

export function applyStepRect(step: Mat2, r: Rect, w: number, h: number): Rect {
  const a = applyStep(step, { x: r.x, y: r.y }, w, h);
  const b = applyStep(step, { x: r.x + r.w, y: r.y + r.h }, w, h);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/** معامل التكبير اللازم كي لا تظهر زوايا فارغة بعد تدوير الصورة بزاوية صغيرة. */
export function straightenScale(angleDeg: number, w: number, h: number): number {
  const a = Math.abs(deg2rad(angleDeg));
  if (a === 0) return 1;
  const ratio = Math.max(w, h) / Math.min(w, h);
  return Math.cos(a) + Math.sin(a) * ratio;
}

export type TransformStep =
  | { translateX: number }
  | { translateY: number }
  | { rotate: number }
  | { scale: number }
  | { scaleX: number };

/**
 * قائمة تحويلات Skia (الأول = الأخارجي) تنقل الصورة الأصلية (0..bw, 0..bh)
 * إلى فضاء «الصورة بعد التدوير والقلب».
 */
export function imageTransform(
  orientation: Mat2,
  straighten: number,
  bw: number,
  bh: number,
): TransformStep[] {
  const { w: ow, h: oh } = orientedSize(bw, bh, orientation);
  const { turns, flip } = decompose(orientation);
  return [
    { translateX: ow / 2 },
    { translateY: oh / 2 },
    { rotate: deg2rad(straighten) },
    { scale: straightenScale(straighten, ow, oh) },
    { rotate: (turns * Math.PI) / 2 },
    { scaleX: flip ? -1 : 1 },
    { translateX: -bw / 2 },
    { translateY: -bh / 2 },
  ];
}

/** مقيّم لقائمة التحويلات (للاختبارات): الأخير يُطبَّق أولًا. */
export function evalTransform(list: TransformStep[], p: Pt): Pt {
  let { x, y } = p;
  for (let i = list.length - 1; i >= 0; i--) {
    const t = list[i] as Record<string, number>;
    if ('translateX' in t) x += t.translateX;
    else if ('translateY' in t) y += t.translateY;
    else if ('rotate' in t) {
      const c = Math.cos(t.rotate);
      const s = Math.sin(t.rotate);
      [x, y] = [x * c - y * s, x * s + y * c];
    } else if ('scale' in t) {
      x *= t.scale;
      y *= t.scale;
    } else if ('scaleX' in t) x *= t.scaleX;
  }
  return { x, y };
}

// ───────────── القص ─────────────

export const fullRect = (w: number, h: number): Rect => ({ x: 0, y: 0, w, h });

export function minCropSize(frame: Rect): number {
  return Math.max(24, 0.05 * Math.min(frame.w, frame.h));
}

export function rectsClose(a: Rect, b: Rect, eps = 0.5): boolean {
  return (
    Math.abs(a.x - b.x) < eps &&
    Math.abs(a.y - b.y) < eps &&
    Math.abs(a.w - b.w) < eps &&
    Math.abs(a.h - b.h) < eps
  );
}

/** أكبر مستطيل بنسبة ratio (عرض/ارتفاع) داخل frame، مركزه center إن أمكن. */
export function ratioRect(frame: Rect, ratio: number, center?: Pt): Rect {
  let w = frame.w;
  let h = w / ratio;
  if (h > frame.h) {
    h = frame.h;
    w = h * ratio;
  }
  const cx = center ? center.x : frame.x + frame.w / 2;
  const cy = center ? center.y : frame.y + frame.h / 2;
  return {
    x: clamp(cx - w / 2, frame.x, frame.x + frame.w - w),
    y: clamp(cy - h / 2, frame.y, frame.y + frame.h - h),
    w,
    h,
  };
}

export type Handle = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | 'move';

/** تحديد المقبض الملموس. كل الإحداثيات بالبكسل على الشاشة. */
export function hitHandleScreen(r: Rect, p: Pt, slop: number, edges: boolean): Handle | null {
  const corners: [Handle, number, number][] = [
    ['tl', r.x, r.y],
    ['tr', r.x + r.w, r.y],
    ['bl', r.x, r.y + r.h],
    ['br', r.x + r.w, r.y + r.h],
  ];
  let best: Handle | null = null;
  let bestD = slop;
  for (const [id, cx, cy] of corners) {
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d <= bestD) {
      best = id;
      bestD = d;
    }
  }
  if (best) return best;
  if (edges) {
    const inX = p.x >= r.x - slop && p.x <= r.x + r.w + slop;
    const inY = p.y >= r.y - slop && p.y <= r.y + r.h + slop;
    if (inX && Math.abs(p.y - r.y) <= slop) return 't';
    if (inX && Math.abs(p.y - (r.y + r.h)) <= slop) return 'b';
    if (inY && Math.abs(p.x - r.x) <= slop) return 'l';
    if (inY && Math.abs(p.x - (r.x + r.w)) <= slop) return 'r';
  }
  if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return 'move';
  return null;
}

/** يحرّك/يغيّر حجم مستطيل القص. dx/dy بوحدات الصورة. */
export function dragCrop(
  start: Rect,
  handle: Handle,
  dx: number,
  dy: number,
  frame: Rect,
  ratio: number | null,
): Rect {
  const fr = frame.x + frame.w;
  const fb = frame.y + frame.h;
  const min = minCropSize(frame);

  if (handle === 'move') {
    return {
      x: clamp(start.x + dx, frame.x, fr - start.w),
      y: clamp(start.y + dy, frame.y, fb - start.h),
      w: start.w,
      h: start.h,
    };
  }

  const isCorner = handle.length === 2;
  if (ratio && isCorner) {
    const left = handle === 'tl' || handle === 'bl';
    const top = handle === 'tl' || handle === 'tr';
    const ax = left ? start.x + start.w : start.x;
    const ay = top ? start.y + start.h : start.y;
    const px = (left ? start.x : start.x + start.w) + dx;
    const py = (top ? start.y : start.y + start.h) + dy;
    let w = Math.abs(px - ax);
    let h = Math.abs(py - ay);
    if (w / ratio > h) h = w / ratio;
    else w = h * ratio;
    const maxW = left ? ax - frame.x : fr - ax;
    const maxH = top ? ay - frame.y : fb - ay;
    const f = Math.min(1, maxW / w, maxH / h);
    w *= f;
    h *= f;
    if (w < min) {
      w = min;
      h = min / ratio;
    }
    if (h < min) {
      h = min;
      w = min * ratio;
    }
    return { x: left ? ax - w : ax, y: top ? ay - h : ay, w, h };
  }

  let L = start.x;
  let T = start.y;
  let R = start.x + start.w;
  let B = start.y + start.h;
  if (handle.includes('l')) L += dx;
  if (handle.includes('r')) R += dx;
  if (handle.includes('t')) T += dy;
  if (handle.includes('b')) B += dy;
  L = clamp(L, frame.x, R - min);
  R = clamp(R, L + min, fr);
  T = clamp(T, frame.y, B - min);
  B = clamp(B, T + min, fb);
  return { x: L, y: T, w: R - L, h: B - T };
}
