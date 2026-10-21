import {skillChoice,skillIndex} from './skill.ts';
import { cardList, cardName, isRecord, rank, shuffledDeck, suit, whole } from './cards.ts';
import type { Card } from './cards.ts';
export type PokerVariant = 'holdem' | 'omaha' | 'draw';
export const POKER_NAMES: Record<PokerVariant, string> = { holdem: 'Texas Hold’em', omaha: 'Omaha', draw: 'Five-card Draw' };
export interface PokerRank { category: number; kickers: number[]; value: number; cards: Card[]; name: string }
export interface PokerSession {
  variant: PokerVariant; deck: Card[]; holes: [Card[], Card[]]; board: Card[]; discarded: Card[];
  stacks: [number, number]; pot: number; invested: [number, number]; contributions: [number, number]; highest: number;
  phase: 'ready' | 'betting' | 'draw' | 'showdown'; street: number; turn: number; dealer: number; pending: number[]; raises: number;
  handNo: number; wins: [number, number, number]; folded: number | null; winners: number[]; awards: [number, number]; result: string; log: string[];
}
export interface PokerActions { call: number; check: boolean; raise: number; fold: boolean }
export function combinations<T>(values: readonly T[], count: number): T[][] {
  const out: T[][] = [];
  function visit(at: number, items: T[]) { if (items.length === count) { out.push(items.slice()); return; } for (let i = at; i <= values.length - (count - items.length); i++) visit(i + 1, [...items, values[i]]); }
  visit(0, []); return out;
}
const highRank = (card: Card) => rank(card) === 1 ? 14 : rank(card);
const rankWord = (r: number) => ({ 14: 'aces', 13: 'kings', 12: 'queens', 11: 'jacks' } as Record<number, string>)[r] ?? `${r}s`;
export function evaluateFive(cards: readonly Card[]): PokerRank {
  if (cards.length !== 5 || new Set(cards).size !== 5) throw new Error('A poker hand needs five distinct cards.');
  const ranks = cards.map(highRank).sort((a, b) => b - a), counts = new Map<number, number>();
  ranks.forEach(r => counts.set(r, (counts.get(r) ?? 0) + 1));
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every(c => suit(c) === suit(cards[0]));
  const straight = counts.size === 5 ? ranks[0] - ranks[4] === 4 ? ranks[0] : ranks.join(',') === '14,5,4,3,2' ? 5 : 0 : 0;
  let category = 0, kickers = ranks, name = `${rankWord(ranks[0]).replace(/s$/, '')} high`;
  if (flush && straight) { category = 8; kickers = [straight]; name = straight === 14 ? 'Royal flush' : 'Straight flush'; }
  else if (groups[0][1] === 4) { category = 7; kickers = groups.map(g => g[0]); name = `Four ${rankWord(groups[0][0])}`; }
  else if (groups[0][1] === 3 && groups[1][1] === 2) { category = 6; kickers = groups.map(g => g[0]); name = `${rankWord(groups[0][0])} full of ${rankWord(groups[1][0])}`; }
  else if (flush) { category = 5; name = `${rankWord(ranks[0]).replace(/s$/, '')}-high flush`; }
  else if (straight) { category = 4; kickers = [straight]; name = `${straight === 5 ? 'Five' : rankWord(straight).replace(/s$/, '')}-high straight`; }
  else if (groups[0][1] === 3) { category = 3; kickers = groups.map(g => g[0]); name = `Three ${rankWord(groups[0][0])}`; }
  else if (groups[0][1] === 2 && groups[1][1] === 2) { category = 2; kickers = groups.map(g => g[0]); name = `${rankWord(groups[0][0])} and ${rankWord(groups[1][0])}`; }
  else if (groups[0][1] === 2) { category = 1; kickers = groups.map(g => g[0]); name = `Pair of ${rankWord(groups[0][0])}`; }
  let value = category;
  for (let i = 0; i < 5; i++) value = value * 15 + (kickers[i] ?? 0);
  return { category, kickers, value, cards: [...cards], name };
}
export function bestPokerHand(variant: PokerVariant, hole: readonly Card[], board: readonly Card[]): PokerRank {
  const candidates = variant === 'omaha' ? combinations(hole, 2).flatMap(h => combinations(board, 3).map(b => [...h, ...b])) : variant === 'draw' ? [hole.slice()] : combinations([...hole, ...board], 5);
  if (!candidates.length || candidates[0].length !== 5) throw new Error('Not enough cards to rank yet.');
  let best = evaluateFive(candidates[0]);
  for (let i = 1; i < candidates.length; i++) { const candidate = evaluateFive(candidates[i]); if (candidate.value > best.value) best = candidate; }
  return best;
}
export function newPoker(variant: PokerVariant = 'holdem'): PokerSession {
  return { variant, deck: [], holes: [[], []], board: [], discarded: [], stacks: [500, 500], pot: 0, invested: [0, 0], contributions: [0, 0], highest: 0, phase: 'ready', street: 0, turn: 0, dealer: 0, pending: [], raises: 0, handNo: 0, wins: [0, 0, 0], folded: null, winners: [], awards: [0, 0], result: '', log: [] };
}
export const pokerBetSize = (s: PokerSession): number => s.variant === 'draw' ? s.street === 0 ? 10 : 20 : s.street < 2 ? 10 : 20;
function put(s: PokerSession, p: number, chips: number): void { const amount = Math.min(s.stacks[p], chips); s.stacks[p] -= amount; s.pot += amount; s.invested[p] += amount; s.contributions[p] += amount; }
function refund(s: PokerSession): void {
  const difference = s.invested[0] - s.invested[1];
  if (!difference) return;
  const p = difference > 0 ? 0 : 1, amount = Math.abs(difference);
  s.stacks[p] += amount; s.invested[p] -= amount; s.contributions[p] = Math.max(0, s.contributions[p] - amount); s.pot -= amount;
}
function award(s: PokerSession, folded: number | null = null): void {
  refund(s); s.folded = folded;
  let winners: number[];
  if (folded !== null) winners = [1 - folded];
  else {
    const a = bestPokerHand(s.variant, s.holes[0], s.board), b = bestPokerHand(s.variant, s.holes[1], s.board);
    winners = a.value === b.value ? [0, 1] : a.value > b.value ? [0] : [1];
  }
  const pot = s.pot; s.awards = [0, 0];
  winners.forEach(p => { const amount = Math.floor(pot / winners.length); s.stacks[p] += amount; s.awards[p] += amount; });
  const odd = pot % winners.length;
  if (odd) { const p = 1 - s.dealer; s.stacks[p] += odd; s.awards[p] += odd; }
  s.winners = winners; s.pot = 0; s.phase = 'showdown'; s.pending = [];
  s.wins[winners.length === 2 ? 2 : winners[0]]++;
  s.result = winners.length === 2 ? `Split pot · ${pot} chips shared.` : `${winners[0] === 0 ? 'You win' : 'Computer wins'} ${pot} chips${folded !== null ? ' after a fold.' : '.'}`;
  s.log.push(s.result);
}
function community(s: PokerSession, count: number): void { s.discarded.push(s.deck.pop()!); for (let i = 0; i < count; i++) s.board.push(s.deck.pop()!); }
function beginStreet(s: PokerSession): void {
  s.contributions = [0, 0]; s.highest = 0; s.raises = 0; s.phase = 'betting';
  s.pending = [1 - s.dealer, s.dealer].filter(p => s.stacks[p] > 0); s.turn = s.pending[0] ?? 0;
}
function finishStreet(s: PokerSession): void {
  refund(s);
  if (s.variant === 'draw') {
    if (s.street === 0) { s.phase = 'draw'; s.pending = []; s.turn = 0; }
    else award(s);
    return;
  }
  if (s.stacks.some(n => n === 0)) { while (s.board.length < 5) community(s, s.board.length === 0 ? 3 : 1); award(s); return; }
  if (s.street >= 3) { award(s); return; }
  community(s, s.street === 0 ? 3 : 1); s.street++; beginStreet(s);
  s.log.push(['', 'Flop · three community cards.', 'Turn · fourth community card.', 'River · fifth community card.'][s.street]);
}
export function dealPoker(s: PokerSession, random = Math.random): boolean {
  if (!['ready', 'showdown'].includes(s.phase) || s.stacks.some(n => n === 0)) return false;
  s.dealer = s.handNo === 0 ? 0 : 1 - s.dealer; s.handNo++; s.deck = shuffledDeck(1, random); s.holes = [[], []]; s.board = []; s.discarded = []; s.invested = [0, 0]; s.contributions = [0, 0]; s.pot = 0; s.street = 0; s.raises = 0; s.folded = null; s.winners = []; s.awards = [0, 0]; s.result = ''; s.log = [];
  const count = s.variant === 'omaha' ? 4 : s.variant === 'draw' ? 5 : 2;
  for (let i = 0; i < count; i++) { s.holes[1 - s.dealer].push(s.deck.pop()!); s.holes[s.dealer].push(s.deck.pop()!); }
  s.phase = 'betting';
  if (s.variant === 'draw') { put(s, 0, 5); put(s, 1, 5); s.contributions = [0, 0]; s.highest = 0; s.pending = [1 - s.dealer, s.dealer]; s.log.push('Both players ante 5 chips.'); }
  else { put(s, s.dealer, 5); put(s, 1 - s.dealer, 10); s.highest = Math.max(...s.contributions); s.pending = [s.dealer, 1 - s.dealer]; s.log.push('Small blind 5 · big blind 10.'); }
  s.pending = s.pending.filter(p => s.stacks[p] > 0); s.turn = s.pending[0] ?? 0;
  if (!s.pending.length) finishStreet(s);
  return true;
}
export function pokerActions(s: PokerSession, player = s.turn): PokerActions {
  if (s.phase !== 'betting' || player !== s.turn || !s.pending.includes(player)) return { call: 0, check: false, raise: 0, fold: false };
  const call = Math.max(0, s.highest - s.contributions[player]);
  const effective = Math.min(s.contributions[player] + s.stacks[player], s.contributions[1 - player] + s.stacks[1 - player]);
  const raise = s.raises < 3 && s.stacks[1 - player] > 0 && effective > s.highest ? Math.min(s.highest + pokerBetSize(s), effective) - s.contributions[player] : 0;
  return { call: Math.min(call, s.stacks[player]), check: call === 0, raise, fold: true };
}
export function actPoker(s: PokerSession, action: 'check' | 'call' | 'raise' | 'fold'): boolean {
  const p = s.turn, legal = pokerActions(s), who = p === 0 ? 'You' : 'Computer';
  if (!legal.fold) return false;
  if (action === 'fold') { s.log.push(`${who} fold${p ? 's' : ''}.`); award(s, p); return true; }
  if (action === 'check' && !legal.check || action === 'call' && !legal.call || action === 'raise' && !legal.raise) return false;
  if (action === 'raise') { const raising = s.highest > 0; put(s, p, legal.raise); s.highest = Math.max(...s.contributions); if (raising) s.raises++; s.pending = [1 - p].filter(i => s.stacks[i] > 0); s.log.push(`${who} ${raising ? 'raise' : 'bet'}${p ? 's' : ''} to ${s.highest}.`); }
  else { const amount = action === 'call' ? legal.call : 0; put(s, p, amount); s.pending = s.pending.filter(i => i !== p); s.log.push(`${who} ${action}${p ? 's' : ''}${amount ? ` ${amount}` : ''}.`); }
  s.log = s.log.slice(-80);
  if (!s.pending.length) finishStreet(s); else s.turn = s.pending[0];
  return true;
}
export function drawDiscards(cards: readonly Card[]): number[] {
  const hand = evaluateFive(cards);
  if (hand.category >= 4 || hand.category === 6) return [];
  const counts = new Map<number, number>(); cards.forEach(c => counts.set(highRank(c), (counts.get(highRank(c)) ?? 0) + 1));
  if (hand.category > 0) return cards.flatMap((c, i) => (counts.get(highRank(c)) ?? 0) > 1 ? [] : [i]);
  for (let colour = 0; colour < 4; colour++) if (cards.filter(c => suit(c) === colour).length === 4) return cards.flatMap((c, i) => suit(c) === colour ? [] : [i]);
  for (const omit of [0, 1, 2, 3, 4]) {
    const rs = cards.filter((_, i) => i !== omit).map(highRank).sort((a, b) => a - b);
    if (new Set(rs).size === 4 && rs[3] - rs[0] <= 4) return [omit];
  }
  return cards.flatMap((c, i) => highRank(c) >= 12 ? [] : [i]);
}
export function exchangePoker(s: PokerSession, discards: number[], level=3, random=Math.random): boolean {
  if (s.variant !== 'draw' || s.phase !== 'draw' || discards.length > 5 || new Set(discards).size !== discards.length || !discards.every(i => whole(i, 0, 4))) return false;
  const bot = choosePokerDiscards(s.holes[1],level,random);
  for (const [p, indices] of [[0, discards], [1, bot]] as [number, number[]][]) for (const i of indices) { s.discarded.push(s.holes[p][i]); s.holes[p][i] = s.deck.pop()!; }
  s.log.push(`You draw ${discards.length}. Computer draws ${bot.length}.`); s.street = 1;
  if (s.stacks.some(n => n === 0)) award(s); else beginStreet(s);
  return true;
}
export function pokerEquity(s: Pick<PokerSession, 'variant' | 'holes' | 'board'>, player: number, trials = 120, random = Math.random): number {
  const known = new Set([...s.holes[player], ...s.board]), unknown = Array.from({ length: 52 }, (_, i) => i).filter(c => !known.has(c));
  let score = 0;
  for (let sample = 0; sample < trials; sample++) {
    const deck = unknown.slice();
    // Only the visible hand and public board are used. Never inspect opponent cards or the live deck.
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const count = s.variant === 'omaha' ? 4 : s.variant === 'draw' ? 5 : 2, enemy = deck.splice(0, count);
    const board = s.variant === 'draw' ? [] : [...s.board, ...deck.slice(0, 5 - s.board.length)];
    const a = bestPokerHand(s.variant, s.holes[player], board), b = bestPokerHand(s.variant, enemy, board);
    score += a.value === b.value ? .5 : a.value > b.value ? 1 : 0;
  }
  return score / trials;
}
export const POKER_LEVELS=[{trials:0,drawTrials:0},{trials:12,drawTrials:0},{trials:48,drawTrials:0},{trials:144,drawTrials:32},{trials:480,drawTrials:128}] as const;
export function choosePokerAction(s:PokerSession,random=Math.random,level=3):'check'|'call'|'raise'|'fold'|null{
 const legal=pokerActions(s);if(!legal.fold)return null;
 const actions:('check'|'call'|'raise'|'fold')[]=[...(legal.check?['check' as const]:[]),...(legal.call?['call' as const]:[]),...(legal.raise?['raise' as const]:[]),'fold'];
 if(level<=1)return actions[Math.floor(random()*actions.length)];
 const equity=pokerEquity(s,s.turn,POKER_LEVELS[skillIndex(level)].trials,random),price=legal.call/(s.pot+legal.call||1),margin=[0,.14,.07,.035,.01][skillIndex(level)],raiseAt=[1,.78,.7,.63,.57][skillIndex(level)];
 const best=legal.raise&&equity>raiseAt?'raise':legal.check?'check':equity>=price+margin?'call':'fold';
 return skillChoice([best,...actions.filter(a=>a!==best)],level,random);
}
export function choosePokerDiscards(cards:readonly Card[],level=3,random=Math.random):number[]{
 if(cards.length!==5)return [];if(level<=1)return cards.flatMap((_,i)=>random()<.5?[i]:[]);
 const heuristic=drawDiscards(cards);if(level===2){const hand=evaluateFive(cards);return skillChoice([hand.category?heuristic:cards.flatMap((c,i)=>highRank(c)>=12?[]:[i]),heuristic,[]],level,random);}
 if(level===3)return heuristic;
 const unknown=Array.from({length:52},(_,i)=>i).filter(c=>!cards.includes(c)),samples=POKER_LEVELS[skillIndex(level)].drawTrials,plans=Array.from({length:32},(_,mask)=>cards.flatMap((_,i)=>mask&(1<<i)?[i]:[]));
 const draws=Array.from({length:samples},()=>{const d=unknown.slice();for(let i=d.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}return d;});
 const ranked=plans.map(discard=>{let score=0;for(const d of draws){const final=cards.slice();discard.forEach((at,i)=>final[at]=d[i]);const a=evaluateFive(final).value,b=evaluateFive(d.slice(5,10)).value;score+=a===b?.5:a>b?1:0;}return {discard,score};}).sort((a,b)=>b.score-a.score);
 return skillChoice(ranked,level,random).discard;
}
export interface PokerDraws { cards: number[]; description: string }
export function pokerDraws(s: Pick<PokerSession, 'variant' | 'holes' | 'board'>): PokerDraws | null {
  if (s.variant === 'draw' || s.board.length < 3 || s.board.length >= 5) return null;
  const known = new Set([...s.holes[0], ...s.board]), current = bestPokerHand(s.variant, s.holes[0], s.board);
  const cards = Array.from({ length: 52 }, (_, c) => c).filter(c => !known.has(c) && bestPokerHand(s.variant, s.holes[0], [...s.board, c]).category > current.category);
  return { cards, description: `${cards.length} of ${52 - known.size} unseen cards improve your hand category on the next community card. They are not guaranteed winning outs: the opponent can improve too. Omaha’s exact two-hole-card rule is respected.` };
}
export function pokerShowdown(s: PokerSession): { hands: [PokerRank, PokerRank]; explanation: string } | null {
  if (s.phase !== 'showdown' || s.folded !== null || !s.holes[0].length) return null;
  const hands: [PokerRank, PokerRank] = [bestPokerHand(s.variant, s.holes[0], s.board), bestPokerHand(s.variant, s.holes[1], s.board)];
  if (hands[0].value === hands[1].value) return { hands, explanation: 'Both players have equally ranked five-card hands, including every kicker. Suits do not break a tie, so the pot is split.' };
  const winner = hands[0].value > hands[1].value ? 0 : 1, a = hands[winner], b = hands[1 - winner];
  const at = a.kickers.findIndex((n, i) => n !== b.kickers[i]);
  const decisive = a.category !== b.category ? `${a.name} ranks above ${b.name}.` : `Both hands share the same category. The first different rank is ${rankWord(a.kickers[at]).replace(/s$/, '')} against ${rankWord(b.kickers[at]).replace(/s$/, '')}; that rank breaks the tie.`;
  return { hands, explanation: `${winner ? 'Computer wins' : 'You win'}. ${decisive}${s.variant === 'omaha' ? ' Each hand uses exactly two private cards and three board cards.' : s.variant === 'holdem' ? ' Each player uses the best five cards available, even when some private cards are left out.' : ''}` };
}
export interface PokerAdvice { hand: string; equity: number; price: number; action: string; explanation: string; discards: number[]; draws: PokerDraws | null }
export function pokerAdvice(s: PokerSession): PokerAdvice {
  if(!s.holes[0].length)return {hand:'No hand dealt',equity:0,price:0,action:'Deal a hand first',explanation:'Advice starts once your own cards are dealt.',discards:[],draws:null};
  let seed = [...s.holes[0], ...s.board].reduce((n, card) => (n * 31 + card + 1) >>> 0, 17);
  const equity = pokerEquity(s, 0, 160, () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296));
  const legal = pokerActions(s, 0), price = legal.call / (s.pot + legal.call || 1);
  const enough = s.variant === 'draw' || s.board.length >= 3;
  const hand = enough ? bestPokerHand(s.variant, s.holes[0], s.board).name : s.holes[0].length === 2 && rank(s.holes[0][0]) === rank(s.holes[0][1]) ? `Pair of ${rankWord(highRank(s.holes[0][0]))}` : 'Starting hand';
  const discards = s.variant === 'draw' && s.phase==='draw' ? choosePokerDiscards(s.holes[0],5,()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)) : [];
  const action = s.phase === 'draw' ? discards.length ? `Exchange ${discards.length} card${discards.length > 1 ? 's' : ''}` : 'Stand pat' : !legal.fold ? 'Observe the next action' : legal.raise && equity > .72 ? 'Consider a raise' : legal.check ? 'Check for free' : equity > price + .07 ? 'Consider calling' : 'Consider folding';
  const explanation = s.phase === 'draw' ? `Your current hand is ${hand.toLowerCase()}. ${discards.length ? `Exchange ${discards.map(i => cardName(s.holes[0][i])).join(', ')}; keep ${s.holes[0].filter((_,i)=>!discards.includes(i)).map(cardName).join(', ')||'no cards'}.` : 'Stand pat: keep all five cards.'} The tutor compares all 32 legal keep/discard plans using sampled replacements against random unseen hands. This plan has the best sampled winning share; close alternatives and an opponent’s actual drawing strategy can change the decision. Neither the deck order nor opposing cards are inspected.`
    : `${legal.call ? `Calling ${legal.call} into ${s.pot} costs ${Math.round(price * 100)}% of the pot after your call. That is the immediate price; later bets and stronger opponent ranges change the decision.` : legal.check ? 'No call is required, so checking keeps you in the hand for free.' : 'Wait for your turn before deciding.'} ${s.variant === 'omaha' ? 'Omaha always uses exactly two hole cards and three board cards.' : s.variant === 'holdem' ? 'Hold’em uses the best five cards from any combination of your hand and the board.' : s.street === 0 ? 'One exchange follows the first betting round.' : 'The exchange is complete; these are your final five cards.'} The estimate compares with a random unseen hand${s.variant === 'draw' && s.street === 0 ? ' using your current cards before the draw, without modelling either player’s exchange' : ''}.`;
  const rationale=s.phase==='betting'&&legal.fold?` Estimated equity is ${Math.round(equity*100)}%. ${action==='Consider a raise'?'The estimate is strong enough to consider a value raise, within the betting cap.':legal.check?'Checking costs nothing and preserves your option to see the next action.':action==='Consider calling'?`That clears the ${Math.round(price*100)}% immediate call price with a margin for uncertainty.`:'The estimate does not clear the call price with a sufficient margin for uncertainty, so folding avoids committing more chips.'}`:'';
  return { hand, equity, price, action, explanation:explanation+rationale, discards, draws: pokerDraws(s) };
}
export function restorePoker(value: unknown): PokerSession | null {
  if (!isRecord(value) || !['holdem', 'omaha', 'draw'].includes(value.variant as string) || !['ready', 'betting', 'draw', 'showdown'].includes(value.phase as string) || !cardList(value.deck) || !cardList(value.board) || value.board.length > 5 || !cardList(value.discarded) || !Array.isArray(value.holes) || value.holes.length !== 2 || !value.holes.every(v => cardList(v))
    || ![value.stacks, value.invested, value.contributions, value.awards].every(v => Array.isArray(v) && v.length === 2 && v.every(n => whole(n, 0, 1000))) || !Array.isArray(value.wins) || value.wins.length !== 3 || !value.wins.every(n => whole(n, 0, 1000000))
    || !whole(value.pot, 0, 1000) || !whole(value.highest, 0, 1000) || !whole(value.street, 0, 3) || !whole(value.turn, 0, 1) || !whole(value.dealer, 0, 1) || !whole(value.raises, 0, 3) || !whole(value.handNo, 0, 1000000)
    || !Array.isArray(value.pending) || value.pending.length > 2 || !value.pending.every(n => whole(n, 0, 1)) || new Set(value.pending).size !== value.pending.length || !Array.isArray(value.winners) || value.winners.length > 2 || !value.winners.every(n => whole(n, 0, 1)) || (value.folded !== null && value.folded !== 0 && value.folded !== 1)
    || typeof value.result !== 'string' || value.result.length > 200 || !Array.isArray(value.log) || value.log.length > 80 || !value.log.every(t => typeof t === 'string' && t.length < 200)) return null;
  const s = value as unknown as PokerSession, all = [...s.deck, ...s.holes.flat(), ...s.board, ...s.discarded];
  if (s.stacks[0] + s.stacks[1] + s.pot !== 1000 || new Set(all).size !== all.length || (s.phase === 'ready' ? all.length !== 0 : all.length !== 52)) return null;
  if (s.phase !== 'ready' && s.holes.some(h => h.length !== (s.variant === 'omaha' ? 4 : s.variant === 'draw' ? 5 : 2))) return null;
  if ((s.phase === 'betting' && (!s.pending.length || s.pending[0] !== s.turn)) || (s.phase === 'draw' && s.variant !== 'draw') || (s.variant === 'draw' && s.board.length !== 0) || (s.phase === 'showdown' && !s.winners.length)) return null;
  return s;
}
