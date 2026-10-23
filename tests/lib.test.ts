import test from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/lib/history';
import {
  FLIP_H,
  FLIP_V,
  IDENTITY,
  ROT_CCW,
  ROT_CW,
  applyStep,
  decompose,
  dragCrop,
  evalTransform,
  fullRect,
  hitHandleScreen,
  imageTransform,
  mulMat,
  orientedSize,
  ratioRect,
  straightenScale,
} from '../src/lib/geometry';
import { poseFromTouches } from '../src/lib/gestures';
import { hitLayer, hitTestLayers } from '../src/lib/hit';
import { positionFromValue, valueFromPosition } from '../src/lib/slider';
import {
  ADJUSTMENT_DEFS,
  SHADER_UNIFORM_NAMES,
  buildColorMatrix,
  computeParams,
  defaultAdjustments,
  isIdentityShader,
  shaderUniforms,
} from '../src/lib/adjust';
import { FILTERS } from '../src/lib/filters';
import { SHAPES } from '../src/lib/shapes';
import { GRAIN_SKSL, PHOTO_SKSL } from '../src/lib/sksl';
import {
  addLayer,
  addStroke,
  duplicateLayer,
  frameOf,
  initialState,
  isDirty,
  moveLayer,
  newShapeLayer,
  newTextLayer,
  removeLayer,
  setCrop,
  stepOrientation,
  updateLayer,
  viewOf,
} from '../src/lib/editorOps';
import type { Source } from '../src/lib/types';

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// ───── التاريخ ─────
test('history: commit / undo / redo', () => {
  let h = H.createHistory(0);
  h = H.commit(h, 1);
  h = H.commit(h, 2);
  assert.equal(h.present, 2);
  h = H.undo(h);
  assert.equal(h.present, 1);
  h = H.redo(h);
  assert.equal(h.present, 2);
  h = H.undo(H.undo(h));
  assert.equal(h.present, 0);
  assert.equal(H.canUndo(h), false);
  assert.equal(H.canRedo(h), true);
  h = H.commit(h, 9);
  assert.equal(H.canRedo(h), false);
});

test('history: live updates collapse into one undo step', () => {
  let h = H.createHistory(10);
  h = H.liveUpdate(h, 11);
  h = H.liveUpdate(h, 12);
  h = H.liveUpdate(h, 13);
  assert.equal(h.present, 13);
  h = H.endLive(h);
  assert.equal(h.past.length, 1);
  h = H.undo(h);
  assert.equal(h.present, 10);
});

test('history: undo during live flushes first', () => {
  let h = H.createHistory(1);
  h = H.liveUpdate(h, 2);
  h = H.undo(h);
  assert.equal(h.present, 1);
});

test('history: limit is respected', () => {
  let h = H.createHistory(0);
  for (let i = 1; i <= 200; i++) h = H.commit(h, i);
  assert.ok(h.past.length <= 80);
});

// ───── الاتجاه ─────
test('orientation: four CW turns = identity, flips are involutions', () => {
  let m = IDENTITY;
  for (let i = 0; i < 4; i++) m = mulMat(ROT_CW, m);
  assert.deepEqual(m, IDENTITY);
  assert.deepEqual(mulMat(FLIP_H, FLIP_H), IDENTITY);
  assert.deepEqual(mulMat(ROT_CW, ROT_CCW), IDENTITY);
});

test('applyStep: rotating CW maps top-right corner to bottom-right', () => {
  const p = applyStep(ROT_CW, { x: 200, y: 0 }, 200, 100);
  near(p.x, 100);
  near(p.y, 200);
});

test('applyStep: flips', () => {
  assert.deepEqual(applyStep(FLIP_H, { x: 10, y: 20 }, 200, 100), { x: 190, y: 20 });
  assert.deepEqual(applyStep(FLIP_V, { x: 10, y: 20 }, 200, 100), { x: 10, y: 80 });
});

test('decompose covers all 8 elements and imageTransform matches matrix semantics', () => {
  const bw = 300;
  const bh = 200;
  const pts = [
    { x: 0, y: 0 },
    { x: bw, y: 0 },
    { x: 50, y: 170 },
    { x: bw, y: bh },
  ];
  const seen = new Set<string>();
  let frontier = [IDENTITY];
  const all = [IDENTITY];
  for (let i = 0; i < 4; i++) {
    const next: (typeof IDENTITY)[] = [];
    for (const m of frontier) for (const s of [ROT_CW, FLIP_H, FLIP_V]) next.push(mulMat(s, m));
    for (const m of next) if (!seen.has(m.join())) { seen.add(m.join()); all.push(m); }
    frontier = next;
  }
  const uniq = [...new Map(all.map((m) => [m.join(), m])).values()];
  assert.equal(uniq.length, 8);
  for (const O of uniq) {
    decompose(O);
    const { w: ow, h: oh } = orientedSize(bw, bh, O);
    const list = imageTransform(O, 0, bw, bh);
    for (const p of pts) {
      const viaMatrix = applyStep(O, p, bw, bh);
      const viaList = evalTransform(list, p);
      near(viaList.x, viaMatrix.x, 1e-6);
      near(viaList.y, viaMatrix.y, 1e-6);
      assert.ok(viaList.x >= -1e-6 && viaList.x <= ow + 1e-6 && viaList.y >= -1e-6 && viaList.y <= oh + 1e-6);
    }
  }
});

test('sequential steps compose like the matrix product', () => {
  // تدوير ثم قلب أفقي، تتبع نقطة
  const p0 = { x: 40, y: 10 };
  const a = applyStep(ROT_CW, p0, 300, 200); // الإطار الجديد 200×300
  const b = applyStep(FLIP_H, a, 200, 300);
  const O = mulMat(FLIP_H, ROT_CW);
  const direct = applyStep(O, p0, 300, 200);
  near(b.x, direct.x);
  near(b.y, direct.y);
});

test('straightenScale covers the frame', () => {
  assert.equal(straightenScale(0, 400, 300), 1);
  const s = straightenScale(10, 400, 300);
  assert.ok(s > 1);
  // نتحقق أن زوايا الإطار الأصلي داخل الصورة المدورة والمكبرة
  const a = (10 * Math.PI) / 180;
  const w = 400;
  const h = 300;
  for (const [cx, cy] of [[w / 2, h / 2], [-w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2]]) {
    // نعيد النقطة إلى فضاء الصورة: عكس التدوير ثم القسمة على s
    const x = (cx * Math.cos(-a) - cy * Math.sin(-a)) / s;
    const y = (cx * Math.sin(-a) + cy * Math.cos(-a)) / s;
    assert.ok(Math.abs(x) <= w / 2 + 1e-6 && Math.abs(y) <= h / 2 + 1e-6);
  }
});

// ───── القص ─────
const frame = fullRect(1000, 800);

test('ratioRect fits ratio inside frame', () => {
  for (const r of [1, 4 / 5, 16 / 9, 9 / 16, 3 / 4]) {
    const rect = ratioRect(frame, r);
    near(rect.w / rect.h, r, 1e-9);
    assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= 1000 + 1e-9 && rect.y + rect.h <= 800 + 1e-9);
  }
});

test('dragCrop: move stays inside frame', () => {
  const r = dragCrop({ x: 100, y: 100, w: 300, h: 200 }, 'move', 5000, -5000, frame, null);
  assert.equal(r.x, 700);
  assert.equal(r.y, 0);
  assert.equal(r.w, 300);
});

test('dragCrop: free resize respects bounds and minimum', () => {
  const start = { x: 100, y: 100, w: 300, h: 200 };
  const grow = dragCrop(start, 'br', 9999, 9999, frame, null);
  assert.equal(grow.x + grow.w, 1000);
  assert.equal(grow.y + grow.h, 800);
  const shrink = dragCrop(start, 'tl', 9999, 9999, frame, null);
  assert.ok(shrink.w >= 24 && shrink.h >= 24);
  assert.ok(shrink.x + shrink.w <= 400 + 1e-9);
  const edge = dragCrop(start, 'r', 50, 77, frame, null);
  assert.equal(edge.w, 350);
  assert.equal(edge.h, 200);
});

test('dragCrop: ratio-locked corners keep the ratio and stay inside', () => {
  const ratio = 1;
  const start = ratioRect(frame, ratio, { x: 500, y: 400 });
  for (const handle of ['tl', 'tr', 'bl', 'br'] as const) {
    for (const [dx, dy] of [[-300, -50], [200, 400], [-9999, 9999], [30, 30], [5000, 5000]]) {
      const r = dragCrop(start, handle, dx, dy, frame, ratio);
      near(r.w / r.h, ratio, 1e-6);
      assert.ok(r.x >= -1e-6 && r.y >= -1e-6 && r.x + r.w <= 1000 + 1e-6 && r.y + r.h <= 800 + 1e-6, `${handle} ${dx},${dy} -> ${JSON.stringify(r)}`);
      assert.ok(r.w >= 24 - 1e-9);
    }
  }
});

test('hitHandleScreen picks corners, edges, move', () => {
  const r = { x: 100, y: 100, w: 200, h: 100 };
  assert.equal(hitHandleScreen(r, { x: 102, y: 98 }, 20, true), 'tl');
  assert.equal(hitHandleScreen(r, { x: 298, y: 202 }, 20, true), 'br');
  assert.equal(hitHandleScreen(r, { x: 200, y: 102 }, 20, true), 't');
  assert.equal(hitHandleScreen(r, { x: 101, y: 150 }, 20, true), 'l');
  assert.equal(hitHandleScreen(r, { x: 200, y: 150 }, 20, true), 'move');
  assert.equal(hitHandleScreen(r, { x: 500, y: 500 }, 20, true), null);
  assert.equal(hitHandleScreen(r, { x: 200, y: 102 }, 20, false), 'move');
});

// ───── اللمس ─────
test('poseFromTouches: one finger drags', () => {
  const p = poseFromTouches({ x: 10, y: 10, scale: 1, rotation: 0 }, [{ x: 0, y: 0 }], [{ x: 5, y: -3 }]);
  assert.deepEqual(p, { x: 15, y: 7, scale: 1, rotation: 0 });
});

test('poseFromTouches: identity two-finger gesture keeps pose', () => {
  const t = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  const base = { x: 50, y: 20, scale: 2, rotation: 0.3 };
  const p = poseFromTouches(base, t, t);
  near(p.x, 50); near(p.y, 20); near(p.scale, 2); near(p.rotation, 0.3);
});

test('poseFromTouches: pinch scales about midpoint', () => {
  const base = { x: 100, y: 0, scale: 1, rotation: 0 };
  const p = poseFromTouches(base, [{ x: -10, y: 0 }, { x: 10, y: 0 }], [{ x: -20, y: 0 }, { x: 20, y: 0 }]);
  near(p.scale, 2);
  near(p.x, 200); // البعد عن المنتصف تضاعف
  near(p.y, 0);
});

test('poseFromTouches: twist rotates about midpoint', () => {
  const base = { x: 10, y: 0, scale: 1, rotation: 0 };
  const p = poseFromTouches(base, [{ x: -10, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: -10 }, { x: 0, y: 10 }]);
  near(p.rotation, Math.PI / 2);
  near(p.x, 0);
  near(p.y, 10);
});

test('poseFromTouches: scale is clamped', () => {
  const p = poseFromTouches({ x: 0, y: 0, scale: 1, rotation: 0 }, [{ x: 0, y: 0 }, { x: 1, y: 0 }], [{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
  assert.equal(p.scale, 12);
});

// ───── اختبار اللمس على العناصر ─────
test('hit testing respects rotation, scale and z-order', () => {
  const view = fullRect(1000, 800);
  const a = { ...newShapeLayer(view, 'rect'), id: 'a', x: 500, y: 400, size: 100 };
  const b = { ...newShapeLayer(view, 'rect'), id: 'b', x: 500, y: 400, size: 100, rotation: Math.PI / 4, scale: 2 };
  const boxes = { a: { w: 100, h: 100 }, b: { w: 100, h: 100 } };
  assert.equal(hitTestLayers([a, b], boxes, { x: 500, y: 400 }, 0), 'b');
  assert.equal(hitTestLayers([b, a], boxes, { x: 500, y: 400 }, 0), 'a');
  // نقطة على محور x بعد التدوير 45° والتكبير ×2: خارج الصندوق المدور (قطره ≈ 141 لكل جهة)
  assert.equal(hitLayer(b, boxes.b, { x: 500 + 150, y: 400 }, 0), false);
  assert.equal(hitLayer(b, boxes.b, { x: 500 + 90, y: 400 }, 0), true);
  assert.equal(hitLayer(a, boxes.a, { x: 580, y: 400 }, 40), true);
  assert.equal(hitTestLayers([a], boxes, { x: 900, y: 700 }, 10), null);
});

// ───── المنزلق ─────
test('slider math', () => {
  assert.equal(valueFromPosition(0, 200, -100, 100, 1), -100);
  assert.equal(valueFromPosition(100, 200, -100, 100, 1), 0);
  assert.equal(valueFromPosition(500, 200, -100, 100, 1), 100);
  assert.equal(valueFromPosition(-5, 200, -100, 100, 1), -100);
  assert.equal(valueFromPosition(51, 200, 0, 100, 5), 25);
  assert.equal(valueFromPosition(10, 0, 0, 100, 1), 0);
  assert.equal(positionFromValue(0, 200, -100, 100), 100);
});

// ───── الضبط والفلاتر ─────
test('default adjustments are identity', () => {
  const p = computeParams(defaultAdjustments(), 'original', 100);
  assert.equal(isIdentityShader(p), true);
  const m = buildColorMatrix(p);
  const I = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  m.forEach((v, i) => near(v, I[i], 1e-9));
});

test('shader uniforms match the SkSL declarations exactly', () => {
  const decl = [...PHOTO_SKSL.matchAll(/uniform\s+(?:float3|float|shader)\s+(\w+);/g)].map((m) => m[1]).filter((n) => n !== 'image');
  assert.deepEqual([...decl].sort(), [...SHADER_UNIFORM_NAMES].sort());
  const keys = Object.keys(shaderUniforms(computeParams(defaultAdjustments(), 'original', 100), 1));
  assert.deepEqual([...keys].sort(), [...SHADER_UNIFORM_NAMES].sort());
  const g = [...GRAIN_SKSL.matchAll(/uniform\s+float\s+(\w+);/g)].map((m) => m[1]).sort();
  assert.deepEqual(g, ['amount', 'cell']);
});

test('SkSL sources are structurally sane', () => {
  for (const src of [PHOTO_SKSL, GRAIN_SKSL]) {
    assert.equal((src.match(/\{/g) ?? []).length, (src.match(/\}/g) ?? []).length);
    assert.equal((src.match(/\(/g) ?? []).length, (src.match(/\)/g) ?? []).length);
    assert.ok(/half4 main\(float2 xy\)/.test(src));
  }
});

test('color matrix: saturation -100 yields gray, exposure doubles', () => {
  const adj = defaultAdjustments();
  adj.saturation = -100;
  const m = buildColorMatrix(computeParams(adj, 'original', 100));
  for (let row = 0; row < 3; row++) {
    near(m[row * 5], 0.2126, 1e-9);
    near(m[row * 5 + 1], 0.7152, 1e-9);
    near(m[row * 5 + 2], 0.0722, 1e-9);
  }
  const a2 = defaultAdjustments();
  a2.exposure = 50; // +1 stop
  const m2 = buildColorMatrix(computeParams(a2, 'original', 100));
  near(m2[0], 2, 1e-9);
});

test('filters: ids unique, only known adjustments, values in range, intensity 0 = identity', () => {
  const ids = new Set(FILTERS.map((f) => f.id));
  assert.equal(ids.size, FILTERS.length);
  assert.equal(FILTERS[0].id, 'original');
  const known = new Set(ADJUSTMENT_DEFS.map((d) => d.id));
  for (const f of FILTERS) {
    for (const [k, v] of Object.entries(f.adjust)) {
      assert.ok(known.has(k as never), `${f.id}:${k}`);
      assert.ok(Math.abs(v as number) <= 100);
    }
    const p0 = computeParams(defaultAdjustments(), f.id, 0);
    assert.equal(isIdentityShader(p0), true, f.id);
    const p1 = computeParams(defaultAdjustments(), f.id, 100);
    if (f.id !== 'original') {
      const changed = !isIdentityShader(p1) || p1.blur > 0 || p1.vignette > 0 || p1.grain > 0;
      assert.ok(changed, `${f.id} does nothing`);
    }
  }
});

test('adjustments are clamped after adding filter offsets', () => {
  const adj = defaultAdjustments();
  adj.contrast = 100;
  const p = computeParams(adj, 'noir', 100); // noir adds +45 contrast
  near(p.contrast, 1.7, 1e-9);
});

test('shapes: well-formed and unique', () => {
  const ids = new Set(SHAPES.map((s) => s.id));
  assert.equal(ids.size, SHAPES.length);
  for (const s of SHAPES) {
    assert.ok(/^M/.test(s.path) && /Z$/.test(s.path), s.id);
    assert.ok(!/NaN/.test(s.path), s.id);
  }
});

// ───── عمليات الحالة ─────
const img: Source = { kind: 'image', uri: 'file:///x.jpg', width: 1200, height: 800 };

test('initial state is clean; edits make it dirty', () => {
  const s = initialState(img);
  assert.equal(isDirty(s), false);
  assert.equal(isDirty(setCrop(s, { x: 10, y: 10, w: 100, h: 100 })), true);
  assert.equal(isDirty({ ...s, filterId: 'mono' }), true);
});

test('setCrop normalizes full-frame crop to null', () => {
  const s = initialState(img);
  assert.equal(setCrop(s, { x: 0, y: 0, w: 1200, h: 800 }).geometry.crop, null);
  assert.deepEqual(viewOf(setCrop(s, { x: 0, y: 0, w: 600, h: 400 })), { x: 0, y: 0, w: 600, h: 400 });
});

test('rotating CW four times restores state', () => {
  let s = initialState(img);
  s = addLayer(s, { ...newTextLayer(viewOf(s), 'مرحبا'), x: 300, y: 200 });
  s = addStroke(s, { id: 's', color: '#fff', size: 5, opacity: 1, points: [10, 20, 30, 40] });
  s = setCrop(s, { x: 100, y: 50, w: 400, h: 300 });
  const orig = JSON.parse(JSON.stringify(s));
  for (let i = 0; i < 4; i++) s = stepOrientation(s, ROT_CW);
  assert.deepEqual(s.geometry.orientation, IDENTITY);
  near(s.layers[0].x, orig.layers[0].x);
  near(s.layers[0].y, orig.layers[0].y);
  near(s.layers[0].rotation, Math.PI * 2);
  near(s.strokes[0].points[2], 30);
  near(s.strokes[0].points[3], 40);
  near(s.geometry.crop!.x, 100);
  near(s.geometry.crop!.w, 400);
});

test('one CW rotation swaps frame and moves the layer correctly', () => {
  let s = initialState(img);
  s = addLayer(s, { ...newShapeLayer(viewOf(s), 'rect'), x: 1200, y: 0 }); // أعلى اليمين
  s = stepOrientation(s, ROT_CW);
  assert.deepEqual(frameOf(s), { x: 0, y: 0, w: 800, h: 1200 });
  near(s.layers[0].x, 800); // صار أسفل اليمين
  near(s.layers[0].y, 1200);
  near(s.layers[0].rotation, Math.PI / 2);
});

test('flip mirrors position, negates straighten', () => {
  let s = initialState(img);
  s = { ...s, geometry: { ...s.geometry, straighten: 7 } };
  s = addLayer(s, { ...newShapeLayer(viewOf(s), 'rect'), x: 100, y: 300, rotation: 0.4 });
  s = stepOrientation(s, FLIP_H);
  near(s.layers[0].x, 1100);
  near(s.layers[0].y, 300);
  near(s.layers[0].rotation, -0.4);
  assert.equal(s.geometry.straighten, -7);
});

test('layer ops: update, duplicate, reorder, remove', () => {
  let s = initialState(img);
  const a = newTextLayer(viewOf(s), 'a');
  const b = newShapeLayer(viewOf(s), 'heart');
  s = addLayer(addLayer(s, a), b);
  s = updateLayer(s, a.id, { color: '#ff0000' });
  assert.equal((s.layers[0] as { color: string }).color, '#ff0000');
  const dup = duplicateLayer(s, a.id);
  assert.equal(dup.state.layers.length, 3);
  assert.notEqual(dup.newId, a.id);
  s = moveLayer(s, a.id, 'front');
  assert.equal(s.layers[1].id, a.id);
  s = moveLayer(s, a.id, 'back');
  assert.equal(s.layers[0].id, a.id);
  s = moveLayer(s, a.id, 'up');
  assert.equal(s.layers[1].id, a.id);
  s = moveLayer(s, a.id, 'down');
  assert.equal(s.layers[0].id, a.id);
  s = removeLayer(s, a.id);
  assert.equal(s.layers.length, 1);
});
