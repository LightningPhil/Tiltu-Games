/** Ordered from strongest to weakest, using real five-card examples. */
export const POKER_HAND_LESSONS = [
  { category: 8, title: 'Straight flush', description: 'Five consecutive cards of one suit. The ace-high version is a royal flush.', cards: [0, 9, 10, 11, 12] },
  { category: 7, title: 'Four of a kind', description: 'Four cards of one rank, plus a kicker.', cards: [6, 19, 32, 45, 11] },
  { category: 6, title: 'Full house', description: 'Three of one rank and two of another. Compare the three first.', cards: [6, 19, 32, 0, 13] },
  { category: 5, title: 'Flush', description: 'Five of one suit. Compare the highest card, then the next.', cards: [0, 3, 6, 8, 10] },
  { category: 4, title: 'Straight', description: 'Five consecutive ranks. An ace can be high, or low in A–2–3–4–5.', cards: [4, 18, 32, 46, 8] },
  { category: 3, title: 'Three of a kind', description: 'Three cards of one rank, with two kickers.', cards: [6, 19, 32, 0, 12] },
  { category: 2, title: 'Two pair', description: 'Two different pairs and a kicker. Compare the higher pair first.', cards: [6, 19, 0, 13, 12] },
  { category: 1, title: 'One pair', description: 'Two cards of one rank. The other three cards break ties.', cards: [6, 19, 0, 11, 9] },
  { category: 0, title: 'High card', description: 'No combination above. Compare all five ranks from highest to lowest.', cards: [0, 22, 34, 43, 2] },
] as const;
