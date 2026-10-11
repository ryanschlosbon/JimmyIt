import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Modal, ScrollView, StatusBar, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import { Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2/800ExtraBold';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJimmyServices, JimmyServicesProvider, ToyNotConnectedError, useGameRun, useReward } from '@jimmyit/app-kit';
import { drawingReducer, type DrawingAction, type DrawingGameAction, type DrawingGameState, type Stroke } from '@jimmyit/game-drawing';
import { createButtonHeroGame, type ButtonHeroAction, type ButtonHeroDifficulty,
  type ButtonHeroState } from '@jimmyit/game-button-hero';
import { createKnobQuestGame, type KnobQuestAction, type KnobQuestDifficulty,
  type KnobQuestState } from '@jimmyit/game-knob-quest';
import { ButtonHeroView } from '@jimmyit/game-button-hero/view';
import { KnobQuestView } from '@jimmyit/game-knob-quest/view';
import type { TimedPracticeState } from '@jimmyit/game-timed-practice';
import type { TapQuestAction, TapQuestMode, TapQuestState } from '@jimmyit/game-tap-quest';
import type { ShapeRecognitionAction, ShapeRecognitionState } from '@jimmyit/game-shape-recognition';
import type { ScoreRecord } from '@jimmyit/core';
import type { SaveStatus } from '@jimmyit/game-sdk';
import { getTheme } from './theme';
import { useJimmy } from './use-jimmy';
import { useSounds } from './use-sounds';
import { DRAWING_GAMES, PLAY_SHELF, SHAPE_CHALLENGE_GAME, TIMED_PRACTICE_SECONDS, tapQuestGame, timedPracticeGame,
  type Activity, type ShelfGameId } from './games';
import { createSessionShapeRecognizer } from './shape-recognition-service';
import { createToySetup, loadDevToyPanel } from './toy-connector';
import { CelebrationToast } from './components/CelebrationToast';
import { RewardToast } from './components/RewardToast';
import { GameScoreBar } from './components/GameScoreBar';
import { PlayScreen } from './screens/PlayScreen';
import { DrawingScreen } from './screens/DrawingScreen';
import { RewardsScreen } from './screens/RewardsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { IntroScreen } from './screens/IntroScreen';
import { TimedScreen, type VirtualToy } from './screens/TimedScreen';
import { TapQuestScreen } from './screens/TapQuestScreen';
import { Body, Button, Eyebrow, Heading } from './components/Controls';
import { Icon } from './components/Icon';
import { AppHeader, type HeaderTab } from './components/AppHeader';
import { Bubbles } from './components/Bubbles';
import type { BannerStat } from './components/GameBanner';
import { ART, FONTS, GAME_STAGE, RADIUS, SETTINGS, SPACE } from './design/tokens';
import { Jimmy } from './components/Jimmy';
import { setupWebAccessibility } from './web-accessibility';
import { attachGameKeyboard } from './game-keyboard';
import { dispatchGameInput, type GameInputEvent } from './game-input';

type Screen = 'home' | 'draw' | 'rewards' | 'settings' | 'timed' | 'tapQuest' | 'buttonHero' | 'knobQuest';
const NO_STROKES: readonly Stroke[] = [];
/** Game screens reached from the play shelf; the Play tab stays highlighted on them. */
const isActivity = (screen: Screen) => screen === 'timed' || screen === 'tapQuest'
  || screen === 'buttonHero' || screen === 'knobQuest';
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
  useSounds();
  const shapeRecognizer = useMemo(() => createSessionShapeRecognizer(state.shapeSessionToken), [state.shapeSessionToken]);
  const theme = getTheme(state.dark, state.colorStyle);
  const [fontsLoaded, fontError] = useFonts({ [FONTS.display]: Baloo2_700Bold, [FONTS.displayHeavy]: Baloo2_800ExtraBold,
    [FONTS.body]: Poppins_400Regular, [FONTS.bodyMedium]: Poppins_500Medium, [FONTS.bodyBold]: Poppins_600SemiBold });
  const [screen, setScreen] = useState<Screen>('home');
  const screenRef = useRef<Screen>('home');
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);
  const timed = useGameRun<TimedPracticeState>();
  const tapQuest = useGameRun<TapQuestState, TapQuestAction>();
  const buttonHero = useGameRun<ButtonHeroState, ButtonHeroAction>();
  const knobQuest = useGameRun<KnobQuestState, KnobQuestAction>();
  const gameRuns = useRef({ buttonHero, knobQuest });
  gameRuns.current = { buttonHero, knobQuest };
  const handleGameInput = useRef<(event: GameInputEvent) => void>(() => undefined);
  handleGameInput.current = event => dispatchGameInput(event,
    action => gameRuns.current.buttonHero.submit(action),
    action => gameRuns.current.knobQuest.submit(action));
  const [buttonDifficulty, setButtonDifficulty] = useState<ButtonHeroDifficulty>('normal');
  const [knobDifficulty, setKnobDifficulty] = useState<KnobQuestDifficulty>('normal');
  const drawingRuns = {
    drawing: useGameRun<DrawingGameState, DrawingGameAction>(),
    shapes: useGameRun<ShapeRecognitionState, ShapeRecognitionAction>(),
  };
  const [recognizingShape, setRecognizingShape] = useState(false);
  const shapeInFlight = useRef(false);
  const shapeSubmissionId = useRef(0);
  const canvasSize = useRef<{ readonly width: number; readonly height: number }>({ width: 1000, height: 650 });
  const [activity, setActivity] = useState<Activity>('drawing');
  const [drafts, setDrafts] = useState<Record<Activity, readonly Stroke[]>>({ drawing: NO_STROKES, shapes: NO_STROKES });
  const [reward, setReward] = useState<number | null>(null);
  const [rewardNewBest, setRewardNewBest] = useState(false);
  const [rewardFrom, setRewardFrom] = useState<'draw' | 'timed' | 'tapQuest'>('draw');
  const levelOrBadge = useReward();
  const scroll = useRef<ScrollView>(null);
  const tapQuestSeed = useRef(0);
  const knobQuestSeed = useRef(0);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 680;
  // Games fill the screen instead of scrolling, so a drag on the play area always plays.
  const gameScreen = screen === 'draw' || isActivity(screen);
  useEffect(() => setupWebAccessibility(state.dark), [state.dark]);
  useEffect(() => {
    if (screen !== 'buttonHero' && screen !== 'knobQuest') return;
    return attachGameKeyboard(screen, event => handleGameInput.current(event));
  }, [screen]);
  // Leaving a game ends its run (every point kept, no finish dialog) and resets that screen, so only the game on
  // screen ever runs and holds the toy. A failed save stays put, so its Retry button is still there on return.
  const toyGameRuns = useRef({ timed, tapQuest, buttonHero, knobQuest });
  toyGameRuns.current = { timed, tapQuest, buttonHero, knobQuest };
  useEffect(() => {
    for (const [name, controls] of Object.entries(toyGameRuns.current)) {
      if (name !== screen && controls.status !== 'idle' && controls.saveStatus !== 'failed') controls.clear();
    }
  }, [screen]);
  useEffect(() => {
    if (screen !== 'buttonHero') return;
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') gameRuns.current.buttonHero.pause();
    });
    return () => { subscription.remove(); gameRuns.current.buttonHero.pause(); };
  }, [screen]);

  // The play shelf: which banner is showing, and the option chosen on each banner.
  const [shelfIndex, setShelfIndex] = useState(0);
  const [choices, setChoices] = useState<Partial<Record<ShelfGameId, string>>>({
    timed: String((TIMED_PRACTICE_SECONDS[0] ?? 30) * 1000), tapQuest: 'precision',
  });
  const [tapQuestAutoStart, setTapQuestAutoStart] = useState(false);
  const timedMs = Number(choices.timed ?? 30_000);
  const tapQuestMode = (choices.tapQuest ?? 'precision') as TapQuestMode;
  const choose = (game: ShelfGameId, value: string) => setChoices(current => ({ ...current, [game]: value }));

  const drawingSaveFailed = () => state.setError('Your drawing is still here. We couldn’t save your points yet — please try Submit again.');
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
    if (next !== 'tapQuest') setTapQuestAutoStart(false);
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
      // Strokes are stored in a fixed 1000×650 space that the canvas stretches to fit the screen; restore the
      // on-screen proportions so a square the child traced isn't judged as a rectangle.
      const { width, height } = canvasSize.current;
      const drawing = { width, height, strokes: drafts.shapes.map(stroke =>
        stroke.points.map(point => ({ x: point.x * width / 1000, y: point.y * height / 650 }))) };
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
  const startTapQuest = async (mode: TapQuestMode, aspectRatio: number): Promise<'local' | null> => {
    tapQuestSeed.current = tapQuestSeed.current === 0 ? Math.floor(Math.random() * 0x7fffffff) + 1
      : (tapQuestSeed.current + 1) & 0x7fffffff;
    const game = tapQuestGame(mode, state.records, tapQuestSeed.current, undefined, aspectRatio);
    if (screenRef.current !== 'tapQuest') return null;
    tapQuest.start(game, { tickMs: 100 });
    return 'local';
  };

  const startTimed = (durationMs: number) => {
    try {
      timed.start(timedPracticeGame(durationMs), { tickMs: 200 });
    } catch (error) {
      if (error instanceof ToyNotConnectedError) state.setError('Find Jimmy first, then start your practice.');
      else throw error;
    }
  };

  const stats = useMemo(() => Object.fromEntries(PLAY_SHELF.map(game => {
    const row = state.scoreboard.rows.find(item => item.gameId === game.scoreGameId(choices[game.id] ?? null));
    return [game.id, game.stat === 'count' ? { label: 'Drawings', value: String(row?.sessions ?? 0) }
      : { label: 'High Score', value: String(row?.bestScore ?? 0) }];
  })) as Record<ShelfGameId, BannerStat>, [state.scoreboard, choices]);

  const play = (game: ShelfGameId) => {
    if (game === 'buttonHero') { navigate('buttonHero'); return; }
    if (game === 'knobQuest') { navigate('knobQuest'); return; }
    if (game === 'drawing' || game === 'shapes') { start(game); return; }
    if (game === 'timed') {
      navigate('timed');
      const busy = timed.status === 'running' || timed.status === 'paused';
      if (!busy && state.connection === 'connected') startTimed(timedMs);
      return;
    }
    navigate('tapQuest');
    if (tapQuest.status !== 'running' && tapQuest.status !== 'paused') setTapQuestAutoStart(true);
  };

  // The intro sits on top of the app, which is already rendered underneath so the intro can peel away to
  // reveal it. The wrappers stay the same when the intro ends, so the screen below is not rebuilt.
  const withIntro = (content: ReactNode) => <View style={{ flex: 1 }}>
    <View style={{ flex: 1 }} aria-hidden={!introDone}
      importantForAccessibility={introDone ? 'auto' : 'no-hide-descendants'}>{content}</View>
    {!introDone && <IntroScreen ready={(fontsLoaded || Boolean(fontError)) && state.ready} onDone={finishIntro} />}
  </View>;

  if ((!fontsLoaded && !fontError) || !state.ready) return withIntro(<SafeAreaView style={{ flex: 1,
    backgroundColor: theme.page, justifyContent: 'center', alignItems: 'center', gap: 20 }}>
    <Jimmy face size={80} color={theme.mint} /><Text style={{ fontSize: 24, color: theme.text }}>Getting ready to play…</Text>
  </SafeAreaView>);

  const shapeState = drawingRuns.shapes.state;
  const shapeFeedback = shapeState?.lastResult?.target === shapeState?.target
    ? shapeState?.lastResult?.feedback : undefined;
  const activityRuns = { timed, tapQuest, buttonHero, knobQuest } as const;
  const activityScore = screen in activityRuns
    ? activityRuns[screen as keyof typeof activityRuns].score?.score ?? 0 : null;
  const tab: HeaderTab = screen === 'rewards' ? 'rewards' : screen === 'settings' ? 'settings' : 'play';
  const onTab = (next: HeaderTab) => navigate(next === 'play' ? 'home' : next);
  const rewardToast = <RewardToast theme={theme} reward={levelOrBadge}
    badgeLabel={id => state.progress.badges.find(badge => badge.id === id)?.label ?? 'a new badge'} />;
  const errorBanner = state.error && <View accessibilityRole="alert" style={{ backgroundColor: theme.softCoral,
    borderRadius: 16, padding: 18, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 15 }}>
    <View style={{ flex: 1 }}><Body theme={theme} small color={theme.text}>{state.error}</Body></View>
    <Button theme={theme} icon="close" accessibilityLabel="Dismiss message" onPress={() => state.setError(null)} compact />
  </View>;
  return withIntro(<View style={{ flex: 1, backgroundColor: theme.page }}>
    <Bubbles theme={theme} animated={state.bubbles} />
    {/* The header paints the strip behind the status bar itself, so it meets the top of the screen. */}
    <SafeAreaView style={{ flex: 1 }} edges={['left', 'right', 'bottom']}>
    <StatusBar barStyle={state.dark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
    {/* Short landscape windows get the slimmer header on game screens, leaving more room to play. */}
    <AppHeader theme={theme} compact={compact || (gameScreen && height < 820)} active={tab}
      connection={state.connection} onTab={onTab} topInset={insets.top} />
    {screen === 'home' ? <View role="main" style={{ flex: 1, paddingHorizontal: compact ? 0 : 8 }}>
      {errorBanner && <View style={{ paddingHorizontal: 18, paddingTop: 16, width: '100%', maxWidth: 1164,
        alignSelf: 'center' }}>{errorBanner}</View>}
      <PlayScreen theme={theme} games={PLAY_SHELF} stats={stats} choices={choices} onChoose={choose} onPlay={play}
        index={shelfIndex} onIndex={setShelfIndex} toyConnected={state.connection === 'connected'} />
    </View> : gameScreen ? <View role="main" style={{ flex: 1, paddingHorizontal: compact ? SPACE.sm : SPACE.lg,
      paddingVertical: SPACE.sm }}>
      <View style={{ flex: 1, width: '100%', maxWidth: screen === 'draw' ? ART.maxWidth : GAME_STAGE.maxWidth,
        alignSelf: 'center', gap: SPACE.sm, borderRadius: RADIUS.xl,
        backgroundColor: screen === 'draw' ? undefined : theme.sheet,
        padding: screen === 'draw' ? SPACE.xs : compact ? SPACE.sm : SPACE.md }}>
        {errorBanner}
        {screen !== 'draw' && <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
          <Button theme={theme} label="All games" icon="chevronLeft" compact onPress={() => navigate('home')} />
          {activityScore !== null && <GameScoreBar theme={theme} score={activityScore} style={{ flex: 1 }} />}
        </View>}
        <View style={{ flex: 1, minHeight: 0 }}>
          {screen === 'draw' && <DrawingScreen theme={theme} activity={activity} strokes={drafts[activity]}
            dispatch={dispatch} finish={finish} saving={(activity === 'shapes' && recognizingShape)
              || drawingRuns[activity].saveStatus === 'saving'}
            onAllGames={() => navigate('home')}
            onCanvasSize={size => { canvasSize.current = size; }}
            shapeTarget={activity === 'shapes' ? shapeState?.target ?? 'circle' : undefined}
            shapeIndex={shapeState?.challengeIndex ?? 0}
            shapeCount={shapeState?.challengeCount ?? 4}
            shapeFeedback={activity === 'shapes' ? shapeFeedback : undefined} />}
          {screen === 'tapQuest' && <TapQuestScreen theme={theme} run={tapQuest} onStart={startTapQuest} toy={state.toy}
            mode={tapQuestMode} onMode={mode => choose('tapQuest', mode)} autoStart={tapQuestAutoStart}
            onAutoStarted={() => setTapQuestAutoStart(false)} />}
          {screen === 'buttonHero' && <ButtonHeroView state={buttonHero.state} status={buttonHero.status}
            difficulty={buttonDifficulty} theme={theme} onDifficulty={setButtonDifficulty}
            onStart={() => buttonHero.start(createButtonHeroGame({ difficulty: buttonDifficulty }), { tickMs: 40 })}
            onPause={buttonHero.pause} onResume={buttonHero.resume}
            onButton={action => handleGameInput.current({ ...action, source: 'touch' })} />}
          {screen === 'knobQuest' && <KnobQuestView state={knobQuest.state} status={knobQuest.status}
            difficulty={knobDifficulty} theme={theme} onDifficulty={setKnobDifficulty}
            onStart={() => {
              knobQuestSeed.current++;
              knobQuest.start(createKnobQuestGame(undefined, knobDifficulty, knobQuestSeed.current), { tickMs: 40 });
            }}
            renderPlayer={({ size, color }) => <Jimmy face size={size} color={color} />}
            showTouchControls={state.connection !== 'connected'}
            onAxis={action => handleGameInput.current({ ...action, source: 'touch' })} />}
          {screen === 'timed' && <TimedScreen theme={theme} timed={timed} onStart={startTimed}
            durationS={timedMs / 1000} onDuration={seconds => choose('timed', String(seconds * 1000))}
            connected={state.connection === 'connected'} searching={state.connection === 'searching'}
            onConnect={state.connect} virtualToy={virtualToy} />}
        </View>
      </View>
    </View> : <ScrollView ref={scroll} role="main" keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: compact ? 10 : 30, paddingTop: compact ? 12 : 22,
        paddingBottom: 30 }}>
      <View style={{ width: '100%', maxWidth: screen === 'settings' ? SETTINGS.maxWidth : 1200, alignSelf: 'center',
        backgroundColor: screen === 'settings' ? undefined : theme.sheet,
        borderRadius: RADIUS.xl, padding: screen === 'settings' ? 0 : compact ? 14 : 30 }}>
        {errorBanner}
        {screen === 'rewards' && <RewardsScreen theme={theme} progress={state.progress} />}
        {screen === 'settings' && <SettingsScreen theme={theme} state={state}
          replayIntro={() => { navigate('home'); setIntroDone(false); }} />}
      </View>
    </ScrollView>}
    <Modal visible={reward !== null} transparent animationType="none" onRequestClose={() => setReward(null)}>
      <View style={{ flex: 1, backgroundColor: theme.scrim, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View accessibilityViewIsModal role="dialog" aria-label="Activity complete" style={{ width: '100%', maxWidth: 480,
          backgroundColor: theme.surface, borderRadius: 32, padding: 32, alignItems: 'center', gap: 20 }}>
          <Jimmy face size={100} color={theme.mint} />
          <Eyebrow theme={theme}>{rewardNewBest ? 'Your best ever' : 'A little big win'}</Eyebrow>
          <Heading theme={theme} size={40}>{rewardNewBest ? 'New high score!' : 'You made it!'}</Heading>
          <Body theme={theme}>{rewardFrom === 'timed' ? 'So many wonderful little moves.'
            : rewardFrom === 'tapQuest' ? 'Such careful, steady taps.' : 'What a wonderful little try.'}</Body>
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Icon name="star" color={theme.gold} size={34} />
            <Heading theme={theme} size={36}>+{reward ?? 0} points</Heading>
          </View>
          <Button theme={theme} label={rewardFrom === 'draw' ? 'Keep creating' : 'Play again'}
            icon={rewardFrom === 'timed' ? 'timer' : rewardFrom === 'tapQuest' ? 'sparkle' : 'pencil'} color={theme.yellow}
            onPress={() => { setReward(null); navigate(rewardFrom === 'draw' ? 'draw' : rewardFrom); }} style={{ width: '100%' }} />
          <Button theme={theme} label="All games" icon="play"
            onPress={() => { setReward(null); navigate('home'); }} style={{ width: '100%' }} />
          <Button theme={theme} label="See my rewards" icon="trophy"
            onPress={() => { setReward(null); navigate('rewards'); }} style={{ width: '100%' }} />
        </View>
        {/* A level-up or badge from this game shows here while the dialog is up, and on the screen below otherwise. */}
        {reward !== null && rewardToast}
      </View>
    </Modal>
    <CelebrationToast theme={theme} />
    {reward === null && rewardToast}
    </SafeAreaView>
  </View>);
}
