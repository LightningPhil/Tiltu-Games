import {isPortGame} from './arcade-ports/store.ts';
import {PLUS_CARD_GAMES,PLUS_PUZZLES} from './club-plus/meta.ts';
import {PlusController} from './club-plus/controller.ts';
import {isPlus} from './club-plus/store.ts';
import {plusGraphic} from './club-plus-art.ts';
import { CollectionController, collectionRoute, isCollectionGame } from './collection/controller.ts';
import { GAME_NAMES, GAME_DESCRIPTIONS, GAME_CATEGORY, CATEGORIES } from './catalog.ts';
import type { Category } from './catalog.ts';
import type { PatienceVariant } from './collection/patience-collection.ts';
import { collectionGraphic } from './collection-art.ts';
import { patiencePicker } from './collection/view.ts';
import './style.css';
import './visuals.css';
import './collection/collection.css';
import './club-plus/plus.css';
import { BoardArtwork, sudokuBoxTint, sudokuFinishedRows } from './board-art.ts';
import { chessGraphic, clubMark, discEmblem, gameGraphic } from './graphics.ts';
import { explainFour } from './four-guide.ts';
import { openMatchReview } from './match-review.ts';
import GameWorker from './ai-worker.ts?worker&inline';
import { chooseMove, LEVELS } from './ai.ts';
import type { AIResult } from './ai.ts';
import { applyMove, draughtsMoves, dropRow, fourLine, legalMoves, moveLabel, other, squareName } from './rules.ts';
import type { Board, DraughtsMove, DuelGame, Move, Player } from './rules.ts';
import { autoNotes, boxShape, candidates, cellGuide, conflicts, findHint, generatePuzzle, newSudoku, peers, setValue, sudokuSolved, symbol, undoSudoku } from './sudoku.ts';
import type { Hint, Puzzle, SudokuSize } from './sudoku.ts';
import { GAMES, loadState, newDuel, saveState, THEMES, undoDuel, updateResult } from './state.ts';
import type { DuelSession, Game, MatchGame, MatchOptions, Theme } from './state.ts';
import { BoardMotion, draughtsMotion, MOTION } from './movement.ts';
import type { MotionSpeed, MotionStep } from './movement.ts';
import { chessEngine, chessIndex, chessPlayer, chessSquare, chooseChessMove, CHESS_LEVELS, newChess, playChess, undoChess, PIECE_NAMES } from './chess.ts';
import type { ChessAIResult, ChessMove, ChessSession, PieceSymbol } from './chess.ts';
import { chooseGoMove, finishGo, goCoordinate, goGroup, goPositions, GO_LEVELS, newGo, placeGo, playGo, resumeGo, scoreGo, toggleDead, undoGo } from './go.ts';
import type { GoAIResult, GoSession, GoSize } from './go.ts';
import { advancedRules, chessArena, goArena } from './advanced-view.ts';
import { actBlackjack, dealBlackjack, newBlackjack, stepBlackjackDealer } from './blackjack.ts';
import { explainPatienceMove, canMovePatience, drawPatience, movePatience, newPatience, patienceHint, patienceMoves, patienceWon, safeFoundation, sourceCards, undoPatience } from './patience.ts';
import type { CardSource, CardTarget, DrawCount, PatienceMove } from './patience.ts';
import { blackjackPage, decodeSource, decodeTarget, encodeSource, patiencePage } from './card-view.ts';
import { CardMotion } from './card-motion.ts';
import { suit } from './cards.ts';
import { ArcadeController, isArcade } from './arcade.ts';
import {ActionArcadeController,actionGraphic} from './action-arcade.ts';
import {isActionGame} from './action-games.ts';
import './action-arcade.css';
import { CountingTutor, PokerRoom, coachPanel, openCoachLesson } from './learning.ts';
import { explainChessMove, explainDraughtsMove } from './coach.ts';
import type { MoveAdvice } from './coach.ts';
import type { MineLevel } from './minesweeper.ts';
import type { LifeMode } from './life.ts';
import type { TetraSize } from './tetravex.ts';
import type { SkiMode } from './ski.ts';
import type { PokerVariant } from './poker.ts';
import { newCountDrill } from './counting.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
const state = loadState();
const requestedPort = new URLSearchParams(location.search).get('game');
if(requestedPort&&isPortGame(requestedPort))state.preferences.game=requestedPort;
const boardArtwork = new BoardArtwork();
const collection = new CollectionController(app, state, () => { persist(); render(); }, showDialog);
const plus = new PlusController(app, state, () => { persist(); render(); }, showDialog);
const names = GAME_NAMES;
let lobbyCategory: Category = 'All games';
let lobbySearch = '';
const matchesLobby = (g: Game) => (names[g]+' '+GAME_DESCRIPTIONS[g]).toLowerCase().includes(lobbySearch.trim().toLowerCase());
const themeNames: Record<Theme, string> = { tron: 'Neon Grid', pulse: 'Neon Pulse', classic: 'Classic', midnight: 'Midnight', woodland: 'Woodland' };
const sudokuLevels = ['Easy', 'Medium', 'Hard', 'Expert'];
let selected: number | null = null;
let draughtsFlipped: boolean | null = null;
let fourHint: number | null = null;
let fourFocus = 3;
let fourPending: number | null = null;
const largeBoards: Record<MatchGame, boolean> = { four: false, draughts: false, chess: false, go: false };
let jumpPath: number[] = [];
let focusSquare = 40;
let message = '';
let checked: number[] = [];
let pendingHint: Hint | null = null;
let sudokuDigit = 1;
let worker: Worker | null = null;
let workId = 0;
let busy: Game | null = null;
let storageOK = true;
let timerStart = performance.now();
const motion = new BoardMotion();
let moving = false;
let motionRevision = 0;
let chessSelected: number | null = null;
let chessFlipped: boolean | null = null;
let showChessThreats = false;
let goInspectMode = false, goInspect: number | null = null;
let pendingGo: number | null = null, showGoAtari = false;
let chessFocus = state.chess.options.mode === 'computer' && state.chess.options.human === -1 ? 12 : 52;
let goFocus = Math.floor(state.go.board.length / 2);
const cardMotion = new CardMotion();
let cardBusy = false, cardRevision = 0, dealerRunning = false, autoFoundations = false;
let patienceSelected: CardSource | null = null, cardHint: PatienceMove | null = null;
let lastCardClick = { source: '', time: 0 };
let pointerDrag: { from: CardSource; pointer: number; target: HTMLElement; x: number; y: number; ghost: HTMLElement | null; originals: HTMLElement[] } | null = null;
let suppressCardClickUntil = 0;
let pendingCardPositions: ReturnType<CardMotion['capture']> | null = null;
const isMatch = (game: Game): game is MatchGame => ['four', 'draughts', 'chess', 'go'].includes(game);
const arcade = new ArcadeController(app, state, () => { persist(); render(); });
const actionArcade = new ActionArcadeController(app,state,()=>{persist();render();},()=>{persist();return storageOK;});
const countingTutor = new CountingTutor(app, state, () => { persist(); render(); });
const pokerRoom = new PokerRoom(app, state, () => { persist(); render(); });
let tutorAdvice: MoveAdvice | null = null, tutorThinking = false, tutorRevision = 0;
let tutorWorker: Worker | null = null;
function clearTutor(): void { tutorRevision++; tutorWorker?.terminate(); tutorWorker = null; tutorAdvice = null; tutorThinking = false; }
function suggestFour():void {
  if(tutorThinking||!hasHumanTurn('four'))return;
  clearTutor();tutorThinking=true;const revision=tutorRevision,s=state.four;
  const finish=(result:AIResult)=>{if(revision!==tutorRevision)return;tutorWorker?.terminate();tutorWorker=null;tutorThinking=false;if(typeof result.move==='number'&&legalMoves('four',s.board,s.turn).includes(result.move)){fourHint=result.move;message=explainFour(s.board,s.turn,result.move).text;}render();};
  let fallbackStarted=false;const fallback=()=>{if(fallbackStarted)return;fallbackStarted=true;tutorWorker?.terminate();setTimeout(()=>{if(revision===tutorRevision)finish(chooseMove('four',s.board,s.turn,5));},25);};
  try{tutorWorker=new GameWorker();tutorWorker.onmessage=e=>e.data.error?fallback():finish(e.data.result);tutorWorker.onerror=e=>{e.preventDefault();fallback();};tutorWorker.postMessage({type:'ai',game:'four',board:s.board.slice(),player:s.turn,level:5});}catch{fallback();}
  message='Tutor is comparing columns…';render();
}
function tutorAction(action: string): void {
  const game = state.preferences.game;
  if (game !== 'chess' && game !== 'draughts') return;
  if (action === 'toggle') { const key = game === 'chess' ? 'tutorChess' : 'tutorDraughts'; state.preferences[key] = !state.preferences[key]; persist(); render(); return; }
  if (action === 'lesson') { openCoachLesson(state, game, persist); return; }
  if (action === 'preview' && tutorAdvice && !moving && (game === 'chess' ? advancedHumanTurn('chess') : hasHumanTurn('draughts'))) { const move = game === 'chess' ? tutorAdvice.chess : tutorAdvice.draughts; if (move) openMatchReview(state, game, scheduleComputer, move); return; }
  if (action === 'show' && tutorAdvice) {
    if (game === 'chess' && tutorAdvice.chess && advancedHumanTurn('chess')) { const engine = chessEngine(state.chess), m = engine.moves({ verbose: true }).find(m => m.san === tutorAdvice!.chess); if (m) clickChess(chessIndex(m.from)); }
    if (game === 'draughts' && tutorAdvice.draughts && hasHumanTurn('draughts')) clickDraughts(tutorAdvice.draughts.from);
    return;
  }
  if (action !== 'suggest' || tutorThinking || !(game === 'chess' ? advancedHumanTurn('chess') : hasHumanTurn('draughts'))) return;
  clearTutor(); tutorThinking = true; const revision = tutorRevision;
  const job = game === 'chess' ? { type: 'chess', session: structuredClone(state.chess), level: 5 } : { type: 'ai', game: 'draughts', board: state.draughts.board.slice(), player: state.draughts.turn, level: 5 };
  const finish = (value: ChessAIResult | AIResult) => {
    if (revision !== tutorRevision) return;
    tutorWorker?.terminate(); tutorWorker = null; tutorThinking = false;
    if (game === 'chess' && (value as ChessAIResult).move) tutorAdvice = explainChessMove(state.chess, (value as ChessAIResult).move!);
    if (game === 'draughts' && (value as AIResult).move) tutorAdvice = explainDraughtsMove(state.draughts, (value as AIResult).move as DraughtsMove);
    render();
  };
  let fallbackStarted = false;
  const fallback = () => { if (fallbackStarted) return; fallbackStarted = true; tutorWorker?.terminate(); setTimeout(() => { if (revision === tutorRevision) finish(game === 'chess' ? chooseChessMove(state.chess, 5) : chooseMove('draughts', state.draughts.board, state.draughts.turn, 5)); }, 25); };
  try { tutorWorker = new GameWorker(); tutorWorker.onmessage = e => e.data.error ? fallback() : finish(e.data.result); tutorWorker.onerror = e => { e.preventDefault(); fallback(); }; tutorWorker.postMessage(job); } catch { fallback(); }
  render();
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
const playerMark = (player: Player) => player === 1 ? '○' : '◇';
const playerName = (s: { options: MatchOptions }, player: Player) => s.options.mode === 'computer' ? player === s.options.human ? 'You' : 'Computer' : player === 1 ? 'Player 1' : 'Player 2';
function gameProgress(game: Game): boolean {
  if(isActionGame(game))return !!state.actionArcade[game]?.elapsed;
  if (isPlus(game)) return state.plus[game] !== null;
  if (isCollectionGame(game)) return state.collection[game] !== null;
  if (isMatch(game)) return state[game].moves.length > 0;
  if (game === 'sudoku') return state.sudoku !== null;
  if (game === 'blackjack') return state.blackjack.rounds > 0;
  if (game === 'patience') return state.patience !== null || state.collection.freecell !== null || state.collection.spider !== null;
  if (game === 'poker') return state.poker.handNo > 0;
  if (game === 'mines') return !!state.mines && state.mines.status !== 'ready';
  if (game === 'life') return state.life !== null;
  if (game === 'ski') return !!state.ski?.elapsed;
  if (game === 'tetravex') return !!state.tetravex?.moves;
  return false;
}
function persist(): void { storageOK = saveState(state); }
function cancelMotion(): void {
  motionRevision++; motion.cancel(); moving = false;
  cardRevision++; cardMotion.cancel(); cardBusy = false; dealerRunning = false; autoFoundations = false;
  clearCardDrag(); pendingCardPositions = null;
  app.querySelector('.card-table')?.removeAttribute('aria-busy');
}
async function animateBoard(game: MatchGame, steps: MotionStep[], detail: string, newPiece?: string): Promise<void> {
  const board = app.querySelector<HTMLElement>('#board');
  if (!board) { render(); scheduleComputer(); return; }
  const id = ++motionRevision;
  moving = true;
  const undoButton = app.querySelector<HTMLButtonElement>('#undo');
  if (undoButton) undoButton.disabled = !canUndoMatch(game);
  const statusTitle = app.querySelector('.status-card h2'), statusDetail = app.querySelector('.status-card p');
  if (statusTitle) statusTitle.textContent = 'Move in progress…';
  if (statusDetail) statusDetail.textContent = detail;
  const selector = (i: number) => game === 'four' ? `[data-slot="${i}"]` : game === 'draughts' ? `[data-square="${i}"]` : game === 'chess' ? `[data-chess-square="${i}"]` : `[data-point="${i}"]`;
  const progress = (event: Event) => { const { index, total } = (event as CustomEvent<{ index: number; total: number }>).detail; if (statusTitle && game === 'draughts' && total > 1) statusTitle.textContent = `Jump ${index} of ${total}…`; };
  board.addEventListener('motionstep', progress);
  await motion.play(board, steps, state.preferences.motion, selector, newPiece);
  board.removeEventListener('motionstep', progress);
  if (id !== motionRevision) return;
  moving = false;
  if (game === 'chess' && state.chess.options.mode === 'computer') {
    const engine = chessEngine(state.chess);
    if (chessPlayer(engine) === state.chess.options.human) {
      const next = engine.moves({ verbose: true })[0];
      if (next) chessFocus = chessIndex(next.from);
    }
  }
  if (game === 'go' && state.go.phase === 'play' && state.go.board[goFocus]) {
    const next = state.go.board.findIndex((n, i) => !n && i >= goFocus);
    goFocus = next < 0 ? Math.max(0, state.go.board.indexOf(0)) : next;
  }
  render(); scheduleComputer();
}

function cancelWork(): void {
  workId++;
  worker?.terminate(); worker = null; busy = null;
}
type Job = { type: 'ai'; game: DuelGame; board: Board; player: Player; level: number } | { type: 'puzzle'; size: SudokuSize; difficulty: number } | { type: 'chess'; session: ChessSession; level: number } | { type: 'go'; session: GoSession; level: number };
type JobResult = AIResult | Puzzle | ChessAIResult | GoAIResult;
function runJob(job: Job, done: (value: JobResult) => void): void {
  cancelWork();
  const id = workId;
  busy = job.type === 'ai' ? job.game : job.type === 'puzzle' ? 'sudoku' : job.type;
  const finish = (result: JobResult) => {
    if (id !== workId) return;
    workId++;
    worker?.terminate(); worker = null; busy = null;
    done(result);
  };
  let fallbackScheduled = false;
  const fallback = () => {
    if (fallbackScheduled || id !== workId) return;
    fallbackScheduled = true;
    worker?.terminate(); worker = null;
    setTimeout(() => {
      if (id !== workId) return;
      finish(job.type === 'ai' ? chooseMove(job.game, job.board, job.player, job.level) : job.type === 'chess' ? chooseChessMove(job.session, job.level) : job.type === 'go' ? chooseGoMove(job.session, job.level) : generatePuzzle(job.size, job.difficulty));
    }, 30);
  };
  try {
    worker = new GameWorker();
    worker.onmessage = event => event.data.error ? fallback() : finish(event.data.result);
    worker.onerror = event => { event.preventDefault(); fallback(); };
    worker.postMessage(job);
  } catch { fallback(); }
}

function hasHumanTurn(game: DuelGame): boolean {
  const s = state[game];
  return !moving && s.result === null && busy !== game && (s.options.mode === 'local' || s.turn === s.options.human);
}

function scheduleComputer(): void {
  const game = state.preferences.game;
  if (game === 'blackjack') { void scheduleDealer(); return; }
  if (moving || !isMatch(game)) return;
  const s = state[game];
  const turn = game === 'chess' ? chessPlayer(chessEngine(state.chess)) : state[game].turn;
  if (busy || s.result !== null || (game === 'go' && state.go.phase !== 'play') || s.options.mode !== 'computer' || turn === s.options.human) return;
  const started = performance.now();
  const job: Job = game === 'chess' ? { type: 'chess', session: state.chess, level: s.options.level }
    : game === 'go' ? { type: 'go', session: state.go, level: s.options.level }
    : { type: 'ai', game, board: state[game].board.slice(), player: turn, level: s.options.level };
  runJob(job, async value => {
    const id = workId;
    busy = game; render();
    await new Promise(resolve => setTimeout(resolve, Math.max(0, MOTION[state.preferences.motion].reply - (performance.now() - started))));
    if (id !== workId || state.preferences.game !== game) return;
    busy = null;
    if (game === 'chess') {
      const answer = value as ChessAIResult;
      if (answer.move && chessEngine(state.chess).moves().includes(answer.move)) commitChess(answer.move);
    } else if (game === 'go') commitGo((value as GoAIResult).move);
    else {
      const answer = value as AIResult, current = state[game];
      const legal = legalMoves(game, current.board, current.turn).find(m => JSON.stringify(m) === JSON.stringify(answer.move));
      if (legal !== undefined) commitMove(game, legal);
      else { message = 'Could not choose a move. Use Undo or start a new game.'; render(); }
    }
  });
  render();
}

function makePuzzle(): void {
  const { size, difficulty } = state.preferences;
  pendingHint = null; checked = []; message = '';
  runJob({ type: 'puzzle', size, difficulty }, value => {
    state.sudoku = newSudoku(value as Puzzle);
    sudokuDigit = Math.min(sudokuDigit, size);
    timerStart = performance.now();
    message = 'Your puzzle is ready. Select a cell to begin.';
    persist(); render();
  });
  render();
}

function changeGame(game: Game): void {
  const url=new URL(location.href);if(isPortGame(game))url.searchParams.set('game',game);else{url.searchParams.delete('game');url.searchParams.delete('route');url.searchParams.delete('map');}history.replaceState(null,'',url);
  fourPending = null;
  fourHint = null; fourPending = null; pendingGo = null; goInspect = null; goInspectMode = false;
  tickTimer(); cancelWork(); cancelMotion();
  actionArcade.leave(); arcade.leave(); collection.leave(); plus.leave(); countingTutor.leave(); pokerRoom.leave(); clearTutor();
  selected = null; jumpPath = []; chessSelected = null; pendingHint = null; checked = []; message = '';
  state.preferences.game = game;
  patienceSelected = null; cardHint = null; lastCardClick = { source: '', time: 0 };
  if (game === 'patience' && !state.patience) state.patience = newPatience(state.preferences.patienceDraw);
  if (isArcade(game)) arcade.ensure(game);
  if (isActionGame(game)) actionArcade.ensure(game);
  const route = collectionRoute(state); if (route) collection.ensure(route);
  timerStart = performance.now();
  persist(); render();
  window.scrollTo(0, 0);
  if (game === 'sudoku' && !state.sudoku) makePuzzle();
  else scheduleComputer();
  document.querySelector<HTMLElement>('#page-title')?.focus();
}

async function updateCards(action: () => boolean, schedule = true): Promise<boolean> {
  if (cardBusy) return false;
  const before = pendingCardPositions ?? cardMotion.capture(app), revision = cardRevision;
  pendingCardPositions = null;
  if (!action()) return false;
  persist(); render(); cardBusy = true;
  const table = app.querySelector<HTMLElement>('.card-table');
  table?.setAttribute('aria-busy', 'true');
  await cardMotion.play(app, before, state.preferences.motion);
  if (revision !== cardRevision) return false;
  cardBusy = false; table?.removeAttribute('aria-busy');
  render();
  if (schedule) scheduleComputer();
  return true;
}
async function scheduleDealer(): Promise<void> {
  if (dealerRunning || cardBusy || state.preferences.game !== 'blackjack' || state.blackjack.phase !== 'dealer') return;
  dealerRunning = true;
  const revision = cardRevision;
  while (revision === cardRevision && state.preferences.game === 'blackjack' && state.blackjack.phase === 'dealer') {
    await new Promise(resolve => setTimeout(resolve, MOTION[state.preferences.motion].reply));
    if (revision !== cardRevision || state.preferences.game !== 'blackjack') return;
    await updateCards(() => stepBlackjackDealer(state.blackjack), false);
  }
  if (revision === cardRevision) dealerRunning = false;
}
async function blackjackAction(action: string): Promise<void> {
  if (state.preferences.game !== 'blackjack' || cardBusy) return;
  message = '';
  if (action === 'deal') { await updateCards(() => dealBlackjack(state.blackjack)); return; }
  if (action === 'refill' && ['betting', 'settled'].includes(state.blackjack.phase) && state.blackjack.bank < 5) {
    state.blackjack.bank = 1000; state.blackjack.bet = 25; message = 'Your practice chips are back to 1,000.'; persist(); render(); return;
  }
  if (action === 'hit' || action === 'stand' || action === 'double' || action === 'split') await updateCards(() => actBlackjack(state.blackjack, action));
}
async function autoPatience(): Promise<void> {
  if (!state.patience || cardBusy || autoFoundations) return;
  autoFoundations = true; patienceSelected = null; cardHint = null; message = '';
  const revision = cardRevision;
  while (revision === cardRevision && state.preferences.game === 'patience') {
    const s = state.patience, next = patienceMoves(s).find(m => safeFoundation(s, m));
    if (!next) break;
    await updateCards(() => movePatience(s, next.from, next.to), false);
    if (revision !== cardRevision) return;
    await new Promise(resolve => setTimeout(resolve, MOTION[state.preferences.motion].landing));
  }
  if (revision === cardRevision) { autoFoundations = false; render(); }
}
async function patienceAction(action: string): Promise<void> {
  const s = state.patience;
  if (state.preferences.game !== 'patience' || !s) return;
  if (action === 'undo') { undo(); return; }
  if (action === 'new') { confirmNew(); return; }
  if (action === 'stop' && autoFoundations) { cancelMotion(); message = 'Automatic moves stopped. You can carry on or undo each card.'; persist(); render(); return; }
  if (cardBusy || autoFoundations || (patienceWon(s) && action !== 'restart')) return;
  if (action === 'restart') {
    const restart = () => { cancelMotion(); patienceSelected = null; cardHint = null; message = 'Same cards. A fresh start.'; void updateCards(() => { state.patience = newPatience(s.draw, s.deck); return true; }); };
    if (s.moves > 0) showDialog('Restart this deal?', 'The same cards will be dealt again, with the score and undo history reset.', 'Restart deal', restart); else restart();
    return;
  }
  if (action === 'draw') { patienceSelected = null; cardHint = null; message = ''; await updateCards(() => drawPatience(s)); return; }
  if (action === 'auto') { await autoPatience(); return; }
  if (action === 'deselect') { patienceSelected = null; cardHint = null; message = ''; render(); return; }
  if (action.startsWith('move:') && patienceSelected) { const target = decodeTarget(action.slice(5)); if (target) moveSelectedCards(patienceSelected, target); return; }
  if (action === 'hint') {
    cardHint = patienceHint(s); patienceSelected = cardHint?.from ?? null;
    message = cardHint ? explainPatienceMove(s, cardHint) : (s.stock.length ? 'Draw from the stock to see another card.' : s.waste.length ? 'Recycle the waste to look through the stock again. If you are going in circles, try undo or a new deal.' : 'No useful new move was found. Try undo, restart this deal or deal again.');
    render();
  }
}
function moveSelectedCards(from: CardSource, to: CardTarget): void {
  const s = state.patience;
  if (!s || cardBusy || autoFoundations || !canMovePatience(s, from, to)) return;
  patienceSelected = null; cardHint = null; message = ''; lastCardClick.source = '';
  void updateCards(() => movePatience(s, from, to));
}
function clickPatience(button: HTMLElement, detail: number): void {
  const s = state.patience;
  if (state.preferences.game !== 'patience' || !s || patienceWon(s) || cardBusy || autoFoundations || performance.now() < suppressCardClickUntil) return;
  const to = decodeTarget(button.closest<HTMLElement>('[data-card-target]')?.dataset.cardTarget ?? '');
  const from = decodeSource(button.dataset.cardSource ?? '');
  if (from && (detail === 2 || (lastCardClick.source === encodeSource(from) && performance.now() - lastCardClick.time < 360))) {
    const cards = sourceCards(s, from), foundation: CardTarget = { pile: 'foundation', index: suit(cards[0] ?? 0) };
    if (cards.length === 1 && canMovePatience(s, from, foundation)) { moveSelectedCards(from, foundation); return; }
  }
  if (patienceSelected && to && canMovePatience(s, patienceSelected, to)) { moveSelectedCards(patienceSelected, to); return; }
  if (from) {
    lastCardClick = { source: encodeSource(from), time: performance.now() };
    patienceSelected = patienceSelected && encodeSource(patienceSelected) === encodeSource(from) ? null : from;
    cardHint = null; message = ''; render();
  } else if (patienceSelected) { message = 'That move does not fit. Use a glowing destination: alternate colours and descend by one.'; render(); }
}

function commitMove(game: DuelGame, move: Move): void {
  fourPending = null;
  fourHint = null;
  clearTutor();
  const s = state[game];
  if (s.result !== null) return;
  const steps = game === 'four' ? [{ from: null, to: dropRow(s.board, move as number) * 7 + (move as number), captures: [] }] : draughtsMotion(move as DraughtsMove, jumpPath.length);
  const player = s.turn;
  s.history.push({ board: s.board.slice(), turn: s.turn, quiet: s.quiet });
  s.moves.push({ player: s.turn, text: moveLabel(game, move) });
  if (game === 'draughts') {
    const m = move as DraughtsMove;
    s.quiet = m.captures.length || Math.abs(s.board[m.from]) === 1 ? 0 : s.quiet + 1;
    focusSquare = m.path.at(-1)!;
  }
  s.board = applyMove(game, s.board, s.turn, move);
  s.turn = other(s.turn);
  selected = null; jumpPath = []; message = '';
  updateResult(game, s);
  persist();
  void animateBoard(game, steps, `${playerName(s, player)}: ${moveLabel(game, move)}`, game === 'four' ? `<span class="disc p${player === 1 ? '1' : '2'}"><span class="piece-mark">${discEmblem(player)}</span></span>` : undefined);
}

function clickFour(col: number): void {
  if (!hasHumanTurn('four')) return;
  if (dropRow(state.four.board, col) < 0) { message = 'That column is full. Choose another.'; render(); return; }
  if (state.preferences.fourConfirm && fourPending !== col) { fourPending = col; message = `Column ${col + 1} is ready. Tap it again or choose Drop disc to commit.`; render(); return; }
  commitMove('four', col);
}

function clickDraughts(index: number): void {
  if (!hasHumanTurn('draughts')) return;
  const s = state.draughts, moves = draughtsMoves(s.board, s.turn);
  if (selected !== null) {
    const matches = moves.filter(m => m.from === selected && jumpPath.every((p, i) => m.path[i] === p) && m.path[jumpPath.length] === index);
    if (matches.length) {
      const complete = matches.find(m => m.path.length === jumpPath.length + 1);
      if (complete) { commitMove('draughts', complete); return; }
      const from = jumpPath.at(-1) ?? selected;
      const capture = matches[0].captures[jumpPath.length];
      jumpPath.push(index);
      message = 'Continue the capture with this piece. Choose the next marked square.';
      focusSquare = index;
      void animateBoard('draughts', [{ from, to: index, captures: capture === undefined ? [] : [capture] }], `${squareName(from)} × ${squareName(index)} · continue with this piece`); return;
    }
  }
  if (jumpPath.length) { message = 'Complete the capture, or use Undo to cancel this move.'; render(); return; }
  if (s.board[index] * s.turn > 0) {
    if (!moves.some(m => m.from === index)) {
      message = moves[0]?.captures.length ? 'A capture is compulsory. Choose a ringed piece.' : 'That piece has no legal moves.';
      render(); return;
    }
    selected = selected === index ? null : index;
    focusSquare = index;
    message = selected === null ? '' : moves[0]?.captures.length ? 'Choose a marked square to capture.' : 'Choose a marked square to move.';
    render();
  } else if (selected !== null) {
    message = 'That is not a legal landing. Your piece stays selected; choose a marked square.';
    render();
  }
}

function advancedHumanTurn(game: 'chess' | 'go'): boolean {
  const s = state[game], turn = game === 'chess' ? chessPlayer(chessEngine(state.chess)) : state.go.turn;
  return !moving && busy !== game && s.result === null && (game !== 'go' || state.go.phase === 'play') && (s.options.mode === 'local' || turn === s.options.human);
}
function commitChess(input: string | { from: string; to: string; promotion?: string }): void {
  clearTutor();
  const s = state.chess, actor = chessPlayer(chessEngine(s)), played = playChess(s, input);
  const captures = played.isEnPassant() ? [chessIndex(played.to) + (played.color === 'w' ? 8 : -8)] : played.captured ? [chessIndex(played.to)] : [];
  const step: MotionStep = { from: chessIndex(played.from), to: chessIndex(played.to), captures };
  if (played.isKingsideCastle()) step.second = { from: played.color === 'w' ? 63 : 7, to: played.color === 'w' ? 61 : 5 };
  if (played.isQueensideCastle()) step.second = { from: played.color === 'w' ? 56 : 0, to: played.color === 'w' ? 59 : 3 };
  chessSelected = null; chessFocus = chessIndex(played.to); message = ''; persist();
  void animateBoard('chess', [step], `${playerName(s, actor)}: ${played.san}${played.promotion ? ` · promotes to ${PIECE_NAMES[played.promotion]}` : ''}`);
}
function promotion(from: number, to: number): void {
  const dialog = document.createElement('dialog'); dialog.className = 'confirm-dialog promotion-dialog';
  dialog.innerHTML = `<p class="eyebrow">PAWN PROMOTION</p><h2>Choose a new piece.</h2><div class="promotion-options">${(['q', 'r', 'b', 'n'] as PieceSymbol[]).map(p => `<button class="button" data-promote="${p}"><span class="chess-${chessEngine(state.chess).turn() === 'w' ? 'white' : 'black'}" aria-hidden="true">${chessGraphic(p)}</span>${PIECE_NAMES[p]}</button>`).join('')}</div><button class="button wide" data-cancel>Cancel</button>`;
  document.body.append(dialog);
  dialog.addEventListener('close', () => { dialog.remove(); app.querySelector<HTMLElement>(`[data-chess-square="${from}"]`)?.focus(); });
  dialog.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close());
  dialog.querySelectorAll<HTMLButtonElement>('[data-promote]').forEach(b => b.addEventListener('click', () => { const choice = b.dataset.promote!; dialog.close(); if (state.preferences.game === 'chess' && advancedHumanTurn('chess')) commitChess({ from: chessSquare(from), to: chessSquare(to), promotion: choice }); }));
  dialog.showModal();
}
function clickChess(index: number): void {
  if (!advancedHumanTurn('chess')) return;
  const engine = chessEngine(state.chess);
  if (chessSelected !== null) {
    const legal = engine.moves({ square: chessSquare(chessSelected), verbose: true });
    const rookCastle = engine.get(chessSquare(chessSelected))?.type === 'k' && engine.get(chessSquare(index))?.type === 'r' && engine.get(chessSquare(index))?.color === engine.turn() ? legal.find(m => m.isKingsideCastle() ? index === chessIndex(m.from) + 3 : m.isQueensideCastle() && index === chessIndex(m.from) - 4) : undefined;
    const targets = rookCastle ? [rookCastle] : legal.filter(m => m.to === chessSquare(index));
    if (targets.length) {
      if (targets[0].promotion) promotion(chessSelected, index);
      else commitChess({ from: targets[0].from, to: targets[0].to });
      return;
    }
  }
  const piece = engine.get(chessSquare(index));
  if (piece && piece.color === engine.turn()) {
    chessSelected = chessSelected === index ? null : index; chessFocus = index;
    message = engine.moves({ square: chessSquare(index) }).length ? 'Choose a marked destination.' : 'That piece has no legal moves.';
  } else if (chessSelected !== null) { message = engine.isCheck() ? 'That move does not get your king out of check. Choose one of the marked destinations.' : 'That square is not a legal destination. Your selected piece is still highlighted.'; }
  else { message = `Choose a ${engine.turn() === 'w' ? 'White' : 'Black'} piece to see its legal moves.`; }
  render();
}
function commitGo(point: number | null): void {
  pendingGo = null;
  goInspectMode = false; goInspect = null;
  const s = state.go, actor = s.turn, played = playGo(s, point);
  if (played.error) { message = played.error; render(); return; }
  message = point === null ? `${actor === 1 ? 'Black' : 'White'} passed.` : '';
  persist();
  if (point === null) { render(); scheduleComputer(); return; }
  goFocus = point;
  void animateBoard('go', [{ from: null, to: point, captures: played.captured }], `${playerName(s, actor)}: ${goCoordinate(point, s.size)}${played.captured.length ? ` · captures ${played.captured.length} stone${played.captured.length === 1 ? '' : 's'}` : ''}`, `<span class="go-stone ${actor === 1 ? 'black-stone' : 'white-stone'}"></span>`);
}
function clickGo(index: number): void {
  if (moving) return;
  if (goInspectMode) {
    goInspect = state.go.board[index] ? index : null; goFocus = index;
    const group = goInspect === null ? null : goGroup(state.go.board, state.go.size, index);
    message = group ? `${state.go.board[index] === 1 ? 'Black' : 'White'} group: ${group.stones.length} stone${group.stones.length === 1 ? '' : 's'}, ${group.liberties.length} libert${group.liberties.length === 1 ? 'y' : 'ies'}.${group.liberties.length === 1 ? ' In atari: one liberty left.' : ''} Outlined empty points are its liberties.` : 'Inspect mode: select a stone. Exit the inspector to return to the game controls.';
    render(); return;
  }
  if (state.go.phase === 'score' && state.go.result === null) { toggleDead(state.go, index); goFocus = index; persist(); render(); }
  else if (advancedHumanTurn('go')) {
    if (state.preferences.goConfirm && pendingGo !== index) {
      const s = state.go, preview = placeGo(s.board, s.size, s.turn, index, goPositions(s));
      if (preview.error) { message = preview.error; render(); return; }
      pendingGo = index; goFocus = index; message = `${goCoordinate(index, s.size)} is ready. Tap again or choose Place stone.`; render();
    } else commitGo(index);
  }
}

function undo(): void {
  if (isPlus(state.preferences.game)) { plus.action('undo'); return; }
  if (collectionRoute(state)) { collection.action('undo'); return; }
  fourHint = null; fourPending = null; pendingGo = null; goInspect = null;
  const game = state.preferences.game;
  clearTutor();
  if (isArcade(game)) { arcade.action('undo'); return; }
  if (game === 'patience' && state.patience) {
    cancelMotion(); patienceSelected = null; cardHint = null; lastCardClick.source = '';
    if (!state.patience.history.length) { message = 'No move to undo yet.'; render(); return; }
    message = 'Move taken back.';
    void updateCards(() => undoPatience(state.patience!)); return;
  }
  if (game === 'four' || game === 'draughts') {
    cancelWork(); cancelMotion();
    if (jumpPath.length) { jumpPath = []; message = 'Capture cancelled.'; }
    else if (undoDuel(state[game])) { selected = null; message = 'Move taken back. Try another idea.'; }
    persist(); render(); scheduleComputer();
  } else if (game === 'chess' || game === 'go') {
    cancelWork(); cancelMotion(); chessSelected = null;
    if (game === 'chess' ? undoChess(state.chess) : undoGo(state.go)) message = 'Turn taken back.';
    persist(); render(); scheduleComputer();
  } else if (game === 'sudoku' && state.sudoku && busy !== 'sudoku') {
    if (undoSudoku(state.sudoku)) { message = 'Entry taken back.'; checked = []; pendingHint = null; }
    persist(); render();
  }
}

function enterNumber(n: number, note = state.preferences.notes): void {
  const s = state.sudoku;
  if (!s || busy === 'sudoku') return;
  if (s.puzzle[s.selected]) { message = 'This is a starting clue. Select an empty cell.'; render(); return; }
  if (setValue(s, s.selected, n, note)) {
    checked = []; pendingHint = null;
    message = sudokuSolved(s) ? `Puzzle complete in ${formatTime(s.elapsed)}. Nicely played!` : note && n ? 'Pencil mark updated.' : '';
    persist(); render(); app.querySelector<HTMLElement>(`[data-cell="${s.selected}"]`)?.focus({ preventScroll: true });
  } else { persist(); render(); }
}
function chooseSudokuNumber(n: number, note = state.preferences.notes): void {
  if (state.preferences.sudokuDigitFirst) { sudokuDigit = n; message = `Paint ${symbol(n)} · choose an editable cell${note ? ' to add or remove a note' : ''}.`; render(); app.querySelector<HTMLElement>(`[data-cell="${state.sudoku?.selected}"]`)?.focus({ preventScroll: true }); }
  else enterNumber(n, note);
}

function newGame(): void {
  if (isPlus(state.preferences.game)) { plus.action('new'); return; }
  if (collectionRoute(state)) { collection.action('new'); return; }
  fourHint = null; fourPending = null; pendingGo = null; goInspect = null; goInspectMode = false;
  tickTimer(); cancelWork(); cancelMotion();
  clearTutor();
  const game = state.preferences.game;
  if (isArcade(game)) { arcade.action('new'); return; }
  if (game === 'poker') { pokerRoom.action('new'); return; }
  selected = null; jumpPath = []; chessSelected = null; message = ''; checked = []; pendingHint = null;
  patienceSelected = null; cardHint = null;
  if (game === 'patience') { void updateCards(() => { state.patience = newPatience(state.preferences.patienceDraw); return true; }); return; }
  if (game === 'blackjack') state.blackjack = newBlackjack();
  if (game === 'sudoku') { makePuzzle(); return; }
  if (game === 'four' || game === 'draughts') {
    const previous = state[game], next = state.preferences[game];
    const samePlayers = previous.options.mode === next.mode && (next.mode === 'local' || (previous.options.human === next.human && previous.options.level === next.level));
    state[game] = newDuel(game, next, samePlayers ? previous.scores : [0, 0, 0]);
  }
  if (game === 'chess' || game === 'go') {
    const previous = state[game], next = state.preferences[game];
    const same = previous.options.mode === next.mode && previous.options.human === next.human && previous.options.level === next.level && (game !== 'go' || state.go.size === state.preferences.goSize);
    const scores: [number, number, number] = same ? previous.scores : [0, 0, 0];
    if (game === 'chess') { state.chess = newChess(next, scores); chessFocus = next.mode === 'computer' && next.human === -1 ? 12 : 52; }
    else { state.go = newGo(state.preferences.goSize, next, scores); goFocus = Math.floor(state.go.board.length / 2); }
  }
  persist(); render(); scheduleComputer();
}

function confirmNew(): void {
  if (isPlus(state.preferences.game)) { plus.action('new'); return; }
  if (collectionRoute(state)) { collection.action('new'); return; }
  const game = state.preferences.game;
  const inProgress = game === 'sudoku' ? state.sudoku && !sudokuSolved(state.sudoku) && state.sudoku.history.length > 0
    : game === 'patience' ? state.patience && !patienceWon(state.patience) && state.patience.moves > 0
    : game === 'blackjack' ? state.blackjack.phase === 'player' || state.blackjack.phase === 'dealer'
    : game === 'poker' ? state.poker.phase === 'betting' || state.poker.phase === 'draw'
    : isArcade(game) ? gameProgress(game)
    : isMatch(game) && state[game].result === null && state[game].moves.length > 0;
  if (inProgress) showDialog('Start a new game?', 'Your current game will be replaced. Your other games will keep their progress.', 'Start new game', newGame);
  else newGame();
}

function showDialog(title: string, description: string, button: string, action: () => void): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'confirm-dialog';
  dialog.innerHTML = `<p class="eyebrow">TILTU’S GAMES</p><h2>${escape(title)}</h2><p>${escape(description)}</p><div class="dialog-actions"><button class="button" data-cancel>Keep playing</button><button class="button primary" data-confirm>${escape(button)}</button></div>`;
  document.body.append(dialog);
  tickTimer();
  const previous = document.activeElement as HTMLElement;
  dialog.addEventListener('close', () => { dialog.remove(); timerStart = performance.now(); previous?.focus(); });
  dialog.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-confirm]')!.addEventListener('click', () => { dialog.close(); action(); });
  dialog.showModal();
}

function renderHeader(): string {
  const current = state.preferences.game;
  return `<header class="topbar"><button class="brand" data-game="home" aria-label="Tiltu’s Games home"><span class="brand-mark" aria-hidden="true">${clubMark()}</span><span>TILTU’S<span class="brand-light"> GAMES</span></span></button>
    <nav aria-label="Choose a game">${GAMES.map(g => `<button data-game="${g}" ${current === g ? 'aria-current="page"' : ''}>${names[g]}</button>`).join('')}</nav><label class="mobile-game-picker">Game<select id="game-select">${GAMES.map(g => `<option value="${g}" ${current === g ? 'selected' : ''}>${names[g]}</option>`).join('')}</select></label>
    <label class="theme-control"><span>Theme</span><select id="theme" aria-label="Theme">${THEMES.map(t => `<option value="${t}" ${state.preferences.theme === t ? 'selected' : ''}>${themeNames[t]}</option>`).join('')}</select></label>${current === 'ski' ? '<button class="button ski-setup-toggle" data-arcade="setup" aria-label="Setup and help">⚙</button>' : ''}</header>`;
}

function renderHome(): string {
  const visibleGames=GAMES.filter(g=>g!=='home'&&(lobbyCategory==='All games'||GAME_CATEGORY[g]===lobbyCategory)&&matchesLobby(g));
  return `<main class="lobby"><section class="lobby-intro"><div><p class="eyebrow"><span class="live-dot"></span> YOUR NEXT LITTLE CHALLENGE</p><h1 id="page-title" tabindex="-1">Good games.<br><span>Great company.</span></h1><p class="intro-copy">A quick match, a clever move, a moment to yourself.<br>${GAMES.length-1} games. Room to explore.</p></div><div class="hero-art" aria-hidden="true"><div class="art-grid">${Array.from({ length: 16 }, (_, i) => `<span class="${[0, 5, 10, 15].includes(i) ? 'art-piece' : i === 9 || i === 14 ? 'art-rival' : ''}">${i === 2 ? '3' : i === 7 ? '7' : i === 11 ? chessGraphic('q') : ''}</span>`).join('')}</div><span class="art-caption">MAKE YOUR MOVE</span></div></section>
    <div class="lobby-discovery"><div class="category-tabs" role="group" aria-label="Game categories">${CATEGORIES.map(c => `<button data-category="${c}" aria-pressed="${lobbyCategory===c}">${c}</button>`).join('')}</div><label class="game-search"><span class="visually-hidden">Find a game</span><input id="game-search" type="search" placeholder="Find your next game" value="${escape(lobbySearch)}"></label></div><p class="library-count" aria-live="polite">${visibleGames.length} game${visibleGames.length===1?'':'s'}${lobbyCategory==='Card games'?' · FreeCell and Spider live inside Patience':''}</p><section class="game-cards" aria-label="Games">
      ${visibleGames.map((g, i) => {
        const resume = gameProgress(g);
        const descriptions = GAME_DESCRIPTIONS;
        return `<button class="game-card" data-game="${g}"><span class="card-top"><span class="game-number">${String(i + 1).padStart(2, '0')}</span><span class="chip">${isMatch(g) || isPlus(g)&&!PLUS_CARD_GAMES.includes(g)&&!PLUS_PUZZLES.includes(g) || g==='memory' || ['noughts','reversi','dots','morris','kalah','backgammon'].includes(g) ? 'SOLO OR TWO PLAYERS' : g === 'life' ? 'SIMULATE OR COMPETE' : g === 'poker' ? 'THREE STYLES · TUTOR' : isPlus(g)&&PLUS_CARD_GAMES.includes(g)?'CLUB TABLE · ADVICE':'SOLO CLASSIC'}</span></span>${isActionGame(g)?actionGraphic(g):isPlus(g)?plusGraphic(g):isCollectionGame(g)?collectionGraphic(g):gameGraphic(g)}<h2>${names[g]}</h2><p>${descriptions[g]}</p><span class="card-link">${resume ? 'Return to game' : 'Let’s play'} <span aria-hidden="true">↗</span></span></button>`;
      }).join('')}${!visibleGames.length?'<p class="empty-library">No games found. Try a different search or choose another category.</p>':''}
    </section><div class="lobby-footer"><span><span class="live-dot"></span> Ready whenever you are</span><span>5 computer levels <b>·</b> 5 shared themes <b>·</b> Plays offline</span></div></main>`;
}

function renderDuelSettings(game: MatchGame): string {
  const pref = state.preferences[game], s = state[game];
  const changed = JSON.stringify(pref) !== JSON.stringify(s.options) || (game === 'go' && state.preferences.goSize !== state.go.size);
  const canUndo = canUndoMatch(game);
  const description = game === 'chess' ? CHESS_LEVELS[pref.level - 1].description : game === 'go' ? GO_LEVELS[pref.level - 1].description : LEVELS[pref.level - 1].description;
  const first = game === 'chess' ? 'White' : game === 'go' ? 'Black' : '○ Circle';
  const second = game === 'chess' ? 'Black' : game === 'go' ? 'White' : '◇ Diamond';
  return `<section class="settings-card"><p class="eyebrow">MAKE IT YOUR GAME</p><h2>Match setup</h2>
    <label>Opponent<select id="opponent"><option value="computer" ${pref.mode === 'computer' ? 'selected' : ''}>Play the computer</option><option value="local" ${pref.mode === 'local' ? 'selected' : ''}>Two players · same device</option></select></label>
    ${pref.mode === 'computer' ? `<label>Computer skill<select id="level">${LEVELS.map((l, i) => `<option value="${i + 1}" ${pref.level === i + 1 ? 'selected' : ''}>${i + 1} · ${l.name}</option>`).join('')}</select></label><div class="skill-meter" aria-hidden="true">${LEVELS.map((_, i) => `<span class="${i < pref.level ? 'filled' : ''}"></span>`).join('')}</div><p class="setting-help">${description}</p><label>Your pieces<select id="human"><option value="1" ${pref.human === 1 ? 'selected' : ''}>${first}${game === 'draughts' ? ' · bottom, moves up' : ''}</option><option value="-1" ${pref.human === -1 ? 'selected' : ''}>${second}${game === 'draughts' ? ' · top, moves down' : ''}</option></select></label>` : `<p class="setting-help">Take turns on this device. ${first} is Player 1; ${second} is Player 2.</p>`}
    ${game === 'chess' || game === 'go' ? `<p class="setting-help">${first} always moves first.${game === 'go' ? ' White receives 7.5 komi.' : ''}</p>` : `<label>First move<select id="starter"><option value="1" ${pref.starter === 1 ? 'selected' : ''}>○ Circle</option><option value="-1" ${pref.starter === -1 ? 'selected' : ''}>◇ Diamond</option></select></label>`}
    ${game === 'go' ? `<label>Board size<select id="go-size">${[9, 13, 19].map(n => `<option value="${n}" ${state.preferences.goSize === n ? 'selected' : ''}>${n} × ${n}</option>`).join('')}</select></label>` : ''}
    ${renderMotionSetting()}
    ${game === 'four' ? `<label>Column input<select id="four-confirm"><option value="false" ${!state.preferences.fourConfirm ? 'selected' : ''}>Drop on tap</option><option value="true" ${state.preferences.fourConfirm ? 'selected' : ''}>Preview, then confirm</option></select></label><p class="setting-help">Preview mode lets you change your mind before dropping a disc.</p>` : ''}
    ${changed ? '<p class="settings-pending">Setup changed. Start a new game to apply.</p>' : ''}
    <button class="button primary wide" id="new-game">${s.result !== null ? 'Play again' : 'New game'} <span aria-hidden="true">↗</span></button>
    <button class="button wide" id="undo" ${!canUndo ? 'disabled' : ''}>↶ Undo ${s.options.mode === 'computer' ? 'your turn' : 'move'}</button>
    <p class="setting-help">${s.options.mode === 'computer' ? 'Undo takes back your move and the computer’s reply.' : 'Undo takes back the last move.'}</p></section>`;
}
function canUndoMatch(game: MatchGame): boolean {
  const s = state[game];
  const players = game === 'chess' ? chessEngine(state.chess).history({ verbose: true }).map(m => m.color === 'w' ? 1 : -1) : state[game].history.map(h => h.turn);
  return (game === 'draughts' && jumpPath.length > 0) || (s.options.mode === 'local' ? players.length > 0 : players.includes(s.options.human));
}
function renderMotionSetting(): string {
  return `<label>Move animation<select id="motion">${(['relaxed', 'steady', 'quick'] as MotionSpeed[]).map(speed => `<option value="${speed}" ${state.preferences.motion === speed ? 'selected' : ''}>${speed === 'relaxed' ? 'Relaxed · take it in' : speed === 'steady' ? 'Steady · easy to follow' : 'Quick · keep it moving'}</option>`).join('')}</select></label>`;
}
function matchTools(game: MatchGame): string {
  const inspectedGroup = game === 'go' && goInspect !== null ? goGroup(state.go.board, state.go.size, goInspect) : null;
  const fourTip = busy === game ? 'Computer is thinking…' : game === 'chess' ? 'Select a piece · dots show its legal moves' : fourHint !== null ? explainFour(state.four.board, state.four.turn, fourHint).text : 'Preview with ← → · drop with Enter or 1–7';
  const canPlay = game === 'four' || game === 'draughts' ? hasHumanTurn(game) : advancedHumanTurn(game);
  const label = game === 'draughts' ? jumpPath.length ? `Continue jump ${jumpPath.length + 1}` : selected !== null ? `Selected ${squareName(selected)} · choose a marked destination` : draughtsMoves(state.draughts.board, state.draughts.turn)[0]?.captures.length ? 'Capture required · ringed pieces can jump' : 'Ringed pieces can move' : game === 'chess' && chessSelected !== null ? `${PIECE_NAMES[chessEngine(state.chess).get(chessSquare(chessSelected))!.type]} on ${chessSquare(chessSelected)} · ${chessEngine(state.chess).moves({ square: chessSquare(chessSelected) }).length} legal moves` : game === 'go' ? goInspectMode ? inspectedGroup?.stones.length ? `${inspectedGroup.stones.length} connected stones · ${inspectedGroup.liberties.length} liberties${inspectedGroup.liberties.length === 1 ? ' · atari!' : ''}` : 'Inspecting groups · no stones are placed' : 'Place stones · two passes open scoring' : fourTip;
  return `<div class="match-tools"><button class="button" data-quick="undo" ${!canUndoMatch(game) ? 'disabled' : ''}>↶ Undo</button><button class="button" data-quick="new">New game</button>${game === 'four' ? `<button class="button" data-quick="four-hint" ${!canPlay ? 'disabled' : ''}>Suggest a column</button>` : game === 'draughts' ? `<button class="button" data-quick="next-piece" ${!canPlay || jumpPath.length ? 'disabled' : ''}>Next movable piece</button>` : game === 'chess' ? '<button class="button" data-quick="flip-chess">↻ Flip board</button>' : `<button class="button" data-quick="inspect-go" aria-pressed="${goInspectMode}">${goInspectMode ? state.go.result !== null ? 'Exit inspector' : state.go.phase === 'play' ? 'Place stones' : state.go.phase === 'score' ? 'Mark dead groups' : 'Exit inspector' : 'Inspect liberties'}</button>`}<button class="button" data-quick="review" ${!state[game].moves.length || moving ? 'disabled' : ''}>Review moves</button><button class="button board-size-button" data-quick="board-size" aria-label="${largeBoards[game] ? 'Fit board to screen' : 'Enlarge board'}" title="${largeBoards[game] ? 'Fit board to screen' : 'Enlarge board'}">${largeBoards[game] ? '↙' : '↗'}</button><span class="board-guidance" role="status">${escape(label)}</span></div>`;
}
function draughtsHelp(): string {
  const s = state.draughts, flipped = draughtsFlipped ?? (s.options.mode === 'computer' && s.options.human === -1);
  return `<div class="position-tools"><button class="button" data-quick="flip-draughts">↻ Flip board</button><span>Men move ${(s.turn === 1) !== flipped ? '↑' : '↓'} toward the crown row · kings move both ways</span><button class="button" data-coach="suggest" ${!hasHumanTurn('draughts') || tutorThinking || jumpPath.length ? 'disabled' : ''}>${tutorThinking ? 'Finding a move…' : 'Suggest move'}</button></div>`;
}
function draughtsFeedback(): string {
  const s = state.draughts;
  const moves = selected === null ? [] : draughtsMoves(s.board, s.turn).filter(m => m.from === selected && jumpPath.every((p, i) => m.path[i] === p));
  const routes = [...new Set(moves.filter(m => m.captures.length).map(m => [m.from, ...m.path].map(squareName).join(' → ')))];
  // Transient routes and tutor controls live below the board so a capture never moves its targets.
  return `${routes.length ? `<div class="capture-routes" role="status"><strong>${jumpPath.length ? `Jump ${jumpPath.length} complete · continue with this piece` : 'Capture route' + (routes.length > 1 ? 's · choose a branch' : '')}</strong>${routes.map(route => `<span>${route}</span>`).join('')}</div>` : ''}${tutorAdvice?.draughts ? '<div class="draughts-tutor-actions"><button class="button" data-coach="preview">Watch suggestion</button><button class="button" data-coach="show">Select suggested piece</button></div>' : ''}`;
}
function chessHelp(): string {
  const s = state.chess, engine = chessEngine(s), last = engine.history({ verbose: true }).at(-1);
  return `<div class="position-tools"><button class="button" data-quick="chess-threats" aria-pressed="${showChessThreats}">${showChessThreats ? 'Hide attacks' : 'Show opponent attacks'}</button><button class="button" data-coach="suggest" ${!advancedHumanTurn('chess') || tutorThinking ? 'disabled' : ''}>${tutorThinking ? 'Finding a move…' : 'Suggest move'}</button>${tutorAdvice?.chess ? '<button class="button" data-coach="preview">Watch suggestion</button><button class="button" data-coach="show">Select suggested piece</button>' : ''}${showChessThreats ? `<span>! squares are attacked by ${engine.turn() === 'w' ? 'Black' : 'White'}. Check possible captures before moving.</span>` : last ? `<span>Last: ${last.color === 'w' ? 'White' : 'Black'} ${last.san} · ${last.from} → ${last.to}${last.captured ? ` · took a ${PIECE_NAMES[last.captured]}` : ''}</span>` : '<span>Select a piece to see legal moves. For castling, choose the king then its rook.</span>'}</div>`;
}
function goHelp(): string {
  const s = state.go;
  const preview = pendingGo === null ? null : placeGo(s.board, s.size, s.turn, pendingGo, goPositions(s));
  const liberties = preview && pendingGo !== null ? goGroup(preview.board, s.size, pendingGo).liberties.length : 0;
  return `<div class="position-tools">${s.phase === 'play' && s.result === null ? `<button class="button" id="pass" ${!advancedHumanTurn('go') ? 'disabled' : ''}>${s.passes ? 'Pass · open scoring' : 'Pass turn'}</button><button class="button" data-quick="go-confirm" aria-pressed="${state.preferences.goConfirm}">Preview first</button>` : ''}<button class="button" data-quick="go-atari" aria-pressed="${showGoAtari}">Show atari</button>${pendingGo !== null && !goInspectMode ? `<button class="button primary" data-quick="go-place">Place at ${goCoordinate(pendingGo, s.size)}</button><button class="button" data-quick="go-cancel">Cancel</button><span>Preview · ${preview!.captured.length} captures · ${liberties} libert${liberties === 1 ? 'y · atari!' : 'ies'}</span>` : `<span>${s.phase === 'score' ? 'Mark agreed dead groups, then confirm the score below.' : s.passes ? 'One player has passed. A second pass opens score review.' : state.preferences.goConfirm ? 'Tap to preview. Tap again or press Place to commit.' : 'Stones go on intersections. Inspect groups to see their liberties.'}</span>`}</div>`;
}
function renderAdvanced(game: 'chess' | 'go'): string {
  const s = state[game];
  const context = { canPlay: advancedHumanTurn(game), busy: busy === game, selected: game === 'chess' ? chessSelected : null, focus: game === 'chess' ? chessFocus : goFocus, message, tools: matchTools(game) + (game === 'chess' ? chessHelp() : goHelp()), flipped: chessFlipped ?? (state.chess.options.mode === 'computer' && state.chess.options.human === -1), inspectMode: goInspectMode, inspected: goInspect, threats: showChessThreats, pending: pendingGo, atari: showGoAtari };
  return `<main class="play-page"><div class="page-heading"><div><p class="eyebrow">${game === 'chess' ? 'THINK AHEAD. FIND YOUR MOVE.' : 'ONE STONE. MANY POSSIBILITIES.'}</p><h1 id="page-title" tabindex="-1">${names[game]}</h1></div><span class="chip">${game === 'go' ? `${state.go.size} × ${state.go.size} · ` : ''}${s.options.mode === 'computer' ? `${s.options.level} / 5 · ${LEVELS[s.options.level - 1].name}` : 'TWO PLAYERS'}</span></div><div class="play-layout"><aside class="sidebar">${renderDuelSettings(game)}${game === 'chess' ? coachPanel(state, 'chess', tutorAdvice, tutorThinking) : ''}${advancedRules(game)}</aside><section class="arena">${game === 'chess' ? chessArena(state.chess, context) : goArena(state.go, context)}</section></div></main>`;
}

function renderRules(game: DuelGame): string {
  return `<details class="rules-card"><summary>How to play <span aria-hidden="true">＋</span></summary>${game === 'four'
    ? '<p>Take turns dropping one disc into a column. The first to connect four horizontally, vertically or diagonally wins. A full board with no winner is a draw.</p><p>Click a column or press <kbd>1</kbd>–<kbd>7</kbd>. Use Tab and Enter to play with the keyboard.</p>'
    : '<p>English draughts: men move and capture diagonally forward. Captures are compulsory. Keep jumping with the same piece until its capture sequence ends; you may choose any available capture.</p><p>Reach the far row to make a king (♛). Promotion ends your turn. Kings move and capture one diagonal step in either direction. Win by leaving your opponent without a legal move.</p><p>Three repeats of a position, or 40 moves by each side without a capture or a man moving, is a draw. Circle starts by default; choose the first mover in setup.</p><p>Ringed pieces can move; dots show their destinations. Use arrow keys and Enter on the board.</p><a href="https://wcdf.net/rules/rules_of_checkers_english.pdf" target="_blank" rel="noopener">Official English draughts rules ↗</a>'}</details>`;
}

function renderDuelBoard(game: DuelGame): string {
  const s = state[game], canPlay = hasHumanTurn(game);
  const last = s.history.at(-1)?.board;
  if (game === 'four') {
    const line = fourLine(s.board);
    const guide = fourHint === null ? null : explainFour(s.board, s.turn, fourHint);
    return `<div class="four-board" id="board" aria-label="Four in a Row board. Press 1 to 7 to drop a disc." tabindex="0">${Array.from({ length: 7 }, (_, col) => {
      const row = dropRow(s.board, col);
      const contents = Array.from({ length: 6 }, (_, r) => s.board[r * 7 + col] === 1 ? 'Circle' : s.board[r * 7 + col] === -1 ? 'Diamond' : 'empty').join(', ');
      return `<button class="four-column ${fourHint === col ? 'suggested-column' : ''} ${fourPending === col ? 'preview-column' : ''}" data-column="${col}" ${!canPlay || row < 0 ? 'disabled' : ''} aria-label="Column ${col + 1}${row < 0 ? ', full' : ''}. Top to bottom: ${contents}"><span class="column-number">${col + 1}<span aria-hidden="true">↓</span></span>${Array.from({ length: 6 }, (_, r) => {
        const i = r * 7 + col, n = s.board[i];
        return `<span data-slot="${i}" class="four-slot ${canPlay && row === r ? 'landing' : ''} ${guide?.cells.includes(i) ? 'guide-line' : ''} ${guide?.danger.includes(i) ? 'guide-danger' : ''}">${n ? `<span class="disc p${n === 1 ? '1' : '2'} ${line.includes(i) ? 'winning' : ''} ${last && last[i] !== n ? 'last-piece' : ''}"><span class="piece-mark" aria-hidden="true">${discEmblem(n)}</span></span>` : canPlay && row === r ? `<span class="disc ghost p${s.turn === 1 ? '1' : '2'}" aria-hidden="true"><span class="piece-mark">${discEmblem(s.turn)}</span></span>` : ''}</span>`;
      }).join('')}</button>`;
    }).join('')}</div>`;
  }
  const moves = draughtsMoves(s.board, s.turn), b = s.board.slice();
  const activeMoves = selected === null ? [] : moves.filter(m => m.from === selected && jumpPath.every((p, i) => m.path[i] === p));
  const destinations = activeMoves.map(m => m.path[jumpPath.length]);
  if (selected !== null && jumpPath.length) {
    b[selected] = 0;
    activeMoves[0]?.captures.slice(0, jumpPath.length).forEach(i => { b[i] = 0; });
    b[jumpPath.at(-1)!] = s.board[selected];
  }
  const at = jumpPath.at(-1) ?? selected;
  const flipped = draughtsFlipped ?? (s.options.mode === 'computer' && s.options.human === -1);
  return `<div class="draughts-board" id="board" tabindex="0" role="group" aria-label="Draughts board${flipped ? ', Diamond side at the bottom' : ''}. Arrow keys move focus. Enter selects a piece or destination.">${Array.from({ length: 64 }, (_, n) => flipped ? 63 - n : n).map(i => { const piece = b[i];
    const playable = (Math.floor(i / 8) + i % 8) % 2 === 1;
    if (!playable) return '<span class="draughts-square light-square" aria-hidden="true"></span>';
    const canMove = canPlay && !jumpPath.length && moves.some(m => m.from === i);
    const target = canPlay && destinations.includes(i);
    const label = `${squareName(i)}, ${piece ? `${playerMark(piece > 0 ? 1 : -1)} ${piece > 0 ? 'Circle' : 'Diamond'} ${Math.abs(piece) === 2 ? 'king' : 'man'}` : 'empty'}${canMove ? ', can move' : ''}${target ? ', legal destination' : ''}`;
    return `<button class="draughts-square ${i === at ? 'selected-square' : ''} ${target ? 'target-square' : ''} ${last && last[i] !== s.board[i] ? 'last-square' : ''}" data-square="${i}" tabindex="${i === focusSquare ? '0' : '-1'}" aria-label="${label}" ${!canPlay ? 'disabled' : ''}><span class="square-coordinate" aria-hidden="true">${squareName(i)}</span>${piece ? `<span class="disc p${piece > 0 ? '1' : '2'} ${Math.abs(piece) === 2 ? 'king-disc' : ''} ${canMove ? 'can-move' : ''}"><span class="piece-mark" aria-hidden="true">${discEmblem(piece)}</span></span>` : target ? '<span class="move-dot" aria-hidden="true"></span>' : ''}</button>`;
  }).join('')}</div>`;
}

function renderDuel(game: DuelGame): string {
  const s = state[game];
  const turnName = playerName(s, s.turn), resultName = s.result ? playerName(s, s.result) : '';
  const result = s.result !== null;
  const status = result ? s.result === 0 ? 'A well-played draw.' : `${resultName === 'You' ? 'You win' : resultName === 'Computer' ? 'Computer wins' : `${resultName} wins`}!`
    : busy === game ? 'Computer is thinking…' : s.options.mode === 'computer' && turnName === 'You' ? 'Your move.' : `${turnName}’s move.`;
  const capture = game === 'draughts' && draughtsMoves(s.board, s.turn)[0]?.captures.length;
  const detail = message || (result ? s.reason || (s.result === 0 ? 'No moves left. Another round?' : game === 'four' ? 'Four together. That’s the winning line.' : 'The other side has no legal moves.')
    : busy === game ? `${LEVELS[s.options.level - 1].name} · finding the next move.` : game === 'four' ? 'Pick a column. Your disc falls into the lowest empty space.' : capture ? 'Capture required. Select a ringed piece to begin.' : 'Select a ringed piece, then a marked destination.');
  const pieces = (p: Player) => s.board.filter(n => n * p > 0).length;
  return `<main class="play-page"><div class="page-heading"><div><p class="eyebrow">${game === 'four' ? 'FOUR TOGETHER. ONE WINNER.' : 'SMALL MOVES. BIG POSSIBILITIES.'}</p><h1 id="page-title" tabindex="-1">${names[game]}</h1></div><span class="chip">${s.options.mode === 'computer' ? `${s.options.level} / 5 · ${LEVELS[s.options.level - 1].name}` : 'TWO PLAYERS'}</span></div>
    <div class="play-layout"><aside class="sidebar">${renderDuelSettings(game)}${game === 'draughts' ? coachPanel(state, 'draughts', tutorAdvice, tutorThinking) : ''}${renderRules(game)}</aside>
    <section class="arena"><div class="players">${([1, -1] as Player[]).map(p => `<div class="player-card ${s.turn === p && !result ? 'active-player' : ''}"><span class="player-avatar p${p === 1 ? '1' : '2'}" aria-hidden="true">${discEmblem(p)}</span><div><strong>${playerName(s, p)}</strong><span>${game === 'draughts' ? `${pieces(p)} pieces · ${s.board.filter(n => n * p > 0 && Math.abs(n) === 2).length} kings` : p === 1 ? 'Circle pieces' : 'Diamond pieces'}</span></div><b>${s.scores[p === 1 ? 0 : 1]}<small> wins</small></b></div>`).join('')}</div>
    ${matchTools(game)}${game === 'draughts' ? draughtsHelp() : ''}${game === 'four' && state.preferences.fourConfirm && hasHumanTurn('four') ? `<div class="drop-confirm"><span>${fourPending === null ? 'Choose a column to preview your landing.' : `Previewing column ${fourPending + 1}. Tap again to drop.`}</span><button class="button primary" data-quick="drop" ${fourPending === null ? 'disabled' : ''}>Drop disc ↓</button>${fourPending !== null ? '<button class="button" data-quick="clear-drop">Cancel</button>' : ''}</div>` : ''}<div class="board-stage ${game}">${renderDuelBoard(game)}</div>${game === 'draughts' ? draughtsFeedback() : ''}
    <div class="status-card ${result ? 'result-card' : ''}" role="status" aria-live="polite" aria-atomic="true"><span class="status-icon ${busy === game ? 'thinking' : ''}" aria-hidden="true">${result ? s.result === 0 ? '＝' : '✦' : playerMark(s.turn)}</span><div><h2>${status}</h2><p>${escape(detail)}</p></div>${result ? '<button class="button primary" id="play-again">Play again ↗</button>' : ''}</div>
    <div class="game-meta"><span>Move ${s.moves.length + (result ? 0 : 1)} <b>·</b> ${s.scores[2]} draws</span><details class="move-history"><summary>Move history (${s.moves.length})</summary><ol>${s.moves.map((m, i) => `<li><span>${i + 1}. ${playerMark(m.player)}</span>${escape(m.text)}</li>`).join('') || '<li>No moves yet.</li>'}</ol></details></div>
    </section></div></main>`;
}

function renderSudoku(): string {
  const s = state.sudoku, prefs = state.preferences;
  const generating = busy === 'sudoku';
  const solved = s ? sudokuSolved(s) : false;
  const locked = !s || generating || s.paused || solved;
  const changed = s && (s.size !== prefs.size || s.difficulty !== prefs.difficulty);
  const filled = s ? s.values.filter(Boolean).length : 0;
  const legalDigits = s && !s.puzzle[s.selected] ? candidates(s.values.map((n, i) => i === s.selected ? 0 : n), s.size, s.selected) : [];
  const numberButtons = () => Array.from({ length: s?.size ?? prefs.size }, (_, i) => {
    const n = i + 1, left = s ? Math.max(0, s.size - s.values.filter(v => v === n).length) : 0;
    return `<button data-number="${n}" class="${!left ? 'digit-complete' : ''} ${legalDigits.includes(n) ? 'candidate-digit' : ''} ${prefs.sudokuDigitFirst && sudokuDigit === n ? 'selected-digit' : ''}" ${prefs.sudokuDigitFirst ? `aria-pressed="${sudokuDigit === n}"` : ''} aria-label="${symbol(n)}, ${left} remaining${legalDigits.includes(n) ? ', possible in selected cell' : ''}" ${locked ? 'disabled' : ''}>${symbol(n)}<small>${left}</small></button>`;
  }).join('');
  let board = '<div class="board-loading"><span class="loading-grid" aria-hidden="true">▦</span><h2>Making your puzzle…</h2><p>Checking that it has one unique solution.</p></div>';
  if (s && !generating) {
    const [br, bc] = boxShape(s.size), related = peers(s.size, s.selected), duplicates = conflicts(s.values, s.size);
    const finishedRows = sudokuFinishedRows(s.values, s.size).map((done, row) => done && ![...duplicates, ...checked].some(i => Math.floor(i / s.size) === row));
    const same = prefs.sudokuDigitFirst ? sudokuDigit : s.values[s.selected];
    board = s.paused ? '<div class="board-loading pause-screen"><span aria-hidden="true">Ⅱ</span><h2>A little breather.</h2><p>Your puzzle and timer are paused.</p><button class="button primary" id="resume">Resume puzzle</button></div>'
      : `<div class="sudoku-board" id="board" style="--size:${s.size};--note-cols:${bc}" role="group" aria-label="${s.size} by ${s.size} sudoku. Arrow keys navigate; numbers enter values; Shift enters notes.">${s.values.map((n, i) => {
        const r = Math.floor(i / s.size), c = i % s.size;
        const classes = [sudokuBoxTint(r, c, s.size) ? 'alternate-box' : '', finishedRows[r] ? 'finished-row' : '', n && !s.puzzle[i] ? 'filled-entry' : '', s.puzzle[i] ? 'given' : 'entered', i === s.selected ? 'selected-cell' : '', related.includes(i) ? 'related-cell' : '', same && n === same ? 'matching-cell' : '', duplicates.includes(i) || checked.includes(i) ? 'conflict-cell' : '', (c + 1) % bc === 0 && c < s.size - 1 ? 'box-right' : '', (r + 1) % br === 0 && r < s.size - 1 ? 'box-bottom' : '', pendingHint?.index === i ? 'hint-cell' : ''].join(' ');
        return `<button class="sudoku-cell ${classes}" data-cell="${i}" tabindex="${i === s.selected ? '0' : '-1'}" aria-label="Row ${r + 1}, column ${c + 1}, ${n ? symbol(n) : s.notes[i].length ? `notes ${s.notes[i].map(symbol).join(', ')}` : 'empty'}${s.puzzle[i] ? ', starting clue' : ''}${duplicates.includes(i) || checked.includes(i) ? ', error' : ''}">${n ? symbol(n) : `<span class="pencil-notes" aria-hidden="true">${Array.from({ length: s.size }, (_, j) => `<span>${s.notes[i].includes(j + 1) ? symbol(j + 1) : ''}</span>`).join('')}</span>`}</button>`;
      }).join('')}</div>`;
  }
  const detail = message || (solved ? `Completed in ${formatTime(s!.elapsed)} with ${s!.hints} hint${s!.hints === 1 ? '' : 's'}. Ready for another?` : s?.paused ? 'Resume whenever you’re ready.' : 'Every row, column and box needs each number exactly once.');
  return `<main class="play-page"><div class="page-heading"><div><p class="eyebrow">A LITTLE SPACE TO THINK.</p><h1 id="page-title" tabindex="-1">Sudoku</h1></div><span class="chip">${s ? `${s.size} × ${s.size} · ${sudokuLevels[s.difficulty - 1]}` : 'SOLO PUZZLE'}</span></div>
    <div class="play-layout"><aside class="sidebar"><section class="settings-card"><p class="eyebrow">FIND YOUR PACE</p><h2>Puzzle setup</h2><div class="two-fields"><label>Board size<select id="size">${[4, 6, 9, 12].map(n => `<option value="${n}" ${prefs.size === n ? 'selected' : ''}>${n} × ${n}</option>`).join('')}</select></label><label>Difficulty<select id="puzzle-level">${sudokuLevels.map((name, i) => `<option value="${i + 1}" ${prefs.difficulty === i + 1 ? 'selected' : ''}>${name}</option>`).join('')}</select></label></div><p class="setting-help">Higher settings remove more clues while preserving a unique solution. Small boards make a quick warm-up.</p>${changed ? '<p class="settings-pending">Setup changed. Start a new puzzle to apply.</p>' : ''}<button class="button primary wide" id="new-game" ${generating ? 'disabled' : ''}>New puzzle ↗</button>
    <div class="number-pad" style="--pad-cols:${s?.size === 4 ? 2 : s?.size === 12 ? 4 : 3}" aria-label="Number pad">${numberButtons()}</div>
    <div class="two-fields"><button class="button ${prefs.notes ? 'selected-toggle' : ''}" id="notes" aria-pressed="${prefs.notes}" ${locked ? 'disabled' : ''}>✎ Notes</button><button class="button" id="erase" ${locked ? 'disabled' : ''}>Erase</button></div>
    <div class="sudoku-tools"><button class="button" id="undo" ${!s?.history.length || generating || s.paused ? 'disabled' : ''}>↶ Undo</button><button class="button" id="redo" ${!s?.redo.length || generating || s.paused ? 'disabled' : ''}>↷ Redo</button><button class="button" id="auto-notes" ${locked ? 'disabled' : ''}>Auto notes</button><button class="button" id="check" ${locked ? 'disabled' : ''}>Check</button><button class="button" id="hint" ${locked ? 'disabled' : ''}>✦ Hint</button><button class="button" id="pause" ${!s || generating || solved ? 'disabled' : ''}>${s?.paused ? '▶ Resume' : 'Ⅱ Pause'}</button></div></section>
    <details class="rules-card"><summary>How to play <span aria-hidden="true">＋</span></summary><p>Each number appears once in every row, column and box. Starting clues are fixed. Choose a cell, then use the number pad or your keyboard.</p><p>Notes adds pencil marks. Hold Shift to enter a note temporarily. Auto notes fills candidates; placing a number removes it from neighbouring notes.</p><p>Duplicate entries are marked as you type. Check also finds entries that disagree with the solution. Hint explains a possible next step before you decide to reveal it.</p><p>Arrow keys move between cells. Delete erases. <kbd>N</kbd> toggles notes; <kbd>Ctrl Z</kbd> undoes; <kbd>Ctrl Shift Z</kbd> redoes. On 12 × 12 boards, use <kbd>A</kbd>, <kbd>B</kbd>, <kbd>C</kbd> for 10, 11, 12.</p><p>The timer pauses in the lobby, in another game, when the tab is hidden or when you press Pause. Progress saves on this browser.</p></details></aside>
    <section class="arena"><div class="puzzle-stats"><div><span>Time</span><strong id="timer">${formatTime(s?.elapsed ?? 0)}</strong></div><div><span>Filled</span><strong>${filled}<small> / ${s?.size ? s.size * s.size : prefs.size * prefs.size}</small></strong></div><div><span>Hints</span><strong>${s?.hints ?? 0}</strong></div><div class="progress-track"><span style="width:${s ? filled / s.values.length * 100 : 0}%"></span></div></div>
    <div class="sudoku-focusbar"><span>${s && !s.paused ? `Row ${Math.floor(s.selected / s.size) + 1} · column ${s.selected % s.size + 1} · ${s.puzzle[s.selected] ? 'fixed clue' : prefs.notes ? '✎ pencil notes' : 'number entry'}` : 'Your puzzle is saved'}</span><button class="button ${prefs.sudokuDigitFirst ? 'selected-toggle' : ''}" data-action="digit-first" aria-pressed="${prefs.sudokuDigitFirst}" ${locked ? 'disabled' : ''}>${prefs.sudokuDigitFirst ? `Paint ${symbol(sudokuDigit)}` : 'Cell first'} ⇄</button><button class="button" data-action="next-empty" ${locked ? 'disabled' : ''}>Next empty cell →</button></div><div class="board-stage sudoku">${board}</div>${s && !s.paused && !solved && !s.puzzle[s.selected] ? (() => { const guide = cellGuide(s.values, s.size, s.selected), list = (digits: number[]) => digits.map(symbol).join(' · ') || 'none'; return `<details class="candidate-help"><summary>Why these candidates? ${list(guide.possible)}</summary><div><p>Missing from this row: <strong>${list(guide.row)}</strong></p><p>Missing from this column: <strong>${list(guide.column)}</strong></p><p>Missing from this box: <strong>${list(guide.box)}</strong></p><p>Only numbers in all three lists fit here. This follows your current entries.</p></div></details>`; })() : ''}
    <div class="mobile-input"><div class="number-pad" style="--mobile-cols:${s?.size === 12 ? 6 : s?.size === 4 ? 4 : s?.size === 6 ? 6 : 9}" aria-label="Number pad">${numberButtons()}</div><div class="mobile-tools"><button class="button ${prefs.notes ? 'selected-toggle' : ''}" data-action="notes" aria-pressed="${prefs.notes}" ${locked ? 'disabled' : ''}>✎ Notes</button><button class="button" data-action="erase" ${locked ? 'disabled' : ''}>Erase</button><button class="button" data-action="undo" ${!s?.history.length || generating || s.paused ? 'disabled' : ''}>↶ Undo</button><button class="button" data-action="hint" ${locked ? 'disabled' : ''}>✦ Hint</button><button class="button" data-action="pause" ${!s || generating || solved ? 'disabled' : ''}>${s?.paused ? '▶ Resume' : 'Ⅱ Pause'}</button></div><div class="mobile-tools"><button class="button" data-action="redo" ${!s?.redo.length || generating || s.paused ? 'disabled' : ''}>↷ Redo</button><button class="button" data-action="auto-notes" ${locked ? 'disabled' : ''}>Auto notes</button><button class="button" data-action="check" ${locked ? 'disabled' : ''}>Check</button></div></div>
    ${pendingHint ? `<div class="hint-card" role="status"><div><p class="eyebrow">${pendingHint.correction ? 'CHECK THIS ENTRY' : 'YOUR NEXT STEP'}</p><p>${escape(pendingHint.explanation)}</p></div><button class="button primary" id="apply-hint">${pendingHint.correction ? 'Clear entry' : `Reveal ${symbol(pendingHint.value)}`}</button><button class="icon-button" id="dismiss-hint" aria-label="Dismiss hint">×</button></div>` : ''}
    <div class="status-card ${solved ? 'result-card' : ''}" role="status" aria-live="polite" aria-atomic="true"><span class="status-icon" aria-hidden="true">${solved ? '✦' : s?.paused ? 'Ⅱ' : '▦'}</span><div><h2>${solved ? 'Puzzle complete!' : generating ? 'One moment…' : s?.paused ? 'Paused.' : 'One number at a time.'}</h2><p>${escape(detail)}</p></div>${solved ? '<button class="button primary" id="play-again">New puzzle ↗</button>' : ''}</div><div class="game-meta"><span>${s && !s.paused ? `Selected: row ${Math.floor(s.selected / s.size) + 1}, column ${s.selected % s.size + 1}` : 'Your progress is kept here'}</span><span>${prefs.notes ? '✎ Pencil mode' : 'Number mode'}</span></div></section></div></main>`;
}

function render(): void {
  const scrollPositions = ['.mine-scroll', '.life-stage'].map(selector => { const el = app.querySelector(selector); return { selector, left: el?.scrollLeft ?? 0, top: el?.scrollTop ?? 0 }; });
  const focus = document.activeElement as HTMLElement;
  const blackjackFocus = !!focus?.closest('.blackjack-actions');
  const drafts = [...app.querySelectorAll<HTMLInputElement>('input[id]:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=file])')].map(el => ({ id: el.id, value: el.value }));
  const controlKey = ['plus', 'collection', 'quick', 'action', 'arcade', 'poker', 'count', 'patience', 'coach', 'bj'].find(key => focus?.dataset[key] !== undefined);
  const identity = focus?.id ? `#${focus.id}` : focus?.dataset.cell ? `[data-cell="${focus.dataset.cell}"]`
    : focus?.dataset.square ? `[data-square="${focus.dataset.square}"]` : focus?.dataset.column ? `[data-column="${focus.dataset.column}"]`
    : focus?.dataset.chessSquare ? `[data-chess-square="${focus.dataset.chessSquare}"]` : focus?.dataset.point ? `[data-point="${focus.dataset.point}"]` : focus?.dataset.mine !== undefined ? `[data-mine="${focus.dataset.mine}"]` : focus?.dataset.tilePlace ? `[data-tile-place="${focus.dataset.tilePlace}"]` : focus?.dataset.cardKey ? `[data-card-key="${focus.dataset.cardKey}"]` : controlKey ? `[data-${controlKey}="${focus.dataset[controlKey]}"]` : null;
  const openRules = app.querySelector<HTMLDetailsElement>('.rules-card')?.open;
  const openSkiSettings = app.querySelector<HTMLDetailsElement>('.ski-settings')?.open;
  const openHistory = app.querySelector<HTMLDetailsElement>('.move-history')?.open;
  const openCandidates = app.querySelector<HTMLDetailsElement>('.candidate-help')?.open;
  const expanded = [...app.querySelectorAll<HTMLDetailsElement>('details[data-remember]')].filter(el => el.open).map(el => el.dataset.remember);
  document.documentElement.dataset.theme = state.preferences.theme;
  if (moving || cardBusy || pokerRoom.moving) return;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.preferences.theme === 'classic' ? '#f4f1e9' : state.preferences.theme === 'woodland' ? '#edf2e9' : '#080e18');
  const game = state.preferences.game;
  const collectionKey = collectionRoute(state);
  app.dataset.game = game;
  app.dataset.boardSize = isMatch(game) && largeBoards[game] ? 'large' : 'fit';
  document.title = `${game === 'home' ? `${GAMES.length-1} games, one place to play` : names[game]} · Tiltu’s Games`;
  app.innerHTML = `${renderHeader()}${isPlus(game) ? plus.render(game) : collectionKey ? collection.render(collectionKey) : game === 'home' ? renderHome() : game === 'sudoku' ? renderSudoku() : game === 'chess' || game === 'go' ? renderAdvanced(game) : game === 'blackjack' ? blackjackPage(state.blackjack, message, renderMotionSetting(), countingTutor.render()) : game === 'patience' ? patiencePage(state.patience ??= newPatience(state.preferences.patienceDraw), state.preferences.patienceDraw, patienceSelected, cardHint, message, renderMotionSetting(), autoFoundations) : isActionGame(game) ? actionArcade.render(game) : isArcade(game) ? arcade.render(game) : game === 'poker' ? pokerRoom.render() : renderDuel(game as DuelGame)}<footer class="app-footer"><span>© 2026 Philip Leichauer <b>·</b> All rights reserved.</span><button class="license-link" id="license-info">License & notices</button><span>${storageOK ? 'Progress saved on this browser' : 'Storage unavailable · progress kept for this visit'}</span></footer>`;
  if (game === 'patience' && !collectionKey) { const heading = app.querySelector('.page-heading h1'); if (heading) heading.insertAdjacentHTML('afterend', '<p class="game-subtitle">Klondike</p>'); const arena=app.querySelector('.arena'); arena?.insertAdjacentHTML('afterbegin',patiencePicker('klondike')); }
  boardArtwork.mount(app);
  if (isPlus(game)) plus.mount();
  if (collectionKey) collection.mount(collectionKey);
  if (isArcade(game)) arcade.mount(game);
  if (isActionGame(game)) actionArcade.mount(game);
  if (game === 'poker') pokerRoom.mount();
  if (game === 'blackjack') countingTutor.mount();
  scrollPositions.forEach(({ selector, left, top }) => { const el = app.querySelector(selector); if (el) { el.scrollLeft = left; el.scrollTop = top; } });
  if (openSkiSettings) { const details = app.querySelector<HTMLDetailsElement>('.ski-settings'); if (details) details.open = true; }
  if (openRules) { const details = app.querySelector<HTMLDetailsElement>('.rules-card'); if (details) details.open = true; }
  if (openCandidates) { const details = app.querySelector<HTMLDetailsElement>('.candidate-help'); if (details) details.open = true; }
  app.querySelectorAll<HTMLDetailsElement>('details[data-remember]').forEach(el => { el.open = expanded.includes(el.dataset.remember); });
  drafts.forEach(({ id, value }) => { const input = app.querySelector<HTMLInputElement>(`#${id}`); if (input) input.value = value; });
  if (openHistory) { const details = app.querySelector<HTMLDetailsElement>('.move-history'); if (details) details.open = true; }
  if (blackjackFocus && game === 'blackjack') (app.querySelector<HTMLElement>('.blackjack-actions button:not(:disabled)') ?? app.querySelector<HTMLElement>('.blackjack-actions'))?.focus({ preventScroll: true });
  else if (identity) {
    const nextFocus = app.querySelector<HTMLElement>(identity);
    if (nextFocus instanceof HTMLButtonElement && nextFocus.disabled && nextFocus.closest('#board')) app.querySelector<HTMLElement>('#board')?.focus({ preventScroll: true });
    else nextFocus?.focus({ preventScroll: true });
  }
}

function tickTimer(): void {
  const now = performance.now(), s = state.sudoku;
  const active = state.preferences.game === 'sudoku' && s && !s.paused && !sudokuSolved(s) && busy !== 'sudoku' && !document.hidden && !document.querySelector('dialog[open]');
  if (active) {
    const seconds = Math.floor((now - timerStart) / 1000);
    if (seconds > 0) { s.elapsed += seconds; timerStart += seconds * 1000; }
  } else timerStart = now;
  const timer = document.querySelector('#timer');
  if (timer && s) timer.textContent = formatTime(s.elapsed);
}

app.addEventListener('change', event => {
  if (!(event.target instanceof HTMLSelectElement)) return;
  const input = event.target as HTMLSelectElement, game = state.preferences.game;
  if (input.id.startsWith('action-')) { actionArcade.setting(input.id,input.value); return; }
  if (input.id.startsWith('plus-')) { plus.setting(input.id, input.value); return; }
  if (input.id.startsWith('collection-')) { collection.setting(input.id, input.value); return; }
  if (input.id === 'game-select') { changeGame(input.value as Game); return; }
  if (input.id === 'theme') state.preferences.theme = input.value as Theme;
  if (input.id === 'motion') state.preferences.motion = input.value as MotionSpeed;
  if (input.id === 'four-confirm') { state.preferences.fourConfirm = input.value === 'true'; fourPending = null; }
  if (isMatch(game)) {
    const p = state.preferences[game];
    if (input.id === 'opponent') p.mode = input.value as MatchOptions['mode'];
    if (input.id === 'level') p.level = Number(input.value);
    if (input.id === 'human') p.human = Number(input.value) as Player;
    if (input.id === 'starter') p.starter = Number(input.value) as Player;
  }
  if (input.id === 'size') state.preferences.size = Number(input.value) as SudokuSize;
  if (input.id === 'puzzle-level') state.preferences.difficulty = Number(input.value);
  if (input.id === 'go-size') state.preferences.goSize = Number(input.value) as GoSize;
  if (input.id === 'patience-draw') state.preferences.patienceDraw = Number(input.value) as DrawCount;
  if (input.id.startsWith('blackjack-bet') && ['betting', 'settled'].includes(state.blackjack.phase)) state.blackjack.bet = Number(input.value);
  if (input.id === 'mine-level') state.preferences.mineLevel = input.value as MineLevel;
  if (input.id === 'life-mode') state.preferences.lifeMode = input.value as LifeMode;
  if (input.id === 'life-opponent') state.preferences.lifeOpponent = input.value as 'computer' | 'local';
  if (input.id === 'life-speed') state.preferences.lifeSpeed = Number(input.value);
  if (input.id === 'tetra-size') state.preferences.tetraSize = Number(input.value) as TetraSize;
  if (input.id === 'ski-mode') state.preferences.skiMode = input.value as SkiMode;
  if (input.id === 'ski-input') state.preferences.skiInput = input.value as 'keys' | 'mouse';
  if (input.id === 'poker-level') state.preferences.pokerLevel = Math.max(1,Math.min(5,Number(input.value)));
  if (input.id === 'life-level') state.preferences.lifeLevel = Math.max(1,Math.min(5,Number(input.value)));
  if (input.id === 'poker-variant') state.preferences.pokerVariant = input.value as PokerVariant;
  if (input.id === 'count-pace') { state.counting ??= newCountDrill(1, Number(input.value)); state.counting.pace = Number(input.value); }
  if (input.id === 'count-decks') { countingTutor.leave(); state.counting = newCountDrill(Number(input.value), state.counting?.pace ?? 750); }
  if (game === 'life') arcade.setting(input.id, input.value);
  persist(); render();
});

app.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button || button.disabled) return;
  const action = button.dataset.action ?? button.id;
  if (action === 'license-info') {
    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog license-dialog';
    dialog.setAttribute('aria-label', 'License and third-party notices');
    const title = document.createElement('h2');
    title.textContent = 'License and third-party notices';
    const text = document.createElement('pre');
    text.textContent = [document.getElementById('collection-license')?.textContent,
      document.getElementById('third-party-notices')?.textContent].filter(Boolean).join('\n\n');
    const close = document.createElement('button');
    close.className = 'button'; close.textContent = 'Close';
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { dialog.remove(); button.focus(); });
    dialog.append(title, text, close); document.body.append(dialog); dialog.showModal();
    return;
  }
  if (button.dataset.quick) {
    const quick = button.dataset.quick, game = state.preferences.game;
    if (quick === 'undo') { fourHint = null; fourPending = null; pendingGo = null; goInspect = null; undo(); return; }
    if (quick === 'new') { confirmNew(); return; }
    if (quick === 'board-size' && isMatch(game)) largeBoards[game] = !largeBoards[game];
    if (quick === 'drop' && fourPending !== null && hasHumanTurn('four')) { commitMove('four', fourPending); return; }
    if (quick === 'clear-drop') { fourPending = null; message = ''; render(); return; }
    if (quick === 'review' && isMatch(game) && !moving) { cancelWork(); render(); openMatchReview(state, game, scheduleComputer); return; }
    if (quick === 'four-hint' && hasHumanTurn('four')) {
      suggestFour();return;
    }
    if (quick === 'next-piece' && hasHumanTurn('draughts') && !jumpPath.length) { const choices = [...new Set(draughtsMoves(state.draughts.board, state.draughts.turn).map(m => m.from))]; const next = choices[(choices.indexOf(selected ?? -1) + 1) % choices.length]; if (next !== undefined) { selected = next; focusSquare = next; message = 'A movable piece is selected. Choose a marked destination.'; } }
    if (quick === 'flip-chess') chessFlipped = !(chessFlipped ?? (state.chess.options.mode === 'computer' && state.chess.options.human === -1));
    if (quick === 'go-confirm') { state.preferences.goConfirm = !state.preferences.goConfirm; pendingGo = null; persist(); }
    if (quick === 'go-atari') showGoAtari = !showGoAtari;
    if (quick === 'go-cancel') pendingGo = null;
    if (quick === 'go-place' && pendingGo !== null && advancedHumanTurn('go')) { commitGo(pendingGo); return; }
    if (quick === 'chess-threats') showChessThreats = !showChessThreats;
    if (quick === 'flip-draughts') draughtsFlipped = !(draughtsFlipped ?? (state.draughts.options.mode === 'computer' && state.draughts.options.human === -1));
    if (quick === 'inspect-go') { pendingGo = null; goInspectMode = !goInspectMode; goInspect = null; message = goInspectMode ? 'Select any stone to inspect its connected group and liberties. This does not play a move.' : 'Place stones mode. Select an empty intersection to play.'; }
    render(); return;
  }
  if (button.dataset.plus) { plus.action(button.dataset.plus); return; }
  if (button.dataset.collection) { collection.action(button.dataset.collection); return; }
  if (button.dataset.patienceVariant) { collection.leave(); cancelMotion(); state.preferences.patienceVariant = button.dataset.patienceVariant as PatienceVariant; patienceSelected=null; cardHint=null; persist(); render(); return; }
  if (button.dataset.category) { lobbyCategory=button.dataset.category as Category; render(); return; }
  if (button.dataset.game) { changeGame(button.dataset.game as Game); return; }
  if (button.dataset.actionHold) { if(event.detail===0) actionArcade.tapHold(button.dataset.actionHold); return; }
  if (button.dataset.actionArcade) { actionArcade.action(button.dataset.actionArcade); return; }
  if (button.dataset.arcade) { if (button.dataset.arcade === 'new' && state.preferences.game === 'mines' && state.mines?.status === 'playing') confirmNew(); else arcade.action(button.dataset.arcade); return; }
  if (button.dataset.poker) { pokerRoom.action(button.dataset.poker); return; }
  if (button.dataset.count) { countingTutor.action(button.dataset.count); return; }
  if (button.dataset.coach) { tutorAction(button.dataset.coach); return; }
  if (button.hasAttribute('data-card-rules')) {
    const rules = app.querySelector<HTMLDetailsElement>('.rules-card');
    if (rules) { rules.open = !rules.open; if (rules.open) rules.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    return;
  }
  if (button.dataset.bj) { void blackjackAction(button.dataset.bj); return; }
  if (button.dataset.patience) { void patienceAction(button.dataset.patience); return; }
  if (button.dataset.cardSource || button.dataset.cardTarget) { clickPatience(button, event.detail); return; }
  if (button.dataset.column !== undefined) { clickFour(Number(button.dataset.column)); return; }
  if (button.dataset.square !== undefined) { clickDraughts(Number(button.dataset.square)); return; }
  if (button.dataset.chessSquare !== undefined) { clickChess(Number(button.dataset.chessSquare)); return; }
  if (button.dataset.point !== undefined) { clickGo(Number(button.dataset.point)); return; }
  if (button.dataset.cell !== undefined && state.sudoku) {
    state.sudoku.selected = Number(button.dataset.cell);
    if (state.preferences.sudokuDigitFirst && !state.sudoku.puzzle[state.sudoku.selected] && !sudokuSolved(state.sudoku)) { enterNumber(sudokuDigit); return; }
    persist(); render(); return;
  }
  if (button.dataset.number !== undefined) { chooseSudokuNumber(Number(button.dataset.number)); return; }
  if (action === 'new-game' || action === 'play-again') { confirmNew(); return; }
  if (action === 'undo') { undo(); return; }
  if (action === 'pass') { if (advancedHumanTurn('go')) commitGo(null); return; }
  if (action === 'finish-go') { finishGo(state.go); message = ''; persist(); render(); return; }
  if (action === 'resume-go') { resumeGo(state.go); message = 'Play resumed. Settle disputed groups before passing again.'; persist(); render(); scheduleComputer(); return; }
  const s = state.sudoku;
  if (state.preferences.game !== 'sudoku' || !s || busy === 'sudoku') return;
  if (action === 'next-empty' && !s.paused) {
    for (let offset = 1; offset <= s.values.length; offset++) { const next = (s.selected + offset) % s.values.length; if (!s.values[next]) { s.selected = next; break; } }
    message = 'Empty cell selected. Possible digits have a dotted underline on the number pad.';
  }
  if (action === 'notes') state.preferences.notes = !state.preferences.notes;
  if (action === 'digit-first') { state.preferences.sudokuDigitFirst = !state.preferences.sudokuDigitFirst; sudokuDigit = Math.min(sudokuDigit, s.size); message = state.preferences.sudokuDigitFirst ? 'Choose a number, then tap cells to enter it. Notes mode paints pencil marks.' : 'Choose a cell, then enter a number.'; }
  if (action === 'erase') { enterNumber(0, false); return; }
  if (action === 'redo') { undoSudoku(s, true); checked = []; pendingHint = null; message = 'Entry restored.'; }
  if (action === 'auto-notes') { autoNotes(s); message = 'Candidates filled in. These follow your current entries.'; }
  if (action === 'check') {
    checked = s.values.flatMap((n, i) => n && n !== s.solution[i] ? [i] : []);
    message = checked.length ? `${checked.length} incorrect entr${checked.length === 1 ? 'y' : 'ies'} marked. Select one to try again.` : 'All your entries agree with the solution so far.';
  }
  if (action === 'hint') { pendingHint = findHint(s); if (pendingHint) s.selected = pendingHint.index; }
  if (action === 'dismiss-hint') pendingHint = null;
  if (action === 'apply-hint' && pendingHint) {
    const hint = pendingHint;
    if (setValue(s, hint.index, hint.correction ? 0 : hint.value)) {
      s.hints++; checked = []; pendingHint = null;
      message = hint.correction ? 'Entry cleared. Try its candidates.' : sudokuSolved(s) ? 'Puzzle complete. Nicely played!' : 'Hint placed. Keep going!';
    }
  }
  if (action === 'pause' || action === 'resume') { tickTimer(); s.paused = !s.paused; timerStart = performance.now(); message = ''; pendingHint = null; }
  persist(); render();
  if (action === 'next-empty') app.querySelector<HTMLElement>(`[data-cell="${s.selected}"]`)?.focus({ preventScroll: true });
});

function clearCardDrag(): void {
  if (!pointerDrag) return;
  const drag = pointerDrag; pointerDrag = null;
  drag.ghost?.remove(); drag.originals.forEach(el => { el.style.visibility = ''; });
  if (drag.target.hasPointerCapture(drag.pointer)) drag.target.releasePointerCapture(drag.pointer);
}
app.addEventListener('pointerdown', event => {
  const el = (event.target as HTMLElement).closest<HTMLElement>('[data-card-source]');
  const from = decodeSource(el?.dataset.cardSource ?? '');
  if (!el || !from || !state.patience || patienceWon(state.patience) || state.preferences.game !== 'patience' || cardBusy || autoFoundations || event.button !== 0 || !event.isPrimary) return;
  clearCardDrag();
  pointerDrag = { from, pointer: event.pointerId, target: el, x: event.clientX, y: event.clientY, ghost: null, originals: [] };
  el.setPointerCapture(event.pointerId);
});
app.addEventListener('pointermove', event => {
  const drag = pointerDrag;
  if (!drag || drag.pointer !== event.pointerId || !state.patience) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (!drag.ghost && Math.hypot(dx, dy) < 7) return;
  event.preventDefault();
  if (!drag.ghost) {
    patienceSelected = drag.from; cardHint = null;
    const bounds = drag.target.getBoundingClientRect(), cards = sourceCards(state.patience, drag.from);
    const ghost = document.createElement('div'); ghost.className = 'patience-board card-drag-stack'; ghost.setAttribute('aria-hidden', 'true');
    ghost.style.left = `${bounds.left}px`; ghost.style.top = `${bounds.top}px`; ghost.style.width = `${bounds.width}px`;
    for (const card of cards) {
      const original = app.querySelector<HTMLElement>(`[data-card-key="p-${card}"]`);
      if (!original) continue;
      const cardBounds = original.getBoundingClientRect(), clone = original.cloneNode(true) as HTMLElement;
      clone.style.top = `${cardBounds.top - bounds.top}px`; clone.style.left = '0'; clone.style.width = `${cardBounds.width}px`; clone.style.height = `${cardBounds.height}px`;
      ghost.append(clone); original.style.visibility = 'hidden'; drag.originals.push(original);
    }
    document.body.append(ghost); drag.ghost = ghost;
    app.querySelectorAll<HTMLElement>('[data-card-target]').forEach(target => {
      const to = decodeTarget(target.dataset.cardTarget!);
      if (to && canMovePatience(state.patience!, drag.from, to)) target.classList.add('valid-card-target');
    });
  }
  drag.ghost.style.transform = `translate(${dx}px,${dy}px)`;
});
app.addEventListener('pointerup', event => {
  const drag = pointerDrag;
  if (!drag || drag.pointer !== event.pointerId) return;
  if (!drag.ghost) { clearCardDrag(); return; }
  event.preventDefault(); suppressCardClickUntil = performance.now() + 200;
  const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-card-target]');
  const to = decodeTarget(hit?.dataset.cardTarget ?? '');
  if (to && state.patience && canMovePatience(state.patience, drag.from, to)) {
    const positions = cardMotion.capture(app);
    drag.ghost.querySelectorAll<HTMLElement>('[data-card-key]').forEach(el => { positions.set(el.dataset.cardKey!, { bounds: el.getBoundingClientRect(), face: el.dataset.face }); });
    clearCardDrag(); pendingCardPositions = positions; moveSelectedCards(drag.from, to);
  } else { clearCardDrag(); render(); }
});
app.addEventListener('pointercancel', () => { clearCardDrag(); if (!cardBusy && !isActionGame(state.preferences.game)) render(); });
window.addEventListener('blur', clearCardDrag);

app.addEventListener('focusin', event => {
  const el = event.target as HTMLElement;
  if (el.dataset.column !== undefined) fourFocus = Number(el.dataset.column);
  if (el.dataset.square !== undefined) {
    focusSquare = Number(el.dataset.square);
    app.querySelectorAll<HTMLButtonElement>('[data-square]').forEach(b => { b.tabIndex = b === el ? 0 : -1; });
  }
  if (el.dataset.chessSquare !== undefined) {
    chessFocus = Number(el.dataset.chessSquare);
    app.querySelectorAll<HTMLButtonElement>('[data-chess-square]').forEach(b => { b.tabIndex = b === el ? 0 : -1; });
  }
  if (el.dataset.point !== undefined) {
    goFocus = Number(el.dataset.point);
    app.querySelectorAll<HTMLButtonElement>('[data-point]').forEach(b => { b.tabIndex = b === el ? 0 : -1; });
  }
});

document.addEventListener('keydown', event => {
  const target = event.target as HTMLElement;
  if (event.key === 'Enter' && (target.id === 'live-count' || target.id === 'drill-answer')) { event.preventDefault(); countingTutor.action(target.id === 'live-count' ? 'live-check' : 'answer'); return; }
  if (target.matches('input, select, textarea') || document.querySelector('dialog[open]')) return;
  if (isPlus(state.preferences.game)) { plus.keydown(event); return; }
  if (collectionRoute(state)) { collection.keydown(event); return; }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey && state.preferences.game === 'sudoku' && state.sudoku) {
      undoSudoku(state.sudoku, true); pendingHint = null; checked = []; persist(); render();
    } else undo();
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const game = state.preferences.game;
  if (game === 'chess' && event.key === 'Escape') { event.preventDefault(); chessSelected = null; message = ''; render(); return; }
  if (game === 'go' && event.key === 'Escape') { event.preventDefault(); pendingGo = null; goInspectMode = false; goInspect = null; message = ''; render(); return; }
  if (isActionGame(game)) { actionArcade.keydown(event); return; }
  if (isArcade(game)) { arcade.keydown(event); return; }
  if (game === 'poker') { if (state.poker.phase === 'draw' && /^[1-5]$/.test(event.key)) { event.preventDefault(); pokerRoom.action(`discard:${Number(event.key) - 1}`); return; } if (state.poker.phase === 'draw' && event.key === 'Escape') { event.preventDefault(); pokerRoom.action('keep-all'); return; } const keys: Record<string, string> = { c: state.poker.contributions[0] >= state.poker.highest ? 'check' : 'call', r: 'raise', f: 'fold', d: 'deal', e: 'exchange' }; const key = keys[event.key.toLowerCase()]; if (key) { event.preventDefault(); pokerRoom.action(key); } return; }
  if (game === 'blackjack') {
    if (event.key.toLowerCase() === 'd' && ['betting', 'settled'].includes(state.blackjack.phase)) { event.preventDefault(); void blackjackAction('deal'); return; }
    const actions: Record<string, string> = { h: 'hit', s: 'stand', d: 'double', p: 'split' };
    const action = actions[event.key.toLowerCase()];
    if (action) { event.preventDefault(); void blackjackAction(action); }
    return;
  }
  if (game === 'patience') {
    if (event.key.startsWith('Arrow') && state.patience && target.closest('.patience-board')) {
      const from = decodeSource(target.dataset.cardSource ?? ''), to = decodeTarget(target.closest<HTMLElement>('[data-card-target]')?.dataset.cardTarget ?? '');
      if (from?.pile === 'tableau' || to?.pile === 'tableau') {
        event.preventDefault(); const s = state.patience;
        const index = from?.index ?? to!.index, next = Math.max(0, Math.min(6, index + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0)));
        const pile = s.tableau[next], first = pile.findIndex(c => c.up);
        const at = Math.max(first, Math.min(pile.length - 1, (from?.at ?? pile.length - 1) + (next === index ? event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0 : 0)));
        (pile.length ? app.querySelector<HTMLElement>(`[data-card-source="tableau:${next}:${at}"]`) : app.querySelector<HTMLElement>(`button[data-card-target="tableau:${next}"]`))?.focus();
        return;
      }
    }
    const actions: Record<string, string> = { d: 'draw', h: 'hint', a: 'auto' };
    const action = actions[event.key.toLowerCase()];
    if (action) { event.preventDefault(); void patienceAction(action); }
    if (event.key === 'Escape' && !cardBusy) { patienceSelected = null; cardHint = null; message = ''; render(); }
    return;
  }
  if ((game === 'chess' || game === 'go') && (target.id === 'board' || target.dataset.chessSquare !== undefined || target.dataset.point !== undefined)) {
    const allowed = game === 'chess' ? advancedHumanTurn('chess') : !moving && (goInspectMode || advancedHumanTurn('go') || (state.go.phase === 'score' && state.go.result === null));
    if (!allowed) return;
    const size = game === 'chess' ? 8 : state.go.size;
    const index = game === 'chess' ? Number(target.dataset.chessSquare ?? chessFocus) : Number(target.dataset.point ?? goFocus);
    const attr = game === 'chess' ? 'data-chess-square' : 'data-point';
    if (event.key === 'Enter' && target.id === 'board') { event.preventDefault(); if (game === 'chess') clickChess(index); else clickGo(index); return; }
    if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      const flipped = game === 'chess' && (chessFlipped ?? (state.chess.options.mode === 'computer' && state.chess.options.human === -1));
      const direction = flipped ? -1 : 1;
      const dr = (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0) * direction;
      const dc = (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0) * direction;
      let row = Math.floor(index / size), col = index % size;
      for (let step = 0; step < size; step++) {
        row += dr; col += dc;
        if (row < 0 || col < 0 || row >= size || col >= size) break;
        const destination = app.querySelector<HTMLButtonElement>(`[${attr}="${row * size + col}"]`);
        if (destination && !destination.disabled) { destination.focus(); break; }
      }
      return;
    }
  }
  if (game === 'four' && /^[1-7]$/.test(event.key)) { event.preventDefault(); clickFour(Number(event.key) - 1); return; }
  if (game === 'four' && target.closest('#board') && hasHumanTurn('four')) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' || event.key === 'End' ? -1 : 1;
      let col = event.key === 'Home' ? 0 : event.key === 'End' ? 6 : (fourFocus + direction + 7) % 7;
      for (let n = 0; n < 7; n++, col = (col + direction + 7) % 7) {
        if (dropRow(state.four.board, col) >= 0) { app.querySelector<HTMLElement>(`[data-column="${col}"]`)?.focus(); break; }
      }
      return;
    }
    if (event.key === 'Enter' && target.id === 'board') { event.preventDefault(); clickFour(fourFocus); return; }
    if (event.key === 'Escape') { event.preventDefault(); fourHint = null; fourPending = null; message = ''; render(); return; }
  }
  if (game === 'draughts' && target.id === 'board' && hasHumanTurn('draughts') && (event.key.startsWith('Arrow') || event.key === 'Enter')) {
    event.preventDefault();
    app.querySelector<HTMLElement>(`[data-square="${focusSquare}"]`)?.focus();
    if (event.key === 'Enter') clickDraughts(focusSquare);
    return;
  }
  if (game === 'draughts' && target.dataset.square !== undefined && event.key.startsWith('Arrow')) {
    event.preventDefault();
    const i = Number(target.dataset.square), r = Math.floor(i / 8), c = i % 8;
    let nr = r, nc = c;
    const direction = (draughtsFlipped ?? (state.draughts.options.mode === 'computer' && state.draughts.options.human === -1)) ? -1 : 1;
    if (event.key === 'ArrowLeft') nc = Math.max(0, Math.min(7, c - 2 * direction));
    if (event.key === 'ArrowRight') nc = Math.max(0, Math.min(7, c + 2 * direction));
    if (event.key === 'ArrowUp') nr = Math.max(0, Math.min(7, r - direction));
    if (event.key === 'ArrowDown') nr = Math.max(0, Math.min(7, r + direction));
    if ((nr + nc) % 2 === 0) nc += nc < 7 ? 1 : -1;
    app.querySelector<HTMLElement>(`[data-square="${nr * 8 + nc}"]`)?.focus(); return;
  }
  const s = state.sudoku;
  if (game !== 'sudoku' || !s || s.paused || busy === 'sudoku') return;
  if (event.key.startsWith('Arrow') && target.closest('#board')) {
    event.preventDefault();
    const r = Math.floor(s.selected / s.size), c = s.selected % s.size;
    let nr = r, nc = c;
    if (event.key === 'ArrowLeft') nc = Math.max(0, c - 1);
    if (event.key === 'ArrowRight') nc = Math.min(s.size - 1, c + 1);
    if (event.key === 'ArrowUp') nr = Math.max(0, r - 1);
    if (event.key === 'ArrowDown') nr = Math.min(s.size - 1, r + 1);
    s.selected = nr * s.size + nc;
    render(); app.querySelector<HTMLElement>(`[data-cell="${s.selected}"]`)?.focus(); persist(); return;
  }
  const key = event.key.toUpperCase();
  const shiftedDigit = event.shiftKey && /^(Digit|Numpad)[1-9]$/.test(event.code) ? Number(event.code.at(-1)) : 0;
  const n = shiftedDigit || (/^[1-9]$/.test(key) ? Number(key) : s.size === 12 && 'ABC'.includes(key) && key.length === 1 ? 'ABC'.indexOf(key) + 10 : 0);
  if (n && n <= s.size) { event.preventDefault(); if (event.shiftKey) enterNumber(n, true); else chooseSudokuNumber(n); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); enterNumber(0, false); }
  if (key === 'N') { state.preferences.notes = !state.preferences.notes; persist(); render(); }
});

setInterval(tickTimer, 250);
setInterval(persist, 10_000);
document.addEventListener('visibilitychange', () => { tickTimer(); timerStart = performance.now(); persist(); if (!document.hidden) render(); });
window.addEventListener('pagehide', () => { tickTimer(); persist(); });
if (state.preferences.game === 'patience' && !state.patience) state.patience = newPatience(state.preferences.patienceDraw);
if (isArcade(state.preferences.game)) arcade.ensure(state.preferences.game);
if (isActionGame(state.preferences.game)) actionArcade.ensure(state.preferences.game);
persist(); render();
if (state.preferences.game === 'sudoku' && !state.sudoku) makePuzzle();
else scheduleComputer();

app.addEventListener('input', event => { const input = event.target; if (input instanceof HTMLInputElement && input.id === 'game-search') { const cursor=input.selectionStart; lobbySearch=input.value; render(); const next=app.querySelector<HTMLInputElement>('#game-search'); next?.focus({preventScroll:true}); if(cursor!==null) next?.setSelectionRange(cursor,cursor); } });
