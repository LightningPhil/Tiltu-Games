import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newTetra, canMoveTile, sortTetraTray, tileMoveIssue, undoTetra, restoreTetra } from '../src/tetravex.ts';
import { newLife, seedLife, stepLife, undoLife, undoLifeReplacement, restoreLife } from '../src/life.ts';
import { newChess } from '../src/chess.ts';
import { newGo } from '../src/go.ts';
import { chessArena, goArena } from '../src/advanced-view.ts';
import { newBlackjack } from '../src/blackjack.ts';
import { newPatience, patienceMoves } from '../src/patience.ts';
import { blackjackPage, encodeTarget, patiencePage } from '../src/card-view.ts';

const options = { mode: 'local' as const, level: 3, human: 1 as const, starter: 1 as const };
const view = { canPlay: true, busy: false, selected: null, focus: 0, message: '' };

test('sorting the TetraVex tray preserves the puzzle and is undoable without counting a puzzle move', () => {
  const s = newTetra(3, () => .35); s.tray.reverse();
  const previous = structuredClone(s);
  assert(sortTetraTray(s)); assert.deepEqual(s.board, previous.board); assert.deepEqual(s.tiles, previous.tiles);
  assert.equal(s.moves, previous.moves); assert.deepEqual([...s.tray].sort(), [...previous.tray].sort()); assert(restoreTetra(s));
  const historyLength = s.history.length; assert(!sortTetraTray(s)); assert.equal(s.history.length, historyLength);
  assert(undoTetra(s)); assert.deepEqual(s, previous);
});
test('TetraVex explains the actual mismatched touching edges and leaves the puzzle untouched', () => {
  const s = newTetra(2, () => 0); s.tiles[0].e = 8; s.tiles[1].w = 3; s.board[0] = 0; s.tray = [null, 1, 2, 3];
  const before = structuredClone(s), from = { area: 'tray' as const, index: 1 }, to = { area: 'board' as const, index: 1 };
  assert(!canMoveTile(s, from, to)); assert.match(tileMoveIssue(s, from, to), /right edge is 8.*touching edge is 3/);
  assert.deepEqual(s, before);
});
test('replacing or clearing a Life world can undo both the previous generation and its reset seed', () => {
  const s = newLife(); s.running = true; for (let i = 0; i < 8; i++) stepLife(s);
  const before = structuredClone(s); seedLife(s, 'clear'); assert(s.cells.every(n => !n)); assert(s.running);
  const restored = restoreLife(JSON.parse(JSON.stringify(s)))!; assert(restored); assert(undoLife(restored));
  assert.deepEqual(restored.cells, before.cells); assert.deepEqual(restored.seed, before.seed); assert.equal(restored.generation, before.generation);
  const bad = structuredClone(s); bad.history.at(-1)!.seed = [99]; assert.equal(restoreLife(bad), null);
});
test('undo replacement skips later simulation generations and survives a save/load cycle', () => {
  const s = newLife(); for (let i = 0; i < 7; i++) stepLife(s);
  const before = structuredClone(s); seedLife(s, 'clear'); for (let i = 0; i < 240; i++) stepLife(s);
  assert(s.history.every(snapshot => !snapshot.seed));
  const saved = restoreLife(JSON.parse(JSON.stringify(s)))!;
  assert(undoLifeReplacement(saved)); assert.deepEqual(saved.cells, before.cells); assert.deepEqual(saved.seed, before.seed); assert.equal(saved.generation, 7);
  assert(!undoLifeReplacement(saved));
});
test('manual chess orientation flips the squares while preserving move targets and the position', () => {
  const s = newChess(options), before = structuredClone(s);
  const normal = chessArena(s, { ...view, selected: 52 }), flipped = chessArena(s, { ...view, selected: 52, flipped: true });
  assert.equal(normal.match(/data-chess-square="(\d+)"/)?.[1], '0'); assert.equal(flipped.match(/data-chess-square="(\d+)"/)?.[1], '63');
  assert.match(flipped, /data-chess-square="36"[^>]*aria-label="e4, empty, legal destination/); assert.deepEqual(s, before);
});
test('Go inspection exposes occupied points and distinct group liberties without placing stones', () => {
  const s = newGo(9, options); s.board[40] = s.board[41] = 1;
  const before = structuredClone(s), html = goArena(s, { ...view, canPlay: false, inspectMode: true, inspected: 40 });
  assert.equal((html.match(/inspected-stone/g) ?? []).length, 2); assert.equal((html.match(/inspected-liberty/g) ?? []).length, 6);
  assert.match(html, /data-point="40"[^>]*aria-label="E5, Black stone, 6 liberties/); assert.deepEqual(s, before);
});
test('blackjack exposes the next stake on the table and excludes unaffordable options', () => {
  const s = newBlackjack(); s.bank = 12; s.bet = 10;
  const html = blackjackPage(s, '', '');
  assert.match(html, /id="blackjack-bet-table"/); assert.match(html, /Available chips/);
  const chooser = html.split('id="blackjack-bet-table"')[1].split('</select>')[0];
  assert.match(chooser, /value="10" selected/); assert.match(chooser, /value="25"[^>]*disabled/);
});
test('patience offers explicit tap destinations for the selected sequence', () => {
  const s = newPatience(1, Array.from({ length: 52 }, (_, i) => i)), moves = patienceMoves(s);
  assert(moves.length);
  const selected = moves[0].from, html = patiencePage(s, s.draw, selected, null, '', '');
  assert.match(html, /aria-label="Moves for selected cards"/);
  for (const move of moves.filter(m => JSON.stringify(m.from) === JSON.stringify(selected))) assert(html.includes(`data-patience="move:${encodeTarget(move.to)}"`));
});
