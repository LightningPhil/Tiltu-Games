import { cardList, cardName, isRecord, rank, red, shuffledDeck, suit, whole } from './cards.ts';
import type { Card } from './cards.ts';

export type DrawCount = 1 | 3;
export interface TableauCard { card: Card; up: boolean }
export interface PatienceSnapshot { stock: Card[]; waste: Card[]; foundations: Card[][]; tableau: TableauCard[][]; score: number; moves: number }
export interface PatienceSession extends PatienceSnapshot { deck: Card[]; draw: DrawCount; history: PatienceSnapshot[] }
export interface CardSource { pile: 'waste' | 'foundation' | 'tableau'; index: number; at: number }
export interface CardTarget { pile: 'foundation' | 'tableau'; index: number }
export interface PatienceMove { from: CardSource; to: CardTarget; text: string }
export function newPatience(draw: DrawCount = 1, deck = shuffledDeck()): PatienceSession {
  if (!cardList(deck) || deck.length !== 52 || new Set(deck).size !== 52) throw new Error('A deal needs 52 different cards.');
  const stock = deck.slice(), tableau: TableauCard[][] = [];
  for (let column = 0; column < 7; column++) {
    const pile: TableauCard[] = [];
    for (let row = 0; row <= column; row++) pile.push({ card: stock.pop()!, up: row === column });
    tableau.push(pile);
  }
  return { deck: deck.slice(), draw, stock, waste: [], foundations: [[], [], [], []], tableau, score: 0, moves: 0, history: [] };
}
export const patienceWon = (s: PatienceSnapshot): boolean => s.foundations.every(f => f.length === 13);
export const canFinishPatience = (s: PatienceSnapshot): boolean => !patienceWon(s) && !s.stock.length && !s.waste.length && s.tableau.every(pile => pile.every(card => card.up));
export function sourceCards(s: PatienceSnapshot, from: CardSource): Card[] {
  if (!whole(from.index, 0, from.pile === 'tableau' ? 6 : from.pile === 'foundation' ? 3 : 0) || !Number.isInteger(from.at)) return [];
  if (from.pile === 'waste') return from.at === s.waste.length - 1 && from.at >= 0 ? [s.waste[from.at]] : [];
  if (from.pile === 'foundation') { const pile = s.foundations[from.index]; return from.at === pile.length - 1 && from.at >= 0 ? [pile[from.at]] : []; }
  const pile = s.tableau[from.index];
  if (from.at < 0 || from.at >= pile.length || !pile[from.at].up) return [];
  const cards = pile.slice(from.at);
  return cards.every((c, i) => c.up && (i === 0 || (rank(cards[i - 1].card) === rank(c.card) + 1 && red(cards[i - 1].card) !== red(c.card)))) ? cards.map(c => c.card) : [];
}
export function canMovePatience(s: PatienceSnapshot, from: CardSource, to: CardTarget): boolean {
  if (patienceWon(s) || !whole(to.index, 0, to.pile === 'tableau' ? 6 : 3) || (from.pile === to.pile && from.index === to.index)) return false;
  const cards = sourceCards(s, from), first = cards[0];
  if (!cards.length) return false;
  if (to.pile === 'foundation') return cards.length === 1 && suit(first) === to.index && rank(first) === s.foundations[to.index].length + 1;
  const top = s.tableau[to.index].at(-1);
  return top ? top.up && rank(top.card) === rank(first) + 1 && red(top.card) !== red(first) : rank(first) === 13;
}
function snapshot(s: PatienceSnapshot): PatienceSnapshot {
  return { stock: s.stock.slice(), waste: s.waste.slice(), foundations: s.foundations.map(f => f.slice()), tableau: s.tableau.map(p => p.map(c => ({ ...c }))), score: s.score, moves: s.moves };
}
function remember(s: PatienceSession): void { s.history.push(snapshot(s)); if (s.history.length > 200) s.history.shift(); s.moves++; }
export function drawPatience(s: PatienceSession): boolean {
  if (patienceWon(s) || (!s.stock.length && !s.waste.length)) return false;
  remember(s);
  if (!s.stock.length) { s.stock = s.waste.reverse(); s.waste = []; s.score = Math.max(0, s.score - 20); }
  else for (let i = 0; i < s.draw && s.stock.length; i++) s.waste.push(s.stock.pop()!);
  return true;
}
export function movePatience(s: PatienceSession, from: CardSource, to: CardTarget): boolean {
  if (patienceWon(s) || !canMovePatience(s, from, to)) return false;
  const cards = sourceCards(s, from);
  remember(s);
  if (from.pile === 'waste') s.waste.pop();
  else if (from.pile === 'foundation') s.foundations[from.index].pop();
  else {
    const pile = s.tableau[from.index]; pile.splice(from.at);
    if (pile.length && !pile.at(-1)!.up) { pile.at(-1)!.up = true; s.score += 5; }
  }
  if (to.pile === 'foundation') { s.foundations[to.index].push(cards[0]); s.score += 10; }
  else { s.tableau[to.index].push(...cards.map(card => ({ card, up: true }))); if (from.pile === 'waste') s.score += 5; }
  if (from.pile === 'foundation') s.score = Math.max(0, s.score - 15);
  return true;
}
export function undoPatience(s: PatienceSession): boolean {
  const previous = s.history.pop();
  if (!previous) return false;
  Object.assign(s, previous); return true;
}
export function patienceMoves(s: PatienceSnapshot): PatienceMove[] {
  const sources: CardSource[] = [];
  if (s.waste.length) sources.push({ pile: 'waste', index: 0, at: s.waste.length - 1 });
  s.tableau.forEach((pile, index) => pile.forEach((c, at) => { if (c.up) sources.push({ pile: 'tableau', index, at }); }));
  s.foundations.forEach((pile, index) => { if (pile.length) sources.push({ pile: 'foundation', index, at: pile.length - 1 }); });
  const moves: PatienceMove[] = [];
  for (const from of sources) for (const pile of ['foundation', 'tableau'] as const) for (let index = 0; index < (pile === 'foundation' ? 4 : 7); index++) {
    const to = { pile, index };
    if (!canMovePatience(s, from, to)) continue;
    const card = sourceCards(s, from)[0];
    moves.push({ from, to, text: `Move ${cardName(card)}${sourceCards(s, from).length > 1 ? ' and its sequence' : ''} to ${pile === 'foundation' ? 'its foundation' : `column ${index + 1}`}.` });
  }
  return moves;
}
export function safeFoundation(s: PatienceSnapshot, move: PatienceMove): boolean {
  if (move.to.pile !== 'foundation') return false;
  const card = sourceCards(s, move.from)[0], r = rank(card);
  return r <= 2 || s.foundations.every((f, index) => index === suit(card) || f.length >= r - (index % 2 !== suit(card) % 2 ? 1 : 2));
}
export function patienceHint(s: PatienceSession): PatienceMove | null {
  const key=(p:PatienceSnapshot)=>JSON.stringify([p.tableau,p.foundations,p.waste,p.stock]),recent=new Set(s.history.slice(-100).map(key));
  return patienceMoves(s).filter(m => !(m.to.pile === 'tableau' && !s.tableau[m.to.index].length && m.from.pile === 'tableau' && m.from.at === 0)).map(m=>{
    const next={...s,tableau:s.tableau.map(p=>p.map(c=>({...c}))),foundations:s.foundations.map(f=>f.slice()),waste:s.waste.slice(),stock:s.stock.slice(),history:[]};movePatience(next,m.from,m.to);
    const score=(recent.has(key(next))?-10000:0)+(safeFoundation(s, m) ? 100 : 0) + (m.from.pile === 'tableau' && m.from.at > 0 && !s.tableau[m.from.index][m.from.at - 1].up ? 80 : 0) + (m.from.pile === 'waste' ? 30 : 0) - (m.from.pile === 'foundation' ? 40 : 0);
    return {m,score};
  }).filter(v=>v.score>-9000).sort((a,b)=>b.score-a.score)[0]?.m??null;
}
export function explainPatienceMove(s: PatienceSession, move: PatienceMove): string {
  if (!canMovePatience(s, move.from, move.to)) return 'That move is no longer available.';
  const { from, to } = move;
  const reasons = [move.text];
  if (from.pile === 'tableau' && from.at > 0 && !s.tableau[from.index][from.at - 1].up) reasons.push('It uncovers a face-down card, opening a new choice.');
  if (from.pile === 'tableau' && from.at === 0) reasons.push('It frees a column for a king or a king-led sequence.');
  if (to.pile === 'foundation') reasons.push(safeFoundation(s, move) ? 'Lower cards are far enough along that this card is safe to put away.' : 'It advances a foundation, but this card may still be useful in the tableau. You can bring it back later.');
  else reasons.push('The sequence descends by one rank and alternates red and black.');
  return reasons.join(' ');
}
function validSnapshot(value: unknown): value is PatienceSnapshot {
  if (!isRecord(value) || !cardList(value.stock) || !cardList(value.waste) || !whole(value.score, 0, 10000000) || !whole(value.moves, 0, 1000000)
    || !Array.isArray(value.foundations) || value.foundations.length !== 4 || !value.foundations.every(cardListOne)
    || !Array.isArray(value.tableau) || value.tableau.length !== 7) return false;
  const all: Card[] = [...value.stock, ...value.waste];
  for (const [index, foundation] of value.foundations.entries()) {
    if (foundation.length > 13 || !foundation.every((c: Card, i: number) => suit(c) === index && rank(c) === i + 1)) return false;
    all.push(...foundation);
  }
  for (const pile of value.tableau) {
    if (!Array.isArray(pile) || pile.length > 52 || !pile.every(c => isRecord(c) && whole(c.card, 0, 51) && typeof c.up === 'boolean')) return false;
    if (pile.length && !pile.at(-1).up) return false;
    for (let i = 0; i < pile.length; i++) {
      const c = pile[i]; all.push(c.card);
      if (i > 0 && pile[i - 1].up && (!c.up || rank(pile[i - 1].card) !== rank(c.card) + 1 || red(pile[i - 1].card) === red(c.card))) return false;
    }
  }
  return all.length === 52 && new Set(all).size === 52;
}
function cardListOne(value: unknown): value is Card[] { return cardList(value); }
export function restorePatience(value: unknown): PatienceSession | null {
  if (!validSnapshot(value)) return null;
  const v = value as unknown as Record<string, unknown>;
  if (!cardList(v.deck) || v.deck.length !== 52 || new Set(v.deck).size !== 52 || (v.draw !== 1 && v.draw !== 3)
    || !Array.isArray(v.history) || v.history.length > 200 || !v.history.every(validSnapshot)) return null;
  return value as PatienceSession;
}
