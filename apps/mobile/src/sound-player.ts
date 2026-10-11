// Plays the app's sounds with expo-audio. Every sound is loaded once at startup, so a press never waits on a file.
import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { SOUND_NAMES, type SoundName } from './design/sounds';
import type { SoundBackend } from './sound-cues';

const FILES: Readonly<Record<SoundName, number>> = {
  click: require('../assets/sounds/click.wav'),
  pop1: require('../assets/sounds/pop1.wav'),
  pop2: require('../assets/sounds/pop2.wav'),
  pop3: require('../assets/sounds/pop3.wav'),
  tap: require('../assets/sounds/tap.wav'),
  tick: require('../assets/sounds/tick.wav'),
  nudge: require('../assets/sounds/nudge.wav'),
  success: require('../assets/sounds/success.wav'),
  start: require('../assets/sounds/start.wav'),
  milestone: require('../assets/sounds/milestone.wav'),
  celebrate: require('../assets/sounds/celebrate.wav'),
  finish: require('../assets/sounds/finish.wav'),
  levelUp: require('../assets/sounds/levelUp.wav'),
  badge: require('../assets/sounds/badge.wav'),
};

// Short sounds that can come quickly get a few players each, so a new one starts while the last still rings.
const VOICES: Partial<Record<SoundName, number>> = { click: 3, tap: 3, tick: 3 };

/** Loads every sound and returns a backend for appSounds.setBackend(). */
export function createSoundPlayer(): SoundBackend & { release(): void } {
  // Mix with whatever else is playing (the child's music), and stay quiet when the phone is on silent.
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false })
    .catch(() => undefined);
  const pools = new Map<SoundName, { readonly players: readonly AudioPlayer[]; next: number }>(
    SOUND_NAMES.map((name) => [name, {
      players: Array.from({ length: VOICES[name] ?? 1 },
        () => createAudioPlayer(FILES[name], { keepAudioSessionActive: true })),
      next: 0,
    }]),
  );
  return {
    play(name) {
      const pool = pools.get(name);
      const player = pool?.players[pool.next];
      if (!pool || !player) return;
      pool.next = (pool.next + 1) % pool.players.length;
      // A finished player sits at its end; rewind before playing again.
      player.seekTo(0).catch(() => undefined);
      player.play();
    },
    release() {
      for (const { players } of pools.values()) players.forEach((player) => player.remove());
      pools.clear();
    },
  };
}
