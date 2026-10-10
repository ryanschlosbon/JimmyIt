import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Text, View, useWindowDimensions } from 'react-native';
import { Body, Button, Eyebrow, Heading, ProgressBar } from '../components/Controls';
import { Icon, type IconName } from '../components/Icon';
import type { Theme } from '../theme';
import type { TimedChallenge, ToyAction } from '../timed-challenge';

export function TimedScreen({ theme, challenge, saving, saved, onStart, onRetry }: {
  readonly theme: Theme; readonly challenge: TimedChallenge; readonly saving: boolean; readonly saved: boolean;
  readonly onStart: (durationMs: number) => void; readonly onRetry: () => void;
}) {
  const state = useSyncExternalStore(challenge.subscribe, challenge.getState, challenge.getState);
  const [durationS, setDurationS] = useState(30);
  const { width } = useWindowDimensions();
  const compact = width < 680;
  const totalActions = state.actions.press + state.actions.spin + state.actions.squeeze;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') challenge.pause(); });
    return () => { subscription.remove(); challenge.pause(); };
  }, [challenge]);
  const controls: readonly { action: ToyAction; label: string; icon: IconName; color: string }[] = [
    { action: 'press', label: 'Press button', icon: 'toy', color: theme.coral },
    { action: 'spin', label: 'Spin dial', icon: 'spin', color: theme.mint },
    { action: 'squeeze', label: 'Squeeze', icon: 'sparkle', color: theme.yellow },
  ];
  return <View style={{ gap: 26 }}>
    <View style={{ gap: 8 }}><Eyebrow theme={theme}>Move & discover</Eyebrow>
      <Heading theme={theme} level={1} size={compact ? 36 : 44}>Timed toy practice</Heading>
      <Body theme={theme}>Go at your own pace. Every move counts.</Body>
    </View>
    <View style={{ backgroundColor: theme.softMint, borderRadius: 18, padding: 20, flexDirection: 'row', gap: 12 }}>
      <Icon name="bluetooth" color={theme.dark ? theme.mint : '#087C71'} />
      <View style={{ flex: 1 }}><Body theme={theme} small color={theme.text}>
        Frontend demo · Tap the controls below to simulate pressing, spinning, and squeezing Jimmy. No toy is needed.
      </Body></View>
    </View>
    <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1.5,
      borderRadius: 26, padding: compact ? 24 : 32, alignItems: 'center', gap: 20 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
        {[30, 60, 90].map(seconds => <Button key={seconds} theme={theme} label={`${seconds} sec`} compact
          selected={durationS === seconds} color={durationS === seconds ? theme.mint : undefined}
          disabled={state.type === 'running' || state.type === 'paused' || saving}
          onPress={() => setDurationS(seconds)} />)}
      </View>
      <Text accessibilityLabel={`${Math.ceil(state.type === 'ready' ? durationS : state.remainingMs / 1000)} seconds remaining`}
        style={{ fontFamily: 'Baloo', fontSize: compact ? 76 : 96, lineHeight: compact ? 85 : 105, color: theme.text }}>
        {state.type === 'ready' ? durationS : Math.ceil(state.remainingMs / 1000)}<Text style={{ fontSize: 26 }}> sec</Text>
      </Text>
      <View style={{ width: '100%', maxWidth: 620 }}><ProgressBar theme={theme} value={state.type === 'ready' ? 0
        : state.durationMs - state.remainingMs} max={state.durationMs} color={theme.teal} label="Practice time" /></View>
      <View accessibilityLiveRegion="polite"><Heading theme={theme} size={30}>
        {state.type === 'paused' ? 'Take a little break.' : state.type === 'complete' ? 'Look at all those little moves!'
          : `${totalActions} little moves · ${totalActions * 5} points`}
      </Heading></View>
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {(state.type === 'ready' || (state.type === 'complete' && saved)) && <Button theme={theme}
          label={state.type === 'ready' ? 'Start practice' : 'Play again'} icon="timer" color={theme.yellow}
          onPress={() => onStart(durationS * 1000)} disabled={saving} />}
        {state.type === 'running' && <Button theme={theme} label="Pause" onPress={challenge.pause} />}
        {state.type === 'paused' && <Button theme={theme} label="Resume" icon="timer" color={theme.yellow}
          onPress={challenge.resume} />}
        {(state.type === 'running' || state.type === 'paused') && <Button theme={theme} label="Finish now"
          icon="check" onPress={challenge.finish} />}
        {state.type === 'complete' && !saved && <Button theme={theme} label={saving ? 'Saving your points…' : 'Retry saving'}
          onPress={onRetry} disabled={saving} icon="check" />}
      </View>
    </View>
    <View style={{ flexDirection: width < 1000 ? 'column' : 'row', gap: 20 }}>
      {controls.map(control => <View key={control.action} style={{ flex: 1, borderRadius: 23,
        padding: 24, backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1.5, gap: 18,
        alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Baloo', fontSize: 44, color: theme.text }}>{state.actions[control.action]}</Text>
        <Button theme={theme} icon={control.icon} label={control.label} color={control.color}
          onPress={() => challenge.record(control.action)} disabled={state.type !== 'running'}
          style={{ width: '100%', minHeight: 78 }} />
      </View>)}
    </View>
    <Body theme={theme} small>Take breaks whenever you like. Leaving this screen or switching apps pauses practice.</Body>
  </View>;
}
