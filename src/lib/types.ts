// أنواع الحالة المشتركة. هذا الملف (ومجلد lib كله ما عدا ما يُذكر) لا يستورد React Native
// ولا Skia، حتى يمكن اختباره بـ Node مباشرة.

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

/** مصفوفة 2×2 بترتيب الصفوف [a, b, c, d] = [[a, b], [c, d]] تمثل التدوير بمضاعفات 90° والقلب. */
export type Mat2 = [number, number, number, number];

export type Source =
  | { kind: 'image'; uri: string; width: number; height: number }
  | { kind: 'blank'; width: number; height: number; color: string };

export type AdjustmentId =
  | 'exposure'
  | 'brightness'
  | 'contrast'
  | 'highlights'
  | 'shadows'
  | 'fade'
  | 'saturation'
  | 'vibrance'
  | 'warmth'
  | 'tint'
  | 'hue'
  | 'sharpen'
  | 'blur'
  | 'vignette'
  | 'grain';

export type Adjustments = Record<AdjustmentId, number>;

export type Geometry = {
  orientation: Mat2;
  /** زاوية التسوية بالدرجات (موجب = مع عقارب الساعة). */
  straighten: number;
  /** مستطيل القص بإحداثيات الصورة بعد التدوير والقلب. null = الصورة كاملة. */
  crop: Rect | null;
};

export type Border = { size: number; color: string };

export type BaseLayer = {
  id: string;
  /** مركز العنصر بإحداثيات الصورة بعد التدوير والقلب. */
  x: number;
  y: number;
  /** بالراديان. */
  rotation: number;
  scale: number;
  /** 0..1 */
  opacity: number;
};

export type TextAlignId = 'left' | 'center' | 'right';

export type TextLayer = BaseLayer & {
  kind: 'text';
  text: string;
  fontId: string;
  size: number;
  color: string;
  align: TextAlignId;
  shadow: boolean;
  outline: boolean;
  outlineColor: string;
  background: string | null;
  letterSpacing: number;
};

export type ShapeLayer = BaseLayer & {
  kind: 'shape';
  shapeId: string;
  size: number;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
};

export type Layer = TextLayer | ShapeLayer;

export type Stroke = {
  id: string;
  color: string;
  size: number;
  opacity: number;
  /** x0,y0,x1,y1,... */
  points: number[];
};

export type EditorState = {
  source: Source;
  adjustments: Adjustments;
  filterId: string;
  /** 0..100 */
  filterIntensity: number;
  geometry: Geometry;
  layers: Layer[];
  strokes: Stroke[];
  border: Border;
};

export type ToolId = 'crop' | 'adjust' | 'filters' | 'text' | 'shapes' | 'draw' | 'frame';
