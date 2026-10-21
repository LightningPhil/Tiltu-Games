# Computer-player measurements

These are seeded strength measurements and independent rule/tactical references. The fast regression tests remain in `../ai-audit.test.ts` and run with `npm test`. See `../../AI_AUDIT.md` for the recorded results and their limits.

Run these commands from this repository's root with Node.js 24 LTS. Some complete-game batteries take several minutes. Every chooser check also verifies legal moves and unchanged input where applicable.

| Command | Coverage |
| --- | --- |
| `node tests/progression.ts` | 48 colour-balanced Four in a Row / draughts matches |
| `node tests/ai-benchmarks/boards.ts exact` | Exact Noughts, Reversi, Kalah and Dots references |
| `node tests/ai-benchmarks/boards.ts morris` | Morris flying positions and forced mills |
| `node tests/ai-benchmarks/boards.ts backgammon` | Bear-off probability reference |
| `node tests/ai-benchmarks/boards.ts go-mix` | Independent four-ply Go capture reading and measured Hard mixture |
| `node tests/ai-benchmarks/king-pawn.ts` | Independent KPK retrograde oracle, both colours, defence and conversion |
| `node tests/ai-benchmarks/cards.ts` | Poker, Gin, trick games, Cribbage, Memory and LifeGenesis |
| `node tests/ai-benchmarks/plus.ts abstract-deep` | Exact non-immediate Hex endings |
| `node tests/ai-benchmarks/plus.ts gomoku-forks` | Exact forcing-fork tactics across eight board symmetries |
| `node tests/ai-benchmarks/plus.ts domino` | Complete, seat-balanced Draw / Block / Fives matches |
| `node tests/ai-benchmarks/plus.ts race` | Complete Ludo / Ur / Senet endgames |
| `node tests/ai-benchmarks/plus.ts privacy` | Dominoes hidden hand/stock permutations |
| `node tests/ai-benchmarks/race.ts cost old3 2048 all` | 40,960 Ur / Senet matches against the frozen former Challenging policy |
| `node tests/ai-benchmarks/race.ts fidelity` | Travel-cost implementation versus independent prototype |
| `node tests/ai-benchmarks/hop-endings.ts 64` | Chinese and both Halma sizes, exhaustive opponent replies |
| `node tests/ai-benchmarks/camp.ts` | Independent proof of camp rearrangement finishes |
| `node tests/ai-benchmarks/fox.ts` | Independent Fox movement/capture and three-ply outcomes |
| `node tests/ai-benchmarks/tafl-defend.ts` | Proven Hnefatafl defender escape setups |
| `node tests/ai-benchmarks/tafl-attack.ts` | Proven Hnefatafl attacker king-capture setups |

The recorded extended runs used these environment settings where relevant:

```powershell
$env:AI_REPETITIONS = '64'       # Morris: four rotations × 64 repetitions
$env:AI_GO_CASES = '24'
$env:AI_GO_REPETITIONS = '64'
$env:GIN_CASES = '400'
$env:LIFE_CASES = '96'
$env:TRICK_DEALS = '48'          # Four seat rotations: 192 cases
```

Use `AI_REPETITIONS=8` for the recorded Reversi/Kalah/Dots and 24-position Backgammon runs. The card runner accepts a section argument such as `gin`, `cribpeg`, `whist-endings` or `ported-fidelity`; each output describes its exact seeds and objective. Its new run files are ignored; the consolidated audit snapshot is retained in `results/cards-audit.json`.

The browser harness is `../ai-playground.html?bundle`, served through the dev server. Its Run button loads the built offline app in an iframe and exercises actual controllers, workers and animations across all five skills. Use an isolated localhost port so practice positions do not share the user's normal save origin.

Tactical accuracy, exact outcome regret and complete-game scores answer different questions. A solved simple position can tie several levels. Compare each game on its stated battery; these measurements do not assign Elo ratings.
