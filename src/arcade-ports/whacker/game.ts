/** Ported from whack-a; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
export const ANIMALS = ["bunny", "giraffe", "unicorn", "monkey", "rhino", "dog", "mole", "kitten"] as const;
export type Animal = typeof ANIMALS[number];
export type CustomCharacterId = `custom:${string}`;
export type PlayableCharacter = Animal | CustomCharacterId;
export type Character = PlayableCharacter | "mixed";
export const MISS_DELAY = 180;
export function isCustomCharacter(value: unknown): value is CustomCharacterId {
  return typeof value === "string" && /^custom:[a-z0-9-]{1,64}$/.test(value);
}
export function isCharacter(value: unknown): value is Character {
  return value === "mixed" || ANIMALS.includes(value as Animal) || isCustomCharacter(value);
}
export type Difficulty = "relaxed" | "arcade" | "turbo";
export type Mode = "timed" | "practice";
export type TargetKind = "normal" | "party" | "crown" | "sleepy";
export type Phase = "idle" | "countdown" | "playing" | "paused" | "finished";

export const DIFFICULTIES = {
  relaxed: { label: "Relaxed", description: "Room to find your rhythm", interval: 1050, lifetime: 1900, maxActive: 2, ramp: 0.2 },
  arcade: { label: "Arcade", description: "A little faster, a little busier", interval: 760, lifetime: 1500, maxActive: 3, ramp: 0.3 },
  turbo: { label: "Turbo", description: "Quick hands. Big combos.", interval: 510, lifetime: 1150, maxActive: 4, ramp: 0.32 },
} as const;

export interface Settings { character: Character; difficulty: Difficulty; mode: Mode; attemptsPerPop?: 1 | 2 }
export interface Target {
  id: number;
  hole: number;
  animal: PlayableCharacter;
  kind: TargetKind;
  born: number;
  expires: number;
  ready: number;
}
export interface Stats {
  score: number;
  hits: number;
  attempts: number;
  escaped: number;
  sleepyHits: number;
  streak: number;
  bestStreak: number;
  reactionTotal: number;
}
export type GameEvent =
  | { type: "spawn"; target: Target }
  | { type: "hit"; target: Target; points: number }
  | { type: "miss"; hole: number; reason: "empty" | "sleepy" }
  | { type: "escape"; target: Target }
  | { type: "fever" }
  | { type: "finish" };

const freshStats = (): Stats => ({ score: 0, hits: 0, attempts: 0, escaped: 0, sleepyHits: 0, streak: 0, bestStreak: 0, reactionTotal: 0 });

/** One clock owns spawns, expiry, fever and the round deadline. No delayed callbacks survive a restart. */
export class WhackGame {
  settings: Settings;
  phase: Phase = "idle";
  elapsed = 0;
  countdown = 3000;
  stats = freshStats();
  targets: (Target | null)[] = Array(9).fill(null);
  cooldowns: number[] = Array(9).fill(0);
  feverUntil = 0;
  attemptsLeft = 0;
  nextAttemptAt = 0;
  private nextSpawn = 0;
  private lastHole = -1;
  private nextId = 0;
  private resumePhase: "playing" | "countdown" = "playing";
  private random: () => number;
  private events: GameEvent[] = [];
  readonly duration = 60_000;

  constructor(settings: Settings, random: () => number = Math.random) {
    this.settings = { ...settings };
    this.random = random;
  }

  get remaining() { return Math.max(0, this.duration - this.elapsed); }
  get fever() { return this.phase === "playing" && this.feverUntil > this.elapsed; }
  get multiplier() { return Math.min(4, 1 + Math.floor(this.stats.streak / 5)); }
  get accuracy() { return this.stats.attempts ? Math.round(this.stats.hits / this.stats.attempts * 100) : 0; }
  get tapAllowance() { return this.settings.attemptsPerPop === 1 ? 1 : 2; }
  get hasReadyTarget() { return this.targets.some(target => target && target.ready <= this.elapsed && target.expires > this.elapsed); }

  start() {
    this.elapsed = 0;
    this.countdown = 3000;
    this.stats = freshStats();
    this.targets.fill(null);
    this.cooldowns.fill(0);
    this.feverUntil = 0;
    this.attemptsLeft = 0;
    this.nextAttemptAt = 0;
    this.nextSpawn = 0;
    this.lastHole = -1;
    this.events = [];
    this.phase = "countdown";
  }

  pause() {
    if (this.phase !== "playing" && this.phase !== "countdown") return;
    this.resumePhase = this.phase;
    this.phase = "paused";
  }

  resume() {
    if (this.phase !== "paused") return;
    this.phase = this.resumePhase;
  }

  finish() {
    if (this.phase === "finished" || this.phase === "idle") return;
    this.phase = "finished";
    this.targets.fill(null);
    this.events.push({ type: "finish" });
  }

  advance(ms: number) {
    if (!Number.isFinite(ms) || ms < 0) return;
    if (this.phase === "countdown") {
      this.countdown -= ms;
      if (this.countdown > 0) return;
      // The first target always gets its full reaction window, even after a slow frame.
      this.phase = "playing";
      ms = 0;
    }
    if (this.phase !== "playing") return;
    this.elapsed += ms;
    if (this.settings.mode === "timed" && this.elapsed >= this.duration) {
      this.elapsed = this.duration;
      this.finish();
      return;
    }
    for (const target of this.targets) {
      if (target && target.expires <= this.elapsed) {
        this.targets[target.hole] = null;
        this.cooldowns[target.hole] = this.elapsed + 170;
        if (target.kind !== "sleepy") {
          this.stats.escaped++;
          this.stats.streak = 0;
          this.events.push({ type: "escape", target });
        }
      }
    }
    if (this.elapsed >= this.nextSpawn) this.spawn();
  }

  whack(hole: number) {
    if (this.phase !== "playing" || !Number.isInteger(hole) || hole < 0 || hole > 8) return;
    const target = this.targets[hole];
    // A board-wide budget stops sweeping nine holes (or using several fingers) to fish for a hit.
    // New pop-ups and successful hits refresh the allowance. Rejected taps are never queued or counted.
    if (!this.hasReadyTarget || this.attemptsLeft <= 0 || this.elapsed < this.nextAttemptAt) return;
    // Ignore a second input on a freshly hit well and the short rise animation.
    if (this.cooldowns[hole] > this.elapsed || (target && target.ready > this.elapsed)) return;
    this.stats.attempts++;
    if (!target || target.kind === "sleepy") {
      this.attemptsLeft--;
      this.nextAttemptAt = this.elapsed + MISS_DELAY;
      if (target) {
        this.targets[hole] = null;
        this.stats.sleepyHits++;
        this.stats.score = Math.max(0, this.stats.score - 20);
      }
      this.cooldowns[hole] = this.elapsed + 220;
      this.stats.streak = 0;
      this.events.push({ type: "miss", hole, reason: target ? "sleepy" : "empty" });
      return;
    }
    this.targets[hole] = null;
    this.cooldowns[hole] = this.elapsed + 220;
    // Reward accurate play: another visible character can be hit immediately, in either tap mode.
    this.attemptsLeft = this.tapAllowance;
    this.nextAttemptAt = 0;
    this.stats.hits++;
    this.stats.streak++;
    this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);
    this.stats.reactionTotal += this.elapsed - target.ready;
    const base = target.kind === "crown" ? 30 : target.kind === "party" ? 20 : 10;
    const points = base * this.multiplier * (this.fever ? 2 : 1);
    this.stats.score += points;
    this.events.push({ type: "hit", target, points });
    if (this.stats.streak % 15 === 0 && !this.fever) {
      this.feverUntil = this.elapsed + 6000;
      this.events.push({ type: "fever" });
    }
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  private spawn() {
    const config = DIFFICULTIES[this.settings.difficulty];
    const progress = this.settings.mode === "practice" ? 0 : Math.min(1, this.elapsed / this.duration);
    const pace = 1 - progress * config.ramp;
    this.nextSpawn = this.elapsed + config.interval * pace * (0.85 + this.random() * 0.3);
    const active = this.targets.filter(Boolean).length;
    if (active >= config.maxActive) return;
    let available = this.targets.flatMap((target, hole) => !target && this.cooldowns[hole] <= this.elapsed ? [hole] : []);
    if (available.length > 1) available = available.filter(hole => hole !== this.lastHole);
    if (!available.length) return;
    const hole = available[Math.floor(this.random() * available.length)];
    const roll = this.random();
    const kind: TargetKind = this.elapsed > 8000 && roll < 0.12 ? "sleepy" : roll > 0.9 ? "crown" : roll > 0.7 ? "party" : "normal";
    const animal = this.settings.character === "mixed" ? ANIMALS[Math.floor(this.random() * ANIMALS.length)] : this.settings.character;
    // Every character uses exactly the same lifetime and scoring rules.
    const lifetime = Math.max(650, config.lifetime * pace * (kind === "crown" ? 0.8 : 1));
    const target = { id: ++this.nextId, hole, animal, kind, born: this.elapsed, ready: this.elapsed + 90, expires: this.elapsed + lifetime + 90 };
    this.targets[hole] = target;
    this.attemptsLeft = this.tapAllowance;
    this.lastHole = hole;
    this.events.push({ type: "spawn", target });
  }
}
