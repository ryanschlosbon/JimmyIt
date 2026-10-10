import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import { Tappable } from './Tappable';
import { FONTS, RADIUS, SIZE, TYPE } from '../design/tokens';
import type { Theme } from '../theme';

/** The standard button. `color` fills it (ink text); without it, it is a white outlined button. */
export function Button({ label, icon, onPress, theme, color, compact = false, disabled = false,
  selected = false, accessibilityLabel, style, vertical = false }: {
  readonly label?: string; readonly icon?: IconName; readonly onPress: () => void; readonly theme: Theme;
  readonly color?: string; readonly compact?: boolean; readonly disabled?: boolean; readonly selected?: boolean;
  readonly accessibilityLabel?: string; readonly style?: StyleProp<ViewStyle>;
  readonly vertical?: boolean;
}) {
  const foreground = color ? theme.ink : theme.text;
  return <Tappable accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected }}
    disabled={disabled} onPress={onPress} focusColor={theme.focus}
    style={[styles.button, {
      backgroundColor: color ?? theme.surface, borderColor: selected ? theme.teal : color ?? theme.border,
      borderWidth: selected ? 2.5 : 1.5, paddingHorizontal: compact ? 16 : 24,
      flexDirection: vertical ? 'column' : 'row', gap: vertical ? 4 : 10,
    }, style]}>
    {icon && <Icon name={icon} color={foreground} size={25} />}
    {label && <Text style={[styles.label, { color: foreground, fontSize: vertical ? 16 : 18 }]}>{label}</Text>}
  </Tappable>;
}

/** An on/off row for settings: title, current state in words, and a switch. */
export function SwitchRow({ theme, title, onText, offText, value, onChange }: {
  readonly theme: Theme; readonly title: string; readonly onText: string; readonly offText: string;
  readonly value: boolean; readonly onChange: (next: boolean) => void;
}) {
  return <Tappable accessibilityRole="switch" accessibilityLabel={title} accessibilityState={{ checked: value }}
    onPress={() => onChange(!value)} focusColor={theme.focus} pressShade={0.05}
    style={[styles.switchRow, { backgroundColor: theme.raised }]}>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 18, color: theme.text }}>{title}</Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: TYPE.caption + 1, color: theme.secondary }}>
        {value ? onText : offText}</Text>
    </View>
    <View style={[styles.track, { backgroundColor: value ? theme.teal : theme.border,
      alignItems: value ? 'flex-end' : 'flex-start' }]}>
      <View style={styles.thumb} />
    </View>
  </Tappable>;
}

export function Heading({ children, theme, size = 34, level = 2 }: {
  readonly children: ReactNode; readonly theme: Theme; readonly size?: number;
  readonly level?: number;
}) {
  return <Text accessibilityRole="header" aria-level={level} style={{ fontFamily: FONTS.display, fontSize: size,
    lineHeight: size * 1.12, color: theme.text }}>{children}</Text>;
}

export function Body({ children, theme, small = false, color }: {
  readonly children: ReactNode; readonly theme: Theme; readonly small?: boolean; readonly color?: string;
}) {
  return <Text style={{ fontFamily: FONTS.body, fontSize: small ? TYPE.small : 24,
    lineHeight: small ? 25 : 34, color: color ?? theme.secondary }}>{children}</Text>;
}

export function Eyebrow({ children, theme }: { readonly children: ReactNode; readonly theme: Theme }) {
  return <Text style={{ fontFamily: FONTS.bodyBold, fontSize: TYPE.caption, letterSpacing: 2,
    textTransform: 'uppercase', color: theme.accentText }}>{children}</Text>;
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
  button: { minWidth: SIZE.touchTarget, minHeight: SIZE.touchTarget, paddingVertical: 12, borderRadius: RADIUS.md,
    flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FONTS.bodyBold, fontSize: 18 },
  switchRow: { flexDirection: 'row', gap: 15, alignItems: 'center', minHeight: 72, paddingHorizontal: 18,
    paddingVertical: 12, borderRadius: RADIUS.md },
  track: { width: 56, height: 34, borderRadius: 17, padding: 4, justifyContent: 'center' },
  thumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF' },
});
