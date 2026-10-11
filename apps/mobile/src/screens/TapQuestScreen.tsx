import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View, useWindowDimensions, type GestureResponderEvent, type LayoutRectangle } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import type { GameRunControls } from '@jimmyit/app-kit';
import type { TapQuestAction, TapQuestMode, TapQuestState } from '@jimmyit/game-tap-quest';
import { Body, Button, ProgressBar } from '../components/Controls';
import { ActivityHeader } from '../components/ActivityHeader';
import { Icon } from '../components/Icon';
import { TAP_QUEST_MODES } from '../games';
import { FONTS, RADIUS, SIZE, SPACE, TAP_QUEST_VIEW, TYPE } from '../design/tokens';
import type { Theme } from '../theme';

/** The bits of the toy this screen cares about: the stylus lives in Jimmy. */
export interface TapQuestToy {
  readonly connected: boolean;
  readonly stylusStowed: boolean;
}

export function TapQuestScreen({ theme, run, onStart, toy, mode, onMode, autoStart, onAutoStarted }: {
  readonly theme: Theme; readonly run: GameRunControls<TapQuestState, TapQuestAction>;
  readonly onStart: (mode: TapQuestMode) => Promise<'local' | 'gemini' | null>; readonly toy: TapQuestToy;
  /** Chosen on the play screen's banner, and changeable here. */
  readonly mode: TapQuestMode; readonly onMode: (mode: TapQuestMode) => void;
  /** True after Play on the banner: start a game as soon as this screen opens, if one can start. */
  readonly autoStart: boolean; readonly onAutoStarted: () => void;
}) {
  const { width } = useWindowDimensions();
  const compact = width < SIZE.compactWidth;
  const [layout, setLayout] = useState<LayoutRectangle>({ x: 0, y: 0, width: 1, height: 1 });
  const [stylusPaused, setStylusPaused] = useState(false);
  const [starting, setStarting] = useState(false);
  const [patternMessage, setPatternMessage] = useState<string | null>(null);
  const { status, saveStatus, state, pause, resume, submit } = run;
  const active = status === 'running' || status === 'paused';
  const stylusInJimmy = toy.connected && toy.stylusStowed;
  const startPattern = () => {
    if (starting) return;
    setStylusPaused(false);
    setStarting(true);
    setPatternMessage(null);
    onStart(mode).then(source => {
      if (source) setPatternMessage(source === 'gemini' ? 'New Gemini pattern' : 'New offline pattern');
    }).catch(() => setPatternMessage('Could not start this pattern. Please try again.'))
      .finally(() => setStarting(false));
  };

  // Play on the banner starts straight away, or the moment the stylus comes out of Jimmy.
  useEffect(() => {
    if (!autoStart || stylusInJimmy || saveStatus === 'saving') return;
    onAutoStarted();
    if (!active) startPattern();
  }, [autoStart, stylusInJimmy]); // a request, or the stylus coming out, starts a game

  // Leaving the screen or switching apps pauses the game; points are never lost.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') pause(); });
    return () => { subscription.remove(); pause(); };
  }, [pause]);

  // Hardware: putting the stylus back into Jimmy pauses the game.
  const wasStowed = useRef(toy.stylusStowed);
  useEffect(() => {
    if (toy.connected && toy.stylusStowed && !wasStowed.current && status === 'running') {
      pause();
      setStylusPaused(true);
    }
    if (!toy.stylusStowed) setStylusPaused(false);
    wasStowed.current = toy.stylusStowed;
  }, [toy.connected, toy.stylusStowed, status, pause]);

  const touch = (event: GestureResponderEvent, phase: 'down' | 'move' | 'up') => {
    if (status !== 'running') return;
    const x = Math.max(0, Math.min(1, event.nativeEvent.locationX / layout.width));
    const y = Math.max(0, Math.min(1, event.nativeEvent.locationY / layout.height));
    submit({ type: 'touch', phase, point: { x, y } });
  };

  const size = layout.width;
  const scale = (value: number) => value * size;
  const recall = state?.memoryPhase === 'recall';
  const windowMs = state ? state.settings.targetDurationMs + (state.feedback.generousTiming ? state.settings.timingWindowMs : 0) : 1;

  return <View style={{ gap: SPACE.xl }}>
    <ActivityHeader theme={theme} activity="tapQuest" title="Tap Quest" />

    {toy.connected && <View style={{ backgroundColor: stylusInJimmy ? theme.softCoral : theme.softMint, borderRadius: RADIUS.md,
      padding: SPACE.lg, flexDirection: 'row', gap: SPACE.md, alignItems: 'center' }}>
      <Icon name="toy" color={theme.accentText} />
      <View style={{ flex: 1 }}><Body theme={theme} small color={theme.text}>
        {stylusPaused ? 'The stylus is back in Jimmy, so we paused. Take it out and tap Resume.'
          : stylusInJimmy ? (autoStart ? 'Take the stylus out of Jimmy and the game will start.'
            : 'Take the stylus out of Jimmy to play.')
          : 'Stylus out and ready. Jimmy will cheer you on!'}
      </Body></View>
    </View>}

    {!active && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md }}>
      {TAP_QUEST_MODES.map(option => <Button key={option.mode} theme={theme} label={option.title}
        selected={mode === option.mode} color={mode === option.mode ? theme.mint : undefined}
        onPress={() => onMode(option.mode)} disabled={saveStatus === 'saving'} compact />)}
    </View>}
    {!active && <Body theme={theme} small>{TAP_QUEST_MODES.find(option => option.mode === mode)?.caption}</Body>}

    <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: TAP_QUEST_VIEW.borderWidth,
      borderRadius: RADIUS.lg, padding: compact ? SPACE.md : SPACE.xl, gap: SPACE.lg, alignItems: 'center' }}>
      {state && active && <View style={{ width: '100%', maxWidth: TAP_QUEST_VIEW.boardMaxWidth, gap: SPACE.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Body theme={theme} small>{state.mode === 'calm' ? `${state.matchedCount} circles`
            : `${Math.min(state.targetIndex + 1, state.targetCount)} of ${state.targetCount}`}</Body>
          <Body theme={theme} small>{state.score} points</Body>
        </View>
        {state.remainingMs !== null && <ProgressBar theme={theme} value={state.remainingMs} max={windowMs}
          color={theme.teal} label="Time for this target" />}
        {state.mode === 'memory' && <Body theme={theme} small>{recall ? 'Your turn: tap them in the same order.'
          : 'Watch the circles light up…'}</Body>}
      </View>}

      <View accessible accessibilityLabel={active ? 'Tap Quest play area. Touch the circles with your stylus.'
        : 'Tap Quest play area'}
        onLayout={event => setLayout(event.nativeEvent.layout)}
        onStartShouldSetResponder={() => status === 'running'} onMoveShouldSetResponder={() => status === 'running'}
        onResponderGrant={event => touch(event, 'down')} onResponderMove={event => touch(event, 'move')}
        onResponderRelease={event => touch(event, 'up')}
        style={{ width: '100%', maxWidth: TAP_QUEST_VIEW.boardMaxWidth, aspectRatio: 1,
          borderRadius: RADIUS.lg, backgroundColor: theme.raised,
          opacity: status === 'paused' ? .5 : 1, overflow: 'hidden' }}>
        <Svg width={size} height={layout.height} pointerEvents="none">
          {state && active && state.mode === 'trace' && <>
            <Polyline points={state.path.map(point => `${scale(point.x)},${scale(point.y)}`).join(' ')}
              fill="none" stroke={theme.teal} strokeWidth={scale(state.settings.targetRadius) * 1.4}
              strokeLinecap="round" strokeLinejoin="round" opacity={.35} />
            {state.path.map((point, i) => <Circle key={i} cx={scale(point.x)} cy={scale(point.y)}
              r={TAP_QUEST_VIEW.pathDotSize} fill={theme.teal} />)}
          </>}
          {state && active && state.mode === 'memory' && state.choices.map((choice, i) => <Circle key={i}
            cx={scale(choice.x)} cy={scale(choice.y)} r={scale(choice.radius)} fill={theme.surface}
            stroke={theme.purple} strokeWidth={TAP_QUEST_VIEW.targetBorderWidth} />)}
          {state?.target && active && <Circle cx={scale(state.target.x)} cy={scale(state.target.y)}
            r={scale(state.target.radius)} fill={state.mode === 'memory' ? theme.purple : theme.coral}
            stroke={theme.navy} strokeWidth={TAP_QUEST_VIEW.targetBorderWidth} />}
        </Svg>
        {!active && <View pointerEvents="none" style={{ position: 'absolute', inset: 0,
          alignItems: 'center', justifyContent: 'center', padding: SPACE.xl }}>
          <Text style={{ fontFamily: FONTS.body, fontSize: TYPE.body, color: theme.secondary, textAlign: 'center' }}>
            {status === 'finished' ? 'Great tapping!' : 'Pick a mode, then Start'}</Text>
        </View>}
      </View>

      <View style={{ flexDirection: 'row', gap: SPACE.md, flexWrap: 'wrap', justifyContent: 'center' }}>
        {!active && <Button theme={theme} label={starting ? 'Making pattern…' : status === 'finished' ? 'Play again' : 'Start'}
          icon="sparkle" color={theme.yellow} onPress={startPattern}
          disabled={starting || saveStatus === 'saving' || stylusInJimmy} />}
        {status === 'running' && <Button theme={theme} label="Pause" onPress={pause} />}
        {status === 'paused' && <Button theme={theme} label="Resume" icon="timer" color={theme.yellow}
          onPress={() => { setStylusPaused(false); resume(); }} disabled={stylusInJimmy} />}
        {state?.mode === 'memory' && recall && status === 'running' && <Button theme={theme} label="Show me again"
          icon="undo" onPress={() => submit({ type: 'replaySequence' })} />}
        {state?.mode === 'calm' && status === 'running' && <Button theme={theme} label="I’m done" icon="check"
          color={theme.mint} onPress={() => submit({ type: 'finish' })} />}
        {active && state?.mode !== 'calm' && <Button theme={theme} label="Finish now" icon="check" onPress={run.quit} />}
        {status === 'finished' && saveStatus === 'failed' && <Button theme={theme} label="Retry saving" icon="check"
          onPress={run.retrySave} />}
      </View>
      {patternMessage && <View accessibilityLiveRegion="polite"><Body theme={theme} small>{patternMessage}</Body></View>}
    </View>
    <Body theme={theme} small>Take breaks whenever you like. Leaving this screen pauses the game.</Body>
  </View>;
}
