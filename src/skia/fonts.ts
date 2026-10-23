import { useFonts } from '@shopify/react-native-skia';

export interface FontDef {
  id: string;
  family: string;
  label: string;
}

export const FONT_DEFS: FontDef[] = [
  { id: 'cairo', family: 'Cairo', label: 'القاهرة' },
  { id: 'tajawal', family: 'Tajawal', label: 'تجوال' },
  { id: 'almarai', family: 'Almarai', label: 'المرعي' },
  { id: 'amiri', family: 'Amiri', label: 'أميري (نسخ)' },
  { id: 'reemkufi', family: 'ReemKufi', label: 'ريم كوفي' },
  { id: 'arefruqaa', family: 'ArefRuqaa', label: 'رقعة' },
  { id: 'lalezar', family: 'Lalezar', label: 'لاليزار' },
  { id: 'poppins', family: 'Poppins', label: 'Poppins' },
  { id: 'playfair', family: 'PlayfairDisplay', label: 'Playfair' },
];

export function fontFamily(id: string): string {
  return (FONT_DEFS.find((f) => f.id === id) ?? FONT_DEFS[0]).family;
}

// يجب أن تكون require حرفية ليلتقطها Metro. المسارات يتحقق منها scripts/check-fonts.js.
const FONT_MAP = {
  Cairo: [require('@expo-google-fonts/cairo/700Bold/Cairo_700Bold.ttf')],
  Tajawal: [require('@expo-google-fonts/tajawal/700Bold/Tajawal_700Bold.ttf')],
  Almarai: [require('@expo-google-fonts/almarai/700Bold/Almarai_700Bold.ttf')],
  Amiri: [require('@expo-google-fonts/amiri/700Bold/Amiri_700Bold.ttf')],
  ReemKufi: [require('@expo-google-fonts/reem-kufi/700Bold/ReemKufi_700Bold.ttf')],
  ArefRuqaa: [require('@expo-google-fonts/aref-ruqaa/700Bold/ArefRuqaa_700Bold.ttf')],
  Lalezar: [require('@expo-google-fonts/lalezar/400Regular/Lalezar_400Regular.ttf')],
  Poppins: [require('@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf')],
  PlayfairDisplay: [require('@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf')],
};

export function useEditorFonts() {
  return useFonts(FONT_MAP);
}
