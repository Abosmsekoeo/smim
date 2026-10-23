import type { AdjustmentId, Adjustments } from './types';
import { findFilter } from './filters';

export type AdjustGroup = 'light' | 'color' | 'detail';

export interface AdjustmentDef {
  id: AdjustmentId;
  label: string;
  min: number;
  max: number;
  group: AdjustGroup;
}

export const GROUPS: { id: AdjustGroup; label: string }[] = [
  { id: 'light', label: 'الإضاءة' },
  { id: 'color', label: 'اللون' },
  { id: 'detail', label: 'التفاصيل' },
];

export const ADJUSTMENT_DEFS: AdjustmentDef[] = [
  { id: 'exposure', label: 'التعريض', min: -100, max: 100, group: 'light' },
  { id: 'brightness', label: 'السطوع', min: -100, max: 100, group: 'light' },
  { id: 'contrast', label: 'التباين', min: -100, max: 100, group: 'light' },
  { id: 'highlights', label: 'الإضاءات العالية', min: -100, max: 100, group: 'light' },
  { id: 'shadows', label: 'الظلال', min: -100, max: 100, group: 'light' },
  { id: 'fade', label: 'البهتان', min: 0, max: 100, group: 'light' },
  { id: 'saturation', label: 'التشبّع', min: -100, max: 100, group: 'color' },
  { id: 'vibrance', label: 'الحيوية', min: -100, max: 100, group: 'color' },
  { id: 'warmth', label: 'الدفء', min: -100, max: 100, group: 'color' },
  { id: 'tint', label: 'الصبغة', min: -100, max: 100, group: 'color' },
  { id: 'hue', label: 'درجة اللون', min: -100, max: 100, group: 'color' },
  { id: 'sharpen', label: 'الحدّة', min: 0, max: 100, group: 'detail' },
  { id: 'blur', label: 'التمويه', min: 0, max: 100, group: 'detail' },
  { id: 'vignette', label: 'تعتيم الحواف', min: 0, max: 100, group: 'detail' },
  { id: 'grain', label: 'الحبيبات', min: 0, max: 100, group: 'detail' },
];

export function defaultAdjustments(): Adjustments {
  const out = {} as Adjustments;
  for (const d of ADJUSTMENT_DEFS) out[d.id] = 0;
  return out;
}

export interface ShaderParams {
  exposure: number;
  brightness: number;
  contrast: number;
  highlights: number;
  shadows: number;
  saturation: number;
  vibrance: number;
  warmth: number;
  tint: number;
  hue: number;
  sharpen: number;
  fade: number;
  mono: number;
  sepia: number;
  shadowTint: [number, number, number];
  highlightTint: [number, number, number];
  // تُرسم خارج الشيدر
  blur: number;
  vignette: number;
  grain: number;
}

/** الضبط الفعلي = ضبط المستخدم + إزاحات الفلتر × الشدة، مقصوصة إلى المدى المسموح. */
export function effectiveAdjustments(adj: Adjustments, filterId: string, intensity: number): Adjustments {
  const f = findFilter(filterId);
  const k = Math.max(0, Math.min(100, intensity)) / 100;
  const out = { ...adj };
  for (const d of ADJUSTMENT_DEFS) {
    const extra = (f.adjust[d.id] ?? 0) * k;
    out[d.id] = Math.max(d.min, Math.min(d.max, adj[d.id] + extra));
  }
  return out;
}

export function computeParams(adj: Adjustments, filterId: string, intensity: number): ShaderParams {
  const f = findFilter(filterId);
  const k = Math.max(0, Math.min(100, intensity)) / 100;
  const e = effectiveAdjustments(adj, filterId, intensity);
  const scale3 = (v?: [number, number, number]): [number, number, number] =>
    v ? [v[0] * k, v[1] * k, v[2] * k] : [0, 0, 0];
  return {
    exposure: (e.exposure / 100) * 2,
    brightness: (e.brightness / 100) * 0.25,
    contrast: 1 + (e.contrast / 100) * 0.7,
    highlights: e.highlights / 100,
    shadows: e.shadows / 100,
    saturation: 1 + e.saturation / 100,
    vibrance: e.vibrance / 100,
    warmth: e.warmth / 100,
    tint: e.tint / 100,
    hue: (e.hue / 100) * Math.PI,
    sharpen: (e.sharpen / 100) * 1.5,
    fade: e.fade / 100,
    mono: (f.mono ?? 0) * k,
    sepia: (f.sepia ?? 0) * k,
    shadowTint: scale3(f.shadowTint),
    highlightTint: scale3(f.highlightTint),
    blur: e.blur / 100,
    vignette: e.vignette / 100,
    grain: e.grain / 100,
  };
}

export const SHADER_UNIFORM_NAMES = [
  'exposure',
  'brightness',
  'contrast',
  'highlights',
  'shadows',
  'saturation',
  'vibrance',
  'warmth',
  'tint',
  'hue',
  'sharpen',
  'fade',
  'mono',
  'sepia',
  'texel',
  'shadowTint',
  'highlightTint',
] as const;

export function shaderUniforms(p: ShaderParams, texel: number): Record<string, number | number[]> {
  return {
    exposure: p.exposure,
    brightness: p.brightness,
    contrast: p.contrast,
    highlights: p.highlights,
    shadows: p.shadows,
    saturation: p.saturation,
    vibrance: p.vibrance,
    warmth: p.warmth,
    tint: p.tint,
    hue: p.hue,
    sharpen: p.sharpen,
    fade: p.fade,
    mono: p.mono,
    sepia: p.sepia,
    texel,
    shadowTint: p.shadowTint,
    highlightTint: p.highlightTint,
  };
}

/** لا حاجة للشيدر إن لم يتغير أي معامل لوني. */
export function isIdentityShader(p: ShaderParams): boolean {
  return (
    p.exposure === 0 &&
    p.brightness === 0 &&
    p.contrast === 1 &&
    p.highlights === 0 &&
    p.shadows === 0 &&
    p.saturation === 1 &&
    p.vibrance === 0 &&
    p.warmth === 0 &&
    p.tint === 0 &&
    p.hue === 0 &&
    p.sharpen === 0 &&
    p.fade === 0 &&
    p.mono === 0 &&
    p.sepia === 0 &&
    p.shadowTint.every((v) => v === 0) &&
    p.highlightTint.every((v) => v === 0)
  );
}

// ───── بديل احتياطي: مصفوفة ألوان 4×5 إن فشل تجميع الشيدر ─────

type M5 = number[][]; // 5×5 متجانسة

const ident5 = (): M5 => [
  [1, 0, 0, 0, 0],
  [0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0],
  [0, 0, 0, 0, 1],
];

function mul5(a: M5, b: M5): M5 {
  const out: M5 = Array.from({ length: 5 }, () => new Array(5).fill(0));
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 5; j++) for (let k = 0; k < 5; k++) out[i][j] += a[i][k] * b[k][j];
  return out;
}

/** يعيد 20 رقمًا (صفوف R,G,B,A × 5 أعمدة) بترتيب ColorMatrix في Skia. */
export function buildColorMatrix(p: ShaderParams): number[] {
  let m = ident5();
  const apply = (t: M5) => {
    m = mul5(t, m);
  };
  const g = Math.pow(2, p.exposure);
  apply([[g, 0, 0, 0, 0], [0, g, 0, 0, 0], [0, 0, g, 0, 0], [0, 0, 0, 1, 0], [0, 0, 0, 0, 1]]);
  apply([[1, 0, 0, 0, p.warmth * 0.1 + p.tint * 0.03], [0, 1, 0, 0, -p.tint * 0.06], [0, 0, 1, 0, -p.warmth * 0.1 + p.tint * 0.03], [0, 0, 0, 1, 0], [0, 0, 0, 0, 1]]);
  apply([[1, 0, 0, 0, p.brightness], [0, 1, 0, 0, p.brightness], [0, 0, 1, 0, p.brightness], [0, 0, 0, 1, 0], [0, 0, 0, 0, 1]]);
  const c = p.contrast;
  const t = 0.5 * (1 - c);
  apply([[c, 0, 0, 0, t], [0, c, 0, 0, t], [0, 0, c, 0, t], [0, 0, 0, 1, 0], [0, 0, 0, 0, 1]]);
  const sat = Math.max(0, p.saturation * (1 + p.vibrance * 0.5)) * (1 - p.mono);
  const lr = 0.2126;
  const lg = 0.7152;
  const lb = 0.0722;
  apply([
    [lr + (1 - lr) * sat, lg - lg * sat, lb - lb * sat, 0, 0],
    [lr - lr * sat, lg + (1 - lg) * sat, lb - lb * sat, 0, 0],
    [lr - lr * sat, lg - lg * sat, lb + (1 - lb) * sat, 0, 0],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 0, 1],
  ]);
  if (p.sepia > 0) {
    const s = p.sepia;
    const i = 1 - s;
    apply([
      [i + s * 0.393, s * 0.769, s * 0.189, 0, 0],
      [s * 0.349, i + s * 0.686, s * 0.168, 0, 0],
      [s * 0.272, s * 0.534, i + s * 0.131, 0, 0],
      [0, 0, 0, 1, 0],
      [0, 0, 0, 0, 1],
    ]);
  }
  if (p.fade > 0) {
    const k = 1 - p.fade * 0.25;
    const o = p.fade * 0.12;
    apply([[k, 0, 0, 0, o], [0, k, 0, 0, o], [0, 0, k, 0, o], [0, 0, 0, 1, 0], [0, 0, 0, 0, 1]]);
  }
  return [...m[0], ...m[1], ...m[2], ...m[3]];
}
