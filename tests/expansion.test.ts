import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newMines, openMine, flagMine, mineNeighbours, restoreMines } from '../src/minesweeper.ts';
import { editLife, lifeComputer, lifeNext, newLife, seedLife, stepLife, undoLife, restoreLife } from '../src/life.ts';
import { hintTetra, moveTile, newTetra, restoreTetra, solveTetra, tetraWon, undoTetra } from '../src/tetravex.ts';
import { newSki, stepSki, restoreSki } from '../src/ski.ts';
import { actPoker, bestPokerHand, dealPoker, evaluateFive, exchangePoker, newPoker, pokerActions, pokerAdvice, pokerEquity, restorePoker } from '../src/poker.ts';
import { hiLo, newCountDrill, startCountBatch, nextCountCard, gradeCount, drillCount, visibleBlackjackCount, restoreCountDrill } from '../src/counting.ts';
import { newBlackjack, dealBlackjack, actBlackjack } from '../src/blackjack.ts';
import { shuffledDeck } from '../src/cards.ts';
import { CHESS_LESSONS, DRAUGHTS_LESSONS, explainChessMove, explainDraughtsMove } from '../src/coach.ts';
import { chessEngine, newChess } from '../src/chess.ts';
import { draughtsMoves } from '../src/rules.ts';
import { defaultOptions, freshState, parseState } from '../src/state.ts';
const c = (r: number, s = 0) => r - 1 + 13 * s;
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

test('mines first openings protect the full neighbourhood at every field size', () => {
  for (const level of ['beginner', 'intermediate', 'expert'] as const) for (let seed = 1; seed <= 15; seed++) {
    const s = newMines(level), at = seed % s.open.length;
    openMine(s, at, rng(seed));
    assert.equal(s.mines.length, s.count); assert.equal(new Set(s.mines).size, s.count);
    assert(![at, ...mineNeighbours(s, at)].some(i => s.mines.includes(i)));
    assert(s.open[at]); assert(restoreMines(structuredClone(s)));
  }
  assert.deepEqual(mineNeighbours(newMines(), 0), [1, 9, 10]);
});
test('mines flags block opening; wrong chord flags can explode; clearing every safe cell wins', () => {
  const s = newMines(); flagMine(s, 0); assert.deepEqual(openMine(s, 0), []); assert.equal(s.status, 'ready'); flagMine(s, 0);
  openMine(s, 0, rng(2));
  for (let i = 0; i < s.open.length; i++) if (!s.mines.includes(i)) openMine(s, i);
  assert.equal(s.status, 'won'); assert.equal(s.flags.filter(Boolean).length, 10); assert(restoreMines(s));
  const chord = newMines(); chord.status = 'playing'; chord.mines = [1, 40, 50, 51, 52, 60, 61, 62, 70, 80]; chord.open[0] = true; flagMine(chord, 9);
  openMine(chord, 0); assert.equal(chord.status, 'lost'); assert.equal(chord.exploded, 1);
});
test('Conway updates simultaneously: blinkers oscillate and gliders travel', () => {
  const s = newLife(); seedLife(s, 'blinker'); const original = s.cells.slice(); stepLife(s); assert.notDeepEqual(s.cells, original); stepLife(s); assert.deepEqual(s.cells, original);
  seedLife(s, 'glider'); const old = s.cells.flatMap((n, i) => n ? [i] : []);
  for (let i = 0; i < 4; i++) stepLife(s);
  assert.deepEqual(s.cells.flatMap((n, i) => n ? [i] : []), old.map(i => i + 41));
  assert(undoLife(s)); assert.equal(s.generation, 3); assert(restoreLife(s));
});
test('Life colony births take the majority colour and a full computer turn can be undone', () => {
  const tiny = [1, -1, 1, 0, 0, 0, 0, 0, 0], next = lifeNext(tiny, 3, 3);
  assert.equal(next[4], 1); assert.equal(next[1], -1);
  const s = newLife('colonies'), initial = s.cells.slice();
  editLife(s, s.cells.findIndex(n => n === 1)); stepLife(s); assert.equal(s.turn, -1); lifeComputer(s); assert.equal(s.turn, 1); assert.equal(s.generation, 2);
  assert(undoLife(s)); assert.deepEqual(s.cells, initial); assert.equal(s.generation, 0); assert.equal(s.edits, 3);
});
test('TetraVex generated puzzles solve at all sizes; hints complete them and undo restores them', () => {
  for (const size of [2, 3, 4] as const) for (let seed = 1; seed <= 5; seed++) {
    const s = newTetra(size, rng(seed)), initial = structuredClone(s);
    assert(solveTetra(s).board);
    for (let i = 0; i < size * size; i++) assert.equal(hintTetra(s), 'placed');
    assert(tetraWon(s)); assert(restoreTetra(s));
    while (s.history.length) undoTetra(s);
    assert.deepEqual(s, initial);
  }
});
test('TetraVex rejects mismatched neighbours, conserves tiles during swaps and identifies blocked layouts', () => {
  const s = newTetra(2, rng(4));
  s.tiles = [{ n: 0, e: 1, s: 2, w: 0 }, { n: 0, e: 0, s: 3, w: 1 }, { n: 2, e: 5, s: 0, w: 0 }, { n: 3, e: 9, s: 9, w: 5 }];
  const source = s.tray.indexOf(3); assert(moveTile(s, { area: 'tray', index: source }, { area: 'board', index: 0 }));
  assert.equal(solveTetra(s).board, null); assert.equal(hintTetra(s), 'blocked');
  assert(undoTetra(s));
  assert(moveTile(s, { area: 'tray', index: s.tray.indexOf(0) }, { area: 'board', index: 0 }));
  const snapshot = structuredClone(s); assert.equal(moveTile(s, { area: 'tray', index: s.tray.indexOf(2) }, { area: 'board', index: 1 }), false); assert.deepEqual(s, snapshot);
});
test('SkiFree integrates time rather than frame count and pauses without advancing', () => {
  const a = newSki(), b = newSki(), input = { steer: 0, brake: false, jump: false, fast: false };
  stepSki(a, input, .05); assert.equal(a.y, 0);
  a.status = b.status = 'skiing'; a.generated = b.generated = 1000000;
  for (let i = 0; i < 600; i++) stepSki(a, input, 1 / 60);
  for (let i = 0; i < 1200; i++) stepSki(b, input, 1 / 120);
  assert(Math.abs(a.y - b.y) < 3); assert(Math.abs(a.elapsed - b.elapsed) < .001); assert(restoreSki(a));
});
test('SkiFree jumps score, slalom finishes, and fast mode can outrun the yeti on clear snow', () => {
  const normal = newSki(), fast = newSki();
  for (const s of [normal, fast]) { s.status = 'skiing'; s.y = 6000; s.generated = 1000000; }
  for (let i = 0; i < 240; i++) { stepSki(normal, { steer: 0, brake: false, jump: false, fast: false }, .05); stepSki(fast, { steer: 0, brake: false, jump: false, fast: true }, .05); }
  assert.equal(normal.status, 'caught'); assert.equal(fast.status, 'skiing');
  const race = newSki('slalom'); race.status = 'skiing'; race.y = 2999; race.speed = 235; race.generated = 1000000; stepSki(race, { steer: 0, brake: false, jump: false, fast: false }, .05); assert.equal(race.status, 'finished');
  const jump = newSki('freestyle'); jump.status = 'skiing'; jump.generated = 1000000;
  for (let i = 0; i < 30; i++) stepSki(jump, { steer: 1, brake: false, jump: i === 0, fast: false }, .05);
  assert(jump.score >= 100);
});
test('poker rankings include ace-low straights, kickers, full houses and all nine categories', () => {
  const hands = [
    [c(2), c(5,1), c(7,2), c(9,3), c(11)], [c(2), c(2,1), c(7,2), c(9,3), c(11)], [c(2), c(2,1), c(7,2), c(7,3), c(11)],
    [c(2), c(2,1), c(2,2), c(9,3), c(11)], [c(1), c(2,1), c(3,2), c(4,3), c(5)], [c(2), c(5), c(7), c(9), c(11)],
    [c(2), c(2,1), c(2,2), c(9,3), c(9)], [c(2), c(2,1), c(2,2), c(2,3), c(11)], [c(9), c(10), c(11), c(12), c(13)],
  ];
  hands.forEach((h, i) => assert.equal(evaluateFive(h).category, i));
  assert.equal(evaluateFive(hands[4]).kickers[0], 5);
  assert(evaluateFive([c(2), c(2,1), c(1,2), c(9,3), c(11)]).value > evaluateFive(hands[1]).value);
});
test('Hold’em can play the board while Omaha requires exactly two hole cards', () => {
  const royal = [c(10), c(11), c(12), c(13), c(1)], hole = [c(2,1), c(3,1), c(4,2), c(5,2)];
  assert.equal(bestPokerHand('holdem', hole.slice(0, 2), royal).name, 'Royal flush');
  assert(bestPokerHand('omaha', hole, royal).category < 8);
  const twoTrips = bestPokerHand('holdem', [c(1), c(1,1)], [c(1,2), c(13), c(13,1), c(13,2), c(2)]);
  assert.deepEqual(twoTrips.kickers, [14, 13]);
});
test('poker betting enforces turn order and costs, caps raises, and preserves practice chips across variants', () => {
  for (const variant of ['holdem', 'omaha', 'draw'] as const) for (let seed = 1; seed <= 20; seed++) {
    const s = newPoker(variant), random = rng(seed); assert(dealPoker(s, random));
    let turns = 0;
    while (s.phase !== 'showdown' && turns++ < 80) {
      assert.equal(s.stacks[0] + s.stacks[1] + s.pot, 1000); assert(restorePoker(structuredClone(s)));
      if (s.phase === 'draw') assert(exchangePoker(s, [0, 2]));
      else { const a = pokerActions(s); const action = a.raise && random() < .3 ? 'raise' : a.check ? 'check' : 'call'; assert(actPoker(s, action)); }
    }
    assert.equal(s.phase, 'showdown'); assert.equal(s.stacks[0] + s.stacks[1], 1000); assert(restorePoker(s));
    assert(dealPoker(s, random)); assert.equal(s.dealer, 1);
  }
  const s = newPoker(); dealPoker(s, rng(2)); const before = structuredClone(s); assert.equal(actPoker(s, 'check'), false); assert.deepEqual(s, before);
});
test('short all-in stacks return unmatched chips and run out the board; ties and folds settle once', () => {
  const s = newPoker(); s.stacks = [7, 993]; dealPoker(s, rng(9));
  while (s.phase === 'betting') { const a = pokerActions(s); actPoker(s, a.check ? 'check' : 'call'); }
  assert.equal(s.phase, 'showdown'); assert.equal(s.board.length, 5); assert.equal(s.stacks[0] + s.stacks[1], 1000);
  assert.equal(actPoker(s, 'call'), false);
  const fold = newPoker(); dealPoker(fold, rng(2)); actPoker(fold, 'fold'); assert.equal(fold.stacks[0], 495); assert.equal(fold.stacks[1], 505); assert.equal(fold.phase, 'showdown');
});
test('poker tutor and equity estimates do not inspect the opponent’s private hand or the live deck', () => {
  const s = newPoker('omaha'); dealPoker(s, rng(8));
  const other = structuredClone(s); other.holes[1] = [c(1), c(1,1), c(1,2), c(1,3)]; other.deck.reverse();
  assert.equal(pokerEquity(s, 0, 30, rng(7)), pokerEquity(other, 0, 30, rng(7)));
  assert.deepEqual(pokerAdvice(s), pokerAdvice(other));
});
test('Hi-Lo counts exposed cards once, excludes the hole card and carries across batches', () => {
  assert.equal(shuffledDeck().reduce((n, c) => n + hiLo(c), 0), 0);
  const s = newBlackjack(), order = [c(2), c(9), c(6), c(1)];
  s.shoe = [...Array.from({ length: 312 }, (_, i) => i).filter(c => !order.includes(c)), ...order.toReversed()]; dealBlackjack(s);
  assert.equal(visibleBlackjackCount(s).running, 2); assert.equal(visibleBlackjackCount(s).seen, 3); actBlackjack(s, 'stand'); assert.equal(visibleBlackjackCount(s).running, 1); assert.equal(visibleBlackjackCount(s).seen, 4);
  const drill = newCountDrill(1, 750, rng(8)); startCountBatch(drill);
  for (let i = 0; i < 10; i++) nextCountCard(drill);
  assert.equal(drill.phase, 'quiz'); assert(gradeCount(drill, drillCount(drill))); startCountBatch(drill); nextCountCard(drill);
  assert.equal(drill.index, 11); assert.equal(restoreCountDrill(drill)?.phase, 'quiz');
});
test('chess and draughts lessons have valid positions; move tutors explain legal suggestions', () => {
  assert.equal(CHESS_LESSONS.length, 6); assert.equal(DRAUGHTS_LESSONS.length, 6);
  for (const l of CHESS_LESSONS) { assert(chessEngine({ startFen: l.fen!, moves: [] })); assert(l.choices[l.correct]); }
  for (const l of DRAUGHTS_LESSONS) assert(l.board!.every((n, i) => !n || (Math.floor(i / 8) + i % 8) % 2 === 1));
  const chess = newChess(defaultOptions()); assert.equal(explainChessMove(chess, 'Nf3').chess, 'Nf3');
  const draughts = freshState().draughts, move = draughtsMoves(draughts.board, draughts.turn)[0]; assert(explainDraughtsMove(draughts, move).reasons.length);
});
test('new games and learning progress survive save/load; malformed games recover individually', () => {
  const s = freshState(); s.mines = newMines(); openMine(s.mines, 0, rng(1)); s.life = newLife(); stepLife(s.life); s.tetravex = newTetra(3, rng(2)); hintTetra(s.tetravex); s.ski = newSki(); s.poker = newPoker('draw'); dealPoker(s.poker, rng(4)); s.counting = newCountDrill(1, 400, rng(5)); s.lessons.chess = 3;
  assert.deepEqual(parseState(JSON.stringify({ version: 1, ...s })), s);
  const bad = structuredClone(s); bad.life!.cells[0] = 999; bad.poker.holes[1][0] = bad.poker.holes[0][0];
  const recovered = parseState(JSON.stringify({ version: 1, ...bad })); assert.equal(recovered.life, null); assert.deepEqual(recovered.poker, newPoker()); assert.deepEqual(recovered.mines, s.mines);
});
