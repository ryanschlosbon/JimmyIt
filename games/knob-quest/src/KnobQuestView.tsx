import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { KnobQuestAction } from './knob-input';
import type { KnobQuestDifficulty, KnobQuestState, Rect } from './knob-quest';

interface QuestTheme {
  readonly text: string; readonly secondary: string; readonly ink: string; readonly border: string;
  readonly surface: string; readonly raised: string; readonly coral: string; readonly yellow: string;
  readonly mint: string; readonly purple: string; readonly navy: string;
  readonly banners: { readonly quest: { readonly background: string; readonly accent: string; readonly shadow: string } };
}

/** Draws the player. The app passes its Jimmy; `color` follows his lives (green, yellow, red). */
export type KnobQuestPlayerRenderer = (props: { readonly size: number; readonly color: string }) => ReactNode;

/** How much of the level is in view across; the height follows the play area's shape. */
const CAMERA_WIDTH = 68;
const SPARK_MS = 480;
const LAND_SQUASH_MS = 240;
const RESPAWN_FADE_MS = 700;
const SPARKS = [-150, -125, -100, -80, -55, -30, 200, 340].map((deg, i) => ({ deg, speed: 26 + (i % 3) * 8 }));

/** A plain smiling face, used when no player renderer is given (tests, other apps). */
function DefaultPlayer({ size, color }: { readonly size: number; readonly color: string }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color,
    alignItems: 'center', justifyContent: 'center', gap: size * 0.08 }}>
    <View style={{ flexDirection: 'row', gap: size * 0.2 }}>
      {[0, 1].map(eye => <View key={eye} style={{ width: size * 0.16, height: size * 0.2, borderRadius: size,
        backgroundColor: '#7A0B5A' }} />)}
    </View>
    <View style={{ width: size * 0.36, height: size * 0.14, borderBottomWidth: 2, borderColor: '#7A0B5A',
      borderBottomLeftRadius: size, borderBottomRightRadius: size }} />
  </View>;
}

export function KnobQuestView({ state, status, difficulty, theme, renderPlayer, onDifficulty, onStart, onAxis }: {
  readonly state: KnobQuestState | null;
  readonly status: 'idle' | 'running' | 'paused' | 'finished';
  readonly difficulty: KnobQuestDifficulty;
  readonly theme: QuestTheme;
  readonly renderPlayer?: KnobQuestPlayerRenderer;
  readonly onDifficulty: (difficulty: KnobQuestDifficulty) => void;
  readonly onStart: () => void;
  readonly onAxis: (action: KnobQuestAction) => void;
}) {
  const [area, setArea] = useState({ width: 0, height: 0 });
  const player = renderPlayer ?? ((props) => <DefaultPlayer {...props} />);
  const lifeColors = [theme.coral, theme.yellow, theme.mint];
  const colorFor = (lives: number) => lifeColors[Math.max(0, Math.min(lifeColors.length - 1, lives - 1))] ?? theme.mint;
  const running = status === 'running';

  // One scale for both directions, so Jimmy stays round whatever shape the play area is. A tall area shows more of
  // the level above and below; one taller than the level shows all of it and more of the route ahead.
  const levelWidth = state?.level.width ?? CAMERA_WIDTH;
  const levelHeight = state?.level.height ?? CAMERA_WIDTH;
  let scale = area.width / CAMERA_WIDTH;
  let cameraHeight = scale > 0 ? area.height / scale : 0;
  if (cameraHeight > levelHeight) {
    scale = area.height / levelHeight;
    cameraHeight = levelHeight;
  }
  const cameraWidth = scale > 0 ? Math.min(levelWidth, area.width / scale) : CAMERA_WIDTH;
  const camera = { x: state ? Math.max(0, Math.min(levelWidth - cameraWidth, state.x - cameraWidth * 0.35)) : 0,
    y: state ? Math.max(0, Math.min(levelHeight - cameraHeight, state.y - cameraHeight * 0.55)) : 0 };
  const sx = scale;
  const sy = scale;
  const box = (rect: Rect) => ({ position: 'absolute' as const, left: (rect.x - camera.x) * sx,
    top: (rect.y - camera.y) * sy, width: rect.width * sx, height: rect.height * sy });

  const control = (glyph: string, caption: string, axis: 'horizontal' | 'vertical', value: number) =>
    <Pressable key={caption} accessibilityRole="button" accessibilityLabel={caption} disabled={!running}
      onPressIn={() => onAxis({ type: 'axis', axis, value })}
      onPressOut={() => onAxis({ type: 'axis', axis, value: 0 })}
      style={({ pressed }) => ({ flex: 1, minHeight: 56, borderRadius: 18, paddingHorizontal: 6,
        flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 2,
        borderColor: theme.border, backgroundColor: pressed ? theme.banners.quest.accent : theme.raised,
        opacity: running ? 1 : 0.6 })}>
      <Text style={{ color: theme.text, fontSize: 24, fontWeight: 'bold' }}>{glyph}</Text>
      <Text numberOfLines={1} style={{ flexShrink: 1, color: theme.secondary, fontSize: 13, fontWeight: 'bold' }}>
        {caption}
      </Text>
    </Pressable>;

  // Fills the space it is given: the play area takes what the controls leave, so nothing needs scrolling.
  return <View style={{ flex: 1, gap: 10, padding: 12, borderRadius: 24, backgroundColor: theme.banners.quest.background,
    borderWidth: 2, borderColor: theme.border }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 28, fontWeight: 'bold', marginRight: 4 }}>
        Knob Quest
      </Text>
      {(['easy', 'normal', 'hard'] as const).map((choice) => {
        const selected = difficulty === choice;
        return <Pressable key={choice} accessibilityRole="button" accessibilityLabel={`${choice} difficulty`}
          accessibilityState={{ selected, disabled: running }} disabled={running} onPress={() => onDifficulty(choice)}
          style={{ minHeight: 56, paddingHorizontal: 16, borderRadius: 16, justifyContent: 'center',
            borderWidth: selected ? 2.5 : 1.5, borderColor: selected ? theme.ink : theme.border,
            backgroundColor: selected ? theme.banners.quest.accent : theme.raised, opacity: running && !selected ? 0.6 : 1 }}>
          <Text style={{ color: selected ? theme.ink : theme.text, fontSize: 16, fontWeight: 'bold' }}>
            {selected ? '✓ ' : ''}{choice}
          </Text>
        </Pressable>;
      })}
      {!running && <Pressable accessibilityRole="button" onPress={onStart}
        style={{ minHeight: 56, paddingHorizontal: 22, borderRadius: 28, justifyContent: 'center',
          backgroundColor: theme.banners.quest.accent }}>
        <Text style={{ color: theme.ink, fontSize: 18, fontWeight: 'bold' }}>{status === 'finished' ? 'New route' : 'Start'}</Text>
      </Pressable>}
      {state && <View accessibilityLabel={`${state.lives} of ${state.maxLives} lives`}
        style={{ marginLeft: 'auto', flexDirection: 'row', gap: 6, padding: 8, borderRadius: 18,
          backgroundColor: theme.raised }}>
        {Array.from({ length: state.maxLives }, (_, i) => <View key={i} style={{ opacity: i < state.lives ? 1 : 0.25 }}>
          {player({ size: 30, color: i < state.lives ? colorFor(state.lives) : theme.secondary })}
        </View>)}
      </View>}
    </View>

    <View onLayout={(event) => setArea({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      style={{ flex: 1, minHeight: 160, backgroundColor: theme.raised, borderRadius: 18,
        borderWidth: 2, borderColor: theme.border, overflow: 'hidden' }}>
      {state && area.width > 0 && <World state={state} theme={theme} box={box} sx={sx} sy={sy} camera={camera}
        player={player} color={colorFor(state.lives)} />}
      {!state && <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 }}>
        {player({ size: 72, color: theme.mint })}
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
          Roll Jimmy to the flag!
        </Text>
        <Text style={{ color: theme.secondary, fontSize: 17, textAlign: 'center' }}>
          Spin the spinner to roll. Turn the knob to float up. Faster turns push harder!
        </Text>
      </View>}
    </View>
    {state && <View accessibilityLiveRegion="polite" style={{ minHeight: 28, justifyContent: 'center' }}>
      {state.completed ? <Text style={{ color: theme.text, fontSize: 22, fontWeight: 'bold' }}>
        Jimmy made it to the flag! {state.score} points.
      </Text> : state.outOfLives ? <Text style={{ color: theme.text, fontSize: 22, fontWeight: 'bold' }}>
        Jimmy needs a little rest! You scored {state.score} points. Try a new route?
      </Text> : <Text style={{ color: theme.secondary, fontSize: 16 }}>
        {state.checkpointReached ? 'Checkpoint reached! Jimmy will come back here.'
          : 'Spin to roll, turn the knob to float up. Land on platforms for points.'}
      </Text>}
    </View>}
    {/* Touch controls do the same as the toy, for playing without Jimmy. */}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {control('←', 'Roll left', 'horizontal', -1)}{control('→', 'Roll right', 'horizontal', 1)}
      {control('↑', 'Float up', 'vertical', -1)}{control('↓', 'Drop', 'vertical', 1)}
    </View>
  </View>;
}

/** The level around Jimmy. Every moving part is worked out from game time, so it needs no timers. */
function World({ state, theme, box, sx, sy, camera, player, color }: {
  readonly state: KnobQuestState; readonly theme: QuestTheme; readonly box: (rect: Rect) => object;
  readonly sx: number; readonly sy: number; readonly camera: { readonly x: number; readonly y: number };
  readonly player: KnobQuestPlayerRenderer; readonly color: string;
}) {
  const { level } = state;
  const floorTop = level.height - 4;
  const size = state.width * sx;
  const now = state.elapsedMs;

  // Squash and stretch: long while flying fast, flat for a moment after landing.
  const landT = now - state.landedAtMs;
  const squash = landT < LAND_SQUASH_MS ? Math.min(0.35, Math.abs(state.landingSpeed) / 28 * 0.4) * (1 - landT / LAND_SQUASH_MS) : 0;
  const stretch = state.grounded ? 0 : Math.min(0.22, Math.abs(state.verticalVelocity) / 28 * 0.22);
  const scaleY = 1 - squash + stretch;
  const scaleX = 1 + squash - stretch * 0.6;
  const rollDeg = (state.x / (state.width / 2)) * (180 / Math.PI);
  const respawnT = now - state.respawnedAtMs;
  const fadeIn = respawnT < RESPAWN_FADE_MS ? 0.35 + 0.65 * (respawnT / RESPAWN_FADE_MS) : 1;
  const sparkT = now - state.jumpedAtMs;
  const sparkColors = [theme.yellow, theme.coral, theme.mint, theme.purple];
  const px = (x: number) => (x - camera.x) * sx;
  const py = (y: number) => (y - camera.y) * sy;

  return <>
    {level.holes.map((hole, index) => <View key={`hole${index}`} style={{ ...box({ ...hole, height: hole.height + 20 }),
      backgroundColor: theme.navy, opacity: 0.35, borderTopLeftRadius: 8, borderTopRightRadius: 8 }} />)}
    {level.platforms.map((rect, index) => {
      const floor = rect.y >= floorTop;
      const landed = state.visited.includes(index);
      return <View key={`p${index}`} style={{ ...box(rect), backgroundColor: theme.banners.quest.shadow,
        borderRadius: floor ? 4 : 10, borderTopWidth: Math.max(3, sy * 0.8), overflow: 'hidden',
        borderTopColor: floor || landed ? theme.mint : theme.yellow }} />;
    })}
    {level.checkpoint && <View accessibilityLabel={state.checkpointReached ? 'Checkpoint reached' : 'Checkpoint flag'}
      style={{ position: 'absolute', left: px(level.checkpoint.x), top: py(level.checkpoint.y - 4), height: 8 * sy }}>
      <View style={{ width: 3, height: '100%', backgroundColor: theme.navy, borderRadius: 2 }} />
      <View style={{ position: 'absolute', left: 3, top: 0, width: 2.6 * sx, height: 2 * sy, borderTopRightRadius: 6,
        borderBottomRightRadius: 6, backgroundColor: state.checkpointReached ? theme.mint : theme.secondary }} />
    </View>}
    <View accessibilityLabel="Finish flag" style={{ position: 'absolute', left: px(level.goal.x + 2),
      top: py(level.goal.y - 6), height: (level.goal.height + 6) * sy }}>
      <View style={{ width: 4, height: '100%', backgroundColor: theme.navy, borderRadius: 2 }} />
      <View style={{ position: 'absolute', left: 4, top: 0, width: 4.5 * sx, height: 3 * sy, borderTopRightRadius: 10,
        borderBottomRightRadius: 10, backgroundColor: theme.purple }} />
    </View>
    {state.fireballs.map((ball, index) => <View key={`f${index}`} style={{ ...box(ball), borderRadius: 999,
      backgroundColor: theme.coral, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: '45%', height: '45%', borderRadius: 999, backgroundColor: theme.yellow }} />
    </View>)}
    {sparkT >= 0 && sparkT < SPARK_MS && SPARKS.map(({ deg, speed }, i) => {
      const t = sparkT / 1000;
      const radians = deg * Math.PI / 180;
      const x = state.jumpedFrom.x + state.width / 2 + Math.cos(radians) * speed * t;
      const y = state.jumpedFrom.y + state.height + Math.sin(radians) * speed * t + 30 * t * t;
      return <View key={`s${i}`} pointerEvents="none" style={{ position: 'absolute', left: px(x) - 5, top: py(y) - 1.5,
        width: 10, height: 3, borderRadius: 2, backgroundColor: sparkColors[i % sparkColors.length],
        opacity: 1 - sparkT / SPARK_MS, transform: [{ rotate: `${deg}deg` }] }} />;
    })}
    <View accessibilityLabel={`Jimmy, ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left`}
      style={{ position: 'absolute', left: px(state.x), top: py(state.y), width: size, height: size, opacity: fadeIn,
        transform: [{ translateY: size * (1 - scaleY) / 2 }, { scaleX }, { scaleY }] }}>
      <View style={{ width: size, height: size, transform: [{ rotate: `${rollDeg}deg` }] }}>
        {player({ size, color })}
      </View>
    </View>
  </>;
}
