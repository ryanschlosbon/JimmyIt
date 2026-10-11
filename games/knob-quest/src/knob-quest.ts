import { defineGame, type FidgetEvent, type GameSession } from '@jimmyit/game-sdk';
import type { KnobQuestAction } from './knob-input';

export interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
export interface Fireball { readonly x: number; readonly phaseMs: number; readonly periodMs: number; }
export interface KnobQuestLevel {
  readonly width: number; readonly height: number; readonly start: { readonly x: number; readonly y: number };
  /** Everything Jimmy can stand on: the floor pieces and the floating platforms. */
  readonly platforms: readonly Rect[];
  /** Gaps in the floor. Falling below the level costs a life; Jimmy comes back at the checkpoint. */
  readonly holes: readonly Rect[];
  readonly goal: Rect;
  readonly fireballs?: readonly Fireball[];
  readonly checkpoint?: { readonly x: number; readonly y: number };
}
export interface KnobQuestState {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
  /** Vertical speed (positive = falling), so the view can stretch Jimmy in the air. */
  readonly verticalVelocity: number;
  readonly grounded: boolean;
  /** Boost left, 0-1. Lifting spends it, and only boost lifts Jimmy; landing fills it again. */
  readonly boost: number;
  /** Game time and place of the last takeoff and landing, for sparks and squash. -Infinity before the first. */
  readonly jumpedAtMs: number; readonly jumpedFrom: { readonly x: number; readonly y: number };
  readonly landedAtMs: number; readonly landingSpeed: number;
  readonly lives: number; readonly maxLives: number;
  /** Game time of the last fall or bump, for a gentle respawn blink. */
  readonly respawnedAtMs: number;
  readonly level: KnobQuestLevel;
  /** Indexes of platforms already landed on (each pays once). */
  readonly visited: readonly number[];
  readonly restarts: number; readonly checkpointReached: boolean;
  readonly fireballs: readonly Rect[];
  readonly completed: boolean;
  /** The run ended because Jimmy ran out of lives (the score is kept). */
  readonly outOfLives: boolean;
  readonly elapsedMs: number;
  readonly horizontal: number; readonly vertical: number; readonly score: number;
}
export type KnobQuestDifficulty = 'easy' | 'normal' | 'hard';

const PLAYER_SIZE = 4;
const HORIZONTAL_SPEED = 24;
const UPWARD_THRUST = 46;
/** Gravity while Jimmy rises or stands. */
const RISE_GRAVITY = 18;
/** Gravity on the way down: strong with no lift, weak (a glide) with full-speed lift. */
const FALL_GRAVITY_STRONG = 32;
const FALL_GRAVITY_WEAK = 10;
const MAX_VERTICAL_SPEED = 28;
/**
 * Seconds of full-speed lift in a full boost. Spending it all at full speed climbs about 36 units; slower turning
 * climbs less, because more of the boost goes into holding Jimmy up against gravity.
 */
const BOOST_SECONDS = 1;
/** The highest a floating platform's top may be, so a strong jump from the floor below always reaches it. */
const HIGHEST_PLATFORM_Y = 40;
const MAX_LIVES = 3;
const PLATFORM_POINTS = 20;
const CHECKPOINT_POINTS = 50;
const GOAL_POINTS = 100;
/** Toy turning is "energy" that fades over this long, so turning faster pushes harder. */
const TURN_FADE_MS = 250;
/** Spinner degrees per second for full speed (about 1.3 turns a second). */
const SPIN_FULL_DEG_PER_S = 480;
/** Screw detents per second for full lift. */
const SCREW_FULL_DETENTS_PER_S = 8;

function createRandom(seed: number): () => number {
  let value = (Number.isFinite(seed) ? Math.trunc(seed) : 1) >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

/** The floor pieces left after cutting the holes out of a full-width floor. */
function floorWithHoles(width: number, height: number, holes: readonly Rect[]): Rect[] {
  const floor: Rect[] = [];
  let x = 0;
  for (const hole of [...holes].sort((a, b) => a.x - b.x)) {
    if (hole.x > x) floor.push({ x, y: height - 4, width: hole.x - x, height: 4 });
    x = Math.max(x, hole.x + hole.width);
  }
  if (x < width) floor.push({ x, y: height - 4, width: width - x, height: 4 });
  return floor;
}

/**
 * Build a repeatable route. Easy has a solid floor; normal cuts small holes under some platforms; hard cuts big ones
 * plus a stretch with no floor at all, where the platforms are the only way across.
 */
export function createKnobQuestLevel(seed: number, difficulty: KnobQuestDifficulty = 'normal'): KnobQuestLevel {
  const random = createRandom(seed);
  const width = difficulty === 'easy' ? 180 : difficulty === 'hard' ? 260 : 220;
  const height = 72;
  const platformCount = difficulty === 'easy' ? 8 : difficulty === 'hard' ? 13 : 10;
  const platformWidth = difficulty === 'easy' ? 19 : difficulty === 'hard' ? 13 : 16;
  const step = (width - 32) / platformCount;
  const floating: Rect[] = [];
  let platformY = 54;
  for (let index = 0; index < platformCount; index++) {
    const x = 14 + index * step + Math.round(random() * 3);
    platformY = Math.max(HIGHEST_PLATFORM_Y, Math.min(55, platformY + Math.round(random() * 12) - 7));
    floating.push({ x, y: platformY, width: platformWidth + Math.floor(random() * 3), height: 3 });
  }
  const holes: Rect[] = [];
  if (difficulty !== 'easy') {
    const holeWidth = difficulty === 'hard' ? 16 : 7;
    const every = difficulty === 'hard' ? 2 : 3;
    // Holes sit under platforms, never at the start, so there is always somewhere safe to land.
    for (let index = 1; index < platformCount - 1; index += every) {
      const platform = floating[index];
      if (platform) holes.push({ x: platform.x + platform.width / 2 - holeWidth / 2, y: height - 4, width: holeWidth, height: 4 });
    }
    if (difficulty === 'hard') {
      const from = floating[Math.floor(platformCount * 0.6)];
      const to = floating[Math.floor(platformCount * 0.6) + 2];
      if (from && to) holes.push({ x: from.x, y: height - 4, width: to.x + to.width - from.x, height: 4 });
    }
  }
  const last = floating[floating.length - 1]!;
  const middle = floating[Math.floor(floating.length / 2)]!;
  const fireballCount = difficulty === 'easy' ? 0 : difficulty === 'hard' ? 4 : 2;
  const fireballs = Array.from({ length: fireballCount }, (_, index) => ({
    x: 36 + (index + 1) * (width - 70) / (fireballCount + 1),
    phaseMs: 700 + Math.floor(random() * 1500),
    periodMs: 3800 + Math.floor(random() * 1300),
  }));
  return {
    width, height, start: { x: 5, y: height - 8 }, platforms: [...floorWithHoles(width, height, holes), ...floating],
    holes, goal: { x: last.x + last.width - 6, y: last.y - 6, width: 7, height: 6 },
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

const clampUnit = (value: number) => Math.max(-1, Math.min(1, value));

export function createKnobQuestGame(level?: KnobQuestLevel,
  difficulty: KnobQuestDifficulty = 'normal', seed = 1) {
  const activeLevel = level ?? createKnobQuestLevel(seed, difficulty);
  const floorY = activeLevel.height - 4;
  return defineGame<KnobQuestState, KnobQuestAction>({
    id: 'knob-quest', title: 'Knob Quest',
    description: 'Roll Jimmy across platforms with two controls.',
    skills: ['spin', 'screw'], needsToy: false, durationMs: null,
    starThresholds: [60, 180, 290],
    create(session: GameSession) {
      let x = activeLevel.start.x;
      let y = activeLevel.start.y;
      let horizontal = 0;
      let vertical = 0;
      // Toy turning, in the same units as horizontal/vertical once divided by the "full" rate.
      let spinEnergy = 0;
      let screwEnergy = 0;
      let verticalVelocity = 0;
      let grounded = true;
      let boostLeftS = BOOST_SECONDS;
      let jumpedAtMs = Number.NEGATIVE_INFINITY;
      let jumpedFrom = { x, y };
      let landedAtMs = Number.NEGATIVE_INFINITY;
      let landingSpeed = 0;
      let respawnedAtMs = Number.NEGATIVE_INFINITY;
      let lastTickMs = 0;
      let lives = MAX_LIVES;
      let restarts = 0;
      let checkpointReached = false;
      let completed = false;
      let outOfLives = false;
      const visited = new Set<number>();

      const metrics = () => {
        session.score.setMetric('platformCount', visited.size);
        session.score.setMetric('restartCount', restarts);
        session.score.setMetric('livesLeftCount', lives);
      };

      const loseLife = (elapsedMs: number) => {
        restarts++;
        lives--;
        respawnedAtMs = elapsedMs;
        horizontal = 0;
        vertical = 0;
        spinEnergy = 0;
        screwEnergy = 0;
        verticalVelocity = 0;
        boostLeftS = BOOST_SECONDS;
        session.feedback('nudge');
        if (lives <= 0) {
          outOfLives = true;
          metrics();
          session.finish();
          return;
        }
        x = checkpointReached && activeLevel.checkpoint ? activeLevel.checkpoint.x : activeLevel.start.x;
        y = checkpointReached && activeLevel.checkpoint ? activeLevel.checkpoint.y : activeLevel.start.y;
        grounded = true;
      };

      return {
        getState: () => ({ x, y, width: PLAYER_SIZE, height: PLAYER_SIZE, verticalVelocity, grounded,
          boost: boostLeftS / BOOST_SECONDS,
          jumpedAtMs, jumpedFrom, landedAtMs, landingSpeed, lives, maxLives: MAX_LIVES, respawnedAtMs,
          level: activeLevel, visited: [...visited], restarts, checkpointReached,
          fireballs: fallingFireballs(activeLevel, lastTickMs), completed, outOfLives, elapsedMs: lastTickMs,
          horizontal, vertical, score: session.score.score }),
        onAction(action) {
          if (action.type !== 'axis' || !Number.isFinite(action.value)) return;
          const value = clampUnit(action.value);
          if (action.axis === 'horizontal') horizontal = value;
          else vertical = value;
        },
        // The real toy: the spinner rolls Jimmy and the screw lifts him. Turning faster pushes harder.
        onEvent(event: FidgetEvent) {
          if (event.type === 'spin') spinEnergy += event.deltaDeg;
          else if (event.type === 'screw') screwEnergy += event.deltaDetents;
        },
        onTick(elapsedMs) {
          if (completed || outOfLives) return;
          const dt = Math.min(0.1, Math.max(0, (elapsedMs - lastTickMs) / 1000));
          lastTickMs = elapsedMs;
          const fade = Math.exp(-dt * 1000 / TURN_FADE_MS);
          spinEnergy *= fade;
          screwEnergy *= fade;
          const fadeS = TURN_FADE_MS / 1000;
          const moveX = clampUnit(horizontal + spinEnergy / (SPIN_FULL_DEG_PER_S * fadeS));
          // Tightening the screw (positive) lifts Jimmy, like the up arrow (negative).
          const moveY = clampUnit(vertical - screwEnergy / (SCREW_FULL_DETENTS_PER_S * fadeS));
          const oldX = x;
          const oldY = y;
          const wasGrounded = grounded;
          x = Math.max(0, Math.min(activeLevel.width - PLAYER_SIZE, x + moveX * HORIZONTAL_SPEED * dt));
          if (activeLevel.platforms.some((platform) => overlaps(x, y, platform))) x = oldX;
          // Lifting spends boost, so Jimmy can't fly over the level; stronger turning climbs higher on the same boost.
          // On the way down, lifting still softens gravity (a glide) even with no boost left.
          const lift = Math.max(0, -moveY);
          const drop = Math.max(0, moveY);
          const liftS = Math.min(lift * dt, boostLeftS);
          const gravity = verticalVelocity > 0
            ? FALL_GRAVITY_STRONG + (FALL_GRAVITY_WEAK - FALL_GRAVITY_STRONG) * lift
            : RISE_GRAVITY;
          verticalVelocity = Math.max(-MAX_VERTICAL_SPEED, Math.min(MAX_VERTICAL_SPEED,
            verticalVelocity + (gravity + drop * UPWARD_THRUST) * dt - liftS * UPWARD_THRUST));
          const fallSpeed = verticalVelocity;
          y = Math.max(0, y + verticalVelocity * dt);
          if (y === 0) verticalVelocity = 0;
          grounded = false;
          for (const [index, platform] of activeLevel.platforms.entries()) {
            if (!overlaps(x, y, platform)) continue;
            if (verticalVelocity >= 0 && oldY + PLAYER_SIZE <= platform.y + 0.01) {
              y = platform.y - PLAYER_SIZE;
              grounded = true;
              if (platform.y < floorY && !visited.has(index)) {
                visited.add(index);
                session.score.add(PLATFORM_POINTS);
                session.score.countAction();
                session.feedback('tick');
              }
            } else if (verticalVelocity < 0 && oldY >= platform.y + platform.height - 0.01) y = platform.y + platform.height;
            else y = oldY;
            verticalVelocity = 0;
          }
          // Standing on anything fills the boost; in the air, lifting spends it.
          if (grounded) boostLeftS = BOOST_SECONDS;
          else boostLeftS = Math.max(0, boostLeftS - liftS);
          if (wasGrounded && !grounded && verticalVelocity < 0) {
            jumpedAtMs = elapsedMs;
            jumpedFrom = { x: oldX, y: oldY };
          }
          if (!wasGrounded && grounded) {
            landedAtMs = elapsedMs;
            landingSpeed = fallSpeed;
          }
          if (!checkpointReached && activeLevel.checkpoint && x >= activeLevel.checkpoint.x) {
            checkpointReached = true;
            session.score.add(CHECKPOINT_POINTS);
            session.feedback('success');
          }
          if (y > activeLevel.height || fallingFireballs(activeLevel, elapsedMs).some((ball) => overlaps(x, y, ball))) {
            loseLife(elapsedMs);
            return;
          }
          if (overlaps(x, y, activeLevel.goal)) {
            completed = true;
            session.score.add(GOAL_POINTS);
            metrics();
            session.score.setMetric('completionMs', elapsedMs);
            session.finish();
          }
        },
        onFinish() { metrics(); },
      };
    },
  });
}
