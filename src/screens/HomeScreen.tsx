import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Source } from '../lib/types';
import { pickImage } from '../skia/importImage';
import { BlankModal } from '../components/modals';
import { Button, T, colors } from '../ui';

export function HomeScreen({ onSource }: { onSource: (s: Source) => void }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [blank, setBlank] = useState(false);

  const pick = async () => {
    setBusy(true);
    try {
      const s = await pickImage();
      if (s) onSource(s);
    } catch {
      Alert.alert('تعذّر فتح الصورة', 'جرّب صورة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingHorizontal: 32,
      }}
    >
      <Image source={require('../../assets/logo.png')} style={{ width: '78%', height: 150 }} resizeMode="contain" accessibilityLabel="صمّم" />
      <View style={{ height: 56 }} />
      {busy ? (
        <View style={{ height: 54, justifyContent: 'center' }}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <Button label="اختر صورة" icon="images-outline" onPress={pick} style={{ alignSelf: 'stretch' }} />
      )}
      <Pressable onPress={() => setBlank(true)} hitSlop={12} style={{ marginTop: 22 }} accessibilityRole="button" accessibilityLabel="لوحة فارغة">
        <T style={{ color: colors.muted, fontSize: 14, textAlign: 'center' }}>أو ابدأ بلوحة فارغة</T>
      </Pressable>
      {blank ? (
        <BlankModal
          onClose={() => setBlank(false)}
          onCreate={(s) => {
            setBlank(false);
            onSource(s);
          }}
        />
      ) : null}
    </View>
  );
}
