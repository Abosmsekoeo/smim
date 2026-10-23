import type { AdjustmentId } from './types';

export interface FilterDef {
  id: string;
  label: string;
  /** إزاحات تُضاف إلى قيم الضبط (بمقياس -100..100 أو 0..100) وتُضرب بشدة الفلتر. */
  adjust: Partial<Record<AdjustmentId, number>>;
  mono?: number;
  sepia?: number;
  shadowTint?: [number, number, number];
  highlightTint?: [number, number, number];
}

export const FILTERS: FilterDef[] = [
  { id: 'original', label: 'أصلي', adjust: {} },
  { id: 'vivid', label: 'نابض', adjust: { contrast: 15, saturation: 25, vibrance: 20 } },
  { id: 'bright', label: 'مشرق', adjust: { exposure: 22, brightness: 6, vibrance: 15, shadows: 15 } },
  { id: 'warm', label: 'دافئ', adjust: { warmth: 35, tint: 5, saturation: 8 } },
  { id: 'cool', label: 'بارد', adjust: { warmth: -35, saturation: 5 } },
  { id: 'sunset', label: 'غروب', adjust: { warmth: 45, tint: 12, saturation: 15, contrast: 8 } },
  { id: 'rose', label: 'وردي', adjust: { tint: 25, warmth: 10, fade: 15, saturation: 5 } },
  {
    id: 'cinema',
    label: 'سينمائي',
    adjust: { contrast: 15, saturation: -5, fade: 8 },
    shadowTint: [-0.03, 0.03, 0.06],
    highlightTint: [0.06, 0.03, -0.03],
  },
  {
    id: 'forest',
    label: 'غابة',
    adjust: { warmth: -8, saturation: 10, contrast: 8 },
    shadowTint: [-0.02, 0.04, -0.01],
  },
  { id: 'matte', label: 'مطفي', adjust: { fade: 35, contrast: -10, saturation: -5 } },
  {
    id: 'vintage',
    label: 'عتيق',
    adjust: { fade: 30, warmth: 20, saturation: -15, contrast: -5, grain: 20 },
    highlightTint: [0.04, 0.02, -0.02],
  },
  { id: 'sepia', label: 'سيبيا', adjust: { contrast: 8, fade: 8 }, sepia: 1 },
  { id: 'mono', label: 'أبيض وأسود', adjust: { contrast: 10 }, mono: 1 },
  { id: 'noir', label: 'نوار', adjust: { contrast: 45, shadows: -15, vignette: 35 }, mono: 1 },
  { id: 'dramatic', label: 'درامي', adjust: { contrast: 35, shadows: -20, highlights: -15, saturation: -10, vignette: 20 } },
];

export function findFilter(id: string): FilterDef {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0];
}
