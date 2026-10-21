export type Card = number;
export const SUITS = ['♠', '♥', '♣', '♦'] as const;
export const SUIT_NAMES = ['spades', 'hearts', 'clubs', 'diamonds'] as const;
export const rank = (card: Card): number => card % 13 + 1;
export const suit = (card: Card): number => Math.floor(card % 52 / 13);
export const red = (card: Card): boolean => suit(card) % 2 === 1;
export const rankLabel = (card: Card): string => ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][rank(card)];
export const cardName = (card: Card): string => `${({ 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' } as Record<number, string>)[rank(card)] ?? rank(card)} of ${SUIT_NAMES[suit(card)]}`;
export function shuffledDeck(decks = 1, random = Math.random): Card[] {
  const cards = Array.from({ length: 52 * decks }, (_, i) => i);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const whole = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
export const cardList = (value: unknown, decks = 1): value is Card[] => Array.isArray(value) && value.length <= decks * 52 && value.every(c => whole(c, 0, decks * 52 - 1));
