import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from 'react-native';
import type { SkImage, SkRuntimeEffect, SkTypefaceFontProvider } from '@shopify/react-native-skia';
import type { EditorState, Source } from '../lib/types';
import { EXPORT_SIZES, exportDimensions, renderToFile, saveToGallery, shareFile } from '../skia/exportImage';
import type { ExportFormat, ExportSize } from '../skia/exportImage';
import { Button, Chip, IconBtn, PALETTE, ROW, Slider, T, colors } from '../ui';

const sheet = {
  backgroundColor: colors.surface,
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  borderWidth: 1,
  borderColor: colors.border,
  padding: 18,
  gap: 14,
};

function Backdrop({ children, onClose, bottom }: { children: React.ReactNode; onClose: () => void; bottom?: boolean }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, direction: 'ltr' }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: bottom ? 'flex-end' : 'center', padding: bottom ? 0 : 20 }} onPress={onClose}>
          <Pressable onPress={() => undefined}>{children}</Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ───────────── إدخال النص ─────────────
export function TextModal({ initial, onDone, onClose }: { initial: string; onDone: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState(initial);
  return (
    <Backdrop onClose={onClose}>
      <View style={{ ...sheet, borderRadius: 24 }}>
        <View style={{ flexDirection: ROW, justifyContent: 'space-between', alignItems: 'center' }}>
          <T style={{ fontSize: 17, fontWeight: '800' }}>{initial ? 'تعديل النص' : 'إضافة نص'}</T>
          <IconBtn icon="close" label="إغلاق" onPress={onClose} />
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          autoFocus
          multiline
          maxLength={160}
          placeholder="اكتب نصك هنا"
          placeholderTextColor={colors.muted}
          textAlign="right"
          accessibilityLabel="نص الصورة"
          style={{
            color: '#fff',
            fontSize: 18,
            minHeight: 80,
            maxHeight: 160,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 12,
            backgroundColor: '#000',
            textAlignVertical: 'top',
            writingDirection: 'rtl',
          }}
        />
        <Button label={initial ? 'تحديث' : 'إضافة'} icon="checkmark" disabled={text.trim().length === 0} onPress={() => onDone(text.trim())} />
      </View>
    </Backdrop>
  );
}

// ───────────── لوحة فارغة ─────────────
const BLANK_SIZES = [
  { id: 'sq', label: 'مربع 1:1', w: 1080, h: 1080 },
  { id: 'post', label: 'منشور 4:5', w: 1080, h: 1350 },
  { id: 'story', label: 'قصة 9:16', w: 1080, h: 1920 },
  { id: 'wide', label: 'أفقي 16:9', w: 1920, h: 1080 },
  { id: 'a4', label: 'A4', w: 1240, h: 1754 },
];

export function BlankModal({ onCreate, onClose }: { onCreate: (s: Source) => void; onClose: () => void }) {
  const [size, setSize] = useState(BLANK_SIZES[0]);
  const [color, setColor] = useState('#FFFFFF');
  return (
    <Backdrop onClose={onClose} bottom>
      <View style={sheet}>
        <T style={{ fontSize: 17, fontWeight: '800' }}>لوحة فارغة</T>
        <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8 }}>
          {BLANK_SIZES.map((s) => (
            <Chip key={s.id} label={s.label} active={size.id === s.id} onPress={() => setSize(s)} />
          ))}
        </View>
        <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 10 }}>
          {PALETTE.map((c) => (
            <Pressable
              key={c}
              accessibilityLabel={`لون ${c}`}
              onPress={() => setColor(c)}
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: color === c ? 3 : 1, borderColor: color === c ? '#fff' : colors.border }}
            />
          ))}
        </View>
        <Button label="إنشاء" icon="add" onPress={() => onCreate({ kind: 'blank', width: size.w, height: size.h, color })} />
      </View>
    </Backdrop>
  );
}

// ───────────── التصدير ─────────────
export function ExportModal(props: {
  state: EditorState;
  image: SkImage | null;
  fonts: SkTypefaceFontProvider | null;
  photoEffect: SkRuntimeEffect | null;
  grainEffect: SkRuntimeEffect | null;
  onClose: () => void;
}) {
  const { state, image, fonts, photoEffect, grainEffect, onClose } = props;
  const [format, setFormat] = useState<ExportFormat>('jpg');
  const [quality, setQuality] = useState(92);
  const [size, setSize] = useState<ExportSize>('original');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const dims = exportDimensions(state, size);

  useEffect(() => setMessage(null), [format, quality, size]);

  const run = (action: 'save' | 'share') => {
    setBusy(true);
    setMessage(null);
    // نمهل الواجهة لحظة لتعرض مؤشر الانتظار قبل الرسم الثقيل
    setTimeout(async () => {
      try {
        const out = renderToFile({ state, image, fonts, photoEffect, grainEffect, format, quality, size });
        if (action === 'save') {
          await saveToGallery(out.uri);
          setMessage({ text: `تم الحفظ في المعرض (${out.width}×${out.height})` });
        } else {
          await shareFile(out.uri, out.mime);
        }
      } catch (e) {
        setMessage({ text: e instanceof Error ? e.message : 'تعذّر إتمام العملية.', error: true });
      } finally {
        setBusy(false);
      }
    }, 60);
  };

  return (
    <Backdrop onClose={busy ? () => undefined : onClose} bottom>
      <View style={sheet}>
        <View style={{ flexDirection: ROW, justifyContent: 'space-between', alignItems: 'center' }}>
          <T style={{ fontSize: 17, fontWeight: '800' }}>تصدير</T>
          <T style={{ color: colors.muted, fontSize: 13 }}>{dims.w} × {dims.h}</T>
        </View>
        <View style={{ flexDirection: ROW, gap: 8 }}>
          <Chip label="JPG" active={format === 'jpg'} onPress={() => setFormat('jpg')} />
          <Chip label="PNG" active={format === 'png'} onPress={() => setFormat('png')} />
          <View style={{ width: 12 }} />
          {EXPORT_SIZES.map((s) => (
            <Chip key={s.id} label={s.label} active={size === s.id} onPress={() => setSize(s.id)} />
          ))}
        </View>
        {format === 'jpg' ? <Slider label="الجودة" value={quality} min={50} max={100} format={(v) => `${Math.round(v)}%`} onChange={setQuality} /> : null}
        {message ? <T style={{ color: message.error ? colors.danger : '#fff', textAlign: 'center' }}>{message.text}</T> : null}
        {busy ? (
          <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#fff" />
            <T style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>جارٍ التجهيز…</T>
          </View>
        ) : (
          <View style={{ flexDirection: ROW, gap: 10 }}>
            <Button label="حفظ في المعرض" icon="download-outline" onPress={() => run('save')} style={{ flex: 1, paddingHorizontal: 12 }} />
            <Button label="مشاركة" icon="share-outline" variant="secondary" onPress={() => run('share')} style={{ flex: 1, paddingHorizontal: 12 }} />
          </View>
        )}
      </View>
    </Backdrop>
  );
}
