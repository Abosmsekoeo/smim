import { Skia } from '@shopify/react-native-skia';
import { GRAIN_SKSL, PHOTO_SKSL } from '../lib/sksl';

// إن فشل التجميع تُرجع Make القيمة null ويستخدم Scene بديل مصفوفة الألوان تلقائيًا.
export const photoEffect = Skia.RuntimeEffect.Make(PHOTO_SKSL);
export const grainEffect = Skia.RuntimeEffect.Make(GRAIN_SKSL);
