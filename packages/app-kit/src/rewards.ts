import { createEmitter, type Listener, type ScoreRepository, type Unsubscribe } from '@jimmyit/core';
import { type BadgeId, getProgress, type Progress } from './progress';

/** A step forward in the child's progress, caused by a newly saved record (app game or toy game). */
export type Reward = { readonly type: 'levelUp'; readonly level: number } | { readonly type: 'badge'; readonly badgeId: BadgeId };

/** What changed between two progress snapshots: a level-up first (once, to the new level), then each new badge. */
export function progressRewards(before: Progress, after: Progress): readonly Reward[] {
  const rewards: Reward[] = [];
  if (after.level > before.level) rewards.push({ type: 'levelUp', level: after.level });
  const earnedBefore = new Set(before.badges.filter((badge) => badge.earned).map((badge) => badge.id));
  for (const badge of after.badges) {
    if (badge.earned && !earnedBefore.has(badge.id)) rewards.push({ type: 'badge', badgeId: badge.id });
  }
  return rewards;
}

export interface RewardWatcher {
  onReward(listener: Listener<Reward>): Unsubscribe;
  stop(): void;
}

/**
 * Watches the repository and reports rewards for records saved from now on.
 * Records already saved when it starts are the baseline, so opening the app
 * never replays old rewards. `onRewards` gets each batch (one save or sync) once.
 */
export function createRewardWatcher(
  repository: ScoreRepository,
  onRewards: (rewards: readonly Reward[]) => void = () => undefined,
): RewardWatcher {
  const rewards = createEmitter<Reward>();
  let known: Progress | null = null;

  const check = async (): Promise<void> => {
    const next = getProgress(await repository.list());
    const found = known ? progressRewards(known, next) : [];
    known = next;
    if (found.length === 0) return;
    onRewards(found);
    for (const reward of found) rewards.emit(reward);
  };
  // Checks run one after another, starting with the baseline; an unreadable store just means no rewards.
  let checking = check().catch(() => undefined);
  const stopWatching = repository.onChange(() => {
    checking = checking.then(check).catch(() => undefined);
  });

  return {
    onReward: (listener) => rewards.subscribe(listener),
    stop: stopWatching,
  };
}
