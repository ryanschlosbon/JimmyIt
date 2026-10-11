import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { BUTTON_HERO_MOVES, type ButtonHeroAction, type ButtonHeroDifficulty, type ButtonHeroMove,
  type ButtonHeroState } from './button-hero';
import { MOVE_STYLES, riffWidth } from './note-highway';

interface HeroTheme {
  readonly text: string;
  readonly secondary: string;
  readonly ink: string;
  readonly surface: string;
  readonly raised: string;
  readonly border: string;
  readonly navy: string;
  readonly yellow: string;
  readonly mint: string;
  readonly coral: string;
  readonly teal: string;
  readonly purple: string;
  readonly softCoral: string;
}

const GLYPHS: Readonly<Record<ButtonHeroMove, string>> = { click: '●', left: '◀', right: '▶', spin: '↻' };

/** A note: the move's symbol in a colored circle, with the word underneath, big enough to read while it moves. */
function MoveNote({ move, size }: { readonly move: ButtonHeroMove; readonly size: number }) {
  const style = MOVE_STYLES[move];
  return <View style={{ width: size, alignItems: 'center', gap: 4 }}>
    <View style={{ width: size * 0.72, height: size * 0.72, borderRadius: size, backgroundColor: style.fill,
      borderWidth: 3, borderColor: style.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: style.ink, fontSize: size * 0.34, fontWeight: 'bold', lineHeight: size * 0.42 }}>
        {GLYPHS[move]}
      </Text>
    </View>
    <View style={{ paddingHorizontal: 8, paddingVertical: 1, borderRadius: 10, backgroundColor: style.fill }}>
      <Text style={{ color: style.ink, fontSize: size * 0.22, fontWeight: 'bold' }}>{style.word}</Text>
    </View>
  </View>;
}

/** The note highway with words for each toy move. Notes glide between game ticks so they stay easy to follow. */
export function ButtonHeroView({ state, status, difficulty, theme, tickMs = 40, onDifficulty, onStart, onPause,
  onResume, onButton }: {
  readonly state: ButtonHeroState | null;
  readonly status: 'idle' | 'running' | 'paused' | 'finished';
  readonly difficulty: ButtonHeroDifficulty;
  readonly theme: HeroTheme;
  /** The runner's tick, so the notes can glide smoothly to where the next tick will put them. */
  readonly tickMs?: number;
  readonly onDifficulty: (difficulty: ButtonHeroDifficulty) => void;
  readonly onStart: () => void;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onButton: (action: ButtonHeroAction) => void;
}) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const clock = useRef(new Animated.Value(0)).current;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const compactLandscape = windowWidth > windowHeight && windowHeight <= 900;
  const narrow = trackWidth > 0 && trackWidth < 520;
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReducedMotion(value); })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  const elapsedMs = state?.elapsedMs ?? 0;
  useEffect(() => {
    if (reducedMotion || status !== 'running') {
      clock.setValue(elapsedMs);
      return;
    }
    const glide = Animated.timing(clock, { toValue: elapsedMs + tickMs, duration: tickMs, easing: Easing.linear,
      useNativeDriver: false });
    glide.start();
    return () => glide.stop();
  }, [clock, elapsedMs, reducedMotion, status, tickMs]);

  const noteSize = narrow ? 76 : 96;
  const trackHeight = compactLandscape ? 160 : 190;
  const targetX = Math.max(noteSize * 0.7, Math.min(110, trackWidth * 0.14));
  const travelMs = state?.travelMs ?? 5_000;
  const firstNoteMs = state?.notes[0]?.atMs ?? 0;
  const lastNote = state?.notes[state.notes.length - 1];
  const songEndMs = lastNote ? lastNote.atMs + lastNote.holdMs : 1;
  const progress = state ? Math.max(0, Math.min(1, (elapsedMs - firstNoteMs) / Math.max(1, songEndMs - firstNoteMs))) : 0;
  const recentFeedback = state && elapsedMs - state.lastJudgmentAtMs < 900;
  const hitFeedback = recentFeedback && (state.lastJudgment === 'perfect' || state.lastJudgment === 'good');
  const running = status === 'running';
  // The note the child should do next, said in words for screen readers and as a big prompt.
  const nextIndex = state?.notes.findIndex((_, index) => !state.resolved.includes(index)) ?? -1;
  const nextNote = state && nextIndex >= 0 ? state.notes[nextIndex] : undefined;
  const xFor = (atMs: number) => clock.interpolate({ inputRange: [atMs - travelMs, atMs],
    outputRange: [trackWidth, targetX], extrapolate: 'extend' });

  return <View style={{ gap: compactLandscape ? 10 : 16, padding: compactLandscape ? 12 : 18, borderRadius: 28,
    backgroundColor: theme.softCoral, borderWidth: 2, borderColor: theme.border }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ gap: 4, flexShrink: 1 }}>
        <Text accessibilityRole="header" style={{ color: theme.text,
          fontSize: compactLandscape ? 29 : 34, fontWeight: 'bold' }}>Button Hero</Text>
        {!running && status !== 'paused' && <Text style={{ color: theme.secondary, fontSize: 17 }}>
          Do each move as it reaches the ring. Purple bars mean keep spinning!
        </Text>}
      </View>
      {state && <View style={{ minWidth: 92, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6,
        backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center' }}>
        <Text style={{ color: theme.secondary, fontSize: 13, fontWeight: 'bold', letterSpacing: 1 }}>COMBO</Text>
        <Text style={{ color: theme.text, fontSize: 26, fontWeight: 'bold' }}>{state.combo}</Text>
      </View>}
    </View>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {(['easy', 'normal', 'hard'] as const).map(choice => {
        const selected = difficulty === choice;
        const disabled = running || status === 'paused';
        return <Pressable key={choice} accessibilityRole="button" accessibilityLabel={`${choice} difficulty`}
          accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => onDifficulty(choice)}
          style={{ minHeight: 56, paddingHorizontal: 15, borderRadius: 16, justifyContent: 'center',
            backgroundColor: selected ? theme.yellow : theme.surface, borderWidth: selected ? 2.5 : 1.5,
            borderColor: selected ? theme.ink : theme.border, opacity: disabled && !selected ? 0.6 : 1 }}>
          <Text style={{ color: selected ? theme.ink : theme.text, fontSize: 16, fontWeight: 'bold' }}>
            {selected ? '✓ ' : ''}{choice}
          </Text>
        </Pressable>;
      })}
      <Pressable accessibilityRole="button" onPress={status === 'paused' ? onResume : running ? onPause : onStart}
        style={{ alignSelf: 'flex-start', minHeight: 56, paddingHorizontal: 20, borderRadius: 28,
          backgroundColor: running ? theme.surface : theme.teal, justifyContent: 'center',
          borderWidth: running ? 1.5 : 0, borderColor: theme.border }}>
        <Text style={{ color: running ? theme.text : theme.ink, fontSize: 18, fontWeight: 'bold' }}>
          {status === 'paused' ? 'Resume song' : running ? 'Pause' : status === 'finished' ? 'Play again' : 'Start the song'}
        </Text>
      </Pressable>
    </View>

    {state && <>
      <View accessibilityRole="progressbar" accessibilityLabel="Song progress"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        style={{ height: 12, backgroundColor: theme.raised, borderRadius: 8, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${progress * 100}%`, borderRadius: 8, backgroundColor: theme.teal }} />
      </View>

      <View onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
        style={{ height: trackHeight, borderRadius: 24, overflow: 'hidden', backgroundColor: theme.navy,
          borderWidth: 3, borderColor: theme.purple }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: trackHeight / 2 - 2, height: 4,
          backgroundColor: theme.purple, opacity: 0.45 }} />
        <View style={{ position: 'absolute', left: targetX - noteSize / 2 - 8, top: trackHeight / 2 - noteSize / 2 - 8,
          width: noteSize + 16, height: noteSize + 16, borderRadius: noteSize, borderWidth: hitFeedback ? 7 : 5,
          borderColor: hitFeedback ? theme.yellow : theme.mint }} />
        {trackWidth > 0 && state.notes.map((note, index) => {
          if (state.resolved.includes(index) && note.holdMs === 0) return null;
          const style = MOVE_STYLES[note.move];
          if (note.holdMs > 0) {
            const width = riffWidth(note.holdMs, travelMs, trackWidth, targetX);
            const done = state.resolved.includes(index);
            const barHeight = noteSize * 0.72;
            return <Animated.View key={index} accessibilityLabel={`Spin note: ${style.action}`}
              style={{ position: 'absolute', left: 0, top: trackHeight / 2 - barHeight / 2, width, height: barHeight,
                borderRadius: barHeight / 2, backgroundColor: style.fill, borderWidth: 3, borderColor: style.ink,
                overflow: 'hidden', opacity: done ? 0.45 : 1, transform: [{ translateX: xFor(note.atMs) }] }}>
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${(state.riffProgress[index] ?? 0) * 100}%`, backgroundColor: theme.yellow, opacity: 0.8 }} />
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 }}>
                <Text style={{ color: style.ink, fontSize: noteSize * 0.32, fontWeight: 'bold' }}>{GLYPHS.spin}</Text>
                <Text numberOfLines={1} style={{ flexShrink: 1, color: style.ink, fontSize: noteSize * 0.22,
                  fontWeight: 'bold' }}>{style.action}!</Text>
              </View>
            </Animated.View>;
          }
          return <Animated.View key={index} accessibilityLabel={`${style.word} note: ${style.action}`}
            style={{ position: 'absolute', left: -noteSize / 2, top: trackHeight / 2 - noteSize * 0.36,
              transform: [{ translateX: xFor(note.atMs) }] }}>
            <MoveNote move={note.move} size={noteSize} />
          </Animated.View>;
        })}
      </View>

      <View accessibilityLiveRegion="polite" style={{ minHeight: compactLandscape ? 44 : 60,
        alignItems: 'center', justifyContent: 'center' }}>
        {state.countdownMs > 0 ? <Text style={{ color: theme.text, fontSize: 26, fontWeight: 'bold' }}>
          Ready in {Math.ceil(state.countdownMs / 1000)}
        </Text> : status === 'paused' ? <Text style={{ color: theme.text, fontSize: 21 }}>Take your time. Ready when you are.</Text>
          : status === 'finished' ? <Text style={{ color: theme.text, fontSize: 23, fontWeight: 'bold' }}>Song complete!</Text>
            : recentFeedback && state.lastJudgment !== 'tryAgain' ? <Text style={{ color: theme.text, fontSize: 25,
              fontWeight: 'bold' }}>
              {state.lastJudgment === 'perfect' ? `Perfect!  +${state.lastPoints}`
                : state.lastJudgment === 'good' ? `Nice!  +${state.lastPoints}`
                  : state.lastPoints > 0 ? `Good spinning!  +${state.lastPoints}` : 'Here comes the next one!'}
            </Text> : nextNote ? <Text style={{ color: theme.text, fontSize: 22, fontWeight: 'bold' }}>
              Next: {MOVE_STYLES[nextNote.move].action}
            </Text> : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: narrow ? 8 : 12, justifyContent: 'center' }}>
        {BUTTON_HERO_MOVES.map(move => {
          const style = MOVE_STYLES[move];
          const hold = move === 'spin';
          return <Pressable key={move} accessibilityRole="button"
            accessibilityLabel={hold ? `${style.word}: hold to keep spinning` : style.action}
            disabled={!running}
            onPressIn={() => onButton({ type: 'button', move, pressed: true })}
            onPressOut={hold ? () => onButton({ type: 'button', move, pressed: false }) : undefined}
            style={({ pressed }) => ({ minWidth: narrow ? 92 : 120, minHeight: compactLandscape ? 72 : 88,
              paddingHorizontal: 10, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 2,
              backgroundColor: pressed || (hold && state.spinning) ? theme.surface : style.fill,
              borderWidth: 3, borderColor: style.ink, opacity: running ? 1 : 0.6 })}>
            <Text style={{ color: style.ink, fontSize: 24, fontWeight: 'bold' }}>{GLYPHS[move]} {style.word}</Text>
            <Text style={{ color: style.ink, fontSize: 13, fontWeight: 'bold' }}>
              {hold ? `Hold · key ${style.key}` : `Key ${style.key}`}
            </Text>
          </Pressable>;
        })}
      </View>

      {status === 'finished' && <View style={{ backgroundColor: theme.surface, borderRadius: 22,
        padding: 18, gap: 8, borderWidth: 1.5, borderColor: theme.border }}>
        <Text style={{ color: theme.text, fontSize: 24, fontWeight: 'bold' }}>Your song</Text>
        <Text style={{ color: theme.text, fontSize: 18 }}>Score {state.score} · Best combo {state.bestCombo}</Text>
        <Text style={{ color: theme.secondary, fontSize: 16 }}>
          Perfect {state.perfect} · Nice {state.good} · Accuracy {state.accuracyPercent}%
        </Text>
      </View>}
    </>}
  </View>;
}
