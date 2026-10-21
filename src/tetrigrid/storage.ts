/** Ported from the repository’s standalone TetraGrid; that app remains independent. */
import { Game, MODES, type Mode } from './game.ts';
import { TRACKS, type MusicTrack } from './music.ts';
export type Settings = { mode: Mode; handling: 'relaxed' | 'balanced' | 'fast'; ghost: boolean; effects: boolean; sound: boolean; music: boolean; volume: number; audioVersion:1; musicTrack:MusicTrack; musicVolume:number; effectsVolume:number };
export const defaults: Settings = { mode:'marathon',handling:'balanced',ghost:true,effects:true,sound:true,music:true,volume:0.5,audioVersion:1,musicTrack:'classic-house',musicVolume:1,effectsVolume:1 };
export type RecordEntry = { score:number; lines:number; elapsed:number; pieces:number; date:string };
export type Records = Partial<Record<Mode, RecordEntry[]>>;
export class Storage {
  available = true;
  memory = new Map<string,string>();
  read(key: string): unknown {
    let raw: string | null;
    if (!this.available && this.memory.has(key)) raw = this.memory.get(key)!;
    else {
      try { raw = localStorage.getItem('tetra_grid_v2_' + key); }
      catch { this.available = false; raw = this.memory.get(key) ?? null; }
    }
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  write(key: string, value: unknown) {
    const raw = JSON.stringify(value); this.memory.set(key,raw);
    try { localStorage.setItem('tetra_grid_v2_' + key,raw); } catch { this.available = false; }
  }
  settings():Settings {return readSettings(this.read('settings'));}
  records():Records {return readRecords(this.read('records'));}
  session() { return Game.restore(this.read('session')); }
}
export function saveRecord(records: Records, game: Game): { records:Records; best:boolean } {
  if (game.mode === 'zen' || (game.mode === 'sprint' && game.ended !== 'complete')) return { records,best:false };
  const entry: RecordEntry = { score:game.score,lines:game.lines,elapsed:game.elapsed,pieces:game.pieces,date:new Date().toISOString() };
  const list = [...(records[game.mode] ?? []),entry].sort((a,b) => game.mode === 'sprint' ? a.elapsed-b.elapsed || b.score-a.score : b.score-a.score || b.lines-a.lines);
  return { records:{ ...records,[game.mode]:list.slice(0,5) },best:list[0] === entry };
}
export function readSettings(raw:unknown):Settings { const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
    const volume=(v:unknown,fallback:number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0,Math.min(1,v)) : fallback;
    return { mode:s.mode && Object.hasOwn(MODES,s.mode) ? s.mode : defaults.mode,
      handling:['relaxed','balanced','fast'].includes(s.handling ?? '') ? s.handling! : defaults.handling,
      ghost:typeof s.ghost === 'boolean' ? s.ghost : defaults.ghost, effects:typeof s.effects === 'boolean' ? s.effects : defaults.effects,
      sound:typeof s.sound === 'boolean' ? s.sound : defaults.sound,
      // The previous release silently defaulted music off. Restore it once;
      // subsequent deliberate mute choices carry audioVersion and are respected.
      music:s.audioVersion === 1 && typeof s.music === 'boolean' ? s.music : defaults.music,audioVersion:1,
      musicTrack:s.musicTrack && Object.hasOwn(TRACKS,s.musicTrack) ? s.musicTrack : defaults.musicTrack,
      musicVolume:volume(s.musicVolume,defaults.musicVolume),effectsVolume:volume(s.effectsVolume,defaults.effectsVolume),
      volume:s.audioVersion !== 1 && s.volume === 0.35 ? defaults.volume : volume(s.volume,defaults.volume) };
  }
export function readRecords(raw:unknown):Records {
    const result:Records = {};
    if (raw && typeof raw === 'object') for (const mode of Object.keys(MODES) as Mode[]) {
      const rows = (raw as Records)[mode];
      if (Array.isArray(rows)) result[mode] = rows.filter(r => r && [r.score,r.lines,r.elapsed,r.pieces].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0) && typeof r.date === 'string' && r.date.length < 40).slice(0,5);
    }
    return result;
  }
