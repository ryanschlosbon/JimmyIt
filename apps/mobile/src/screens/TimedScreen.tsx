import { useEffect, useState } from 'react';
import { AppState, Text, View, useWindowDimensions } from 'react-native';
import type { GameRunControls } from '@jimmyit/app-kit';
import type { TimedPracticeState } from '@jimmyit/game-timed-practice';
import { Body, Button, Eyebrow, Heading, ProgressBar } from '../components/Controls';
import { Icon, type IconName } from '../components/Icon';
import { TIMED_PRACTICE_SECONDS } from '../games';
import type { Theme } from '../theme';

/** The simulated toy's controls this screen can press (development and web previews only). */
export interface VirtualToy {
  tap(switchId: 'clicker'): void;
  spin(degrees: number): void;
  turnScrew(detents: number): void;
}

type DemoMove = 'press' | 'spin' | 'screw';

export function TimedScreen({ theme, timed, onStart, connected, searching, onConnect, virtualToy }: {
  readonly theme: Theme; readonly timed: GameRunControls<TimedPracticeState, never>;
  readonly onStart: (durationMs: number) => void; readonly connected: boolean; readonly searching: boolean;
  readonly onConnect: () => void; readonly virtualToy: VirtualToy | null;
}) {
  const [durationS, setDurationS] = useState(TIMED_PRACTICE_SECONDS[0] ?? 30);
  const { width } = useWindowDimensions();
  const compact = width < 680;
  const { status, saveStatus, pause } = timed;
  const active = status === 'running' || status === 'paused';
  const saving = saveStatus === 'saving';
  const saved = saveStatus === 'saved';
  const moves = timed.state?.moves;
  const totalMoves = timed.state?.totalMoves ?? 0;
  const remainingMs = timed.remainingMs ?? durationS * 1000;
  const runDurationMs = active || status === 'finished' ? timed.elapsedMs + remainingMs : durationS * 1000;

  // Leaving the screen or switching apps pauses practice; points are never lost.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') pause(); });
    return () => { subscription.remove(); pause(); };
  }, [pause]);

  const controls: readonly { move: DemoMove; label: string; icon: IconName; color: string; act: (toy: VirtualToy) => void }[] = [
    { move: 'press', label: 'Press button', icon: 'toy', color: theme.coral, act: toy => toy.tap('clicker') },
    { move: 'spin', label: 'Spin dial', icon: 'spin', color: theme.mint, act: toy => toy.spin(90) },
    { move: 'screw', label: 'Turn screw', icon: 'sparkle', color: theme.yellow, act: toy => toy.turnScrew(1) },
  ];
  return <View style={{ gap: 26 }}>
    <View style={{ gap: 8 }}><Eyebrow theme={theme}>Move & discover</Eyebrow>
      <Heading theme={theme} level={1} size={compact ? 36 : 44}>Timed toy practice</Heading>
      <Body theme={theme}>Go at your own pace. Every move counts.</Body>
    </View>
    <View style={{ backgroundColor: theme.softMint, borderRadius: 18, padding: 20, flexDirection: 'row', gap: 12 }}>
      <Icon name="bluetooth" color={theme.dark ? theme.mint : '#087C71'} />
      <View style={{ flex: 1 }}><Body theme={theme} small color={theme.text}>
        {virtualToy ? 'Virtual toy · The buttons below press the simulated Jimmy. Open “Toy” for every control.'
          : 'Press, spin, twist, slide — every move on Jimmy counts.'}
      </Body></View>
    </View>
    <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1.5,
      borderRadius: 26, padding: compact ? 24 : 32, alignItems: 'center', gap: 20 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
        {TIMED_PRACTICE_SECONDS.map(seconds => <Button key={seconds} theme={theme} label={`${seconds} sec`} compact
          selected={durationS === seconds} color={durationS === seconds ? theme.mint : undefined}
          disabled={active || saving} onPress={() => setDurationS(seconds)} />)}
      </View>
      <Text accessibilityLabel={`${Math.ceil(remainingMs / 1000)} seconds remaining`}
        style={{ fontFamily: 'Baloo', fontSize: compact ? 76 : 96, lineHeight: compact ? 85 : 105, color: theme.text }}>
        {Math.ceil(remainingMs / 1000)}<Text style={{ fontSize: 26 }}> sec</Text>
      </Text>
      <View style={{ width: '100%', maxWidth: 620 }}><ProgressBar theme={theme} value={status === 'idle' ? 0
        : runDurationMs - remainingMs} max={runDurationMs} color={theme.teal} label="Practice time" /></View>
      <View accessibilityLiveRegion="polite"><Heading theme={theme} size={30}>
        {status === 'paused' ? 'Take a little break.' : status === 'finished' ? 'Look at all those little moves!'
          : `${totalMoves} little moves · ${timed.score?.score ?? 0} points`}
      </Heading></View>
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {!connected && !active && <Button theme={theme} label={searching ? 'Finding Jimmy…' : 'Find Jimmy to start'}
          icon="bluetooth" color={theme.mint} onPress={onConnect} disabled={searching} />}
        {connected && (status === 'idle' || (status === 'finished' && saved)) && <Button theme={theme}
          label={status === 'idle' ? 'Start practice' : 'Play again'} icon="timer" color={theme.yellow}
          onPress={() => onStart(durationS * 1000)} disabled={saving} />}
        {status === 'running' && <Button theme={theme} label="Pause" onPress={timed.pause} />}
        {status === 'paused' && <Button theme={theme} label="Resume" icon="timer" color={theme.yellow}
          onPress={timed.resume} />}
        {active && <Button theme={theme} label="Finish now" icon="check" onPress={timed.quit} />}
        {status === 'finished' && !saved && <Button theme={theme} label={saving ? 'Saving your points…' : 'Retry saving'}
          onPress={timed.retrySave} disabled={saving} icon="check" />}
      </View>
    </View>
    <View style={{ flexDirection: width < 1000 ? 'column' : 'row', gap: 20 }}>
      {controls.map(control => <View key={control.move} style={{ flex: 1, borderRadius: 23,
        padding: 24, backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1.5, gap: 18,
        alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Baloo', fontSize: 44, color: theme.text }}>{moves?.[control.move] ?? 0}</Text>
        {virtualToy ? <Button theme={theme} icon={control.icon} label={control.label} color={control.color}
          onPress={() => control.act(virtualToy)} disabled={status !== 'running'}
          style={{ width: '100%', minHeight: 78 }} />
          : <Body theme={theme} small>{control.label} on Jimmy</Body>}
      </View>)}
    </View>
    <Body theme={theme} small>Take breaks whenever you like. Leaving this screen or switching apps pauses practice.</Body>
  </View>;
}
