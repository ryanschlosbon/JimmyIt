import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ConnectionErrorKind, useConnection, useScores, useToyState } from '@jimmyit/app-kit';
import { BADGE_VISUALS } from './badge-visuals';
import { GAME_CATALOG } from './games';

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
  const [appearanceReady, setAppearanceReady] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [calibration, setCalibration] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  const calibrationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('jimmy.appearance').then(value => { if (active) setDarkState(value === 'dark'); })
      .catch(() => { if (active) setLocalError('Your appearance preference could not be opened.'); })
      .finally(() => { if (active) setAppearanceReady(true); });
    return () => { active = false; };
  }, []);

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

  const setDark = (next: boolean) => {
    setDarkState(next);
    AsyncStorage.setItem('jimmy.appearance', next ? 'dark' : 'light')
      .catch(() => setLocalError('Your appearance changed, but could not be saved for next time.'));
  };

  const progress = useMemo(() => ({
    ...scores.progress,
    badges: scores.progress.badges.map(badge => ({ ...badge, ...BADGE_VISUALS[badge.id] })),
  }), [scores.progress]);

  const error = localError
    ?? (scores.error ? 'Your saved progress could not be opened. It has been kept safe.' : null)
    ?? (connection.error ? CONNECTION_MESSAGES[connection.error.kind] : null);

  return {
    dark, setDark,
    ready: appearanceReady && !scores.loading,
    error,
    setError: (message: string | null) => { setLocalError(message); if (message === null) connection.clearError(); },
    connection: (connection.status === 'awaitingApproval' ? 'confirming' : connection.status) as Connection,
    connectorKind: connection.connectorKind,
    connect: () => { connection.connect().catch(() => undefined); },
    disconnect: () => { connection.disconnect().catch(() => undefined); },
    toyName: connection.info ? `Jimmy ${connection.info.deviceId.slice(-4).toUpperCase()}` : 'Jimmy',
    batteryPercent: toy?.batteryPercent ?? null,
    lastSync: connection.lastSync,
    calibration, calibrating, calibrate,
    progress,
    scoreboard: scores.scoreboard,
  };
}
export type JimmyState = ReturnType<typeof useJimmy>;
