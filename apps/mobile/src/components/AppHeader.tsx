// The bar at the top of every screen (design/Example_Header.png): Jimmy and the
// JimmyIt wordmark on the left; Play, Rewards and Settings on the right.
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FONTS, RADIUS, SIZE } from '../design/tokens';
import type { Theme } from '../theme';
import type { Connection } from '../use-jimmy';
import { Icon, type IconName } from './Icon';
import { Jimmy } from './Jimmy';
import { Tappable } from './Tappable';

export type HeaderTab = 'play' | 'rewards' | 'settings';

const CONNECTION_LABEL: Readonly<Record<Connection, string>> = {
  connected: 'Jimmy connected',
  searching: 'Finding Jimmy…',
  confirming: 'Say yes on Jimmy ▶',
  disconnected: 'Find Jimmy',
};

export function AppHeader({ theme, compact, active, connection, onTab, topInset = 0 }: {
  readonly theme: Theme; readonly compact: boolean; readonly active: HeaderTab | null;
  readonly connection: Connection; readonly onTab: (tab: HeaderTab) => void;
  /** The status bar's height: the header's background reaches up behind it to the top of the screen. */
  readonly topInset?: number;
}) {
  // The narrowest phones keep the face and drop the wordmark so all three buttons stay full size.
  const narrow = useWindowDimensions().width < 350;
  const buttonSize = compact ? SIZE.headerButtonCompact : SIZE.headerButton;
  const statusColor = connection === 'connected' ? theme.mint
    : connection === 'disconnected' ? theme.coral : theme.yellow;
  const tabs: readonly { tab: HeaderTab; icon: IconName; label: string; color: string }[] = [
    { tab: 'play', icon: 'play', label: 'Play', color: theme.nav.play },
    { tab: 'rewards', icon: 'trophy', label: 'Rewards and high scores', color: theme.nav.rewards },
    { tab: 'settings', icon: 'gear', label: 'Settings', color: theme.nav.settings },
  ];
  return <View role="banner" style={[styles.bar, { backgroundColor: theme.header, borderColor: theme.headerBorder,
    paddingTop: topInset }]}>
    <View style={[styles.inner, { paddingHorizontal: compact ? 12 : 28, paddingVertical: compact ? 8 : 14 }]}>
      <Tappable accessibilityLabel="JimmyIt, play games" onPress={() => onTab('play')} focusColor={theme.focus}
        pressShade={0} style={[styles.brand, { gap: compact ? 8 : 12 }]}>
        <Jimmy face size={compact ? 42 : 62} color={theme.mint} />
        {!narrow && <Text style={{ fontFamily: FONTS.displayHeavy, fontSize: compact ? 26 : 44, lineHeight: compact ? 34 : 54,
          color: theme.text }}>JimmyIt</Text>}
      </Tappable>
      <View style={[styles.actions, { gap: compact ? 8 : 18 }]}>
        {!compact && <Tappable accessibilityLabel={`${CONNECTION_LABEL[connection]}. Open settings`}
          onPress={() => onTab('settings')} focusColor={theme.focus} pressShade={0.06}
          style={[styles.status, { backgroundColor: theme.surface, borderColor: theme.headerBorder }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 15, color: theme.text }}>{CONNECTION_LABEL[connection]}</Text>
        </Tappable>}
        {tabs.map(item => <View key={item.tab} style={{ alignItems: 'center' }}>
          <Tappable accessibilityRole="tab" accessibilityLabel={item.label}
            accessibilityState={{ selected: active === item.tab }} onPress={() => onTab(item.tab)}
            focusColor={theme.focus} style={[styles.button, { width: buttonSize, height: buttonSize,
              backgroundColor: item.color }]}>
            <Icon name={item.icon} color={theme.ink} size={buttonSize * 0.56} weight={item.icon === 'trophy' ? 1.6 : 2.2} />
            {compact && item.tab === 'settings' && <View style={[styles.badge, { backgroundColor: statusColor,
              borderColor: theme.surface }]} />}
          </Tappable>
          <View style={[styles.marker, { backgroundColor: active === item.tab ? theme.text : 'transparent' }]} />
        </View>)}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: 2, zIndex: 2 },
  inner: { width: '100%', maxWidth: 1400, alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', minHeight: SIZE.touchTarget, borderRadius: RADIUS.md,
    paddingRight: 6 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 16,
    borderRadius: RADIUS.pill, borderWidth: 1.5, marginBottom: 10 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  button: { borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, borderWidth: 2.5 },
  marker: { width: 26, height: 5, borderRadius: 3, marginTop: 6 },
});
