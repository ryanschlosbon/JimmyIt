import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import type { Theme } from '../theme';

export function Button({ label, icon, onPress, theme, color, compact = false, disabled = false,
  selected = false, accessibilityLabel, style, vertical = false }: {
  readonly label?: string; readonly icon?: IconName; readonly onPress: () => void; readonly theme: Theme;
  readonly color?: string; readonly compact?: boolean; readonly disabled?: boolean; readonly selected?: boolean;
  readonly accessibilityLabel?: string; readonly style?: StyleProp<ViewStyle>;
  readonly vertical?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const foreground = color ? '#203858' : theme.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.button, {
      backgroundColor: color ?? theme.surface, borderColor: focused ? (theme.dark ? theme.yellow : '#9A6E00')
        : selected ? theme.teal : theme.border,
      borderWidth: focused ? 3 : 1.5, opacity: disabled ? .45 : pressed ? .75 : 1,
      transform: [{ scale: pressed ? .97 : 1 }], paddingHorizontal: compact ? 16 : 24,
      flexDirection: vertical ? 'column' : 'row', gap: vertical ? 4 : 10,
    }, style]}>
    {icon && <Icon name={icon} color={foreground} size={25} />}
    {label && <Text style={[styles.label, { color: foreground, fontSize: vertical ? 16 : 18 }]}>{label}</Text>}
  </Pressable>;
}

export function Heading({ children, theme, size = 34, level = 2 }: {
  readonly children: ReactNode; readonly theme: Theme; readonly size?: number;
  readonly level?: number;
}) {
  return <Text accessibilityRole="header" aria-level={level} style={{ fontFamily: 'Baloo', fontSize: size,
    lineHeight: size * 1.12, color: theme.text }}>{children}</Text>;
}

export function Body({ children, theme, small = false, color }: {
  readonly children: ReactNode; readonly theme: Theme; readonly small?: boolean; readonly color?: string;
}) {
  return <Text style={{ fontFamily: 'Poppins', fontSize: small ? 16 : 24,
    lineHeight: small ? 25 : 34, color: color ?? theme.secondary }}>{children}</Text>;
}

export function Eyebrow({ children, theme }: { readonly children: ReactNode; readonly theme: Theme }) {
  return <Text style={{ fontFamily: 'PoppinsBold', fontSize: 14, letterSpacing: 2,
    textTransform: 'uppercase', color: theme.dark ? '#68D0B2' : '#087C71' }}>{children}</Text>;
}

export function ProgressBar({ value, max, color, theme, label }: {
  readonly value: number; readonly max: number; readonly color: string; readonly theme: Theme; readonly label: string;
}) {
  return <View accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
    style={{ height: 12, backgroundColor: theme.raised, borderRadius: 8, overflow: 'hidden' }}>
    <View style={{ height: '100%', width: `${Math.min(100, value / max * 100)}%`, backgroundColor: color,
      borderRadius: 8 }} />
  </View>;
}

const styles = StyleSheet.create({
  button: { minWidth: 56, minHeight: 56, paddingVertical: 12, borderRadius: 17,
    flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'PoppinsBold', fontSize: 18 },
});
