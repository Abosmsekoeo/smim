import { Skia, TextAlign, TextDirection } from '@shopify/react-native-skia';
import type { SkParagraph, SkTypefaceFontProvider } from '@shopify/react-native-skia';
import type { TextLayer } from '../lib/types';
import { hasArabic } from '../lib/editorOps';
import { fontFamily } from './fonts';

const OUTLINE_DIRS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7],
];

export interface BuiltText {
  paragraph: SkParagraph;
  /** عرض النص نفسه */
  width: number;
  height: number;
  /** الحشوة حول النص عند وجود خلفية */
  pad: number;
  /** عرض/ارتفاع الصندوق الكامل (للّمس والتحديد) */
  boxW: number;
  boxH: number;
}

export function buildText(layer: TextLayer, fonts: SkTypefaceFontProvider | null, maxWidth: number): BuiltText {
  const rtl = hasArabic(layer.text);
  const style = {
    textAlign: layer.align === 'left' ? TextAlign.Left : layer.align === 'right' ? TextAlign.Right : TextAlign.Center,
    textDirection: rtl ? TextDirection.RTL : TextDirection.LTR,
  };
  const shadows: { color: Float32Array; offset: { x: number; y: number }; blurRadius: number }[] = [];
  if (layer.outline) {
    const d = Math.max(1, layer.size * 0.035);
    for (const [dx, dy] of OUTLINE_DIRS) {
      shadows.push({ color: Skia.Color(layer.outlineColor), offset: { x: dx * d, y: dy * d }, blurRadius: 0 });
    }
  }
  if (layer.shadow) {
    shadows.push({
      color: Skia.Color('rgba(0,0,0,0.65)'),
      offset: { x: layer.size * 0.04, y: layer.size * 0.05 },
      blurRadius: layer.size * 0.08,
    });
  }
  const builder = Skia.ParagraphBuilder.Make(style, fonts ?? undefined);
  builder.pushStyle({
    color: Skia.Color(layer.color),
    fontFamilies: [fontFamily(layer.fontId)],
    fontSize: layer.size,
    // المسافة بين الأحرف تفكك اتصال الحروف العربية
    letterSpacing: rtl ? 0 : layer.letterSpacing,
    shadows,
  });
  builder.addText(layer.text);
  builder.pop();
  const paragraph = builder.build();
  const wrap = Math.max(50, maxWidth);
  paragraph.layout(wrap);
  const width = Math.min(wrap, Math.ceil(paragraph.getMaxIntrinsicWidth()) + 2);
  paragraph.layout(width);
  const height = Math.max(1, Math.ceil(paragraph.getHeight()));
  const pad = layer.background ? layer.size * 0.25 : 0;
  return { paragraph, width, height, pad, boxW: width + pad * 2, boxH: height + pad * 1.2 };
}
