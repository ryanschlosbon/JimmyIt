import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
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
  /** Starts a game on a board this many times wider than tall. */
  readonly onStart: (mode: TapQuestMode, aspectRatio: number) => Promise<'local' | null>; readonly toy: TapQuestToy;
  /** Chosen on the play screen's banner, and changeable here. */
  readonly mode: TapQuestMode; readonly onMode: (mode: TapQuestMode) => void;
  /** True after Play on the banner: start a game as soon as this screen opens, if one can start. */
  readonly autoStart: boolean; readonly onAutoStarted: () => void;
}) {
  const { width } = useWindowDimensions();
  const compact = width < SIZE.compactWidth;
  // The board fills the space beside the buttons: a rectangle wider than tall, never needing a scroll.
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [stylusPaused, setStylusPaused] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const { status, saveStatus, state, pause, resume, submit } = run;
  const active = status === 'running' || status === 'paused';
  const stylusInJimmy = toy.connected && toy.stylusStowed;
  const areaAspect = area.height > 0 ? area.width / area.height : TAP_QUEST_VIEW.minAspectRatio;
  // A new game takes the shape of the space it has now; a running one keeps the shape it started with.
  const aspect = state && active ? state.aspectRatio
    : Math.max(TAP_QUEST_VIEW.minAspectRatio, Math.min(TAP_QUEST_VIEW.maxAspectRatio, areaAspect));
  const boardWidth = Math.floor(Math.min(area.width, area.height * aspect));
  const boardHeight = Math.floor(boardWidth / aspect);
  const startPattern = () => {
    if (starting) return;
    setStylusPaused(false);
    setStarting(true);
    setStartFailed(false);
    onStart(mode, aspect).catch(() => setStartFailed(true)).finally(() => setStarting(false));
  };

  // Play on the banner starts straight away (once the board has its size, so the game gets its shape), or the
  // moment the stylus comes out of Jimmy.
  const measured = area.width > 0 && area.height > 0;
  useEffect(() => {
    if (!autoStart || stylusInJimmy || saveStatus === 'saving' || !measured) return;
    onAutoStarted();
    if (!active) startPattern();
  }, [autoStart, stylusInJimmy, measured]); // a request, the stylus coming out, or the first layout starts a game

  // Switching apps pauses the game (leaving the screen ends it, in App.tsx); points are never lost.
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
    if (status !== 'running' || boardWidth <= 0) return;
    const x = Math.max(0, Math.min(1, event.nativeEvent.locationX / boardWidth));
    const y = Math.max(0, Math.min(1, event.nativeEvent.locationY / boardHeight));
    submit({ type: 'touch', phase, point: { x, y } });
  };

  // The game's positions are in board heights.
  const scale = (value: number) => value * boardHeight;
  const recall = state?.memoryPhase === 'recall';
  const windowMs = state ? state.settings.targetDurationMs + (state.feedback.generousTiming ? state.settings.timingWindowMs : 0) : 1;

  const buttonStyle = { width: '100%' } as const;
  return <View style={{ flex: 1, gap: SPACE.md }}>
    <ActivityHeader theme={theme} activity="tapQuest" title="Tap Quest" slim />

    {(stylusInJimmy || stylusPaused) && <View style={{ backgroundColor: theme.softCoral, borderRadius: RADIUS.md,
      paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, flexDirection: 'row', gap: SPACE.md, alignItems: 'center' }}>
      <Icon name="toy" color={theme.accentText} />
      <View style={{ flex: 1 }}><Body theme={theme} small color={theme.text}>
        {stylusPaused ? 'The stylus is back in Jimmy, so we paused. Take it out and tap Resume.'
          : autoStart ? 'Take the stylus out of Jimmy and the game will start.' : 'Take the stylus out of Jimmy to play.'}
      </Body></View>
    </View>}

    {!active && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.md }}>
      {TAP_QUEST_MODES.map(option => <Button key={option.mode} theme={theme} label={option.title}
        selected={mode === option.mode} color={mode === option.mode ? theme.mint : undefined}
        onPress={() => onMode(option.mode)} disabled={saveStatus === 'saving'} compact />)}
      <View style={{ flexBasis: 240, flexGrow: 1 }}>
        <Body theme={theme} small>{TAP_QUEST_MODES.find(option => option.mode === mode)?.caption}</Body>
      </View>
    </View>}

    <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: SPACE.md }}>
      <View style={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' }}
        onLayout={event => setArea({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
        {boardWidth > 0 && <View accessible accessibilityLabel={active
          ? 'Tap Quest play area. Touch the circles with your stylus.' : 'Tap Quest play area'}
          onStartShouldSetResponder={() => status === 'running'} onMoveShouldSetResponder={() => status === 'running'}
          onResponderGrant={event => touch(event, 'down')} onResponderMove={event => touch(event, 'move')}
          onResponderRelease={event => touch(event, 'up')} onResponderTerminationRequest={() => false}
          style={{ width: boardWidth, height: boardHeight, borderRadius: RADIUS.lg, backgroundColor: theme.raised,
            borderWidth: TAP_QUEST_VIEW.borderWidth, borderColor: theme.border,
            opacity: status === 'paused' ? .5 : 1, overflow: 'hidden' }}>
          <Svg width={boardWidth} height={boardHeight} pointerEvents="none">
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
        </View>}
      </View>

      {/* Progress and every button, stacked beside the board so it can use the full height. */}
      <View style={{ width: compact ? TAP_QUEST_VIEW.sideWidthCompact : TAP_QUEST_VIEW.sideWidth, gap: SPACE.sm }}>
        {state && active && <View style={{ gap: SPACE.xs, padding: SPACE.md, borderRadius: RADIUS.md,
          backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border }}>
          <Body theme={theme} small>{state.mode === 'calm' ? `${state.matchedCount} circles`
            : `${Math.min(state.targetIndex + 1, state.targetCount)} of ${state.targetCount}`}</Body>
          <Body theme={theme} small>{state.score} points</Body>
          {state.remainingMs !== null && <ProgressBar theme={theme} value={state.remainingMs} max={windowMs}
            color={theme.teal} label="Time for this target" />}
          {state.mode === 'memory' && <Body theme={theme} small>{recall ? 'Your turn: tap them in the same order.'
            : 'Watch the circles light up…'}</Body>}
        </View>}
        {!active && <Button theme={theme} label={starting ? 'Starting…' : status === 'finished' ? 'Play again' : 'Start'}
          icon="sparkle" color={theme.yellow} onPress={startPattern} style={buttonStyle}
          disabled={starting || saveStatus === 'saving' || stylusInJimmy || boardWidth <= 0} />}
        {status === 'running' && <Button theme={theme} label="Pause" onPress={pause} style={buttonStyle} />}
        {status === 'paused' && <Button theme={theme} label="Resume" icon="timer" color={theme.yellow} style={buttonStyle}
          onPress={() => { setStylusPaused(false); resume(); }} disabled={stylusInJimmy} />}
        {state?.mode === 'memory' && recall && status === 'running' && <Button theme={theme} label="Show me again"
          icon="undo" onPress={() => submit({ type: 'replaySequence' })} style={buttonStyle} />}
        {state?.mode === 'calm' && status === 'running' && <Button theme={theme} label="I’m done" icon="check"
          color={theme.mint} onPress={() => submit({ type: 'finish' })} style={buttonStyle} />}
        {active && state?.mode !== 'calm' && <Button theme={theme} label="Finish now" icon="check" onPress={run.quit}
          style={buttonStyle} />}
        {status === 'finished' && saveStatus === 'failed' && <Button theme={theme} label="Retry saving" icon="check"
          onPress={run.retrySave} style={buttonStyle} />}
        {startFailed && <View accessibilityLiveRegion="polite"><Body theme={theme} small>
          That didn’t start. Please try again.</Body></View>}
      </View>
    </View>
  </View>;
}
