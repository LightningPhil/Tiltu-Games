import {PLUS_GAMES} from './club-plus/meta.ts';
import type {PlusGame} from './club-plus/meta.ts';
import {emptyPlus,restorePlus} from './club-plus/store.ts';
import type {PlusStore} from './club-plus/store.ts';
import { COLLECTION_GAMES, emptyCollection, restoreCollection } from './collection/store.ts';
import type { CollectionGame, CollectionStore } from './collection/store.ts';
import type { PatienceVariant } from './collection/patience-collection.ts';
import { drawReason, initialBoard, other, positionKey, winner } from './rules.ts';
import type { Board, DuelGame, Player } from './rules.ts';
import { conflicts } from './sudoku.ts';
import type { SudokuSession, SudokuSnapshot, SudokuSize } from './sudoku.ts';
import { chessEngine, chessOutcome, newChess } from './chess.ts';
import type { ChessSession } from './chess.ts';
import { finishGo, goGroup, newGo, playGo } from './go.ts';
import type { GoSession, GoSize } from './go.ts';
import type { MotionSpeed } from './movement.ts';
import { newBlackjack, restoreBlackjack } from './blackjack.ts';
import type { BlackjackSession } from './blackjack.ts';
import { restorePatience } from './patience.ts';
import type { DrawCount, PatienceSession } from './patience.ts';
import { restoreMines } from './minesweeper.ts';
import type { MineLevel, MineSession } from './minesweeper.ts';
import { restoreLife } from './life.ts';
import type { LifeMode, LifeSession } from './life.ts';
import { restoreTetra } from './tetravex.ts';
import type { TetraSession, TetraSize } from './tetravex.ts';
import { restoreSki } from './ski.ts';
import type { SkiMode, SkiSession } from './ski.ts';
import { newPoker, restorePoker } from './poker.ts';
import type { PokerSession, PokerVariant } from './poker.ts';
import { restoreCountDrill } from './counting.ts';
import type { CountDrill } from './counting.ts';
import {ACTION_GAMES,emptyActionArcade,restoreActionArcade} from './action-games.ts';
import type {ActionGame,ActionStore} from './action-games.ts';

export const THEMES = ['tron', 'pulse', 'classic', 'midnight', 'woodland'] as const;
export type Theme = typeof THEMES[number];
export type MatchGame = DuelGame | 'chess' | 'go';
export type ArcadeGame = 'mines' | 'life' | 'ski' | 'tetravex';
export type Game = 'home' | MatchGame | 'sudoku' | 'blackjack' | 'patience' | ArcadeGame | 'poker' | CollectionGame | PlusGame | ActionGame;
export const GAMES: Game[] = ['home', 'four', 'draughts', 'sudoku', 'chess', 'go', 'blackjack', 'patience', 'mines', 'life', 'ski', 'tetravex', 'poker', ...COLLECTION_GAMES, ...PLUS_GAMES, ...ACTION_GAMES];
export interface MatchOptions { mode: 'computer' | 'local'; level: number; human: Player; starter: Player }
export interface DuelSnapshot { board: Board; turn: Player; quiet: number }
export interface DuelSession extends DuelSnapshot {
  options: MatchOptions; history: DuelSnapshot[]; moves: { player: Player; text: string }[];
  result: Player | 0 | null; reason: string; scores: [number, number, number];
}
export interface Preferences { patienceVariant: PatienceVariant; fourConfirm: boolean; goConfirm: boolean; sudokuDigitFirst: boolean; skiInput: 'keys' | 'mouse'; theme: Theme; game: Game; four: MatchOptions; draughts: MatchOptions; chess: MatchOptions; go: MatchOptions; goSize: GoSize; motion: MotionSpeed; size: SudokuSize; difficulty: number; notes: boolean; patienceDraw: DrawCount; mineLevel: MineLevel; lifeMode: LifeMode; lifeOpponent: 'computer' | 'local'; lifeSpeed: number; tetraSize: TetraSize; skiMode: SkiMode; pokerVariant: PokerVariant; pokerLevel: number; lifeLevel: number; tutorChess: boolean; tutorDraughts: boolean; tutorPoker: boolean; tutorCounting: boolean }
export interface SavedState { actionArcade: ActionStore; plus: PlusStore; collection: CollectionStore; preferences: Preferences; four: DuelSession; draughts: DuelSession; chess: ChessSession; go: GoSession; sudoku: SudokuSession | null; blackjack: BlackjackSession; patience: PatienceSession | null; mines: MineSession | null; life: LifeSession | null; tetravex: TetraSession | null; ski: SkiSession | null; poker: PokerSession; counting: CountDrill | null; lessons: { chess: number; draughts: number } }
export const defaultOptions = (): MatchOptions => ({ mode: 'computer', level: 3, human: 1, starter: 1 });
export const defaultPreferences = (): Preferences => ({ patienceVariant: 'klondike', fourConfirm: false, goConfirm: false, sudokuDigitFirst: false, skiInput: 'keys', theme: 'tron', game: 'home', four: defaultOptions(), draughts: defaultOptions(), chess: defaultOptions(), go: defaultOptions(), goSize: 9, motion: 'steady', size: 9, difficulty: 2, notes: false, patienceDraw: 1, mineLevel: 'beginner', lifeMode: 'sandbox', lifeOpponent: 'computer', lifeSpeed: 250, tetraSize: 3, skiMode: 'free', pokerVariant: 'holdem', pokerLevel: 3, lifeLevel: 3, tutorChess: true, tutorDraughts: true, tutorPoker: true, tutorCounting: true });

export function newDuel(game: DuelGame, options: MatchOptions, scores: [number, number, number] = [0, 0, 0]): DuelSession {
  return { board: initialBoard(game), turn: options.starter, quiet: 0, options: { ...options }, history: [], moves: [], result: null, reason: '', scores: [...scores] };
}
export function updateResult(game: DuelGame, s: DuelSession): void {
  s.result = winner(game, s.board, s.turn);
  s.reason = '';
  if (s.result === null && game === 'draughts') {
    const positions = [...s.history.map(h => positionKey(h.board, h.turn)), positionKey(s.board, s.turn)];
    s.reason = drawReason(positions, s.quiet) ?? '';
    if (s.reason) s.result = 0;
  }
  if (s.result !== null) s.scores[s.result === 1 ? 0 : s.result === -1 ? 1 : 2]++;
}

export function undoDuel(s: DuelSession): boolean {
  if (!s.history.length) return false;
  if (s.options.mode === 'computer' && !s.history.some(h => h.turn === s.options.human)) return false;
  if (s.result !== null) s.scores[s.result === 1 ? 0 : s.result === -1 ? 1 : 2]--;
  let count = 1;
  if (s.options.mode === 'computer') {
    // Rewind through the reply, or just the human move if the computer was thinking.
    for (let i = s.history.length - 1; i >= 0; i--) {
      if (s.history[i].turn === s.options.human) { count = s.history.length - i; break; }
    }
  }
  while (count-- > 0) {
    const previous = s.history.pop()!;
    s.board = previous.board.slice(); s.turn = previous.turn; s.quiet = previous.quiet; s.moves.pop();
  }
  s.result = null; s.reason = '';
  return true;
}

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
const player = (value: unknown): value is Player => value === 1 || value === -1;
const numbers = (value: unknown, length: number, min: number, max: number): value is number[] => Array.isArray(value) && value.length === length && value.every(v => integer(v, min, max));
function options(value: unknown): value is MatchOptions {
  return object(value) && ['computer', 'local'].includes(value.mode as string) && integer(value.level, 1, 5) && player(value.human) && player(value.starter);
}
function duelSnapshot(value: unknown, game: DuelGame): value is DuelSnapshot {
  if (!object(value) || !numbers(value.board, game === 'four' ? 42 : 64, game === 'four' ? -1 : -2, game === 'four' ? 1 : 2) || !player(value.turn) || !integer(value.quiet, 0, 1000)) return false;
  if (game === 'draughts') return value.board.every((n, i) => !n || (Math.floor(i / 8) + i % 8) % 2 === 1);
  for (let col = 0; col < 7; col++) {
    let foundPiece = false;
    for (let row = 0; row < 6; row++) { if (value.board[row * 7 + col]) foundPiece = true; else if (foundPiece) return false; }
  }
  return true;
}
function duel(value: unknown, game: DuelGame): value is DuelSession {
  return object(value) && duelSnapshot(value, game) && options(value.options)
    && Array.isArray(value.history) && value.history.length <= 1000 && value.history.every(h => duelSnapshot(h, game))
    && Array.isArray(value.moves) && value.moves.length === value.history.length
    && value.moves.every(m => object(m) && player(m.player) && typeof m.text === 'string' && m.text.length < 120)
    && (value.result === null || value.result === 0 || player(value.result)) && typeof value.reason === 'string' && value.reason.length < 120
    && numbers(value.scores, 3, 0, 100000);
}
function sudokuSnapshot(value: unknown, size: SudokuSize): value is SudokuSnapshot {
  return object(value) && numbers(value.values, size * size, 0, size) && integer(value.hints, 0, 100000)
    && Array.isArray(value.notes) && value.notes.length === size * size
    && value.notes.every(n => Array.isArray(n) && n.length <= size && n.every(v => integer(v, 1, size)));
}
function sudoku(value: unknown): value is SudokuSession {
  if (!object(value) || ![4, 6, 9, 12].includes(value.size as number)) return false;
  const size = value.size as SudokuSize;
  return sudokuSnapshot(value, size) && numbers(value.puzzle, size * size, 0, size) && numbers(value.solution, size * size, 1, size)
    && !conflicts(value.solution, size).length && value.puzzle.every((n, i) => !n || n === (value.solution as number[])[i])
    && value.puzzle.every((n, i) => !n || n === (value.values as number[])[i])
    && integer(value.selected, 0, size * size - 1) && integer(value.difficulty, 1, 4) && integer(value.elapsed, 0, 10000000) && typeof value.paused === 'boolean'
    && [value.history, value.redo].every(h => Array.isArray(h) && h.length <= 150 && h.every(v => sudokuSnapshot(v, size)));
}

export const STORAGE_KEY = 'grid-club-v1';
export function freshState(): SavedState {
  const preferences = defaultPreferences();
  return { actionArcade: emptyActionArcade(), plus: emptyPlus(), collection: emptyCollection(), preferences, four: newDuel('four', preferences.four), draughts: newDuel('draughts', preferences.draughts), chess: newChess(preferences.chess), go: newGo(preferences.goSize, preferences.go), sudoku: null, blackjack: newBlackjack(), patience: null, mines: null, life: null, tetravex: null, ski: null, poker: newPoker(), counting: null, lessons: { chess: 0, draughts: 0 } };
}
export function parseState(raw: string | null): SavedState {
  const state = freshState();
  if (!raw || raw.length > 4_000_000) return state;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!object(saved) || saved.version !== 1) return state;
    state.collection = restoreCollection(saved.collection);
    state.plus = restorePlus(saved.plus);
    state.actionArcade = restoreActionArcade(saved.actionArcade);
    if (object(saved.preferences)) {
      const p = saved.preferences;
      if (['klondike','freecell','spider'].includes(p.patienceVariant as string)) state.preferences.patienceVariant = p.patienceVariant as PatienceVariant;
      if (THEMES.includes(p.theme as Theme)) state.preferences.theme = p.theme as Theme;
      if (GAMES.includes(p.game as Game)) state.preferences.game = p.game as Game;
      if (options(p.four)) state.preferences.four = p.four;
      if (options(p.draughts)) state.preferences.draughts = p.draughts;
      if (options(p.chess)) state.preferences.chess = { ...p.chess, starter: 1 };
      if (options(p.go)) state.preferences.go = { ...p.go, starter: 1 };
      if ([9, 13, 19].includes(p.goSize as number)) state.preferences.goSize = p.goSize as GoSize;
      if (['relaxed', 'steady', 'quick'].includes(p.motion as string)) state.preferences.motion = p.motion as MotionSpeed;
      if ([4, 6, 9, 12].includes(p.size as number)) state.preferences.size = p.size as SudokuSize;
      if (integer(p.difficulty, 1, 4)) state.preferences.difficulty = p.difficulty;
      if (typeof p.notes === 'boolean') state.preferences.notes = p.notes;
      if (typeof p.fourConfirm === 'boolean') state.preferences.fourConfirm = p.fourConfirm;
      if (typeof p.goConfirm === 'boolean') state.preferences.goConfirm = p.goConfirm;
      if (typeof p.sudokuDigitFirst === 'boolean') state.preferences.sudokuDigitFirst = p.sudokuDigitFirst;
      if (p.skiInput === 'keys' || p.skiInput === 'mouse') state.preferences.skiInput = p.skiInput;
      if (p.patienceDraw === 1 || p.patienceDraw === 3) state.preferences.patienceDraw = p.patienceDraw;
      if (['beginner', 'intermediate', 'expert'].includes(p.mineLevel as string)) state.preferences.mineLevel = p.mineLevel as MineLevel;
      if (p.lifeMode === 'sandbox' || p.lifeMode === 'garden' || p.lifeMode === 'colonies') state.preferences.lifeMode = p.lifeMode;
      for (const key of ['pokerLevel','lifeLevel'] as const) if(integer(p[key],1,5))state.preferences[key]=p[key];
      if (p.lifeOpponent === 'computer' || p.lifeOpponent === 'local') state.preferences.lifeOpponent = p.lifeOpponent;
      if ([65, 125, 250, 500, 1000].includes(p.lifeSpeed as number)) state.preferences.lifeSpeed = p.lifeSpeed as number;
      if ([2, 3, 4].includes(p.tetraSize as number)) state.preferences.tetraSize = p.tetraSize as TetraSize;
      if (['free', 'slalom', 'freestyle'].includes(p.skiMode as string)) state.preferences.skiMode = p.skiMode as SkiMode;
      if (['holdem', 'omaha', 'draw'].includes(p.pokerVariant as string)) state.preferences.pokerVariant = p.pokerVariant as PokerVariant;
      for (const key of ['tutorChess', 'tutorDraughts', 'tutorPoker', 'tutorCounting'] as const) if (typeof p[key] === 'boolean') state.preferences[key] = p[key];
    }
    if (duel(saved.four, 'four')) state.four = saved.four;
    if (duel(saved.draughts, 'draughts')) state.draughts = saved.draughts;
    if (sudoku(saved.sudoku)) state.sudoku = saved.sudoku;
    state.blackjack = restoreBlackjack(saved.blackjack) ?? state.blackjack;
    state.patience = restorePatience(saved.patience);
    state.mines = restoreMines(saved.mines); state.life = restoreLife(saved.life); state.tetravex = restoreTetra(saved.tetravex); state.ski = restoreSki(saved.ski);
    state.poker = restorePoker(saved.poker) ?? state.poker; state.counting = restoreCountDrill(saved.counting);
    if (object(saved.lessons)) for (const game of ['chess', 'draughts'] as const) if (integer(saved.lessons[game], 0, 63)) state.lessons[game] = saved.lessons[game] as number;
    if (object(saved.chess) && options(saved.chess.options) && typeof saved.chess.startFen === 'string' && saved.chess.startFen.length < 120
      && Array.isArray(saved.chess.moves) && saved.chess.moves.length <= 1000 && saved.chess.moves.every(m => typeof m === 'string' && m.length < 20) && numbers(saved.chess.scores, 3, 0, 100000)) {
      try {
        const candidate = saved.chess as unknown as ChessSession, engine = chessEngine(candidate);
        state.chess = { ...candidate, options: { ...candidate.options, starter: 1 }, ...chessOutcome(engine) };
      } catch { /* Invalid chess history is isolated from the other saved games. */ }
    }
    if (object(saved.go) && options(saved.go.options) && [9, 13, 19].includes(saved.go.size as number) && saved.go.komi === 7.5
      && Array.isArray(saved.go.moves) && saved.go.moves.length <= 1500 && numbers(saved.go.scores, 3, 0, 100000)) {
      try {
        const g = saved.go, candidate = newGo(g.size as GoSize, g.options as MatchOptions, g.scores as [number, number, number]);
        for (const m of g.moves as unknown[]) {
          if (!object(m) || m.player !== candidate.turn || (m.point !== null && !integer(m.point, 0, candidate.board.length - 1))) throw new Error('Bad Go move');
          if (playGo(candidate, m.point as number | null).error) throw new Error('Illegal Go move');
        }
        if (!numbers(g.board, candidate.board.length, -1, 1) || JSON.stringify(g.board) !== JSON.stringify(candidate.board)) throw new Error('Bad Go board');
        if (candidate.phase === 'score' && Array.isArray(g.dead) && g.dead.length <= candidate.board.length && g.dead.every(i => integer(i, 0, candidate.board.length - 1) && candidate.board[i])) candidate.dead = [...new Set(g.dead.flatMap(i => goGroup(candidate.board, candidate.size, i as number).stones))];
        if (candidate.phase === 'score' && (g.result === 1 || g.result === -1 || g.result === 0)) {
          finishGo(candidate); candidate.scores = [...g.scores as [number, number, number]];
        }
        state.go = candidate;
      } catch { /* Recover only this game when its move history is damaged. */ }
    }
  } catch { /* A damaged or older save should never stop play. */ }
  return state;
}

export function loadState(): SavedState {
  try { return parseState(localStorage.getItem(STORAGE_KEY)); } catch { return freshState(); }
}
export function saveState(state: SavedState): boolean {
  try {
    // Go's positions are reconstructed from its move list on load. Do not store
    // a second, potentially enormous copy of every 19 × 19 position.
    let payload = { version: 1, ...state, go: { ...state.go, history: [] as GoSession['history'] } };
    let raw = JSON.stringify(payload);
    const compact = (budget: number): string => {
      const copy = structuredClone(payload);
      const sessions = [copy.four, copy.draughts, copy.sudoku, copy.patience, copy.life, copy.tetravex, ...Object.values(copy.collection), ...Object.values(copy.plus)].filter(Boolean) as { history: unknown[]; moves?: unknown; records?: unknown[] }[];
      const minimum = budget < 1_000_000 ? 2 : 8;
      const sizes = sessions.filter(s => Array.isArray(s.history)).map(session => ({ session, bytes: JSON.stringify(session.history).length }));
      let estimated = JSON.stringify(copy).length;
      while (estimated > budget) {
        const largest = sizes.filter(e => e.session.history.length > minimum).sort((a,b) => b.bytes-a.bytes)[0];
        if (!largest) break;
        const session = largest.session, cut = Math.min(session.history.length-minimum, Math.max(1,Math.floor(session.history.length/2)));
        session.history.splice(0, cut);
        if (Array.isArray(session.moves)) session.moves.splice(0, cut);
        if (Array.isArray(session.records)) session.records.splice(0, cut);
        const bytes = JSON.stringify(session.history).length;
        estimated -= largest.bytes-bytes; largest.bytes=bytes;
        if (estimated <= budget) estimated=JSON.stringify(copy).length;
      }
      raw=JSON.stringify(copy); payload = copy; return raw;
    };
    if (raw.length > 1_800_000) raw = compact(1_800_000);
    try { localStorage.setItem(STORAGE_KEY, raw); }
    catch (error) {
      if (!(error instanceof Error) || error.name !== 'QuotaExceededError') return false;
      localStorage.setItem(STORAGE_KEY, compact(900_000));
    }
    return true;
  } catch { return false; }
}
