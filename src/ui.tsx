import React, { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { positionFromValue, valueFromPosition } from './lib/slider';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const colors = {
  bg: '#000000',
  surface: '#0E0E0E',
  surface2: '#1A1A1A',
  border: '#2A2A2A',
  text: '#FFFFFF',
  muted: '#8E8E8E',
  danger: '#FF5C5C',
};

/** التطبيق كله يُرسم بتخطيط LTR ثابت، والصفوف العربية تُعكس صراحةً بـ row-reverse. */
export const ROW = 'row-reverse' as const;

export function T({ style, children, ...rest }: TextProps & { style?: StyleProp<TextStyle> }) {
  return (
    <Text {...rest} style={[styles.text, style]}>
      {children}
    </Text>
  );
}

export function IconBtn(props: {
  icon: IconName;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  disabled?: boolean;
  active?: boolean;
  size?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { icon, onPress, onPressIn, onPressOut, disabled, active, size = 22, label, style } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={6}
      style={[styles.iconBtn, active && styles.iconBtnActive, disabled && { opacity: 0.35 }, style]}
    >
      <Ionicons name={icon} size={size} color={active ? '#000' : colors.text} />
    </Pressable>
  );
}

export function Chip(props: { label: string; active?: boolean; onPress?: () => void; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const { label, active, onPress, icon, style } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive, style]}
    >
      {icon ? <Ionicons name={icon} size={16} color={active ? '#000' : colors.text} /> : null}
      <T style={[styles.chipText, active && { color: '#000' }]}>{label}</T>
    </Pressable>
  );
}

export function Button(props: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
}) {
  const { label, onPress, icon, disabled, variant = 'primary', style } = props;
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.8 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={20} color={primary ? '#000' : colors.text} /> : null}
      <T style={{ color: primary ? '#000' : colors.text, fontWeight: '800', fontSize: 16 }}>{label}</T>
    </Pressable>
  );
}

/** شريط أفقي يبدأ من اليمين (الأول عند الحافة اليمنى). */
export function HScroll({ children, contentStyle }: { children: React.ReactNode; contentStyle?: StyleProp<ViewStyle> }) {
  const ref = useRef<ScrollView>(null);
  const first = useRef(true);
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[{ flexDirection: ROW, alignItems: 'center', flexGrow: 1, paddingHorizontal: 12, gap: 8 }, contentStyle]}
      onContentSizeChange={() => {
        if (first.current) {
          first.current = false;
          ref.current?.scrollToEnd({ animated: false });
        }
      }}
    >
      {children}
    </ScrollView>
  );
}

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
  format?: (v: number) => string;
}) {
  const { label, value, min, max, step = 1, onChange, onStart, onEnd, format } = props;
  const [w, setW] = useState(0);
  const update = (e: GestureResponderEvent) => onChange(valueFromPosition(e.nativeEvent.locationX, w, min, max, step));
  const pos = positionFromValue(value, w, min, max);
  const zero = positionFromValue(Math.min(Math.max(0, min), max), w, min, max);
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
      <View style={{ flexDirection: ROW, justifyContent: 'space-between', alignItems: 'center' }}>
        <T style={{ color: colors.muted, fontSize: 13 }}>{label}</T>
        <T style={{ fontSize: 13, fontWeight: '700', minWidth: 40, textAlign: 'left' }}>
          {format ? format(value) : String(Math.round(value))}
        </T>
      </View>
      <View
        style={styles.sliderHit}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          onStart?.();
          update(e);
        }}
        onResponderMove={update}
        onResponderRelease={() => onEnd?.()}
        onResponderTerminate={() => onEnd?.()}
      >
        <View pointerEvents="none" style={styles.sliderTrack} />
        <View
          pointerEvents="none"
          style={[styles.sliderFill, { left: Math.min(pos, zero), width: Math.abs(pos - zero) }]}
        />
        <View pointerEvents="none" style={[styles.sliderThumb, { left: pos - 11 }]} />
      </View>
    </View>
  );
}

export const PALETTE = [
  '#FFFFFF', '#000000', '#8E8E93', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE', '#0A84FF', '#5E5CE6', '#BF5AF2', '#FF2D55', '#C7A27C',
];

export function ColorRow({ value, onChange, allowNone }: { value: string | null; onChange: (c: string | null) => void; allowNone?: boolean }) {
  return (
    <HScroll>
      {allowNone ? (
        <Pressable
          accessibilityLabel="بدون"
          onPress={() => onChange(null)}
          style={[styles.swatch, { backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }, value === null && styles.swatchActive]}
        >
          <Ionicons name="ban-outline" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
      {PALETTE.map((c) => (
        <Pressable
          key={c}
          accessibilityLabel={`لون ${c}`}
          onPress={() => onChange(c)}
          style={[styles.swatch, { backgroundColor: c }, value === c && styles.swatchActive]}
        />
      ))}
    </HScroll>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: 14, textAlign: 'right', writingDirection: 'rtl' },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  iconBtnActive: { backgroundColor: '#FFFFFF' },
  chip: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  chipActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  chipText: { fontSize: 13, fontWeight: '600' },
  button: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    paddingHorizontal: 28,
    borderRadius: 27,
  },
  buttonPrimary: { backgroundColor: '#FFFFFF' },
  buttonSecondary: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  sliderHit: { height: 38, justifyContent: 'center', direction: 'ltr' },
  sliderTrack: { height: 3, borderRadius: 2, backgroundColor: colors.border },
  sliderFill: { position: 'absolute', height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
  sliderThumb: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  swatchActive: { borderWidth: 3, borderColor: '#FFFFFF' },
});
