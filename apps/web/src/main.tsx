import { StrictMode, useEffect, useMemo, useRef, useState, type CSSProperties,
  type PointerEvent as ReactPointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { createJimmyServices, JimmyServicesProvider, useCelebration, useConnection, useGameRun, useScores,
  useToyState } from '@jimmyit/app-kit';
import type { ToyConnector } from '@jimmyit/app-kit';
import { type ScoreRecord } from '@jimmyit/core';
import { createFakeFidget, type FakeFidget } from '@jimmyit/fake-fidget';
import { drawingReducer, freeDrawing, strokeToPath, type DrawingGameAction, type DrawingGameState,
  type Stroke } from '@jimmyit/game-drawing';
import { type ShapeRecognitionAction, type ShapeRecognitionState, type TargetShape } from '@jimmyit/game-shape-recognition';
import { type TapQuestAction, type TapQuestMode, type TapQuestState } from '@jimmyit/game-tap-quest';
import { createTimedPractice, type TimedPracticeState } from '@jimmyit/game-timed-practice';
import { createButtonHeroGame, type ButtonHeroAction, type ButtonHeroDifficulty,
  type ButtonHeroState } from '@jimmyit/game-button-hero';
import { ButtonHeroView } from '@jimmyit/game-button-hero/view';
import { createKnobQuestGame, type KnobQuestAction, type KnobQuestDifficulty,
  type KnobQuestState } from '@jimmyit/game-knob-quest';
import { KnobQuestView } from '@jimmyit/game-knob-quest/view';
import { COLOR_STYLES, type Palette } from '../../mobile/src/design/palettes';
import { attachGameKeyboard } from '../../mobile/src/game-keyboard.web';
import { dispatchGameInput } from '../../mobile/src/game-input';
import { PLAY_SHELF, type ShelfGameId } from '../../mobile/src/games';
import faceArt from '../../mobile/assets/intro-face.png';
import rewardsBanner from '../../mobile/assets/rewards-banner.png';
import settingsJimmy from '../../mobile/assets/settings-jimmy.png';
import { JimmyFace } from './JimmyFace';
import { MobileGameArt } from './MobileGameArt';
import { createWebShapeRecognizer, isShapeAIConfigured } from './shape-ai';
import { createWebBluetoothConnector, isWebBluetoothAvailable } from './web-bluetooth';
import { createWebStorage } from './web-storage';
import { createAdaptiveTapGame, GAME_CATALOG, SHAPE_GAME, TAP_MODES } from './web-games';
import { handlePracticeKey } from './web-input';
import './style.css';
import './mobile-parity.css';

type Page = 'play' | 'rewards' | 'settings';
type Game = 'timed' | 'tap' | 'drawing' | 'shapes' | 'buttonHero' | 'knobQuest';
type InputMode = 'keyboard' | 'toy';

const toWebGame = (id: ShelfGameId): Game => id === 'tapQuest' ? 'tap' : id;

const toy = createFakeFidget();
const keyboardConnector: ToyConnector = {
  kind: 'simulated',
  async connect() {
    toy.reconnect();
    return toy.transport;
  },
};
const storage = createWebStorage(window.localStorage);

function App() {
  const [inputMode, setInputMode] = useState<InputMode>('keyboard');
  const connector = useMemo(() => inputMode === 'keyboard' ? keyboardConnector : createWebBluetoothConnector(), [inputMode]);
  const services = useMemo(() => createJimmyServices({ storage, connector, appName: 'Jimmy web' }), [connector]);
  const [page, setPage] = useState<Page>('play');
  const [game, setGame] = useState<Game | null>(null);
  const [shelfIndex, setShelfIndex] = useState(0);
  const [choices, setChoices] = useState<Partial<Record<ShelfGameId, string>>>({ timed: '30000', tapQuest: 'precision' });
  const [gameOption, setGameOption] = useState<string | null>(null);
  const [dark, setDark] = useState(() => window.localStorage.getItem('jimmyit.web.dark') === 'true');
  const [calm, setCalm] = useState(() => window.localStorage.getItem('jimmyit.web.calm') === 'true');
  const [bubbles, setBubbles] = useState(() => window.localStorage.getItem('jimmyit.web.bubbles') !== 'false');
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    window.localStorage.setItem('jimmyit.web.dark', String(dark)); }, [dark]);
  useEffect(() => { document.documentElement.dataset.style = calm ? 'calm' : 'classic';
    window.localStorage.setItem('jimmyit.web.calm', String(calm)); }, [calm]);
  useEffect(() => {
    const palette = COLOR_STYLES[calm ? 'calm' : 'classic'][dark ? 'dark' : 'light'];
    const root = document.documentElement;
    const values = { page: palette.page, surface: palette.surface, sheet: palette.sheet, text: palette.text,
      secondary: palette.secondary, ink: palette.ink, border: palette.border, header: palette.header,
      headerBorder: palette.headerBorder, focus: palette.focus, mint: palette.mint, coral: palette.coral,
      yellow: palette.yellow, teal: palette.teal, berry: palette.berry, navy: palette.navy, purple: palette.purple,
      accentText: palette.accentText, softMint: palette.softMint,
      bubbleOne: palette.bubbles[0] ?? palette.coral, bubbleTwo: palette.bubbles[1] ?? palette.yellow,
      bubbleThree: palette.bubbles[2] ?? palette.mint };
    Object.entries(values).forEach(([name, value]) => root.style.setProperty(`--${name}`, value));
  }, [dark, calm]);
  useEffect(() => { window.localStorage.setItem('jimmyit.web.bubbles', String(bubbles)); }, [bubbles]);
  useEffect(() => () => { void services.connection.disconnect(); }, [services]);
  const navigate = (next: Page) => { setGame(null); setPage(next); window.scrollTo(0, 0); };
  return <JimmyServicesProvider services={services}>
    <div className={`site ${bubbles ? 'with-bubbles' : ''}`}>
      <div className="ambient ambient-one" aria-hidden="true" /><div className="ambient ambient-two" aria-hidden="true" />
      <Header page={page} onNavigate={navigate} />
      <main className="content">
        {page === 'play' && (game ? <GamePage key={game} game={game} option={gameOption} inputMode={inputMode}
          toy={toy} palette={COLOR_STYLES[calm ? 'calm' : 'classic'][dark ? 'dark' : 'light']}
          onBack={() => setGame(null)} />
          : <PlayPage index={shelfIndex} onIndex={setShelfIndex} choices={choices}
            onChoice={(id, value) => setChoices((current) => ({ ...current, [id]: value }))}
            inputMode={inputMode} dark={dark} calm={calm}
            onPlay={(id, option) => { setGameOption(option); setGame(id); }} />)}
        {page === 'rewards' && <RewardsPage />}
        {page === 'settings' && <SettingsPage inputMode={inputMode} onInputMode={setInputMode} dark={dark}
          onDark={setDark} calm={calm} onCalm={setCalm} bubbles={bubbles} onBubbles={setBubbles} />}
      </main>
      <Celebration />
      <footer>Made for little moves and big moments · Your scores stay in this browser.</footer>
    </div>
  </JimmyServicesProvider>;
}

function Header({ page, onNavigate }: { page: Page; onNavigate: (next: Page) => void }) {
  const connection = useConnection();
  return <header className="header"><div className="header-inner">
    <button className="brand" onClick={() => onNavigate('play')} aria-label="JimmyIt Play home">
      <img className="face" src={faceArt} alt="" />
      <span className="brand-name">JimmyIt<small>Webspace</small></span>
    </button>
    <span className={`connection-pill ${connection.status}`} role="status">
      <span aria-hidden="true">●</span> {connection.status === 'connected' ? 'Jimmy connected'
        : connection.status === 'searching' ? 'Finding Jimmy…' : 'Find Jimmy'}
    </span>
    <nav aria-label="Main navigation">
      {(['play', 'rewards', 'settings'] as const).map((item) => <button key={item}
        className={`nav-item nav-${item} ${page === item ? 'selected' : ''}`}
        aria-current={page === item ? 'page' : undefined} aria-label={item === 'play' ? 'Play games'
          : item === 'rewards' ? 'Rewards and high scores' : 'Settings'}
        onClick={() => onNavigate(item)}><NavIcon name={item} /><span>{item[0]?.toUpperCase()}{item.slice(1)}</span></button>)}
    </nav>
  </div></header>;
}

function NavIcon({ name }: { name: Page }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4"
    strokeLinecap="round" strokeLinejoin="round">
    {name === 'play' && <path d="M7 4.6v14.8a1.1 1.1 0 0 0 1.7.9l11.4-7.4a1.1 1.1 0 0 0 0-1.8L8.7 3.7A1.1 1.1 0 0 0 7 4.6Z" />}
    {name === 'rewards' && <><path d="M7 3h10v5.5a5 5 0 0 1-10 0ZM7 5H4.5a3 3 0 0 0 3 4.6M17 5h2.5a3 3 0 0 1-3 4.6M12 13.5V17M9 17h6v3H9ZM6.5 21h11" />
      <path d="m12 5.4.8 1.6 1.7.2-1.3 1.2.4 1.6-1.6-.8-1.6.8.4-1.6-1.3-1.2 1.7-.2Z" />
    </>}
    {name === 'settings' && <><path d="m10 3-1 3-3-1-2 3 2 3-2 3 2 3 3-1 1 3h4l1-3 3 1 2-3-2-3 2-3-2-3-3 1-1-3Z" />
      <circle cx="12" cy="11" r="3" /></>}
  </svg>;
}

function PlayPage({ index, onIndex, choices, onChoice, inputMode, dark, calm, onPlay }: {
  index: number; onIndex: (index: number) => void;
  choices: Partial<Record<ShelfGameId, string>>; onChoice: (id: ShelfGameId, value: string) => void;
  inputMode: InputMode; dark: boolean; calm: boolean; onPlay: (game: Game, option: string | null) => void;
}) {
  const { scoreboard } = useScores({ games: GAME_CATALOG });
  const connection = useConnection();
  const [tipOpen, setTipOpen] = useState(false);
  const game = PLAY_SHELF[index] ?? PLAY_SHELF[0];
  useEffect(() => setTipOpen(false), [index]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat ||
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); onIndex(Math.min(PLAY_SHELF.length - 1, index + 1)); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); onIndex(Math.max(0, index - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onIndex]);
  if (!game) return null;
  const palette = COLOR_STYLES[calm ? 'calm' : 'classic'][dark ? 'dark' : 'light'];
  const color = palette.banners[game.color];
  const selected = choices[game.id] ?? game.options[0]?.value ?? null;
  const row = scoreboard.rows.find((item) => item.gameId === game.scoreGameId(selected));
  const stat = game.stat === 'count' ? row?.sessions ?? 0 : row?.bestScore ?? 0;
  const title = game.options.find((item) => item.value === selected)?.caption ?? game.tagline;
  return <>
    <section className="shelf-screen" aria-label="Choose a game">
      <p className="shelf-intro">Choose a game. Take your time.</p>
      <div className="shelf-stage">
        <button className="shelf-arrow" onClick={() => onIndex(Math.max(0, index - 1))}
          disabled={index === 0} aria-label="Previous game">‹</button>
        <article className="game-banner" style={{ background: color.background, borderColor: color.border }}>
          <div className="banner-left"><h1>{game.title}</h1>
            <MobileGameArt name={game.art} ink={palette.text} accent={color.accent} shadow={color.shadow} />
            <p className="use-label">{game.uses === 'jimmy' ? inputMode === 'keyboard'
              ? 'Keyboard or Jimmy toy' : connection.status === 'connected' ? 'Plays with Jimmy' : 'Connect Jimmy to play'
              : game.uses === 'stylus' ? 'Mouse, touch or stylus' : 'Finger, mouse or stylus'}</p>
          </div>
          <div className="banner-right">
            <button className="tip-button" onClick={() => setTipOpen((open) => !open)}
              aria-label={`How to play ${game.title}`} aria-expanded={tipOpen}>i</button>
            <div className="banner-score"><span>{game.stat === 'count' ? 'Drawings' : 'High Score'}</span>
              <strong>{stat}</strong></div>
            <p>{title}</p>
            {game.options.length > 0 && <div className="banner-options" role="radiogroup" aria-label={`${game.title} options`}>
              {game.options.map((option) => <button key={option.value} role="radio"
                aria-checked={selected === option.value} className={selected === option.value ? 'choice chosen' : 'choice'}
                style={selected === option.value ? { background: color.accent, borderColor: palette.ink } : undefined}
                onClick={() => onChoice(game.id, option.value)}>{selected === option.value ? '✓ ' : ''}{option.label}</button>)}
            </div>}
            <button className="primary banner-play" style={{ background: color.accent }}
              onClick={() => onPlay(toWebGame(game.id), selected)}>▶ Play</button>
          </div>
          {tipOpen && <aside className="banner-tip" role="status"><strong>How to play</strong><p>{game.howTo}</p></aside>}
        </article>
        <button className="shelf-arrow" onClick={() => onIndex(Math.min(PLAY_SHELF.length - 1, index + 1))}
          disabled={index === PLAY_SHELF.length - 1} aria-label="Next game">›</button>
      </div>
      <div className="shelf-dots" role="tablist" aria-label="Games">
        {PLAY_SHELF.map((item, itemIndex) => <button key={item.id} role="tab" aria-selected={index === itemIndex}
          className={index === itemIndex ? 'active' : ''} aria-label={`Show ${item.title}`}
          onClick={() => onIndex(itemIndex)} />)}
      </div>
      <p className="shelf-footnote">{inputMode === 'keyboard' ? 'Keyboard and mouse play is ready here.'
        : 'Find Jimmy in Settings to play with the toy.'}</p>
    </section>
  </>;
}

function GamePage({ game, option, inputMode, toy, palette, onBack }: { game: Game; option: string | null;
  inputMode: InputMode; toy: FakeFidget; palette: Palette; onBack: () => void }) {
  return <section className="game-page"><button className="back" onClick={onBack}>← All games</button>
    {game === 'timed' ? <TimedGame inputMode={inputMode} toy={toy} initialSeconds={Number(option ?? 30000) / 1000} />
      : game === 'tap' ? <TapGame initialMode={(option ?? 'precision') as TapQuestMode} />
      : game === 'buttonHero' ? <ButtonHeroGame palette={palette} />
      : game === 'knobQuest' ? <KnobQuestGame palette={palette} />
        : <DrawingGame key={game} shape={game === 'shapes'} />}</section>;
}

function TimedGame({ inputMode, toy, initialSeconds }: { inputMode: InputMode; toy: FakeFidget; initialSeconds: number }) {
  const connection = useConnection();
  const run = useGameRun<TimedPracticeState>();
  const [seconds, setSeconds] = useState(initialSeconds);
  const [startError, setStartError] = useState('');
  const active = run.status === 'running' || run.status === 'paused';
  useEffect(() => {
    if (inputMode !== 'keyboard' || run.status !== 'running') return;
    const key = (event: KeyboardEvent) => { handlePracticeKey(event, toy); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [inputMode, run.status, toy]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) run.pause(); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [run.pause]);
  const begin = async () => {
    setStartError('');
    try {
      if (inputMode === 'keyboard' && connection.status !== 'connected') await connection.connect();
      run.start(createTimedPractice(seconds * 1000));
    } catch {
      setStartError('Your play input is still getting ready. Please try again.');
    }
  };
  return <><ScoreBar score={run.score?.score ?? 0} />
    <GameTitle eyebrow="MOVE & DISCOVER" title="Timed Run" description="Go at your own pace. Every move counts." />
    <div className="game-layout"><div className="play-panel timer-panel">
      <div className="choices" role="group" aria-label="Practice length">{[30, 60, 90].map((value) => <button
        key={value} className={seconds === value ? 'choice chosen' : 'choice'} disabled={active}
        onClick={() => setSeconds(value)}>{value} sec</button>)}</div>
      <div className="timer" aria-live="polite">{Math.ceil((run.remainingMs ?? seconds * 1000) / 1000)}<small>sec</small></div>
      <progress max={seconds * 1000} value={run.status === 'idle' ? 0 : seconds * 1000 - (run.remainingMs ?? 0)}
        aria-label="Practice time" />
      <p className="score-line">{run.state?.totalMoves ?? 0} little moves <span>·</span> {run.score?.score ?? 0} points</p>
      {run.status === 'finished' && <p className="success" role="status">Wonderful work! Your points are {run.saveStatus === 'saved' ? 'saved.' : 'being saved.'}</p>}
      <div className="actions">
        {inputMode === 'toy' && connection.status !== 'connected' && <button className="primary" onClick={() => { void connection.connect(); }}
          disabled={connection.status === 'searching' || connection.status === 'awaitingApproval'}>Connect play input</button>}
        {(inputMode === 'keyboard' || connection.status === 'connected') && !active && <button className="primary"
          onClick={() => { void begin(); }} disabled={connection.status === 'searching'}>
          {run.status === 'finished' ? 'Play again' : 'Start practice'}</button>}
        {run.status === 'running' && <button className="secondary" onClick={run.pause}>Pause</button>}
        {run.status === 'paused' && <button className="primary" onClick={run.resume}>Resume</button>}
        {active && <button className="secondary" onClick={run.quit}>Finish now</button>}
        {run.saveStatus === 'failed' && <button className="secondary" onClick={run.retrySave}>Retry saving</button>}
      </div>
      {connection.status === 'awaitingApproval' && <p role="status">Say yes on Jimmy to connect.</p>}
      {startError && <p className="error" role="alert">{startError}</p>}
      {connection.error && <p className="error" role="alert">Connection: {connection.error.detail}</p>}
    </div><aside className="input-panel"><h3>{inputMode === 'keyboard' ? 'Your play controls' : 'Play with Jimmy'}</h3>
      <p>{inputMode === 'keyboard' ? 'Use these buttons or press J, K and L.' : 'Press, spin and turn the controls on your toy.'}</p>
      {(['press', 'spin', 'screw'] as const).map((move, index) => <div className="move-row" key={move}>
        <span className="move-count">{run.state?.moves[move] ?? 0}</span>
        {inputMode === 'keyboard' ? <button disabled={run.status !== 'running'} onClick={() => {
          if (move === 'press') toy.tap('clicker'); else if (move === 'spin') toy.spin(90); else toy.turnScrew(1);
        }}>{['Press button', 'Spin dial', 'Turn screw'][index]} <kbd>{['J', 'K', 'L'][index]}</kbd></button>
          : <span>{['Button presses', 'Dial spins', 'Screw turns'][index]}</span>}</div>)}
    </aside></div></>;
}

/** Pauses a running game when the browser tab is hidden, like the phone app does when it goes to the background. */
function usePauseWhenHidden(pause: () => void) {
  useEffect(() => {
    const hidden = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [pause]);
}

// Button Hero and Knob Quest render the same views as the phone app; the keyboard uses the phone app's web adapter.
function ButtonHeroGame({ palette }: { palette: Palette }) {
  const run = useGameRun<ButtonHeroState, ButtonHeroAction>();
  const [difficulty, setDifficulty] = useState<ButtonHeroDifficulty>('normal');
  const submit = useRef(run.submit);
  submit.current = run.submit;
  useEffect(() => attachGameKeyboard('buttonHero', (event) =>
    dispatchGameInput(event, (action) => submit.current(action), () => undefined)), []);
  usePauseWhenHidden(run.pause);
  return <><ScoreBar score={run.score?.score ?? 0} /><ButtonHeroView state={run.state} status={run.status} difficulty={difficulty} theme={palette}
    onDifficulty={setDifficulty} onStart={() => run.start(createButtonHeroGame({ difficulty }), { tickMs: 40 })}
    onPause={run.pause} onResume={run.resume} onButton={(action) => run.submit(action)} /></>;
}

function KnobQuestGame({ palette }: { palette: Palette }) {
  const run = useGameRun<KnobQuestState, KnobQuestAction>();
  const [difficulty, setDifficulty] = useState<KnobQuestDifficulty>('normal');
  const seed = useRef(0);
  const submit = useRef(run.submit);
  submit.current = run.submit;
  useEffect(() => attachGameKeyboard('knobQuest', (event) =>
    dispatchGameInput(event, () => undefined, (action) => submit.current(action))), []);
  usePauseWhenHidden(run.pause);
  return <><ScoreBar score={run.score?.score ?? 0} />
    <KnobQuestView state={run.state} status={run.status} difficulty={difficulty} theme={palette}
    renderPlayer={({ size, color }) => <JimmyFace size={size} color={color} />}
    onDifficulty={setDifficulty} onStart={() => {
      seed.current++;
      run.start(createKnobQuestGame(undefined, difficulty, seed.current), { tickMs: 40 });
    }} onAxis={(action) => run.submit(action)} /></>;
}

function TapGame({ initialMode }: { initialMode: TapQuestMode }) {
  const scores = useScores();
  const run = useGameRun<TapQuestState, TapQuestAction>();
  const [mode, setMode] = useState<TapQuestMode>(initialMode);
  const [seed, setSeed] = useState(1);
  const active = run.status === 'running' || run.status === 'paused';
  const state = run.state;
  const board = useRef<HTMLDivElement>(null);
  const send = (event: ReactPointerEvent, phase: 'down' | 'move' | 'up') => {
    if (run.status !== 'running' || !board.current) return;
    const rect = board.current.getBoundingClientRect();
    const point = { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
    run.submit({ type: 'touch', phase, point });
  };
  const start = () => { run.start(createAdaptiveTapGame(mode, scores.records, seed), { tickMs: 100 }); setSeed(seed + 1); };
  return <><ScoreBar score={run.score?.score ?? 0} />
    <GameTitle eyebrow="TAP & TRACE" title="Tap Quest" description="Steady taps, paths and patterns. Near misses count too." />
    <div className="play-panel tap-panel"><div className="choices" role="group" aria-label="Tap Quest mode">
      {TAP_MODES.map((item) => <button className={mode === item ? 'choice chosen' : 'choice'} key={item}
        disabled={active} onClick={() => setMode(item)}>{item[0]?.toUpperCase()}{item.slice(1)}</button>)}</div>
      {state && <div className="quest-stats"><strong>{state.targetIndex} / {state.targetCount} targets</strong>
        <span>{state.score} points</span></div>}
      {state?.memoryPhase === 'preview' && <p role="status">Watch the circles light up, then tap them in order.</p>}
      {state?.memoryPhase === 'recall' && <p role="status">Your turn: tap the pattern back.</p>}
      <div className="tap-board" ref={board} role="application" aria-label="Tap Quest play area"
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); send(event, 'down'); }}
        onPointerMove={(event) => { if (event.buttons) send(event, 'move'); }} onPointerUp={(event) => send(event, 'up')}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {state?.path && state.path.length > 0 && <polyline points={state.path.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
            fill="none" stroke="#42a6a0" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />}
          {state?.choices.map((circle, i) => <circle key={i} cx={circle.x * 100} cy={circle.y * 100}
            r={circle.radius * 100} fill="#fff" stroke="#6a5f98" strokeWidth="1" />)}
          {state?.target && <circle cx={state.target.x * 100} cy={state.target.y * 100}
            r={state.target.radius * 100} fill="#f3a18f" stroke="#283350" strokeWidth="1.5" />}
        </svg>
        {!active && <span className="board-placeholder">{run.status === 'finished' ? 'Great tapping!' : 'Pick a mode, then start'}</span>}
      </div>
      <div className="actions">{!active && <button className="primary" onClick={start}>{run.status === 'finished' ? 'Play again' : 'Start'}</button>}
        {run.status === 'running' && <button className="secondary" onClick={run.pause}>Pause</button>}
        {run.status === 'paused' && <button className="primary" onClick={run.resume}>Resume</button>}
        {state?.mode === 'memory' && state.memoryPhase === 'recall' && run.status === 'running'
          && <button className="secondary" onClick={() => run.submit({ type: 'replaySequence' })}>Show me again</button>}
        {active && state?.mode === 'calm' && <button className="secondary" onClick={() => run.submit({ type: 'finish' })}>I’m done</button>}
        {active && state?.mode !== 'calm' && <button className="secondary" onClick={run.quit}>Finish now</button>}
        {run.saveStatus === 'failed' && <button className="secondary" onClick={run.retrySave}>Retry saving</button>}
      </div>
      {run.record && <p className="success" role="status">{run.record.score} points saved. Nice work!</p>}
    </div></>;
}

const colors = ['#2b6faf', '#ea796d', '#8c65ad', '#3d9a83', '#e1a43d', '#27334f', '#ec92b3', '#64a8d1'];
const shapes: readonly TargetShape[] = ['circle', 'triangle', 'square', 'rectangle'];

function DrawingGame({ shape }: { shape: boolean }) {
  const drawingRun = useGameRun<DrawingGameState, DrawingGameAction>();
  const shapeRun = useGameRun<ShapeRecognitionState, ShapeRecognitionAction>();
  const shapeRecognizer = useMemo(() => createWebShapeRecognizer(), []);
  const [strokes, setStrokes] = useState<readonly Stroke[]>([]);
  const [color, setColor] = useState(colors[0] ?? '#2b6faf');
  const [width, setWidth] = useState(9);
  const [message, setMessage] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const pointer = useRef<number | null>(null);
  const submission = useRef(0);
  const canvas = useRef<HTMLDivElement>(null);
  const active = shape ? shapeRun.status === 'running' : drawingRun.status === 'running';
  const target = shapeRun.state?.target ?? 'circle';
  const saved = shape ? shapeRun.record : drawingRun.record;
  const pointAt = (event: ReactPointerEvent) => {
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: Math.max(0, Math.min(1000, (event.clientX - rect.left) / rect.width * 1000)),
      y: Math.max(0, Math.min(650, (event.clientY - rect.top) / rect.height * 650)) };
  };
  const begin = (event: ReactPointerEvent) => {
    if (saved || recognizing) return;
    pointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (shape && shapeRun.status === 'idle') shapeRun.start(SHAPE_GAME);
    if (!shape && drawingRun.status === 'idle') drawingRun.start(freeDrawing);
    setStrokes((current) => drawingReducer(current, { type: 'begin', point: pointAt(event), color, width }));
  };
  const submit = async () => {
    if (!shape) {
      const play = drawingRun.run ?? drawingRun.start(freeDrawing);
      play.submit({ type: 'finish', strokeCount: strokes.length });
      return;
    }
    if (recognizing || shapeRun.saveStatus === 'saving') return;
    const play = shapeRun.run ?? shapeRun.start(SHAPE_GAME);
    const before = play.getState().target;
    if (!before) return;
    const rect = canvas.current?.getBoundingClientRect();
    const drawingWidth = rect?.width ?? 1000;
    const drawingHeight = rect?.height ?? 650;
    const drawing = { width: drawingWidth, height: drawingHeight, strokes: strokes.map((stroke) =>
      stroke.points.map((point) => ({ x: point.x * drawingWidth / 1000, y: point.y * drawingHeight / 650 }))) };
    setRecognizing(true);
    try {
      const prediction = await shapeRecognizer.predict(drawing, before);
      play.submit({ type: 'submitDrawing', submissionId: String(++submission.current), drawing, prediction });
      const after = play.getState();
      const source = prediction.provider === 'huggingface' ? 'Hugging Face' : 'on-device shapes';
      setMessage(`${after.lastResult?.feedback === 'shapeMatched' ? `Lovely ${before}!`
        : after.lastResult?.feedback === 'drawMore' ? 'Add a little more and try again.'
          : `Nice try! Give the ${before} another go.`} Checked with ${source}.`);
      if (after.target !== before) setStrokes([]);
    } catch {
      setMessage('Your drawing is still here. Add a little more and try again.');
    } finally {
      setRecognizing(false);
    }
  };
  return <><GameTitle eyebrow={shape ? 'DRAW & DISCOVER' : 'MAKE YOUR MARK'}
    title={shape ? 'Shape Challenge' : 'Your masterpiece'}
    description={shape ? 'Follow each shape at your own pace. Every try helps.' : 'Pick a color and draw anything you like.'} />
    <div className="drawing-layout"><aside className="tool-panel"><h3>Colors</h3><div className="swatches" role="group" aria-label="Drawing color">
      {colors.map((item) => <button key={item} className={item === color ? 'swatch selected' : 'swatch'}
        style={{ backgroundColor: item }} aria-label={`Color ${item}`} aria-pressed={item === color}
        onClick={() => setColor(item)} />)}</div><h3>Brush size</h3><div className="choices">
      {[5, 9, 16].map((item) => <button key={item} className={width === item ? 'choice chosen' : 'choice'}
        onClick={() => setWidth(item)}>{item === 5 ? 'Small' : item === 9 ? 'Medium' : 'Large'}</button>)}</div>
      {shape && <p className="shape-prompt">Shape {(shapeRun.state?.challengeIndex ?? 0) + 1} of 4<br />
        <strong>{target[0]?.toUpperCase()}{target.slice(1)}</strong></p>}
    </aside><div className="canvas-column"><div className="canvas" ref={canvas}
      onPointerDown={begin} onPointerMove={(event) => { if (pointer.current === event.pointerId) setStrokes((current) =>
        drawingReducer(current, { type: 'move', point: pointAt(event) })); }}
      onPointerUp={() => { pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }}
      role="application" aria-label={shape ? `Draw a ${target}` : 'Drawing canvas'}>
      <svg viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">
        {shape && <ShapeGuide target={target} />}
        {strokes.map((stroke, index) => <path key={index} d={strokeToPath(stroke)} stroke={stroke.color}
          strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
      </svg></div><div className="actions canvas-actions"><button className="secondary" disabled={!strokes.length}
        onClick={() => setStrokes((current) => drawingReducer(current, { type: 'undo' }))}>Undo</button>
      <button className="secondary" disabled={!strokes.length} onClick={() => setStrokes([])}>Clear</button>
      <button className="primary" onClick={() => { void submit(); }} disabled={Boolean(saved) || recognizing || (shape && strokes.length === 0)}>
        {recognizing ? 'Checking shape…' : shape ? 'Check shape' : 'All done'}</button></div>
      {message && <p role="status">{message}</p>}{saved && <p className="success" role="status">{saved.score} points saved. Lovely work!</p>}
      {(shape ? shapeRun.saveStatus : drawingRun.saveStatus) === 'failed' && <button className="secondary"
        onClick={shape ? shapeRun.retrySave : drawingRun.retrySave}>Retry saving</button>}
      {!active && saved && <button className="secondary" onClick={() => {
        shape ? shapeRun.clear() : drawingRun.clear(); setStrokes([]); setMessage('');
      }}>Start a new {shape ? 'challenge' : 'drawing'}</button>}
    </div></div></>;
}

function ShapeGuide({ target }: { target: TargetShape }) {
  const path = target === 'circle' ? <circle cx="500" cy="325" r="180" />
    : target === 'triangle' ? <polygon points="500,120 250,530 750,530" />
      : target === 'square' ? <rect x="305" y="130" width="390" height="390" />
        : <rect x="235" y="190" width="530" height="270" />;
  return <g fill="none" stroke="#d9c9b2" strokeWidth="7" strokeDasharray="16 16">{path}</g>;
}

function RewardsPage() {
  const { progress, scoreboard, loading, error } = useScores({ games: GAME_CATALOG });
  return <><section className="rewards-heading"><img src={rewardsBanner}
    alt="Adventurer's Rewards. Look what you've achieved!" />
    <p>Every move helps your collection grow.</p></section>
    {loading && <p>Loading your rewards…</p>}{error && <p className="error" role="alert">Your saved points could not be read. They have not been changed.</p>}
    <section className="level-card"><div className="level-bubble">{progress.level}</div><div><h2>Level {progress.level} · Creative explorer</h2>
      <progress max={250} value={progress.levelPoints} aria-label="Progress to next level" />
      <p>{progress.levelPoints} / 250 points · {progress.pointsToNextLevel} to the next level</p></div>
      <strong>{progress.points.toLocaleString()}<small>total points</small></strong></section>
    <div className="section-head"><div><p className="eyebrow">YOUR COLLECTION</p><h2>Badges</h2></div>
      <p>{progress.badges.filter((badge) => badge.earned).length} / {progress.badges.length} earned</p></div>
    <div className="badge-grid">{progress.badges.map((badge) => <article className="badge" key={badge.id}>
      <div className={`badge-art ${badge.earned ? 'earned' : ''}`}>{badge.earned ? '★' : '✦'}</div>
      <div><h3>{badge.label}</h3><p>{badge.earned ? '✓ Earned' : `${badge.count} / ${badge.goal} toward this badge`}</p>
        {!badge.earned && <progress max={badge.goal} value={badge.count} aria-label={`${badge.label} progress`} />}</div>
    </article>)}</div>
    <section className="recent"><div className="section-head"><div><p className="eyebrow">LITTLE MOMENTS</p><h2>Recent scores</h2></div>
      <p>{scoreboard.sessions} games played</p></div>
      {scoreboard.recent.length === 0 ? <p>Your first score will show up here. Pick a game and have fun!</p>
        : <div className="score-list">{scoreboard.recent.map((record: ScoreRecord) => <div key={record.id}>
          <span>{GAME_CATALOG.find((entry) => entry.id === record.gameId)?.title ?? record.gameId.replaceAll('-', ' ')}</span>
          <strong>{record.score} points</strong><small>{new Date(record.startedAt).toLocaleDateString()}</small>
        </div>)}</div>}
    </section></>;
}

function SettingsPage({ inputMode, onInputMode, dark, onDark, calm, onCalm, bubbles, onBubbles }: {
  inputMode: InputMode; onInputMode: (mode: InputMode) => void; dark: boolean; onDark: (value: boolean) => void;
  calm: boolean; onCalm: (value: boolean) => void; bubbles: boolean; onBubbles: (value: boolean) => void;
}) {
  const connection = useConnection();
  const state = useToyState();
  const [nickname, setNickname] = useState(() => window.localStorage.getItem('jimmyit.web.nickname') ?? 'Jimmy');
  const [draftName, setDraftName] = useState(nickname);
  const [calibration, setCalibration] = useState(false);
  const saveName = () => {
    const next = draftName.trim().slice(0, 15) || 'Jimmy';
    setNickname(next);
    setDraftName(next);
    window.localStorage.setItem('jimmyit.web.nickname', next);
  };
  return <><section className="page-heading settings-heading"><p className="eyebrow">MAKE IT YOURS</p><h1>Settings</h1>
    <p>Choose how you play. Your choices and scores stay on this computer.</p></section>
    <div className="settings-grid"><section className="settings-card"><img className="settings-art" src={settingsJimmy} alt="" /><h2>Your play input</h2>
      <p className="toy-name">Your toy: <strong>{nickname}</strong></p>
      <div className="name-row"><label htmlFor="toy-name">Jimmy's nickname</label>
        <input id="toy-name" value={draftName} maxLength={15} onChange={(event) => setDraftName(event.target.value)} />
        <button className="secondary" onClick={saveName}>Save name</button></div>
      <p>Choose Jimmy or keyboard and mouse. You can change this between games.</p>
      <div className="input-choices"><button className={inputMode === 'keyboard' ? 'input-choice selected' : 'input-choice'}
        onClick={() => onInputMode('keyboard')} aria-pressed={inputMode === 'keyboard'}><strong>⌨ Keyboard & mouse</strong>
        <small>Works in every modern browser</small></button>
        <button className={inputMode === 'toy' ? 'input-choice selected' : 'input-choice'}
          disabled={!isWebBluetoothAvailable()} onClick={() => onInputMode('toy')} aria-pressed={inputMode === 'toy'}>
          <strong>◉ Jimmy toy</strong><small>{isWebBluetoothAvailable() ? 'Connect over Bluetooth' : 'Needs a supported browser and HTTPS'}</small>
        </button></div>
      <div className="connection-row"><span role="status">{connection.status === 'connected' ? 'Ready to play'
        : connection.status === 'awaitingApproval' ? 'Say yes on Jimmy'
          : connection.status === 'searching' ? 'Finding Jimmy…' : 'Not connected'}</span>
        {connection.status === 'connected' ? <button className="secondary" onClick={() => { void connection.disconnect(); }}>Disconnect</button>
          : <button className="primary" onClick={() => { void connection.connect(); }}
            disabled={connection.status === 'searching' || connection.status === 'awaitingApproval'}>Connect</button>}</div>
      {state && <p>Battery: {state.batteryPercent ?? 'unknown'}{state.batteryPercent === null ? '' : '%'}</p>}
      {connection.lastSync && <p>{connection.lastSync.added} toy scores synced.</p>}
      {connection.error && <p className="error" role="alert">{connection.error.detail}</p>}
      <div className="calibration"><h3>Get ready to play</h3><p>Try each toy control or keyboard button. This practice step does not change hardware settings.</p>
        <button className="secondary" onClick={() => setCalibration(!calibration)}>
          {calibration ? 'Ready to play ✓' : 'Start practice check'}</button></div>
    </section><section className="settings-card"><span className="settings-icon">☼</span><h2>Look & feel</h2>
      <p>Make the playspace comfortable for you.</p><Toggle label="Dark mode" checked={dark} onChange={onDark} />
      <Toggle label="Calm colors" checked={calm} onChange={onCalm} /><Toggle label="Floating bubbles"
        checked={bubbles} onChange={onBubbles} /></section></div>
    <section className="settings-card shape-ai-settings"><h2>Shape Challenge AI</h2>
      <p>Shape Challenge always works with local shape recognition. A local development proxy can also use the Hugging Face model.</p>
      <p role="status">{isShapeAIConfigured() ? 'Shape proxy address configured; local recognition is always available.'
        : 'Local shape recognition ready. Model access needs an approved HTTPS proxy.'}</p>
    </section>
    <section className="settings-note"><h2>About this website</h2><p>This is a separate JimmyIt playspace for computers. It shares the games and
      scoring rules with the app, while its keyboard and mouse controls live only here. Scores saved in this browser do not
      automatically appear in the phone app.</p></section></>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked}
    onChange={(event) => onChange(event.target.checked)} /><span className="toggle-track" aria-hidden="true" /></label>;
}

function GameTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="game-title"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>;
}

const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const SPARK_COLORS = ['var(--yellow)', 'var(--coral)', 'var(--mint)', 'var(--purple)'];

/**
 * The running score at the top of a game, as in the phone app's GameScoreBar: score moments celebrate here, in place,
 * so play is never interrupted. The number pops, sparks fly off it once, and a chip says what happened.
 */
function ScoreBar({ score }: { score: number }) {
  const live = useCelebration();
  const celebration = live && live.event.source === 'app' && live.kind !== 'bestAtEnd' ? live : null;
  const [burst, setBurst] = useState(0);
  useEffect(() => { if (celebration) setBurst((count) => count + 1); }, [celebration]);
  const big = celebration?.kind === 'newBest';
  return <div className={`score-bar${celebration ? ' celebrating' : ''}${big ? ' big' : ''}`} role="group" aria-label="Score">
    <span className="score-bar-label">SCORE</span>
    <span className="score-bar-value" key={burst}>
      <strong aria-live="polite">{score}</strong>
      {celebration && SPARK_ANGLES.map((angle, i) => <i key={angle} className="score-spark" aria-hidden="true"
        style={{ '--angle': `${angle}deg`, '--reach': `${(big ? 46 : 34) + (i % 2) * 10}px`,
          '--spark': SPARK_COLORS[i % SPARK_COLORS.length] } as CSSProperties} />)}
    </span>
    {celebration && <span className="score-chip" key={`chip${burst}`} aria-live="polite">
      {big ? '★ New best!' : `${celebration.event.value} points!`}</span>}
  </div>;
}

/** Score moments from games the toy plays by itself; app games celebrate in their ScoreBar instead. */
function Celebration() {
  const celebration = useCelebration();
  if (!celebration || celebration.event.source !== 'toy') return null;
  const { event } = celebration;
  return <div className="celebration" role="status">
    {celebration.kind === 'milestone' ? `${event.value} points on Jimmy!` : `New high score on Jimmy: ${event.score}!`}</div>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing web root');
createRoot(root).render(<StrictMode><App /></StrictMode>);
