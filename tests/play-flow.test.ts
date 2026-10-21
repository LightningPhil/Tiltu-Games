import assert from 'node:assert/strict';
import { test } from 'node:test';
import { explainFour, fourThreats } from '../src/four-guide.ts';
import { initialBoard } from '../src/rules.ts';
import { applyMove } from '../src/rules.ts';
import { freshState, parseState } from '../src/state.ts';
import { matchFrames } from '../src/match-review.ts';
import { playChess } from '../src/chess.ts';
import { playGo } from '../src/go.ts';
import { candidates, cellGuide, generatePuzzle, newSudoku, setValue, undoSudoku } from '../src/sudoku.ts';
import { chessArena, goArena } from '../src/advanced-view.ts';
import { canFinishPatience, newPatience, movePatience, patienceMoves, patienceWon, safeFoundation, undoPatience } from '../src/patience.ts';
import { newMines, openMine, flagMine, mineHint, restoreMines } from '../src/minesweeper.ts';
import { newLife, lifePattern, LIFE_PATTERNS, stampLife, stepLife, saveLifeBookmark, swapLifeBookmark, restoreLife, resizeLife, undoLife, seedLife, undoLifeReplacement } from '../src/life.ts';
import { POKER_HAND_LESSONS } from '../src/poker-lessons.ts';
import { evaluateFive } from '../src/poker.ts';

test('four tutor distinguishes a playable win, a block and unsupported gaps without changing the board', () => {
  const board = initialBoard('four'); board[35] = board[36] = board[37] = 1;
  const before = board.slice();
  assert.deepEqual(fourThreats(board, 1).map(t => t.column), [3]);
  assert.match(explainFour(board, 1, 3).text, /Play it to win/);
  assert.match(explainFour(board, -1, 3).text, /stops their immediate win/);
  assert.deepEqual(explainFour(board, -1, 3).cells, [35, 36, 37, 38]);
  assert.deepEqual(board, before);
  const unsupported = initialBoard('four'); unsupported[28] = unsupported[29] = unsupported[30] = 1;
  assert.equal(fourThreats(unsupported, 1).length, 0);
});

test('match review reconstructs every draughts jump without changing the match', () => {
  const state = freshState(), s = state.draughts;
  s.board.fill(0); s.board[42] = 1; s.board[35] = s.board[21] = -1;
  const move = { from: 42, path: [28, 14], captures: [35, 21] };
  s.history.push({ board: s.board.slice(), turn: 1, quiet: 0 });
  s.moves.push({ player: 1, text: 'c3 × e5 × g7' }); s.board = applyMove('draughts', s.board, 1, move);
  const before = structuredClone(state), frames = matchFrames(state, 'draughts');
  assert.deepEqual(frames[1].steps, [{ from: 42, to: 28, captures: [35] }, { from: 28, to: 14, captures: [21] }]);
  assert.equal(frames.length, 2); assert.deepEqual(state, before);
});

test('chess review retains en passant capture squares and castling rook animation', () => {
  const state = freshState();
  for (const san of ['e4', 'a6', 'e5', 'd5', 'exd6']) playChess(state.chess, san);
  const before = structuredClone(state), frames = matchFrames(state, 'chess');
  assert.deepEqual(frames.at(-1)!.steps[0].captures, [27]); assert.match(frames.at(-1)!.caption, /takes pawn/); assert.deepEqual(state, before);
  state.chess.startFen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'; state.chess.moves = [];
  playChess(state.chess, 'O-O'); assert.deepEqual(matchFrames(state, 'chess')[1].steps[0].second, { from: 63, to: 61 });
});

test('Go review includes passes as positions without inventing a placement', () => {
  const state = freshState(); playGo(state.go, 40); playGo(state.go, null);
  const before = structuredClone(state), frames = matchFrames(state, 'go');
  assert.equal(frames.length, 3); assert.deepEqual(frames[2].steps, []); assert.match(frames[2].caption, /White · Pass/); assert.deepEqual(frames[1].cells, frames[2].cells); assert.deepEqual(state, before);
});

test('Sudoku cell explanations agree with legal candidates on every supported board size', () => {
  for (const size of [4, 6, 9, 12] as const) {
    const s = newSudoku(generatePuzzle(size, 1, () => .37));
    for (let i = 0; i < s.values.length; i++) {
      const values = s.values.map((n, at) => i === at ? 0 : n), guide = cellGuide(s.values, size, i);
      assert.deepEqual(guide.possible, candidates(values, size, i));
      assert(guide.possible.every(n => guide.row.includes(n) && guide.column.includes(n) && guide.box.includes(n)));
    }
    const i = s.values.indexOf(0), before = structuredClone(s);
    assert(setValue(s, i, s.solution[i], true)); assert.equal(s.values[i], 0); assert.deepEqual(s.notes[i], [s.solution[i]]);
    assert(undoSudoku(s)); assert.deepEqual(s, { ...before, redo: s.redo });
  }
});

test('chess attack overlay identifies a threatened queen and leaves captured pieces and position intact', () => {
  const state = freshState(), s = state.chess;
  for (const move of ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3']) playChess(s, move);
  const before = structuredClone(s), html = chessArena(s, { canPlay: true, busy: false, selected: null, focus: 3, message: '', threats: true });
  assert.match(html, /under-attack[^>]*data-chess-square="27"[^>]*aria-label="d5, Black queen, attacked by White/);
  assert.match(html, /Captured pieces/); assert.match(html, /Material is level/); assert.match(html, /Taken by White/); assert.match(html, /Taken by Black/);
  assert.deepEqual(s, before);
});

test('Go preview shows the tentative stone and captured group without committing or changing history', () => {
  const state = freshState(), s = state.go;
  for (const point of [39, 40, 31, 80, 41, 79]) playGo(s, point);
  const before = structuredClone(s), html = goArena(s, { canPlay: true, busy: false, selected: null, focus: 49, pending: 49, atari: true, message: '' });
  assert.match(html, /preview-captured[^>]*data-point="40"/); assert.match(html, /go-preview/); assert.match(html, /atari-mark/);
  assert.deepEqual(s, before);
});

test('an exposed Patience endgame finishes through ordinary safe moves and each move can be undone', () => {
  const s = newPatience(1); s.stock = []; s.waste = [];
  s.foundations = Array.from({ length: 4 }, (_, suit) => Array.from({ length: 12 }, (_, r) => suit * 13 + r));
  s.tableau = Array.from({ length: 7 }, (_, i) => i < 4 ? [{ card: i * 13 + 12, up: true }] : []);
  assert(canFinishPatience(s));
  const before = structuredClone(s);
  for (let n = 0; n < 4; n++) { const move = patienceMoves(s).find(m => safeFoundation(s, m))!; assert(move); assert(movePatience(s, move.from, move.to)); }
  assert(patienceWon(s)); assert(!canFinishPatience(s));
  for (let n = 0; n < 4; n++) assert(undoPatience(s));
  assert.deepEqual(s, before);
  s.tableau[0][0].up = false; assert(!canFinishPatience(s));
});

test('a paused minefield blocks reveal, flags and hints and survives a saved-game round trip', () => {
  const s = newMines(); openMine(s, 40, () => .37); assert.equal(s.status, 'playing'); s.paused = true;
  const before = structuredClone(s), covered = s.open.findIndex(n => !n);
  assert(!flagMine(s, covered)); assert.deepEqual(openMine(s, covered), []); assert.match(mineHint(s).reason, /Resume/); assert.deepEqual(s, before);
  const saved = restoreMines(JSON.parse(JSON.stringify(s)))!; assert(saved.paused); saved.paused = false; assert(flagMine(saved, covered));
  assert.equal(restoreMines({ ...s, paused: 'yes' }), null);
});

test('Life pattern rotation and mirror preserve cells, and undo restores the editable reset seed', () => {
  const original = structuredClone(LIFE_PATTERNS.glider), s = newLife();
  const sort = (points: number[][]) => points.map(p => p.join(',')).sort();
  assert.deepEqual(sort(lifePattern('glider', 4)!), sort(original));
  for (let rotation = 0; rotation < 4; rotation++) for (const mirror of [false, true]) { const points = lifePattern('glider', rotation, mirror)!; assert.equal(new Set(sort(points)).size, 5); assert(points.every(([x, y]) => x >= 0 && y >= 0)); }
  const before = structuredClone(s); stampLife(s, 'glider', 100, 1, 1, true); assert(undoLife(s)); assert.deepEqual(s.seed, before.seed); assert.deepEqual(s.cells, before.cells);
  seedLife(s, 'clear'); stampLife(s, 'glider', 100); assert(undoLife(s)); assert(s.replacement); assert(undoLifeReplacement(s)); assert.deepEqual(s.cells, before.cells);
  assert.deepEqual(LIFE_PATTERNS.glider, original);
});

test('Life snapshot swaps preserve both worlds through resizing, evolution and save/load', () => {
  let s = newLife(); stepLife(s); saveLifeBookmark(s); const saved = structuredClone(s);
  resizeLife(s, 80); seedLife(s, 'pulsar'); s.running = true; for (let n = 0; n < 40; n++) stepLife(s); const experiment = structuredClone(s);
  s = restoreLife(JSON.parse(JSON.stringify(s)))!; assert(s); assert(swapLifeBookmark(s));
  assert.equal(s.width, 40); assert.equal(s.generation, 1); assert.deepEqual(s.cells, saved.cells); assert.deepEqual(s.seed, saved.seed); assert(!s.running);
  s = restoreLife(JSON.parse(JSON.stringify(s)))!; assert(s); assert(swapLifeBookmark(s)); assert.equal(s.width, 80); assert.deepEqual(s.cells, experiment.cells); assert.equal(s.generation, 40);
  assert.equal(restoreLife({ ...s, bookmark: { ...s.bookmark, cells: [1] } }), null);
});

test('every poker tutor example is the category it teaches and the list is in winning order', () => {
  let previous = Infinity;
  for (const lesson of POKER_HAND_LESSONS) { const hand = evaluateFive(lesson.cards); assert.equal(hand.category, lesson.category, lesson.title); assert(hand.value < previous); previous = hand.value; }
});

test('new input preferences persist and older saves recover their defaults', () => {
  const s = freshState(); Object.assign(s.preferences, { fourConfirm: true, goConfirm: true, sudokuDigitFirst: true, skiInput: 'mouse' });
  const saved = parseState(JSON.stringify({ version: 1, ...s })); assert.deepEqual(saved.preferences, s.preferences);
  const old = parseState(JSON.stringify({ version: 1, preferences: { theme: 'classic', skiInput: 'automatic', fourConfirm: 'true' } }));
  assert.equal(old.preferences.theme, 'classic'); assert.equal(old.preferences.skiInput, 'keys'); assert(!old.preferences.fourConfirm); assert(!old.preferences.goConfirm); assert(!old.preferences.sudokuDigitFirst);
});
