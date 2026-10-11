import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { KnobQuestAction } from './knob-input';
import type { KnobQuestState, Rect } from './knob-quest';
import type { KnobQuestDifficulty } from './knob-quest';

interface QuestTheme {
  readonly text: string; readonly secondary: string; readonly ink: string;
  readonly surface: string; readonly coral: string; readonly yellow: string;
  readonly purple: string; readonly navy: string;
  readonly banners: { readonly quest: { readonly background: string; readonly accent: string; readonly shadow: string };
    readonly sky: { readonly background: string } };
}

function block(rect: Rect, color: string, camera: { x: number; y: number; width: number; height: number }) {
  return { position: 'absolute' as const, left: `${(rect.x - camera.x) / camera.width * 100}%` as const,
    top: `${(rect.y - camera.y) / camera.height * 100}%` as const,
    width: `${rect.width / camera.width * 100}%` as const,
    height: `${rect.height / camera.height * 100}%` as const, backgroundColor: color, borderRadius: 5 };
}

export function KnobQuestView({ state, status, difficulty, theme, onDifficulty, onStart, onAxis }: {
  readonly state: KnobQuestState | null;
  readonly status: 'idle' | 'running' | 'paused' | 'finished';
  readonly difficulty: KnobQuestDifficulty;
  readonly theme: QuestTheme;
  readonly onDifficulty: (difficulty: KnobQuestDifficulty) => void;
  readonly onStart: () => void;
  readonly onAxis: (action: KnobQuestAction) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const cameraWidth = state ? Math.min(68, state.level.width) : 68;
  const cameraHeight = state ? Math.min(44, state.level.height) : 44;
  const camera = { x: state ? Math.max(0, Math.min(state.level.width - cameraWidth, state.x - cameraWidth * 0.35)) : 0,
    y: state ? Math.max(0, Math.min(state.level.height - cameraHeight, state.y - cameraHeight * 0.55)) : 0,
    width: cameraWidth, height: cameraHeight };
  const control = (label: string, axis: 'horizontal' | 'vertical', value: number) =>
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label}
      onPressIn={() => onAxis({ type: 'axis', axis, value })}
      onPressOut={() => onAxis({ type: 'axis', axis, value: 0 })}
      style={({ pressed }) => ({ minWidth: 65, minHeight: 65, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? theme.banners.quest.accent : theme.surface })}>
      <Text style={{ color: theme.ink, fontSize: 25, fontWeight: 'bold' }}>{label}</Text>
    </Pressable>;
  return <View style={{ gap: 18, padding: 20, borderRadius: 24, backgroundColor: theme.banners.quest.background }}>
    <Text style={{ color: theme.text, fontSize: 32, fontWeight: 'bold' }}>Knob Quest</Text>
    <Text style={{ color: theme.secondary, fontSize: 16 }}>Turn faster to climb against gravity. Find gems and reach the flag!</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {(['easy', 'normal', 'hard'] as const).map((choice) => <Pressable key={choice}
        accessibilityRole="button" accessibilityState={{ selected: difficulty === choice }}
        onPress={() => onDifficulty(choice)} style={{ padding: 12, borderRadius: 12,
          backgroundColor: difficulty === choice ? theme.banners.quest.accent : theme.surface }}>
        <Text style={{ color: difficulty === choice ? theme.ink : theme.text, fontWeight: 'bold' }}>{choice}</Text>
      </Pressable>)}
    </View>
    {status !== 'running' && <Pressable accessibilityRole="button" onPress={onStart}
      style={{ padding: 15, borderRadius: 14, backgroundColor: theme.banners.quest.accent, alignSelf: 'flex-start' }}>
      <Text style={{ color: theme.ink, fontSize: 18, fontWeight: 'bold' }}>{status === 'finished' ? 'New route' : 'Start'}</Text>
    </Pressable>}
    {state && <>
      <Text style={{ color: theme.text }}>Gems {state.collected.length}/{state.level.gems.length}  ·  Score {state.score}
        {'  ·  '}Restarts {state.checkpoints}{state.checkpointReached ? '  ·  Checkpoint reached' : ''}</Text>
      <View style={{ width: '100%', height: Math.min(430, windowWidth * 0.6),
        backgroundColor: theme.banners.sky.background, borderRadius: 14, overflow: 'hidden' }}>
        {state.level.platforms.map((rect, index) => <View key={`p${index}`}
          style={block(rect, theme.banners.quest.shadow, camera)} />)}
        {state.level.hazards.map((rect, index) => <View key={`h${index}`}
          style={block(rect, theme.coral, camera)} />)}
        {state.level.gems.map((rect, index) => state.collected.includes(index) ? null : <View key={`g${index}`}
          style={block(rect, theme.yellow, camera)} />)}
        {state.fireballs.map((rect, index) => <View key={`f${index}`}
          style={{ ...block(rect, theme.coral, camera), borderRadius: 50 }} />)}
        {state.level.checkpoint && <View accessibilityLabel="Checkpoint flag"
          style={block({ ...state.level.checkpoint, width: 2, height: 7 }, theme.purple, camera)} />}
        <View style={block(state.level.goal, theme.purple, camera)} />
        <View accessibilityLabel={`Explorer at ${Math.round(state.x)}, ${Math.round(state.y)}`}
          style={block({ x: state.x, y: state.y, width: state.width, height: state.height },
          theme.navy, camera)} />
      </View>
      {state.completed && <Text style={{ color: theme.text, fontSize: 22 }}>You reached the finish!</Text>}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {control('←', 'horizontal', -1)}{control('→', 'horizontal', 1)}
        </View>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {control('↑', 'vertical', -1)}{control('↓', 'vertical', 1)}
        </View>
      </View>
    </>}
  </View>;
}
