import { cardList, isRecord, rank, shuffledDeck, whole } from './cards.ts';
import type { BlackjackSession } from './blackjack.ts';
export const hiLo = (card: number): number => rank(card) >= 2 && rank(card) <= 6 ? 1 : rank(card) === 1 || rank(card) >= 10 ? -1 : 0;
export function visibleBlackjackCount(s: BlackjackSession): { running: number; seen: number; decks: number; trueCount: number } {
  if (!s.hands.length) return { running: 0, seen: 0, decks: 6, trueCount: 0 };
  const unseen = new Set(s.shoe);
  if (s.phase === 'player') unseen.add(s.dealer[1]);
  const visible = Array.from({ length: 312 }, (_, i) => i).filter(c => !unseen.has(c));
  const running = visible.reduce((n, c) => n + hiLo(c), 0), decks = Math.max(.25, s.shoe.length / 52);
  return { running, seen: visible.length, decks, trueCount: running / decks };
}
export interface CountDrill { deck: number[]; index: number; target: number; batchStart: number; phase: 'ready' | 'running' | 'quiz' | 'checked'; pace: number; correct: number; attempts: number; feedback: string; reveal: boolean }
export function newCountDrill(decks = 1, pace = 750, random = Math.random): CountDrill { return { deck: shuffledDeck(decks, random), index: 0, target: 0, batchStart: 0, phase: 'ready', pace, correct: 0, attempts: 0, feedback: '', reveal: false }; }
export const drillCount = (s: CountDrill): number => s.deck.slice(0, s.index).reduce((n, c) => n + hiLo(c), 0);
export function startCountBatch(s: CountDrill): boolean {
  if (!['ready', 'checked'].includes(s.phase) || s.index >= s.deck.length) return false;
  s.batchStart = s.index; s.target = Math.min(s.deck.length, s.index + 10); s.phase = 'running'; s.feedback = ''; s.reveal = false; return true;
}
export function nextCountCard(s: CountDrill): boolean { if (s.phase !== 'running') return false; s.index++; if (s.index >= s.target) s.phase = 'quiz'; return true; }
export function gradeCount(s: CountDrill, guess: number): boolean {
  if (s.phase !== 'quiz' || !Number.isInteger(guess)) return false;
  const correct = guess === drillCount(s); s.attempts++; if (correct) s.correct++;
  s.feedback = correct ? 'Correct! Keep that running count for the next batch.' : `The count is ${drillCount(s) > 0 ? '+' : ''}${drillCount(s)}. Start the next batch from this count.`;
  s.phase = 'checked'; s.reveal = true; return correct;
}
export function restoreCountDrill(value: unknown): CountDrill | null {
  return isRecord(value) && cardList(value.deck, 6) && [52, 312].includes(value.deck.length) && new Set(value.deck).size === value.deck.length && whole(value.index, 0, value.deck.length) && whole(value.target, value.index, value.deck.length) && (value.batchStart === undefined || whole(value.batchStart, 0, value.index)) && ['ready', 'running', 'quiz', 'checked'].includes(value.phase as string) && [400, 750, 1200].includes(value.pace as number) && whole(value.correct, 0, 1000000) && whole(value.attempts, value.correct as number, 1000000) && typeof value.feedback === 'string' && value.feedback.length < 200 && typeof value.reveal === 'boolean' ? { ...value, batchStart: value.batchStart ?? Math.max(0, (value.target as number) - 10), phase: value.phase === 'running' ? 'quiz' : value.phase } as unknown as CountDrill : null;
}
