import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ConnectionErrorKind, useConnection, useScores, useToyState } from '@jimmyit/app-kit';
import { BADGE_VISUALS } from './badge-visuals';
import { AI_MODELS, DEFAULT_AI_SETTINGS, createConfiguredAIService, registerGeminiKey,
  removeGeminiKey, type AISettings } from './ai-service';
import { GAME_CATALOG } from './games';
import { registerShapeKey, removeShapeKey } from './shape-recognition-service';
import { DEFAULT_COLOR_STYLE, isColorStyleId, type ColorStyleId } from './design/palettes';
import { createJimmyNicknamePreference } from './jimmy-nickname';

const nicknamePreference = createJimmyNicknamePreference(AsyncStorage);

/** Where appearance choices are saved on the device. */
const APPEARANCE_KEYS = { dark: 'jimmy.appearance', bubbles: 'jimmy.bubbles', colorStyle: 'jimmy.colorStyle' } as const;

/** 'confirming': Jimmy is asking the child "connect to this phone?" on its screen. */
export type Connection = 'connected' | 'disconnected' | 'searching' | 'confirming';

/** Child-friendly wording for each connection problem app-kit can report. */
const CONNECTION_MESSAGES: Readonly<Record<ConnectionErrorKind, string>> = {
  unavailable: 'Bluetooth isn’t ready in this version of the app yet.',
  notFound: 'Jimmy is taking a little break. Try finding Jimmy again.',
  lost: 'Jimmy wandered off. Bring Jimmy closer and find Jimmy again.',
  versionMismatch: 'Jimmy needs a quick update before you can play together.',
  declined: 'Jimmy didn’t get a yes. When Jimmy asks, press the right button to say yes.',
  syncFailed: 'Some of Jimmy’s scores haven’t come over yet. They’re safe on Jimmy.',
};

/** Screen-facing state for the current design. Game and score logic live in @jimmyit/app-kit. */
export function useJimmy() {
  const connection = useConnection();
  const scores = useScores({ games: GAME_CATALOG });
  const toy = useToyState();
  const [dark, setDarkState] = useState(false);
  const [bubbles, setBubblesState] = useState(true);
  const [colorStyle, setColorStyleState] = useState<ColorStyleId>(DEFAULT_COLOR_STYLE);
  const [appearanceReady, setAppearanceReady] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [aiSettings, setAISettingsState] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [aiConnection, setAIConnection] = useState<'unchecked' | 'checking' | 'ready' | 'unavailable'>('unchecked');
  const [aiSessionToken, setAISessionToken] = useState<string | undefined>();
  const [shapeSessionToken, setShapeSessionToken] = useState<string | undefined>();
  const [localError, setLocalError] = useState<string | null>(null);
  const [calibration, setCalibration] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  const calibrationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(APPEARANCE_KEYS.dark), AsyncStorage.getItem(APPEARANCE_KEYS.bubbles),
      AsyncStorage.getItem(APPEARANCE_KEYS.colorStyle), nicknamePreference.load()])
      .then(([darkValue, bubblesValue, styleValue, savedNickname]) => {
      if (!active) return;
      setDarkState(darkValue === 'dark');
      setBubblesState(bubblesValue !== 'off');
      if (isColorStyleId(styleValue)) setColorStyleState(styleValue);
      setNickname(savedNickname);
    })
      .catch(() => { if (active) setLocalError('Your saved preferences could not be opened.'); })
      .finally(() => { if (active) setAppearanceReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('jimmy.ai.settings').then(raw => {
      if (!active || !raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return;
      const value = parsed as Record<string, unknown>;
      if (typeof value.generationEnabled !== 'boolean' ||
        !['offline', 'gemini'].includes(String(value.provider)) ||
        !AI_MODELS.includes(value.model as AISettings['model']) ||
        typeof value.personalizationEnabled !== 'boolean') return;
      setAISettingsState(value as unknown as AISettings);
    }).catch(() => { if (active) setLocalError('Your AI choices could not be opened. Offline play is available.'); });
    return () => { active = false; };
  }, []);

  const aiService = useMemo(() => createConfiguredAIService(aiSettings, aiSessionToken), [aiSettings, aiSessionToken]);
  const saveGeminiKey = async (apiKey: string): Promise<void> => {
    const token = await registerGeminiKey(apiKey);
    setAISessionToken(token);
    setAIConnection('unchecked');
    setAISettings({ ...aiSettings, provider: 'gemini', generationEnabled: true });
  };
  const clearGeminiKey = async (): Promise<void> => {
    const token = aiSessionToken;
    setAISessionToken(undefined);
    setAIConnection('unchecked');
    if (token) await removeGeminiKey(token);
  };
  const saveShapeKey = async (apiKey: string): Promise<void> => {
    const token = await registerShapeKey(apiKey);
    const previous = shapeSessionToken;
    setShapeSessionToken(token);
    if (previous) await removeShapeKey(previous).catch(() => undefined);
  };
  const clearShapeKey = async (): Promise<void> => {
    const token = shapeSessionToken;
    setShapeSessionToken(undefined);
    if (token) await removeShapeKey(token);
  };
  const setAISettings = (next: AISettings) => {
    setAISettingsState(next);
    setAIConnection('unchecked');
    AsyncStorage.setItem('jimmy.ai.settings', JSON.stringify(next))
      .catch(() => setLocalError('Your AI choices changed, but could not be saved for next time.'));
  };
  const testAIConnection = () => {
    setAIConnection('checking');
    aiService.testAIConnection().then(available => setAIConnection(available ? 'ready' : 'unavailable'))
      .catch(() => setAIConnection('unavailable'));
  };

  const stopCalibration = () => {
    if (calibrationTimer.current) clearInterval(calibrationTimer.current);
    calibrationTimer.current = null;
    setCalibrating(false);
  };
  useEffect(() => () => stopCalibration(), []);
  useEffect(() => { if (connection.status !== 'connected') stopCalibration(); }, [connection.status]);

  // Calibration is still a UI simulation: it never changes values on the toy.
  const calibrate = () => {
    if (connection.status !== 'connected' || calibrating) return;
    setCalibration(0);
    setCalibrating(true);
    let percent = 0;
    calibrationTimer.current = setInterval(() => {
      percent = Math.min(100, percent + 10);
      setCalibration(percent);
      if (percent === 100) stopCalibration();
    }, 350);
  };

  const saveAppearance = (key: string, value: string) => {
    AsyncStorage.setItem(key, value)
      .catch(() => setLocalError('Your appearance changed, but could not be saved for next time.'));
  };
  const setDark = (next: boolean) => { setDarkState(next); saveAppearance(APPEARANCE_KEYS.dark, next ? 'dark' : 'light'); };
  const setBubbles = (next: boolean) => { setBubblesState(next); saveAppearance(APPEARANCE_KEYS.bubbles, next ? 'on' : 'off'); };
  const setColorStyle = (next: ColorStyleId) => { setColorStyleState(next); saveAppearance(APPEARANCE_KEYS.colorStyle, next); };
  const renameToy = async (draft: string) => { setNickname(await nicknamePreference.save(draft)); };
  const resetToyName = async () => { await nicknamePreference.reset(); setNickname(null); };

  const progress = useMemo(() => ({
    ...scores.progress,
    badges: scores.progress.badges.map(badge => ({ ...badge, ...BADGE_VISUALS[badge.id] })),
  }), [scores.progress]);

  const error = localError
    ?? (scores.error ? 'Your saved progress could not be opened. It has been kept safe.' : null)
    ?? (connection.error ? CONNECTION_MESSAGES[connection.error.kind] : null);

  return {
    dark, setDark,
    /** Floating background bubbles (Settings → Appearance). */
    bubbles, setBubbles,
    colorStyle, setColorStyle,
    aiSettings, setAISettings, aiConnection, testAIConnection, aiService,
    hasGeminiKey: aiSessionToken !== undefined, saveGeminiKey, clearGeminiKey,
    shapeSessionToken, saveShapeKey, clearShapeKey,
    ready: appearanceReady && !scores.loading,
    error,
    setError: (message: string | null) => { setLocalError(message); if (message === null) connection.clearError(); },
    connection: (connection.status === 'awaitingApproval' ? 'confirming' : connection.status) as Connection,
    connectorKind: connection.connectorKind,
    connect: () => { connection.connect().catch(() => undefined); },
    disconnect: () => { connection.disconnect().catch(() => undefined); },
    toyName: nickname ?? (connection.info ? `Jimmy ${connection.info.deviceId.slice(-4).toUpperCase()}` : 'Jimmy'),
    renameToy, resetToyName,
    batteryPercent: toy?.batteryPercent ?? null,
    /** For stylus games: the stylus lives in Jimmy. */
    toy: { connected: toy !== null, stylusStowed: toy?.switches.stylusStowed ?? false },
    records: scores.records,
    lastSync: connection.lastSync,
    calibration, calibrating, calibrate,
    progress,
    scoreboard: scores.scoreboard,
  };
}
export type JimmyState = ReturnType<typeof useJimmy>;
