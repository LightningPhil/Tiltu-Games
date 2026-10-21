/** Ported from whack-a; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import type { Difficulty, Settings, Stats } from "./game.ts";
import { isCharacter } from "./game.ts";

export interface RecordEntry {
  id: string;
  name: string;
  score: number;
  difficulty: Difficulty;
  character: Settings["character"];
  accuracy: number;
  bestStreak: number;
  characterName?: string;
}
const SCORE_KEY = "whack-a-party.scores.v1";
const SETTINGS_KEY = "whack-a-party.settings.v1";
let memoryScores: RecordEntry[] = [];
let scoresLoaded = false;
let memorySettings: Partial<Settings> & { sound?: boolean; name?: string; music?: boolean; volume?: number } = {};

function read(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function loadSettings() {
  const value = read(SETTINGS_KEY);
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : memorySettings;
  return {
    character: isCharacter(candidate.character) ? candidate.character : "mixed",
    difficulty: ["relaxed", "arcade", "turbo"].includes(String(candidate.difficulty)) ? candidate.difficulty as Difficulty : "arcade",
    mode: candidate.mode === "practice" ? "practice" as const : "timed" as const,
    sound: typeof candidate.sound === "boolean" ? candidate.sound : true,
    music: typeof candidate.music === "boolean" ? candidate.music : true,
    volume: typeof candidate.volume === "number" && Number.isFinite(candidate.volume) ? Math.max(0, Math.min(1, candidate.volume)) : .65,
    name: typeof candidate.name === "string" ? candidate.name.slice(0, 16) : "Player",
    attemptsPerPop: candidate.attemptsPerPop === 1 ? 1 as const : 2 as const,
  };
}

export function saveSettings(value: ReturnType<typeof loadSettings>) {
  memorySettings = { ...value };
  write(SETTINGS_KEY, memorySettings);
}

export function loadScores(): RecordEntry[] {
  if (scoresLoaded) return memoryScores;
  scoresLoaded = true;
  const value = read(SCORE_KEY);
  if (!Array.isArray(value)) return memoryScores;
  // Treat storage as untrusted. Names are always rendered with textContent.
  memoryScores = value.filter((entry): entry is RecordEntry => Boolean(entry) && typeof entry === "object"
    && typeof entry.id === "string" && typeof entry.name === "string" && entry.name.length <= 16
    && Number.isSafeInteger(entry.score) && entry.score >= 0
    && ["relaxed", "arcade", "turbo"].includes(entry.difficulty)
    && isCharacter(entry.character)
    && (entry.characterName === undefined || (typeof entry.characterName === "string" && entry.characterName.length <= 24))
    && Number.isFinite(entry.accuracy) && Number.isFinite(entry.bestStreak));
  return memoryScores;
}

export function topScores(difficulty: Difficulty) {
  return loadScores().filter(entry => entry.difficulty === difficulty).sort((a, b) => b.score - a.score).slice(0, 5);
}

export function saveScore(id: string, name: string, settings: Settings, stats: Stats, characterName?: string) {
  if (settings.mode === "practice") return true;
  const entry: RecordEntry = {
    id, name: name.trim().slice(0, 16) || "Player", score: stats.score,
    difficulty: settings.difficulty, character: settings.character,
    accuracy: stats.attempts ? Math.round(stats.hits / stats.attempts * 100) : 0, bestStreak: stats.bestStreak,
    ...(characterName ? { characterName: characterName.slice(0, 24) } : {}),
  };
  const entries = [...loadScores().filter(score => score.id !== id), entry];
  memoryScores = (["relaxed", "arcade", "turbo"] as Difficulty[]).flatMap(difficulty =>
    entries.filter(score => score.difficulty === difficulty).sort((a, b) => b.score - a.score).slice(0, 5));
  return write(SCORE_KEY, memoryScores);
}

export function legacyScores() {
  return [
    ["Bunnies", "whackBunnyScores"], ["Giraffe", "whackGiraffeScores"],
    ["Unicorn", "whackUnicornScores"], ["Zoo", "whackZooScores"],
  ].flatMap(([game, key]) => {
    const value = read(key);
    if (!Array.isArray(value)) return [];
    return value.filter(entry => entry && typeof entry.name === "string" && Number.isFinite(entry.score) && entry.score >= 0)
      .slice(0, 5).map(entry => ({ game, name: entry.name.slice(0, 16), score: entry.score }));
  });
}
