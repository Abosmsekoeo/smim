import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useImage } from '@shopify/react-native-skia';
import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Source, TextLayer, ToolId } from '../lib/types';
import {
  addLayer,
  addStroke,
  duplicateLayer,
  frameOf,
  isDirty,
  moveLayer,
  newTextLayer,
  removeLayer,
  setCrop,
  updateLayer,
  viewOf,
} from '../lib/editorOps';
import { defaultAdjustments } from '../lib/adjust';
import type { Box } from '../lib/hit';
import { useEditor } from '../useEditor';
import { EditorCanvas } from '../components/EditorCanvas';
import {
  AdjustPanel,
  CropPanel,
  DrawPanel,
  FilterPanel,
  FramePanel,
  PanelScroll,
  ShapesPanel,
  TextPanel,
} from '../components/panels';
import type { PanelProps } from '../components/panels';
import { ExportModal, TextModal } from '../components/modals';
import { buildText } from '../skia/text';
import { grainEffect, photoEffect } from '../skia/effects';
import { Button, IconBtn, ROW, T, colors } from '../ui';
import type { IconName } from '../ui';

const TOOLS: { id: ToolId; label: string; icon: IconName }[] = [
  { id: 'crop', label: 'قص', icon: 'crop-outline' },
  { id: 'adjust', label: 'ضبط', icon: 'options-outline' },
  { id: 'filters', label: 'فلاتر', icon: 'color-filter-outline' },
  { id: 'text', label: 'نص', icon: 'text-outline' },
  { id: 'shapes', label: 'أشكال', icon: 'shapes-outline' },
  { id: 'draw', label: 'رسم', icon: 'brush-outline' },
  { id: 'frame', label: 'إطار', icon: 'square-outline' },
];

export function EditorScreen({ source, fonts, onClose }: { source: Source; fonts: SkTypefaceFontProvider | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const ed = useEditor(source);
  const { state } = ed;
  const image = useImage(source.kind === 'image' ? source.uri : null);

  const [tool, setTool] = useState<ToolId>('adjust');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cropRatioId, setCropRatioId] = useState('free');
  const [cropRatio, setCropRatioValue] = useState<number | null>(null);
  const [compare, setCompare] = useState(false);
  const [textModal, setTextModal] = useState<null | 'add' | 'edit'>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [area, setArea] = useState({ w: 0, h: 0 });

  const view = viewOf(state);
  const minSide = Math.min(view.w, view.h);
  const [brush, setBrush] = useState({ color: '#FFFFFF', size: Math.max(2, minSide * 0.02), opacity: 1 });

  const dirty = isDirty(state);
  const requestClose = useCallback(() => {
    if (!dirty) {
      onClose();
      return;
    }
    Alert.alert('الخروج من المحرر', 'ستفقد التعديلات غير المحفوظة. هل تريد الخروج؟', [
      { text: 'ابقَ', style: 'cancel' },
      { text: 'اخرج', style: 'destructive', onPress: onClose },
    ]);
  }, [dirty, onClose]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      requestClose();
      return true;
    });
    return () => sub.remove();
  }, [requestClose]);

  const chooseTool = (t: ToolId) => {
    setTool(t);
    if (t !== 'text' && t !== 'shapes') setSelectedId(null);
  };

  const selected = state.layers.find((l) => l.id === selectedId) ?? null;
  const frameW = frameOf(state).w;

  // أبعاد كل عنصر (للّمس والتحديد)
  const boxes = useMemo(() => {
    const out: Record<string, Box> = {};
    for (const l of state.layers) {
      if (l.kind === 'shape') out[l.id] = { w: l.size, h: l.size };
      else {
        const b = buildText(l, fonts, frameW * 0.9);
        out[l.id] = { w: b.boxW, h: b.boxH };
      }
    }
    return out;
  }, [state.layers, fonts, frameW]);

  const panelProps: PanelProps = { ed, image, photoEffect, selectedId, setSelectedId };

  const onTextDone = (text: string) => {
    if (textModal === 'edit' && selected?.kind === 'text') {
      ed.set((s) => updateLayer(s, selected.id, { text }));
    } else {
      const layer = newTextLayer(viewOf(state), text);
      ed.set((s) => addLayer(s, layer));
      setSelectedId(layer.id);
    }
    setTextModal(null);
  };

  const duplicate = () => {
    if (!selected) return;
    const res = duplicateLayer(state, selected.id);
    ed.set(() => res.state);
    if (res.newId) setSelectedId(res.newId);
  };

  const panel = (() => {
    switch (tool) {
      case 'adjust':
        return <AdjustPanel {...panelProps} />;
      case 'filters':
        return <FilterPanel {...panelProps} />;
      case 'crop':
        return (
          <CropPanel
            {...panelProps}
            cropRatioId={cropRatioId}
            setCropRatio={(id, r) => {
              setCropRatioId(id);
              setCropRatioValue(r);
            }}
          />
        );
      case 'text':
        return <TextPanel {...panelProps} onAdd={() => setTextModal('add')} onEdit={() => setTextModal('edit')} />;
      case 'shapes':
        return <ShapesPanel {...panelProps} />;
      case 'draw':
        return <DrawPanel {...panelProps} brush={brush} setBrush={setBrush} minSide={minSide} />;
      case 'frame':
        return <FramePanel {...panelProps} />;
    }
  })();

  const showLayerBar = selected && (tool === 'text' || tool === 'shapes');
  const shownState = compare ? { ...state, adjustments: defaultAdjustments(), filterId: 'original', layers: [], strokes: [], border: { ...state.border, size: 0 } } : state;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom, direction: 'ltr' }}>
      {/* الشريط العلوي */}
      <View style={{ flexDirection: ROW, alignItems: 'center', paddingHorizontal: 8, height: 54, gap: 2 }}>
        <IconBtn icon="close" label="إغلاق" onPress={requestClose} />
        <IconBtn icon="arrow-undo" label="تراجع" disabled={!ed.canUndo} onPress={ed.undo} />
        <IconBtn icon="arrow-redo" label="إعادة" disabled={!ed.canRedo} onPress={ed.redo} />
        <IconBtn icon="contrast-outline" label="قبل وبعد (اضغط مطولًا)" active={compare} onPressIn={() => setCompare(true)} onPressOut={() => setCompare(false)} />
        <View style={{ flex: 1 }} />
        <Button label="تصدير" icon="download-outline" onPress={() => setExportOpen(true)} disabled={source.kind === 'image' && !image} style={{ height: 40, paddingHorizontal: 18 }} />
      </View>

      {/* منطقة الصورة */}
      <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setArea({ w: e.nativeEvent.layout.width - 16, h: e.nativeEvent.layout.height - 8 })}>
        {area.w > 0 && (source.kind === 'blank' || image) ? (
          <EditorCanvas
            state={shownState}
            tool={compare ? 'adjust' : tool}
            image={image}
            fonts={fonts}
            photoEffect={photoEffect}
            grainEffect={grainEffect}
            area={area}
            selectedId={selectedId}
            boxes={boxes}
            cropRatio={cropRatio}
            brush={brush}
            onSelect={setSelectedId}
            onCropLive={(r) => ed.live((s) => setCrop(s, r))}
            onLayerLive={(id, pose) => ed.live((s) => updateLayer(s, id, pose))}
            onStrokeDone={(st) => ed.set((s) => addStroke(s, st))}
            onGestureEnd={ed.endLive}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ color: colors.muted }}>جارٍ التحميل…</T>
          </View>
        )}
      </View>

      {/* شريط العنصر المحدد */}
      {showLayerBar && selected ? (
        <View style={{ flexDirection: ROW, justifyContent: 'center', gap: 6, paddingVertical: 4 }}>
          <IconBtn icon="copy-outline" label="تكرار" onPress={duplicate} />
          <IconBtn icon="chevron-up" label="أمام" onPress={() => ed.set((s) => moveLayer(s, selected.id, 'up'))} />
          <IconBtn icon="chevron-down" label="خلف" onPress={() => ed.set((s) => moveLayer(s, selected.id, 'down'))} />
          <IconBtn
            icon="trash-outline"
            label="حذف"
            onPress={() => {
              ed.set((s) => removeLayer(s, selected.id));
              setSelectedId(null);
            }}
          />
        </View>
      ) : null}

      {/* لوحة الأداة */}
      <View style={{ height: 176, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border }}>
        <PanelScroll>{panel}</PanelScroll>
      </View>

      {/* شريط الأدوات */}
      <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border }}>
        <View style={{ flexDirection: ROW, justifyContent: 'space-around', paddingVertical: 6 }}>
          {TOOLS.map((t) => (
            <View key={t.id} style={{ alignItems: 'center', width: 52 }}>
              <IconBtn icon={t.icon} label={t.label} active={tool === t.id} onPress={() => chooseTool(t.id)} size={21} style={{ width: 40, height: 40 }} />
              <T style={{ fontSize: 10, color: tool === t.id ? '#fff' : colors.muted, textAlign: 'center' }}>{t.label}</T>
            </View>
          ))}
        </View>
      </View>

      {textModal ? (
        <TextModal
          initial={textModal === 'edit' && selected?.kind === 'text' ? (selected as TextLayer).text : ''}
          onDone={onTextDone}
          onClose={() => setTextModal(null)}
        />
      ) : null}
      {exportOpen ? (
        <ExportModal state={state} image={image} fonts={fonts} photoEffect={photoEffect} grainEffect={grainEffect} onClose={() => setExportOpen(false)} />
      ) : null}
    </View>
  );
}
