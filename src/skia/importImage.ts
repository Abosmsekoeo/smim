import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { Source } from '../lib/types';

const MAX_SIDE = 4096;

/** يفتح معرض الصور، ويعيد الصورة بعد تطبيق اتجاه EXIF وتصغيرها إن لزم. null عند الإلغاء. */
export async function pickImage(): Promise<Source | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });
  if (res.canceled || res.assets.length === 0) return null;
  const uri = res.assets[0].uri;

  // نعيد ترميز الصورة: يثبّت اتجاهها الصحيح ويحدّ حجمها لتناسب ذاكرة الـ GPU.
  const probe = await ImageManipulator.manipulate(uri).renderAsync();
  let ref = probe;
  if (Math.max(probe.width, probe.height) > MAX_SIDE) {
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize(probe.width >= probe.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    ref = await ctx.renderAsync();
  }
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  return { kind: 'image', uri: saved.uri, width: saved.width, height: saved.height };
}
