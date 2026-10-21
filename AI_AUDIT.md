# Grid Club computer-player audit

18 October 2026. Covers all 29 games/modes with a strategic computer opponent, including Poker styles, Dominoes styles, Nim variants, both Halma sizes and both sides of asymmetric games.

The skill names are **Easy, Casual, Challenging, Hard, Expert**. The audit measured actual choices and games, rather than treating increasing search settings as strength evidence. The final policies show progressive aggregate results on the batteries below. Solved individual positions can be equally good at several levels; dice, deals and imperfect-information play still produce individual upsets.

## Changes

- Added five persisted skills to Poker and LifeGenesis. Poker betting and draw exchanges use the selected skill; LifeGenesis now plans legal edits in a worker.
- Added exact Expert king-and-pawn chess reading, exact late Dots chains, small Backgammon race probabilities, and stronger Reversi/Kalah endings. Chess conversion distance prevents a winning lookup from cycling.
- Fixed incomplete/unequal root comparisons in collection search. Bounded Morris and hop searches by elapsed time, retaining completed iterations; proved Morris wins return promptly.
- Added real deeper Gomoku/Hex and hop searches, recognition of forcing Gomoku forks, and proven camp rearrangement finishes for Chinese Chequers/Halma.
- Replaced weak Ur/Senet horizon estimates with expected-casts travel costs accounting for Senet water, the compulsory house and exact exits. All levels remain distinct through measured accuracy.
- Improved Gin drawing/discard planning, Hearts passing and play, Spades bidding/play, Cribbage pegging and Whist endgame reading. Hidden card identities and the live stock order are excluded from decision information.
- Fixed the Fives immediate-match-win priority, empty-stock Gin choice, Memory's premature third flip, last-cell Hex scoring, and stale LifeGenesis worker results after undo/reset/settings/navigation. Gin now renders an empty discard pile correctly after either player takes its last upcard.
- Calibrated Go's Hard policy as 70% deepest reading / 30% Challenging reading, avoiding an observed intermediate-depth reversal. Added an explicit legal immediate-capture risk check.

## Board measurements

“Regret” is the reference best score minus the selected score; **lower is better**. Tactical accuracies are **higher is better**. No engine's own heuristic is used as the independent exact reference in these rows.

| Game / objective | Sample | Easy → Expert |
| --- | --- | --- |
| Noughts and Crosses, exact outcome regret ↓ | All 4,520 reachable nonterminal boards | 2810 / 1790 / 738 / 124 / **0** |
| Reversi, exact final disc-margin regret ↓ | 6 endings × 8 repetitions | 532 / 378 / 322 / 270 / **0** |
| Kalah, exact final store-margin regret ↓ | 16 endings × 8 repetitions | 248 / 128 / 54 / 40 / **0** |
| Dots and Boxes, exact future box-margin regret ↓ | 24 endings × 8 repetitions | 1204 / 590 / 278 / 70 / **0** |
| Nine Men's Morris, missed forced wins ↓ | 4 rotations × 64 repetitions | 254 / 120 / 51 / 10 / **0** |
| Chess, losing a theoretical pawn-ending win ↓ | 16 independently solved KPK endings | 7 / 5 / 4 / 3 / **0** |
| Go, mean four-ply capture regret ↓ | 24 legal positions; 64 policy repetitions for upper levels | .667 / .208 / .083 / .054 / **.042** |
| Backgammon, next-roll bear-off probability regret ↓ | 24 home positions × 8 repetitions | 20.417 / 14.083 / 6.028 / 3.056 / **0** |
| Gomoku, exact forcing-fork accuracy ↑ | 8 symmetries × 32 seeds | 23.83 / 56.25 / 87.50 / 96.88 / **100%** |
| Hex, exact non-immediate ending accuracy ↑ | 16 endings × 16 seeds | 37.89 / 53.52 / 60.16 / 97.27 / **100%** |
| Chinese Chequers, forced next-turn camp finish ↑ | 64 seeds, all opponent replies verified | 14.06 / 57.81 / 76.56 / 98.44 / **100%** |
| Halma 10×10, forced next-turn finish ↑ | 64 seeds, all opponent replies verified | 9.38 / 56.25 / 75.00 / 98.44 / **100%** |
| Halma 16×16, forced next-turn finish ↑ | 64 seeds, all opponent replies verified | 15.63 / 59.38 / 78.13 / 98.44 / **100%** |
| Fox and Geese, non-immediate Fox capture tactics ↑ | 16 independent positions × 64 seeds | 22.07 / 53.81 / 70.31 / 98.44 / **100%** |
| Hnefatafl defenders, forced escape setups ↑ | 4 reflected positions, 64 seeds at stochastic levels | 13.28 / 57.81 / 76.56 / 98.44 / **100%** |
| Hnefatafl attackers, forced king capture setups ↑ | 4 reflected positions, 64 seeds at stochastic levels | 2.34 / 50.00 / 70.31 / 96.88 / **100%** |

Nim's independent recursive oracle checked **292,480 decisions**: every winning three-heap state with heaps 0–7 and winning subtraction positions within piles 1–25, across 64 seeds per state. Winning-move accuracy:

| Variant | Easy | Casual | Challenging | Hard | Expert |
| --- | ---: | ---: | ---: | ---: | ---: |
| Normal | 15.43% | 44.91% | 70.23% | 91.43% | **100%** |
| Misère | 15.25% | 44.74% | 70.16% | 91.37% | **100%** |
| Subtract 1–3 | 37.01% | 61.27% | 80.35% | 94.00% | **100%** |

Additional chess checks preserved every win in 16 mirrored Black-pawn positions and every draw in 32 defender positions. Eight long conversions against maximum-delay defence reached safe promotion in 29, 29, 25, 25, 21, 21, 19 and 19 plies, decreasing the independently computed conversion distance at every move. Legal checkmate, stalemate, repetition and fifty-move handling remains with the chess rules engine.

## Complete-game measurements

Four in a Row and draughts used **48 colour-balanced complete matches**, six matches per adjacent pair. The stronger level's wins/draws/losses:

| Pair | Four in a Row | Draughts |
| --- | --- | --- |
| Casual versus Easy | 6 / 0 / 0 | 5 / 0 / 1 |
| Challenging versus Casual | 6 / 0 / 0 | 6 / 0 / 0 |
| Hard versus Challenging | 5 / 1 / 0 | 4 / 2 / 0 |
| Expert versus Hard | 5 / 0 / 1 | 4 / 2 / 0 |

The following scores are against a fixed Challenging reference, with the same seeds and both seats. Ur/Senet retain a frozen former policy in the benchmark so their historical comparison is reproducible.

| Game / style | Matches per level | Easy → Expert scores ↑ |
| --- | ---: | --- |
| Royal Game of Ur | 4,096 | 41.33 / 48.24 / 51.59 / 53.56 / **54.17%** |
| Senet | 4,096 | 49.07 / 53.56 / 55.22 / 55.81 / **56.10%** |
| Ludo | 128 | 43.75 / 46.09 / 50.00 / 57.03 / **57.81%** |
| Dominoes Draw | 96 | 36.46 / 48.96 / 50.00 / 58.33 / **71.88%** |
| Dominoes Block | 96 | 16.67 / 37.50 / 50.00 / 56.25 / **68.75%** |
| Dominoes Fives | 96 | 17.71 / 44.79 / 50.00 / 57.29 / **58.33%** |

Dice-game and Fives top-level gaps are small in these finite samples. The 40,960 Ur/Senet matches all finished through legal moves; 960 separate choices confirmed production/prototype fidelity.

## Cards, memory and LifeGenesis

| Game / objective | Easy → Expert |
| --- | --- |
| Texas Hold'em, reference chip regret ↓ | 27.717 / 5.322 / .549 / .230 / **.216** |
| Omaha, reference chip regret ↓ | 28.912 / 5.777 / .978 / .570 / **.017** |
| Five-card Draw, reference chip regret ↓ | 29.786 / 4.476 / 1.131 / .775 / **.074** |
| Draw exchange, reference win-probability regret ↓ | .2212 / .0590 / .0340 / .0338 / **.0127** |
| Gin Rummy, one-draw regret, 400 positions ↓ | 10.348 / 5.459 / 2.423 / .593 / **.007** |
| Cribbage discards, expected-point regret, 64 situations ↓ | 3.577 / .324 / .129 / .087 / **.041** |
| Cribbage pegging, expected-net-point regret, 146 positions ↓ | .500 / .380 / .236 / .112 / **.002** |
| Hearts, mean penalties, 192 deal/seat cases ↓ | 12.458 / 8.672 / 6.500 / 5.474 / **4.427** |
| Spades, mean team points, 192 cases ↑ | −68.094 / −4.167 / 0 / 2.099 / **3.385** |
| Whist, mean team points, 192 cases ↑ | −1.010 / −.109 / 0 / .177 / **.224** |
| Whist, exact ending regret, 157 positions ↓ | .15145 / .13155 / .10819 / .07366 / **0** |
| Memory Pairs, correct recalls out of 72 ↑ | 3 / 11 / 19 / 36 / **72** |
| LifeGenesis, eight-generation population advantage, 96 starts ↑ | .719 / 1.510 / 3.604 / 11.292 / **15.188** |

The retained [card result snapshot](tests/ai-benchmarks/results/cards-audit.json) states each objective, sample count and seed scheme. Rotations share deals, so descriptive confidence intervals are not formal independent-sample proof. A larger 384-case Hearts check also placed Challenging, Hard and Expert at 6.500, 5.188 and 4.365 penalties respectively.

## Legality, fairness and responsiveness

The preceding rule audit's independent move enumerations remain in the regression suite. Computer controllers apply choices through the same rule-checked actions used by people. Newly added checks cover invalid phases, finished games, forced Gin draws, bar entry/maximum dice, exposed Memory tiles, target-camp restrictions, legal Life edits, and both Cribbage acting seats.

Dominoes passed 13,255 hidden-hand/stock redistribution choices without changing a decision. Whist passed 785 all-level hidden-permutation comparisons, including 148 actual ownership swaps consistent with demonstrated voids and the exposed card. Gin, Poker and Cribbage also passed all-five concealed-card permutations. Choosers left their searched input positions unchanged.

Representative Expert opening measurements were Chinese 217 ms, Halma 10×10 286 ms, Halma 16×16 1,076 ms, Fox 61 ms and Hnefatafl 779 ms. Proven camp setups now take about 3, 5 and 43 ms respectively. Search deadlines retain a complete comparison; reached depth varies with the host and load.

Blackjack's dealer follows its fixed rule, and Snakes and Ladders has forced movement after the roll. Solo puzzles and continuous Life simulations have no strategic opponent. Their rules are preserved; five computer skills apply where a player actually chooses a strategy.

## Verification and reproduction

- TypeScript and the single-file production build pass.
- **235 regression tests pass**, including 24 dedicated AI regression tests.
- **165 / 165 final offline-build browser scenarios pass**, including all five skills across opponent families/Poker styles, empty-pile Gin rendering and full computer turns, and cancellation of LifeGenesis work during undo, reset, wrap changes and navigation. Cases fail on uncaught rendering errors or rejected promises. The [saved scenario record](tests/ai-benchmarks/results/browser-audit.json) includes the tested build's SHA-256 fingerprint.
- All strength/reference scripts are organised in [tests/ai-benchmarks](tests/ai-benchmarks/README.md). No externally rated playing strength is claimed.

The offline deliverable is `dist_single/index.html`.
