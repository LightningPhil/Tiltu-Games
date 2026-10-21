import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseGoMove, finishGo, goGroup, goKey, goNeighbours, newGo, placeGo, playGo, resumeGo, scoreGo, toggleDead, undoGo } from '../src/go.ts';
import { defaultOptions } from '../src/state.ts';
const local = () => ({ ...defaultOptions(), mode: 'local' as const });
test('Go neighbours do not wrap rows and connected groups share unique liberties', () => {
  assert.deepEqual(goNeighbours(8, 9), [17, 7]);
  const b = Array(81).fill(0); b[40] = b[41] = 1;
  const g = goGroup(b, 9, 40); assert.equal(g.stones.length, 2); assert.equal(g.liberties.length, 6);
});
test('capture removes a whole group; suicide is forbidden; captures can rescue a move', () => {
  const b = Array(81).fill(0); b[40] = b[41] = -1;
  [31, 32, 39, 49, 50].forEach(i => { b[i] = 1; });
  const capture = placeGo(b, 9, 1, 42);
  assert.equal(capture.error, ''); assert.deepEqual(capture.captured.sort((a,b)=>a-b), [40, 41]);
  assert.equal(b[40], -1);
  const suicide = Array(81).fill(0); [31, 39, 41, 49].forEach(i => { suicide[i] = -1; });
  assert.match(placeGo(suicide, 9, 1, 40).error, /suicide/);
  [22, 30, 32].forEach(i => { suicide[i] = 1; });
  assert.equal(placeGo(suicide, 9, 1, 40).error, '');
});
test('positional superko rejects repetitions but passing remains legal', () => {
  const s = newGo(9, local()), placement = placeGo(s.board, 9, 1, 40);
  assert.match(placeGo(s.board, 9, 1, 40, new Set([goKey(placement.board)])).error, /Ko/);
  playGo(s, null); assert.equal(s.passes, 1); playGo(s, null); assert.equal(s.phase, 'score');
});
test('two passes open scoring; resume retracts passes; undo restores captures and turn', () => {
  const s = newGo(9, local()); playGo(s, 40); playGo(s, 41); const position = s.board.slice();
  playGo(s, null); playGo(s, null); assert.equal(s.phase, 'score');
  resumeGo(s); assert.equal(s.phase, 'play'); assert.equal(s.passes, 0); assert.equal(s.moves.length, 2); assert.deepEqual(s.board, position);
  assert(undoGo(s)); assert.equal(s.board[41], 0); assert.equal(s.turn, -1);
});
test('area scoring counts stones plus enclosed empties, adds komi once and leaves mixed borders neutral', () => {
  const b = Array(25).fill(0); [6, 8, 16, 18, 7, 11, 13, 17].forEach(i => { b[i] = 1; }); b[0] = -1;
  const score = scoreGo(b, 5);
  assert.equal(score.territory[12], 1); assert.equal(score.territory[1], 0);
  assert.equal(score.black, 9); assert.equal(score.white, 8.5);
  const neutral = scoreGo(Array(81).fill(0), 9); assert.equal(neutral.black, 0); assert.equal(neutral.white, 7.5);
});
test('dead group marking toggles a whole group; confirming a score counts only once', () => {
  const s = newGo(9, local()); playGo(s, 40); playGo(s, 1); playGo(s, 41); playGo(s, 2);
  playGo(s, null); playGo(s, null); toggleDead(s, 40); assert.deepEqual(s.dead.sort(), [40, 41]);
  toggleDead(s, 41); assert.deepEqual(s.dead, []);
  finishGo(s); const scores = s.scores.slice(); finishGo(s); assert.deepEqual(s.scores, scores);
  assert(undoGo(s)); assert.equal(s.result, null); assert.deepEqual(s.scores, [0,0,0]);
});
test('computer undo includes the reply; every Go size has legal moves from the opening', () => {
  const s = newGo(9, defaultOptions()); playGo(s, 40); playGo(s, 41); assert(undoGo(s)); assert.equal(s.moves.length, 0);
  for (const size of [9, 13, 19] as const) {
    const game = newGo(size, defaultOptions()); const move = chooseGoMove(game, 2).move;
    assert(move !== null); assert.equal(placeGo(game.board, size, game.turn, move).error, '');
  }
});
test('Go computer honours compulsory legality and higher levels capture a group in atari', () => {
  const s = newGo(9, defaultOptions()); s.board[40] = -1; [31,39,49].forEach(i=>{s.board[i]=1;});
  for (let level = 1; level <= 5; level++) {
    const answer = chooseGoMove(s, level, () => .4);
    assert(answer.move !== null); const next = placeGo(s.board, 9, s.turn, answer.move);
    assert.equal(next.error, ''); if (level >= 2) assert(next.captured.includes(40), `level ${level} should capture`);
  }
});
