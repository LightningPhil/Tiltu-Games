# Tiltu’s Games

Fifty-four games, five shared themes, one offline HTML file. Choose a game in the header or return to the lobby. Each game keeps its own progress.

The nine games in **Arcade & worlds** are **TetriGrid**, **Archive Patrol**, **Neon Void**, **Whack-a-Party!**, **Neon Horizon**, **Neon Synth Ballistics**, **Snake**, **Downhill Skiing** and **Conway’s Game of Life**. They share the app’s themes and navigation. Settings, help, records and libraries use separate panels to keep play controls close to the game. Soundtracks are synthesized locally. This repository contains the collection's own gameplay and audio modules; no other repository is needed to build it. Internal game and storage identifiers retain compatibility with existing saves.

## Playing on phones and larger screens

The home screen keeps search, categories and page controls visible while game tiles fit the available screen. Games are alphabetical; search looks across all 54 games and recognises familiar names such as Checkers and Tic Tac Toe. Recent lists the last eight games opened on this browser. Searching for Klondike, FreeCell or Spider opens that Patience variant directly.

Use **Switch game** in the header to open the same library during play. The current game is suspended while the picker is open. Close it to return, or choose another game; saved progress stays with each game. Returning home keeps the category and page you were browsing. On a phone, the search key dismisses the keyboard so you can see the results.

Puzzles, board games and card games share a screen-sized workspace. **Play** keeps the board or table, current turn and essential actions together. On portrait phones, actions sit below play; landscape screens put them alongside it. **Setup** contains new games, variants and preferences, **Help** contains rules and license information, and **Tools** appears when there is additional guidance, history, inspection or tutorial material. Escape returns to Play. Number pads, dice, bids, legal destinations and scoring confirmations remain in Play.

Use **Enlarge** for a dense board. **Pan board** lets you drag the view without playing a move; **Move pieces** restores game input, and Escape also leaves Pan mode. **Fit board** returns to the full-board view. Expert minefields enlarge enough to keep their squares tappable. Senet turns into three tall columns on portrait phones, preserving the numbered route, then returns to its wide board in landscape.

Card hands are laid out in rows on phones so every card can be selected directly. **Larger cards** switches to a sideways-scrolling hand; **Fit hand** shows all cards together again. Passing, bidding, drawing and discarding stay beside the hand. In Patience, tap a card or sequence and choose a highlighted destination or one of the explicit destination buttons; dragging remains available. Use Setup to switch between Klondike, FreeCell and Spider. Patience offers the **Pan board** / **Move pieces** toggle in both table sizes, and long columns scroll within the table.

## Playing

| Game | Controls and useful tools |
| --- | --- |
| TetriGrid | Arrows / WASD move and rotate; Z/X turn; Space drops; C / Shift holds; P pauses. Marathon, 40-line Sprint, two-minute Ultra and gravity-free Zen. Seven-bag, SRS kicks, five previews, landing guide, handling presets and five soundtracks. |
| Archive Patrol | Up/W accelerates forward, Down/S brakes, Left/Right or A/D turns the ship. Release to coast. Space/click fires straight ahead; R toggles continuous forward fire. E/right-click launches the secondary directional EMP with an independent 18-second recharge; Shift boosts, F extends the magnet/scans and G docks. Blast three raider waves, crack supply caches, scoop cores and timed power-ups, then buy upgrades. Unlimited ammo, instant banking and an automatic loot sweep/upgrade screen; three ships, three weapons, six sectors and two carriers. |
| Neon Void | WASD/arrows move, Space fires, Shift dashes, E/Q releases a shockwave, R launches fitted cluster rockets, F toggles autofire, P/Escape pauses. Below the arena, hold FIRE on the left and steer with the thumb stick on the right; dash, pulse and rockets sit between them. At resupply, browse Weapons, Ordnance and Systems; on phones, **Ship & Repair** shows the loadout and hull repair. Tap an equipment illustration for its full description. Paging and launch controls stay below the catalogue. Thirty-wave campaign, resupply/checkpoint economy, three ships, nine weapon mounts, wave practice, endless play and nine soundtracks. |
| Whack-a-Party! | Click/tap a pop-up or use 1–9 / QWE ASD ZXC. Avoid sleepy targets. Eight animals, mixed zoo, custom PNG or JPG/JPEG characters, three paces, timed rounds and practice, tap allowances, combos and party fever. Import photos through Guests; photos retain their backgrounds and transparent PNGs are trimmed. P pauses. |
| Neon Horizon | Choose mouse stick, keyboard, gamepad, touch or relative mouse controls. Flight school, sector interception, endless hunt and peaceful cruise; seeded city routes, detailed/retro visuals, cockpit/clear/chase cameras and eight soundtracks. Controls and comfort settings are explained in the flight deck and pause menu. |
| Neon Synth Ballistics | A/D or arrows move, W/Up jumps, pointer aims, hold/release Space or FIRE to shoot. Cancelling a touch discards the charge. On phones, the Arsenal selector lists all ten weapons/tools above the move, aim, jump, jet and fire buttons. Destructible maps, solo CPU, shared-device squads, firing range, map codes and three soundtracks. |
| Four in a Row | Click a column or use 1–7. Left/right previews columns; Enter drops. Setup offers an optional preview/confirm mode. Hints outline winning and blocking lines. |
| Draughts | Select a ringed piece and a marked landing. Capture routes show every jump. Flip the board, cycle movable pieces, or watch a tutor suggestion before playing it. |
| Sudoku | Switch between Cell first and number painting. Notes works with either style. Candidate explanations compare the row, column and box. Shift enters a note; N toggles Notes. |
| Chess | Select a piece and destination. For castling, select the king and then its rook or legal king destination. Optional attack markers show the opponent’s controlled squares. Captures and material appear in Tools. |
| Go | Inspect groups and liberties, show atari, or enable Preview first to inspect a placement before committing. Two passes open scoring; mark agreed dead groups or resume play. |
| Blackjack | H hits, S stands, D doubles or deals the next round, P splits. The table tutor explains the current decision. Double and Split show their extra stake; each finished hand shows its net result. |
| Patience | Choose Klondike, FreeCell or Spider inside the collection. Each keeps its own deal. Click or drag cards and sequences. Destination buttons sit below the table. Arrows navigate columns and face-up runs. D draws, H hints, A moves safe cards home. Auto moves can be stopped; an exposed endgame offers Finish this deal. |
| Minesweeper | Click to reveal, right-click/F/hold to flag. Open numbers reveal neighbours when the flag count matches, in either input mode. Hover or focus a clue to highlight covered neighbours. P pauses and hides the field. |
| Conway’s Game of Life | Play, World, Patterns, Snapshots and Help tabs keep tools reachable. P runs/pauses, or use Run, Step and Back. Drag to paint a continuous line. Choose a stamp; R rotates and M mirrors it. Snapshots offers a persistent snapshot that can be swapped with the current world, including after resizing. Fit world shows the full field; zoom and Pan inspect details. |
| Downhill Skiing | Arrows/WASD or touch buttons steer; hold Up/Down, W/S or Brake to stop on snow. Space jumps, F toggles Fast, P/Escape pauses and Enter starts/resumes. Start/Resume includes a countdown; leaving the window pauses. Mouse steering is an explicit Setup option. |
| Edge Matching | Select a tile or empty destination; click or drag to move. Arrows navigate both grids. Edge colours, a larger tile inspector, animated sorting, undo and explicit one-tile reveals are available. |
| Poker | C checks/calls, R bets/raises, F folds, D deals. In Draw, 1–5 mark discards, Esc keeps all, E exchanges. Ask the table tutor before deciding; the hand guide includes real examples of all categories. |

Four in a Row, Draughts, Chess and Go have **Review moves** in Tools: step through any position or replay a move with the shared animation speed. Review and tutor previews use copies and do not change the live match, its turn or its score. **Enlarge** / **Fit board** changes the board view. In Play, Escape clears chess/Go/Four in a Row selections and previews; from another section, it returns to Play.

## New collection games

| Game | Controls and useful tools |
| --- | --- |
| Noughts and Crosses | Select an empty square. Three in a line wins; level 5 plays perfectly. |
| Reversi | Legal placements are marked. Every bracketed direction flips, and passes happen automatically. |
| Backgammon | Roll, select a checker or the bar, then a highlighted destination or a die-labelled move. Whole-roll legality enforces maximum dice use and the higher-die rule. Bear off, hit, re-enter and use the doubling cube. |
| Mahjong Solitaire | Select two matching free tiles. Standard faces, flowers and seasons are distinct. Three 144-tile layouts start with complete legal solutions. Enlarge the arrangement, inspect a selected face, undo or reshuffle remaining tiles. |
| 15 Puzzle | Tap a neighbouring tile; arrows move the empty space. Choose 3×3, 4×4 or 5×5, restart the same reachable shuffle, undo or ask for a search hint. |
| Peg Solitaire | Select a peg, then a marked socket. English cross and smaller diamond starts; undo and a bounded solution search help explore. |
| Dots and Boxes | Draw an unclaimed edge. A completed box belongs to you and gives another turn. Three- and four-box-square boards support shared-device or computer play. |
| Nine Men’s Morris | Place nine men, move along lines, form mills and remove an opponent. At three men, fly to any empty point. Protected mills, one capture for simultaneous mills, threefold repetition and a 50-move draw convention are enforced. |
| Kalah | Six pits, four seeds. Sowing is animated seed by seed. Extra turns, occupied-opposite captures and final owner sweeps are explained in play. |
| Picture Logic | Fill, Cross or Erase by tapping or dragging; right-click crosses. 27 original pictures at 5×5, 10×10 and 15×15 have unique solutions. Hints explain forced squares, Check preserves entries, and completion reveals the picture’s title. |
| Snake | Arrows/WASD, swipes or the direction pad steer. Swipes turn as you drag. Space/P/Escape pauses; Enter starts or resumes. Five speeds, solid/wrapped edges, optional original synthesised sound, a saved personal best and a screen-fitting play area. Setup pauses the run. |
| Cribbage | Choose two cards for the crib, cut, then peg to 31. Go is available only when no card fits. Count nondealer, dealer and crib with every scoring combination explained. Jack heels, nobs, multiple runs, flush distinctions and immediate wins at 121 are handled. |
| Patience → FreeCell | Four cells, eight open columns and four suit foundations. Sequence capacity follows legal single-card transport. Numbered Grid Club deals, legal destinations, hints and safe automatic foundation moves. |
| Patience → Spider | Two decks, ten columns; one, two or four suits. Move suited descending runs and collect eight King-to-Ace runs. Empty columns block stock deals. Stock, moves and automatic completions undo together. |

All strategic computer opponents use five shared skill names: **Easy, Casual, Challenging, Hard and Expert**. Poker and Two-Colour Colonies also have their own saved skill settings. Later levels combine more accurate choices, deeper planning and exact endgame reading where practical. Card opponents use their own cards and public information. The [computer-player audit](AI_AUDIT.md) records the measured progression, legality and hidden-information checks; [reusable benchmarks](tests/ai-benchmarks/README.md) preserve the fixtures and seeds.

Hints use the strongest available analysis independently of opponent skill and explain the selected action. Logical deductions, solution corrections and explicit reveals are distinguished. The [hint/tutor audit](HINT_AUDIT.md) covers the original 48 games and variants; `/tests/hints-playground.html?bundle` checks the actual standalone controls on isolated port **5193**. The [naming review](NAMING_AUDIT.md) covers every displayed game, variant and theme, including descriptive renames and the unresolved **Grid Club** umbrella-brand question. Internal identifiers remain compatible with existing saves.

The lobby groups games by Board games, Card games, Puzzles and Arcade & worlds. Search also finds variants within Patience. Poker displays its current variant beneath its title. New board games have the shared animation speeds, undo, hints, larger-board views and active-player glow. Cards keep the same original deck and felt materials as the rest of Grid Club.

## Race, strategy, cards and logic

The race, strategy, card and logic collection adds:

| Game | Play and chosen rules |
| --- | --- |
| Snakes and Ladders | Two to four counters; roll and watch the full movement, ladder or snake. Exact finish. The computer uses the same die. |
| Senet | Milwaukee Public Museum reconstruction, clearly identified because the ancient rules are incomplete. Four casting sticks, protected pairs, house 26, water/rebirth and exact special exits. The rules disclose occupied-rebirth and final-exit clarifications. |
| Ludo | UK Ludo League casual rules: four counters, safe starts/stars, unlimited friendly stacks, six/capture/home bonuses, third-six forfeiture and exact home lanes. Two to four players. |
| Dominoes | Draw-until-playable with an empty boneyard; Block; and Fives using Muggins without a spinner. Select a tile and an end. Each style has its own documented scoring. |
| Chinese Chequers | Two players, ten marbles and the full 121-hole star. Steps and chained short hops, target-camp locking and a published anti-spoiling convention. |
| Royal Game of Ur | Modern Finkel rules: seven counters, four binary dice, shared captures, protected central rosette, bonus casts and exact bearing off. |
| Gomoku | Freestyle five-or-more, with 15×15 and 19×19 boards. |
| Halma | Classic 19 men on 16×16 or a compact 10-man practice board. Eight-direction steps and hop chains; Schmidt’s published anti-blocking variant 2. |
| Fox and Geese | Museum activity with thirteen geese on the 33-point cross. Printed movement lines, forward geese and one optional fox capture per turn; two geese remaining wins for the fox. |
| Hnefatafl | Modern Brandubh, 7×7. King and four defenders against eight attackers; rook movement, active sandwich captures, corner escape, encirclement and repetition rules. |
| Nim | Normal, misère and one-pile take-up-to-three rules. Buttons show how many objects a take removes. Expert uses exact winning strategy. |
| Hex | 7×7, 9×9 or 11×11; connect the colour’s two edges. The second player may take the opening colour using the pie rule. |
| Hearts | Four-player American Hearts against three computer players. Three-card passing, compulsory suit following, first-trick protection, heart breaking and a choice of moon scoring. |
| Spades | Partnership with North; bids, Nil, broken trumps, contracts, failed-Nil bags and the cumulative ten-bag penalty. First team to 500. |
| Gin Rummy | Two players, ten cards, opening upcard offers and the two-stock-card ending. Best meld partitions and optimal legal chained layoffs are explained. Straight-Gin bonuses: Gin 20, undercut 10; first to 100. |
| Whist | British short Whist with North as partner. Dealer’s last card sets trumps; compulsory suit following, thirteen tricks and first-to-five scoring, without honours. |
| Matching Pairs | Six to eighteen pairs of distinct original faces. Solo, shared-device or computer play. Reveals linger; computer memory uses public faces only. |
| Kakuro | 7×7 or 9×9 crossing sums, distinct 1–9 digits, pinned starter digits and unique generated solutions. Crossing-run highlighting and exact sum-combination candidates. |
| Slitherlink | Uniquely checked 4×4 to 7×7 lattice puzzles. Tap line/cross/clear, or right-click a cross. Completion requires one loop with no branches. |
| Hashi | Unique connected bridge networks on 7×7, 9×9 or 11×11 fields. Select two islands or tap a connection; one/two/no bridges. No crossings or disconnected finishes. |
| Futoshiki | Unique 4×4 to 6×6 Latin grids with inequality clues, pencil marks and checks. |
| Skyscrapers | Unique 4×4 to 6×6 visibility puzzles, with flat digits or illustrated towers. |
| Tangrams | Seven classic shapes and original silhouettes. Drag, rotate by 45°, reflect, nudge or align corners magnetically. Geometry accepts alternative correct dissections. R rotates, F reflects, arrows nudge and Shift increases the step. |
| Word Search | Original garden, wildlife, space and coast word lists. 10×10, 12×12 or 15×15 fields; drag or tap endpoints in any straight direction. Found words keep coloured trails. |

New card hands can be fanned or spread horizontally, with a clear click/touch target for every card. Table advice uses the player's own cards and public information. Bigger boards can be enlarged and panned; computer turns keep boards fully lit and highlight the current player. Existing saved games migrate independently, and storage compacts older undo histories when the expanded collection becomes large.

The exact rule choices and reference links are available in each game's **How to play** and in `src/club-plus/rules.ts`. The isolated `/tests/plus-playground.html` loader works only on port **5193**, with finishing positions for all 24 additions and extra card/rule variants. It is not included in the offline build.

## Development

```sh
npm ci
npm run dev
npm test
npm run build
```

The deliverable is `dist_single/index.html`. Use Node.js 24 LTS for development and TypeScript regression tests.

After building, `npm run preview` from the repository root serves the deliverable at `http://localhost:4173/`, including direct `?game=void`, `?game=whacker`, `?game=horizon` and `?game=ballistics` links.

For repeatable browser checks without replacing personal saved games, use a separate origin:

```sh
npm run dev -- --host 127.0.0.1 --port 5193 --strictPort
```

Open `/tests/ux-playground.html` on that origin. Its fixture loader only works on port 5193 and intentionally replaces that origin’s practice data. It provides double jumps, castling, promotion, atari, a small sudoku, split blackjack, an exposed patience endgame, Edge Matching and three poker styles. It is a development page and is not included in the standalone build.

## Graphics

`src/visuals.css` defines the shared material, lighting, board frames and five theme palettes. `src/graphics.ts` contains original SVG artwork for the original twelve lobby illustrations, the chess set (including captures, promotion and lessons), disc emblems, court cards, card backs and Minesweeper icons. These stay sharp at every board size and require no downloaded fonts or images. `src/life-renderer.ts` draws the themed Life field; Downhill Skiing reads the same palette tokens for its snow and skier.

Use `/tests/ski-visuals.html` to inspect scenery, ramp jumps, articulated falls and every yeti action in all five palettes. Neither development check page is bundled into the offline app.

The in-game graphics also include a resize-aware Four in a Row winning thread and landing effects, engraved draughts men and stacked kings, shaded chess pieces throughout play/review/lessons, a wood-grain Go board, proportional Sudoku digits and valid-row completion marks, vector card suits and decorated aces, poker community-card slots and chip stacks, seven-segment mine counters, bevelled Edge Matching tiles with matching-edge highlights, Life cell ageing/birth glows, and Downhill Skiing cast shadows, distance ticks and landing snow. `tests/graphics.test.ts` checks the state behind completion marks, edge highlights and counter formatting.

For graphics review, the isolated fixture page also offers a finished Four in a Row line, an illustrated Patience deal and a completed Sudoku row.

The expansion practice page is `/tests/collection-playground.html` on isolated port **5193**. Its loader refuses other ports. It includes near-finished games, a 29-point cribbage hand, bar/hit and bear-off positions, mills, sowing captures and card completions. `tests/collection.test.ts` checks the new rules, generated puzzle uniqueness/solvability, complete matches, physical card conservation, save recovery and large-save history compaction. Current positions are retained; unusually large collections may keep only recent undo snapshots in storage.

## Rule choices and references

The second collection adds 24 original lobby illustrations in `src/club-plus-art.ts` and themed boards, racing counters, dominoes, memory faces, towers and tangrams in `src/club-plus/`. Its rules and source links are available inside every game and in `src/club-plus/rules.ts`. Senet explicitly follows the Milwaukee Public Museum reconstruction; Hnefatafl uses the documented seven-square Brandubh variant. Dominoes includes Draw, Block and Muggins Fives without a spinner.

On isolated port **5193**, `/tests/plus-playground.html` provides finishing positions for all 24 additions. `tests/club-plus.test.ts` covers their rules, complete matches, public-information computer play, unique puzzle generation, alternative tangram solutions and restoration of hands in progress. Save compaction considers histories across the collection while retaining each current position.

For layout regressions, open `/tests/hover-check.html` on **5193**. Load its practice positions, then run the catalogue in batches of eight at desktop and phone widths. It mirrors the app's CSS hover states and dispatches pointer events to every rendered control and board cell, comparing board geometry, hit areas, document size and scroll positions. It also replays a draughts double capture. Minesweeper includes a revealed clue with matching flags, exercising the longest hover guidance. The loader only replaces that isolated origin's practice save; it is excluded from the offline build.

Append `?bundle` to that check page to exercise the rebuilt standalone HTML instead of the development entry point.

- [US Backgammon Federation](https://usbgf.org/backgammon-basics-how-to-play/): maximum dice use, bar entry, bearing off, gammons and doubling.
- [American Cribbage Congress 2025 rulebook](https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf): automatic scoring here, no muggins, first to 121.
- [Morris rules and conventions](https://www.nine-mens-morris.net/manual.html): flying at three, one removal per mill-forming move, repetition and quiet-move draws.
- [Kalah variant research](https://www.cs.gettysburg.edu/~tneller/games/fairkalah/index.html): this implementation captures only when the opposite pit is occupied.
- [KDE Mahjong freedom rules](https://docs.kde.org/stable_kf6/en/kmahjongg/kmahjongg/howto.html) and [PySolFC Mahjong identities](https://pysolfc.sourceforge.io/doc/rules/mahjongg.html).
- [KDE Patience rules](https://docs.kde.org/stable_kf6/en/kpat/kpat/rules-specific.html): FreeCell capacity and Spider suit modes.
