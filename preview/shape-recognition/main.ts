import { createMemoryKeyValueStore, createScoreRepository, INITIAL_FIDGET_STATE, type ScoreRecord } from '@jimmyit/core';
import { startGame, type GameDevice, type GameRun } from '@jimmyit/game-sdk';
import {
  createShapeRecognitionGame,
  type DrawingPoint,
  type ShapeRecognitionAction,
  type ShapeRecognitionState,
  type TargetShape,
} from '@jimmyit/game-shape-recognition';
import { attachDrawingInput } from './drawing-input';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Preview element ${id} is missing`);
  return found as T;
}

const canvas = element<HTMLCanvasElement>('drawing');
const context = canvas.getContext('2d');
if (!context) throw new Error('Canvas drawing is not available in this browser');

const repository = createScoreRepository(createMemoryKeyValueStore());
const device: GameDevice = {
  info: {
    deviceId: '00000000', protocolVersion: 1, firmwareVersion: 'preview',
    capabilities: new Set(), newestRecordId: 0, storedRecordCount: 0,
  },
  getState: () => INITIAL_FIDGET_STATE,
  onEvent: () => () => undefined,
  haptic: async () => undefined,
  feedback: async () => undefined,
  showText: async () => undefined,
  showScore: async () => undefined,
  showProgress: async () => undefined,
  clearDisplay: async () => undefined,
  setMode: async () => undefined,
};

const targetLabel = element<HTMLElement>('target');
const progressLabel = element<HTMLElement>('progress');
const scoreLabel = element<HTMLElement>('score');
const matchedLabel = element<HTMLElement>('matched');
const submissionsLabel = element<HTMLElement>('submissions');
const detectedLabel = element<HTMLElement>('detected');
const qualityLabel = element<HTMLElement>('quality');
const feedbackLabel = element<HTMLElement>('feedback');
const savedLabel = element<HTMLElement>('saved');
const submitButton = element<HTMLButtonElement>('submit');
const resendButton = element<HTMLButtonElement>('resend');
const finishButton = element<HTMLButtonElement>('finish');
const challengeSet = element<HTMLSelectElement>('challenge-set');

let run: GameRun<ShapeRecognitionState, ShapeRecognitionAction> | null = null;
let unsubscribe: (() => void) | null = null;
let strokes: DrawingPoint[][] = [];
let activeStroke: DrawingPoint[] | null = null;
let submissionNumber = 0;
let lastSubmission: ShapeRecognitionAction | null = null;

function setFeedback(message: string): void {
  feedbackLabel.textContent = message;
}

function renderDrawing(): void {
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 5;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#253b51';
  for (const stroke of [...strokes, ...(activeStroke ? [activeStroke] : [])]) {
    const first = stroke[0];
    if (!first) continue;
    context.beginPath();
    context.moveTo(first.x, first.y);
    if (stroke.length === 1) context.lineTo(first.x + 0.1, first.y + 0.1);
    else for (const point of stroke.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
  }
  submitButton.disabled = strokes.length === 0 || run?.status !== 'running';
}

function clearDrawing(): void {
  strokes = [];
  activeStroke = null;
  renderDrawing();
}

function render(): void {
  if (!run) return;
  const state = run.getState();
  targetLabel.textContent = state.target ?? 'All done!';
  progressLabel.textContent = state.completed ? 'Complete' : `${state.challengeIndex + 1} of ${state.challengeCount}`;
  scoreLabel.textContent = String(state.score);
  matchedLabel.textContent = `${state.matchedCount} / ${state.challengeCount}`;
  submissionsLabel.textContent = String(state.submissions);
  detectedLabel.textContent = state.lastResult?.shape ?? '—';
  qualityLabel.textContent = state.lastResult ? `${Math.round(state.lastResult.quality * 100)} / 100` : '—';
  finishButton.disabled = run.status !== 'running';
  resendButton.disabled = lastSubmission === null || run.status !== 'running';
  submitButton.disabled = strokes.length === 0 || run.status !== 'running';
}

function selectedTargets(): readonly TargetShape[] {
  if (challengeSet.value === 'all') return ['circle', 'triangle', 'square', 'rectangle'];
  if (challengeSet.value === 'circle' || challengeSet.value === 'triangle' ||
    challengeSet.value === 'square' || challengeSet.value === 'rectangle') return [challengeSet.value];
  return ['circle', 'triangle', 'square', 'rectangle'];
}

async function showSaved(record: ScoreRecord): Promise<void> {
  const records = await repository.list({ gameId: 'shape-recognition' });
  savedLabel.textContent = `${record.completed ? 'Completed' : 'Stopped early'} · ${record.score} points · ` +
    `${record.stars} stars · ${records.length} saved session${records.length === 1 ? '' : 's'} this visit.`;
}

async function startSession(): Promise<void> {
  if (run?.status === 'running') await run.quit();
  unsubscribe?.();
  clearDrawing();
  lastSubmission = null;
  const game = createShapeRecognitionGame({ targets: selectedTargets() });
  const current = startGame(game, { device, repository, useFidgetDisplay: false });
  run = current;
  unsubscribe = current.subscribe(render);
  current.result.then(async (record) => {
    await showSaved(record);
    if (run === current) render();
  }).catch((error: unknown) => setFeedback(`Could not save the score: ${String(error)}`));
  setFeedback('Draw the shape shown above, then check it.');
  render();
}

function canvasPoint(event: PointerEvent): DrawingPoint {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width, (event.clientX - bounds.left) * canvas.width / bounds.width)),
    y: Math.max(0, Math.min(canvas.height, (event.clientY - bounds.top) * canvas.height / bounds.height)),
  };
}

attachDrawingInput(canvas, window, canvasPoint, {
  onStart(point) {
    activeStroke = [point];
    setFeedback('Drawing… lift your finger or mouse button when ready.');
    renderDrawing();
  },
  onMove(point) {
    if (!activeStroke) return;
    const previous = activeStroke[activeStroke.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 1.5) return;
    activeStroke.push(point);
    renderDrawing();
  },
  onEnd(point) {
    if (!activeStroke) return;
    activeStroke.push(point);
    strokes.push(activeStroke);
    activeStroke = null;
    setFeedback(run?.status === 'running' ? 'Drawing ready. Check it when you like.' : 'Drawing works; start a new game to check it.');
    renderDrawing();
  },
});

submitButton.addEventListener('click', () => {
  if (!run || run.status !== 'running' || strokes.length === 0) return;
  const action: ShapeRecognitionAction = {
    type: 'submitDrawing',
    submissionId: `preview-${++submissionNumber}`,
    drawing: { width: canvas.width, height: canvas.height, strokes: strokes.map((stroke) => [...stroke]) },
  };
  try {
    run.submit(action);
    lastSubmission = action;
    const result = run.getState().lastResult;
    if (result?.matchesTarget) {
      setFeedback(run.getState().completed ? 'Wonderful work! Your game is complete.' : 'Nice work! A new shape is ready.');
    } else if (result?.shape === 'unknown') {
      setFeedback('Good start! Try a larger, clearer outline.');
    } else {
      setFeedback(`I spotted a ${result?.shape ?? 'shape'}. Give the target another try.`);
    }
    clearDrawing();
    render();
  } catch (error) {
    setFeedback(`Please try that drawing again: ${String(error)}`);
  }
});
element<HTMLButtonElement>('clear').addEventListener('click', clearDrawing);
element<HTMLButtonElement>('new-game').addEventListener('click', () => {
  startSession().catch((error: unknown) => setFeedback(`Could not start a game: ${String(error)}`));
});
finishButton.addEventListener('click', () => {
  if (!run) return;
  run.quit().then(() => setFeedback('This game was saved. You can start a new one anytime.'))
    .catch((error: unknown) => setFeedback(`Could not finish the game: ${String(error)}`));
});
resendButton.addEventListener('click', () => {
  if (!run || !lastSubmission) return;
  const scoreBefore = run.getScore().score;
  const countBefore = run.getState().submissions;
  run.submit(lastSubmission);
  const unchanged = run.getScore().score === scoreBefore && run.getState().submissions === countBefore;
  setFeedback(unchanged ? 'Duplicate protection works: no extra points or submission.' : 'Duplicate check changed the score.');
  render();
});

startSession().catch((error: unknown) => setFeedback(`Could not start a game: ${String(error)}`));
