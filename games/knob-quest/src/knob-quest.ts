import { defineGame, type GameSession } from '@jimmyit/game-sdk';
import type { KnobQuestAction } from './knob-input';

export interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
export interface Fireball { readonly x: number; readonly phaseMs: number; readonly periodMs: number; }
export interface KnobQuestLevel {
  readonly width: number; readonly height: number; readonly start: { readonly x: number; readonly y: number };
  readonly platforms: readonly Rect[]; readonly hazards: readonly Rect[];
  readonly gems: readonly Rect[]; readonly goal: Rect;
  readonly fireballs?: readonly Fireball[];
  readonly checkpoint?: { readonly x: number; readonly y: number };
}
export interface KnobQuestState {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
  readonly level: KnobQuestLevel; readonly collected: readonly number[];
  readonly checkpoints: number; readonly checkpointReached: boolean;
  readonly fireballs: readonly Rect[];
  readonly completed: boolean; readonly elapsedMs: number;
  readonly horizontal: number; readonly vertical: number; readonly score: number;
}
export type KnobQuestDifficulty = 'easy' | 'normal' | 'hard';

const PLAYER_SIZE = 4;
const HORIZONTAL_SPEED = 24;
const UPWARD_THRUST = 42;
const GRAVITY = 18;
const MAX_VERTICAL_SPEED = 28;

function createRandom(seed: number): () => number {
  let value = (Number.isFinite(seed) ? Math.trunc(seed) : 1) >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

/** Build a repeatable, longer route; difficulty changes obstacles rather than the controls. */
export function createKnobQuestLevel(seed: number, difficulty: KnobQuestDifficulty = 'normal'): KnobQuestLevel {
  const random = createRandom(seed);
  const width = difficulty === 'easy' ? 180 : difficulty === 'hard' ? 260 : 220;
  const height = 72;
  const platformCount = difficulty === 'easy' ? 8 : difficulty === 'hard' ? 13 : 10;
  const platformWidth = difficulty === 'easy' ? 19 : difficulty === 'hard' ? 11 : 15;
  const step = (width - 32) / platformCount;
  const platforms: Rect[] = [{ x: 0, y: height - 4, width, height: 4 }];
  const gems: Rect[] = [];
  const hazards: Rect[] = [];
  let platformY = 54;
  for (let index = 0; index < platformCount; index++) {
    const x = 14 + index * step + Math.round(random() * 3);
    platformY = Math.max(26, Math.min(55, platformY + Math.round(random() * 12) - 7));
    const item = { x, y: platformY, width: platformWidth + Math.floor(random() * 3), height: 3 };
    platforms.push(item);
    if (index % 2 === 0) gems.push({ x: item.x + item.width / 2 - 1.5, y: item.y - 4, width: 3, height: 3 });
    if (index > 0 && index < platformCount - 1 &&
      index % (difficulty === 'hard' ? 2 : difficulty === 'normal' ? 3 : 4) === 0) {
      hazards.push({ x: item.x + item.width + 2, y: height - 8, width: 5, height: 4 });
    }
  }
  const last = platforms[platforms.length - 1]!;
  const middle = platforms[Math.floor(platforms.length / 2)]!;
  const fireballCount = difficulty === 'easy' ? 0 : difficulty === 'hard' ? 4 : 2;
  const fireballs = Array.from({ length: fireballCount }, (_, index) => ({
    x: 36 + (index + 1) * (width - 70) / (fireballCount + 1),
    phaseMs: 700 + Math.floor(random() * 1500),
    periodMs: 3800 + Math.floor(random() * 1300),
  }));
  return {
    width, height, start: { x: 5, y: height - 8 }, platforms, hazards, gems,
    goal: { x: last.x + last.width - 6, y: last.y - 6, width: 7, height: 6 },
    checkpoint: { x: middle.x + 2, y: middle.y - PLAYER_SIZE }, fireballs,
  };
}

export const KNOB_QUEST_LEVEL = createKnobQuestLevel(1);

function overlaps(x: number, y: number, rect: Rect): boolean {
  return x < rect.x + rect.width && x + PLAYER_SIZE > rect.x
    && y < rect.y + rect.height && y + PLAYER_SIZE > rect.y;
}

function fallingFireballs(level: KnobQuestLevel, elapsedMs: number): readonly Rect[] {
  return (level.fireballs ?? []).map((fireball) => {
    const progress = ((elapsedMs + fireball.phaseMs) % fireball.periodMs) / fireball.periodMs;
    return { x: fireball.x, y: -5 + progress * (level.height + 9), width: 3.5, height: 3.5 };
  });
}

export function createKnobQuestGame(level?: KnobQuestLevel,
  difficulty: KnobQuestDifficulty = 'normal', seed = 1) {
  const activeLevel = level ?? createKnobQuestLevel(seed, difficulty);
  return defineGame<KnobQuestState, KnobQuestAction>({
    id: 'knob-quest', title: 'Knob Quest',
    description: 'Guide your explorer across platforms with two controls.',
    skills: ['spin', 'screw'], needsToy: false, durationMs: null,
    starThresholds: [50, 100, 180],
    create(session: GameSession) {
      let x = activeLevel.start.x;
      let y = activeLevel.start.y;
      let horizontal = 0;
      let vertical = 0;
      let verticalVelocity = 0;
      let lastTickMs = 0;
      let checkpoints = 0;
      let checkpointReached = false;
      let completed = false;
      const collected = new Set<number>();
      return {
        getState: () => ({ x, y, width: PLAYER_SIZE, height: PLAYER_SIZE, level: activeLevel,
          collected: [...collected], checkpoints, checkpointReached,
          fireballs: fallingFireballs(activeLevel, lastTickMs), completed, elapsedMs: lastTickMs,
          horizontal, vertical, score: session.score.score }),
        onAction(action) {
          if (action.type !== 'axis' || !Number.isFinite(action.value)) return;
          const value = Math.max(-1, Math.min(1, action.value));
          if (action.axis === 'horizontal') horizontal = value;
          else vertical = value;
        },
        onTick(elapsedMs) {
          if (completed) return;
          const dt = Math.min(0.1, Math.max(0, (elapsedMs - lastTickMs) / 1000));
          lastTickMs = elapsedMs;
          const oldX = x;
          const oldY = y;
          x = Math.max(0, Math.min(activeLevel.width - PLAYER_SIZE, x + horizontal * HORIZONTAL_SPEED * dt));
          if (activeLevel.platforms.some((platform) => overlaps(x, y, platform))) x = oldX;
          // Stronger turning builds upward momentum, followed by a gentle gravity-driven arc.
          verticalVelocity = Math.max(-MAX_VERTICAL_SPEED, Math.min(MAX_VERTICAL_SPEED,
            verticalVelocity + (vertical * UPWARD_THRUST + GRAVITY) * dt));
          y = Math.max(0, Math.min(activeLevel.height - PLAYER_SIZE, y + verticalVelocity * dt));
          if (y === 0 || y === activeLevel.height - PLAYER_SIZE) verticalVelocity = 0;
          for (const platform of activeLevel.platforms) {
            if (!overlaps(x, y, platform)) continue;
            if (verticalVelocity >= 0 && oldY + PLAYER_SIZE <= platform.y + 0.01) y = platform.y - PLAYER_SIZE;
            else if (verticalVelocity < 0 && oldY >= platform.y + platform.height - 0.01) y = platform.y + platform.height;
            else y = oldY;
            verticalVelocity = 0;
          }
          if (!checkpointReached && activeLevel.checkpoint && x >= activeLevel.checkpoint.x) {
            checkpointReached = true;
            session.feedback('success');
          }
          if (activeLevel.hazards.some((hazard) => overlaps(x, y, hazard)) ||
            fallingFireballs(activeLevel, elapsedMs).some((fireball) => overlaps(x, y, fireball))) {
            checkpoints++;
            x = checkpointReached && activeLevel.checkpoint ? activeLevel.checkpoint.x : activeLevel.start.x;
            y = checkpointReached && activeLevel.checkpoint ? activeLevel.checkpoint.y : activeLevel.start.y;
            horizontal = 0;
            vertical = 0;
            verticalVelocity = 0;
            session.feedback('nudge');
            return;
          }
          activeLevel.gems.forEach((gem, index) => {
            if (collected.has(index) || !overlaps(x, y, gem)) return;
            collected.add(index);
            session.score.add(30);
            session.score.countAction();
            session.feedback('tick');
          });
          if (overlaps(x, y, activeLevel.goal)) {
            completed = true;
            session.score.add(100);
            session.score.setMetric('gemCount', collected.size);
            session.score.setMetric('checkpointCount', checkpoints);
            session.score.setMetric('completionMs', elapsedMs);
            session.finish();
          }
        },
        onFinish() {
          session.score.setMetric('gemCount', collected.size);
          session.score.setMetric('checkpointCount', checkpoints);
        },
      };
    },
  });
}
