import { cardList, isRecord, rank, shuffledDeck, whole } from './cards.ts';
import type { Card } from './cards.ts';

export interface BlackjackHand {
  cards: Card[]; bet: number; status: 'playing' | 'stood' | 'bust';
  split: boolean; splitAces: boolean; outcome: 'win' | 'lose' | 'push' | 'blackjack' | null;
}
export interface BlackjackSession {
  shoe: Card[]; dealer: Card[]; hands: BlackjackHand[]; active: number;
  phase: 'betting' | 'player' | 'dealer' | 'settled'; bank: number; bet: number;
  rounds: number; wins: number; losses: number; pushes: number;
}
export function newBlackjack(): BlackjackSession {
  return { shoe: [], dealer: [], hands: [], active: 0, phase: 'betting', bank: 1000, bet: 25, rounds: 0, wins: 0, losses: 0, pushes: 0 };
}
export function handValue(cards: readonly Card[]): { total: number; soft: boolean } {
  let total = 0, aces = 0;
  for (const card of cards) { const r = rank(card); total += Math.min(r, 10); if (r === 1) aces++; }
  const soft = aces > 0 && total + 10 <= 21;
  return { total: total + (soft ? 10 : 0), soft };
}
export const natural = (hand: BlackjackHand): boolean => !hand.split && hand.cards.length === 2 && handValue(hand.cards).total === 21;
export const canDouble = (s: BlackjackSession): boolean => s.phase === 'player' && s.hands[s.active]?.cards.length === 2 && !s.hands[s.active].splitAces && s.bank >= s.hands[s.active].bet;
export const canSplit = (s: BlackjackSession): boolean => {
  const h = s.hands[s.active];
  return s.phase === 'player' && !!h && h.cards.length === 2 && !h.splitAces && rank(h.cards[0]) === rank(h.cards[1]) && s.hands.length < 4 && s.bank >= h.bet;
};
function draw(s: BlackjackSession): Card {
  const card = s.shoe.pop();
  if (card === undefined) throw new Error('The shoe is empty.');
  return card;
}
function settle(s: BlackjackSession): void {
  if (s.phase === 'settled') return;
  const dealer = handValue(s.dealer).total, dealerNatural = s.dealer.length === 2 && dealer === 21;
  for (const h of s.hands) {
    const total = handValue(h.cards).total;
    if (total > 21) h.outcome = 'lose';
    else if (natural(h)) h.outcome = dealerNatural ? 'push' : 'blackjack';
    else if (dealerNatural) h.outcome = 'lose';
    else if (dealer > 21 || total > dealer) h.outcome = 'win';
    else h.outcome = total === dealer ? 'push' : 'lose';
    s.bank += h.bet * (h.outcome === 'blackjack' ? 2.5 : h.outcome === 'win' ? 2 : h.outcome === 'push' ? 1 : 0);
    if (h.outcome === 'win' || h.outcome === 'blackjack') s.wins++;
    else if (h.outcome === 'lose') s.losses++; else s.pushes++;
    h.status = total > 21 ? 'bust' : 'stood';
  }
  s.phase = 'settled';
}
function nextHand(s: BlackjackSession): void {
  const next = s.hands.findIndex(h => h.status === 'playing');
  if (next >= 0) { s.active = next; return; }
  s.phase = 'dealer';
  if (s.hands.every(h => h.status === 'bust')) settle(s);
}
export function dealBlackjack(s: BlackjackSession, random = Math.random): boolean {
  if (!['betting', 'settled'].includes(s.phase) || s.bet < 5 || s.bet > s.bank || s.bet % 5 !== 0) return false;
  if (s.shoe.length < 80) s.shoe = shuffledDeck(6, random);
  s.bank -= s.bet; s.rounds++; s.active = 0; s.phase = 'player';
  const playerFirst = draw(s), dealerFirst = draw(s), playerSecond = draw(s), dealerSecond = draw(s);
  s.dealer = [dealerFirst, dealerSecond];
  s.hands = [{ cards: [playerFirst, playerSecond], bet: s.bet, status: 'playing', split: false, splitAces: false, outcome: null }];
  if (natural(s.hands[0]) || handValue(s.dealer).total === 21) settle(s);
  return true;
}
export function actBlackjack(s: BlackjackSession, action: 'hit' | 'stand' | 'double' | 'split'): boolean {
  if (s.phase !== 'player') return false;
  const h = s.hands[s.active];
  if (!h || h.status !== 'playing') return false;
  if (action === 'split') {
    if (!canSplit(s)) return false;
    s.bank -= h.bet;
    const ace = rank(h.cards[0]) === 1;
    const make = (card: Card): BlackjackHand => ({ cards: [card, draw(s)], bet: h.bet, status: 'playing', split: true, splitAces: ace, outcome: null });
    const pair = h.cards.map(make);
    for (const hand of pair) if (ace || handValue(hand.cards).total === 21) hand.status = 'stood';
    s.hands.splice(s.active, 1, ...pair);
  } else {
    if (action === 'double') { if (!canDouble(s)) return false; s.bank -= h.bet; h.bet *= 2; }
    if (action !== 'stand') h.cards.push(draw(s));
    const total = handValue(h.cards).total;
    h.status = total > 21 ? 'bust' : action !== 'hit' || total === 21 ? 'stood' : 'playing';
  }
  nextHand(s);
  return true;
}
// Advance only one step so the interface can show every dealer card as it lands.
export function stepBlackjackDealer(s: BlackjackSession): boolean {
  if (s.phase !== 'dealer') return false;
  if (handValue(s.dealer).total < 17) s.dealer.push(draw(s));
  else settle(s);
  return true;
}
export function restoreBlackjack(value: unknown): BlackjackSession | null {
  if (!isRecord(value) || !['betting', 'player', 'dealer', 'settled'].includes(value.phase as string)
    || !cardList(value.shoe, 6) || !cardList(value.dealer, 6) || value.dealer.length > 22
    || !Array.isArray(value.hands) || value.hands.length > 4
    || !whole(value.active, 0, Math.max(0, value.hands.length - 1))
    || typeof value.bank !== 'number' || !Number.isSafeInteger(value.bank * 2) || value.bank < 0 || value.bank > 100000000
    || !whole(value.bet, 5, 100) || value.bet % 5 || !['rounds', 'wins', 'losses', 'pushes'].every(k => whole(value[k], 0, 10000000))) return null;
  for (const h of value.hands) {
    if (!isRecord(h) || !cardList(h.cards, 6) || h.cards.length < 2 || h.cards.length > 22 || !whole(h.bet, 5, 200) || h.bet % 5
      || !['playing', 'stood', 'bust'].includes(h.status as string) || typeof h.split !== 'boolean' || typeof h.splitAces !== 'boolean'
      || (h.outcome !== null && !['win', 'lose', 'push', 'blackjack'].includes(h.outcome as string))) return null;
    const total = handValue(h.cards).total;
    if ((h.status === 'bust') !== (total > 21) || (h.splitAces && (!h.split || h.cards.length !== 2 || h.status === 'playing'))
      || (value.phase === 'settled') !== (h.outcome !== null)) return null;
  }
  const s = value as unknown as BlackjackSession;
  const all = [...s.shoe, ...s.dealer, ...s.hands.flatMap(h => h.cards)];
  if (new Set(all).size !== all.length) return null;
  if (s.phase === 'betting' ? s.hands.length !== 0 || s.dealer.length !== 0 : !s.hands.length || s.dealer.length < 2) return null;
  if (s.phase === 'player' && (s.hands[s.active].status !== 'playing' || handValue(s.dealer).total === 21)) return null;
  if (s.phase !== 'player' && s.hands.some(h => h.status === 'playing')) return null;
  if (s.phase === 'dealer' && s.shoe.length < 22) return null;
  return s;
}
