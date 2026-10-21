import { test } from "node:test";
import assert from "node:assert/strict";
import type { Settings, Stats } from "../src/arcade-ports/whacker/game.ts";

let moduleId = 0;
async function store(values: Record<string, string> = {}, blocked = false) {
  const data = new Map(Object.entries(values));
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem(key: string) { return data.get(key) ?? null; },
    setItem(key: string, value: string) { if (blocked) throw new Error("Storage blocked"); data.set(key, value); },
  } });
  return { api: await import(`../src/arcade-ports/whacker/storage.ts?test=${++moduleId}`), data };
}
const settings: Settings = { character: "mixed", difficulty: "arcade", mode: "timed" };
const stats: Stats = { score: 200, hits: 8, attempts: 10, escaped: 3, sleepyHits: 1, streak: 0, bestStreak: 6, reactionTotal: 800 };

test("malformed storage and preferences recover to safe defaults", async () => {
  const { api } = await store({ "whack-a-party.scores.v1": "invalid json", "whack-a-party.settings.v1": '{"character":"dragon","difficulty":"impossible","sound":"yes"}' });
  assert.deepEqual(api.loadScores(), []);
  assert.equal(api.loadSettings().character, "mixed");
  assert.equal(api.loadSettings().difficulty, "arcade");
  assert.equal(api.loadSettings().sound, true);
});

test("leaderboards keep five scores per difficulty and rename a round without duplicating it", async () => {
  const { api } = await store();
  for (let i = 1; i <= 8; i++) api.saveScore(`round-${i}`, "Player", settings, { ...stats, score: i * 100 });
  api.saveScore("relaxed-round", "Other", { ...settings, difficulty: "relaxed" }, { ...stats, score: 9999 });
  api.saveScore("round-8", " Renamed ", settings, { ...stats, score: 800 });
  assert.equal(api.topScores("arcade").length, 5);
  assert.equal(api.topScores("arcade")[0].name, "Renamed");
  assert.equal(api.topScores("arcade")[0].score, 800);
  assert.equal(api.topScores("arcade")[0].accuracy, 80);
  assert.equal(api.topScores("relaxed")[0].score, 9999);
  assert.equal(api.loadScores().filter((score: { id: string }) => score.id === "round-8").length, 1);
});

test("practice never enters the leaderboard, and blocked writes retain scores for this visit", async () => {
  const { api } = await store({}, true);
  api.saveScore("practice", "Player", { ...settings, mode: "practice" }, stats);
  assert.deepEqual(api.loadScores(), []);
  assert.equal(api.saveScore("timed", "Player", settings, stats), false);
  assert.equal(api.topScores("arcade")[0].score, 200);
  api.saveSettings({ ...settings, name: "Remembered", sound: false });
  assert.equal(api.loadSettings().name, "Remembered");
});

test("existing stored records survive a failed write and new results remain visible", async () => {
  const { api } = await store({ "whack-a-party.scores.v1": JSON.stringify([{ id: "old", name: "Old", ...settings, score: 100, accuracy: 60, bestStreak: 2 }]) }, true);
  api.saveScore("new", "New", settings, stats);
  assert.equal(api.topScores("arcade").length, 2);
  assert.equal(api.topScores("arcade")[0].name, "New");
});

test("legacy score keys stay untouched and old scores are kept separate", async () => {
  const original = JSON.stringify([{ name: "Original", score: 55 }]);
  const { api, data } = await store({ whackBunnyScores: original, whackZooScores: "bad json" });
  assert.deepEqual(api.legacyScores(), [{ game: "Bunnies", name: "Original", score: 55 }]);
  api.saveScore("new", "New", settings, stats);
  assert.equal(data.get("whackBunnyScores"), original);
  assert.equal(api.topScores("arcade")[0].score, 200);
});
