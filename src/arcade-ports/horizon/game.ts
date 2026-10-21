/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { DIFFICULTIES, FLIGHT, clamp, awardKill, type Difficulty, type Point } from './flight.ts';
import { DEFAULT_MUSIC_TRACK, isMusicTrack, type MusicTrackId } from './soundtrack.ts';

export type Mode = 'mission' | 'endless' | 'practice' | 'cruise';
export type Controls = 'keyboard' | 'mouse' | 'flightstick' | 'gamepad' | 'touch';
export type VisualStyle = 'neon' | 'retro';
export const SECTORS = [
    { name: 'NEON MILE', objective: 'Clear 6 scout drones', quota: 6, color: 0x00d9ff },
    { name: 'CROSSFIRE', objective: 'Clear 8 hostile drones', quota: 8, color: 0xb56cff },
    { name: 'THE SENTINEL', objective: 'Bring down the command ship', quota: 1, color: 0xff526b },
] as const;
export const ENEMIES = [
    { name: 'SCOUT', color: 0xffb65c, health: 1, score: 100, scale: 2.3, speed: 32, fireInterval: 0 },
    { name: 'STRIKER', color: 0x62e9ff, health: 2, score: 220, scale: 2, speed: 48, fireInterval: 5.8 },
    { name: 'WARDEN', color: 0xff638f, health: 3, score: 360, scale: 2.1, speed: 30, fireInterval: 4.6 },
] as const;
export const ENERGY = { boostDrain: 27, recovery: 18, delay: 0.65, pulseCost: 45, pulseCooldown: 7, pulseRadius: 260 } as const;
export function sentinelCruise(difficulty: Difficulty, distanceAlong: number) {
    const cruise = DIFFICULTIES[difficulty].speed;
    return clamp(cruise * 0.9 + (380 - distanceAlong) * 0.5, 15, cruise * 1.15);
}
export interface EnergyState { amount: number; rechargeDelay: number; locked: boolean; pulseCooldown: number }
export function createEnergy(): EnergyState { return { amount: 100, rechargeDelay: 0, locked: false, pulseCooldown: 0 }; }
export function tickEnergy(energy: EnergyState, dt: number, requested: boolean) {
    energy.pulseCooldown = Math.max(0, energy.pulseCooldown - dt);
    if (!requested && energy.amount >= 12) energy.locked = false;
    const boosting = requested && !energy.locked && energy.amount > 0;
    if (boosting) {
        energy.amount = Math.max(0, energy.amount - ENERGY.boostDrain * dt);
        energy.rechargeDelay = ENERGY.delay;
        if (energy.amount === 0) energy.locked = true;
    } else {
        const recoveryTime = Math.max(0, dt - energy.rechargeDelay);
        energy.rechargeDelay = Math.max(0, energy.rechargeDelay - dt);
        energy.amount = Math.min(100, energy.amount + ENERGY.recovery * recoveryTime);
    }
    return boosting;
}
export function usePulse(energy: EnergyState) {
    if (energy.amount < ENERGY.pulseCost || energy.pulseCooldown > 0) return false;
    energy.amount -= ENERGY.pulseCost; energy.pulseCooldown = ENERGY.pulseCooldown; energy.rechargeDelay = ENERGY.delay;
    return true;
}
export interface Run {
    mode: Mode; difficulty: Difficulty; seed: number; elapsed: number; remaining: number; extraTime: number;
    sector: number; sectorKills: number; kills: number; score: number; streak: number; multiplier: number;
    combo: number; bestStreak: number; shields: number; damageAge: number; invulnerable: number;
    shots: number; hits: number; gates: number; nearMisses: number; dodges: number; damageTaken: number; pulses: number;
    energy: EnergyState; outcome: 'flying' | 'victory' | 'crashed' | 'timeout' | 'retired'; bonus: number;
}
export function createRun(mode: Mode, difficulty: Difficulty, seed: number): Run {
    return { mode, difficulty, seed: seed >>> 0, elapsed: 0, remaining: DIFFICULTIES[difficulty].missionTime,
        extraTime: 0, sector: 0, sectorKills: 0, kills: 0, score: 0, streak: 0, multiplier: 1,
        combo: 0, bestStreak: 0, shields: 100, damageAge: 0, invulnerable: 2, shots: 0, hits: 0,
        gates: 0, nearMisses: 0, dodges: 0, damageTaken: 0, pulses: 0, energy: createEnergy(), outcome: 'flying', bonus: 0 };
}
export function tickRun(run: Run, dt: number) {
    if (run.outcome !== 'flying') return;
    run.elapsed += dt; run.damageAge += dt; run.invulnerable = Math.max(0, run.invulnerable - dt);
    run.combo = Math.max(0, run.combo - dt);
    if (run.combo === 0) { run.streak = 0; run.multiplier = 1; }
    if (run.damageAge > 6) run.shields = Math.min(100, run.shields + Math.min(dt, run.damageAge - 6) * 2);
    if (run.mode === 'mission') {
        run.remaining = Math.max(0, run.remaining - dt);
        if (run.remaining === 0) run.outcome = 'timeout';
    }
}
export function damageRun(run: Run, amount: number, collision = false) {
    if (run.outcome !== 'flying' || run.invulnerable > 0) return false;
    if (run.mode === 'practice' || run.mode === 'cruise') { run.invulnerable = 0.8; return false; }
    const applied = Math.min(run.shields, amount);
    run.shields -= applied; run.damageTaken += applied; run.damageAge = 0;
    run.invulnerable = collision ? 1.35 : 0.72;
    run.combo = run.streak = 0; run.multiplier = 1;
    if (run.shields <= 0) run.outcome = 'crashed';
    return true;
}
export function killReward(run: Run, base: number, boss = false) {
    if (run.outcome !== 'flying') return { points: 0, advanced: false };
    const reward = awardKill(base, run.streak, run.combo);
    run.score += reward.points; run.streak = reward.streak; run.multiplier = reward.multiplier;
    run.bestStreak = Math.max(run.bestStreak, run.streak); run.combo = FLIGHT.comboWindow;
    run.kills++; run.sectorKills++; run.shields = Math.min(100, run.shields + (boss ? 15 : 3));
    if (boss && run.mode === 'mission') {
        run.bonus = Math.round(run.remaining * 5 + run.shields * 10);
        run.score += run.bonus; run.outcome = 'victory';
        return { points: reward.points, advanced: false };
    }
    const quota = run.mode === 'mission' ? SECTORS[run.sector].quota : 6 + run.sector * 2;
    const advanced = run.mode !== 'practice' && run.sectorKills >= quota && (run.mode !== 'mission' || run.sector < 2);
    if (advanced) { run.sector = Math.min(run.sector + 1, run.mode === 'mission' ? 2 : 7); run.sectorKills = 0; }
    return { points: reward.points, advanced };
}
export function gateReward(run: Run) {
    if (run.outcome !== 'flying') return 0;
    run.gates++; run.shields = Math.min(100, run.shields + 18); run.energy.amount = Math.min(100, run.energy.amount + 55);
    const extra = run.mode === 'mission' ? Math.min(5, 30 - run.extraTime) : 0;
    run.remaining += extra; run.extraTime += extra;
    run.combo = Math.max(run.combo, 4);
    const points = 150 * run.multiplier; run.score += points; return points;
}
export function nearMissReward(run: Run, boosted: boolean) {
    if (run.outcome !== 'flying') return 0;
    const points = (boosted ? 100 : 50) * run.multiplier;
    run.nearMisses++; run.score += points; run.energy.amount = Math.min(100, run.energy.amount + 6); return points;
}
export function dodgeReward(run: Run) {
    if (run.outcome !== 'flying' || run.mode === 'practice') return 0;
    const points = 75 * run.multiplier;
    run.dodges++; run.score += points; run.energy.amount = Math.min(100, run.energy.amount + 8);
    run.combo = Math.max(run.combo, 2);
    return points;
}
export function rankRun(run: Run) {
    if (run.mode === 'practice') return 'FLIGHT SCHOOL';
    if (run.mode === 'cruise') return 'FREE FLIGHT';
    if (run.outcome !== 'victory' && run.mode === 'mission') return run.sector > 0 ? 'KEEP FLYING' : 'TRY AGAIN';
    const accuracy = run.shots ? run.hits / run.shots : 0;
    const rating = run.score + accuracy * 1800 + run.shields * 8;
    return rating >= 18000 ? 'S' : rating >= 12500 ? 'A' : rating >= 8500 ? 'B' : 'C';
}
export function shapeAxis(value: number, deadzone = 0.12) {
    if (!Number.isFinite(value) || Math.abs(value) <= deadzone) return 0;
    return Math.sign(value) * ((Math.min(1, Math.abs(value)) - deadzone) / (1 - deadzone)) ** 1.6;
}
export function crossesGate(start: Point, end: Point, center: Point, normal: Point, radius: number) {
    const dot = (p: Point) => (p.x - center.x) * normal.x + (p.y - center.y) * normal.y + (p.z - center.z) * normal.z;
    const a = dot(start), b = dot(end);
    if (a * b > 0 || Math.abs(a - b) < 1e-9) return false;
    const t = a / (a - b);
    const x = start.x + (end.x - start.x) * t - center.x;
    const y = start.y + (end.y - start.y) * t - center.y;
    const z = start.z + (end.z - start.z) * t - center.z;
    return x * x + y * y + z * z <= radius * radius;
}
export function randomSource(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let value = Math.imul(state ^ state >>> 15, 1 | state);
        value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}
export interface Settings {
    difficulty: Difficulty; mode: Mode; controls: Controls; sensitivity: number; stabilized: boolean;
    aimAssist: boolean; autoFire: boolean; sound: boolean; music: boolean; reducedMotion: boolean; invertY: boolean; pilot: string;
    quality: 'cinematic' | 'performance'; view: 'cockpit' | 'clear' | 'chase'; musicVolume: number; effectsVolume: number;
    cruiseSpeed: number;
    visualStyle: VisualStyle;
    musicTrack: MusicTrackId;
}
export function parseSettings(raw: string | null, prefersReducedMotion = false, touchControls = false): Settings {
    const settings: Settings = { difficulty: 'arcade', mode: 'mission', controls: touchControls ? 'touch' : 'flightstick', sensitivity: 1,
        stabilized: true, aimAssist: true, autoFire: touchControls, sound: true, music: true, reducedMotion: prefersReducedMotion, invertY: false, pilot: 'ACE',
        quality: touchControls ? 'performance' : 'cinematic', view: 'cockpit', musicVolume: .48, effectsVolume: .8, cruiseSpeed: 95, visualStyle: 'neon', musicTrack: DEFAULT_MUSIC_TRACK };
    try {
        const stored = JSON.parse(raw || '{}');
        if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return settings;
        if (Object.hasOwn(DIFFICULTIES, stored.difficulty)) settings.difficulty = stored.difficulty;
        if (['mission', 'endless', 'practice', 'cruise'].includes(stored.mode)) settings.mode = stored.mode;
        if (['keyboard', 'mouse', 'flightstick', 'gamepad', 'touch'].includes(stored.controls)) settings.controls = stored.controls;
        if (['neon', 'retro'].includes(stored.visualStyle)) settings.visualStyle = stored.visualStyle;
        if (isMusicTrack(stored.musicTrack)) settings.musicTrack = stored.musicTrack;
        if (Number.isFinite(stored.sensitivity)) settings.sensitivity = clamp(stored.sensitivity, 0.6, 1.5);
        if (['cinematic', 'performance'].includes(stored.quality)) settings.quality = stored.quality;
        if (['cockpit', 'clear', 'chase'].includes(stored.view)) settings.view = stored.view;
        for (const key of ['musicVolume', 'effectsVolume'] as const) if (Number.isFinite(stored[key])) settings[key] = clamp(stored[key], 0, 1);
        if (Number.isFinite(stored.cruiseSpeed)) settings.cruiseSpeed = clamp(stored.cruiseSpeed, 60, 150);
        if (typeof stored.pilot === 'string') settings.pilot = stored.pilot.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 3) || 'ACE';
        for (const key of ['stabilized', 'aimAssist', 'autoFire', 'sound', 'music', 'reducedMotion', 'invertY'] as const) if (typeof stored[key] === 'boolean') settings[key] = stored[key];
    } catch { /* Bad preferences never prevent a flight. */ }
    return settings;
}
export type Score = { name: string; score: number; rank: string; seed: number; won: boolean; id: string };
export function parseScores(raw: string | null): Score[] {
    try {
        const data = JSON.parse(raw || '[]');
        return Array.isArray(data) ? data.filter(s => s && typeof s.name === 'string' && Number.isFinite(s.score) && s.score >= 0)
            .map(s => ({ name: s.name.replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase() || 'ACE', score: Math.floor(s.score),
                rank: ['S', 'A', 'B', 'C'].includes(s.rank) ? s.rank : '—', seed: Number.isFinite(s.seed) ? s.seed >>> 0 : 0, won: s.won === true, id: typeof s.id === 'string' ? s.id.slice(0, 64) : '' }))
            .sort((a, b) => b.score - a.score).slice(0, 5) : [];
    } catch { return []; }
}
