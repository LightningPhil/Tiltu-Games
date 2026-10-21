import { test } from "node:test";
import assert from "node:assert/strict";
import { ANIMALS, DIFFICULTIES, MISS_DELAY, WhackGame } from "../src/arcade-ports/whacker/game.ts";
import type { Character, Difficulty, Settings } from "../src/arcade-ports/whacker/game.ts";

const settings: Settings = { character: "bunny", difficulty: "arcade", mode: "timed" };
function playing(character: Character = "bunny", difficulty: Difficulty = "arcade", random = () => 0.5) {
  const game = new WhackGame({ ...settings, character, difficulty }, random);
  game.start(); game.advance(3000); game.advance(90);
  return game;
}
function hitNext(game: WhackGame) {
  for (let attempts = 0; attempts < 300; attempts++) {
    const target = game.targets.find(target => target && target.ready <= game.elapsed && target.kind !== "sleepy");
    if (target) { game.whack(target.hole); return target; }
    game.advance(20);
  }
  throw new Error("No hittable target spawned");
}

test("a countdown protects the first target and prevents early scoring", () => {
  const game = new WhackGame(settings);
  game.start(); game.advance(2999); game.whack(1);
  assert.equal(game.phase, "countdown");
  assert.equal(game.stats.attempts, 0);
  assert.ok(game.targets.every(target => !target));
  game.advance(10000);
  assert.equal(game.elapsed, 0);
  assert.equal(game.phase, "playing");
  assert.equal(game.targets.filter(Boolean).length, 1);
});

test("all eight character choices have identical scoring, timing and hit windows", () => {
  const runs = ANIMALS.map(animal => {
    const game = playing(animal);
    const first = game.targets.find(Boolean)!;
    assert.equal(first.animal, animal);
    for (let hit = 0; hit < 20; hit++) hitNext(game);
    return { stats: game.stats, elapsed: game.elapsed, feverUntil: game.feverUntil };
  });
  runs.forEach(run => assert.deepEqual(run, runs[0]));
});

test("mixed selection can spawn every animal", () => {
  const seen = new Set();
  for (const [index, animal] of ANIMALS.entries()) {
    const rolls = [0.5, 0.5, 0.5, (index + 0.1) / ANIMALS.length];
    const game = playing("mixed", "arcade", () => rolls.shift() ?? 0.5);
    const target = game.targets.find(Boolean)!;
    assert.equal(target.animal, animal);
    seen.add(target.animal);
  }
  assert.equal(seen.size, ANIMALS.length);
});

test("a target can score once; rising, hidden and finished targets cannot be hit", () => {
  const game = new WhackGame(settings, () => 0.5);
  game.whack(4);
  game.start(); game.advance(3000);
  const target = game.targets.find(Boolean)!;
  game.whack(target.hole);
  assert.equal(game.stats.hits, 0);
  game.advance(90); game.whack(target.hole); game.whack(target.hole);
  assert.equal(game.stats.score, 10);
  assert.equal(game.stats.attempts, 1);
  game.finish(); game.whack(target.hole);
  assert.equal(game.stats.score, 10);
});

test("party hats and crowns award their advertised base points", () => {
  for (const [roll, kind, points] of [[0.5, "normal", 10], [0.8, "party", 20], [0.95, "crown", 30]] as const) {
    const game = playing("giraffe", "arcade", () => roll);
    const target = game.targets.find(Boolean)!;
    assert.equal(target.kind, kind);
    game.whack(target.hole);
    assert.equal(game.stats.score, points);
  }
});

test("streaks build to ×4, unlock six-second fever, and reset on an empty bonk", () => {
  const game = playing();
  for (let hit = 0; hit < 15; hit++) hitNext(game);
  assert.equal(game.multiplier, 4);
  assert.equal(game.stats.bestStreak, 15);
  assert.equal(game.fever, true);
  const before = game.stats.score;
  hitNext(game);
  assert.equal(game.stats.score - before, 80);
  while (!game.hasReadyTarget) game.advance(20);
  game.advance(MISS_DELAY);
  game.whack(game.targets.findIndex((target, hole) => !target && game.cooldowns[hole] <= game.elapsed));
  assert.equal(game.stats.streak, 0);
  assert.equal(game.multiplier, 1);
  assert.equal(game.stats.bestStreak, 16);
  game.advance(6000);
  assert.equal(game.fever, false);
});

test("escaping a normal target breaks a streak; leaving a sleeper does not", () => {
  const game = playing();
  hitNext(game);
  game.advance(800);
  const target = game.targets.find(Boolean)!;
  game.advance(target.expires - game.elapsed);
  assert.equal(game.stats.escaped, 1);
  assert.equal(game.stats.streak, 0);
  const sleeperGame = playing("bunny", "relaxed", () => 0.05);
  while (sleeperGame.elapsed < 9000) {
    sleeperGame.advance(20);
    const normal = sleeperGame.targets.find(target => target && target.kind !== "sleepy" && target.ready <= sleeperGame.elapsed);
    if (normal) sleeperGame.whack(normal.hole);
  }
  let sleepy = sleeperGame.targets.find(target => target?.kind === "sleepy");
  while (!sleepy) { sleeperGame.advance(20); sleepy = sleeperGame.targets.find(target => target?.kind === "sleepy"); }
  const streak = sleeperGame.stats.streak;
  sleeperGame.advance(sleepy.expires - sleeperGame.elapsed);
  assert.equal(sleeperGame.stats.streak, streak);
});

test("sleepy bonks cost 20, reset streak, and never make the score negative", () => {
  const game = playing("dog", "arcade", () => 0.05);
  game.advance(9000);
  const sleepy = game.targets.find(Boolean)!;
  assert.equal(sleepy.kind, "sleepy");
  game.advance(90); game.whack(sleepy.hole);
  assert.equal(game.stats.sleepyHits, 1);
  assert.equal(game.stats.hits, 0);
  assert.equal(game.stats.attempts, 1);
  assert.equal(game.stats.score, 0);
});

test("pause freezes the round, active target windows and fever", () => {
  const game = playing();
  for (let i = 0; i < 15; i++) hitNext(game);
  game.advance(800);
  const snapshot = JSON.stringify({ targets: game.targets, stats: game.stats, elapsed: game.elapsed, feverUntil: game.feverUntil });
  game.pause(); game.advance(90000); game.whack(1);
  assert.equal(JSON.stringify({ targets: game.targets, stats: game.stats, elapsed: game.elapsed, feverUntil: game.feverUntil }), snapshot);
  game.resume();
  assert.equal(game.phase, "playing");
  game.advance(100);
  assert.ok(game.elapsed > JSON.parse(snapshot).elapsed);
});

test("the deadline wins over spawns and late hits, and finish fires once", () => {
  const game = playing();
  game.drainEvents();
  game.advance(59900);
  assert.equal(game.phase, "playing");
  game.advance(10);
  assert.equal(game.phase, "finished");
  assert.equal(game.elapsed, 60000);
  assert.ok(game.targets.every(target => !target));
  game.whack(1); game.advance(9000); game.finish();
  assert.equal(game.stats.score, 0);
  assert.equal(game.drainEvents().filter(event => event.type === "finish").length, 1);
});

test("restart resets all round state and drops old events", () => {
  const game = playing();
  for (let i = 0; i < 16; i++) hitNext(game);
  game.pause(); game.start();
  assert.equal(game.phase, "countdown");
  assert.equal(game.elapsed, 0);
  assert.equal(game.stats.score, 0);
  assert.equal(game.stats.bestStreak, 0);
  assert.equal(game.feverUntil, 0);
  assert.ok(game.targets.every(target => !target));
  assert.ok(game.cooldowns.every(value => value === 0));
  assert.deepEqual(game.drainEvents(), []);
});

test("difficulty caps concurrent targets and maintains a fair reaction window", () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    const game = playing("rhino", difficulty, () => 0.95);
    for (let frame = 0; frame < 6000; frame++) {
      game.advance(10);
      assert.ok(game.targets.filter(Boolean).length <= DIFFICULTIES[difficulty].maxActive);
      game.targets.filter(Boolean).forEach(target => assert.ok(target!.expires - target!.ready >= 650));
    }
  }
});

test("practice stays untimed and at a steady pace, and can end manually", () => {
  const game = new WhackGame({ ...settings, mode: "practice" }, () => 0.5);
  game.start(); game.advance(3000); game.advance(90000);
  assert.equal(game.phase, "playing");
  const target = game.targets.find(Boolean)!;
  assert.equal(target.expires - target.ready, DIFFICULTIES.arcade.lifetime);
  game.finish();
  assert.equal(game.phase, "finished");
});

test("invalid inputs cannot corrupt the round", () => {
  const game = playing();
  const before = game.elapsed;
  game.advance(NaN); game.advance(Infinity); game.advance(-1);
  for (const hole of [-1, 9, 1.5, NaN]) game.whack(hole);
  assert.equal(game.elapsed, before);
  assert.equal(game.stats.attempts, 0);
});

test("a simultaneous nine-hole sweep counts one miss and cannot fish for a hit", () => {
  const game = playing();
  for (let sweep = 0; sweep < 20; sweep++) for (let hole = 0; hole < 9; hole++) game.whack(hole);
  assert.equal(game.stats.attempts, 1);
  assert.equal(game.stats.hits, 0);
  assert.equal(game.stats.score, 0);
  assert.equal(game.attemptsLeft, 1);
});

test("two-attempt mode gives one delayed retry and a successful hit restores the allowance", () => {
  const game = playing();
  const target = game.targets.find(Boolean)!;
  const wrongHole = (target.hole + 1) % 9;
  game.whack(wrongHole);
  game.advance(MISS_DELAY - 1); game.whack(target.hole);
  assert.equal(game.stats.hits, 0);
  game.advance(1); game.whack(target.hole);
  assert.equal(game.stats.hits, 1);
  assert.equal(game.attemptsLeft, 2);
  game.advance(250);
  for (let hole = 0; hole < 9; hole++) game.whack(hole);
  assert.equal(game.stats.attempts, 2);
  while (!game.hasReadyTarget) game.advance(20);
  assert.equal(game.attemptsLeft, 2);
  hitNext(game);
  assert.equal(game.stats.hits, 2);
});

test("one-attempt mode consumes the chance on a miss, even if the next tap aims correctly", () => {
  const game = new WhackGame({ ...settings, attemptsPerPop: 1 }, () => 0.5);
  game.start(); game.advance(3000); game.advance(90);
  const target = game.targets.find(Boolean)!;
  game.whack((target.hole + 1) % 9);
  game.advance(300); game.whack(target.hole);
  assert.equal(game.stats.attempts, 1);
  assert.equal(game.stats.hits, 0);
  assert.equal(game.attemptsLeft, 0);
});

test("new pop-ups refresh rather than accumulate tap allowance, and restart resets the tap gate", () => {
  const game = playing();
  game.advance(800);
  assert.equal(game.attemptsLeft, 2);
  game.whack(game.targets.findIndex(target => !target));
  game.pause(); game.advance(9999);
  assert.equal(game.nextAttemptAt > game.elapsed, true);
  game.start();
  assert.equal(game.attemptsLeft, 0);
  assert.equal(game.nextAttemptAt, 0);
});

test("custom characters use the same scoring and timing as built-ins", () => {
  const custom = playing("custom:test-person");
  const mole = playing("mole");
  assert.equal(custom.targets.find(Boolean)!.animal, "custom:test-person");
  for (let hit = 0; hit < 20; hit++) { hitNext(custom); hitNext(mole); }
  assert.deepEqual(custom.stats, mole.stats);
  assert.equal(custom.elapsed, mole.elapsed);
});

test("successful hits allow immediate hits on another ready target in both tap modes", () => {
  for (const attemptsPerPop of [1, 2] as const) {
    const game = new WhackGame({ ...settings, attemptsPerPop }, () => 0.5);
    game.start(); game.advance(3000); game.advance(90);
    game.advance(800); game.advance(90);
    const targets = game.targets.filter(target => target && target.ready <= game.elapsed);
    assert.equal(targets.length, 2);
    game.whack(targets[0]!.hole);
    assert.equal(game.nextAttemptAt, 0);
    assert.equal(game.attemptsLeft, attemptsPerPop);
    // No time advances between these hits.
    game.whack(targets[1]!.hole);
    assert.equal(game.stats.hits, 2);
    assert.equal(game.stats.attempts, 2);
    assert.equal(game.stats.score, 20);
    assert.equal(game.attemptsLeft, attemptsPerPop);
    game.whack(targets[0]!.hole);
    assert.equal(game.stats.hits, 2);
    assert.equal(game.stats.attempts, 2);
  }
});

test("a new pop-up never bypasses the shared delay after a miss", () => {
  const game = playing();
  const first = game.targets.find(Boolean)!;
  game.advance(620); game.whack((first.hole + 1) % 9);
  assert.equal(game.stats.hits, 0);
  game.advance(50);
  const next = game.targets.find(Boolean)!;
  assert.notEqual(next.hole, first.hole);
  assert.equal(game.attemptsLeft, 2);
  game.advance(90); game.whack(next.hole);
  game.advance(39); game.whack(next.hole);
  assert.equal(game.stats.hits, 0);
  game.advance(1); game.whack(next.hole);
  assert.equal(game.stats.hits, 1);
  assert.equal(game.nextAttemptAt, 0);
});
