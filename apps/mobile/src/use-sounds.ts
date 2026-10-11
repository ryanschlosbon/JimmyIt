import { useEffect } from 'react';
import { useJimmyServices } from '@jimmyit/app-kit';
import { appSounds } from './sound-cues';
import { createSoundPlayer } from './sound-player';

/** Loads the sounds and plays them for game feedback, score moments and rewards. Call once, near the app root. */
export function useSounds(): void {
  const services = useJimmyServices();
  useEffect(() => {
    const player = createSoundPlayer();
    appSounds.setBackend(player);
    const stops = [
      services.onFeedback(appSounds.feedback),
      services.onScoreEvent(appSounds.scoreEvent),
      services.onReward(appSounds.reward),
    ];
    return () => {
      stops.forEach((stop) => stop());
      appSounds.setBackend(null);
      player.release();
    };
  }, [services]);
}
