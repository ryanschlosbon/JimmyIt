import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { ScoreRecord } from '@jimmyit/core';
import type { SaveStatus } from '@jimmyit/game-sdk';
import { getTheme } from './theme';
import { useJimmy } from './use-jimmy';
import { DRAWING_GAMES, timedPracticeGame, type Activity } from './games';
import { createToySetup, loadDevToyPanel } from './toy-connector';
import { CelebrationOverlay } from './components/CelebrationOverlay';
import { HomeScreen } from './screens/HomeScreen';
import { DrawingScreen } from './screens/DrawingScreen';
import { RewardsScreen } from './screens/RewardsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { IntroScreen } from './screens/IntroScreen';
import { TimedScreen, type VirtualToy } from './screens/TimedScreen';
import { Body, Button, Eyebrow, Heading } from './components/Controls';
import { Icon, type IconName } from './components/Icon';
import { Jimmy } from './components/Jimmy';
import { setupWebAccessibility } from './web-accessibility';

type Screen = 'home' | 'draw' | 'rewards' | 'settings' | 'timed';
const NO_STROKES: readonly Stroke[] = [];
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
  const theme = getTheme(state.dark);
  const [fontsLoaded, fontError] = useFonts({ Baloo: Baloo2_700Bold, Poppins: Poppins_400Regular,
    PoppinsBold: Poppins_600SemiBold });
  const [screen, setScreen] = useState<Screen>('home');
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);
  const timed = useGameRun<TimedPracticeState>();
  const drawingRuns = {
    drawing: useGameRun<DrawingGameState, DrawingGameAction>(),
    shapes: useGameRun<DrawingGameState, DrawingGameAction>(),
  };
  const [activity, setActivity] = useState<Activity>('drawing');
  const [drafts, setDrafts] = useState<Record<Activity, readonly Stroke[]>>({ drawing: NO_STROKES, shapes: NO_STROKES });
  const [reward, setReward] = useState<number | null>(null);
  const [rewardNewBest, setRewardNewBest] = useState(false);
  const [rewardFrom, setRewardFrom] = useState<'draw' | 'timed'>('draw');
  const scroll = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const compact = width < 680;
  useEffect(() => setupWebAccessibility(state.dark), [state.dark]);

  const drawingSaveFailed = () => state.setError('Your drawing is still here. We couldn’t save your points yet — please try All done again.');
  useRunOutcome(timed, record => { setRewardFrom('timed'); setRewardNewBest(record.newBest); setReward(record.score); },
    () => state.setError('Your little moves are still here. Please use Retry saving to save your points.'));
  // A saved drawing shows its points, then that activity starts on a fresh canvas.
  useRunOutcome(drawingRuns.drawing, record => {
    setRewardFrom('draw'); setRewardNewBest(false); setReward(record.score);
    setDrafts(current => ({ ...current, drawing: NO_STROKES })); drawingRuns.drawing.clear();
  }, drawingSaveFailed);
  useRunOutcome(drawingRuns.shapes, record => {
    setRewardFrom('draw'); setRewardNewBest(false); setReward(record.score);
    setDrafts(current => ({ ...current, shapes: NO_STROKES })); drawingRuns.shapes.clear();
  }, drawingSaveFailed);

  const navigate = (next: Screen) => { setScreen(next); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const start = (next: Activity) => { setActivity(next); navigate('draw'); };
  const dispatch = (action: DrawingAction) => {
    const run = drawingRuns[activity];
    // The game's clock starts with the first mark, as the drawing's time always has.
    if (action.type === 'begin' && run.status !== 'running') run.start(DRAWING_GAMES[activity], { tickMs: DRAWING_TICK_MS });
    setDrafts(current => ({ ...current, [activity]: drawingReducer(current[activity], action) }));
  };

  const finish = () => {
    const current = drawingRuns[activity];
    if (current.saveStatus === 'saving') return;
    if (current.status === 'finished' && current.saveStatus === 'failed') { current.retrySave(); return; }
    const run = current.status === 'running' && current.run ? current.run
      : current.start(DRAWING_GAMES[activity], { tickMs: DRAWING_TICK_MS });
    run.submit({ type: 'finish', strokeCount: drafts[activity].length });
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
          timed={() => navigate('timed')} />}
        {screen === 'draw' && <DrawingScreen theme={theme} activity={activity} strokes={drafts[activity]}
          dispatch={dispatch} finish={finish} saving={drawingRuns[activity].saveStatus === 'saving'} />}
        {screen === 'rewards' && <RewardsScreen theme={theme} progress={state.progress} />}
        {screen === 'settings' && <SettingsScreen theme={theme} state={state}
          replayIntro={() => { navigate('home'); setIntroDone(false); }} />}
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
          compact vertical={compact} selected={screen === item.screen || (screen === 'timed' && item.screen === 'home')}
          onPress={() => navigate(item.screen)}
          color={screen === item.screen || (screen === 'timed' && item.screen === 'home') ? theme.mint : undefined}
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
          <Body theme={theme}>{rewardFrom === 'timed' ? 'So many wonderful little moves.' : 'What a wonderful little try.'}</Body>
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Icon name="star" color={theme.dark ? theme.yellow : '#8A6500'} size={34} />
            <Heading theme={theme} size={36}>+{reward ?? 0} points</Heading>
          </View>
          <Button theme={theme} label="See my rewards" icon="star" color={theme.yellow}
            onPress={() => { setReward(null); navigate('rewards'); }} style={{ width: '100%' }} />
          <Button theme={theme} label={rewardFrom === 'timed' ? 'Keep playing' : 'Keep creating'}
            icon={rewardFrom === 'timed' ? 'timer' : 'pencil'} onPress={() => { setReward(null);
              navigate(rewardFrom === 'timed' ? 'timed' : 'draw'); }} style={{ width: '100%' }} />
        </View>
      </View>
    </Modal>
    <CelebrationOverlay theme={theme} />
  </SafeAreaView>;
}
