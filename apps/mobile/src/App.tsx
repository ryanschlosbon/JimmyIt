import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StatusBar, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJimmyServices, JimmyServicesProvider, ToyNotConnectedError, useGameRun } from '@jimmyit/app-kit';
import { drawingReducer, type DrawingAction, type DrawingGameAction, type DrawingGameState, type Stroke } from '@jimmyit/game-drawing';
import type { TimedPracticeState } from '@jimmyit/game-timed-practice';
import type { TapQuestAction, TapQuestMode, TapQuestState } from '@jimmyit/game-tap-quest';
import type { ShapeRecognitionAction, ShapeRecognitionState } from '@jimmyit/game-shape-recognition';
import type { ScoreRecord } from '@jimmyit/core';
import type { SaveStatus } from '@jimmyit/game-sdk';
import { defaultAccessibilityPreferences } from '@jimmyit/ai';
import { getTheme } from './theme';
import { useJimmy } from './use-jimmy';
import { DRAWING_GAMES, SHAPE_CHALLENGE_GAME, tapQuestGame, timedPracticeGame, type Activity } from './games';
import { createSessionShapeRecognizer } from './shape-recognition-service';
import { createToySetup, loadDevToyPanel } from './toy-connector';
import { CelebrationOverlay } from './components/CelebrationOverlay';
import { HomeScreen } from './screens/HomeScreen';
import { DrawingScreen } from './screens/DrawingScreen';
import { RewardsScreen } from './screens/RewardsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { IntroScreen } from './screens/IntroScreen';
import { TimedScreen, type VirtualToy } from './screens/TimedScreen';
import { TapQuestScreen } from './screens/TapQuestScreen';
import { Body, Button, Eyebrow, Heading } from './components/Controls';
import { Icon, type IconName } from './components/Icon';
import { Jimmy } from './components/Jimmy';
import { setupWebAccessibility } from './web-accessibility';

type Screen = 'home' | 'draw' | 'rewards' | 'settings' | 'timed' | 'tapQuest';
const NO_STROKES: readonly Stroke[] = [];
/** Game screens reached from Home; the Home tab stays highlighted on them. */
const isActivity = (screen: Screen) => screen === 'timed' || screen === 'tapQuest';
const DRAWING_TICK_MS = 1000; // drawing has no clock to update; tick slowly

/** Calls onSaved once for each saved record, and onFailed when a save fails. */
function useRunOutcome(run: { readonly record: ScoreRecord | null; readonly saveStatus: SaveStatus },
  onSaved: (record: ScoreRecord) => void, onFailed: () => void) {
  const latest = useRef({ onSaved, onFailed });
  latest.current = { onSaved, onFailed };
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!run.record || shown.current === run.record.id) return;
    shown.current = run.record.id;
    latest.current.onSaved(run.record);
  }, [run.record]);
  useEffect(() => { if (run.saveStatus === 'failed') latest.current.onFailed(); }, [run.saveStatus]);
}

/** Created once per app launch: storage, toy connection (virtual or Bluetooth). */
function boot() {
  const { connector, simulator } = createToySetup();
  const services = createJimmyServices({ storage: AsyncStorage, connector });
  return { simulator, services, DevToyPanel: loadDevToyPanel() };
}

export function App() {
  const [{ simulator, services, DevToyPanel }] = useState(boot);
  return <SafeAreaProvider>
    <JimmyServicesProvider services={services}>
      <JimmyApp virtualToy={simulator?.toy ?? null} />
      {simulator && DevToyPanel && <DevToyPanel simulator={simulator} />}
    </JimmyServicesProvider>
  </SafeAreaProvider>;
}

function JimmyApp({ virtualToy }: { readonly virtualToy: VirtualToy | null }) {
  const state = useJimmy();
  const shapeRecognizer = useMemo(() => createSessionShapeRecognizer(state.shapeSessionToken), [state.shapeSessionToken]);
  const theme = getTheme(state.dark);
  const [fontsLoaded, fontError] = useFonts({ Baloo: Baloo2_700Bold, Poppins: Poppins_400Regular,
    PoppinsBold: Poppins_600SemiBold });
  const [screen, setScreen] = useState<Screen>('home');
  const screenRef = useRef<Screen>('home');
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);
  const timed = useGameRun<TimedPracticeState>();
  const tapQuest = useGameRun<TapQuestState, TapQuestAction>();
  const drawingRuns = {
    drawing: useGameRun<DrawingGameState, DrawingGameAction>(),
    shapes: useGameRun<ShapeRecognitionState, ShapeRecognitionAction>(),
  };
  const [recognizingShape, setRecognizingShape] = useState(false);
  const shapeInFlight = useRef(false);
  const shapeSubmissionId = useRef(0);
  const [activity, setActivity] = useState<Activity>('drawing');
  const [drafts, setDrafts] = useState<Record<Activity, readonly Stroke[]>>({ drawing: NO_STROKES, shapes: NO_STROKES });
  const [reward, setReward] = useState<number | null>(null);
  const [rewardNewBest, setRewardNewBest] = useState(false);
  const [rewardFrom, setRewardFrom] = useState<'draw' | 'timed' | 'tapQuest'>('draw');
  const scroll = useRef<ScrollView>(null);
  const tapQuestSeed = useRef(0);
  const { width } = useWindowDimensions();
  const compact = width < 680;
  useEffect(() => setupWebAccessibility(state.dark), [state.dark]);

  const drawingSaveFailed = () => state.setError('Your drawing is still here. We couldn’t save your points yet — please try All done again.');
  useRunOutcome(timed, record => { setRewardFrom('timed'); setRewardNewBest(record.newBest); setReward(record.score); },
    () => state.setError('Your little moves are still here. Please use Retry saving to save your points.'));
  useRunOutcome(tapQuest, record => { setRewardFrom('tapQuest'); setRewardNewBest(record.newBest); setReward(record.score); },
    () => state.setError('Your taps are still here. Please use Retry saving to save your points.'));
  // A saved drawing shows its points, then that activity starts on a fresh canvas.
  useRunOutcome(drawingRuns.drawing, record => {
    setRewardFrom('draw'); setRewardNewBest(false); setReward(record.score);
    setDrafts(current => ({ ...current, drawing: NO_STROKES })); drawingRuns.drawing.clear();
  }, drawingSaveFailed);
  useRunOutcome(drawingRuns.shapes, record => {
    setRewardFrom('draw'); setRewardNewBest(false); setReward(record.score);
    setDrafts(current => ({ ...current, shapes: NO_STROKES })); drawingRuns.shapes.clear();
  }, drawingSaveFailed);

  const navigate = (next: Screen) => {
    screenRef.current = next;
    setScreen(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const start = (next: Activity) => { setActivity(next); navigate('draw'); };
  const dispatch = (action: DrawingAction) => {
    // The game's clock starts with the first mark, as the drawing's time always has.
    if (action.type === 'begin' && activity === 'drawing' && drawingRuns.drawing.status !== 'running') {
      drawingRuns.drawing.start(DRAWING_GAMES.drawing, { tickMs: DRAWING_TICK_MS });
    }
    if (action.type === 'begin' && activity === 'shapes' && drawingRuns.shapes.status !== 'running') {
      drawingRuns.shapes.start(SHAPE_CHALLENGE_GAME, { tickMs: DRAWING_TICK_MS });
    }
    setDrafts(current => ({ ...current, [activity]: drawingReducer(current[activity], action) }));
  };

  const finishShape = async () => {
    const current = drawingRuns.shapes;
    if (shapeInFlight.current || current.saveStatus === 'saving') return;
    if (current.status === 'finished' && current.saveStatus === 'failed') { current.retrySave(); return; }
    const run = current.status === 'running' && current.run ? current.run
      : current.start(SHAPE_CHALLENGE_GAME, { tickMs: DRAWING_TICK_MS });
    const target = run.getState().target;
    if (!target) return;
    shapeInFlight.current = true;
    setRecognizingShape(true);
    try {
      const drawing = { width: 1000, height: 650, strokes: drafts.shapes.map(stroke => stroke.points) };
      const prediction = await shapeRecognizer.predict(drawing, target);
      if (__DEV__) console.info('Shape recognition', { provider: prediction.provider, modelId: prediction.modelId,
        shape: prediction.shape, modelScore: prediction.modelScore, inferenceTimeMs: prediction.inferenceTimeMs });
      shapeSubmissionId.current++;
      run.submit({ type: 'submitDrawing', submissionId: String(shapeSubmissionId.current), drawing, prediction });
      if (run.getState().target !== target) setDrafts(current => ({ ...current, shapes: NO_STROKES }));
    } finally { shapeInFlight.current = false; setRecognizingShape(false); }
  };

  const finish = () => {
    if (activity === 'shapes') {
      finishShape().catch(() => state.setError('Your drawing is still here. Please try All done again.'));
      return;
    }
    const current = drawingRuns.drawing;
    if (current.saveStatus === 'saving') return;
    if (current.status === 'finished' && current.saveStatus === 'failed') { current.retrySave(); return; }
    const run = current.status === 'running' && current.run ? current.run
      : current.start(DRAWING_GAMES.drawing, { tickMs: DRAWING_TICK_MS });
    run.submit({ type: 'finish', strokeCount: drafts[activity].length });
  };

  // Tap Quest adapts its level from this child's recent Tap Quest games.
  const startTapQuest = async (mode: TapQuestMode): Promise<'local' | 'gemini' | null> => {
    tapQuestSeed.current = tapQuestSeed.current === 0 ? Math.floor(Math.random() * 0x7fffffff) + 1
      : (tapQuestSeed.current + 1) & 0x7fffffff;
    const seed = tapQuestSeed.current;
    let game = tapQuestGame(mode, state.records, seed);
    let source: 'local' | 'gemini' = 'local';
    if (mode !== 'trace' && state.aiSettings.generationEnabled && state.aiSettings.provider === 'gemini') {
      const level = await state.aiService.generateLevel({ gameType: 'tapQuest', theme: 'garden', difficulty: 2,
        accessibilityPreferences: defaultAccessibilityPreferences(), targetCount: 6,
        availableInputControls: ['screenTouch'], variationSeed: seed });
      if (level.targets.length >= 4) {
        try {
          game = tapQuestGame(mode, state.records, seed,
            level.targets.map(({ x, y }) => ({ x, y })));
          source = level.source;
        } catch {
          // A generated layout can be valid at its own radius yet overlap at this game's adapted radius.
        }
      }
    }
    if (screenRef.current !== 'tapQuest') return null;
    tapQuest.start(game, { tickMs: 100 });
    return source;
  };

  const startTimed = (durationMs: number) => {
    try {
      timed.start(timedPracticeGame(durationMs), { tickMs: 200 });
    } catch (error) {
      if (error instanceof ToyNotConnectedError) state.setError('Find Jimmy first, then start your practice.');
      else throw error;
    }
  };

  if (!introDone) return <IntroScreen ready={(fontsLoaded || Boolean(fontError)) && state.ready} onDone={finishIntro} />;

  if ((!fontsLoaded && !fontError) || !state.ready) return <SafeAreaView style={{ flex: 1,
    backgroundColor: theme.page, justifyContent: 'center', alignItems: 'center', gap: 20 }}>
    <Jimmy face size={80} color={theme.mint} /><Text style={{ fontSize: 24, color: theme.text }}>Getting ready to play…</Text>
  </SafeAreaView>;

  const nav: readonly { screen: Screen; label: string; icon: IconName }[] = [
    { screen: 'home', label: 'Home', icon: 'home' }, { screen: 'draw', label: 'Draw', icon: 'pencil' },
    { screen: 'rewards', label: 'Rewards', icon: 'star' },
  ];
  const shapeState = drawingRuns.shapes.state;
  const shapeFeedback = shapeState?.lastResult?.target === shapeState?.target
    ? shapeState?.lastResult?.feedback : undefined;
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.page }}>
    <StatusBar barStyle={state.dark ? 'light-content' : 'dark-content'} backgroundColor={theme.page} />
    <View role="banner" style={{ borderBottomWidth: 1, borderColor: theme.border, backgroundColor: theme.page }}>
      <View style={{ width: '100%', maxWidth: 1240, alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingHorizontal: compact ? 20 : 38, paddingVertical: 18 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Jimmy home" onPress={() => navigate('home')}
          style={({ pressed }) => [{ minHeight: 56, flexDirection: 'row', gap: 10, alignItems: 'center', opacity: pressed ? .7 : 1 }]}>
          <Jimmy face size={42} color={theme.mint} />
          <Text style={{ fontFamily: 'Baloo', fontSize: 32, letterSpacing: .5, color: theme.text }}>JIMMY</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          {!compact && <Pressable accessibilityRole="button" accessibilityLabel={`Jimmy ${state.connection}. Open settings`}
            onPress={() => navigate('settings')} style={{ flexDirection: 'row', gap: 8, alignItems: 'center',
              backgroundColor: theme.softMint, paddingVertical: 13, paddingHorizontal: 17, borderRadius: 14, minHeight: 56 }}>
            <Icon name="bluetooth" color={theme.dark ? theme.mint : '#087C71'} size={18} />
            <Body theme={theme} small>{state.connection === 'connected' ? 'Jimmy connected' : state.connection === 'searching'
              ? 'Finding Jimmy…' : state.connection === 'confirming' ? 'Say yes on Jimmy ▶' : 'Find your Jimmy'}</Body>
          </Pressable>}
          <Button theme={theme} icon="settings" color={theme.yellow} accessibilityLabel="Open settings"
            onPress={() => navigate('settings')} selected={screen === 'settings'} compact />
        </View>
      </View>
    </View>
    <ScrollView ref={scroll} role="main" keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: compact ? 18 : 38, paddingTop: compact ? 24 : 34,
        paddingBottom: 40 }}>
      <View style={{ width: '100%', maxWidth: 1164, alignSelf: 'center' }}>
        {state.error && <View accessibilityRole="alert" style={{ backgroundColor: theme.softCoral, borderRadius: 16,
          padding: 18, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 15 }}>
          <View style={{ flex: 1 }}><Body theme={theme} small color={theme.text}>{state.error}</Body></View>
          <Button theme={theme} icon="close" accessibilityLabel="Dismiss message" onPress={() => state.setError(null)} compact />
        </View>}
        {screen === 'home' && <HomeScreen theme={theme} start={start} rewards={() => navigate('rewards')}
          timed={() => navigate('timed')} tapQuest={() => navigate('tapQuest')} />}
        {screen === 'draw' && <DrawingScreen theme={theme} activity={activity} strokes={drafts[activity]}
          dispatch={dispatch} finish={finish} saving={(activity === 'shapes' && recognizingShape)
            || drawingRuns[activity].saveStatus === 'saving'}
          shapeTarget={activity === 'shapes' ? shapeState?.target ?? 'circle' : undefined}
          shapeIndex={shapeState?.challengeIndex ?? 0}
          shapeCount={shapeState?.challengeCount ?? 4}
          shapeFeedback={activity === 'shapes' ? shapeFeedback : undefined} />}
        {screen === 'rewards' && <RewardsScreen theme={theme} progress={state.progress} />}
        {screen === 'settings' && <SettingsScreen theme={theme} state={state}
          replayIntro={() => { navigate('home'); setIntroDone(false); }} />}
        {screen === 'tapQuest' && <TapQuestScreen theme={theme} run={tapQuest} onStart={startTapQuest} toy={state.toy} />}
        {screen === 'timed' && <TimedScreen theme={theme} timed={timed} onStart={startTimed}
          connected={state.connection === 'connected'} searching={state.connection === 'searching'}
          onConnect={state.connect} virtualToy={virtualToy} />}
      </View>
    </ScrollView>
    <View role="navigation" accessibilityLabel="Main navigation" style={{ backgroundColor: theme.page,
      paddingTop: 10, paddingBottom: 16, paddingHorizontal: 16, alignItems: 'center', borderTopWidth: 1,
      borderColor: theme.border }}>
      <View style={{ flexDirection: 'row', gap: 8, borderWidth: 1.5, borderColor: theme.border,
        padding: 7, borderRadius: 23, backgroundColor: theme.surface, width: compact ? '100%' : 440 }}>
        {nav.map(item => <Button key={item.screen} theme={theme} label={item.label} icon={item.icon}
          compact vertical={compact} selected={screen === item.screen || (isActivity(screen) && item.screen === 'home')}
          onPress={() => navigate(item.screen)}
          color={screen === item.screen || (isActivity(screen) && item.screen === 'home') ? theme.mint : undefined}
          style={{ flex: 1, paddingHorizontal: compact ? 8 : 14 }} />)}
      </View>
    </View>
    <Modal visible={reward !== null} transparent animationType="none" onRequestClose={() => setReward(null)}>
      <View style={{ flex: 1, backgroundColor: '#0F1D33BB', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View accessibilityViewIsModal role="dialog" aria-label="Activity complete" style={{ width: '100%', maxWidth: 480,
          backgroundColor: theme.surface, borderRadius: 32, padding: 32, alignItems: 'center', gap: 20 }}>
          <Jimmy face size={100} color={theme.mint} />
          <Eyebrow theme={theme}>{rewardNewBest ? 'Your best ever' : 'A little big win'}</Eyebrow>
          <Heading theme={theme} size={40}>{rewardNewBest ? 'New high score!' : 'You made it!'}</Heading>
          <Body theme={theme}>{rewardFrom === 'timed' ? 'So many wonderful little moves.'
            : rewardFrom === 'tapQuest' ? 'Such careful, steady taps.' : 'What a wonderful little try.'}</Body>
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Icon name="star" color={theme.dark ? theme.yellow : '#8A6500'} size={34} />
            <Heading theme={theme} size={36}>+{reward ?? 0} points</Heading>
          </View>
          <Button theme={theme} label="See my rewards" icon="star" color={theme.yellow}
            onPress={() => { setReward(null); navigate('rewards'); }} style={{ width: '100%' }} />
          <Button theme={theme} label={rewardFrom === 'draw' ? 'Keep creating' : 'Keep playing'}
            icon={rewardFrom === 'timed' ? 'timer' : rewardFrom === 'tapQuest' ? 'sparkle' : 'pencil'} onPress={() => { setReward(null);
              navigate(rewardFrom === 'draw' ? 'draw' : rewardFrom); }} style={{ width: '100%' }} />
        </View>
      </View>
    </Modal>
    <CelebrationOverlay theme={theme} />
  </SafeAreaView>;
}
