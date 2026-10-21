/** Ported from neon-synth-ballistics; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
export type Difficulty = 'rookie' | 'regular' | 'veteran';
export type MatchMode = 'solo' | 'local' | 'practice';
export type Preferences = {
    difficulty: Difficulty; turnSeconds: number; suddenDeathRound: number;
    teamNames: [string, string]; unitNames: [string[], string[]];
    music: number; sfx: number; muted: boolean; track: number;
    reducedMotion: boolean; trajectoryGuide: boolean; autoCamera: boolean;
};

export const DEFAULTS: Preferences = {
    difficulty: 'regular', turnSeconds: 35, suddenDeathRound: 12,
    teamNames: ['VANGUARD', 'SYNDICATE'],
    unitNames: [['BIT', 'BYTE', 'PIXEL'], ['GLITCH', 'STATIC', 'NOISE']],
    music: 0.22, sfx: 0.65, muted: false, track: 0,
    reducedMotion: false, trajectoryGuide: false, autoCamera: true,
};
export const PREFERENCES_KEY = 'neon_synth_ballistics_preferences_v2';

function name(value: unknown, fallback: string, limit: number) {
    return typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, limit) || fallback : fallback;
}
function volume(value: unknown, fallback: number) { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback; }
export function normalizePreferences(value: unknown): Preferences {
    const v = value && typeof value === 'object' ? value as Partial<Preferences> : {};
    const teams = Array.isArray(v.teamNames) ? v.teamNames : [];
    const units = Array.isArray(v.unitNames) ? v.unitNames : [];
    return {
        difficulty: ['rookie', 'regular', 'veteran'].includes(v.difficulty??'') ? v.difficulty! : DEFAULTS.difficulty,
        turnSeconds: [25, 35, 45, 60].includes(v.turnSeconds??0) ? v.turnSeconds! : DEFAULTS.turnSeconds,
        suddenDeathRound: [8, 12, 16].includes(v.suddenDeathRound??0) ? v.suddenDeathRound! : DEFAULTS.suddenDeathRound,
        teamNames: [0, 1].map(i => name(teams[i], DEFAULTS.teamNames[i], 16)) as [string, string],
        unitNames: [0, 1].map(team => [0, 1, 2].map(i => name(Array.isArray(units[team]) ? units[team][i] : undefined, DEFAULTS.unitNames[team][i], 10))) as [string[], string[]],
        music: volume(v.music, DEFAULTS.music), sfx: volume(v.sfx, DEFAULTS.sfx),
        muted: typeof v.muted === 'boolean' ? v.muted : false,
        track: [0, 1, 2].includes(v.track??-1) ? v.track! : 0,
        reducedMotion: typeof v.reducedMotion === 'boolean' ? v.reducedMotion : false,
        trajectoryGuide: typeof v.trajectoryGuide === 'boolean' ? v.trajectoryGuide : false,
        autoCamera: typeof v.autoCamera === 'boolean' ? v.autoCamera : true,
    };
}
export function readPreferences(storage?: Pick<Storage, 'getItem'>, systemReducedMotion = false) {
    const read = (value: unknown) => {
        const normalized = normalizePreferences(value);
        if (!value || typeof value !== 'object' || typeof (value as Partial<Preferences>).reducedMotion !== 'boolean') normalized.reducedMotion = systemReducedMotion;
        return normalized;
    };
    try {
        const current = storage?.getItem(PREFERENCES_KEY);
        if (current) return read(JSON.parse(current));
        // Carry forward the old volume sliders on existing installations.
        const audio = JSON.parse(storage?.getItem('neon_synth_ballistics_settings') || 'null');
        return read(audio);
    } catch { return read(null); }
}
export function savePreferences(storage: Pick<Storage, 'setItem'> | undefined, preferences: Preferences) {
    const valid = normalizePreferences(preferences);
    try { storage?.setItem(PREFERENCES_KEY, JSON.stringify(valid)); } catch { /* Changes still apply for this visit. */ }
    return valid;
}
