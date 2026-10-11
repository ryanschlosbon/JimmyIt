import { useEffect, useState } from 'react';
import { AppState, Text, View, type LayoutRectangle } from 'react-native';
import type { GameRunControls } from '@jimmyit/app-kit';
import type { TimedPracticeState } from '@jimmyit/game-timed-practice';
import { Body, Button, Heading, ProgressBar } from '../components/Controls';
import { ActivityHeader } from '../components/ActivityHeader';
import { Icon, type IconName } from '../components/Icon';
import { TIMED_PRACTICE_SECONDS } from '../games';
import { FONTS, SIZE, SPACE } from '../design/tokens';
import type { Theme } from '../theme';

/** The simulated toy's controls this screen can press (development and web previews only). */
export interface VirtualToy {
  tap(switchId: 'clicker'): void;
  spin(degrees: number): void;
  turnScrew(detents: number): void;
}

type DemoMove = 'press' | 'spin' | 'screw';

export function TimedScreen({ theme, timed, onStart, durationS, onDuration, connected, searching, onConnect, virtualToy }: {
  readonly theme: Theme; readonly timed: GameRunControls<TimedPracticeState, never>;
  readonly onStart: (durationMs: number) => void;
  /** Chosen on the play screen's banner, and changeable here. */
  readonly durationS: number; readonly onDuration: (seconds: number) => void;
  readonly connected: boolean; readonly searching: boolean;
  readonly onConnect: () => void; readonly virtualToy: VirtualToy | null;
}) {
  // Sized from the space this screen gets: side by side when wide, stacked when tall, never scrolling.
  const [area, setArea] = useState<LayoutRectangle | null>(null);
  const compact = (area?.width ?? 0) < SIZE.compactWidth;
  const wide = area !== null && area.width > area.height * 1.2;
  const roomy = (area?.height ?? 0) > 640;
  const { status, saveStatus, pause } = timed;
  const active = status === 'running' || status === 'paused';
  const saving = saveStatus === 'saving';
  const saved = saveStatus === 'saved';
  const moves = timed.state?.moves;
  const totalMoves = timed.state?.totalMoves ?? 0;
  const remainingMs = timed.remainingMs ?? durationS * 1000;
  const runDurationMs = active || status === 'finished' ? timed.elapsedMs + remainingMs : durationS * 1000;

  // Switching apps pauses practice (leaving the screen ends it, in App.tsx); points are never lost.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') pause(); });
    return () => { subscription.remove(); pause(); };
  }, [pause]);

  const controls: readonly { move: DemoMove; label: string; icon: IconName; color: string; act: (toy: VirtualToy) => void }[] = [
    { move: 'press', label: 'Press button', icon: 'toy', color: theme.coral, act: toy => toy.tap('clicker') },
    { move: 'spin', label: 'Spin dial', icon: 'spin', color: theme.mint, act: toy => toy.spin(90) },
    // One knob move is a quarter turn: 6 of its 24 clicks.
    { move: 'screw', label: 'Turn knob', icon: 'sparkle', color: theme.yellow, act: toy => toy.turnScrew(6) },
  ];
  const moveCards = controls.map(control => <View key={control.move} style={{ flex: 1, borderRadius: 23,
    padding: SPACE.md, backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1.5, gap: SPACE.sm,
    alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontFamily: FONTS.display, fontSize: roomy ? 44 : 36, lineHeight: roomy ? 50 : 42,
      color: theme.text }}>{moves?.[control.move] ?? 0}</Text>
    {virtualToy ? <Button theme={theme} icon={control.icon} label={control.label} color={control.color}
      onPress={() => control.act(virtualToy)} disabled={status !== 'running'} compact={compact}
      style={{ width: '100%' }} />
      : <Body theme={theme} small>{control.label} on Jimmy</Body>}
  </View>);
  return <View style={{ flex: 1, gap: SPACE.md }} onLayout={event => setArea(event.nativeEvent.layout)}>
    <ActivityHeader theme={theme} activity="timed" title="Timed Run" slim />
    <View style={{ backgroundColor: theme.softMint, borderRadius: 18, paddingHorizontal: SPACE.lg,
      paddingVertical: SPACE.sm, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Icon name="bluetooth" color={theme.accentText} />
      <View style={{ flex: 1 }}><Body theme={theme} small color={theme.text}>
        {virtualToy ? 'Virtual toy · The buttons below press the simulated Jimmy. Open “Toy” for every control.'
          : 'Press, spin, twist, slide — every move on Jimmy counts. Leaving this screen ends practice and '
            + 'keeps your points.'}
      </Body></View>
    </View>
    <View style={{ flex: 1, minHeight: 0, flexDirection: wide ? 'row' : 'column', gap: SPACE.md }}>
      <View style={{ flex: wide ? 3 : 1, backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1.5,
        borderRadius: 26, padding: compact ? SPACE.lg : SPACE.xl, alignItems: 'center', justifyContent: 'center',
        gap: roomy ? 20 : SPACE.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
          {TIMED_PRACTICE_SECONDS.map(seconds => <Button key={seconds} theme={theme} label={`${seconds} sec`} compact
            selected={durationS === seconds} color={durationS === seconds ? theme.mint : undefined}
            disabled={active || saving} onPress={() => onDuration(seconds)} />)}
        </View>
        <Text accessibilityLabel={`${Math.ceil(remainingMs / 1000)} seconds remaining`}
          style={{ fontFamily: FONTS.display, fontSize: roomy ? 96 : 72, lineHeight: roomy ? 105 : 80, color: theme.text }}>
          {Math.ceil(remainingMs / 1000)}<Text style={{ fontSize: 26 }}> sec</Text>
        </Text>
        <View style={{ width: '100%', maxWidth: 620 }}><ProgressBar theme={theme} value={status === 'idle' ? 0
          : runDurationMs - remainingMs} max={runDurationMs} color={theme.teal} label="Practice time" /></View>
        <View accessibilityLiveRegion="polite"><Heading theme={theme} size={roomy ? 30 : 24}>
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
      <View style={{ flex: wide ? 2 : undefined, flexDirection: wide ? 'column' : 'row', gap: SPACE.md }}>
        {moveCards}
      </View>
    </View>
  </View>;
}
