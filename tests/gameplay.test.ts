import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advanceLife, lifeActivity, newLife, resizeLife, restoreLife, seedLife, stampLife, stepLife } from '../src/life.ts';
import { mineHint, newMines } from '../src/minesweeper.ts';
import { canMoveTile, moveTile, newTetra } from '../src/tetravex.ts';
import { newSki, restoreSki, stepSki } from '../src/ski.ts';
import { actPoker, dealPoker, newPoker, pokerActions, pokerDraws, pokerShowdown } from '../src/poker.ts';
import { blackjackAdvice } from '../src/blackjack-tutor.ts';
import { newBlackjack } from '../src/blackjack.ts';
import { drillCount, gradeCount, newCountDrill, nextCountCard, restoreCountDrill, startCountBatch } from '../src/counting.ts';
import { explainPatienceMove, newPatience, patienceMoves } from '../src/patience.ts';
import { freshState, parseState } from '../src/state.ts';
const c = (r: number, suit = 0) => r - 1 + 13 * suit;
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

test('continuous Life runs beyond hundreds of generations, including empty and stable worlds', () => {
  const s = newLife(); s.running = true; let clock = 0;
  for (let i = 0; i < 6000; i++) clock = advanceLife(s, 16, 125, clock);
  assert.equal(s.generation, 768); assert.equal(s.cells.filter(Boolean).length, 5); assert.equal(s.result, null); assert(s.running);
  seedLife(s, 'block'); for (let i = 0; i < 100; i++) advanceLife(s, 250, 125);
  assert.equal(s.generation, 200); assert.match(lifeActivity(s).label, /Still life/); assert(s.running);
  seedLife(s, 'clear'); for (let i = 0; i < 100; i++) advanceLife(s, 250, 125);
  assert.equal(s.generation, 200); assert.equal(s.cells.filter(Boolean).length, 0); assert(s.running); assert.match(lifeActivity(s).label, /Empty world/);
  s.running = false; advanceLife(s, 250, 65); assert.equal(s.generation, 200);
  s.running = true; s.result = 1; advanceLife(s, 65, 65); assert.equal(s.generation, 201); assert.equal(s.result, null);
});
test('Life preserves fractional timing, saved run intent, larger worlds and independent two-colour simulation', () => {
  const s = newLife(); s.running = true;
  assert.equal(advanceLife(s, 208, 65), 13); assert.equal(s.generation, 3);
  assert.equal(advanceLife(s, 52, 65, 13), 0); assert.equal(s.generation, 4);
  resizeLife(s, 80); assert.equal(s.width, 80); assert.equal(s.cells.length, 4480); assert.equal(s.cells.filter(Boolean).length, 5);
  assert(stampLife(s, 'gun', 0)); assert(s.cells.filter(Boolean).length > 5); assert(restoreLife(s)?.running);
  const old = structuredClone(s) as Record<string, unknown>; delete old.running; assert.equal(restoreLife(old)?.running, false);
  const saved = freshState(); saved.life = s; assert.deepEqual(parseState(JSON.stringify({ version: 1, ...saved })).life, s);
  const garden = newLife('garden'); garden.running = true;
  for (let i = 0; i < 150; i++) advanceLife(garden, 250, 125);
  assert.equal(garden.generation, 300); assert.equal(garden.result, null); assert(garden.running);
  seedLife(garden, 'clear'); stampLife(garden, 'block', 500, -1); assert.equal(garden.cells.filter(n => n === -1).length, 4);
});
test('Life identifies oscillators without stopping the simulation', () => {
  const s = newLife(); seedLife(s, 'pulsar'); for (let i = 0; i < 6; i++) stepLife(s);
  assert.match(lifeActivity(s).label, /every 3 generations/);
});
test('Minesweeper tutor uses exposed clues and flags, never covered mine locations', () => {
  const s = newMines(); s.status = 'playing'; s.mines = [1, 30, 31, 40, 41, 50, 51, 60, 61, 70]; s.open[0] = true; s.flags[1] = true;
  const before = structuredClone(s), hint = mineHint(s); assert.equal(hint.kind, 'safe'); assert.deepEqual(hint.cells, [9, 10]); assert.match(hint.reason, /if those flags are correct/); assert.deepEqual(s, before);
  const other = structuredClone(s); other.mines = [1, 32, 33, 42, 43, 52, 53, 62, 63, 72]; assert.deepEqual(mineHint(other), hint);
  s.flags[9] = true; assert.equal(mineHint(s).kind, 'conflict');
  s.flags.fill(false); s.open[9] = s.open[10] = true; assert.equal(mineHint(s).kind, 'flag'); assert.deepEqual(mineHint(s).cells, [1]);
});
test('TetraVex matching guides conserve tiles and support moving a tile back to the tray', () => {
  const s = newTetra(2, rng(4)), before = structuredClone(s), source = { area: 'tray' as const, index: s.tray.indexOf(0) };
  assert(canMoveTile(s, source, { area: 'board', index: 0 })); assert.deepEqual(s, before);
  assert(moveTile(s, source, { area: 'board', index: 0 }));
  const wrong = s.tray.findIndex(id => id !== null && !canMoveTile(s, { area: 'tray', index: s.tray.indexOf(id) }, { area: 'board', index: 1 })); assert(wrong >= 0);
  assert.equal(canMoveTile(s, { area: 'tray', index: wrong }, { area: 'board', index: 1 }), false);
  assert(canMoveTile(s, { area: 'board', index: 0 }, source)); assert(moveTile(s, { area: 'board', index: 0 }, source)); assert.deepEqual(s.tray, before.tray);
});
test('Ski physics substeps slow frames, eases steering and prevents wall steering from farming tricks', () => {
  const a = newSki(), b = newSki(); for (const s of [a, b]) { s.status = 'skiing'; s.generated = 1000000; }
  const input = { steer: .2, brake: false, jump: false, fast: false };
  for (let i = 0; i < 30; i++) stepSki(a, input, .2);
  for (let i = 0; i < 120; i++) stepSki(b, input, .05);
  assert(Math.abs(a.y - b.y) < .001); assert(Math.abs(a.x - b.x) < .001); assert(a.velocity > 0);
  const velocity = a.velocity, speed = a.speed; stepSki(a, { ...input, steer: 0, brake: true }, .05); assert(a.velocity > 0 && a.velocity < velocity); assert(a.speed < speed);
  a.x = 582; for (let i = 0; i < 25; i++) stepSki(a, { ...input, steer: 1, jump: i === 0 }, .05);
  assert.equal(a.score, 100); assert(restoreSki(a));
  const old = structuredClone(a) as Record<string, unknown>; delete old.velocity; delete old.cooldown; assert.equal(restoreSki(old)?.velocity, 0);
});
test('poker allows an opening bet followed by three raises, rather than counting the bet as a raise', () => {
  const s = newPoker(); dealPoker(s, rng(2)); actPoker(s, 'call'); actPoker(s, 'check'); assert.equal(s.street, 1);
  assert(actPoker(s, 'raise')); assert.equal(s.highest, 10); assert.equal(s.raises, 0);
  for (let i = 1; i <= 3; i++) { assert(actPoker(s, 'raise')); assert.equal(s.raises, i); }
  assert.equal(s.highest, 40); assert.equal(pokerActions(s).raise, 0); assert(actPoker(s, 'call')); assert.equal(s.street, 2);
});
test('poker showdown explains kickers and ties; improvement cards respect Omaha rules', () => {
  const s = newPoker(); s.phase = 'showdown'; s.holes = [[c(1, 2), c(11, 1)], [c(12, 2), c(11, 3)]]; s.board = [c(13), c(13, 1), c(7, 2), c(4, 3), c(2, 2)];
  assert.match(pokerShowdown(s)!.explanation, /ace.*queen/);
  s.holes = [[c(10, 1), c(9, 1)], [c(10, 2), c(9, 2)]]; assert.match(pokerShowdown(s)!.explanation, /split/);
  const board = [c(11), c(10), c(4), c(5)], hole = [c(1, 1), c(13, 3), c(2, 2), c(3, 2)];
  assert(pokerDraws({ variant: 'holdem', holes: [hole.slice(0, 2), []], board })!.cards.includes(c(9)));
  assert(!pokerDraws({ variant: 'omaha', holes: [hole, []], board })!.cards.includes(c(9)));
});
test('Blackjack play tutor handles pairs, soft hands and unavailable doubles using only the upcard', () => {
  const s = newBlackjack(); s.phase = 'player'; s.dealer = [c(6), c(10)];
  const hand = (cards: number[]) => { s.hands = [{ cards, bet: 25, status: 'playing', split: false, splitAces: false, outcome: null }]; };
  hand([c(8), c(8, 1)]); assert.equal(blackjackAdvice(s)?.action, 'split');
  hand([c(1), c(7, 1)]); assert.equal(blackjackAdvice(s)?.action, 'double');
  s.bank = 0; assert.equal(blackjackAdvice(s)?.action, 'stand');
  hand([c(10), c(2, 1)]); assert.equal(blackjackAdvice(s)?.action, 'stand'); s.dealer[0] = c(2); assert.equal(blackjackAdvice(s)?.action, 'hit');
  hand([c(5), c(6, 1)]); s.bank = 100; s.dealer[0] = c(1); assert.equal(blackjackAdvice(s)?.action, 'hit'); s.dealer[0] = c(10); assert.equal(blackjackAdvice(s)?.action, 'double');
  const before = blackjackAdvice(s); s.dealer[1] = c(2); assert.deepEqual(blackjackAdvice(s), before);
});
test('counting reviews follow partial batches and a six-deck shoe returns to zero', () => {
  const s = newCountDrill(6, 400, rng(8)); startCountBatch(s); for (let i = 0; i < 3; i++) nextCountCard(s); s.phase = 'quiz'; gradeCount(s, drillCount(s)); startCountBatch(s);
  assert.equal(s.batchStart, 3); assert.equal(s.target, 13); assert(restoreCountDrill(s));
  while (s.index < s.deck.length) { while (s.phase === 'running') nextCountCard(s); gradeCount(s, drillCount(s)); startCountBatch(s); }
  assert.equal(drillCount(s), 0); assert.equal(s.batchStart, 303); assert.equal(s.index - s.batchStart, 9);
});
test('patience tutor explains hidden-card reveals without exposing the hidden card', () => {
  const s = newPatience(); s.tableau = [[{ card: c(4), up: false }, { card: c(8), up: true }], [{ card: c(9, 1), up: true }], [], [], [], [], []];
  const move = patienceMoves(s).find(m => m.from.index === 0 && m.to.index === 1)!; assert(move);
  const explanation = explainPatienceMove(s, move); assert.match(explanation, /uncovers a face-down card/); assert(!explanation.includes('4 of'));
});
