// @ts-nocheck
/** Ported from neon-void; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { WAVE_COUNT, GAME_CONFIG, CREDIT_VALUE, SHIPS, getShip, getPlayerStats, createLevels, type Levels, type ShipId } from './balance.ts';
import { DEFAULT_MUSIC_TRACK, isMusicTrack, type MusicTrackId } from './music.ts';

export const DIFFICULTIES = {
    chill: { name: 'CHILL', description: 'More room to learn. Slower, gentler enemy fire.', health: .85, damage: .65, threat: .8, fireDelay: 1.15, shotSpeed: .85, score: .8 },
    arcade: { name: 'ARCADE', description: 'The full mission. Build, dodge, break through.', health: 1, damage: 1, threat: 1, fireDelay: 1, shotSpeed: 1, score: 1 },
    veteran: { name: 'VETERAN', description: 'Tougher squadrons and faster volleys. Higher scoring potential.', health: 1.2, damage: 1.2, threat: 1.2, fireDelay: .8, shotSpeed: 1.15, score: 1.3 },
};
export type Difficulty = keyof typeof DIFFICULTIES;
export const ABILITIES = { dashCooldown: 3200, dashDuration: 180, dashSpeed: 2.8, pulseMax: 100, pulsePassivePerSecond: 1.5, pulsePerKill: 6 };
export function getDifficulty(key: string) { return DIFFICULTIES[Object.hasOwn(DIFFICULTIES, key) ? key as Difficulty : 'arcade']; }
export function scoreMultiplier(combo: number) { return 1 + Math.min(8, Math.floor(Math.max(0, combo) / 4)) * .25; }
export function formatTime(ms: number) { return `${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`; }
export function createRunStats() {
    return { score: 0, kills: 0, shots: 0, hits: 0, combo: 0, bestCombo: 0, comboTimer: 0, hullLost: 0, pulses: 0, dashes: 0, creditsEarned: 0, spent: 0, lastHit: '' };
}
type RecordEntry = { bestScore: number; bestWave: number; bestKills: number; wins: number; attempts: number; fastestWin: number };
export type Settings = { difficulty: Difficulty; ship: ShipId; music: number; sfx: number; musicTrack:MusicTrackId; muted: boolean; autoFire: boolean; reducedMotion: boolean; shake: boolean };
export function createCareer() { return { kills:0,dashes:0,pulses:0,clearedWave:0,bestChain:0,bestScore:0,flights:0,wins:0 }; }
export const CAREER_GOALS = [
    { name:'PATROL BREAKER', detail:'Defeat the first commander',field:'clearedWave',target:5 },
    { name:'BLOCKADE RUNNER', detail:'Clear act I · unlock Striker',field:'clearedWave',target:10 },
    { name:'DEEP SPACE', detail:'Clear act II · unlock Spectre',field:'clearedWave',target:20 },
    { name:'CORE SILENCED', detail:'Complete the expedition',field:'clearedWave',target:30 },
    { name:'ACE PILOT', detail:'Build a 24-ship chain',field:'bestChain',target:24 },
    { name:'FLEET HUNTER', detail:'Destroy 500 ships over your career',field:'kills',target:500 },
    { name:'GHOST FLIGHT', detail:'Use dash 50 times',field:'dashes',target:50 },
    { name:'STORM BREAKER', detail:'Release 25 shockwaves',field:'pulses',target:25 },
    { name:'VOID LEGEND', detail:'Destroy 2,000 ships over your career',field:'kills',target:2000 },
] as const;
export type SavedRun = { version:5; wave:number; difficulty:Difficulty; shipId:ShipId; endless:boolean; levels:Levels; hull:number; shield:number; tempShield:number; coins:number; elapsed:number; pulseCharge:number; clusterAmmo:number; clusterRightAmmo:number; stats:ReturnType<typeof createRunStats>; banked:{kills:number;dashes:number;pulses:number}; buffs:Record<string,number> };
export type Profile = { settings: Settings; records: Record<string, RecordEntry>; career:ReturnType<typeof createCareer>; checkpoint:SavedRun|null };
const STORAGE_KEY = 'neon_void_drifter_profile_v1';
const emptyRecord = (): RecordEntry => ({ bestScore: 0, bestWave: 0, bestKills: 0, wins: 0, attempts: 0, fastestWin: 0 });
export function createProfile(): Profile {
    return { settings: { difficulty: 'arcade', ship:'vanguard', music: .25, sfx: .5, musicTrack:DEFAULT_MUSIC_TRACK, muted: false, autoFire: false, reducedMotion: false, shake: true }, records: {},career:createCareer(),checkpoint:null };
}
export function shipUnlocked(profile:Profile,id:string) { return Object.hasOwn(SHIPS,id)&&profile.career.clearedWave>=getShip(id).unlock; }
const finite = (n:unknown,min=0,max=1e9):n is number => typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
export function validateCheckpoint(raw:any):SavedRun|null {
    if(!raw||![1,2,3,4,5].includes(raw.version)||!Number.isInteger(raw.wave)||raw.wave<2||raw.wave>10000||raw.wave%2||typeof raw.endless!=='boolean'||(!raw.endless&&raw.wave>=WAVE_COUNT)||(raw.endless&&raw.wave<WAVE_COUNT)||!Object.hasOwn(DIFFICULTIES,raw.difficulty)||!Object.hasOwn(SHIPS,raw.shipId))return null;
    if(raw.version===1){
        const old=raw.levels,oldCaps={weaponPower:10,spread:3,sideGuns:3,missiles:3,fireRate:7,speed:3,shieldGen:5,magnet:3};
        if(!old||Object.entries(oldCaps).some(([key,max])=>!Number.isInteger(old[key])||!finite(old[key],0,max)))return null;
        raw={...raw,version:2,coins:raw.coins*CREDIT_VALUE,clusterAmmo:0,levels:{...createLevels(),weaponPower:Math.min(30,Math.round(old.weaponPower*10/3)),spread:old.spread*2,
            sideGuns:old.sideGuns?Math.round((.15+old.sideGuns*.2)/.04):0,missiles:old.missiles?1+(old.missiles-1)*8:0,fireRate:old.fireRate*3,speed:old.speed*5,shieldGen:old.shieldGen*4,magnet:old.magnet?4+(old.magnet-1)*4:0}};
    }
    if(raw.version===2){
        const oldCaps={...Object.fromEntries(Object.entries(GAME_CONFIG.UPGRADES).filter(([key])=>!['turretRight','turretFront','missilePower'].includes(key)).map(([key,config])=>[key,config.max])),sideGuns:20,megaCannon:12,turret:12,missiles:20,cluster:12,clusterRight:12};
        if(!raw.levels||Object.entries(oldCaps).some(([key,max])=>{const n=key==='clusterRight'&&raw.levels[key]===undefined?0:raw.levels[key];return !Number.isInteger(n)||!finite(n,0,max);}))return null;
        raw={...raw,version:3,levels:{...raw.levels,sideGuns:Math.min(3,raw.levels.sideGuns),megaCannon:Math.min(3,raw.levels.megaCannon),turret:Math.min(3,raw.levels.turret),turretRight:0,turretFront:0,clusterRight:raw.levels.clusterRight??0}};
    }
    if(raw.version===3){
        const oldCaps={...Object.fromEntries(Object.entries(GAME_CONFIG.UPGRADES).filter(([key])=>key!=='missilePower').map(([key,config])=>[key,config.max])),missiles:20,cluster:12,clusterRight:12};
        if(!raw.levels||Object.entries(oldCaps).some(([key,max])=>!Number.isInteger(raw.levels[key])||!finite(raw.levels[key],0,max)))return null;
        raw={...raw,version:4,levels:{...raw.levels,missilePower:raw.levels.weaponPower,missiles:Math.min(3,raw.levels.missiles),cluster:Math.min(3,raw.levels.cluster),clusterRight:Math.min(3,raw.levels.clusterRight)}};
    }
    const levels=createLevels();
    for(const key of Object.keys(levels) as (keyof Levels)[]){const n=raw.levels?.[key];if(!Number.isInteger(n)||!finite(n,0,GAME_CONFIG.UPGRADES[key].max))return null;levels[key]=n;}
    if(!Number.isInteger(raw.clusterAmmo)||!finite(raw.clusterAmmo,0,levels.cluster?3:0))return null;
    const clusterRightAmmo=raw.clusterRightAmmo===undefined&&!levels.clusterRight?0:raw.clusterRightAmmo;
    if(!Number.isInteger(clusterRightAmmo)||!finite(clusterRightAmmo,0,levels.clusterRight?3:0))return null;
    const ship=getShip(raw.shipId),stats=getPlayerStats(levels,raw.shipId);
    if(!finite(raw.hull,.001,ship.hull)||!finite(raw.shield,0,stats.maxRegenShield)||!finite(raw.tempShield,0,100)||!finite(raw.pulseCharge,0,100)||!finite(raw.coins)||!finite(raw.elapsed))return null;
    const runStats=createRunStats();
    for(const key of Object.keys(runStats)){
        if(key==='lastHit'){runStats.lastHit=typeof raw.stats?.lastHit==='string'?raw.stats.lastHit.slice(0,80):'';continue;}
        if(!finite(raw.stats?.[key]))return null;runStats[key]=raw.stats[key];
    }
    const banked={kills:0,dashes:0,pulses:0};
    for(const key of Object.keys(banked))if(finite(raw.banked?.[key],0,runStats[key]))banked[key]=raw.banked[key];else return null;
    const buffs={};for(const key of ['buff_rapid','buff_plasma','buff_guns','buff_missiles'])buffs[key]=finite(raw.buffs?.[key],0,10000)?raw.buffs[key]:0;
    // Legacy repair currency is retired; the current wallet and loadout are kept.
    return {version:5,wave:raw.wave,difficulty:raw.difficulty,shipId:raw.shipId,endless:raw.endless,levels,hull:raw.hull,shield:raw.shield,tempShield:raw.tempShield,coins:raw.coins,elapsed:raw.elapsed,pulseCharge:raw.pulseCharge,clusterAmmo:raw.clusterAmmo,clusterRightAmmo,stats:runStats,banked,buffs};
}
export function advanceCareer(profile:Profile,event:{kills:number;dashes:number;pulses:number;clearedWave:number;bestChain:number;score:number;finished?:boolean;won?:boolean}):Profile {
    const career={...profile.career};
    for(const key of ['kills','dashes','pulses'] as const)career[key]+=Math.max(0,Math.floor(event[key]));
    career.clearedWave=Math.max(career.clearedWave,Math.min(WAVE_COUNT,event.clearedWave));career.bestChain=Math.max(career.bestChain,event.bestChain);career.bestScore=Math.max(career.bestScore,event.score);
    if(event.finished)career.flights++;if(event.won)career.wins++;
    return {...profile,career};
}
type Store = { getItem(key: string): string | null; setItem(key: string, value: string): void };
function browserStore(): Store | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
export function loadProfile(storage: Store | null = browserStore(), preferReducedMotion = false): Profile {
    const profile = createProfile();
    profile.settings.reducedMotion = preferReducedMotion;
    try {
        const raw = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
        if (!raw || typeof raw !== 'object') return profile;
        const s = raw.settings;
        if (s && typeof s === 'object') {
            if (Object.hasOwn(DIFFICULTIES, s.difficulty)) profile.settings.difficulty = s.difficulty;
            if (Object.hasOwn(SHIPS,s.ship)) profile.settings.ship=s.ship;
            if (isMusicTrack(s.musicTrack)) profile.settings.musicTrack=s.musicTrack;
            else if(s.musicTrack==='starlight-drift')profile.settings.musicTrack='overdrive';
            for (const key of ['music','sfx'] as const) if (typeof s[key] === 'number' && Number.isFinite(s[key])) profile.settings[key] = Math.max(0, Math.min(1, s[key]));
            for (const key of ['muted','autoFire','reducedMotion','shake'] as const) if (typeof s[key] === 'boolean') profile.settings[key] = s[key];
        }
        for (const difficulty of Object.keys(DIFFICULTIES)) for (const mode of ['mission','expedition','endless']) {
            const key = `${difficulty}-${mode}`, candidate = raw.records?.[key];
            if (!candidate || typeof candidate !== 'object') continue;
            const record = emptyRecord();
            for (const field of Object.keys(record) as (keyof RecordEntry)[]) {
                const n = candidate[field];
                if (typeof n === 'number' && Number.isFinite(n) && n >= 0) record[field] = Math.min(1e9, Math.floor(n));
            }
            profile.records[key] = record;
        }
        if(raw.career&&typeof raw.career==='object'){
            for(const key of Object.keys(profile.career))if(finite(raw.career[key]))profile.career[key]=Math.floor(raw.career[key]);
        } else {
            const legacy=Object.entries(profile.records).filter(([key])=>key.endsWith('-mission')).map(([,record])=>record);
            profile.career.clearedWave=Math.min(10,Math.max(0,...legacy.map(record=>Math.max(0,record.bestWave-1)+(record.wins>0?1:0))));
            profile.career.kills=Math.max(0,...legacy.map(record=>record.bestKills));
        }
        profile.career.clearedWave=Math.min(WAVE_COUNT,profile.career.clearedWave);
        if(!shipUnlocked(profile,profile.settings.ship))profile.settings.ship='vanguard';
        profile.checkpoint=validateCheckpoint(raw.checkpoint);
    } catch { /* A blocked store or old/corrupt data must never prevent a mission. */ }
    return profile;
}
export function saveProfile(profile: Profile, storage: Store | null = browserStore()) {
    try { if (!storage) return false; storage.setItem(STORAGE_KEY, JSON.stringify(profile)); return true; } catch { return false; }
}
export function recordRun(profile: Profile, run: { difficulty: Difficulty; endless: boolean; won: boolean; score: number; wave: number; kills: number; elapsed: number; mode?:'expedition' }): Profile {
    const key = `${run.difficulty}-${run.endless ? 'endless' : run.mode||'mission'}`;
    const previous = profile.records[key] ?? emptyRecord();
    const next = { bestScore: Math.max(previous.bestScore, run.score), bestWave: Math.max(previous.bestWave,run.wave),
        bestKills: Math.max(previous.bestKills,run.kills), attempts: previous.attempts+1, wins: previous.wins + Number(run.won),
        fastestWin: run.won ? Math.min(previous.fastestWin || Infinity, Math.round(run.elapsed)) : previous.fastestWin };
    return { ...profile,settings: { ...profile.settings }, records: { ...profile.records, [key]: next } };
}
