import { useRef, useState } from 'react';
import { Text, TextInput, View, useWindowDimensions } from 'react-native';
import { defaultAccessibilityPreferences, getPersonalizationRecommendation,
  type GameType, type GeneratedLevel, type PersonalizationRecommendation } from '@jimmyit/ai';
import { Body, Button, Eyebrow, Heading, ProgressBar, SwitchRow } from '../components/Controls';
import { COLOR_STYLES, COLOR_STYLE_IDS } from '../design/palettes';
import { FONTS } from '../design/tokens';
import { Icon, type IconName } from '../components/Icon';
import { Jimmy } from '../components/Jimmy';
import type { Theme } from '../theme';
import type { JimmyState } from '../use-jimmy';

export function SettingsScreen({ theme, state, replayIntro }: {
  readonly theme: Theme; readonly state: JimmyState; readonly replayIntro: () => void;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 850;
  const [previewType, setPreviewType] = useState<GameType>('tapQuest');
  const [preview, setPreview] = useState<GeneratedLevel | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const previewSeed = useRef(0);
  const [recommendation, setRecommendation] = useState<PersonalizationRecommendation | null>(null);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyMessage, setKeyMessage] = useState<string | null>(null);
  const [shapeKeyDraft, setShapeKeyDraft] = useState('');
  const [shapeKeyBusy, setShapeKeyBusy] = useState(false);
  const [shapeKeyMessage, setShapeKeyMessage] = useState<string | null>(null);
  const ai = state.aiSettings;
  const updateAI = (changes: Partial<typeof ai>) => state.setAISettings({ ...ai, ...changes });
  const boardSize = Math.max(220, Math.min(320, width - 100));
  const saveKey = () => {
    if (keyBusy || !keyDraft.trim()) return;
    setKeyBusy(true);
    setKeyMessage(null);
    state.saveGeminiKey(keyDraft.trim()).then(() => {
      setKeyDraft('');
      setKeyMessage('Key saved for this preview session. You can test the connection now.');
    }).catch(() => setKeyMessage('Could not reach the local AI service. Start it and try again.'))
      .finally(() => setKeyBusy(false));
  };
  const removeKey = () => {
    if (keyBusy) return;
    setKeyBusy(true);
    setKeyDraft('');
    state.clearGeminiKey().then(() => setKeyMessage('Key removed from this session.'))
      .catch(() => setKeyMessage('Key cleared here. The local service will expire its copy.'))
      .finally(() => setKeyBusy(false));
  };
  const saveShapeKey = () => {
    if (shapeKeyBusy || !shapeKeyDraft.trim()) return;
    setShapeKeyBusy(true);
    setShapeKeyMessage(null);
    state.saveShapeKey(shapeKeyDraft.trim()).then(() => {
      setShapeKeyDraft('');
      setShapeKeyMessage('Shape key saved for this session. Try Shape Quest now.');
    }).catch(() => setShapeKeyMessage('Could not connect to the shape AI service. Check its address and try again.'))
      .finally(() => setShapeKeyBusy(false));
  };
  const removeShapeKey = () => {
    if (shapeKeyBusy) return;
    setShapeKeyBusy(true);
    setShapeKeyDraft('');
    state.clearShapeKey().then(() => setShapeKeyMessage('Shape key removed from this session.'))
      .catch(() => setShapeKeyMessage('Key cleared here. The AI service will expire its copy.'))
      .finally(() => setShapeKeyBusy(false));
  };
  const generatePreview = () => {
    if (previewBusy) return;
    setPreviewBusy(true);
    setPreviewMessage(null);
    previewSeed.current = previewSeed.current === 0 ? Math.floor(Math.random() * 0x7fffffff) + 1
      : (previewSeed.current + 1) & 0x7fffffff;
    state.aiService.generateLevel({ gameType: previewType, theme: 'garden', difficulty: 2,
      accessibilityPreferences: defaultAccessibilityPreferences(), targetCount: 4,
      variationSeed: previewSeed.current,
      availableInputControls: previewType === 'memoryQuest' ? ['clicker'] : ['screenTouch'] })
      .then(level => { setPreview(level); setPreviewMessage(level.source === 'gemini'
        ? 'Gemini generated this activity.' : 'Generated offline on this device.'); })
      .catch(() => { setPreview(null); setPreviewMessage('Could not make an activity yet. Try again.'); })
      .finally(() => setPreviewBusy(false));
  };
  const showExampleRecommendation = (accuracy: number) => {
    const round = { accuracy, completionRate: accuracy, successfulInputs: Math.round(accuracy * 20),
      incorrectInputs: Math.round((1 - accuracy) * 20) };
    setRecommendation(getPersonalizationRecommendation({ gameId: 'tap-quest-precision',
      currentDifficulty: 2, recentRounds: [round, round, round] }, defaultAccessibilityPreferences()));
  };
  const status = state.connection === 'connected' ? 'Connected' : state.connection === 'searching' ? 'Searching…'
    : state.connection === 'confirming' ? 'Waiting for a yes on Jimmy' : 'Disconnected';
  const color = state.connection === 'connected' ? theme.mint
    : state.connection === 'searching' || state.connection === 'confirming' ? theme.yellow : theme.coral;
  const panels: readonly { title: string; eyebrow: string; icon: IconName; color: string }[] = [
    { title: 'Connection', eyebrow: 'BLUETOOTH', icon: 'bluetooth', color: theme.mint },
    { title: 'Calibration', eyebrow: 'SENSITIVITY', icon: 'toy', color: theme.coral },
    { title: 'Look & feel', eyebrow: 'APPEARANCE', icon: 'moon', color: theme.pink },
  ];
  return <View style={{ gap: 26 }}>
    <View style={{ backgroundColor: theme.surface, borderRadius: 26, padding: 30,
      borderWidth: 2, borderColor: theme.yellow, gap: 8 }}>
      <Eyebrow theme={theme}>Grown-ups’ area</Eyebrow><Heading theme={theme} level={1} size={44}>Jimmy settings</Heading>
      <Body theme={theme} small>A little setup for a lot of play.</Body>
    </View>
    <View style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 25, borderWidth: 1.5,
      borderColor: theme.border, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
      <Jimmy face size={76} color={color} />
      <View style={{ flex: 1, minWidth: 160, gap: 3 }}><Eyebrow theme={theme}>Your Jimmy</Eyebrow>
        <Heading theme={theme} size={29}>{state.toyName}</Heading>
        <View accessibilityLiveRegion="polite"><Body theme={theme} small>{status} · {state.connectorKind === 'simulated'
          ? 'Virtual toy' : state.connectorKind === 'bluetooth' ? 'Bluetooth' : 'No toy connection in this build'}</Body></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, backgroundColor: theme.raised, borderRadius: 16, padding: 16 }}>
        <Icon name="battery" color={theme.accentText} />
        <Body theme={theme} small>{state.connection === 'connected' && state.batteryPercent !== null
          ? `${state.batteryPercent}% battery` : 'Battery —'}</Body>
      </View>
    </View>
    <View style={{ flexDirection: compact ? 'column' : 'row', gap: 20 }}>
      {panels.map((panel, index) => <View key={panel.title} style={{ flex: 1, backgroundColor: theme.surface,
        borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: theme.border }}>
        <View style={{ backgroundColor: panel.color, height: 110, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ borderRadius: 18, padding: 13, borderWidth: 2, borderColor: theme.navy,
            transform: [{ rotate: '-5deg' }], backgroundColor: '#FFFFFF55' }}>
            <Icon name={panel.icon} size={31} color={theme.navy} />
          </View>
        </View>
        <View style={{ padding: 24, gap: 18 }}>
          <View style={{ gap: 7 }}><Eyebrow theme={theme}>{panel.eyebrow}</Eyebrow><Heading theme={theme} size={30}>{panel.title}</Heading></View>
          {index === 0 && <>
            <Body theme={theme} small>{state.connection === 'connected' ? 'Jimmy is ready for your next adventure.'
              : state.connection === 'searching' ? 'Looking for your little play partner…'
              : state.connection === 'confirming' ? 'Jimmy is asking if this device may connect. Press the right button on Jimmy to say yes.'
              : 'Find Jimmy to start playing together.'}</Body>
            <Button theme={theme} color={theme.mint} icon="bluetooth"
              label={state.connection === 'connected' ? 'Disconnect'
                : state.connection === 'searching' || state.connection === 'confirming' ? 'Cancel' : 'Find Jimmy'}
              onPress={state.connection === 'disconnected' ? state.connect : state.disconnect} />
            <Button theme={theme} label="Reconnect" icon="spin" onPress={state.connect}
              disabled={state.connection === 'searching' || state.connection === 'confirming'} />
          </>}
          {index === 1 && <>
            <Body theme={theme} small>Place Jimmy on a flat surface. Keep the controls still while we get ready.</Body>
            <View accessibilityLiveRegion="polite"><Body theme={theme} small>
              {state.calibrating ? `Getting ready… ${state.calibration}%` : state.calibration === 100 ? '✓ Calibration complete' : 'Ready when you are'}
            </Body></View>
            <ProgressBar theme={theme} color={theme.coral} value={state.calibration} max={100} label="Calibration progress" />
            <Button theme={theme} label={state.calibrating ? 'Calibrating…' : state.calibration === 100 ? 'Calibrate again' : 'Start calibration'}
              icon="toy" onPress={state.calibrate} disabled={state.connection !== 'connected' || state.calibrating} />
            {state.connection !== 'connected' && <Body theme={theme} small>Connect Jimmy first.</Body>}
          </>}
          {index === 2 && <>
            <Body theme={theme} small>Make Jimmy’s world look just right. Your choices stay saved on this device.</Body>
            <SwitchRow theme={theme} title="Use dark colors" onText="Dark mode is on" offText="Dark mode is off"
              value={state.dark} onChange={state.setDark} />
            <SwitchRow theme={theme} title="Floating bubbles" onText="Bubbles drift in the background"
              offText="Bubbles stay still" value={state.bubbles} onChange={state.setBubbles} />
            <View accessibilityRole="radiogroup" accessibilityLabel="Color style" style={{ gap: 10 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 18, color: theme.text }}>Color style</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {COLOR_STYLE_IDS.map(id => <Button key={id} theme={theme} compact label={COLOR_STYLES[id].label}
                  accessibilityLabel={`${COLOR_STYLES[id].label} colors: ${COLOR_STYLES[id].description}`}
                  selected={state.colorStyle === id} color={state.colorStyle === id ? theme.mint : undefined}
                  onPress={() => state.setColorStyle(id)} />)}
              </View>
              <Body theme={theme} small>{COLOR_STYLES[state.colorStyle].description}</Body>
            </View>
          </>}
        </View>
      </View>)}
    </View>
    <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1.5,
      borderRadius: 22, padding: 24, gap: 18 }}>
      <View style={{ gap: 5 }}><Eyebrow theme={theme}>OPTIONAL ACTIVITY IDEAS</Eyebrow>
        <Heading theme={theme} size={30}>AI play settings</Heading>
        <Body theme={theme} small>Offline activities work without an account, a key, or the internet.</Body></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Button theme={theme} label="Offline generator" selected={ai.provider === 'offline'}
          onPress={() => updateAI({ provider: 'offline', generationEnabled: false })} />
        <Button theme={theme} label="Gemini API" selected={ai.provider === 'gemini'}
          onPress={() => updateAI({ provider: 'gemini' })} />
      </View>
      <Button theme={theme} label={ai.generationEnabled ? 'AI game generation on' : 'AI game generation off'}
        selected={ai.generationEnabled} onPress={() => updateAI({ generationEnabled: !ai.generationEnabled })} />
      <Button theme={theme} label={ai.personalizationEnabled ? 'Activity suggestions on' : 'Activity suggestions off'}
        selected={ai.personalizationEnabled}
        onPress={() => updateAI({ personalizationEnabled: !ai.personalizationEnabled })} />
      <View style={{ gap: 8 }}><Heading theme={theme} size={23}>Gemini model</Heading>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Button theme={theme} label="3.8 Flash" selected={ai.model === 'gemini-3.8-flash'}
            onPress={() => updateAI({ model: 'gemini-3.8-flash' })} />
          <Button theme={theme} label="3.5 Flash-Lite" selected={ai.model === 'gemini-3.5-flash-lite'}
            onPress={() => updateAI({ model: 'gemini-3.5-flash-lite' })} />
        </View>
      </View>
      <View style={{ gap: 8 }}><Heading theme={theme} size={23}>Hugging Face key for Shape Quest</Heading>
        <TextInput editable={!shapeKeyBusy} secureTextEntry value={shapeKeyDraft} onChangeText={setShapeKeyDraft}
          autoCapitalize="none" autoCorrect={false} placeholder="Paste your Hugging Face token"
          accessibilityLabel="Hugging Face token" style={{ borderWidth: 1.5,
            borderColor: theme.border, borderRadius: 14, padding: 14, color: theme.text }} />
        <Body theme={theme} small>The token goes to your configured AI service over HTTPS, or localhost in a
          development preview. It stays in memory for up to 30 minutes and is never saved in app settings.
          Drawings use a temporary session ID.</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Button theme={theme} label={shapeKeyBusy ? 'Saving…' : 'Save shape key for this session'}
            onPress={saveShapeKey} disabled={shapeKeyBusy || !shapeKeyDraft.trim()} />
          <Button theme={theme} label="Remove shape key" onPress={removeShapeKey}
            disabled={shapeKeyBusy || !state.shapeSessionToken} />
        </View>
        <View accessibilityLiveRegion="polite"><Body theme={theme} small>{shapeKeyMessage ??
          (state.shapeSessionToken ? 'A shape key is ready for this session.' :
            'Without a key, Shape Quest recognizes drawings on this device.')}</Body></View>
      </View>
      <View style={{ gap: 8 }}><Heading theme={theme} size={23}>Gemini API key</Heading>
        <TextInput editable={!keyBusy} secureTextEntry value={keyDraft} onChangeText={setKeyDraft}
          autoCapitalize="none" autoCorrect={false} placeholder="Tap here and paste your Gemini key"
          accessibilityLabel="Gemini API key" style={{ borderWidth: 1.5,
            borderColor: theme.border, borderRadius: 14, padding: 14, color: theme.text }} />
        <Body theme={theme} small>This local preview sends your key to the AI service on this computer. It stays in
          memory for up to 30 minutes and is never saved with your app settings. Paste into the field, then save.</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Button theme={theme} label={keyBusy ? 'Saving…' : 'Save key for this session'}
            onPress={saveKey} disabled={keyBusy || !keyDraft.trim()} />
          <Button theme={theme} label="Remove key" onPress={removeKey} disabled={keyBusy || !state.hasGeminiKey} />
        </View>
        <View accessibilityLiveRegion="polite"><Body theme={theme} small>{keyMessage ??
          (state.hasGeminiKey ? 'A key is ready for this session.' : 'No key saved for this session.')}</Body></View>
      </View>
      <Button theme={theme} label={state.aiConnection === 'checking' ? 'Checking connection…' : 'Test AI connection'}
        onPress={state.testAIConnection} disabled={!ai.generationEnabled || ai.provider !== 'gemini' ||
          state.aiConnection === 'checking'} />
      <View accessibilityLiveRegion="polite"><Body theme={theme} small>
        {state.aiConnection === 'ready' ? 'AI service ready.' : state.aiConnection === 'unavailable'
          ? 'AI service unavailable. Offline activities are still ready.' :
          'Gemini needs a trusted AI service and an explicit opt-in. Only activity settings are sent when it is used.'}
      </Body></View>
      <View style={{ backgroundColor: theme.raised, borderRadius: 18, padding: 18, gap: 12 }}>
        <Heading theme={theme} size={24}>Try an activity idea</Heading>
        <Body theme={theme} small>Choose a type, then make a sample level. This preview does not save a score.</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {([{ type: 'tapQuest', label: 'Tap' }, { type: 'shapeQuest', label: 'Shape' },
            { type: 'memoryQuest', label: 'Memory' }, { type: 'reaction', label: 'Reaction' },
            { type: 'calm', label: 'Calm' }] as const).map(item =>
            <Button key={item.type} theme={theme} label={item.label} compact selected={previewType === item.type}
              onPress={() => { setPreviewType(item.type); setPreview(null); setPreviewMessage(null); }} />)}
        </View>
        <Button theme={theme} color={theme.mint} label={previewBusy ? 'Making activity…' : 'Make sample level'}
          disabled={previewBusy} onPress={generatePreview} />
        {previewMessage && <View accessibilityLiveRegion="polite"><Body theme={theme} small>{previewMessage}</Body></View>}
        {preview && <View style={{ gap: 12 }}>
          <Heading theme={theme} size={23}>{preview.title}</Heading>
          <Body theme={theme} small>{preview.instructions}</Body>
          <Body theme={theme} small>Difficulty {preview.difficulty} · {preview.targets.length || preview.sequence.length} steps
            · {preview.timing.activityDurationMs === null ? 'Untimed' : `${preview.timing.activityDurationMs / 1000} seconds`}</Body>
          {preview.targets.length > 0 && <View accessibilityLabel={`${preview.targets.length} ordered targets`}
            style={{ width: boardSize, height: boardSize, maxWidth: '100%', alignSelf: 'center',
              backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1.5, borderColor: theme.border }}>
            {preview.targets.map(target => <View key={target.order} style={{ position: 'absolute',
              left: (target.x - target.radius) * boardSize, top: (target.y - target.radius) * boardSize,
              width: target.radius * 2 * boardSize, height: target.radius * 2 * boardSize,
              borderRadius: target.shape === undefined || target.shape === 'circle' ? 999 : 10,
              backgroundColor: theme.mint, borderColor: theme.navy, borderWidth: 2,
              justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: theme.navy, fontWeight: '700' }}>{target.shape?.[0]?.toUpperCase() ?? target.order + 1}</Text>
            </View>)}
          </View>}
          {preview.sequence.length > 0 && <Body theme={theme} small>Pattern: {preview.sequence.join(' → ')}</Body>}
        </View>}
      </View>
      <View style={{ backgroundColor: theme.raised, borderRadius: 18, padding: 18, gap: 12 }}>
        <Heading theme={theme} size={24}>Try personalization</Heading>
        <Body theme={theme} small>These examples use three sample rounds. They do not change your saved games.</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Button theme={theme} label="Steady practice" onPress={() => showExampleRecommendation(0.55)} />
          <Button theme={theme} label="Ready for more" onPress={() => showExampleRecommendation(0.95)} />
        </View>
        {recommendation && <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
          <Body theme={theme} small>{recommendation.explanation}</Body>
          <Body theme={theme} small>Suggested difficulty: {recommendation.recommendedDifficulty}
            · Targets: {recommendation.suggestedTargetCount}
            · {recommendation.suggestedResponseWindowMs === null ? 'Untimed' :
              `${recommendation.suggestedResponseWindowMs / 1000} seconds per target`}</Body>
        </View>}
      </View>
    </View>
    <View style={{ flexDirection: 'row', gap: 14, backgroundColor: theme.raised, borderRadius: 18, padding: 22 }}>
      <Icon name="sparkle" color={theme.gold} />
      <View style={{ flex: 1, gap: 4 }}><Heading theme={theme} size={23}>A safe place to practice</Heading>
        <Body theme={theme} small>{state.connectorKind === 'simulated' ? 'This preview uses a virtual Jimmy (the Toy button). Calibration is simulated.'
          : 'Calibration is simulated for now.'} Drawings and points stay on this device.</Body>
      </View>
    </View>
    <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1.5,
      borderRadius: 20, padding: 24, gap: 14, alignItems: 'flex-start' }}>
      <Heading theme={theme} size={26}>A little hello from Jimmy</Heading>
      <Body theme={theme} small>Watch the short welcome again. Reduced motion uses a still greeting.</Body>
      <Button theme={theme} label="Replay welcome" icon="sparkle" onPress={replayIntro} />
    </View>
  </View>;
}
