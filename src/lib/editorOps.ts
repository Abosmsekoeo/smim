import type {
  Border,
  EditorState,
  Layer,
  Mat2,
  Rect,
  ShapeLayer,
  Source,
  Stroke,
  TextLayer,
} from './types';
import { defaultAdjustments } from './adjust';
import {
  IDENTITY,
  applyStep,
  applyStepRect,
  det,
  fullRect,
  mulMat,
  orientedSize,
  rectsClose,
} from './geometry';
import { uid } from './uid';

export function initialState(source: Source): EditorState {
  return {
    source,
    adjustments: defaultAdjustments(),
    filterId: 'original',
    filterIntensity: 100,
    geometry: { orientation: IDENTITY, straighten: 0, crop: null },
    layers: [],
    strokes: [],
    border: { size: 0, color: '#FFFFFF' },
  };
}

/** إطار الصورة بعد التدوير والقلب (قبل القص). */
export function frameOf(state: EditorState): Rect {
  const { w, h } = orientedSize(state.source.width, state.source.height, state.geometry.orientation);
  return fullRect(w, h);
}

/** المنطقة التي تظهر فعلًا في النتيجة. */
export function viewOf(state: EditorState): Rect {
  return state.geometry.crop ?? frameOf(state);
}

export function isDirty(state: EditorState): boolean {
  const g = state.geometry;
  return (
    Object.values(state.adjustments).some((v) => v !== 0) ||
    state.filterId !== 'original' ||
    g.crop !== null ||
    g.straighten !== 0 ||
    g.orientation.some((v, i) => v !== IDENTITY[i]) ||
    state.layers.length > 0 ||
    state.strokes.length > 0 ||
    state.border.size > 0
  );
}

export function setCrop(state: EditorState, rect: Rect | null): EditorState {
  const frame = frameOf(state);
  const crop = rect && !rectsClose(rect, frame) ? rect : null;
  return { ...state, geometry: { ...state.geometry, crop } };
}

export function setStraighten(state: EditorState, deg: number): EditorState {
  return { ...state, geometry: { ...state.geometry, straighten: deg } };
}

/** تدوير/قلب الصورة مع نقل العناصر والرسم والقص معها. */
export function stepOrientation(state: EditorState, step: Mat2): EditorState {
  const { w, h } = frameOf(state);
  const d = det(step);
  const dRot = d > 0 ? Math.atan2(step[2], step[0]) : 0;
  const layers = state.layers.map((l) => {
    const p = applyStep(step, { x: l.x, y: l.y }, w, h);
    return { ...l, x: p.x, y: p.y, rotation: d > 0 ? l.rotation + dRot : -l.rotation } as Layer;
  });
  const strokes = state.strokes.map((s) => {
    const pts: number[] = [];
    for (let i = 0; i < s.points.length; i += 2) {
      const p = applyStep(step, { x: s.points[i], y: s.points[i + 1] }, w, h);
      pts.push(p.x, p.y);
    }
    return { ...s, points: pts };
  });
  const crop = state.geometry.crop ? applyStepRect(step, state.geometry.crop, w, h) : null;
  return {
    ...state,
    layers,
    strokes,
    geometry: {
      orientation: mulMat(step, state.geometry.orientation),
      straighten: d > 0 ? state.geometry.straighten : -state.geometry.straighten,
      crop,
    },
  };
}

// ───── العناصر ─────

export function addLayer(state: EditorState, layer: Layer): EditorState {
  return { ...state, layers: [...state.layers, layer] };
}

export function updateLayer(state: EditorState, id: string, patch: Partial<TextLayer> | Partial<ShapeLayer>): EditorState {
  return {
    ...state,
    layers: state.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)),
  };
}

export function removeLayer(state: EditorState, id: string): EditorState {
  return { ...state, layers: state.layers.filter((l) => l.id !== id) };
}

export function duplicateLayer(state: EditorState, id: string): { state: EditorState; newId: string | null } {
  const src = state.layers.find((l) => l.id === id);
  if (!src) return { state, newId: null };
  const view = viewOf(state);
  const off = Math.min(view.w, view.h) * 0.04;
  const copy = { ...src, id: uid(), x: src.x + off, y: src.y + off } as Layer;
  return { state: addLayer(state, copy), newId: copy.id };
}

export function moveLayer(state: EditorState, id: string, dir: 'up' | 'down' | 'front' | 'back'): EditorState {
  const i = state.layers.findIndex((l) => l.id === id);
  if (i < 0) return state;
  const arr = [...state.layers];
  const [item] = arr.splice(i, 1);
  let j = i;
  if (dir === 'up') j = Math.min(arr.length, i + 1);
  else if (dir === 'down') j = Math.max(0, i - 1);
  else if (dir === 'front') j = arr.length;
  else j = 0;
  arr.splice(j, 0, item);
  return { ...state, layers: arr };
}

export function addStroke(state: EditorState, stroke: Stroke): EditorState {
  return { ...state, strokes: [...state.strokes, stroke] };
}

export function setBorder(state: EditorState, patch: Partial<Border>): EditorState {
  return { ...state, border: { ...state.border, ...patch } };
}

export function newTextLayer(view: Rect, text: string): TextLayer {
  return {
    id: uid(),
    kind: 'text',
    x: view.x + view.w / 2,
    y: view.y + view.h / 2,
    rotation: 0,
    scale: 1,
    opacity: 1,
    text,
    fontId: 'cairo',
    size: Math.max(16, Math.min(view.w, view.h) * 0.09),
    color: '#FFFFFF',
    align: 'center',
    shadow: true,
    outline: false,
    outlineColor: '#000000',
    background: null,
    letterSpacing: 0,
  };
}

export function newShapeLayer(view: Rect, shapeId: string): ShapeLayer {
  return {
    id: uid(),
    kind: 'shape',
    x: view.x + view.w / 2,
    y: view.y + view.h / 2,
    rotation: 0,
    scale: 1,
    opacity: 1,
    shapeId,
    size: Math.max(24, Math.min(view.w, view.h) * 0.28),
    fill: '#FFFFFF',
    stroke: null,
    strokeWidth: 4,
  };
}

export function hasArabic(text: string): boolean {
  return /[؀-ۿݐ-ݿ]/.test(text);
}
