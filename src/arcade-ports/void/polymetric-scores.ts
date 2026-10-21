// @ts-nocheck
/** Ported from neon-void; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import type {MusicNote} from './music.ts';

// The pulse stays in 4/4 while the other layers run on independent clocks.
// Count sixteenth notes continuously: neither a bar nor a new section resets
// a pattern. Each arrangement ends on a complete alignment of all its clocks.
const R=-99;
export const POLYMETRIC_TRACKS = {
    'obsidian-circuit': {
        name:'OBSIDIAN CIRCUIT',style:'Polymetric dub breaks',
        detail:'Deep bass and fractured breaks. 5-, 7- and 3-beat patterns weave over 4/4, meeting again every 105 bars. A 5:50 electronic journey.',
        bpm:144,color:'#e7aa72',bars:210,
    },
    'ghost-vector': {
        name:'GHOST VECTOR',style:'Electronic math chase',
        detail:'Urgent sub-bass, metallic pulses and ghostly dub chords. 7- and 9-beat patterns converge every 63 bars through a 6:49 arrangement.',
        bpm:148,color:'#a6caff',bars:252,
    },
} as const;
export type PolymetricTrackId=keyof typeof POLYMETRIC_TRACKS;

// Explicit rests are part of each loop. Pitched layers share the current
// harmony, but their rhythmic and melodic positions never restart with it.
export const POLYMETRIC_PATTERNS = {
    'obsidian-circuit': {
        bass:[0,R,R,0,R,R,7,R,0,R,12,R,R,0,R,7,R,R,3,R], // 5 beats
        arp:[12,R,R,7,R,14,R,R,15,R,R,7,R,19,R,R,12,R,R,10,R,7,R,R,3,R,7,R], // 7 beats
        percussion:[1,0,0,0,.55,0,0,1,0,0,.4,0], // 3 beats
    },
    'ghost-vector': {
        bass:[0,R,12,R,R,0,R,7,R,R,0,R,10,R,0,R,R,12,R,7,R,R,3,R,0,R,R,7], // 7 beats
        arp:[7,R,12,R,R,14,R,19,R,R,12,R,7,R,R,3,R,10,R,R,12,R,19,R,R,14,R,12,R,R,7,R,3,R,R,7], // 9 beats
        percussion:[1,0,0,.35,0,0,1,0,0,0,.6,0], // 3 beats, divides 9
    },
} as const;

export function polymetricStep(id:PolymetricTrackId,absoluteStep:number):MusicNote[] {
    const track=POLYMETRIC_TRACKS[id],patterns=POLYMETRIC_PATTERNS[id];
    const step=absoluteStep%(track.bars*16),bar=Math.floor(step/16),beat=step%16,seconds=60/track.bpm/4;
    const obsidian=id==='obsidian-circuit',events:MusicNote[]=[];
    const add=(instrument:MusicNote['instrument'],midi=0,duration=seconds,velocity=1,pan=0)=>events.push({instrument,midi,duration,velocity,pan});
    const chords=obsidian?[[36,3],[32,4],[41,3]]:[[42,3],[38,4],[47,3],[40,4]];
    const [root,third]=chords[Math.floor(bar/7)%chords.length];
    const harmonise=(interval:number)=>interval+(third===4&&[3,10,15,22].includes(interval)?1:0);
    const intro=bar<8,outro=bar>=track.bars-8;
    const breakdown=bar>=24&&bar<32||obsidian&&bar>=112&&bar<120||!obsidian&&bar>=136&&bar<144;
    const bridge=obsidian?bar>=64&&bar<80||bar>=160&&bar<168:bar>=88&&bar<104||bar>=200&&bar<208;
    const peak=obsidian?bar>=80&&bar<112||bar>=168&&bar<202:bar>=104&&bar<136||bar>=208&&bar<244;
    const full=!intro&&!outro&&!breakdown,energy=breakdown?.34:intro?.48:outro?.4:bridge?.64:peak?1:.8;

    // Wide suspended chords sit above the sub. A seven-bar harmonic pace adds
    // a slower ebb while leaving space around the interlocking short notes.
    if(beat===0&&(bar%2===0||bar%7===0)){
        for(const [i,interval]of [third,7,14].entries())add('pad',root+24+interval,seconds*26,energy*.36,(i-1)*.58);
        if(breakdown)add('bell',root+36+7,seconds*7,.35,bar%2?-.45:.45);
    }
    const bass=patterns.bass[step%patterns.bass.length];
    if(bass!==R&&(!intro||beat%2===0)&&(!breakdown||step%patterns.bass.length===0)){
        add('sub',root+harmonise(bass),seconds*(bass===0?1.35:.8),energy*.92);
    }
    const arp=patterns.arp[step%patterns.arp.length];
    if(arp!==R&&bar>=4&&(!bridge||step%2===0)){
        const cycle=Math.floor(step/patterns.arp.length);
        add('pluck',root+24+harmonise(arp),seconds*(breakdown?3:1.2),energy*(peak?.64:.5),cycle%2?-.48:.48);
        // The second voice answers the same long clock in the final builds.
        if(peak&&step%patterns.arp.length===0)add('arp',root+36+7,seconds*2,.3,cycle%2?.55:-.55);
    }
    const accent=patterns.percussion[step%patterns.percussion.length];
    if(accent&&full)add('rim',0,.075,accent*(peak?.6:.42),Math.floor(step/patterns.percussion.length)%2?-.6:.6);

    // Offbeat chord jabs follow their own seven/nine-beat loop too, rather
    // than following a repeated one-bar lead line.
    const stabStep=step%patterns.arp.length;
    if(full&&[obsidian?6:10,obsidian?22:26].includes(stabStep)){
        for(const [i,interval]of [third,7,10].entries())add('dub',root+24+harmonise(interval),seconds*.8,energy*.46,(i-1)*.24);
    }
    if(!breakdown&&(!intro||bar>=4)){
        // A solid dance pulse anchors the shifting layers; broken kick and
        // ghost-snare accents give the tracks a darker, restless momentum.
        const kicks=obsidian?[0,6,8,11]:[0,3,8,10,14];
        if(kicks.includes(beat))add('kick',0,.24,beat===0||beat===8?.92:.66);
        if([4,12].includes(beat)&&bar>=6)add('snare',0,.17,peak?.78:.66);
        if(full&&[obsidian?15:7,obsidian?3:15].includes(beat))add('snare',0,.065,.19,beat<8?-.22:.22);
        if(beat%2===0)add('hat',0,.04,beat%4===2?.4:.21,beat%4===2?.32:-.32);
        if(full&&beat%8===6)add('openHat',0,.14,energy*.24,.4);
        if(peak&&beat%4===3)add('hat',0,.028,.15,-.4);
        if(full&&bar%7===6&&beat>=14)add('snare',0,.085,beat===14?.28:.39,beat===14?-.2:.2);
        if(peak&&bar%7===0&&beat===0)add('crash',0,.8,.22);
    }
    return events;
}
