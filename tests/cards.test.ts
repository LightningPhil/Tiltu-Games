import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardName, rank, red, shuffledDeck } from '../src/cards.ts';
import { actBlackjack, canDouble, canSplit, dealBlackjack, handValue, newBlackjack, restoreBlackjack, stepBlackjackDealer } from '../src/blackjack.ts';
import { canMovePatience, drawPatience, movePatience, newPatience, patienceHint, patienceMoves, patienceWon, restorePatience, safeFoundation, sourceCards, undoPatience } from '../src/patience.ts';
import type { CardSource, PatienceSession, TableauCard } from '../src/patience.ts';
import { blackjackPage, patiencePage } from '../src/card-view.ts';
import { freshState, parseState } from '../src/state.ts';

const c = (rank: number, suit = 0, deck = 0) => rank - 1 + 13 * suit + 52 * deck;
function seeded(seed: number): () => number { return () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296); }
function blackjack(order: number[]) {
  assert.equal(new Set(order).size, order.length);
  const s = newBlackjack();
  s.shoe = [...Array.from({ length: 312 }, (_, i) => i).filter(i => !order.includes(i)), ...order.toReversed()];
  assert(dealBlackjack(s));
  return s;
}
function finishDealer(s: ReturnType<typeof newBlackjack>) {
  for (let step = 0; step < 30 && s.phase === 'dealer'; step++) assert(stepBlackjackDealer(s));
  assert.equal(s.phase, 'settled');
}
const up = (card: number): TableauCard => ({ card, up: true });
const down = (card: number): TableauCard => ({ card, up: false });
function layout(columns: TableauCard[][], waste: number[] = [], foundations: number[][] = [[], [], [], []]): PatienceSession {
  const s = newPatience(1, Array.from({ length: 52 }, (_, i) => i));
  const used = [...columns.flatMap(p => p.map(c => c.card)), ...waste, ...foundations.flat()];
  assert.equal(new Set(used).size, used.length);
  s.tableau = Array.from({ length: 7 }, (_, i) => columns[i] ?? []);
  s.stock = s.deck.filter(c => !used.includes(c)); s.waste = waste; s.foundations = foundations;
  return s;
}
const allPatienceCards = (s: PatienceSession) => [...s.stock, ...s.waste, ...s.foundations.flat(), ...s.tableau.flatMap(p => p.map(c => c.card))].sort((a, b) => a - b);

test('decks have unique cards; shuffling is reproducible and keeps the complete pack', () => {
  const a = shuffledDeck(1, seeded(3)), b = shuffledDeck(1, seeded(3));
  assert.deepEqual(a, b); assert.notDeepEqual(a, shuffledDeck(1, seeded(4)));
  assert.deepEqual(a.toSorted((a, b) => a - b), Array.from({ length: 52 }, (_, i) => i));
  const shoe = shuffledDeck(6, seeded(1)); assert.equal(new Set(shoe).size, 312);
  assert.equal(cardName(c(12, 1)), 'Queen of hearts'); assert.equal(red(c(10, 1)), true); assert.equal(rank(c(1, 3, 5)), 1);
});
test('blackjack values handle multiple aces and switch from soft to hard without busting', () => {
  assert.deepEqual(handValue([c(1), c(1, 1), c(9, 2)]), { total: 21, soft: true });
  assert.deepEqual(handValue([c(1), c(1, 1), c(9, 2), c(13, 3)]), { total: 21, soft: false });
  assert.deepEqual(handValue([c(1), c(6)]), { total: 17, soft: true });
});
test('naturals pay 3:2 exactly, matching naturals push and the dealer checks before player actions', () => {
  const win = blackjack([c(1), c(10, 1), c(13), c(7, 2)]);
  assert.equal(win.phase, 'settled'); assert.equal(win.hands[0].outcome, 'blackjack'); assert.equal(win.bank, 1037.5);
  const push = blackjack([c(1), c(1, 1), c(13), c(13, 1)]);
  assert.equal(push.hands[0].outcome, 'push'); assert.equal(push.bank, 1000);
  const lose = blackjack([c(10), c(1, 1), c(13), c(13, 1)]);
  assert.equal(lose.hands[0].outcome, 'lose'); assert.equal(lose.bank, 975); assert.equal(actBlackjack(lose, 'hit'), false);
  assert.equal(stepBlackjackDealer(win), false); assert.equal(win.bank, 1037.5);
});
test('dealer stands on soft 17, and draws are exposed one card at a time', () => {
  const soft = blackjack([c(10), c(1, 1), c(7), c(6, 2)]);
  assert(actBlackjack(soft, 'stand')); assert.equal(soft.phase, 'dealer');
  const remaining = soft.shoe.length; finishDealer(soft);
  assert.equal(soft.shoe.length, remaining); assert.equal(soft.bank, 1000);
  const draw = blackjack([c(10), c(9, 1), c(8), c(7, 2), c(5, 3)]);
  actBlackjack(draw, 'stand'); stepBlackjackDealer(draw);
  assert.equal(draw.dealer.length, 3); assert.equal(handValue(draw.dealer).total, 21); assert.equal(draw.phase, 'dealer');
  stepBlackjackDealer(draw); assert.equal(draw.phase, 'settled'); assert.equal(draw.bank, 975);
});
test('busting ends the hand, and doubling takes exactly one card and the extra stake', () => {
  const bust = blackjack([c(10), c(9, 1), c(6), c(7, 2), c(13, 3)]);
  assert(actBlackjack(bust, 'hit')); assert.equal(bust.phase, 'settled'); assert.equal(bust.hands[0].status, 'bust'); assert.equal(bust.dealer.length, 2);
  const doubled = blackjack([c(5), c(9, 1), c(6), c(7, 2), c(13, 3), c(4, 3)]);
  assert(canDouble(doubled)); assert(actBlackjack(doubled, 'double'));
  assert.equal(doubled.hands[0].bet, 50); assert.equal(doubled.hands[0].cards.length, 3); assert.equal(doubled.bank, 950);
  assert.equal(actBlackjack(doubled, 'hit'), false); finishDealer(doubled); assert.equal(doubled.bank, 1050);
});
test('split hands play in order, permit doubling and settle their own stakes', () => {
  const s = blackjack([c(8), c(10), c(8, 1), c(7), c(3, 2), c(2, 2), c(12, 3)]);
  assert(canSplit(s)); assert(actBlackjack(s, 'split')); assert.equal(s.hands.length, 2); assert.equal(s.bank, 950);
  actBlackjack(s, 'stand'); assert.equal(s.active, 1); assert(canDouble(s)); actBlackjack(s, 'double');
  assert.equal(s.bank, 925); finishDealer(s); assert.deepEqual(s.hands.map(h => h.outcome), ['lose', 'win']); assert.equal(s.bank, 1025);
});
test('split aces get one card, regular-21 payouts and no resplit; no more than four hands', () => {
  const aces = blackjack([c(1), c(10, 1), c(1, 1), c(7, 2), c(13, 2), c(9, 3)]);
  actBlackjack(aces, 'split'); assert.equal(aces.phase, 'dealer'); assert(aces.hands.every(h => h.cards.length === 2 && h.status === 'stood'));
  assert.equal(canSplit(aces), false); finishDealer(aces); assert.equal(aces.bank, 1050); assert.deepEqual(aces.hands.map(h => h.outcome), ['win', 'win']);
  const four = blackjack([c(8), c(2), c(8, 1), c(3), c(8, 2), c(8, 3), c(8, 0, 1), c(8, 1, 1), c(8, 2, 1), c(8, 3, 1)]);
  for (let i = 0; i < 3; i++) assert(actBlackjack(four, 'split'));
  assert.equal(four.hands.length, 4); assert.equal(canSplit(four), false);
});
test('blackjack rejects uncovered bets and unaffordable doubles or splits without changing the table', () => {
  const s = newBlackjack(); s.bank = 10;
  const before = structuredClone(s); assert.equal(dealBlackjack(s), false); assert.deepEqual(s, before);
  const pair = blackjack([c(8), c(10), c(8, 1), c(7)]); pair.bank = 0;
  const snapshot = structuredClone(pair); assert.equal(actBlackjack(pair, 'split'), false); assert.equal(actBlackjack(pair, 'double'), false); assert.deepEqual(pair, snapshot);
  s.bank = 1000; s.bet = 5; assert(dealBlackjack(s, seeded(1))); assert.equal(s.shoe.length, 308);
});
test('seeded blackjack rounds conserve chips across all payouts and survive mid-hand saves', () => {
  const s = newBlackjack(), random = seeded(42); let expected = 1000;
  for (let round = 0; round < 100; round++) {
    s.bet = 5; assert(dealBlackjack(s, random));
    while (s.phase === 'player') {
      assert.deepEqual(restoreBlackjack(structuredClone(s)), s);
      const h = s.hands[s.active];
      const action = canSplit(s) && random() < .5 ? 'split' : canDouble(s) && handValue(h.cards).total === 11 ? 'double' : handValue(h.cards).total < 17 ? 'hit' : 'stand';
      assert(actBlackjack(s, action));
    }
    if (s.phase === 'dealer') { assert.deepEqual(restoreBlackjack(structuredClone(s)), s); finishDealer(s); }
    for (const h of s.hands) expected += h.bet * (h.outcome === 'blackjack' ? 1.5 : h.outcome === 'win' ? 1 : h.outcome === 'lose' ? -1 : 0);
    assert.equal(s.bank, expected); assert.deepEqual(restoreBlackjack(structuredClone(s)), s);
  }
});
test('patience deals 28 tableau cards, seven exposed cards and 24 stock cards without duplicates', () => {
  const s = newPatience(1, shuffledDeck(1, seeded(7)));
  assert.deepEqual(s.tableau.map(p => p.length), [1, 2, 3, 4, 5, 6, 7]); assert.equal(s.stock.length, 24);
  assert.equal(s.tableau.flat().filter(c => c.up).length, 7); assert.equal(new Set(allPatienceCards(s)).size, 52);
  assert.deepEqual(restorePatience(structuredClone(s)), s);
});
test('draw-three stock recycling preserves order, takes a final short packet and undoes exactly', () => {
  const s = newPatience(3, Array.from({ length: 52 }, (_, i) => i)), initial = structuredClone(s);
  for (let i = 0; i < 8; i++) assert(drawPatience(s));
  assert.equal(s.stock.length, 0); assert.equal(s.waste.length, 24); const firstPass = s.waste.slice();
  s.score = 30; assert(drawPatience(s)); assert.equal(s.score, 10);
  for (let i = 0; i < 8; i++) drawPatience(s);
  assert.deepEqual(s.waste, firstPass);
  while (s.history.length) undoPatience(s);
  assert.deepEqual(s, initial);
  const short = newPatience(3, Array.from({ length: 52 }, (_, i) => i));
  while (short.stock.length > 2) short.tableau[6].unshift(down(short.stock.pop()!));
  assert(drawPatience(short)); assert.equal(short.waste.length, 2); assert.equal(short.stock.length, 0);
  assert(restorePatience(short));
});
test('only alternating descending face-up sequences move; exposed cards turn up and undo reverses them', () => {
  const s = layout([[down(c(12)), up(c(7, 1)), up(c(6, 2))], [up(c(8))]]), before = structuredClone(s);
  const from: CardSource = { pile: 'tableau', index: 0, at: 1 };
  assert.equal(canMovePatience(s, from, { pile: 'tableau', index: 1 }), true);
  assert.equal(canMovePatience(s, { ...from, at: 0 }, { pile: 'tableau', index: 1 }), false);
  assert.equal(canMovePatience(s, from, { pile: 'tableau', index: 2 }), false);
  assert(movePatience(s, from, { pile: 'tableau', index: 1 }));
  assert.equal(s.tableau[0][0].up, true); assert.equal(s.tableau[1].length, 3); assert.equal(s.score, 5);
  assert(undoPatience(s)); assert.deepEqual(s, before);
  s.tableau[0][2].card = c(6, 3); assert.deepEqual(sourceCards(s, from), []);
});
test('kings fill empty columns, only the top waste moves, and foundations build by suit', () => {
  const s = layout([[up(c(13))], [up(c(2, 1))]], [c(5), c(1)]);
  assert(canMovePatience(s, { pile: 'tableau', index: 0, at: 0 }, { pile: 'tableau', index: 2 }));
  assert.equal(sourceCards(s, { pile: 'waste', index: 0, at: 0 }).length, 0);
  const ace: CardSource = { pile: 'waste', index: 0, at: 1 };
  assert.equal(canMovePatience(s, ace, { pile: 'foundation', index: 1 }), false);
  assert(movePatience(s, ace, { pile: 'foundation', index: 0 })); assert.equal(s.score, 10);
  assert(movePatience(s, { pile: 'foundation', index: 0, at: 0 }, { pile: 'tableau', index: 1 })); assert.equal(s.score, 0);
});
test('hints uncover hidden cards and auto-foundation retains cards still needed for lower sequences', () => {
  const s = layout([[down(c(12)), up(c(7, 1))], [up(c(8))], [up(c(4))]], [], [[], [], [], []]);
  const hint = patienceHint(s); assert(hint); assert.equal(hint.from.index, 0); assert.equal(hint.to.index, 1);
  const foundations = [Array.from({ length: 3 }, (_, i) => c(i + 1)), Array.from({ length: 2 }, (_, i) => c(i + 1, 1)), Array.from({ length: 2 }, (_, i) => c(i + 1, 2)), Array.from({ length: 3 }, (_, i) => c(i + 1, 3))];
  const safe = layout([[up(c(4))]], [], foundations);
  const move = patienceMoves(safe).find(m => m.to.pile === 'foundation')!;
  assert.equal(safeFoundation(safe, move), false);
  safe.stock.splice(safe.stock.indexOf(c(3, 1)), 1); safe.foundations[1].push(c(3, 1)); assert(safeFoundation(safe, move));
});
test('a completed patience game is recognised and a winning move can be undone', () => {
  const foundations = Array.from({ length: 4 }, (_, suit) => Array.from({ length: suit === 3 ? 12 : 13 }, (_, i) => c(i + 1, suit)));
  const s = layout([[up(c(13, 3))]], [], foundations);
  assert.equal(patienceWon(s), false); assert(movePatience(s, { pile: 'tableau', index: 0, at: 0 }, { pile: 'foundation', index: 3 }));
  assert(patienceWon(s)); assert.deepEqual(patienceMoves(s), []); assert.equal(drawPatience(s), false); assert(undoPatience(s)); assert.equal(patienceWon(s), false);
});
test('legal play preserves all 52 cards across seeded deals, stock cycles and complete undo', () => {
  for (const draw of [1, 3] as const) for (let seed = 1; seed <= 8; seed++) {
    const s = newPatience(draw, shuffledDeck(1, seeded(seed))), initial = structuredClone(s), random = seeded(seed + 90);
    for (let turn = 0; turn < 80; turn++) {
      const legal = patienceMoves(s), move = legal[Math.floor(random() * legal.length)];
      if (move && random() > .3) assert(movePatience(s, move.from, move.to)); else drawPatience(s);
      assert.deepEqual(allPatienceCards(s), Array.from({ length: 52 }, (_, i) => i));
    }
    assert.deepEqual(restorePatience(structuredClone(s)), s);
    while (s.history.length) undoPatience(s);
    assert.deepEqual(s, initial);
  }
});
test('card saves migrate alongside existing games and corrupted card states recover independently', () => {
  const s = freshState(); s.patience = newPatience(3, shuffledDeck(1, seeded(12))); s.preferences.game = 'patience'; s.preferences.patienceDraw = 3;
  drawPatience(s.patience); s.blackjack = blackjack([c(8), c(10), c(8, 1), c(7)]); actBlackjack(s.blackjack, 'split');
  assert.deepEqual(parseState(JSON.stringify({ version: 1, ...s })), s);
  const damaged = structuredClone(s); damaged.patience!.stock[0] = damaged.patience!.tableau[0][0].card; damaged.blackjack.bank = -1;
  const loaded = parseState(JSON.stringify({ version: 1, ...damaged }));
  assert.equal(loaded.patience, null); assert.deepEqual(loaded.blackjack, newBlackjack()); assert.deepEqual(loaded.chess, s.chess);
  const { blackjack: ignoredB, patience: ignoredP, ...old } = s;
  const migrated = parseState(JSON.stringify({ version: 1, ...old })); assert.equal(migrated.patience, null); assert.deepEqual(migrated.blackjack, newBlackjack());
});
test('card views expose useful labels, hide the dealer hole card and keep both games in Grid Club', () => {
  const bj = blackjack([c(8), c(10), c(8, 1), c(7)]);
  const html = blackjackPage(bj, '', '');
  assert(html.includes('Face-down card')); assert.equal(html.includes('aria-label="7 of spades"'), false);
  assert(html.includes('Windows 3.1 inspired')); assert(html.includes('Practice chips'));
  const p = newPatience(1, shuffledDeck(1, seeded(12))); const view = patiencePage(p, 1, null, null, '', '');
  assert(view.includes('Klondike patience card table')); assert(view.includes('Draw one card, 24 cards in stock'));
  assert(view.includes('Empty hearts foundation, start with an ace'));
});
