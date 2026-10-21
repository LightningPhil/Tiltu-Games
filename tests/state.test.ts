import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freshState, parseState } from '../src/state.ts';
import { generatePuzzle, newSudoku, setValue } from '../src/sudoku.ts';
import { playChess } from '../src/chess.ts';
import { finishGo, playGo } from '../src/go.ts';

test('preferences, all sessions, notes and undo history survive a save/load round trip', () => {
  const s = freshState();
  s.preferences.theme = 'woodland'; s.preferences.game = 'sudoku'; s.preferences.four.level = 5;
  s.sudoku = newSudoku(generatePuzzle(4, 1, () => .4));
  setValue(s.sudoku, s.sudoku.selected, s.sudoku.solution[s.sudoku.selected], true);
  const loaded = parseState(JSON.stringify({ version: 1, ...s }));
  assert.deepEqual(loaded, s);
});

test('damaged saves, unsupported versions and invalid preferences safely recover', () => {
  for (const raw of [null, '{', 'null', '[]', '{"version":99}', 'x'.repeat(2_000_001)]) assert.deepEqual(parseState(raw), freshState());
  const s = freshState();
  const raw = JSON.stringify({ version: 1, ...s, preferences: { theme: 'broken', game: '<script>', four: { level: 99 }, size: 999 } });
  assert.deepEqual(parseState(raw).preferences, s.preferences);
});

test('invalid boards are discarded individually while valid games and themes survive', () => {
  const s = freshState(); s.preferences.theme = 'classic';
  s.four.board[0] = 1; // a floating disc
  s.draughts.board[0] = 2; // a piece on a light square
  s.sudoku = newSudoku(generatePuzzle(4, 1, () => .7));
  const loaded = parseState(JSON.stringify({ version: 1, ...s }));
  assert.deepEqual(loaded.four, freshState().four);
  assert.deepEqual(loaded.draughts, freshState().draughts);
  assert.deepEqual(loaded.sudoku, s.sudoku);
  assert.equal(loaded.preferences.theme, 'classic');
});

test('older three-game saves migrate without losing progress; chess, Go and animation defaults are added', () => {
  const s = freshState(); const { chess, go, ...old } = s;
  const loaded = parseState(JSON.stringify({version:1,...old}));
  assert.deepEqual(loaded.four,s.four); assert.deepEqual(loaded.chess,chess); assert.deepEqual(loaded.go,go);
  assert.equal(loaded.preferences.motion,'steady');
});
test('chess and Go histories, scoring and animation preferences survive reload without double-counting results', () => {
  const s = freshState(); s.preferences.motion='relaxed';
  playChess(s.chess,'e4'); playChess(s.chess,'e5');
  playGo(s.go,40); playGo(s.go,41); playGo(s.go,null); playGo(s.go,null); finishGo(s.go);
  const loaded = parseState(JSON.stringify({version:1,...s}));
  assert.deepEqual(loaded.chess,s.chess); assert.deepEqual(loaded.go,s.go); assert.equal(loaded.preferences.motion,'relaxed');
});
