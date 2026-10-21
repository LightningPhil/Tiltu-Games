import { canDouble, canSplit, handValue } from './blackjack.ts';
import type { BlackjackSession } from './blackjack.ts';
import { rank } from './cards.ts';
export interface BlackjackAdvice { action: 'hit' | 'stand' | 'double' | 'split'; title: string; reason: string }
/** Six-deck, S17, double after split, no surrender. Uses only the upcard. */
export function blackjackAdvice(s: BlackjackSession): BlackjackAdvice | null {
  const h = s.hands[s.active];
  if (s.phase !== 'player' || !h || h.status !== 'playing') return null;
  const dealer = Math.min(10, rank(s.dealer[0])) || 1, value = handValue(h.cards), pair = rank(h.cards[0]);
  const split = canSplit(s) && (pair === 1 || pair === 8 || pair === 9 && [2, 3, 4, 5, 6, 8, 9].includes(dealer) || pair === 7 && dealer >= 2 && dealer <= 7 || pair === 6 && dealer >= 2 && dealer <= 6 || pair === 4 && [5, 6].includes(dealer) || [2, 3].includes(pair) && dealer >= 2 && dealer <= 7);
  if (split) return { action: 'split', title: 'Consider splitting', reason: `Treat the pair as two new hands. ${pair === 1 ? 'An ace gives each hand a strong starting card.' : pair === 8 ? 'Two 8s make a difficult hard 16; separate them to give both hands room to improve.' : `This pair is a better starting point as two hands against the dealer’s ${dealer}.`} Splitting costs another ${h.bet} practice chips.` };
  let action: BlackjackAdvice['action'] = 'hit', fallback: 'hit' | 'stand' = 'hit';
  if (value.soft) {
    if (value.total >= 19) action = 'stand';
    else if (value.total === 18) { fallback = [2, 7, 8].includes(dealer) ? 'stand' : 'hit'; action = dealer >= 3 && dealer <= 6 ? 'double' : fallback; fallback = dealer >= 2 && dealer <= 8 ? 'stand' : 'hit'; }
    else if (value.total === 17 && dealer >= 3 && dealer <= 6 || [15, 16].includes(value.total) && dealer >= 4 && dealer <= 6 || [13, 14].includes(value.total) && [5, 6].includes(dealer)) action = 'double';
  } else {
    if (value.total >= 17 || value.total >= 13 && dealer >= 2 && dealer <= 6 || value.total === 12 && dealer >= 4 && dealer <= 6) action = 'stand';
    else if (value.total === 11 && dealer >= 2 || value.total === 10 && dealer >= 2 && dealer <= 9 || value.total === 9 && dealer >= 3 && dealer <= 6) action = 'double';
  }
  const unavailable = action === 'double' && !canDouble(s);
  if (unavailable) action = fallback;
  const description = `${value.soft ? 'Soft' : 'Hard'} ${value.total} against ${dealer === 1 ? 'an ace' : dealer}.`;
  const reason = action === 'double' ? 'A favourable one-card draw makes doubling useful. You add the same bet, receive exactly one card, then stand.' : action === 'stand' ? value.soft ? 'Keep this strong total. Drawing can lower its effective value even when the ace prevents an immediate bust.' : value.total >= 17 ? 'Keep this total rather than risk going over 21.' : 'The dealer shows a vulnerable low card. Let the dealer draw rather than risk busting your hand.' : value.soft ? 'Your ace can fall from 11 to 1, giving you room to improve without busting on the next card.' : 'This total needs improvement against the dealer’s upcard; the risk of drawing is part of the decision.';
  return { action, title: `Consider ${action === 'stand' ? 'standing' : action === 'double' ? 'doubling' : 'hitting'}`, reason: `${description} ${reason}${unavailable ? ' Doubling is unavailable for this hand or chip balance, so use the fallback.' : ''}` };
}
