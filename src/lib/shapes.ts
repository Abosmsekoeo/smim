// أشكال متجهية داخل صندوق 100×100 مركزه (50،50).

function poly(n: number, rotDeg = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((rotDeg + (360 / n) * i) * Math.PI) / 180;
    pts.push(`${(50 + 46 * Math.cos(a)).toFixed(2)} ${(50 + 46 * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

function star(points: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 47 : 47 * inner;
    const a = ((-90 + (180 / points) * i) * Math.PI) / 180;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

export interface ShapeDef {
  id: string;
  label: string;
  path: string;
}

export const SHAPES: ShapeDef[] = [
  { id: 'rect', label: 'مربع', path: 'M8 8H92V92H8Z' },
  {
    id: 'rrect',
    label: 'مربع مدوّر',
    path: 'M24 8H76A16 16 0 0 1 92 24V76A16 16 0 0 1 76 92H24A16 16 0 0 1 8 76V24A16 16 0 0 1 24 8Z',
  },
  { id: 'circle', label: 'دائرة', path: 'M5 50A45 45 0 1 0 95 50A45 45 0 1 0 5 50Z' },
  { id: 'ring', label: 'حلقة', path: 'M5 50A45 45 0 1 0 95 50A45 45 0 1 0 5 50ZM25 50A25 25 0 1 1 75 50A25 25 0 1 1 25 50Z' },
  { id: 'triangle', label: 'مثلث', path: 'M50 8L94 90H6Z' },
  { id: 'diamond', label: 'معيّن', path: 'M50 4L96 50L50 96L4 50Z' },
  { id: 'pentagon', label: 'خماسي', path: poly(5) },
  { id: 'hexagon', label: 'سداسي', path: poly(6, 0) },
  { id: 'octagon', label: 'ثماني', path: poly(8, -22.5) },
  { id: 'star5', label: 'نجمة', path: star(5, 0.42) },
  { id: 'star8', label: 'نجمة ثمانية', path: star(8, 0.6) },
  { id: 'sparkle', label: 'لمعان', path: 'M50 4C54 32 68 46 96 50C68 54 54 68 50 96C46 68 32 54 4 50C32 46 46 32 50 4Z' },
  {
    id: 'heart',
    label: 'قلب',
    path: 'M50 90C20 64 6 48 6 31A22 22 0 0 1 50 26A22 22 0 0 1 94 31C94 48 80 64 50 90Z',
  },
  { id: 'arrow', label: 'سهم', path: 'M8 38H58V16L94 50L58 84V62H8Z' },
  { id: 'bolt', label: 'برق', path: 'M58 6L18 56H46L38 94L82 40H54Z' },
  { id: 'check', label: 'صح', path: 'M12 54L26 40L42 56L76 20L90 34L42 84Z' },
  {
    id: 'cross',
    label: 'خطأ',
    path: 'M20 8L50 38L80 8L92 20L62 50L92 80L80 92L50 62L20 92L8 80L38 50L8 20Z',
  },
  { id: 'plus', label: 'زائد', path: 'M38 8H62V38H92V62H62V92H38V62H8V38H38Z' },
  { id: 'bubble', label: 'فقاعة', path: 'M10 14H90V68H42L24 88V68H10Z' },
  { id: 'drop', label: 'قطرة', path: 'M50 6C50 6 18 44 18 64A32 32 0 0 0 82 64C82 44 50 6 50 6Z' },
  { id: 'moon', label: 'هلال', path: 'M62 9A44.4 44.4 0 1 0 62 91A50 50 0 0 1 62 9Z' },
  { id: 'line', label: 'خط', path: 'M4 43H96V57H4Z' },
];

export function findShape(id: string): ShapeDef {
  return SHAPES.find((s) => s.id === id) ?? SHAPES[0];
}
