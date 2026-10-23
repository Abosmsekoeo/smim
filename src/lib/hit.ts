import type { Layer, Pt } from './types';

export type Box = { w: number; h: number };

/** هل النقطة داخل مستطيل العنصر (مع مراعاة التدوير والتكبير)؟ pad بوحدات الصورة. */
export function hitLayer(layer: Layer, box: Box, p: Pt, pad: number): boolean {
  const dx = p.x - layer.x;
  const dy = p.y - layer.y;
  const c = Math.cos(-layer.rotation);
  const s = Math.sin(-layer.rotation);
  const lx = (dx * c - dy * s) / layer.scale;
  const ly = (dx * s + dy * c) / layer.scale;
  const padLocal = pad / layer.scale;
  return Math.abs(lx) <= box.w / 2 + padLocal && Math.abs(ly) <= box.h / 2 + padLocal;
}

/** أعلى عنصر ملموس (الأخير في المصفوفة هو الأعلى). */
export function hitTestLayers(
  layers: Layer[],
  boxes: Record<string, Box | undefined>,
  p: Pt,
  pad: number,
): string | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    const box = boxes[l.id];
    if (box && hitLayer(l, box, p, pad)) return l.id;
  }
  return null;
}
