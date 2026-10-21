/** Ported from neon-synth-ballistics; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
// Version 1 is a permanent six-digit-code contract. Keep its dimensions and
// algorithm stable; introduce a separate generator for future map formats.
export const MAP_GENERATOR_VERSION = 1;
export const WIDTH = 1920;
export const HEIGHT = 720;
export const MAP_KINDS = ['ROLLING RIDGE', 'NEON MESAS', 'BROKEN ISLES', 'HOLLOW GROUND'] as const;
export type Spawn = { id: number; team: number; x: number; y: number };
export type GeneratedMap = {
    code: string; version: number; kind: typeof MAP_KINDS[number];
    pixels: Uint8Array; heights: Int16Array; spawns: Spawn[];
};

export function parseMapCode(value: string): string | null {
    const code = value.trim();
    return /^[0-9]{6}$/.test(code) ? code : null;
}

function requireCode(value: string) {
    const code = parseMapCode(value);
    if (!code) throw new RangeError('Map codes must contain exactly six digits.');
    return code;
}

// Integer arithmetic avoids implementation-dependent trigonometric rounding.
function mix32(value: number) {
    let n = value >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
    n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
    return (n ^ (n >>> 15)) >>> 0;
}

function streamSeed(code: string, stream: string) {
    let salt = 2166136261;
    for (const char of stream) salt = Math.imul(salt ^ char.charCodeAt(0), 16777619);
    return mix32(Number(requireCode(code)) ^ salt);
}

// Named streams ensure that adding cosmetic randomness cannot alter terrain
// or spawn positions, and live combat never consumes map-generation state.
export function createSeededRandom(code: string, stream: string) {
    let state = streamSeed(code, stream);
    return () => {
        state = (state + 0x9e3779b9) >>> 0;
        return mix32(state) / 4294967296;
    };
}

export function randomMapCode() {
    if (globalThis.crypto?.getRandomValues) {
        const value = new Uint32Array(1);
        // Rejection sampling avoids favoring low codes through modulo bias.
        const limit = Math.floor(4294967296 / 1000000) * 1000000;
        do { globalThis.crypto.getRandomValues(value); } while (value[0] >= limit);
        return String(value[0] % 1000000).padStart(6, '0');
    }
    // Only choosing a new code needs entropy; generation itself is always seeded.
    return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

function lerp(a: number, b: number, t: number) { return Math.floor((a * (1024 - t) + b * t) / 1024); }
function noise(x: number, period: number, seed: number) {
    const cell = Math.floor(x / period);
    const t = Math.floor((x % period) * 1024 / period);
    const smooth = Math.floor(t * t * (3072 - 2 * t) / 1048576);
    const a = (mix32(seed ^ Math.imul(cell, 0x9e3779b9)) & 65535) - 32768;
    const b = (mix32(seed ^ Math.imul(cell + 1, 0x9e3779b9)) & 65535) - 32768;
    return lerp(a, b, smooth);
}

export function generateMap(value: string): GeneratedMap {
    const code = requireCode(value);
    const terrainRandom = createSeededRandom(code, 'terrain-v1');
    const spawnRandom = createSeededRandom(code, 'spawns-v1');
    const detailRandom = createSeededRandom(code, 'features-v1');
    const kindIndex = Math.floor(terrainRandom() * MAP_KINDS.length);
    const base = 414 + Math.floor(terrainRandom() * 64);
    const amplitude = 100 + Math.floor(terrainRandom() * 54);
    const period = 380 + Math.floor(terrainRandom() * 240);
    const seeds = [0, 1, 2].map(() => Math.floor(terrainRandom() * 4294967296));
    const heights = new Int16Array(WIDTH);
    for (let x = 0; x < WIDTH; x++) {
        let top = base + Math.floor(noise(x, period, seeds[0]) * amplitude / 32768)
            + Math.floor(noise(x, 170, seeds[1]) * 38 / 32768)
            + Math.floor(noise(x, 51, seeds[2]) * 9 / 32768);
        if (kindIndex === 1) top = Math.floor(top / 24) * 24;
        heights[x] = Math.max(285, Math.min(530, top));
    }

    const centers = Array.from({ length: 6 }, (_, i) => 160 + i * 320 + Math.floor(spawnRandom() * 81) - 40);
    // Spawn shelves have flat centers and smooth ramps. Every map gets these
    // guarantees, even maps containing lava gaps or underground chambers.
    for (const center of centers) {
        const shelf = heights[center];
        for (let x = center - 70; x <= center + 70; x++) {
            const weight = Math.floor(Math.max(0, Math.min(1, (70 - Math.abs(x - center)) / 30)) * 1024);
            heights[x] = lerp(heights[x], shelf, weight);
        }
    }

    const gaps: { center: number; half: number }[] = [];
    if (kindIndex === 2) for (let i = 0; i < 5; i++) {
        if (detailRandom() < 0.6 || gaps.length === 0) gaps.push({ center: Math.floor((centers[i] + centers[i + 1]) / 2), half: 12 + Math.floor(detailRandom() * 12) });
    }
    const pixels = new Uint8Array(WIDTH * HEIGHT);
    for (let x = 16; x < WIDTH - 16; x++) {
        if (gaps.some(gap => Math.abs(x - gap.center) <= gap.half)) { heights[x] = HEIGHT; continue; }
        for (let y = heights[x]; y < HEIGHT; y++) pixels[y * WIDTH + x] = 1;
    }

    if (kindIndex === 3) for (let i = 0; i < 5; i++) {
        const center = Math.floor((centers[i] + centers[i + 1]) / 2);
        const rx = 72 + Math.floor(detailRandom() * 52);
        const ry = 23 + Math.floor(detailRandom() * 14);
        let roof = 0;
        for (let x = center - rx; x <= center + rx; x++) roof = Math.max(roof, heights[x]);
        const cy = Math.max(550, roof + ry + 30);
        for (let y = cy - ry; y <= cy + ry; y++) for (let x = center - rx; x <= center + rx; x++) {
            if ((x - center) ** 2 * ry ** 2 + (y - cy) ** 2 * rx ** 2 <= rx ** 2 * ry ** 2) pixels[y * WIDTH + x] = 0;
        }
    }

    const spawns: Spawn[] = [];
    // One rover from each squad per third of the map keeps starts distributed.
    for (let pair = 0; pair < 3; pair++) {
        const flip = spawnRandom() < 0.5 ? 0 : 1;
        for (let team = 0; team < 2; team++) {
            const x = centers[pair * 2 + (team ^ flip)];
            spawns.push({ id: pair * 2 + team, team, x, y: heights[x] - 10 });
        }
    }
    return { code, version: MAP_GENERATOR_VERSION, kind: MAP_KINDS[kindIndex], pixels, heights, spawns };
}

export type MapPreferences = { selected: string; recent: string[] };
export const MAP_STORAGE_KEY = 'neon_synth_ballistics_maps_v1';
type MapStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readMapPreferences(storage: Pick<Storage, 'getItem'> | undefined): MapPreferences | null {
    try {
        const saved = JSON.parse(storage?.getItem(MAP_STORAGE_KEY) || 'null');
        if (!saved || typeof saved.selected !== 'string' || !parseMapCode(saved.selected)) return null;
        const recent: string[] = Array.isArray(saved.recent) ? saved.recent.filter((code: unknown): code is string => typeof code === 'string' && parseMapCode(code) !== null).map((code: string) => code.trim()) : [];
        return { selected: saved.selected.trim(), recent: [...new Set(recent)].slice(0, 8) };
    } catch { return null; }
}

export function rememberMap(storage: MapStorage | undefined, value: string, recent: string[]): MapPreferences {
    const code = requireCode(value);
    const result = { selected: code, recent: [...new Set([code, ...recent.filter(item => parseMapCode(item) !== null).map(item => item.trim())])].slice(0, 8) };
    try { storage?.setItem(MAP_STORAGE_KEY, JSON.stringify(result)); } catch { /* Recall remains available for this visit. */ }
    return result;
}
