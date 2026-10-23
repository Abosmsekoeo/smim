import React from 'react';
import { Group, ImageFormat, drawAsImage } from '@shopify/react-native-skia';
import type { SkImage, SkRuntimeEffect, SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { EditorState } from '../lib/types';
import { viewOf } from '../lib/editorOps';
import { Scene } from './Scene';

export type ExportFormat = 'jpg' | 'png';
export type ExportSize = 'original' | 'medium' | 'small';

export const EXPORT_SIZES: { id: ExportSize; label: string; maxSide: number }[] = [
  { id: 'original', label: 'أصلي', maxSide: 4096 },
  { id: 'medium', label: 'متوسط', maxSide: 2048 },
  { id: 'small', label: 'صغير', maxSide: 1080 },
];

export function exportDimensions(state: EditorState, size: ExportSize): { w: number; h: number; scale: number } {
  const view = viewOf(state);
  const max = EXPORT_SIZES.find((s) => s.id === size)?.maxSide ?? 4096;
  // الصور الفارغة (متجهية) قد تُكبَّر حتى 2×، والصور الحقيقية لا تُكبَّر أبدًا
  const upper = state.source.kind === 'blank' && size === 'original' ? 2 : 1;
  const scale = Math.min(upper, max / Math.max(view.w, view.h));
  return { w: Math.max(1, Math.round(view.w * scale)), h: Math.max(1, Math.round(view.h * scale)), scale };
}

export interface ExportInput {
  state: EditorState;
  image: SkImage | null;
  fonts: SkTypefaceFontProvider | null;
  photoEffect: SkRuntimeEffect | null;
  grainEffect: SkRuntimeEffect | null;
  format: ExportFormat;
  /** 50..100 (للـ JPG فقط) */
  quality: number;
  size: ExportSize;
}

/** يرسم المشهد بالدقة الكاملة خارج الشاشة ويكتبه إلى ملف مؤقت. */
export async function renderToFile(input: ExportInput): Promise<{ uri: string; width: number; height: number; mime: string }> {
  const { state, image, fonts, photoEffect, grainEffect, format, quality, size } = input;
  if (state.source.kind === 'image' && !image) throw new Error('الصورة لم تُحمَّل بعد');
  const view = viewOf(state);
  const { w, h, scale } = exportDimensions(state, size);
  const rendered = await drawAsImage(
    <Group transform={[{ scale }]}>
      <Scene
        state={state}
        view={view}
        image={image}
        fonts={fonts}
        photoEffect={photoEffect}
        grainEffect={grainEffect}
        pixelScale={scale}
      />
    </Group>,
    { width: w, height: h },
  );
  const bytes = rendered.encodeToBytes(format === 'png' ? ImageFormat.PNG : ImageFormat.JPEG, format === 'png' ? 100 : quality);
  const ext = format === 'png' ? 'png' : 'jpg';
  const file = new File(Paths.cache, `samim-${Date.now()}.${ext}`);
  file.create();
  file.write(bytes);
  return { uri: file.uri, width: w, height: h, mime: format === 'png' ? 'image/png' : 'image/jpeg' };
}

export async function saveToGallery(uri: string): Promise<void> {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) throw new Error('لم تُمنح صلاحية الحفظ في المعرض. فعّلها من إعدادات الجهاز ثم أعد المحاولة.');
  await MediaLibrary.saveToLibraryAsync(uri);
}

export async function shareFile(uri: string, mime: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('المشاركة غير متاحة على هذا الجهاز.');
  await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: 'مشاركة الصورة' });
}
