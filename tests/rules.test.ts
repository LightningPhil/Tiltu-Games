import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyMove, draughtsMoves, drawReason, dropRow, fourLine, fourMoves, initialBoard, other, positionKey, winner } from '../src/rules.ts';
import { newDuel, undoDuel, updateResult } from '../src/state.ts';
import type { DuelGame, Move, Player } from '../src/rules.ts';

test('4 in a row uses gravity, rejects full/invalid columns and leaves inputs intact', () => {
  const empty = initialBoard('four');
  assert.equal(dropRow(empty, 3), 5);
  assert.equal(dropRow(empty, -1), -1);
  assert.equal(dropRow(empty, 7), -1);
  let board = empty;
  for (let i = 0; i < 6; i++) board = applyMove('four', board, i % 2 ? -1 : 1, 3);
  assert.equal(empty.every(n => !n), true);
  assert.equal(dropRow(board, 3), -1);
  assert.equal(fourMoves(board).includes(3), false);
  assert.throws(() => applyMove('four', board, 1, 3));
});

test('4 in a row identifies horizontal, vertical and both diagonal winning lines', () => {
  for (const line of [[35, 36, 37, 38], [0, 7, 14, 21], [0, 8, 16, 24], [6, 12, 18, 24]]) {
    for (const p of [1, -1] as const) {
      const board = initialBoard('four');
      line.forEach(i => { board[i] = p; });
      assert.deepEqual(fourLine(board), line);
      assert.equal(winner('four', board, other(p)), p);
    }
  }
  const wrap = initialBoard('four');
  [5, 6, 7, 8].forEach(i => { wrap[i] = 1; });
  assert.deepEqual(fourLine(wrap), []);
});

test('draughts begins with twelve men each and seven legal opening moves', () => {
  const board = initialBoard('draughts');
  assert.equal(board.filter(n => n === 1).length, 12);
  assert.equal(board.filter(n => n === -1).length, 12);
  assert.equal(draughtsMoves(board, 1).length, 7);
  assert.equal(draughtsMoves(board, -1).length, 7);
  assert(draughtsMoves(board, 1).every(m => Math.floor(m.path[0] / 8) < Math.floor(m.from / 8)));
});

test('captures are mandatory and the entire multi-jump is one legal turn', () => {
  const board = Array(64).fill(0);
  board[40] = 1; board[58] = 1; board[33] = -1; board[19] = -2;
  const moves = draughtsMoves(board, 1);
  assert.deepEqual(moves, [{ from: 40, path: [26, 12], captures: [33, 19] }]);
  const next = applyMove('draughts', board, 1, moves[0]);
  assert.equal(next[12], 1);
  assert.equal(next[33], 0); assert.equal(next[19], 0); assert.equal(next[40], 0);
  assert.equal(board[33], -1);
});

test('men cannot jump backwards; kings can; promotion finishes the turn', () => {
  const board = Array(64).fill(0);
  board[26] = 1; board[35] = -1;
  assert(draughtsMoves(board, 1).every(m => !m.captures.length));
  board[26] = 2;
  assert.deepEqual(draughtsMoves(board, 1), [{ from: 26, path: [44], captures: [35] }]);
  const crown = Array(64).fill(0);
  crown[17] = 1; crown[10] = -1; crown[12] = -1;
  const moves = draughtsMoves(crown, 1);
  assert.deepEqual(moves, [{ from: 17, path: [3], captures: [10] }]);
  const next = applyMove('draughts', crown, 1, moves[0]);
  assert.equal(next[3], 2); assert.equal(next[12], -1);
});

test('any capture branch is allowed even when another captures more', () => {
  const board = Array(64).fill(0);
  board[42] = 1; board[33] = -1; board[35] = -1; board[21] = -1;
  const moves = draughtsMoves(board, 1);
  assert(moves.some(m => m.captures.length === 1));
  assert(moves.some(m => m.captures.length === 2));
});

test('a side with no pieces or no legal moves loses; draws include whose turn it is', () => {
  const b = Array(64).fill(0); b[1] = 1; b[62] = -1;
  assert.equal(winner('draughts', b, 1), -1);
  const key = positionKey(b, 1), otherKey = positionKey(b, -1);
  assert.notEqual(key, otherKey);
  assert.equal(drawReason([key, otherKey, key], 0), null);
  assert.equal(drawReason([key, otherKey, key, otherKey, key], 0), 'Threefold repetition');
  assert.equal(drawReason([key], 79), null);
  assert.match(drawReason([key], 80)!, /40 moves/);
});

function commit(game: DuelGame, s: ReturnType<typeof newDuel>, move: Move) {
  s.history.push({ board: s.board.slice(), turn: s.turn, quiet: s.quiet });
  s.moves.push({ player: s.turn, text: String(move) });
  s.board = applyMove(game, s.board, s.turn, move); s.turn = other(s.turn); updateResult(game, s);
}

test('undo vs computer removes a human turn and reply; undo while thinking removes only the human turn', () => {
  const s = newDuel('four', { mode: 'computer', level: 5, human: 1, starter: 1 });
  const original = s.board.slice();
  commit('four', s, 3); commit('four', s, 4);
  assert(undoDuel(s)); assert.deepEqual(s.board, original); assert.equal(s.turn, 1);
  commit('four', s, 0); assert(undoDuel(s)); assert.deepEqual(s.board, original);
  assert.equal(undoDuel(s), false);
});

test('undo restores result and score correctly, including a computer starting first', () => {
  const s = newDuel('four', { mode: 'computer', level: 3, human: -1, starter: 1 });
  for (const col of [0, 6, 1, 6, 2, 5, 3]) commit('four', s, col);
  assert.equal(s.result, 1); assert.deepEqual(s.scores, [1, 0, 0]);
  assert(undoDuel(s)); assert.equal(s.turn, -1); assert.equal(s.result, null); assert.deepEqual(s.scores, [0, 0, 0]);
  assert.equal(s.moves.length, 5);
});

test('a computer opening cannot be undone before the human has played', () => {
  const s = newDuel('four', { mode: 'computer', level: 3, human: -1, starter: 1 });
  commit('four', s, 3);
  assert.equal(undoDuel(s), false);
  assert.equal(s.moves.length, 1);
  commit('four', s, 2); commit('four', s, 4);
  assert(undoDuel(s)); assert.equal(s.moves.length, 1); assert.equal(s.turn, -1);
});

test('long seeded legal draughts games never duplicate captures or create pieces', () => {
  let board = initialBoard('draughts'), p: Player = 1;
  for (let ply = 0; ply < 120; ply++) {
    const moves = draughtsMoves(board, p);
    if (!moves.length) break;
    const move = moves[(ply * 17 + 3) % moves.length];
    assert.equal(new Set(move.captures).size, move.captures.length);
    const pieces = board.filter(Boolean).length;
    board = applyMove('draughts', board, p, move);
    assert.equal(board.filter(Boolean).length, pieces - move.captures.length);
    assert(board.every((n, i) => !n || (Math.floor(i / 8) + i % 8) % 2 === 1));
    p = other(p);
  }
});
