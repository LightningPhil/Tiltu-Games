import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseMove, LEVELS } from '../src/ai.ts';
import { applyMove, initialBoard, legalMoves, other, winner } from '../src/rules.ts';
import type { Board, DuelGame, Player } from '../src/rules.ts';

test('five skill levels have strictly increasing search depth and budgets', () => {
  assert.equal(LEVELS.length, 5);
  for (let i = 1; i < LEVELS.length; i++) {
    assert(LEVELS[i].fourDepth > LEVELS[i - 1].fourDepth);
    assert(LEVELS[i].draughtsDepth > LEVELS[i - 1].draughtsDepth);
    if (i >= 2) assert(LEVELS[i].nodes > LEVELS[i - 1].nodes);
  }
});

test('all levels choose legal moves for both sides without modifying the board', () => {
  for (const game of ['four', 'draughts'] as DuelGame[]) for (const player of [1, -1] as Player[]) {
    const b = initialBoard(game), copy = b.slice(), moves = legalMoves(game, b, player);
    for (let level = 1; level <= 5; level++) {
      const answer = chooseMove(game, b, player, level, () => .37);
      assert(moves.some(m => JSON.stringify(m) === JSON.stringify(answer.move)));
      assert.deepEqual(b, copy);
      assert(answer.nodes <= LEVELS[level - 1].nodes + 1 || level <= 2);
    }
  }
});

test('Casual and above take immediate wins and block immediate losses in 4 in a row', () => {
  const win = initialBoard('four'), block = initialBoard('four');
  [35, 36, 37].forEach(i => { win[i] = 1; block[i] = -1; });
  for (let level = 2; level <= 5; level++) {
    assert.equal(chooseMove('four', win, 1, level).move, 3);
    assert.equal(chooseMove('four', block, 1, level).move, 3);
  }
  // Easy is allowed to miss the tactic, giving beginners space to win.
  assert.notEqual(chooseMove('four', win, 1, 1, () => .99).move, 3);
});

test('all draughts levels obey compulsory captures and take the last opposing piece', () => {
  const b: Board = Array(64).fill(0); b[40] = 1; b[33] = -1; b[58] = 1;
  for (let level = 1; level <= 5; level++) {
    const answer = chooseMove('draughts', b, 1, level);
    const next = applyMove('draughts', b, 1, answer.move!);
    assert.equal(winner('draughts', next, -1), 1);
  }
});

test('harder levels complete progressively deeper searches on a quiet opening', () => {
  for (const game of ['four', 'draughts'] as DuelGame[]) {
    let previous = -1;
    for (let level = 1; level <= 5; level++) {
      const answer = chooseMove(game, initialBoard(game), 1, level, () => .4);
      assert(answer.depth > previous, `${game}: level ${level} reached depth ${answer.depth} after ${previous}`);
      previous = answer.depth;
    }
  }
});

test('finished positions return no move at any level', () => {
  const b = initialBoard('four'); [35, 36, 37, 38].forEach(i => { b[i] = 1; });
  for (let level = 1; level <= 5; level++) assert.equal(chooseMove('four', b, other(1), level).move, null);
});
