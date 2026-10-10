import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StatusBar, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { getTheme } from './theme';
import { useJimmy } from './use-jimmy';
import { drawingReducer, type DrawingAction, type Stroke } from './drawing';
import type { Activity } from './progress';
import { HomeScreen } from './screens/HomeScreen';
import { DrawingScreen } from './screens/DrawingScreen';
import { RewardsScreen } from './screens/RewardsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { IntroScreen } from './screens/IntroScreen';
import { TimedScreen } from './screens/TimedScreen';
import { createTimedChallenge, type TimedResult } from './timed-challenge';
import { Body, Button, Eyebrow, Heading } from './components/Controls';
import { Icon, type IconName } from './components/Icon';
import { Jimmy } from './components/Jimmy';
import { setupWebAccessibility } from './web-accessibility';

type Screen = 'home' | 'draw' | 'rewards' | 'settings' | 'timed';
interface Draft { readonly id: string; readonly startedAtMs: number | null; readonly strokes: readonly Stroke[] }

function newDraft(): Draft {
  const startedAtMs = Date.now();
  return { id: `drawing-${startedAtMs}-${Math.random().toString(36).slice(2)}`, startedAtMs: null, strokes: [] };
}

export function App() {
  return <SafeAreaProvider><JimmyApp /></SafeAreaProvider>;
}

function JimmyApp() {
  const state = useJimmy();
  const theme = getTheme(state.dark);
  const [fontsLoaded, fontError] = useFonts({ Baloo: Baloo2_700Bold, Poppins: Poppins_400Regular,
    PoppinsBold: Poppins_600SemiBold });
  const [screen, setScreen] = useState<Screen>('home');
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);
  const [challenge] = useState(() => createTimedChallenge());
  const [timedSaving, setTimedSaving] = useState(false);
  const [timedSaved, setTimedSaved] = useState(false);
  const timedSavingRef = useRef(false);
  const savedTimedId = useRef<string | null>(null);
  const timedSubmit = useRef<(result: TimedResult) => void>(() => undefined);
  const [activity, setActivity] = useState<Activity>('drawing');
  const [drafts, setDrafts] = useState<Record<Activity, Draft>>(() => ({ drawing: newDraft(), shapes: newDraft() }));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [reward, setReward] = useState<number | null>(null);
  const [rewardFrom, setRewardFrom] = useState<'draw' | 'timed'>('draw');
  const scroll = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const compact = width < 680;
  useEffect(() => setupWebAccessibility(state.dark), [state.dark]);
  useEffect(() => challenge.onComplete(result => timedSubmit.current(result)), [challenge]);
  useEffect(() => () => challenge.dispose(), [challenge]);

  timedSubmit.current = result => {
    if (timedSavingRef.current || savedTimedId.current === result.id) return;
    timedSavingRef.current = true;
    setTimedSaving(true);
    state.finishTimed(result).then(points => {
      savedTimedId.current = result.id;
      setTimedSaved(true);
      setRewardFrom('timed');
      setReward(points);
    }).catch(() => state.setError('Your little moves are still here. Please use Retry saving to save your points.'))
      .finally(() => { timedSavingRef.current = false; setTimedSaving(false); });
  };

  const navigate = (next: Screen) => { setScreen(next); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const start = (next: Activity) => { setActivity(next); navigate('draw'); };
  const dispatch = (action: DrawingAction) => setDrafts(current => ({ ...current,
    [activity]: { ...current[activity], startedAtMs: current[activity].startedAtMs ?? Date.now(),
      strokes: drawingReducer(current[activity].strokes, action) },
  }));

  const finish = () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const draft = drafts[activity];
    const startedAtMs = draft.startedAtMs ?? Date.now();
    state.finish({ id: draft.id, startedAtMs, durationMs: Date.now() - startedAtMs,
      strokes: draft.strokes.length, activity }).then(() => {
      setRewardFrom('draw');
      setReward(draft.strokes.length > 0 ? 50 : 10);
      setDrafts(current => ({ ...current, [activity]: newDraft() }));
    }).catch(() => state.setError('Your drawing is still here. We couldn’t save your points yet — please try All done again.'))
      .finally(() => { setSaving(false); savingRef.current = false; });
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
              ? 'Finding Jimmy…' : 'Find your Jimmy'}</Body>
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
        {screen === 'draw' && <DrawingScreen theme={theme} activity={activity} strokes={drafts[activity].strokes}
          dispatch={dispatch} finish={finish} saving={saving} />}
        {screen === 'rewards' && <RewardsScreen theme={theme} progress={state.progress} />}
        {screen === 'settings' && <SettingsScreen theme={theme} state={state}
          replayIntro={() => { navigate('home'); setIntroDone(false); }} />}
        {screen === 'timed' && <TimedScreen theme={theme} challenge={challenge} saving={timedSaving} saved={timedSaved}
          onStart={durationMs => { setTimedSaved(false); challenge.start(durationMs); }}
          onRetry={() => { const result = challenge.getResult(); if (result) timedSubmit.current(result); }} />}
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
          <Eyebrow theme={theme}>A little big win</Eyebrow><Heading theme={theme} size={40}>You made it!</Heading>
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
  </SafeAreaView>;
}
