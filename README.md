# Tiltu’s Games

A collection of 54 browser games, created by **Philip Leichauer** for his daughter and shared so friends can play too.

**[Play Tiltu’s Games](https://lightningphil.github.io/Tiltu-Games/)**

Explore board games, cards, puzzles and arcade games, with five shared themes, computer opponents, hints and saved progress. The collection includes Chess, Draughts, Go, Sudoku, Patience (Klondike, FreeCell and Spider), TetriGrid, Archive Patrol, Neon Void, Whack-a-Party!, Neon Horizon and Neon Synth Ballistics. See the [game guide](GAME_GUIDE.md) for controls, variants and rule choices, or tap **? Game help** inside any game. Every guide includes **Introduction**, **Getting started**, **Tips** and **Full rules**, with section shortcuts and notes on the app’s particular variants.

The home library fits game tiles to your screen, with search, categories, recent games and page controls always close by. **Switch game** opens the same library during play, with no need to scroll through a long menu. Searches for FreeCell, Spider or Klondike open that variant directly.

## Playing and saved progress

Open the play link in a modern browser. There is no account or installation. Computer opponents, graphics, sound and game logic run on your device. Shared-device multiplayer is available in supported games.

Progress and preferences are stored in your browser on this site's origin. They do not sync between devices or browsers. Clearing site data clears saves; private browsing or restricted storage can prevent lasting saves. Saves from a different website or a local file are separate.

The production game is a self-contained `index.html`. You may save an unmodified copy for your own personal offline play under the [license](LICENSE); it needs no internet connection or server once saved. Local-file storage behaviour varies by browser. The hosted site itself is not an installable offline PWA.

## License and ownership

**Copyright © 2026 Philip Leichauer. All rights reserved.**

This is proprietary software. The [custom license](LICENSE) permits free personal, non-commercial play at the official site and an unmodified private offline copy. Share the play link with friends. Republishing, rehosting, selling, distributing copies, or reusing/adapting the original code, artwork or music requires Philip Leichauer's written permission, except where the license, applicable law or GitHub's terms independently permit it.

A public repository makes the source visible; it does not make this collection open source. GitHub users retain the viewing and forking rights provided by [GitHub's terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#d-user-generated-content). Those rights do not amount to general permission to publish a competing site or reuse the original assets.

Third-party components keep their own licenses. See [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt), also embedded in the playable HTML. In particular, the MIT license for Three.js applies to that dependency, not to Tiltu’s Games as a whole. License and permission enquiries can be directed to [LightningPhil on GitHub](https://github.com/LightningPhil).

## Develop and check

Use **Node.js 24 LTS** and npm. Run these commands from this repository's root:

```sh
npm ci
npm run dev
```

To run the regression tests and create the production build:

```sh
npm test
npm run build
npm run preview
```

Vite's development and preview servers are local development tools. They are not needed by the deployed games. `dist_single/index.html` contains the game, with scripts, styles, artwork and browser workers inlined. The output also includes `LICENSE.txt` and `THIRD_PARTY_NOTICES.txt` for convenient reference.

Help content lives in `src/game-help.ts`, with the existing Club Plus variant rules shared from `src/club-plus/rules.ts`. The header help dialog and workspace Help tabs use the same guide. Keep all four sections accurate when adding or changing a game.

The browser tests check every library entry, gameplay, saves, offline play and the `/Tiltu-Games/` hosting path. They verify that every game is reachable without scrolling through both the home library and in-game picker, including search, recent games and returning to saved progress. They exercise all nine Arcade & worlds games and all 45 puzzle, board and card workspaces at phone, landscape and desktop sizes. Checks include legal touch moves, dice, scoring, card passing/bidding/discarding, all Patience and Poker variants, safe board panning, all five themes, independent arcade touch controls and JPG character imports:

```sh
npx playwright install chromium
npm run test:browser
```

Build first. To check the deployed site instead, set `PLAYWRIGHT_BASE_URL=https://lightningphil.github.io/Tiltu-Games/` in your shell before `npm run test:browser`. All browser checks use isolated test profiles and leave your normal saves alone. Extended computer-player benchmarks are documented in [tests/ai-benchmarks/README.md](tests/ai-benchmarks/README.md). Older audit documents and result snapshots record development before this standalone repository; fresh tests are the source of truth for the current revision.

## GitHub Pages

The [Pages workflow](.github/workflows/pages.yml) runs on pushes to `main` and can also be started manually. It installs locked dependencies, runs the regression tests, builds and checks the static output in Chromium, then uploads only `dist_single/` and deploys it using GitHub's Pages actions. Pull requests run the same checks without deployment.

In repository **Settings → Pages**, the source is **GitHub Actions**. The public address is **https://lightningphil.github.io/Tiltu-Games/**. Future pushes to `main` publish automatically after checks pass.

Hosting is entirely static: no backend, database, API key, login service or continuously running Node process. Browser Web Workers perform local calculations; they are not remote services. Optional external rules links open only when followed. Original game artwork and music are generated locally, and runtime libraries are bundled rather than loaded from a CDN.
