import React, { useMemo } from 'react';
import {
  Blur,
  ColorMatrix,
  Fill,
  FilterMode,
  Group,
  Image as SkiaImage,
  ImageShader,
  MipmapMode,
  Paint,
  Paragraph,
  Path,
  RadialGradient,
  Rect,
  RoundedRect,
  Shader,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import type { SkImage, SkPath, SkRuntimeEffect, SkTypefaceFontProvider } from '@shopify/react-native-skia';
import type { EditorState, Rect as RectT, ShapeLayer, Stroke, TextLayer } from '../lib/types';
import { buildColorMatrix, computeParams, isIdentityShader, shaderUniforms } from '../lib/adjust';
import type { ShaderParams } from '../lib/adjust';
import { imageTransform } from '../lib/geometry';
import { frameOf } from '../lib/editorOps';
import { findShape } from '../lib/shapes';
import { buildText } from './text';

// ───── مسارات الأشكال (تُخزَّن مؤقتًا) ─────
const pathCache = new Map<string, SkPath>();
export function shapePath(id: string): SkPath {
  let p = pathCache.get(id);
  if (!p) {
    const made = Skia.Path.MakeFromSVGString(findShape(id).path);
    p = made ?? Skia.Path.Make();
    pathCache.set(id, p);
  }
  return p;
}

export function strokePath(points: number[]): SkPath {
  const path = Skia.Path.Make();
  if (points.length < 2) return path;
  const n = points.length / 2;
  path.moveTo(points[0], points[1]);
  if (n === 1) {
    path.lineTo(points[0] + 0.01, points[1]);
    return path;
  }
  // تنعيم: منحنيات تربيعية نقاط التحكم فيها هي نقاط اللمس نفسها
  for (let k = 1; k < n - 1; k++) {
    const x = points[k * 2];
    const y = points[k * 2 + 1];
    const mx = (x + points[k * 2 + 2]) / 2;
    const my = (y + points[k * 2 + 3]) / 2;
    path.quadTo(x, y, mx, my);
  }
  path.lineTo(points[(n - 1) * 2], points[(n - 1) * 2 + 1]);
  return path;
}

// ───── الصورة مع المعالجة ─────
export function PhotoRect(props: {
  image: SkImage;
  width: number;
  height: number;
  params: ShaderParams;
  effect: SkRuntimeEffect | null;
  texel: number;
}) {
  const { image, width, height, params, effect, texel } = props;
  const sampling = { filter: FilterMode.Linear, mipmap: MipmapMode.Linear };
  if (isIdentityShader(params)) {
    return <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="fill" sampling={sampling} />;
  }
  if (effect) {
    return (
      <Rect x={0} y={0} width={width} height={height}>
        <Shader source={effect} uniforms={shaderUniforms(params, texel)}>
          <ImageShader
            image={image}
            fit="fill"
            rect={{ x: 0, y: 0, width, height }}
            tx="clamp"
            ty="clamp"
            fm="linear"
            mm="linear"
          />
        </Shader>
      </Rect>
    );
  }
  return (
    <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="fill" sampling={sampling}>
      <ColorMatrix matrix={buildColorMatrix(params)} />
    </SkiaImage>
  );
}

// ───── العناصر ─────
function TextLayerView({ layer, fonts, maxWidth }: { layer: TextLayer; fonts: SkTypefaceFontProvider | null; maxWidth: number }) {
  const built = useMemo(
    () => buildText(layer, fonts, maxWidth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layer.text, layer.fontId, layer.size, layer.color, layer.align, layer.shadow, layer.outline, layer.outlineColor, layer.letterSpacing, layer.background, fonts, maxWidth],
  );
  return (
    <Group
      opacity={layer.opacity}
      transform={[{ translateX: layer.x }, { translateY: layer.y }, { rotate: layer.rotation }, { scale: layer.scale }]}
    >
      {layer.background ? (
        <RoundedRect
          x={-built.boxW / 2}
          y={-built.boxH / 2}
          width={built.boxW}
          height={built.boxH}
          r={built.pad}
          color={layer.background}
        />
      ) : null}
      <Paragraph paragraph={built.paragraph} x={-built.width / 2} y={-built.height / 2} width={built.width} />
    </Group>
  );
}

function ShapeLayerView({ layer }: { layer: ShapeLayer }) {
  const path = shapePath(layer.shapeId);
  return (
    <Group
      opacity={layer.opacity}
      transform={[
        { translateX: layer.x },
        { translateY: layer.y },
        { rotate: layer.rotation },
        { scale: (layer.scale * layer.size) / 100 },
        { translateX: -50 },
        { translateY: -50 },
      ]}
    >
      {layer.fill ? <Path path={path} color={layer.fill} /> : null}
      {layer.stroke && layer.strokeWidth > 0 ? (
        <Path path={path} color={layer.stroke} style="stroke" strokeWidth={layer.strokeWidth} strokeJoin="round" />
      ) : null}
    </Group>
  );
}

function StrokeView({ stroke }: { stroke: Stroke }) {
  const path = useMemo(() => strokePath(stroke.points), [stroke.points]);
  return (
    <Path
      path={path}
      color={stroke.color}
      opacity={stroke.opacity}
      style="stroke"
      strokeWidth={stroke.size}
      strokeCap="round"
      strokeJoin="round"
    />
  );
}

// ───── المشهد ─────
export interface SceneProps {
  state: EditorState;
  /** المنطقة المعروضة بإحداثيات الصورة بعد التدوير */
  view: RectT;
  image: SkImage | null;
  fonts: SkTypefaceFontProvider | null;
  photoEffect: SkRuntimeEffect | null;
  grainEffect: SkRuntimeEffect | null;
  /** بكسلات الشاشة (أو التصدير) لكل بكسل من فضاء الصورة؛ يضبط حجم الحدّة */
  pixelScale: number;
  liveStroke?: Stroke | null;
}

export function Scene(props: SceneProps) {
  const { state, view, image, fonts, photoEffect, grainEffect, pixelScale, liveStroke } = props;
  const src = state.source;
  const g = state.geometry;
  const params = useMemo(
    () => computeParams(state.adjustments, state.filterId, state.filterIntensity),
    [state.adjustments, state.filterId, state.filterIntensity],
  );
  const transform = useMemo(
    () => imageTransform(g.orientation, g.straighten, src.width, src.height),
    [g.orientation, g.straighten, src.width, src.height],
  );
  const frame = frameOf(state);
  const minSide = Math.min(view.w, view.h);
  const imgScale = (transform[3] as { scale: number }).scale;
  const texel = Math.max(1, 1 / Math.max(0.0001, pixelScale * imgScale));
  const blurSigma = params.blur * 0.012 * Math.max(src.width, src.height);
  const borderPx = (state.border.size / 100) * minSide;
  const vignetteA = Math.min(0.92, params.vignette * 0.9);

  return (
    <Group clip={{ x: 0, y: 0, width: view.w, height: view.h }}>
      <Fill color={src.kind === 'blank' ? src.color : '#000000'} />
      <Group transform={[{ translateX: -view.x }, { translateY: -view.y }]}>
        <Group
          transform={transform as never}
          layer={blurSigma > 0.05 ? (<Paint><Blur blur={blurSigma} mode="clamp" /></Paint>) : undefined}
        >
          {src.kind === 'blank' ? (
            <Rect x={0} y={0} width={src.width} height={src.height} color={src.color} />
          ) : image ? (
            <PhotoRect
              image={image}
              width={src.width}
              height={src.height}
              params={params}
              effect={photoEffect}
              texel={texel}
            />
          ) : null}
        </Group>

        {vignetteA > 0.001 ? (
          <Rect x={view.x} y={view.y} width={view.w} height={view.h}>
            <RadialGradient
              c={vec(view.x + view.w / 2, view.y + view.h / 2)}
              r={Math.hypot(view.w, view.h) / 2}
              colors={['rgba(0,0,0,0)', `rgba(0,0,0,${vignetteA})`]}
              positions={[0.4, 1]}
            />
          </Rect>
        ) : null}

        {params.grain > 0.001 && grainEffect ? (
          <Group blendMode="overlay">
            <Rect x={view.x} y={view.y} width={view.w} height={view.h}>
              <Shader
                source={grainEffect}
                uniforms={{ amount: Math.min(1, params.grain * 0.7), cell: Math.max(1, Math.max(frame.w, frame.h) / 1400) }}
              />
            </Rect>
          </Group>
        ) : null}

        {state.strokes.map((s) => (
          <StrokeView key={s.id} stroke={s} />
        ))}
        {liveStroke ? <StrokeView stroke={liveStroke} /> : null}

        {state.layers.map((l) =>
          l.kind === 'text' ? (
            <TextLayerView key={l.id} layer={l} fonts={fonts} maxWidth={frame.w * 0.9} />
          ) : (
            <ShapeLayerView key={l.id} layer={l} />
          ),
        )}
      </Group>

      {borderPx > 0.5 ? (
        <Rect
          x={0}
          y={0}
          width={view.w}
          height={view.h}
          style="stroke"
          strokeWidth={borderPx * 2}
          color={state.border.color}
        />
      ) : null}
    </Group>
  );
}
