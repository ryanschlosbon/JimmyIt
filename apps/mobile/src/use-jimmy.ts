import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { connectFidgetClient, type FidgetClient, type ScoreRecord } from '@jimmyit/core';
import { createProgressService, getProgress, type DrawingSession } from './progress';

export type Connection = 'connected' | 'disconnected' | 'searching';

async function connectDemoClient(): Promise<FidgetClient | null> {
  // Native production builds keep the fake protocol device out of the app.
  // The frontend's clearly labelled UI simulation remains available in previews.
  if (!__DEV__) return null;
  const { createFakeFidget } = await import('@jimmyit/fake-fidget');
  const fake = createFakeFidget();
  const next = await connectFidgetClient(fake.transport);
  fake.setBattery(84);
  return next;
}

export function useJimmy() {
  const [service] = useState(() => createProgressService(AsyncStorage));
  const [records, setRecords] = useState<readonly ScoreRecord[]>([]);
  const [dark, setDarkState] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection>('disconnected');
  const [calibration, setCalibration] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  const client = useRef<FidgetClient | null>(null);
  const generation = useRef(0);
  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calibrationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      service.repository.list().then(result => { if (active) setRecords(result); })
        .catch(() => { if (active) setError('Your saved progress could not be opened. It has been kept safe.'); });
    };
    refresh();
    const unsubscribe = service.repository.onChange(refresh);
    AsyncStorage.getItem('jimmy.appearance').then(value => { if (active) setDarkState(value === 'dark'); })
      .catch(() => { if (active) setError('Your appearance preference could not be opened.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; unsubscribe(); };
  }, [service]);

  useEffect(() => () => {
    generation.current += 1;
    if (connectTimer.current) clearTimeout(connectTimer.current);
    if (calibrationTimer.current) clearInterval(calibrationTimer.current);
    client.current?.disconnect().catch(() => undefined);
  }, []);

  const stopCalibration = () => {
    if (calibrationTimer.current) clearInterval(calibrationTimer.current);
    calibrationTimer.current = null;
    setCalibrating(false);
  };

  const disconnect = () => {
    generation.current += 1;
    if (connectTimer.current) clearTimeout(connectTimer.current);
    stopCalibration();
    const previous = client.current;
    client.current = null;
    setConnection('disconnected');
    previous?.disconnect().catch(() => setError('Jimmy could not finish disconnecting. Please try reconnecting.'));
  };

  const connect = () => {
    disconnect();
    const current = generation.current;
    setConnection('searching');
    connectTimer.current = setTimeout(() => {
      connectDemoClient().then(async next => {
        if (current !== generation.current) { await next?.disconnect(); return; }
        client.current = next;
        setConnection('connected');
      }).catch(() => {
        if (current === generation.current) {
          setConnection('disconnected');
          setError('Jimmy is taking a little break. Try finding Jimmy again.');
        }
      });
    }, 1600);
  };

  const calibrate = () => {
    if (connection !== 'connected' || calibrating) return;
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
      .catch(() => setError('Your appearance changed, but could not be saved for next time.'));
  };

  const finish = async (session: DrawingSession) => {
    await service.finish(session);
    if (client.current?.connected) {
      client.current.showScore({ score: session.strokes > 0 ? 50 : 10, stars: session.strokes > 0 ? 3 : 1 })
        .catch(() => setError('Your points are saved. Jimmy’s display will catch up when you reconnect.'));
    }
  };

  return { dark, setDark, ready, error, setError, connection, connect, disconnect,
    calibration, calibrating, calibrate, finish, finishTimed: service.finishTimed, progress: getProgress(records) };
}
export type JimmyState = ReturnType<typeof useJimmy>;
