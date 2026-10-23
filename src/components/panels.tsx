import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Canvas, Group, Image as SkiaImage, ImageShader, Path, Rect, Shader } from '@shopify/react-native-skia';
import type { SkImage, SkRuntimeEffect } from '@shopify/react-native-skia';
import type { Editor } from '../useEditor';
import type { EditorState, ShapeLayer, TextLayer } from '../lib/types';
import {
  ADJUSTMENT_DEFS,
  GROUPS,
  computeParams,
  defaultAdjustments,
  isIdentityShader,
  shaderUniforms,
} from '../lib/adjust';
import type { AdjustGroup } from '../lib/adjust';
import { FILTERS } from '../lib/filters';
import { SHAPES } from '../lib/shapes';
import { FLIP_H, FLIP_V, ROT_CCW, ROT_CW, ratioRect } from '../lib/geometry';
import {
  addLayer,
  frameOf,
  hasArabic,
  newShapeLayer,
  setBorder,
  setCrop,
  setStraighten,
  stepOrientation,
  updateLayer,
  viewOf,
} from '../lib/editorOps';
import { FONT_DEFS } from '../skia/fonts';
import { shapePath } from '../skia/Scene';
import { Button, Chip, ColorRow, HScroll, IconBtn, ROW, Slider, T, colors } from '../ui';

export interface PanelProps {
  ed: Editor;
  image: SkImage | null;
  photoEffect: SkRuntimeEffect | null;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

const patchLayer = (ed: Editor, id: string, patch: Partial<TextLayer> | Partial<ShapeLayer>) =>
  ed.set((s) => updateLayer(s, id, patch));
const liveLayer = (ed: Editor, id: string, patch: Partial<TextLayer> | Partial<ShapeLayer>) =>
  ed.live((s) => updateLayer(s, id, patch));

// ───────────── الضبط ─────────────
export function AdjustPanel({ ed }: PanelProps) {
  const [group, setGroup] = useState<AdjustGroup>('light');
  const [active, setActive] = useState<string>('exposure');
  const defs = ADJUSTMENT_DEFS.filter((d) => d.group === group);
  const def = defs.find((d) => d.id === active) ?? defs[0];
  const adj = ed.state.adjustments;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: ROW, justifyContent: 'space-around', paddingHorizontal: 12 }}>
        {GROUPS.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => {
              setGroup(g.id);
              setActive(ADJUSTMENT_DEFS.find((d) => d.group === g.id)!.id);
            }}
            style={{ paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: group === g.id ? '#fff' : 'transparent' }}
          >
            <T style={{ fontWeight: group === g.id ? '800' : '500', color: group === g.id ? '#fff' : colors.muted }}>{g.label}</T>
          </Pressable>
        ))}
      </View>
      <View style={{ height: 40 }}>
        <HScroll>
          {defs.map((d) => (
            <Chip
              key={d.id}
              label={adj[d.id] !== 0 ? `${d.label} •` : d.label}
              active={def.id === d.id}
              onPress={() => setActive(d.id)}
            />
          ))}
        </HScroll>
      </View>
      <Slider
        label={def.label}
        value={adj[def.id]}
        min={def.min}
        max={def.max}
        onChange={(v) => ed.live((s) => ({ ...s, adjustments: { ...s.adjustments, [def.id]: v } }))}
        onEnd={ed.endLive}
      />
      <View style={{ flexDirection: ROW, justifyContent: 'center', gap: 10 }}>
        <Chip label="إعادة هذا الضبط" onPress={() => ed.set((s) => ({ ...s, adjustments: { ...s.adjustments, [def.id]: 0 } }))} />
        <Chip label="إعادة الكل" onPress={() => ed.set((s) => ({ ...s, adjustments: defaultAdjustments() }))} />
      </View>
    </View>
  );
}

// ───────────── الفلاتر ─────────────
const CELL = 76;

function FilterStrip({ image, effect, selected, onSelect }: { image: SkImage | null; effect: SkRuntimeEffect | null; selected: string; onSelect: (id: string) => void }) {
  const total = FILTERS.length * CELL;
  const size = 64;
  return (
    <HScroll contentStyle={{ paddingHorizontal: 0, gap: 0 }}>
      <View style={{ width: total, height: 92, direction: 'ltr' }}>
        <Canvas style={{ width: total, height: 92 }}>
          {image
            ? FILTERS.map((f, i) => {
                const params = computeParams(defaultAdjustments(), f.id, 100);
                // مقاس «cover» داخل خلية مربعة
                const s = Math.max(size / image.width(), size / image.height());
                const dw = image.width() * s;
                const dh = image.height() * s;
                const ox = (CELL - size) / 2 + (size - dw) / 2;
                const oy = 4 + (size - dh) / 2;
                const slot = FILTERS.length - 1 - i; // الترتيب معكوس: «أصلي» عند الحافة اليمنى
                return (
                  <Group key={f.id} clip={{ x: (CELL - size) / 2 + slot * CELL, y: 4, width: size, height: size }}>
                    <Group transform={[{ translateX: slot * CELL + ox }, { translateY: oy }, { scale: s }]}>
                      {isIdentityShader(params) || !effect ? (
                        <SkiaImage image={image} x={0} y={0} width={image.width()} height={image.height()} fit="fill" />
                      ) : (
                        <Rect x={0} y={0} width={image.width()} height={image.height()}>
                          <Shader source={effect} uniforms={shaderUniforms(params, 1 / s)}>
                            <ImageShader image={image} fit="fill" rect={{ x: 0, y: 0, width: image.width(), height: image.height() }} tx="clamp" ty="clamp" fm="linear" mm="linear" />
                          </Shader>
                        </Rect>
                      )}
                    </Group>
                  </Group>
                );
              })
            : null}
        </Canvas>
        <View style={{ position: 'absolute', left: 0, top: 0, width: total, height: 92, flexDirection: 'row-reverse' }}>
          {FILTERS.map((f) => (
            <Pressable key={f.id} accessibilityLabel={f.label} onPress={() => onSelect(f.id)} style={{ width: CELL, height: 92, alignItems: 'center', justifyContent: 'flex-end' }}>
              {selected === f.id ? (
                <View pointerEvents="none" style={{ position: 'absolute', top: 2, width: size + 4, height: size + 4, borderRadius: 6, borderWidth: 2, borderColor: '#fff' }} />
              ) : null}
              <T style={{ fontSize: 11, color: selected === f.id ? '#fff' : colors.muted, textAlign: 'center' }}>{f.label}</T>
            </Pressable>
          ))}
        </View>
      </View>
    </HScroll>
  );
}

export function FilterPanel({ ed, image, photoEffect }: PanelProps) {
  const s = ed.state;
  if (s.source.kind === 'blank') {
    return (
      <View style={{ padding: 20 }}>
        <T style={{ color: colors.muted, textAlign: 'center' }}>الفلاتر تعمل على الصور فقط.</T>
      </View>
    );
  }
  return (
    <View style={{ gap: 4 }}>
      <FilterStrip
        image={image}
        effect={photoEffect}
        selected={s.filterId}
        onSelect={(id) => ed.set((st) => ({ ...st, filterId: id, filterIntensity: st.filterId === id ? st.filterIntensity : 100 }))}
      />
      {s.filterId !== 'original' ? (
        <Slider
          label="شدّة الفلتر"
          value={s.filterIntensity}
          min={0}
          max={100}
          onChange={(v) => ed.live((st) => ({ ...st, filterIntensity: v }))}
          onEnd={ed.endLive}
        />
      ) : null}
    </View>
  );
}

// ───────────── القص ─────────────
const RATIOS: { id: string; label: string; ratio: number | 'free' | 'original' }[] = [
  { id: 'free', label: 'حر', ratio: 'free' },
  { id: 'orig', label: 'أصلي', ratio: 'original' },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
];

export function CropPanel({ ed, cropRatioId, setCropRatio }: PanelProps & { cropRatioId: string; setCropRatio: (id: string, ratio: number | null) => void }) {
  const s = ed.state;
  const frame = frameOf(s);
  const applyRatio = (id: string, r: number | 'free' | 'original') => {
    if (r === 'free') {
      setCropRatio(id, null);
      return;
    }
    const ratio = r === 'original' ? frame.w / frame.h : r;
    setCropRatio(id, ratio);
    const cur = viewOf(s);
    ed.set((st) => setCrop(st, ratioRect(frame, ratio, { x: cur.x + cur.w / 2, y: cur.y + cur.h / 2 })));
  };
  const step = (m: typeof ROT_CW) => {
    ed.set((st) => stepOrientation(st, m));
    // تدوير 90° يقلب النسبة المقفلة
    if (m === ROT_CW || m === ROT_CCW) setCropRatio('free', null);
  };
  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: 40 }}>
        <HScroll>
          {RATIOS.map((r) => (
            <Chip key={r.id} label={r.label} active={cropRatioId === r.id} onPress={() => applyRatio(r.id, r.ratio)} />
          ))}
        </HScroll>
      </View>
      <View style={{ flexDirection: ROW, justifyContent: 'space-around', paddingHorizontal: 10 }}>
        <IconBtn icon="refresh-outline" label="تدوير يمين" onPress={() => step(ROT_CW)} />
        <IconBtn icon="refresh-outline" label="تدوير يسار" style={{ transform: [{ scaleX: -1 }] }} onPress={() => step(ROT_CCW)} />
        <IconBtn icon="swap-horizontal-outline" label="قلب أفقي" onPress={() => step(FLIP_H)} />
        <IconBtn icon="swap-vertical-outline" label="قلب عمودي" onPress={() => step(FLIP_V)} />
        <IconBtn icon="scan-outline" label="إعادة القص" onPress={() => { ed.set((st) => setCrop(st, null)); setCropRatio('free', null); }} />
      </View>
      <Slider
        label="التسوية"
        value={s.geometry.straighten}
        min={-45}
        max={45}
        step={0.5}
        format={(v) => `${v.toFixed(1)}°`}
        onChange={(v) => ed.live((st) => setStraighten(st, v))}
        onEnd={ed.endLive}
      />
    </View>
  );
}

// ───────────── عناصر مشتركة للطبقات ─────────────
function normalizeDeg(d: number): number {
  const r = Math.round(d) % 360;
  return r > 180 ? r - 360 : r < -180 ? r + 360 : r;
}

function TransformSliders({ ed, layer }: { ed: Editor; layer: TextLayer | ShapeLayer }) {
  return (
    <View>
      <Slider label="الحجم" value={layer.scale * 100} min={10} max={600} format={(v) => `${Math.round(v)}%`} onChange={(v) => liveLayer(ed, layer.id, { scale: v / 100 })} onEnd={ed.endLive} />
      <Slider label="الشفافية" value={layer.opacity * 100} min={0} max={100} format={(v) => `${Math.round(v)}%`} onChange={(v) => liveLayer(ed, layer.id, { opacity: v / 100 })} onEnd={ed.endLive} />
      <Slider label="التدوير" value={normalizeDeg((layer.rotation * 180) / Math.PI)} min={-180} max={180} format={(v) => `${Math.round(v)}°`} onChange={(v) => liveLayer(ed, layer.id, { rotation: (v * Math.PI) / 180 })} onEnd={ed.endLive} />
    </View>
  );
}

// ───────────── النص ─────────────
type TextTab = 'font' | 'color' | 'style' | 'size';
const TEXT_TABS: { id: TextTab; label: string }[] = [
  { id: 'font', label: 'الخط' },
  { id: 'color', label: 'اللون' },
  { id: 'style', label: 'النمط' },
  { id: 'size', label: 'الحجم' },
];

export function TextPanel({ ed, selectedId, onAdd, onEdit }: PanelProps & { onAdd: () => void; onEdit: () => void }) {
  const [tab, setTab] = useState<TextTab>('font');
  const layer = ed.state.layers.find((l): l is TextLayer => l.id === selectedId && l.kind === 'text') ?? null;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: ROW, gap: 10, paddingHorizontal: 12 }}>
        <Button label="إضافة نص" icon="add" onPress={onAdd} style={{ flex: 1, height: 44, paddingHorizontal: 12 }} />
        {layer ? <Button label="تعديل النص" icon="create-outline" variant="secondary" onPress={onEdit} style={{ flex: 1, height: 44, paddingHorizontal: 12 }} /> : null}
      </View>
      {!layer ? (
        <T style={{ color: colors.muted, textAlign: 'center', padding: 8 }}>اضغط على نص في الصورة لتحديده، أو أضف نصًا جديدًا.</T>
      ) : (
        <>
          <View style={{ flexDirection: ROW, justifyContent: 'space-around' }}>
            {TEXT_TABS.map((t) => (
              <Pressable key={t.id} onPress={() => setTab(t.id)} style={{ paddingVertical: 4, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: tab === t.id ? '#fff' : 'transparent' }}>
                <T style={{ color: tab === t.id ? '#fff' : colors.muted, fontWeight: tab === t.id ? '800' : '500' }}>{t.label}</T>
              </Pressable>
            ))}
          </View>
          {tab === 'font' ? (
            <View style={{ height: 40 }}>
              <HScroll>
                {FONT_DEFS.map((f) => (
                  <Chip key={f.id} label={f.label} active={layer.fontId === f.id} onPress={() => patchLayer(ed, layer.id, { fontId: f.id })} />
                ))}
              </HScroll>
            </View>
          ) : null}
          {tab === 'color' ? (
            <View style={{ gap: 6 }}>
              <T style={{ color: colors.muted, fontSize: 12, paddingHorizontal: 14 }}>لون النص</T>
              <ColorRow value={layer.color} onChange={(c) => c && patchLayer(ed, layer.id, { color: c })} />
              <T style={{ color: colors.muted, fontSize: 12, paddingHorizontal: 14 }}>الخلفية</T>
              <ColorRow value={layer.background} allowNone onChange={(c) => patchLayer(ed, layer.id, { background: c })} />
              {layer.outline ? (
                <>
                  <T style={{ color: colors.muted, fontSize: 12, paddingHorizontal: 14 }}>لون الحدود</T>
                  <ColorRow value={layer.outlineColor} onChange={(c) => c && patchLayer(ed, layer.id, { outlineColor: c })} />
                </>
              ) : null}
            </View>
          ) : null}
          {tab === 'style' ? (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: ROW, gap: 8, paddingHorizontal: 12, flexWrap: 'wrap' }}>
                <Chip label="ظل" active={layer.shadow} onPress={() => patchLayer(ed, layer.id, { shadow: !layer.shadow })} />
                <Chip label="حدود" active={layer.outline} onPress={() => patchLayer(ed, layer.id, { outline: !layer.outline })} />
                <Chip label="يمين" active={layer.align === 'right'} onPress={() => patchLayer(ed, layer.id, { align: 'right' })} />
                <Chip label="وسط" active={layer.align === 'center'} onPress={() => patchLayer(ed, layer.id, { align: 'center' })} />
                <Chip label="يسار" active={layer.align === 'left'} onPress={() => patchLayer(ed, layer.id, { align: 'left' })} />
              </View>
              {!hasArabic(layer.text) ? (
                <Slider label="المسافة بين الأحرف" value={layer.letterSpacing} min={-5} max={40} onChange={(v) => liveLayer(ed, layer.id, { letterSpacing: v })} onEnd={ed.endLive} />
              ) : null}
            </View>
          ) : null}
          {tab === 'size' ? <TransformSliders ed={ed} layer={layer} /> : null}
        </>
      )}
    </View>
  );
}

// ───────────── الأشكال ─────────────
const SHAPE_CELL = 64;

function ShapeStrip({ onPick }: { onPick: (id: string) => void }) {
  const total = SHAPES.length * SHAPE_CELL;
  return (
    <HScroll contentStyle={{ paddingHorizontal: 0, gap: 0 }}>
      <View style={{ width: total, height: SHAPE_CELL, direction: 'ltr' }}>
        <Canvas style={{ width: total, height: SHAPE_CELL }}>
          {SHAPES.map((sh, i) => (
            <Group key={sh.id} transform={[{ translateX: (SHAPES.length - 1 - i) * SHAPE_CELL + 10 }, { translateY: 10 }, { scale: (SHAPE_CELL - 20) / 100 }]}>
              <Path path={shapePath(sh.id)} color="#FFFFFF" />
            </Group>
          ))}
        </Canvas>
        <View style={{ position: 'absolute', left: 0, top: 0, width: total, height: SHAPE_CELL, flexDirection: 'row-reverse' }}>
          {SHAPES.map((sh) => (
            <Pressable key={sh.id} accessibilityLabel={sh.label} onPress={() => onPick(sh.id)} style={{ width: SHAPE_CELL, height: SHAPE_CELL }} />
          ))}
        </View>
      </View>
    </HScroll>
  );
}

type ShapeTab = 'fill' | 'stroke' | 'size';

export function ShapesPanel({ ed, selectedId, setSelectedId }: PanelProps) {
  const [tab, setTab] = useState<ShapeTab>('fill');
  const layer = ed.state.layers.find((l): l is ShapeLayer => l.id === selectedId && l.kind === 'shape') ?? null;
  const add = (shapeId: string) => {
    const l = newShapeLayer(viewOf(ed.state), shapeId);
    ed.set((s) => addLayer(s, l));
    setSelectedId(l.id);
  };
  return (
    <View style={{ gap: 6 }}>
      <ShapeStrip onPick={add} />
      {layer ? (
        <>
          <View style={{ flexDirection: ROW, justifyContent: 'space-around' }}>
            {([['fill', 'التعبئة'], ['stroke', 'الحدود'], ['size', 'الحجم']] as [ShapeTab, string][]).map(([id, label]) => (
              <Pressable key={id} onPress={() => setTab(id)} style={{ paddingVertical: 4, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: tab === id ? '#fff' : 'transparent' }}>
                <T style={{ color: tab === id ? '#fff' : colors.muted, fontWeight: tab === id ? '800' : '500' }}>{label}</T>
              </Pressable>
            ))}
          </View>
          {tab === 'fill' ? <ColorRow value={layer.fill} allowNone onChange={(c) => patchLayer(ed, layer.id, { fill: c })} /> : null}
          {tab === 'stroke' ? (
            <View>
              <ColorRow value={layer.stroke} allowNone onChange={(c) => patchLayer(ed, layer.id, { stroke: c })} />
              <Slider label="سماكة الحدود" value={layer.strokeWidth} min={0} max={20} onChange={(v) => liveLayer(ed, layer.id, { strokeWidth: v })} onEnd={ed.endLive} />
            </View>
          ) : null}
          {tab === 'size' ? <TransformSliders ed={ed} layer={layer} /> : null}
        </>
      ) : (
        <T style={{ color: colors.muted, textAlign: 'center', padding: 6 }}>اختر شكلًا لإضافته، ثم اسحبه أو كبّره بإصبعين.</T>
      )}
    </View>
  );
}

// ───────────── الرسم ─────────────
export function DrawPanel({ ed, brush, setBrush, minSide }: PanelProps & { brush: { color: string; size: number; opacity: number }; setBrush: (b: { color: string; size: number; opacity: number }) => void; minSide: number }) {
  // brush.size مخزّن بوحدات الصورة؛ المنزلق يعمل بنسبة من أقصر ضلع
  const pct = Math.round((brush.size / minSide) * 400);
  return (
    <View style={{ gap: 4 }}>
      <ColorRow value={brush.color} onChange={(c) => c && setBrush({ ...brush, color: c })} />
      <Slider label="حجم الفرشاة" value={Math.max(1, Math.min(40, pct))} min={1} max={40} onChange={(v) => setBrush({ ...brush, size: (v / 400) * minSide })} />
      <Slider label="الشفافية" value={brush.opacity * 100} min={10} max={100} format={(v) => `${Math.round(v)}%`} onChange={(v) => setBrush({ ...brush, opacity: v / 100 })} />
      <View style={{ flexDirection: ROW, justifyContent: 'center', gap: 10 }}>
        <Chip label="تراجع" icon="arrow-undo" onPress={ed.undo} />
        <Chip label="مسح الرسم" icon="trash-outline" onPress={() => ed.set((s: EditorState) => ({ ...s, strokes: [] }))} />
      </View>
    </View>
  );
}

// ───────────── الإطار ─────────────
export function FramePanel({ ed }: PanelProps) {
  const b = ed.state.border;
  return (
    <View style={{ gap: 6 }}>
      <Slider label="سماكة الإطار" value={b.size} min={0} max={15} step={0.5} format={(v) => `${v}%`} onChange={(v) => ed.live((s) => setBorder(s, { size: v }))} onEnd={ed.endLive} />
      <ColorRow value={b.color} onChange={(c) => c && ed.set((s) => setBorder(s, { color: c }))} />
    </View>
  );
}

export function PanelScroll({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
      {children}
    </ScrollView>
  );
}
