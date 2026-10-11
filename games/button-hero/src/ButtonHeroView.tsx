import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { ButtonHeroAction, ButtonHeroDifficulty, ButtonHeroState } from './button-hero';
import { NOTE_STYLES, noteCenterX } from './note-highway';

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

function SmileNote({ lane, size }: { readonly lane: number; readonly size: number }) {
  const style = NOTE_STYLES[lane % NOTE_STYLES.length] ?? NOTE_STYLES[0];
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: style.fill,
    borderWidth: 2.5, borderColor: style.face, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ flexDirection: 'row', gap: size * 0.18, marginTop: size * 0.02 }}>
      <View style={{ width: size * 0.105, height: size * 0.15, borderRadius: size * 0.1,
        backgroundColor: style.face }} />
      <View style={{ width: size * 0.105, height: size * 0.15, borderRadius: size * 0.1,
        backgroundColor: style.face }} />
    </View>
    <View style={{ width: size * 0.31, height: size * 0.15, marginTop: size * 0.07,
      borderBottomWidth: 2.5, borderLeftWidth: 2, borderRightWidth: 2, borderColor: style.face,
      borderBottomLeftRadius: size * 0.17, borderBottomRightRadius: size * 0.17 }} />
  </View>;
}

/** The face art uses native shapes inspired by the references, without embedding the screenshot. */
export function ButtonHeroView({ state, status, difficulty, theme, onDifficulty, onStart, onPause, onResume, onButton }: {
  readonly state: ButtonHeroState | null;
  readonly status: 'idle' | 'running' | 'paused' | 'finished';
  readonly difficulty: ButtonHeroDifficulty;
  readonly theme: HeroTheme;
  readonly onDifficulty: (difficulty: ButtonHeroDifficulty) => void;
  readonly onStart: () => void;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onButton: (action: ButtonHeroAction) => void;
}) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const compactLandscape = windowWidth > windowHeight && windowHeight <= 900;
  const tightLandscape = compactLandscape && windowHeight <= 750;
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReducedMotion(value); })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  const travelMs = difficulty === 'easy' ? 2600 : difficulty === 'hard' ? 1400 : 2000;
  const faceSize = trackWidth < 420 ? 46 : 58;
  const trackHeight = tightLandscape ? 120 : compactLandscape ? 160 : 204;
  const trackCenterY = trackHeight / 2;
  const targetX = Math.max(42, Math.min(82, trackWidth * 0.13));
  const lastNoteMs = state?.notes[state.notes.length - 1]?.atMs ?? 3000;
  const progress = state ? Math.max(0, Math.min(1, (state.elapsedMs - 3000) / (lastNoteMs - 2700))) : 0;
  const recentFeedback = state && state.elapsedMs - state.lastJudgmentAtMs < 520;
  const hitFeedback = recentFeedback && (state.lastJudgment === 'perfect' || state.lastJudgment === 'good');
  const nearTarget = state?.notes.some((note, index) => !state.resolved.includes(index)
    && Math.abs(note.atMs - state.elapsedMs) < 260) ?? false;
  const targetPulse = nearTarget && !reducedMotion && state ? Math.sin(state.elapsedMs / 350) * 2 + 2 : 0;

  return <View style={{ gap: tightLandscape ? 8 : compactLandscape ? 10 : 18,
    padding: tightLandscape ? 8 : compactLandscape ? 12 : 18, borderRadius: 28,
    backgroundColor: theme.softCoral, borderWidth: 2, borderColor: theme.border }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={{ color: theme.text,
          fontSize: compactLandscape ? 29 : 34, fontWeight: 'bold' }}>Button Hero</Text>
        {status !== 'running' && status !== 'paused'
          && <Text style={{ color: theme.secondary, fontSize: 16 }}>Press when a smiling face reaches the ring!</Text>}
      </View>
      <View style={{ width: tightLandscape ? 72 : 92, height: tightLandscape ? 46 : 62,
        borderRadius: 26, backgroundColor: theme.yellow,
        alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] }}>
        <Text style={{ color: theme.ink, fontWeight: 'bold', fontSize: 16 }}>BEAT!</Text>
      </View>
    </View>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {(['easy', 'normal', 'hard'] as const).map(choice => {
        const selected = difficulty === choice;
        const disabled = status === 'running' || status === 'paused';
        return <Pressable key={choice} accessibilityRole="button" accessibilityLabel={`${choice} difficulty`}
          accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => onDifficulty(choice)}
          style={{ minHeight: 56, paddingHorizontal: 15, borderRadius: 16, justifyContent: 'center',
            backgroundColor: selected ? theme.yellow : theme.surface, borderWidth: selected ? 2.5 : 1.5,
            borderColor: selected ? theme.ink : theme.border }}>
          <Text style={{ color: selected ? theme.ink : theme.text, fontSize: 16, fontWeight: 'bold' }}>
            {selected ? '✓ ' : ''}{choice}
          </Text>
        </Pressable>;
      })}
      <Pressable accessibilityRole="button" onPress={status === 'paused' ? onResume : status === 'running' ? onPause : onStart}
        style={{ alignSelf: 'flex-start', minHeight: 56, paddingHorizontal: 20, borderRadius: 28,
          backgroundColor: status === 'running' ? theme.surface : theme.teal, justifyContent: 'center',
          borderWidth: status === 'running' ? 1.5 : 0, borderColor: theme.border }}>
        <Text style={{ color: status === 'running' ? theme.text : theme.ink, fontSize: 18, fontWeight: 'bold' }}>
          {status === 'paused' ? 'Resume song' : status === 'running' ? 'Pause' : status === 'finished' ? 'Play again' : 'Start the song'}
        </Text>
      </Pressable>
    </View>

    {state && <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: trackWidth < 420 ? 6 : 10 }}>
        {[['SCORE', state.score], ['COMBO', state.combo], ['ACCURACY', `${state.accuracyPercent}%`]].map(([label, value]) =>
          <View key={label} style={{ flexGrow: 1, minWidth: trackWidth < 420 ? 78 : 88, borderRadius: 18,
            padding: compactLandscape || trackWidth < 420 ? 8 : 13,
            backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border }}>
            <Text style={{ color: theme.secondary, fontSize: 13, fontWeight: 'bold', letterSpacing: 1 }}>{label}</Text>
            <Text style={{ color: theme.text, fontSize: compactLandscape || trackWidth < 420 ? 22
              : label === 'COMBO' ? 30 : 25,
              fontWeight: 'bold' }}>{value}</Text>
          </View>)}
      </View>
      <View accessibilityRole="progressbar" accessibilityLabel="Song progress"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        style={{ height: compactLandscape ? 10 : 13, backgroundColor: theme.raised,
          borderRadius: 8, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${progress * 100}%`, borderRadius: 8,
          backgroundColor: theme.teal }} />
      </View>

      <View onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
        style={{ height: trackHeight, borderRadius: 24, overflow: 'hidden', backgroundColor: theme.navy,
          borderWidth: 3, borderColor: theme.purple }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: trackCenterY, height: 3,
          backgroundColor: theme.purple, opacity: 0.55 }} />
        <View style={{ position: 'absolute', left: targetX - faceSize / 2 - 9 - targetPulse,
          top: trackCenterY - faceSize / 2 - 9 - targetPulse, width: faceSize + 18 + targetPulse * 2,
          height: faceSize + 18 + targetPulse * 2, borderRadius: faceSize,
          borderWidth: hitFeedback ? 6 : 4,
          borderColor: hitFeedback ? theme.yellow : recentFeedback ? theme.coral : theme.mint,
          backgroundColor: theme.navy, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.surface, fontWeight: 'bold', fontSize: 11 }}>HIT</Text>
        </View>
        {state.notes.map((note, index) => {
          if (state.resolved.includes(index) || trackWidth === 0) return null;
          const center = noteCenterX(note.atMs, state.elapsedMs, travelMs, trackWidth, targetX);
          if (center < -faceSize || center > trackWidth + faceSize) return null;
          const displayedCenter = reducedMotion ? Math.max(targetX,
            Math.min(trackWidth - faceSize / 2, targetX + Math.ceil((note.atMs - state.elapsedMs) / 500) * 58)) : center;
          const noteStyle = NOTE_STYLES[note.lane % NOTE_STYLES.length] ?? NOTE_STYLES[0];
          return <View key={index} accessibilityLabel={`${noteStyle.name} note, ${noteStyle.key} button`}
            style={{ position: 'absolute', left: displayedCenter - faceSize / 2,
              top: trackCenterY - faceSize / 2, alignItems: 'center' }}>
            <SmileNote lane={note.lane} size={faceSize} />
            <Text style={{ color: theme.surface, fontWeight: 'bold', fontSize: 14,
              backgroundColor: theme.navy, borderRadius: 5, paddingHorizontal: 5 }}>{noteStyle.key}</Text>
          </View>;
        })}
        {hitFeedback && <View pointerEvents="none" style={{ position: 'absolute',
          left: targetX - faceSize / 2 - 20, top: trackCenterY - faceSize / 2 - 20,
          width: faceSize + 40, height: faceSize + 40, borderRadius: faceSize,
          borderWidth: state.lastJudgment === 'perfect' ? 5 : 3,
          borderColor: state.lastJudgment === 'perfect' ? theme.yellow : theme.mint,
          opacity: reducedMotion ? 0.6 : Math.max(0, 1 - (state.elapsedMs - state.lastJudgmentAtMs) / 520) }} />}
      </View>

      <View accessibilityLiveRegion="polite" style={{ minHeight: compactLandscape ? 40 : 58,
        alignItems: 'center', justifyContent: 'center' }}>
        {state.countdownMs > 0 ? <Text style={{ color: theme.text, fontSize: 26, fontWeight: 'bold' }}>
          Ready in {Math.ceil(state.countdownMs / 1000)}
        </Text> : status === 'paused' ? <Text style={{ color: theme.text, fontSize: 21 }}>Take your time. Ready when you are.</Text>
          : status === 'finished' ? <Text style={{ color: theme.text, fontSize: 23, fontWeight: 'bold' }}>Song complete!</Text>
            : recentFeedback ? <Text style={{ color: theme.text, fontSize: 25, fontWeight: 'bold' }}>
              {state.lastJudgment === 'perfect' ? `PERFECT!  +${state.lastPoints}`
                : state.lastJudgment === 'good' ? `GOOD!  +${state.lastPoints}`
                  : state.lastJudgment === 'miss' ? 'Miss — keep going!' : 'Try the next face!'}
            </Text> : <Text style={{ color: theme.secondary, fontSize: 17 }}>Follow the beat at your own pace.</Text>}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: trackWidth < 420 ? 6 : 10,
        justifyContent: 'center' }}>
        {Array.from({ length: state.laneCount }, (_, lane) => {
          const noteStyle = NOTE_STYLES[lane % NOTE_STYLES.length] ?? NOTE_STYLES[0];
          return <Pressable key={lane} accessibilityRole="button"
            accessibilityLabel={`${noteStyle.name} button, ${noteStyle.key}`}
            disabled={status !== 'running'} onPressIn={() => onButton({ type: 'button', lane, pressed: true })}
            style={({ pressed }) => ({ minWidth: trackWidth < 420 ? 58 : 65,
              minHeight: compactLandscape ? 64 : 78, paddingHorizontal: 6,
              borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 2,
              backgroundColor: pressed ? theme.surface : noteStyle.fill,
              borderWidth: 2.5, borderColor: theme.navy, opacity: status === 'running' ? 1 : 0.65 })}>
            <SmileNote lane={lane} size={34} />
            <Text style={{ color: noteStyle.face, fontSize: 17, fontWeight: 'bold' }}>
              {noteStyle.key}{state.laneCount > 4 ? ` · ${lane + 1}` : ''}
            </Text>
          </Pressable>;
        })}
      </View>

      {status === 'finished' && <View style={{ backgroundColor: theme.surface, borderRadius: 22,
        padding: 18, gap: 8, borderWidth: 1.5, borderColor: theme.border }}>
        <Text style={{ color: theme.text, fontSize: 24, fontWeight: 'bold' }}>Your song</Text>
        <Text style={{ color: theme.text, fontSize: 18 }}>Score {state.score} · Best combo {state.bestCombo}</Text>
        <Text style={{ color: theme.text, fontSize: 18 }}>Accuracy {state.accuracyPercent}%</Text>
        <Text style={{ color: theme.secondary, fontSize: 16 }}>
          Perfect {state.perfect} · Good {state.good} · Miss {state.misses}
        </Text>
      </View>}
    </>}
  </View>;
}
