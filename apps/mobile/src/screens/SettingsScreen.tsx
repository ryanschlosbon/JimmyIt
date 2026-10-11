import { useRef, useState, type ReactNode } from 'react';
import { Image, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { defaultAccessibilityPreferences, getPersonalizationRecommendation,
  type GameType, type GeneratedLevel, type PersonalizationRecommendation } from '@jimmyit/ai';
import { Body, Button, Eyebrow, Heading, ProgressBar, SwitchRow } from '../components/Controls';
import { COLOR_STYLES, COLOR_STYLE_IDS } from '../design/palettes';
import { FONTS, RADIUS, SETTINGS, SIZE, SPACE, TYPE } from '../design/tokens';
import { Icon, type IconName } from '../components/Icon';
import { Tappable } from '../components/Tappable';
import { JIMMY_NICKNAME_MAX_LENGTH, JimmyNicknameError } from '../jimmy-nickname';
import { APP_ARTWORK } from '../artwork';
import type { Theme } from '../theme';
import type { JimmyState } from '../use-jimmy';

export function SettingsScreen({ theme, state, replayIntro }: {
  readonly theme: Theme; readonly state: JimmyState; readonly replayIntro: () => void;
}) {
  const { width } = useWindowDimensions();
  const compact = width < SETTINGS.columnBreakpoint;
  const phone = width < SIZE.compactWidth;
  const [showMore, setShowMore] = useState(false);
  const [forgotten, setForgotten] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<GameType>('tapQuest');
  const [preview, setPreview] = useState<GeneratedLevel | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const previewSeed = useRef(0);
  const [recommendation, setRecommendation] = useState<PersonalizationRecommendation | null>(null);
  const [shapeKeyDraft, setShapeKeyDraft] = useState('');
  const [shapeKeyBusy, setShapeKeyBusy] = useState(false);
  const [shapeKeyMessage, setShapeKeyMessage] = useState<string | null>(null);
  const ai = state.aiSettings;
  const saveName = (reset = false) => {
    if (nameBusy) return;
    setNameBusy(true);
    setNameMessage(null);
    (reset ? state.resetToyName() : state.renameToy(nameDraft)).then(() => {
      setEditingName(false);
      setNameMessage(reset ? 'Jimmy’s original name is back.' : 'Jimmy’s name is saved on this device.');
    }).catch((error: unknown) => setNameMessage(error instanceof JimmyNicknameError
      ? error.message : 'The name could not be saved. Please try again.'))
      .finally(() => setNameBusy(false));
  };
  const updateAI = (changes: Partial<typeof ai>) => state.setAISettings({ ...ai, ...changes });
  const boardSize = Math.max(220, Math.min(320, width - 100));
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
      .then(level => { setPreview(level); setPreviewMessage('Generated on this device.'); })
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
  const connecting = state.connection === 'searching' || state.connection === 'confirming';
  return <View style={{ gap: SPACE.xl }}>
    <View style={{ backgroundColor: theme.surface, borderRadius: RADIUS.xl, overflow: 'hidden',
      borderWidth: SETTINGS.frameBorderWidth, borderColor: theme.yellow,
      padding: phone ? SPACE.lg : SPACE.xxl, gap: SPACE.xl }}>
      <SettingsBackdrop theme={theme} phone={phone} />
      <View style={{ minHeight: phone ? SETTINGS.heroPhoneHeight : SETTINGS.heroHeight,
        justifyContent: 'center', gap: SPACE.md, paddingRight: phone ? 0 : SETTINGS.heroArtSize + SPACE.xl }}>
        <Tappable accessibilityLabel="Grown-ups" accessibilityState={{ expanded: showMore }}
          accessibilityHint="Shows extra setup options below the main settings cards."
          focusColor={theme.focus} onPress={() => setShowMore(!showMore)}
          style={{ position: phone ? 'relative' : 'absolute', top: 0, right: 0,
            alignSelf: 'flex-start', minHeight: SIZE.touchTarget, borderRadius: RADIUS.pill }}>
          <Image source={APP_ARTWORK.settingsGrownUps} resizeMode="contain" accessible={false}
            style={{ width: phone ? SETTINGS.grownUpsPhoneWidth : SETTINGS.grownUpsWidth,
              height: (phone ? SETTINGS.grownUpsPhoneWidth : SETTINGS.grownUpsWidth) / SETTINGS.grownUpsAspectRatio }} />
        </Tappable>
        <Eyebrow theme={theme}>Grown-ups’ area</Eyebrow>
        <Heading theme={theme} level={1} size={phone ? TYPE.title : TYPE.hero}>JimmyIt Settings</Heading>
      </View>
      <View style={{ backgroundColor: theme.surface, borderRadius: RADIUS.lg,
        borderWidth: SETTINGS.borderWidth, borderColor: theme.teal,
        padding: phone ? SPACE.lg : SPACE.xl, flexDirection: 'row', alignItems: 'center',
        flexWrap: 'wrap', gap: SPACE.lg }}>
        <Image source={APP_ARTWORK.settingsJimmy} resizeMode="contain" accessible={false}
          style={{ width: phone ? SETTINGS.phoneFaceSize : SETTINGS.faceSize,
            height: phone ? SETTINGS.phoneFaceSize : SETTINGS.faceSize }} />
        <View style={{ flex: 1, minWidth: phone ? SETTINGS.phoneFaceSize : SETTINGS.heroArtSize, gap: SPACE.xs }}>
          <Eyebrow theme={theme}>Your Jimmy</Eyebrow>
          <Heading theme={theme} size={phone ? TYPE.subheading : TYPE.heading}>{state.toyName}</Heading>
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: SPACE.sm, alignItems: 'center' }}>
            <View style={{ width: SPACE.md, height: SPACE.md, borderRadius: RADIUS.pill,
              backgroundColor: state.connection === 'connected' ? theme.teal : theme.secondary }} />
            <Text style={{ flexShrink: 1, fontFamily: FONTS.bodyMedium, fontSize: TYPE.small, color: theme.accentText }}>
              {state.connection === 'connected' ? 'Ready to play' : status}</Text>
          </View>
        </View>
        <Button theme={theme} label="Rename" icon="pencil" onPress={() => {
          setNameDraft(state.toyName); setNameMessage(null); setEditingName(true);
        }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
          backgroundColor: theme.raised, borderRadius: RADIUS.md, padding: SPACE.lg }}>
          <Icon name="battery" color={theme.accentText} size={TYPE.subheading} />
          <View><Text style={{ fontFamily: FONTS.bodyBold, fontSize: TYPE.body, color: theme.text }}>
            {state.connection === 'connected' && state.batteryPercent !== null ? `${state.batteryPercent}%` : '—'}</Text>
            <Body theme={theme} small>Battery</Body></View>
        </View>
      </View>
      {editingName && <View style={{ backgroundColor: theme.surface, borderWidth: SETTINGS.borderWidth,
        borderColor: theme.teal, borderRadius: RADIUS.lg, padding: SPACE.xl, gap: SPACE.md }}>
        <Heading theme={theme} size={TYPE.heading}>Name your Jimmy</Heading>
        <Body theme={theme} small>Choose a nickname, up to {JIMMY_NICKNAME_MAX_LENGTH} characters. It stays on this device.</Body>
        <TextInput autoFocus editable={!nameBusy} value={nameDraft} onChangeText={setNameDraft}
          accessibilityLabel="Jimmy nickname" placeholder="Your Jimmy’s name" placeholderTextColor={theme.secondary}
          returnKeyType="done" onSubmitEditing={() => saveName()} autoCorrect={false}
          style={{ minHeight: SIZE.touchTarget, fontFamily: FONTS.body, fontSize: TYPE.body,
            color: theme.text, backgroundColor: theme.raised, borderColor: theme.border,
            borderWidth: SETTINGS.borderWidth, borderRadius: RADIUS.sm, padding: SPACE.lg }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
          <Button theme={theme} color={theme.mint} icon="check" label={nameBusy ? 'Saving…' : 'Save name'}
            disabled={nameBusy} onPress={() => saveName()} />
          <Button theme={theme} label="Cancel" disabled={nameBusy} onPress={() => {
            setEditingName(false); setNameMessage(null);
          }} />
          <Button theme={theme} label="Use original name" disabled={nameBusy} onPress={() => saveName(true)} />
        </View>
      </View>}
      {nameMessage && <View accessibilityLiveRegion="polite" style={{ backgroundColor: theme.surface,
        borderRadius: RADIUS.sm, padding: SPACE.md }}><Body theme={theme} small>{nameMessage}</Body></View>}
      <View style={{ flexDirection: compact ? 'column' : 'row', gap: SPACE.xxl }}>
        <SettingsCard theme={theme} icon="bluetooth" color={theme.mint} iconColor={theme.navy}>
          <View style={{ flex: 1, minWidth: SETTINGS.heroArtSize, gap: SPACE.xs }}><Text style={{ fontFamily: FONTS.bodyBold,
            fontSize: TYPE.body, color: theme.secondary }}>BLUETOOTH</Text>
            <Heading theme={theme} size={TYPE.subheading}>Connection</Heading></View>
          <SettingsToggle theme={theme} label="Jimmy connection" title={state.toyName} text={status}
            value={state.connection !== 'disconnected'}
            onChange={next => next ? state.connect() : state.disconnect()} />
          {state.connection !== 'connected' && <View style={{ width: '100%' }}>
            <Body theme={theme} small>{state.connection === 'confirming'
              ? 'Press the right button on Jimmy to say yes. Switch off to cancel.'
              : connecting ? 'Looking for Jimmy… Switch off to cancel.' : 'Switch on to find Jimmy and play together.'}</Body>
          </View>}
          <View style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
            {state.connection === 'connected' && <Button theme={theme} compact icon="close" label="Disconnect"
              onPress={state.disconnect} />}
            <Button theme={theme} compact icon="undo" label="Forget Jimmy" onPress={() => {
              state.forget();
              setForgotten(true);
            }} />
          </View>
          {forgotten && state.connection !== 'connected' && <View accessibilityLiveRegion="polite" style={{ width: '100%' }}>
            <Body theme={theme} small>Jimmy forgot this tablet. Next time you connect, Jimmy will ask
              “connect?” on its screen again.</Body>
          </View>}
        </SettingsCard>
        <SettingsCard theme={theme} icon="moon" color={theme.pink} iconColor={theme.berry}>
          <View style={{ flex: 1, minWidth: SETTINGS.heroArtSize, gap: SPACE.xs }}><Text style={{ fontFamily: FONTS.bodyBold,
            fontSize: TYPE.body, color: theme.secondary }}>APPEARANCE</Text>
            <Heading theme={theme} size={TYPE.subheading}>Dark mode</Heading></View>
          <SettingsToggle theme={theme} label="Dark mode" text={state.dark ? 'Dark mode is on' : 'Dark mode is off'}
            value={state.dark} onChange={state.setDark} />
        </SettingsCard>
      </View>
    </View>
    {showMore && <View style={{ gap: SPACE.xl }}>
    <View style={{ backgroundColor: theme.surface, borderRadius: RADIUS.lg, padding: SPACE.xl, gap: SPACE.lg }}>
      <Heading theme={theme} size={TYPE.heading}>Look & feel</Heading>
      <SwitchRow theme={theme} title="Floating bubbles" onText="Bubbles drift in the background"
        offText="Bubbles stay still" value={state.bubbles} onChange={state.setBubbles} />
      <View accessibilityRole="radiogroup" accessibilityLabel="Color style" style={{ gap: SPACE.md }}>
        <Body theme={theme} small>Color style</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
          {COLOR_STYLE_IDS.map(id => <Button key={id} theme={theme} compact label={COLOR_STYLES[id].label}
            accessibilityLabel={`${COLOR_STYLES[id].label} colors: ${COLOR_STYLES[id].description}`}
            selected={state.colorStyle === id} color={state.colorStyle === id ? theme.mint : undefined}
            onPress={() => state.setColorStyle(id)} />)}
        </View>
        <Body theme={theme} small>{COLOR_STYLES[state.colorStyle].description}</Body>
      </View>
    </View>
    <View style={{ backgroundColor: theme.surface, borderRadius: RADIUS.lg, padding: SPACE.xl, gap: SPACE.lg }}>
      <Eyebrow theme={theme}>Sensitivity</Eyebrow><Heading theme={theme} size={TYPE.heading}>Calibration</Heading>
      <Body theme={theme} small>Place Jimmy on a flat surface. Keep the controls still while we get ready.</Body>
      <View accessibilityLiveRegion="polite"><Body theme={theme} small>
        {state.calibrating ? `Getting ready… ${state.calibration}%` : state.calibration === 100 ? '✓ Calibration complete' : 'Ready when you are'}
      </Body></View>
      <ProgressBar theme={theme} color={theme.coral} value={state.calibration} max={100} label="Calibration progress" />
      <Button theme={theme} label={state.calibrating ? 'Calibrating…' : state.calibration === 100 ? 'Calibrate again' : 'Start calibration'}
        icon="toy" onPress={state.calibrate} disabled={state.connection !== 'connected' || state.calibrating} />
      {state.connection !== 'connected' && <Body theme={theme} small>Connect Jimmy first.</Body>}
    </View>
    </View>}
    <Tappable accessibilityLabel="Advanced settings" accessibilityState={{ expanded: showAdvanced }}
      accessibilityHint="Shows API settings and activity previews."
      onPress={() => setShowAdvanced(!showAdvanced)} focusColor={theme.focus}
      style={{ minHeight: SIZE.touchTarget, padding: SPACE.lg, borderRadius: RADIUS.md,
        borderWidth: SETTINGS.borderWidth, borderColor: theme.border, backgroundColor: theme.surface,
        flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
      <Icon name="settings" color={theme.text} />
      <Text style={{ flex: 1, fontFamily: FONTS.bodyBold, fontSize: TYPE.body, color: theme.text }}>Advanced settings</Text>
      <View style={{ transform: [{ rotate: showAdvanced ? '90deg' : '0deg' }] }}>
        <Icon name="chevronRight" color={theme.text} />
      </View>
    </Tappable>
    {showAdvanced && <View style={{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1.5,
      borderRadius: 22, padding: 24, gap: 18 }}>
      <View style={{ gap: 5 }}><Eyebrow theme={theme}>OPTIONAL ACTIVITY IDEAS</Eyebrow>
        <Heading theme={theme} size={30}>AI play settings</Heading>
        <Body theme={theme} small>Offline activities work without an account, a key, or the internet.</Body></View>
      <Button theme={theme} label={ai.personalizationEnabled ? 'Activity suggestions on' : 'Activity suggestions off'}
        selected={ai.personalizationEnabled}
        onPress={() => updateAI({ personalizationEnabled: !ai.personalizationEnabled })} />
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
    </View>}
    {showMore && <View style={{ gap: SPACE.xl }}>
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
    </View>}
  </View>;
}

function SettingsToggle({ theme, label, title, text, value, onChange }: {
  readonly theme: Theme; readonly label: string; readonly title?: string; readonly text: string;
  readonly value: boolean; readonly onChange: (next: boolean) => void;
}) {
  return <Tappable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }}
    onPress={() => onChange(!value)} focusColor={theme.focus}
    style={{ flex: 1.6, minWidth: SETTINGS.controlMinWidth, minHeight: SIZE.touchTarget,
      backgroundColor: theme.raised, borderRadius: RADIUS.md, padding: SPACE.lg,
      flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
    <View accessibilityLiveRegion="polite" style={{ flex: 1, gap: SPACE.xs }}>
      {title && <Text style={{ fontFamily: FONTS.bodyBold, fontSize: TYPE.small, color: theme.text }}>{title}</Text>}
      <Text style={{ fontFamily: FONTS.body, fontSize: TYPE.body, color: theme.accentText }}>{text}</Text>
    </View>
    <View style={{ width: SETTINGS.switchWidth, height: SETTINGS.switchHeight, borderRadius: RADIUS.pill,
      padding: SPACE.xs, backgroundColor: value ? theme.teal : theme.border,
      alignItems: value ? 'flex-end' : 'flex-start' }}>
      <View style={{ width: SETTINGS.switchThumbSize, height: SETTINGS.switchThumbSize,
        borderRadius: RADIUS.pill, backgroundColor: theme.art.paper }} />
    </View>
  </Tappable>;
}

function SettingsCard({ theme, icon, color, iconColor, children }: {
  readonly theme: Theme; readonly icon: IconName; readonly color: string;
  readonly iconColor: string; readonly children: ReactNode;
}) {
  return <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: RADIUS.lg,
    borderWidth: SETTINGS.borderWidth, borderColor: theme.secondary, overflow: 'hidden' }}>
    <View style={{ backgroundColor: color, height: SETTINGS.cardArtHeight,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', width: SETTINGS.smallBubbleSize,
        height: SETTINGS.smallBubbleSize, borderRadius: RADIUS.pill, top: -SPACE.xl, left: '52%',
        backgroundColor: theme.art.paper, opacity: 0.3 }} />
      <View pointerEvents="none" style={{ position: 'absolute', width: SETTINGS.smallBubbleSize,
        height: SETTINGS.smallBubbleSize, borderRadius: RADIUS.pill, bottom: -SPACE.xxxl, left: -SPACE.xxl,
        backgroundColor: theme.art.paper, opacity: 0.3 }} />
      <View style={{ width: SETTINGS.cardIconSize, height: SETTINGS.cardIconSize, borderRadius: RADIUS.lg,
        backgroundColor: theme.art.paper, borderWidth: SETTINGS.frameBorderWidth, borderColor: iconColor,
        alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] }}>
        <Icon name={icon} color={iconColor} size={TYPE.title} />
      </View>
    </View>
    <View style={{ minHeight: SETTINGS.cardBodyHeight, padding: SPACE.xl, gap: SPACE.lg,
      flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>{children}</View>
  </View>;
}

function SettingsBackdrop({ theme, phone }: { readonly theme: Theme; readonly phone: boolean }) {
  return <View pointerEvents="none" accessible={false} aria-hidden
    style={{ position: 'absolute', inset: 0, opacity: theme.dark ? 0.15 : 1 }}>
    <View style={{ position: 'absolute', width: SETTINGS.heroBubbleSize, height: SETTINGS.heroBubbleSize,
      borderRadius: RADIUS.pill, backgroundColor: theme.yellow, top: -SPACE.xxxl, left: -SPACE.xxl }} />
    {!phone && <>
      <View style={{ position: 'absolute', width: SETTINGS.heroArtSize, height: SETTINGS.heroArtSize,
        borderRadius: RADIUS.pill, backgroundColor: theme.coral, top: SPACE.xxxl, right: '30%' }} />
      <View style={{ position: 'absolute', width: SETTINGS.smallBubbleSize, height: SETTINGS.smallBubbleSize,
        borderRadius: RADIUS.pill, backgroundColor: theme.mint, top: SPACE.md, right: SETTINGS.heroArtSize }} />
      <View style={{ position: 'absolute', top: SPACE.xxxl * 2, right: SPACE.xxxl }}>
        <Svg width={SETTINGS.heroArtSize} height={SETTINGS.heroArtSize} viewBox="0 0 140 140">
          <G transform="rotate(5 70 70)">
            <Rect x="25" y="20" width="100" height="130" rx="28" fill={theme.berry} />
            <Rect x="15" y="12" width="100" height="130" rx="28" fill={theme.coral} stroke={theme.berry} strokeWidth="3" />
            <Circle cx="48" cy="62" r="11" fill="none" stroke={theme.berry} strokeWidth="2" />
            <Circle cx="81" cy="62" r="11" fill="none" stroke={theme.berry} strokeWidth="2" />
            <Ellipse cx="51" cy="62" rx="9" ry="11" fill={theme.berry} />
            <Ellipse cx="84" cy="62" rx="9" ry="11" fill={theme.berry} />
            <Path d="M50 82Q65 99 80 80Q99 89 87 94Q80 97 70 90" fill="none" stroke={theme.berry}
              strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx="50" cy="111" r="6" fill={theme.yellow} stroke={theme.berry} strokeWidth="1" />
            <Circle cx="81" cy="111" r="6" fill={theme.purple} stroke={theme.berry} strokeWidth="1" />
          </G>
        </Svg>
      </View>
    </>}
    <View style={{ position: 'absolute', width: SETTINGS.heroArtSize, height: SETTINGS.heroArtSize,
      borderRadius: RADIUS.pill, backgroundColor: theme.coral, bottom: -SPACE.xxxl, left: -SPACE.xxxl }} />
    <View style={{ position: 'absolute', width: SETTINGS.bottomBubbleSize, height: SETTINGS.bottomBubbleSize,
      borderRadius: RADIUS.pill, backgroundColor: theme.mint, bottom: -SETTINGS.heroArtSize, left: '40%' }} />
    <View style={{ position: 'absolute', width: SETTINGS.bottomBubbleSize, height: SETTINGS.bottomBubbleSize,
      borderRadius: RADIUS.pill, backgroundColor: theme.yellow, bottom: -SPACE.xxxl, right: -SETTINGS.heroArtSize }} />
  </View>;
}
