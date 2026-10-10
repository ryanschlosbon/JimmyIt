import { defineGame, type GameSession } from '@jimmyit/game-sdk';
import { distanceToPath, isCircleHit, type Circle, type Point } from './geometry';
import { recommendTapQuestDifficulty, type DifficultySettings, type RecentAttempt } from './adaptation';

export type TapQuestMode = 'precision' | 'trace' | 'memory' | 'calm';

export interface TapQuestFeedback {
  readonly haptics: boolean;
  readonly generousTiming: boolean;
  readonly extraHitRadius: number;
}

export interface TapQuestOptions {
  readonly mode: TapQuestMode;
  readonly level?: number;
  readonly recentAttempts?: readonly RecentAttempt[];
  readonly allowDifficultyIncrease?: boolean;
  readonly settings?: Partial<Omit<DifficultySettings, 'level'>>;
  readonly feedback?: Partial<TapQuestFeedback>;
}

export type TapQuestAction =
  | { readonly type: 'touch'; readonly phase: 'down' | 'move' | 'up'; readonly point: Point }
  | { readonly type: 'pause' | 'resume' | 'restart' | 'finish' | 'replaySequence' };

export interface TapQuestState {
  readonly mode: TapQuestMode;
  readonly paused: boolean;
  readonly completed: boolean;
  readonly target: Circle | null;
  readonly path: readonly Point[];
  readonly sequence: readonly number[];
  readonly choices: readonly Circle[];
  readonly memoryPhase: 'preview' | 'recall' | null;
  readonly highlightIndex: number | null;
  readonly targetIndex: number;
  readonly targetCount: number;
  readonly matchedCount: number;
  readonly traceCoverage: number;
  readonly remainingMs: number | null;
  readonly score: number;
  readonly settings: DifficultySettings;
  readonly feedback: TapQuestFeedback;
}

/** Optional recognition can be supplied by a future local implementation. */
export interface GestureRecognizer {
  recognize(samples: readonly Point[]): Promise<{ readonly confidence: number; readonly gesture: string }>;
}

/** Optional target generation must return normalized, valid coordinates. */
export interface TargetPatternGenerator {
  generate(mode: TapQuestMode, settings: DifficultySettings): Promise<readonly Point[]>;
}

const POSITIONS: readonly Point[] = [
  { x: 0.2, y: 0.25 }, { x: 0.72, y: 0.25 }, { x: 0.48, y: 0.55 },
  { x: 0.23, y: 0.78 }, { x: 0.76, y: 0.76 }, { x: 0.5, y: 0.2 },
];

function targetAt(index: number, settings: DifficultySettings): Circle {
  const base = POSITIONS[index % POSITIONS.length] ?? POSITIONS[0];
  if (!base) throw new RangeError('target positions are unavailable');
  const shift = (Math.floor(index / POSITIONS.length) % 3 - 1) * (settings.targetSpacing - 0.23) * 0.4;
  return { x: Math.max(0.15, Math.min(0.85, base.x + shift)), y: base.y, radius: settings.targetRadius };
}

function tracePath(index: number): readonly Point[] {
  const curved = index % 2 === 1;
  return Array.from({ length: 7 }, (_, i) => ({
    x: 0.16 + i * 0.11,
    y: curved ? 0.5 - 0.19 * Math.sin(i * Math.PI / 6) : 0.48 + i * 0.018,
  }));
}

function checkedSettings(options: TapQuestOptions): DifficultySettings {
  const base = recommendTapQuestDifficulty(options.level ?? 1, options.recentAttempts ?? [],
    options.allowDifficultyIncrease ?? true);
  const settings = { ...base, ...options.settings };
  if (!(settings.targetRadius >= 0.025 && settings.targetRadius <= 0.2) ||
    !(settings.targetSpacing >= 0.1 && settings.targetSpacing <= 0.5) ||
    !Number.isInteger(settings.targetCount) || settings.targetCount < 1 || settings.targetCount > 30 ||
    !(settings.targetDurationMs >= 300 && settings.targetDurationMs <= 20_000) ||
    !(settings.timingWindowMs >= 0 && settings.timingWindowMs <= 5_000) ||
    !Number.isInteger(settings.sequenceLength) || settings.sequenceLength < 1 || settings.sequenceLength > 12) {
    throw new RangeError('invalid Tap Quest settings');
  }
  return settings;
}

/** Creates headless rules for one stylus mode; the game runner saves its ScoreRecord. */
export function createTapQuestGame(options: TapQuestOptions) {
  const { mode } = options;
  if (!(['precision', 'trace', 'memory', 'calm'] as const).includes(mode)) throw new RangeError('unknown mode');
  const settings = checkedSettings(options);
  const feedback: TapQuestFeedback = {
    haptics: options.feedback?.haptics ?? false,
    generousTiming: options.feedback?.generousTiming ?? true,
    extraHitRadius: options.feedback?.extraHitRadius ?? 0.025,
  };
  if (!Number.isFinite(feedback.extraHitRadius) || feedback.extraHitRadius < 0 || feedback.extraHitRadius > 0.1) {
    throw new RangeError('invalid extra hit radius');
  }
  const count = mode === 'memory' ? settings.sequenceLength : settings.targetCount;
  const sequence = Array.from({ length: settings.sequenceLength }, (_, i) => (i * 2 + Math.floor(i / 3)) % POSITIONS.length);
  return defineGame<TapQuestState, TapQuestAction>({
    id: `tap-quest-${mode}`,
    title: `Tap Quest: ${mode[0]?.toUpperCase() ?? ''}${mode.slice(1)}`,
    description: mode === 'calm' ? 'Explore targets at your own pace.' : 'Practice stylus movements with friendly targets.',
    skills: ['stylus'],
    durationMs: null,
    needsToy: false, // screen game: plays with or without the toy connected
    starThresholds: [Math.max(5, count * 4), Math.max(10, count * 7), Math.max(15, count * 10)],
    create(session: GameSession) {
      let index = 0;
      let matched = 0;
      let attempts = 0;
      let completed = false;
      let pausedAt: number | null = null;
      let pausedMs = 0;
      let targetStartedMs = 0;
      let traceCovered = new Set<number>();
      let restarts = 0;
      let previewStartedMs = 0;
      const previewStepMs = 900;
      const effectiveMs = () => (pausedAt ?? session.elapsedMs()) - pausedMs;
      const windowMs = settings.targetDurationMs + (feedback.generousTiming ? settings.timingWindowMs : 0);
      const previewIndex = () => Math.floor((effectiveMs() - previewStartedMs) / previewStepMs);
      const showingMemory = () => mode === 'memory' && previewIndex() < sequence.length;
      const currentTarget = () => {
        if (mode === 'trace') return null;
        if (mode === 'memory') {
          const shown = sequence[previewIndex()];
          return showingMemory() && shown !== undefined ? targetAt(shown, settings) : null;
        }
        return targetAt(index, settings);
      };
      const finishIfDone = () => {
        if (mode !== 'calm' && index >= count) {
          completed = true;
          session.finish();
        }
      };
      const next = () => {
        index++;
        targetStartedMs = effectiveMs();
        traceCovered = new Set<number>();
        finishIfDone();
      };
      const expire = () => {
        if (mode !== 'precision' && mode !== 'trace') return;
        while (!completed && index < count && effectiveMs() - targetStartedMs >= windowMs) next();
      };
      const reward = (points: number) => {
        session.score.add(points);
        matched++;
        if (feedback.haptics) session.feedback('tap');
      };
      return {
        getState(): TapQuestState {
          const remaining = mode === 'precision' || mode === 'trace'
            ? Math.max(0, windowMs - (effectiveMs() - targetStartedMs)) : null;
          return {
            mode, paused: pausedAt !== null, completed, target: completed ? null : currentTarget(),
            path: mode === 'trace' && !completed ? tracePath(index) : [],
            sequence: showingMemory() && !completed ? sequence : [],
            choices: mode === 'memory' && !completed
              ? POSITIONS.map((_, choiceIndex) => targetAt(choiceIndex, settings)) : [],
            memoryPhase: mode === 'memory' ? (showingMemory() && !completed ? 'preview' : 'recall') : null,
            highlightIndex: showingMemory() && !completed ? previewIndex() : null,
            targetIndex: index, targetCount: count,
            matchedCount: matched, traceCoverage: traceCovered.size / 7, remainingMs: remaining,
            score: session.score.score, settings, feedback,
          };
        },
        onAction(action) {
          if (action.type === 'pause') {
            if (pausedAt === null) pausedAt = session.elapsedMs();
            return;
          }
          if (action.type === 'resume') {
            if (pausedAt !== null) {
              pausedMs += session.elapsedMs() - pausedAt;
              pausedAt = null;
            }
            return;
          }
          if (action.type === 'restart') {
            index = 0;
            matched = 0;
            completed = false;
            pausedAt = null;
            pausedMs = 0;
            targetStartedMs = session.elapsedMs();
            previewStartedMs = session.elapsedMs();
            traceCovered = new Set<number>();
            restarts++;
            return;
          }
          if (action.type === 'replaySequence') {
            if (mode === 'memory') previewStartedMs = effectiveMs();
            return;
          }
          if (action.type === 'finish') {
            if (mode === 'calm' && pausedAt === null) {
              completed = true;
              session.finish();
            }
            return;
          }
          if (action.type !== 'touch' || pausedAt !== null || completed) return;
          const { point, phase } = action;
          if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 ||
            point.y < 0 || point.y > 1) throw new RangeError('touch coordinates must be normalized');
          expire();
          if (completed) return;
          if (phase === 'down') {
            attempts++;
            session.score.countAction();
          }
          if (mode === 'trace') {
            if (phase === 'up') return;
            const path = tracePath(index);
            if (distanceToPath(point, path) > settings.targetRadius + feedback.extraHitRadius) return;
            path.forEach((anchor, anchorIndex) => {
              if (Math.hypot(point.x - anchor.x, point.y - anchor.y) <= settings.targetRadius + feedback.extraHitRadius) {
                traceCovered.add(anchorIndex);
              }
            });
            if (traceCovered.size >= 5) {
              reward(10);
              next();
            }
            return;
          }
          if (phase !== 'down') return;
          if (mode === 'memory' && showingMemory()) return;
          const target = mode === 'memory' ? targetAt(sequence[index] ?? 0, settings) : currentTarget();
          if (!target) return;
          if (isCircleHit(point, target)) {
            reward(mode === 'calm' ? 5 : 10);
            next();
          } else if (mode === 'precision' && isCircleHit(point, target, feedback.extraHitRadius)) {
            reward(5);
            next();
          }
        },
        onTick() {
          if (pausedAt === null) expire();
        },
        onFinish() {
          session.score.setMetric('matchedTargets', matched);
          session.score.setMetric('touchAttempts', attempts);
          session.score.setMetric('completionPercent', Math.round(100 * (mode === 'calm' ? 1 : index / count)));
          session.score.setMetric('restarts', restarts);
          session.score.setMetric('level', settings.level); // lets the app adapt the next game from this one
        },
      };
    },
  });
}
