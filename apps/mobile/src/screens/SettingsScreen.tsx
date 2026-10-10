import { Pressable, View, useWindowDimensions } from 'react-native';
import { Body, Button, Eyebrow, Heading, ProgressBar } from '../components/Controls';
import { Icon, type IconName } from '../components/Icon';
import { Jimmy } from '../components/Jimmy';
import type { Theme } from '../theme';
import type { JimmyState } from '../use-jimmy';

export function SettingsScreen({ theme, state, replayIntro }: {
  readonly theme: Theme; readonly state: JimmyState; readonly replayIntro: () => void;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 850;
  const status = state.connection === 'connected' ? 'Connected' : state.connection === 'searching' ? 'Searching…' : 'Disconnected';
  const color = state.connection === 'connected' ? theme.mint : state.connection === 'searching' ? theme.yellow : theme.coral;
  const panels: readonly { title: string; eyebrow: string; icon: IconName; color: string }[] = [
    { title: 'Connection', eyebrow: 'BLUETOOTH', icon: 'bluetooth', color: theme.mint },
    { title: 'Calibration', eyebrow: 'SENSITIVITY', icon: 'toy', color: theme.coral },
    { title: 'Dark mode', eyebrow: 'APPEARANCE', icon: 'moon', color: theme.pink },
  ];
  return <View style={{ gap: 26 }}>
    <View style={{ backgroundColor: theme.surface, borderRadius: 26, padding: 30,
      borderWidth: 2, borderColor: theme.yellow, gap: 8 }}>
      <Eyebrow theme={theme}>Grown-ups’ area</Eyebrow><Heading theme={theme} level={1} size={44}>Jimmy settings</Heading>
      <Body theme={theme} small>A little setup for a lot of play.</Body>
    </View>
    <View style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 25, borderWidth: 1.5,
      borderColor: theme.border, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
      <Jimmy face size={76} color={color} />
      <View style={{ flex: 1, minWidth: 160, gap: 3 }}><Eyebrow theme={theme}>Your Jimmy</Eyebrow>
        <Heading theme={theme} size={29}>Jimmy 01</Heading>
        <View accessibilityLiveRegion="polite"><Body theme={theme} small>{status} · Simulated device</Body></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, backgroundColor: theme.raised, borderRadius: 16, padding: 16 }}>
        <Icon name="battery" color={theme.dark ? theme.mint : '#087C71'} />
        <Body theme={theme} small>{state.connection === 'connected' ? '84% battery' : 'Battery —'}</Body>
      </View>
    </View>
    <View style={{ flexDirection: compact ? 'column' : 'row', gap: 20 }}>
      {panels.map((panel, index) => <View key={panel.title} style={{ flex: 1, backgroundColor: theme.surface,
        borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: theme.border }}>
        <View style={{ backgroundColor: panel.color, height: 110, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ borderRadius: 18, padding: 13, borderWidth: 2, borderColor: theme.navy,
            transform: [{ rotate: '-5deg' }], backgroundColor: '#FFFFFF55' }}>
            <Icon name={panel.icon} size={31} color={theme.navy} />
          </View>
        </View>
        <View style={{ padding: 24, gap: 18 }}>
          <View style={{ gap: 7 }}><Eyebrow theme={theme}>{panel.eyebrow}</Eyebrow><Heading theme={theme} size={30}>{panel.title}</Heading></View>
          {index === 0 && <>
            <Body theme={theme} small>{state.connection === 'connected' ? 'Jimmy is ready for your next adventure.'
              : state.connection === 'searching' ? 'Looking for your little play partner…' : 'Find Jimmy to try the connection demo.'}</Body>
            <Button theme={theme} color={theme.mint} icon="bluetooth"
              label={state.connection === 'connected' ? 'Disconnect' : state.connection === 'searching' ? 'Cancel search' : 'Find Jimmy'}
              onPress={state.connection === 'disconnected' ? state.connect : state.disconnect} />
            <Button theme={theme} label="Reconnect" icon="spin" onPress={state.connect}
              disabled={state.connection === 'searching'} />
          </>}
          {index === 1 && <>
            <Body theme={theme} small>Place Jimmy on a flat surface. Keep the controls still while we get ready.</Body>
            <View accessibilityLiveRegion="polite"><Body theme={theme} small>
              {state.calibrating ? `Getting ready… ${state.calibration}%` : state.calibration === 100 ? '✓ Calibration complete' : 'Ready when you are'}
            </Body></View>
            <ProgressBar theme={theme} color={theme.coral} value={state.calibration} max={100} label="Calibration progress" />
            <Button theme={theme} label={state.calibrating ? 'Calibrating…' : state.calibration === 100 ? 'Calibrate again' : 'Start calibration'}
              icon="toy" onPress={state.calibrate} disabled={state.connection !== 'connected' || state.calibrating} />
            {state.connection !== 'connected' && <Body theme={theme} small>Connect Jimmy first.</Body>}
          </>}
          {index === 2 && <>
            <Body theme={theme} small>A softer glow for quieter play. Your choice stays saved on this device.</Body>
            <View style={{ flexDirection: 'row', gap: 15, justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: theme.raised, padding: 18, borderRadius: 17 }}>
              <View style={{ flex: 1, gap: 5 }}><Heading theme={theme} size={23}>Use dark colors</Heading>
                <Body theme={theme} small>{state.dark ? 'Dark mode is on' : 'Dark mode is off'}</Body></View>
              <Pressable accessibilityRole="switch" accessibilityLabel="Use dark colors"
                accessibilityState={{ checked: state.dark }} onPress={() => state.setDark(!state.dark)}
                style={({ pressed }) => ({ minWidth: 64, minHeight: 56, justifyContent: 'center',
                  alignItems: 'center', opacity: pressed ? .7 : 1 })}>
                <View style={{ width: 54, height: 32, borderRadius: 20, padding: 4,
                  backgroundColor: state.dark ? '#087C71' : '#8798A8',
                  alignItems: state.dark ? 'flex-end' : 'flex-start' }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' }} />
                </View>
              </Pressable>
            </View>
          </>}
        </View>
      </View>)}
    </View>
    <View style={{ flexDirection: 'row', gap: 14, backgroundColor: theme.raised, borderRadius: 18, padding: 22 }}>
      <Icon name="sparkle" color={theme.dark ? theme.yellow : '#8A6500'} />
      <View style={{ flex: 1, gap: 4 }}><Heading theme={theme} size={23}>A safe place to practice</Heading>
        <Body theme={theme} small>Connection and calibration are simulated in this frontend preview. Drawings and points stay on this device.</Body>
      </View>
    </View>
    <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1.5,
      borderRadius: 20, padding: 24, gap: 14, alignItems: 'flex-start' }}>
      <Heading theme={theme} size={26}>A little hello from Jimmy</Heading>
      <Body theme={theme} small>Watch the short welcome again. Reduced motion uses a still greeting.</Body>
      <Button theme={theme} label="Replay welcome" icon="sparkle" onPress={replayIntro} />
    </View>
  </View>;
}
