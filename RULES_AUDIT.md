# Grid Club rules audit

Audit date: 18 October 2026. Scope: all 48 catalogue games, including all three Poker, Patience, Dominoes and Nim variants. The aim is consistent enforcement of the **documented variant**, rather than silently mixing different regional rules.

## Changes made

1. **Ludo:** removed an extra shared-track step before the private home lane. A counter now visits shared progress 0–50, private progress 51–55 and finishes at 56. Each seat enters its lane from an adjacent square. Existing saved games and undo positions migrate once to the corrected route.
2. **Hnefatafl / Brandubh:** an attacker can capture the king against a hostile corner. The throne remains non-hostile to the king. Tested in all eight rotated/reflected corner approaches.
3. **Gomoku:** Hard and Expert no longer fail when searching the final empty point. Advice searches use a copied board. All five levels can make the last drawing move without changing the position being searched.
4. **Whist:** the dealer’s turned card is identified on the table, including when a computer player deals. The reference remains public after play begins.
5. **Chess:** added a conservative dead-position test for permanently locked king-and-pawn walls. Neither king may be able to reach an opposing pawn, even with the opposing king’s restrictions ignored. Positions with mobile/capturable pawns, other pieces, check or an en-passant target are excluded. This supplements the existing insufficient-material draws; it is not a general fortress solver.
6. **FreeCell:** foundation cards cannot be moved back into play. Rejected moves leave the session unchanged.
7. **Klondike:** moving an entire King-led column to an empty column appears among the legal destinations. Redundant column relocations are excluded from hints, rather than from the legal move list.
8. **Hex:** legal-move enumeration includes the pie-rule colour swap on the second turn.

Number puzzles preserve conflicting working entries, as requested. Fixed clues remain protected and only a valid solution completes a puzzle. Skyscrapers visibility contradictions and impossible Kakuro partial sums now highlight conflicting entries. Completion checks reject out-of-range digits/marks/bridge counts. Input guards reject fractional, non-finite and out-of-bounds puzzle indices without changing the game.

## Verification

- TypeScript check and production single-file build.
- **211 automated tests passed**, including seeded complete card/race matches, conservation of pieces/cards/chips, special moves, scoring, undo, restoration and all five computer levels.
- Independent complete move-set comparisons: 1,000 sampled draughts positions; 20 full Four in a Row games and 20 full Reversi games; 15 Peg Solitaire playthroughs; 15 Sliding Tiles walks across three board sizes. These checks enumerate moves independently of the production move generator.
- **62 of 62 browser scenarios passed, with zero failures.** `tests/rules-playground.html?bundle` loads the built offline app in an isolated iframe, uses ordinary controls and checks the resulting saved practice position. It covers all 48 games, including additional variants and regressions. Practice data is restricted to port 5193 and does not replace the offline file’s saved games.
- Browser endgame fixtures are deliberate positions, not claims that every game was manually played from its opening to completion. Long complete matches are exercised separately in the automated suite.

The tests demonstrate the checked positions and rules. They do not exhaust every reachable Chess, Go, Hnefatafl or other large game state, or formally prove the absence of every possible defect.

## Game-by-game coverage

| Game | Variant and rules checked | Browser play / specific boundary checks |
|---|---|---|
| Four in a Row | Gravity; full columns; four directions; terminal results | Winning drop; independent complete move sets |
| Draughts | English draughts; compulsory capture; complete jump chains; forward-moving men; short kings; promotion ends the turn | Illegal quiet move during capture rejected; animated double jump; independent capture-tree comparison |
| Sudoku | Digits once per row, column and box, including rectangular supported boxes | Fixed clue protected; editable entry; notes/conflicts/unique generated solutions in tests |
| Chess | Legal king safety; castling rights and attacked transit squares; en passant; four promotions; mate/stalemate/draws | Castling; Knight underpromotion; dead pawn wall; capture panel and special moves in tests |
| Go | Chinese area scoring; 7.5 komi; no suicide; positional superko; two passes; dead-group agreement and resume | Atari capture; suicide/ko/scoring/pass/resume tests |
| Blackjack | Six decks; dealer stands on soft 17; natural 3:2; same-rank splits; four hands maximum; one-card split Aces; double after split | Split and hand progression; disabled non-pair split; bankroll/settlement/counting tests |
| Patience | Klondike draw 1/3; descending alternating colours; King vacancies; ascending suited foundations; foundation withdrawal permitted | Foundation move and whole King-column relocation; draw/recycle/undo tests |
| Minesweeper | First neighbourhood safe; eight-neighbour counts; flags prevent reveal; chording can lose with wrong flags; all safe squares win | First reveal; flag then attempted reveal; wrong-chord and completion tests |
| Conway’s Game of Life | Synchronous B3/S23 with eight neighbours; selectable boundary wrapping | Generation compared with expected board; continuous run; oscillator/glider/still-life tests |
| Downhill Skiing | Original free-ski, slalom and freestyle rules shown in the app | Start, countdown, movement and pause; ramp direction, landing clearance, ragdoll and yeti tests |
| TetraVex | Equal adjacent edge values; mismatching placements rejected; complete matching grid wins | Tray-to-board placement; all sizes, swaps, mismatches and return-to-tray tests |
| Poker | Heads-up fixed-limit Hold’em, Omaha and Five-card Draw; one opening bet plus three raises | Check/call or exchange in each variant; Omaha exactly two hole/three board cards; all-in/refunds/ties/rankings in tests |
| Noughts and Crosses | Three in a line; occupied squares unavailable; full-board draw | Winning move; Expert checked against every reachable human reply |
| Reversi | Mandatory bracketing; all bracketed rays flip; automatic pass when unavailable; majority at end | Unsupported square disabled; opening flip; independent complete move sets |
| Snake | Original arcade rules; queued right-angle turns; selectable wrap; tail vacancy exception | Apple consumed; pause; reversal, collisions and tail-vacancy tests |
| Backgammon | Opening roll; maximal dice use; higher die if only one usable; doubles; bar priority; hits; exact/overshoot bearing off; cube and gammon scoring | Final checker borne off; blocked entry, dice order and cube tests |
| Mahjong Solitaire | Free top tiles with one horizontal side clear; ordinary exact matches; flowers/seasons match within their class | Final flower pair; blocked sides/covers and complete generated removal paths in tests |
| 15 Puzzle | Orthogonally adjacent tile slides into vacancy; solved order; solvable shuffle parity | Nonadjacent tile disabled; final slide; independent adjacency enumeration |
| Peg Solitaire | English cross; orthogonal adjacent-peg jumps; remove exactly the jumped peg | Final jump; diagonal rejection and independent full move-set comparison |
| Dots and Boxes | Unclaimed edges only; completing boxes earns another turn; shared edge can claim two boxes | Double-box completion |
| Nine Men’s Morris | Placement; adjacency sliding; mill removal; protected mills; flying with three men | Close mill and enter removal phase; flying/protection tests |
| Kalah | Six pits per player; sow past own store, skip rival store; opposite capture; store extra turn; final sweep | Opposite capture and store total; seed conservation/end sweep tests |
| Nonograms | Row/column run clues; pencil crosses and working marks; valid picture required | Last filled cell completes picture; unique solutions and invalid-mark completion tests |
| Cribbage | Two-player six-card deal; discard to crib; pegging to 31; runs/pairs/15s; Go/last; hand/crib flush distinction; nobs; 121 target | Count the 29 hand; seeded full games and pegging boundary tests |
| Snakes and Ladders | Full die move; exact 100; portal transport; overshoot passes | Exact winning move; overshoot and ladder tests |
| Senet | Milwaukee museum reconstruction with stated rebirth and house-30 clarifications | Exact final exit; protected pairs, house 26, water and exit-cast tests |
| Ludo | UK Ludo League casual movement, safety, stacking, bonus rolls and third-six forfeiture | Corrected final home move; each seat’s private entry/exact finish; old-save migration |
| Dominoes | Double-six Draw, Block and Muggins Fives; no spinner; declared first-lead and scoring rules | Last tile in each variant; complete matches conserve all 28 tiles |
| Chinese Chequers | Ten marbles; adjacent step or chained short hops; no captures; target cannot be left; anti-spoiling | Final camp move; hop chains and piece conservation |
| Royal Game of Ur | Modern Finkel route; seven counters; binary casts; protected central rosette; capture returns to reserve; exact finish | Final exit; zero cast, protected landing and captures |
| Gomoku | Freestyle five or more; no forbidden Renju moves; occupied points unavailable | Winning five; final drawing point and Expert advice; all five levels’ final-point tests |
| Halma | Classic 16×16/19 men or compact 10×10/10 men; short chained hops; target lock; published anti-blocking variant | Final camp move; target restriction and starting counts |
| Fox and Geese | Museum 13-geese board; geese sideways/forward on lines; fox all directions; declared single optional capture | Capture reduces geese to two; backward-geese exclusion |
| Hnefatafl | Modern 7×7 Brandubh; restricted squares; soldier sandwiches; king capture/escape; encirclement and repetition | Corner escape and king-against-corner capture; throne surround and non-hostility tests |
| Nim | Normal, misère and take-up-to-three | Each last-object result; exact Expert strategies tested |
| Hex | Six neighbours; opposite-edge connectivity; no draws; second-turn pie swap | Winning connection and colour swap; move-list swap availability |
| Hearts | American; rotating passes; two of clubs lead; follow suit; first-trick penalties; hearts breaking; moon choices | Moon scoring; complete matches; suit and penalty restrictions |
| Spades | Partnership; individual bids; Nil; bags; broken trump; target 500 | Legal final card; complete matches and Nil/bag scoring tests |
| Gin Rummy | Straight Gin; opening offer; draw/discard; no immediate return of taken discard; ≤10 knock; Gin/undercut and layoffs | Declare Gin; meld overlap, chained layoffs, undercut and complete seeded matches |
| Whist | British short Whist; exposed trump card; dealer-left lead; follow suit; tricks above six; target five; no honours | Turned-card reference and legal final card; full-match scoring/follow-suit tests |
| Memory Pairs | Turn two; matches retain turn; mismatches conceal after pause; finish after all pairs | Final pair; computer uses revealed knowledge only |
| Kakuro | Digits 1–9; distinct per run; exact crossing sums; fixed starters | Valid final digit; unique solutions, tentative conflicts and domain checks |
| Slitherlink | One loop; clue edge totals; vertex degree 0/2; no branches, crossings or separate loops | Final loop edge; disconnected-cycle rejection; unique generated loops |
| Hashi | Nearest orthogonal islands; at most two bridges; no crossings; degrees and one connected network | Final connection; unique networks, crossing and three-bridge rejection |
| Futoshiki | Latin rows/columns; inequalities; fixed digits; no Sudoku boxes | Final digit; unique generation, working conflicts and fixed-clue protection |
| Skyscrapers | Latin heights; visibility from all four edges; omitted clues unrestricted | Final height; skyline conflict highlighting and unique generation |
| Tangrams | Seven pieces; 45° rotations/reflection; geometric coverage without gaps/overlap; alternative dissections accepted | Final piece nudges into silhouette; alternative solution and overlap tests |
| Word Search | Straight horizontal/vertical/diagonal words in either direction | Last word selected backwards; all collections and malformed-endpoint tests |

FreeCell and Spider are within Patience, not additional catalogue games. FreeCell tests cover temporary-cell/empty-column supermove capacity and permanent foundations. Spider tests cover 1/2/4-suit identities, suited movable runs, descending mixed-suit building, no deal with empty columns, ten-card stock deals and automatic complete-run collection. Browser play moves a FreeCell King home and collects Spider’s eighth run.

## Declared choices that are not universal rules

- Chess automatically resolves threefold repetition and fifty-move draws; it does not implement tournament claim/arbiter procedures or clocks.
- Draughts uses English rules, not international flying kings, backward captures by men or maximum-capture priority. Its quiet-move draw is automatic.
- Ludo and Ur start with the first player rather than an opening roll-off. This casual-table choice is now explicit in their in-app rules.
- Senet’s full ancient rules are unknown. Its reconstruction and clarifications are named in the app.
- Fox and Geese uses one optional capture per turn, explicitly stated because the selected museum activity does not specify capture chaining.
- Peg Solitaire’s “diamond” option is a starting arrangement on the English cross. A one-peg ending is recognised anywhere; the centre is the preferred challenge and hint objective.
- Life’s Garden/Colonies and the arcade games have original app-defined goals; they are checked against those stated rules. The Conway sandbox uses the standard automaton.

## Rule references

The implemented rules, views, validators and existing tests were reviewed together. These references resolve variant-sensitive points; the second collection also links its chosen source directly in `src/club-plus/rules.ts`.

- [FIDE Laws of Chess](https://handbook.fide.com/chapter/e012023), especially dead positions and special moves.
- [Hasbro original four-in-a-row instructions](https://instructions.hasbro.com/en-us/instruction/connect-4-game-instructions) and [British Go Association rules comparison](https://www.britgo.org/rules/compare.html).
- [WCDF English draughts rules, reproduced by NCCA](https://nccheckers.org/NCCA/WCDF%20Checker%20-%20Draughts%20-%20English%20Rules.htm).
- [World Othello Federation game description](https://worldothello.org/about/about-othello).
- [US Backgammon Federation: how to play](https://usbgf.org/backgammon-basics-how-to-play/).
- [American Cribbage Congress rulebook](https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf).
- [KPatience game-specific rules](https://docs.kde.org/stable_kf6/en/kpat/kpat/rules-specific.html) and [FreeCell FAQ](https://www.solitairelaboratory.com/fcfaq.html).
- [UK Ludo League rules](https://www.ukludoleague.co.uk/rules).
- [World Tafl Federation Brandubh rules](https://aagenielsen.dk/brandubh2_rules_en.pdf).
- [Milwaukee Public Museum Senet reconstruction](https://www.mpm.edu/sites/default/files/images/content/education/programs/curiosity/may/senet_v3.pdf).
- [RoyalUr modern rules](https://royalur.net/rules).
- [Chinese Chequers](https://www.mastersofgames.com/rules/chinese-checkers-rules.htm), [Schmidt Halma instructions](https://www.schmidtspiele.de/files/Produkte/4/49217%20-%20Halma/49217_Halma_DE-FR-IT-NL-ES.pdf), and [Museum of the American Revolution Fox and Geese activity](https://www.amrevmuseum.org/play-our-fox-and-geese-game).
- Pagat’s [Whist](https://www.pagat.com/whist/whist.html), [Hearts](https://www.pagat.com/reverse/hearts.html), [Spades](https://www.pagat.com/auctionwhist/spades.html), [Gin Rummy](https://www.pagat.com/rummy/ginrummy.html) and [Muggins](https://www.pagat.com/domino/line/muggins.html) variant descriptions.
- Nikoli’s [Sudoku](https://www.nikoli.co.jp/en/puzzles/sudoku/), [Kakuro](https://www.nikoli.co.jp/en/puzzles/kakuro/), [Slitherlink](https://www.nikoli.co.jp/en/puzzles/slitherlink/) and [Hashi](https://www.nikoli.co.jp/en/puzzles/hashiwokakero/) rules.
- Simon Tatham’s [Futoshiki / Unequal](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/unequal.html) and [Skyscrapers / Towers](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/towers.html).
- [GNOME TetraVex manual](https://help.gnome.org/gnome-tetravex/usage.html).
- [MIT OpenCourseWare Life lecture](https://ocw.mit.edu/courses/es-268-the-mathematics-in-toys-and-games-spring-2010/a511f77b041aef8c28b8ee16b1416977_MITES_268S10_ses10_slides2.pdf).
- [Ravensburger pairs-game instructions](https://www.ravensburger.org/spielanleitungen/ecm/Spielanleitungen/21204%20anl%201740710.pdf?ossl=pds_text_Spielanleitung).

## Reproduction

```text
npm test --workspace @single-file-games/grid-club
npm run build --workspace @single-file-games/grid-club
npm run dev --workspace @single-file-games/grid-club -- --host 127.0.0.1 --port 5193 --strictPort
```

Open `http://127.0.0.1:5193/tests/rules-playground.html?bundle` and press **Play all games and variants**. The harness is excluded from the offline build.
