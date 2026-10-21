# Hint and tutor audit

Reviewed 18 October 2026. All 48 catalogue games and their available variants were checked. Some games supply controls, rules or an inspector rather than a move hint; those are identified below rather than presenting random advice as strategy.

## Changes

- Hints use the strongest available analysis independently of the opponent's selected skill. Chess, draughts, Four in a Row, the five collection strategy games, Backgammon and Cribbage no longer inherit middle-level analysis or deliberate easy-level mistakes. Four in a Row analysis runs in a worker.
- Recommendations identify the selected action and explain its actual effects: wins/blocks, captures, extra turns, route landings, Nim arithmetic, tile edges, suit-following, current trick winner, deadwood, pot price, transfer capacity and scoring combinations where applicable.
- Picture Logic checks erroneous working entries **before** drawing deductions. Previously a wrong cross could produce a falsely “forced” fill elsewhere. Corrections and solution reveals are explicitly described as such.
- Number Loop/Slitherlink guidance explains cell counts and dot degrees before offering an explicit solution reveal. Hashi explains island capacities, corrects incompatible bridges before adding others and records “no bridge” reveals without recommending the same unchanged connection repeatedly.
- Sliding-puzzle fallback uses a bounded beam search and avoids recent layouts. FreeCell, Spider and Klondike also avoid recently visited layouts; they report when no useful new suggestion was found. Their text no longer promises monotonically decreasing distance or a winning deal.
- Collection workers analyse an immutable snapshot and check that the current position still matches before displaying advice. Playing or pausing during analysis cannot apply an old-position hint. Paused puzzles explain that they must be resumed.
- Gin explains compulsory stock draws and empty discard piles correctly. Card advice is restricted to the human hand. Hidden-card permutations do not change the advice or its explanation. Matching Pairs uses remembered exposed faces only.
- Poker's draw tutor compares all 32 legal exchange plans at Expert strength. Betting advice explains the estimated equity against the call price, the uncertainty margin and raise/check reasoning. Blackjack's soft-hand explanation no longer incorrectly implies an immediate bust is possible with a usable ace.
- Chess castling advice describes the actual king/rook movement without claiming the rooks are necessarily connected. Draw and stalemate recommendations are identified.

## Coverage

| Game | Advice checked and resulting explanation |
|---|---|
| Four in a Row | Expert legal column; immediate win/block, supported threats, fork or positional connection; worker results cancelled on position change. |
| Draughts | Expert complete legal turn; compulsory capture branches, promotion ending the turn, immediate opposing jumps; six interactive lessons. |
| Sudoku | 4/6/9/12 grids; corrections before naked/hidden singles; coordinates and row/column/box reasons; explicit solution fallback. |
| Chess | Expert legal move; check replies, captures/recaptures, promotion, castle, mate/draw/stalemate and positional purpose; six interactive lessons. |
| Go | Group/liberty inspector and scoring/rules guidance. Inspector counts distinct liberties and does not play a stone. No move recommender is advertised. |
| Blackjack | Six-deck S17, double-after-split, no-surrender basic strategy; only available split/double actions; legal fallback if unaffordable. Hi-Lo live count and ten-card drills checked separately. |
| Patience | Klondike draw one/three: legal sources, king-only empty columns, safe foundations, uncovering; FreeCell: alternating runs/capacity/working cells; Spider 1/2/4 suits: rank fit, same-suit runs, uncovering and useful space. No winning-deal guarantee. |
| Minesweeper | Exposed-clue/subset deductions, flag assumptions and contradictions. No concealed-square peeking; lack of a forced move is admitted. |
| Conway’s Game of Life | Rule/mode/pattern guidance and continuous running controls. Two-Colour Colonies explains editing and colour evolution; no move hint is advertised. |
| Downhill Skiing | Control, brake, gate, ramp, run-mode and yeti guidance; no discrete move hint is advertised. |
| Edge Matching | Explicit, undoable one-tile reveal from a complete compatible arrangement; actual four edge numbers and already placed neighbours explained. |
| Poker | Texas Hold’em / Omaha / Five-card Draw; own hand, public board, exact Omaha card-use rule, pot odds, approximate equity, legal betting actions, exchange plan and showdown explanations. |
| Noughts and Crosses | Complete-game search; win, block, fork, centre or best attainable result explained. |
| Reversi | Legal brackets/flips; exact flip count, secure corner or opposing mobility; no early-disc-count guarantee. |
| Snake | Direction/reversal, edge and pause guidance; no automated hint is advertised. |
| Backgammon | Expert full-roll path; bar priority, maximum dice/higher die, hits, bearing off, protected points, pip counts and blots. Roll/opening/cube stages get relevant advice rather than silence. |
| Mahjong Solitaire | Both tiles free and matching under ordinary/flower/season rules; actual newly freed tiles counted, without promising a remaining solution. |
| 15 Puzzle | Only an adjacent numbered tile; complete solution search or bounded fallback, recent-layout avoidance and honest detour explanation. |
| Peg Solitaire | Legal occupied-over-occupied-into-empty orthogonal jump; bounded centre-finish search with explicitly limited fallback. |
| Dots and Boxes | Legal edge; boxes completed/retained turn, three-sided gifts and chain control. |
| Nine Men’s Morris | Placement, adjacent move or three-man flight; mill/capture phase and outside-mill removal rule. |
| Kalah | Legal own pit; seed count, sowing direction/skipped opposing store, actual store gain, capture/extra-turn/sweep effects. |
| Picture Logic | Correct conflicting marks first, then intersections justified by all legal line arrangements; preserves working until the player changes it. |
| Cribbage | Expert discard names both discarded and kept cards, expected hand score across unseen starters and crib ownership; pegging explains count, immediate points and possible replies. Show scoring lists combinations. |
| Snakes and Ladders | Cast/portal/exact-finish guidance. There is no strategic choice to recommend, so no hint button is advertised. |
| Senet | Cast first; legal counter/house and full cast; protection/exchange/water/bonus/exact exit effects in the documented reconstruction; future casts are probabilities. |
| Ludo | Entry, actual route step, captures, safe positions, exact home and bonus turns; future dice not inspected. |
| Dominoes | Draw / Block / Fives: actual tile/end match, required opening, draw/pass restrictions, exposed-end points and remaining matching options. |
| Chinese Chequers | Exact legal route including intermediate hops; occupied-point jumps, empty landings, no capture, target-camp occupancy/rearrangement. |
| Royal Game of Ur | Legal rolled counter; protected rosette, capture, bonus and exact exit effects; future casts not inspected. |
| Gomoku | Freestyle legal point; immediate five/overline, block or generated winning points, with bounded-search limitations. |
| Halma | 16×16 classic / 10×10 compact: legal chains, target-camp restrictions and target occupancy. |
| Fox and Geese | Exact source/landing, actual capture or net/escape purpose; no inaccurate claim of chained hops. |
| Hnefatafl | Brandubh: legal rook-like route, actual sandwich capture, king escape or blocking purpose. |
| Nim | Normal / misère / take-up-to-three: exact pile/take/remaining counts; nim-sum, singleton parity or modulo-four explanation; losing positions are admitted. |
| Hex | Legal placement/pie swap; actual completed connection or unblocked path cost, explicitly not a forced-win claim. |
| Hearts | Legal three-card pass or play; exact cards, mandatory suit-following, penalties/current or final trick winner, unseen-card sampling limitation. |
| Spades | Own-hand bid estimate/trump length, contract/Nil/bag explanation; legal play, follow suit, trump and partnership context. |
| Gin Rummy | Offer/pass/stock/visible discard legality; exact deadwood before/after; legal discard avoiding an immediate return of a picked-up discard; knock/Gin/layoff/undercut explanation. |
| Whist | Legal suit-following/trump/partnership advice and current/final winner; public-consistent endgame search, no actual hidden-hand use. |
| Matching Pairs | Known matching partner named; otherwise honest exploratory choice rather than claiming to know a covered face. Two exposed cards resolve before a further choice. |
| Kakuro | Correction before current crossing-sum/distinct-digit singleton; clearly labelled unique-solution fallback. |
| Slitherlink | Cell counts, dot degree, correction priority and explicit reveal; applying a hint makes one permitted edit. |
| Hashi | Correct bad positive links first; exact island remaining capacity, nearest alignment and crossing restriction; explicit solution fallback/no-bridge marker. |
| Futoshiki | Correction before row/column/inequality singleton; explicit solution reveal fallback; working entries remain permitted. |
| Skyscrapers | Correction before row/column/skyline singleton; explicit solution reveal fallback; working entries remain permitted. |
| Tangrams | One possible piece outline, explicitly allowing alternative valid arrangements; no automatic claim that only the stored arrangement works. |
| Word Search | An unfound word's actual starting letter, with the eight legal directions; no word marked found by requesting a hint. |

The basic-strategy check uses the game's actual S17 rules, consistent with [Michael Shackleford's four-to-eight-deck strategy reference](https://wizardofodds.com/games/blackjack/strategy/4-decks/). Rules variants and their primary references remain recorded in [RULES_AUDIT.md](RULES_AUDIT.md). Naming changes and their evidence are in [NAMING_AUDIT.md](NAMING_AUDIT.md).

## Verification

- `tests/hints-audit.test.ts`: regression cases for wrong-entry deductions, legal/pure recommendations, former cycling deals, distant sliding positions, network completion/corrections, number puzzles, all 2,197 two-card/upcard Blackjack rank combinations, count visibility, Poker variants, tile reveals, lessons and names.
- `tests/tutor-fairness.test.ts`: 58 actionable legal/pure advice checks across 25 configurations and 48 concealed-information permutations across six game families. Explanations must identify the move and reasoning and remain unchanged by hidden-information permutations.
- `tests/hints-playground.html?bundle`: real standalone bundle, controls and workers, all 48 games plus variants, paused puzzles, stale hints, applying network/number guidance, live counting/drill grading and all twelve lesson interactions. **70 / 70 scenarios passed** with no uncaught errors or rejected promises. The matching bundle SHA-256 and complete named results are saved in `tests/results/hints-browser-audit.json`.
- **289 workspace tests passed**, and the production build completed. The browser report fingerprints the built standalone file; older AI/rules browser reports are historical evidence for their recorded bundle hashes.

These are reproducible sampled/fixture checks, not exhaustive play of every reachable position. Bounded search and sampled card estimates are useful practice advice, not proofs of universally optimal play. Only complete/exact searches, immediate rule effects and explicitly established deductions are described as such in the UI.
