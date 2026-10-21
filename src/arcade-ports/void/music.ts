// @ts-nocheck
/** Ported from neon-void; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
// Original, locally synthesised music. No downloads or sampled recordings.
import {cinematicStep,tranceStep} from './cinematic-scores.ts';
import {POLYMETRIC_TRACKS,polymetricStep} from './polymetric-scores.ts';
export const MUSIC_TRACKS = {
    'neon-run': { name:'NEON RUN', style:'Driving synthwave', detail:'Warm chords, a rolling bassline and a bright, answering lead.', bpm:124, color:'#48e6ff', bars:64 },
    'ion-storm': { name:'ION STORM', style:'Orbital breakbeat', detail:'Syncopated drums, restless arpeggios and a sharp pulse lead.', bpm:146, color:'#ffd47e', bars:64 },
    'overdrive': { name:'OVERDRIVE', style:'Arcade outrun', detail:'Pounding drums, a galloping bassline and a rising synth hook for the front line.', bpm:138, color:'#b89aff', bars:64 },
    'corebreaker': { name:'COREBREAKER', style:'Dark electro', detail:'A heavy sequenced bass, metallic percussion and a rising hook.', bpm:132, color:'#ff8aab', bars:64 },
    'last-horizon': { name:'LAST HORIZON', style:'Cinematic ascent', detail:'Intimate piano grows into sweeping strings, low brass and a powerful final movement.', bpm:92, color:'#f2d6a0', bars:96 },
    'phase-lancer': { name:'PHASE LANCER', style:'Classic trance', detail:'Offbeat bass, bright layered synths and a spacious breakdown build into an orbital anthem.', bpm:138, color:'#9cebd3', bars:96 },
    ...POLYMETRIC_TRACKS,
    'original': { name:'ORIGINAL', style:'Classic bass loop', detail:'The original 140 BPM sawtooth bass sequence, preserved as it was.', bpm:140, color:'#91a7b9', bars:1 },
} as const;
export type MusicTrackId = keyof typeof MUSIC_TRACKS;
export const DEFAULT_MUSIC_TRACK:MusicTrackId = 'neon-run';
export function isMusicTrack(value:unknown):value is MusicTrackId { return typeof value==='string'&&Object.hasOwn(MUSIC_TRACKS,value); }
export function getMusicTrack(id:unknown) { return MUSIC_TRACKS[isMusicTrack(id)?id:DEFAULT_MUSIC_TRACK]; }

type Instrument = 'bass'|'lead'|'bell'|'arp'|'pad'|'kick'|'snare'|'hat'|'openHat'|'clap'|'original'|'piano'|'strings'|'horn'|'taiko'|'trance'|'crash'|'sub'|'pluck'|'dub'|'rim';
export type MusicNote = { instrument:Instrument; midi:number; duration:number; velocity:number; pan:number; frequency?:number };
type Chord = readonly [number,number]; // bass MIDI note, third interval
type Composition = { chords:readonly Chord[]; bass:readonly number[]; motif:readonly (readonly number[])[]; response:readonly (readonly number[])[]; arp:readonly number[]; instrument:'lead'|'bell'; };
const REST=-99;
const COMPOSITIONS:Record<Exclude<MusicTrackId,'original'|'last-horizon'|'phase-lancer'|keyof typeof POLYMETRIC_TRACKS>,Composition> = {
    'neon-run': {
        chords:[[40,3],[36,4],[43,4],[38,4],[40,3],[36,4],[45,3],[47,3]],
        bass:[0,REST,12,REST,0,REST,7,12,0,REST,12,REST,7,REST,12,7],
        motif:[[7,REST,12,REST,14,12,REST,7,10,REST,7,REST,3,REST,7,REST],
            [7,REST,12,14,REST,19,REST,14,12,REST,10,REST,7,REST,REST,REST],
            [12,REST,7,REST,3,7,REST,10,12,REST,14,REST,19,REST,14,12],
            [7,REST,3,REST,0,REST,3,7,REST,12,REST,10,7,REST,REST,REST]],
        response:[[19,REST,14,12,REST,7,REST,12,14,REST,19,REST,22,19,REST,14],
            [12,REST,REST,7,10,REST,12,14,19,REST,14,REST,12,REST,REST,REST]],
        arp:[0,7,12,7,3,10,15,10],instrument:'lead',
    },
    'ion-storm': {
        chords:[[38,3],[34,4],[41,4],[36,4],[38,3],[41,4],[43,3],[45,4]],
        bass:[0,REST,0,12,REST,7,0,REST,12,0,REST,7,0,REST,12,REST],
        motif:[[0,REST,12,7,REST,10,REST,12,14,REST,7,REST,12,10,REST,7],
            [12,REST,19,REST,14,12,REST,10,REST,7,REST,3,7,REST,10,12],
            [7,10,REST,12,REST,14,19,REST,12,REST,10,7,REST,3,REST,7],
            [14,REST,12,REST,7,REST,10,12,REST,19,REST,14,12,7,REST,REST]],
        response:[[19,14,REST,12,REST,10,12,REST,7,REST,12,14,REST,19,22,REST],
            [12,REST,7,10,REST,14,REST,19,REST,14,12,REST,10,7,REST,REST]],
        arp:[0,12,7,15,10,19,7,12],instrument:'lead',
    },
    'overdrive': {
        chords:[[42,3],[38,4],[45,4],[40,4],[42,3],[45,4],[38,4],[37,4]],
        bass:[0,REST,0,12,0,REST,7,12,0,REST,0,12,7,REST,12,7],
        motif:[[0,REST,7,12,REST,14,REST,12,7,REST,10,12,REST,19,14,REST],
            [12,REST,7,REST,14,12,REST,7,10,REST,12,14,19,REST,14,12],
            [7,REST,12,14,REST,19,REST,22,19,REST,14,REST,12,10,7,REST],
            [12,REST,14,19,REST,14,12,REST,7,REST,3,7,12,REST,REST,REST]],
        response:[[19,REST,22,19,REST,14,12,REST,14,REST,19,22,24,REST,19,14],
            [12,REST,19,14,REST,12,10,REST,7,REST,10,12,14,7,REST,REST]],
        arp:[0,7,12,15,7,12,19,14],instrument:'lead',
    },
    'corebreaker': {
        chords:[[36,3],[32,4],[39,4],[34,4],[36,3],[31,3],[32,4],[43,4]],
        bass:[0,0,REST,12,0,REST,7,0,0,REST,12,0,7,REST,12,7],
        motif:[[0,REST,7,REST,12,REST,10,7,REST,3,REST,7,10,REST,12,REST],
            [12,REST,12,14,REST,19,REST,14,12,REST,7,REST,3,7,REST,REST],
            [7,REST,10,12,REST,14,REST,19,22,REST,19,REST,14,12,REST,10],
            [12,REST,7,REST,3,REST,0,REST,7,REST,10,REST,12,REST,REST,REST]],
        response:[[12,REST,19,REST,22,19,REST,14,19,REST,14,12,REST,10,7,REST],
            [19,REST,14,REST,12,REST,10,7,12,REST,7,REST,0,REST,REST,REST]],
        arp:[0,3,7,12,10,7,15,12],instrument:'lead',
    },
};
const ORIGINAL_NOTES=[110,110,220,110,130.8,130.8,261.6,130.8,98,98,196,98,110,110,164.8,110];
export const midiFrequency=(note:number)=>440*2**((note-69)/12);

// One sixteenth-note step of an arrangement. Pure score generation makes
// audio independent of gameplay RNG, frame rate and the combat clock.
export function musicStep(id:MusicTrackId,absoluteStep:number):MusicNote[] {
    if(id==='original')return [{instrument:'original',midi:0,frequency:ORIGINAL_NOTES[absoluteStep%16]/2,duration:.2,velocity:.5,pan:0}];
    if(id==='last-horizon')return cinematicStep(absoluteStep);
    if(id==='phase-lancer')return tranceStep(absoluteStep);
    if(id==='obsidian-circuit'||id==='ghost-vector')return polymetricStep(id,absoluteStep);
    const track=MUSIC_TRACKS[id],score=COMPOSITIONS[id],step=absoluteStep%1024,bar=Math.floor(step/16),beat=step%16;
    const seconds=60/track.bpm/4,events:MusicNote[]=[];
    const [root,third]=score.chords[Math.floor(bar/2)%score.chords.length];
    const intro=bar<8,outro=bar>=56,breakdown=bar>=24&&bar<32;
    const full=!intro&&!outro&&!breakdown,late=bar>=40&&bar<56,drums=!breakdown&&(!intro||bar>=4)&&(!outro||bar<60);
    const add=(instrument:Instrument,midi=0,duration=seconds,velocity=1,pan=0)=>events.push({instrument,midi,duration,velocity,pan});
    // Replace a minor third/tenth with the corresponding major chord tone.
    const harmonise=(interval:number)=>interval+(third===4&&[3,10,15,22].includes(interval)?1:0);
    if(beat===0){
        for(const [i,interval]of [0,third,7,14].entries())add('pad',root+12+interval,seconds*30,breakdown?.85:.55,(i-1.5)*.35);
    }
    if(!breakdown||beat%8===0){
        const note=score.bass[beat];
        if(note!==REST)add('bass',root+note,seconds*.8,intro?.55:.85);
    }
    const arpEvery=id==='ion-storm'||id==='overdrive'&&late?1:2;
    if((bar>=4&&!outro||breakdown)&&beat%arpEvery===0){
        const interval=harmonise(score.arp[(beat+Math.floor(bar/2)*2)%score.arp.length]);
        add('arp',root+24+interval,seconds*1.4,breakdown?.35:full?.52:.28,beat%4<2?-.45:.45);
    }
    if(full){
        const phrase=late?score.response[bar%score.response.length]:score.motif[bar%score.motif.length],interval=phrase[beat];
        if(interval!==REST)add(score.instrument,root+24+harmonise(interval),seconds*(score.instrument==='bell'?3.5:1.6),late?.85:.72,Math.floor(beat/4)%2?.13:-.13);
    } else if(breakdown&&beat===8)add('bell',root+36+7,seconds*5,.45,.35);
    if(drums){
        const kicks=id==='ion-storm'?[0,6,10,14]:[0,4,8,12];
        if(kicks.includes(beat))add('kick',0,.26,.9);
        if([4,12].includes(beat))add(id==='corebreaker'?'clap':'snare',0,.18,.68);
        if(beat%2===0)add('hat',0,.055,beat%4===0?.28:.4,beat%4===0?-.28:.28);
        if(full&&beat%8===6)add('openHat',0,.19,.3,.35);
        // Four-bar fills and a two-bar turnaround break up the repeating groove.
        if(full&&bar%4===3&&beat>=14)add('snare',0,.11,beat===14?.28:.4,beat===14?-.2:.2);
        if(id==='ion-storm'&&full&&[3,11].includes(beat))add('snare',0,.08,.2,-.25);
        if(id==='overdrive'&&full&&beat===15)add('kick',0,.16,.45);
    }
    return events;
}

type Session = { bus:GainNode; input:GainNode; effects:AudioNode[]; sources:Set<AudioScheduledSourceNode>; stopped:boolean };

export class MusicPlayer {
    readonly context:AudioContext;
    readonly output:AudioNode;
    trackId:MusicTrackId;
    playing=false;
    step=0;
    nextTime=0;
    private session:Session|null=null;
    private noise:AudioBuffer;

    constructor(context:AudioContext,output:AudioNode,trackId:MusicTrackId=DEFAULT_MUSIC_TRACK){
        this.context=context;this.output=output;this.trackId=isMusicTrack(trackId)?trackId:DEFAULT_MUSIC_TRACK;
        this.noise=context.createBuffer(1,Math.ceil(context.sampleRate*1.4),context.sampleRate);
        const samples=this.noise.getChannelData(0);let seed=0x4e454f4e;
        for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=seed/2**31-1;}
    }
    start(){
        if(this.playing)return;
        this.playing=true;this.step=0;this.nextTime=this.context.currentTime+.04;
        this.session=this.createSession();this.tick();
    }
    stop(){this.playing=false;this.retireSession();}
    setTrack(id:MusicTrackId){
        if(!isMusicTrack(id)||id===this.trackId)return false;
        this.trackId=id;
        // Audition the main groove immediately; new flights still get the intro.
        if(this.playing){this.retireSession();this.session=this.createSession();this.step=id==='original'?0:id==='last-horizon'?64*16:id==='phase-lancer'?48*16:8*16;this.nextTime=this.context.currentTime+.05;this.tick();}
        return true;
    }
    tick(){
        if(!this.playing||!this.session)return;
        const now=this.context.currentTime;
        if(this.nextTime<now-.2)this.nextTime=now+.03;
        while(this.nextTime<now+.12){
            for(const note of musicStep(this.trackId,this.step))this.playNote(note,this.nextTime,this.session);
            this.nextTime+=60/MUSIC_TRACKS[this.trackId].bpm/4;
            this.step=(this.step+1)%(MUSIC_TRACKS[this.trackId].bars*16);
        }
    }
    private createSession():Session {
        const ctx=this.context,bus=ctx.createGain(),input=ctx.createGain();
        bus.connect(this.output);bus.gain.setValueAtTime(0,ctx.currentTime);bus.gain.linearRampToValueAtTime(1,ctx.currentTime+.035);
        const effects:AudioNode[]=[input,bus];
        if(this.trackId==='original')input.connect(bus);
        else {
            const compressor=ctx.createDynamicsCompressor(),delay=ctx.createDelay(1),feedback=ctx.createGain(),wet=ctx.createGain(),filter=ctx.createBiquadFilter();
            compressor.threshold.value=-12;compressor.knee.value=12;compressor.ratio.value=4;compressor.attack.value=.004;compressor.release.value=.18;
            const dub=this.trackId==='obsidian-circuit'||this.trackId==='ghost-vector';
            delay.delayTime.value=60/MUSIC_TRACKS[this.trackId].bpm*.75;feedback.gain.value=dub?.34:.22;wet.gain.value=dub?.22:.14;
            filter.type='highpass';filter.frequency.value=600;
            input.connect(compressor);input.connect(delay);delay.connect(filter);
            if(dub){
                const shade=ctx.createBiquadFilter();shade.type='lowpass';shade.frequency.value=3400;
                filter.connect(shade);shade.connect(feedback);shade.connect(wet);effects.push(shade);
            }else{filter.connect(feedback);filter.connect(wet);}
            feedback.connect(delay);wet.connect(compressor);compressor.connect(bus);
            effects.push(compressor,delay,feedback,wet,filter);
        }
        return {bus,input,effects,sources:new Set(),stopped:false};
    }
    private retireSession(){
        const session=this.session;if(!session)return;this.session=null;session.stopped=true;
        const now=this.context.currentTime;session.bus.gain.cancelScheduledValues(now);session.bus.gain.setValueAtTime(session.bus.gain.value,now);session.bus.gain.linearRampToValueAtTime(0,now+.035);
        for(const source of session.sources)source.stop(now+.04);
        if(!session.sources.size)session.effects.forEach(node=>node.disconnect());
    }
    private source(source:AudioScheduledSourceNode,session:Session,nodes:AudioNode[],time:number,duration:number){
        session.sources.add(source);
        source.onended=()=>{source.disconnect();nodes.forEach(node=>node.disconnect());session.sources.delete(source);if(session.stopped&&!session.sources.size)session.effects.forEach(node=>node.disconnect());};
        source.start(time);source.stop(time+duration);
    }
    private playNote(note:MusicNote,time:number,session:Session){
        const ctx=this.context;
        if(note.instrument==='original'){
            // The original instrument and its exact frequency sequence.
            const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
            osc.type='sawtooth';osc.frequency.value=note.frequency!;filter.type='lowpass';filter.frequency.value=800;filter.Q.value=5;
            osc.connect(filter);filter.connect(gain);gain.connect(session.input);
            gain.gain.setValueAtTime(.5,time);gain.gain.exponentialRampToValueAtTime(.01,time+.15);
            filter.frequency.setValueAtTime(400,time);filter.frequency.exponentialRampToValueAtTime(100,time+.1);
            this.source(osc,session,[filter,gain],time,.2);return;
        }
        if(['snare','hat','openHat','clap','crash'].includes(note.instrument)){
            const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),pan=ctx.createStereoPanner();
            src.buffer=this.noise;filter.type='highpass';filter.frequency.value=note.instrument==='crash'?4800:note.instrument==='hat'||note.instrument==='openHat'?6500:1600;
            pan.pan.value=note.pan;const level=(note.instrument==='snare'||note.instrument==='clap'?.22:.12)*note.velocity;
            gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(level,time+.002);
            if(note.instrument==='clap'){
                for(let i=1;i<=3;i++){gain.gain.linearRampToValueAtTime(.0001,time+i*.012);gain.gain.linearRampToValueAtTime(level,time+i*.012+.003);}
            }
            gain.gain.exponentialRampToValueAtTime(.0001,time+note.duration);
            src.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(session.input);
            this.source(src,session,[filter,gain,pan],time,note.duration+.015);
            if(note.instrument==='snare')this.tone('triangle',185,time,.075,.06*note.velocity,0,session,700);
            return;
        }
        if(note.instrument==='kick'){
            const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(145,time);osc.frequency.exponentialRampToValueAtTime(44,time+.13);
            gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(.46*note.velocity,time+.003);gain.gain.exponentialRampToValueAtTime(.0001,time+note.duration);
            osc.connect(gain);gain.connect(session.input);this.source(osc,session,[gain],time,note.duration+.01);return;
        }
        const frequency=midiFrequency(note.midi),v=note.velocity;
        if(note.instrument==='sub'){
            this.tone('sine',frequency,time,note.duration,.19*v,0,session,800,.004,.09);
            this.tone('sawtooth',frequency,time,note.duration*.85,.045*v,0,session,420,.006,.065);
        }else if(note.instrument==='pluck'){
            // A decaying FM pair gives the interlocking notes a metallic edge.
            const carrier=ctx.createOscillator(),mod=ctx.createOscillator(),depth=ctx.createGain(),gain=ctx.createGain(),pan=ctx.createStereoPanner();
            carrier.frequency.value=frequency;mod.frequency.value=frequency*2.002;pan.pan.value=note.pan;
            depth.gain.setValueAtTime(frequency*.85,time);depth.gain.exponentialRampToValueAtTime(frequency*.025,time+.12);
            gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(.1*v,time+.003);gain.gain.exponentialRampToValueAtTime(.0001,time+note.duration+.18);
            mod.connect(depth);depth.connect(carrier.frequency);carrier.connect(gain);gain.connect(pan);pan.connect(session.input);
            this.source(mod,session,[depth],time,note.duration+.2);this.source(carrier,session,[gain,pan],time,note.duration+.2);
        }else if(note.instrument==='dub'){
            const osc=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),pan=ctx.createStereoPanner();
            osc.type='sawtooth';osc.frequency.value=frequency;pan.pan.value=note.pan;filter.type='lowpass';filter.Q.value=1.8;
            filter.frequency.setValueAtTime(2400,time);filter.frequency.exponentialRampToValueAtTime(340,time+.22);
            gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(.075*v,time+.004);gain.gain.exponentialRampToValueAtTime(.0001,time+note.duration+.26);
            osc.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(session.input);this.source(osc,session,[filter,gain,pan],time,note.duration+.28);
        }else if(note.instrument==='rim'){
            this.tone('triangle',760,time,.018,.065*v,note.pan,session,4200,.001,.035);
            this.tone('sine',1241,time,.012,.035*v,-note.pan,session,5000,.001,.025);
        }else if(note.instrument==='piano'){
            this.tone('triangle',frequency,time,note.duration,.115*v,note.pan,session,3800,.003,.6);
            this.tone('sine',frequency*2,time,note.duration*.55,.04*v,-note.pan,session,5000,.002,.35);
            this.tone('sine',frequency*3,time,.06,.012*v,note.pan,session,6000,.002,.08);
        }else if(note.instrument==='strings'){
            this.tone('sawtooth',frequency,time,note.duration,.026*v,note.pan,session,1800,.24,.55,-6);
            this.tone('triangle',frequency,time,note.duration,.035*v,-note.pan,session,2600,.3,.6,6);
        }else if(note.instrument==='horn'){
            this.tone('sawtooth',frequency,time,note.duration,.065*v,-.18,session,1600,.065,.28,-4);
            this.tone('triangle',frequency,time,note.duration,.065*v,.18,session,2100,.05,.3,4);
        }else if(note.instrument==='trance'){
            for(const [detune,pan]of [[-9,-.5],[0,0],[9,.5]])this.tone('sawtooth',frequency,time,note.duration,.045*v,pan,session,3600,.008,.2,detune);
            this.tone('triangle',frequency/2,time,note.duration,.035*v,0,session,1600,.008,.15);
        }else if(note.instrument==='taiko'){
            const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.setValueAtTime(frequency*2.4,time);osc.frequency.exponentialRampToValueAtTime(frequency,time+.1);
            gain.gain.setValueAtTime(.35*v,time);gain.gain.exponentialRampToValueAtTime(.0001,time+note.duration+.18);
            osc.connect(gain);gain.connect(session.input);this.source(osc,session,[gain],time,note.duration+.2);
        }else if(note.instrument==='bass')this.tone('sawtooth',frequency,time,note.duration,.13*v,note.pan,session,550,.004,.065);
        else if(note.instrument==='pad'){
            this.tone('triangle',frequency,time,note.duration,.038*v,note.pan,session,2000,.32,.48,-5);
            this.tone('sine',frequency,time,note.duration,.025*v,-note.pan,session,2600,.4,.55,5);
        } else if(note.instrument==='bell'){
            this.tone('sine',frequency,time,note.duration,.15*v,note.pan,session,6000,.004,.65);
            this.tone('sine',frequency*2.003,time,note.duration*.55,.035*v,-note.pan,session,6000,.003,.2);
        } else if(note.instrument==='arp')this.tone('triangle',frequency,time,note.duration,.075*v,note.pan,session,3200,.005,.12);
        else {
            this.tone('triangle',frequency,time,note.duration,.12*v,note.pan,session,2600,.012,.15,-4);
            this.tone('sawtooth',frequency,time,note.duration,.033*v,-note.pan,session,1800,.015,.16,4);
        }
    }
    private tone(type:OscillatorType,frequency:number,time:number,duration:number,level:number,panValue:number,session:Session,cutoff:number,attack=.004,release=.08,detune=0){
        const ctx=this.context,osc=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),pan=ctx.createStereoPanner();
        osc.type=type;osc.frequency.value=frequency;osc.detune.value=detune;filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.6;pan.pan.value=panValue;
        gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(level,time+attack);
        gain.gain.setValueAtTime(level*.68,time+Math.max(attack,duration*.6));gain.gain.exponentialRampToValueAtTime(.0001,time+duration+release);
        osc.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(session.input);
        this.source(osc,session,[filter,gain,pan],time,duration+release+.015);
    }
}
