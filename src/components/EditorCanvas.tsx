import React, { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { Canvas, Group } from '@shopify/react-native-skia';
import type { SkImage, SkRuntimeEffect, SkTypefaceFontProvider } from '@shopify/react-native-skia';
import type { EditorState, Layer, Pt, Rect, Stroke, ToolId } from '../lib/types';
import { dragCrop, hitHandleScreen } from '../lib/geometry';
import type { Handle } from '../lib/geometry';
import { frameOf, viewOf } from '../lib/editorOps';
import { hitTestLayers } from '../lib/hit';
import type { Box } from '../lib/hit';
import { poseFromTouches } from '../lib/gestures';
import type { Pose } from '../lib/gestures';
import { uid } from '../lib/uid';
import { Scene } from '../skia/Scene';

export interface CanvasProps {
  state: EditorState;
  tool: ToolId;
  image: SkImage | null;
  fonts: SkTypefaceFontProvider | null;
  photoEffect: SkRuntimeEffect | null;
  grainEffect: SkRuntimeEffect | null;
  area: { w: number; h: number };
  selectedId: string | null;
  boxes: Record<string, Box | undefined>;
  cropRatio: number | null;
  brush: { color: string; size: number; opacity: number };
  onSelect: (id: string | null) => void;
  onCropLive: (r: Rect) => void;
  onLayerLive: (id: string, pose: Pose) => void;
  onStrokeDone: (s: Stroke) => void;
  onGestureEnd: () => void;
}

type Gesture =
  | { mode: 'crop'; handle: Handle; start: Rect; startPt: Pt }
  | { mode: 'draw'; points: number[] }
  | { mode: 'layer'; id: string; base: Pose; startTouches: Pt[]; count: number }
  | { mode: 'none' };

const SLOP = 30;

export function EditorCanvas(props: CanvasProps) {
  const { state, tool, image, fonts, photoEffect, grainEffect, area, selectedId, boxes, cropRatio, brush } = props;
  const frame = frameOf(state);
  // في وضع القص نعرض الإطار كاملًا ونرسم فوقه مقابض القص
  const view = tool === 'crop' ? frame : viewOf(state);
  const k = Math.min(area.w / view.w, area.h / view.h);
  const cw = Math.max(1, view.w * k);
  const ch = Math.max(1, view.h * k);

  const gesture = useRef<Gesture>({ mode: 'none' });
  const [liveStroke, setLiveStroke] = useState<Stroke | null>(null);

  const toDoc = (p: Pt): Pt => ({ x: view.x + p.x / k, y: view.y + p.y / k });
  const touchesOf = (e: GestureResponderEvent): Pt[] =>
    e.nativeEvent.touches.map((t) => ({ x: t.locationX, y: t.locationY }));

  const cropRect = state.geometry.crop ?? frame;
  const layerById = (id: string): Layer | undefined => state.layers.find((l) => l.id === id);
  const poseOf = (l: Layer): Pose => ({ x: l.x, y: l.y, scale: l.scale, rotation: l.rotation });
  const layerTool = tool === 'text' || tool === 'shapes';

  const onGrant = (e: GestureResponderEvent) => {
    const touches = touchesOf(e);
    if (touches.length === 0) return;
    const doc = touches.map(toDoc);
    if (tool === 'crop') {
      const screenRect: Rect = { x: cropRect.x * k, y: cropRect.y * k, w: cropRect.w * k, h: cropRect.h * k };
      const handle = hitHandleScreen(screenRect, touches[0], SLOP, cropRatio === null);
      gesture.current = handle ? { mode: 'crop', handle, start: cropRect, startPt: touches[0] } : { mode: 'none' };
    } else if (tool === 'draw') {
      gesture.current = { mode: 'draw', points: [doc[0].x, doc[0].y] };
      setLiveStroke({ id: 'live', color: brush.color, size: brush.size, opacity: brush.opacity, points: [doc[0].x, doc[0].y] });
    } else if (layerTool) {
      const hit = hitTestLayers(state.layers, boxes, doc[0], 18 / k);
      const target = hit ?? (touches.length > 1 ? selectedId : null);
      if (target) {
        props.onSelect(target);
        const layer = layerById(target);
        if (layer) {
          gesture.current = { mode: 'layer', id: target, base: poseOf(layer), startTouches: doc, count: doc.length };
          return;
        }
      }
      props.onSelect(null);
      gesture.current = { mode: 'none' };
    } else {
      gesture.current = { mode: 'none' };
    }
  };

  const onMove = (e: GestureResponderEvent) => {
    const g = gesture.current;
    const touches = touchesOf(e);
    if (touches.length === 0) return;
    if (g.mode === 'crop') {
      const dx = (touches[0].x - g.startPt.x) / k;
      const dy = (touches[0].y - g.startPt.y) / k;
      props.onCropLive(dragCrop(g.start, g.handle, dx, dy, frame, cropRatio));
    } else if (g.mode === 'draw') {
      const d = toDoc(touches[0]);
      const n = g.points.length;
      const dist = Math.hypot(d.x - g.points[n - 2], d.y - g.points[n - 1]) * k;
      if (dist >= 2) {
        g.points.push(d.x, d.y);
        setLiveStroke({ id: 'live', color: brush.color, size: brush.size, opacity: brush.opacity, points: [...g.points] });
      }
    } else if (g.mode === 'layer') {
      const doc = touches.map(toDoc);
      if (doc.length !== g.count) {
        // تغيّر عدد الأصابع: نعيد اعتماد الوضع الحالي أساسًا جديدًا
        const layer = layerById(g.id);
        if (!layer) return;
        gesture.current = { mode: 'layer', id: g.id, base: poseOf(layer), startTouches: doc, count: doc.length };
        return;
      }
      props.onLayerLive(g.id, poseFromTouches(g.base, g.startTouches, doc.slice(0, 2)));
    }
  };

  const onEnd = () => {
    const g = gesture.current;
    if (g.mode === 'crop' || g.mode === 'layer') props.onGestureEnd();
    else if (g.mode === 'draw') {
      props.onStrokeDone({ id: uid('s'), color: brush.color, size: brush.size, opacity: brush.opacity, points: g.points });
      setLiveStroke(null);
    }
    gesture.current = { mode: 'none' };
  };

  const selected = selectedId && layerTool ? layerById(selectedId) : undefined;
  const selBox = selected ? boxes[selected.id] : undefined;
  const sel = useMemo(() => {
    if (!selected || !selBox) return null;
    const pad = 8;
    return {
      cx: (selected.x - view.x) * k,
      cy: (selected.y - view.y) * k,
      w: selBox.w * selected.scale * k + pad * 2,
      h: selBox.h * selected.scale * k + pad * 2,
      rot: selected.rotation,
    };
  }, [selected, selBox, view.x, view.y, k]);

  const cr = {
    x: (cropRect.x - view.x) * k,
    y: (cropRect.y - view.y) * k,
    w: cropRect.w * k,
    h: cropRect.h * k,
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', direction: 'ltr' }}>
      <View style={{ width: cw, height: ch }}>
        <Canvas style={{ width: cw, height: ch }}>
          <Group transform={[{ scale: k }]}>
            <Scene
              state={state}
              view={view}
              image={image}
              fonts={fonts}
              photoEffect={photoEffect}
              grainEffect={grainEffect}
              pixelScale={k}
              liveStroke={liveStroke}
            />
          </Group>
        </Canvas>

        {sel ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: sel.cx - sel.w / 2,
              top: sel.cy - sel.h / 2,
              width: sel.w,
              height: sel.h,
              borderWidth: 1.5,
              borderColor: '#FFFFFF',
              borderStyle: 'dashed',
              transform: [{ rotate: `${sel.rot}rad` }],
            }}
          />
        ) : null}

        {tool === 'crop' ? <CropOverlay rect={cr} w={cw} h={ch} /> : null}

        {tool === 'crop' || tool === 'draw' || layerTool ? (
          <View
            style={{ position: 'absolute', left: 0, top: 0, width: cw, height: ch }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={onGrant}
            onResponderMove={onMove}
            onResponderRelease={onEnd}
            onResponderTerminate={onEnd}
          />
        ) : null}
      </View>
    </View>
  );
}

function CropOverlay({ rect, w, h }: { rect: Rect; w: number; h: number }) {
  const dim = 'rgba(0,0,0,0.62)';
  const handle = { position: 'absolute' as const, width: 22, height: 22, borderColor: '#FFFFFF' };
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
      <View style={{ position: 'absolute', left: 0, top: 0, width: w, height: Math.max(0, rect.y), backgroundColor: dim }} />
      <View style={{ position: 'absolute', left: 0, top: rect.y + rect.h, width: w, height: Math.max(0, h - rect.y - rect.h), backgroundColor: dim }} />
      <View style={{ position: 'absolute', left: 0, top: rect.y, width: Math.max(0, rect.x), height: rect.h, backgroundColor: dim }} />
      <View style={{ position: 'absolute', left: rect.x + rect.w, top: rect.y, width: Math.max(0, w - rect.x - rect.w), height: rect.h, backgroundColor: dim }} />
      <View style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' }}>
        <View style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
        <View style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
        <View style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
        <View style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
      </View>
      <View style={{ ...handle, left: rect.x - 3, top: rect.y - 3, borderLeftWidth: 4, borderTopWidth: 4 }} />
      <View style={{ ...handle, left: rect.x + rect.w - 19, top: rect.y - 3, borderRightWidth: 4, borderTopWidth: 4 }} />
      <View style={{ ...handle, left: rect.x - 3, top: rect.y + rect.h - 19, borderLeftWidth: 4, borderBottomWidth: 4 }} />
      <View style={{ ...handle, left: rect.x + rect.w - 19, top: rect.y + rect.h - 19, borderRightWidth: 4, borderBottomWidth: 4 }} />
    </View>
  );
}
