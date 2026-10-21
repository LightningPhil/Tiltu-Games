import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Audio } from '../src/tetrigrid/audio.ts';
import { CLASSIC_BASS, CLASSIC_MELODY, MusicClock, TRACKS, notesForStep, type MusicTrack } from '../src/tetrigrid/music.ts';
import { defaults } from '../src/tetrigrid/storage.ts';
import { Synth } from '../src/tetrigrid/synth.ts';
import { createOriginalAudio } from './fixtures/tetrigrid-original-audio.js';

class Param {
  value=0;events:{type:string;value:number;time:number}[]=[];
  setValueAtTime(value:number,time:number) {this.value=value;this.events.push({type:'set',value,time});}
  linearRampToValueAtTime(value:number,time:number) {this.events.push({type:'linear',value,time});}
  exponentialRampToValueAtTime(value:number,time:number) {this.events.push({type:'exp',value,time});}
  setTargetAtTime(value:number,time:number) {this.events.push({type:'target',value,time});}
  cancelScheduledValues(time:number) {this.events.push({type:'cancel',value:0,time});}
}
class Node {
  gain=new Param();frequency=new Param();detune=new Param();Q=new Param();delayTime=new Param();offset=new Param();pan=new Param();
  threshold=new Param();ratio=new Param();attack=new Param();release=new Param();
  type='sine';buffer:{length:number}|null=null;onended:(()=>void)|null=null;
  startTime:number|null=null;stopTime:number|null=null;ended=false;disconnected=false;
  connections:Node[]=[];kind:string;ctx:Context;
  constructor(ctx:Context,kind:string) {this.ctx=ctx;this.kind=kind;}
  connect(node:Node) {this.connections.push(node);}
  disconnect() {this.disconnected=true;this.connections=[];}
  setPeriodicWave(_wave:unknown) {this.type='custom';}
  start(time=this.ctx.currentTime) {this.startTime=time;}
  stop(time=this.ctx.currentTime) {this.stopTime=time;}
}
class Context {
  currentTime=0;state='running';sampleRate=44100;nodes:Node[]=[];destination=new Node(this,'destination');waves=0;
  node(kind:string) {const n=new Node(this,kind);this.nodes.push(n);return n;}
  createGain() {return this.node('gain');}
  createOscillator() {return this.node('oscillator');}
  createConstantSource() {return this.node('constant');}
  createBufferSource() {return this.node('buffer');}
  createBiquadFilter() {return this.node('filter');}
  createDelay() {return this.node('delay');}
  createDynamicsCompressor() {return this.node('compressor');}
  createStereoPanner() {return this.node('panner');}
  createPeriodicWave(_real:Float32Array,_imag:Float32Array) {this.waves++;return {};}
  createBuffer(_channels:number,length:number,_rate:number) {return {length,getChannelData:()=>new Float32Array(length)};}
  async resume() {this.state='running';}
  async close() {this.state='closed';}
  advance(time:number) {
    this.currentTime=time;
    for(const node of this.nodes) {
      if(node.startTime === null || node.ended) continue;
      const end=node.stopTime ?? (node.buffer ? node.startTime+node.buffer.length/this.sampleRate : Infinity);
      if(end <= time) {node.ended=true;node.onended?.();}
    }
  }
}
class Timers {
  id=0;tasks=new Map<number,{fn:()=>void;delay:number}>();
  set(fn:()=>void,delay:number) {const id=++this.id;this.tasks.set(id,{fn,delay});return id as unknown as ReturnType<typeof setTimeout>;}
  clear(id:ReturnType<typeof setTimeout>) {this.tasks.delete(id as unknown as number);}
  run(delay:number) {for(const [id,task] of [...this.tasks]) if(task.delay === delay) {this.tasks.delete(id);task.fn();}}
  count(delay:number) {return [...this.tasks.values()].filter(task => task.delay===delay).length;}
}
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
function setup(track:MusicTrack='classic-house') {
  const ctx=new Context(),timers=new Timers(),settings={...defaults,musicTrack:track};
  const audio=new Audio(settings,{createContext:()=>ctx as unknown as AudioContext,timer:(fn,delay)=>timers.set(fn,delay),clearTimer:id=>timers.clear(id)});
  return {ctx,timers,settings,audio};
}
test('the original melody, bass progression and 256-step instrument events are preserved',()=> {
  const original=createOriginalAudio(new Context());
  assert.deepEqual(CLASSIC_MELODY,original.melodyMap);assert.deepEqual(CLASSIC_BASS,original.bassSequence);
  const events:{instrument:string;frequency?:number}[]=[];
  original.playKick=()=>events.push({instrument:'kick'});original.playOpenHat=()=>events.push({instrument:'openHat'});
  original.playClosedHat=()=>events.push({instrument:'closedHat'});original.playClap=()=>events.push({instrument:'clap'});
  original.playBass=(_t:number,frequency:number)=>events.push({instrument:'bass',frequency});
  original.playLead=(_t:number,frequency:number)=>events.push({instrument:'lead',frequency});
  for(let step=0;step<256;step++) {events.length=0;original.scheduleNote(step,0);assert.deepEqual(notesForStep(step),events,`step ${step}`);}
});
test('Classic House instrument graphs and envelopes match the immutable original engine',()=> {
  const normalize=(ctx:Context) => {
    const nodes=ctx.nodes.filter(n=>n.kind!=='constant');
    return nodes.map(n=>({kind:n.kind,type:n.type,start:n.startTime,stop:n.stopTime,buffer:n.buffer?.length,
      gain:n.gain.events,frequency:n.frequency.events,frequencyValue:n.frequency.value,Q:n.Q.value,delay:n.delayTime.value,
      connections:n.connections.map(target=>target===ctx.destination ? 'destination' : nodes.indexOf(target))}));
  };
  for(const [instrument,method] of [['kick','playKick'],['openHat','playOpenHat'],['closedHat','playClosedHat'],['clap','playClap'],['bass','playBass'],['lead','playLead']] as const) {
    const legacyContext=new Context(),portedContext=new Context(),legacy=createOriginalAudio(legacyContext),graph=createOriginalAudio(portedContext);
    legacy[method](0.1,440);
    const synth=new Synth(portedContext as unknown as BaseAudioContext,graph.masterGain);
    synth.instrument({instrument,frequency:440},0.1);
    assert.deepEqual(normalize(portedContext),normalize(legacyContext),instrument);
  }
});
test('the default master level and pumping compressor match the original soundtrack',async()=> {
  const {audio,ctx}=setup();await audio.init();
  const master=ctx.nodes.find(n=>n.kind==='gain')!,comp=ctx.nodes.find(n=>n.kind==='compressor')!;
  assert.equal(master.gain.value,0.5);assert.deepEqual([comp.threshold.value,comp.ratio.value,comp.attack.value,comp.release.value],[-24,16,0.003,0.15]);
  assert.equal(master.connections[0],comp);assert.equal(comp.connections[0],ctx.destination);audio.dispose();
});
test('the three techno tracks have independent pitched scores and rhythm patterns',()=> {
  const pitched=(track:MusicTrack) => Array.from({length:256},(_,step)=>notesForStep(step,track)
    .filter(n=>n.frequency !== undefined && n.instrument !== 'perc').map(n=>[step,n.frequency]));
  const contour=(track:MusicTrack) => {
    const notes=Array.from({length:256},(_,step)=>notesForStep(step,track)
      .filter(n=>n.instrument==='lead' || n.instrument==='arp').map(n=>[step,Math.round(69+12*Math.log2(n.frequency!/440))])).flat().slice(0,20);
    return notes.map(([time,pitch])=>[time-notes[0][0],pitch-notes[0][1]]);
  };
  const drums=(track:MusicTrack) => Array.from({length:256},(_,step)=>notesForStep(step,track)
    .filter(n=>['kick','openHat','closedHat','clap','perc','ride'].includes(n.instrument)).map(n=>n.instrument));
  const scores=new Set<string>();
  for(const track of ['neon-drive','midnight-groove','arcade-pulse'] as const) {
    assert.notDeepEqual(pitched(track),pitched('classic-house'));assert.notDeepEqual(drums(track),drums('classic-house'));
    assert.notDeepEqual(contour(track),contour('classic-house'),'changing key or instrument alone is not a new composition');
    scores.add(JSON.stringify(pitched(track)));
    for(let step=0;step<256;step++) for(const note of notesForStep(step,track)) {
      if(note.frequency !== undefined) assert.ok(Number.isFinite(note.frequency) && note.frequency>=20 && note.frequency<8000);
      if(note.gate !== undefined) assert.ok(note.gate>0 && note.gate<3);
      if(note.velocity !== undefined) assert.ok(note.velocity>0 && note.velocity<=1.2);
      if(note.cutoff !== undefined) assert.ok(note.cutoff>=90 && note.cutoff<=8000);
      if(note.echo !== undefined) assert.ok(note.echo>=0 && note.echo<0.6);
      assert.deepEqual(notesForStep(step+256,track),notesForStep(step,track));
    }
  }
  assert.equal(scores.size,3);
});
test('the names have musical identities: acid slides, dub chords, and chip call-and-response',()=> {
  const score=(track:MusicTrack)=>Array.from({length:256},(_,step)=>notesForStep(step,track)).flat();
  const neon=score('neon-drive');assert.ok(neon.some(n=>n.instrument==='bass' && n.slideFrom));
  assert.ok(new Set(neon.filter(n=>n.instrument==='bass').map(n=>n.cutoff)).size>8);
  const midnight=score('midnight-groove');assert.ok(midnight.some(n=>n.instrument==='pad'));
  assert.ok(midnight.filter(n=>n.instrument==='stab').length>64);assert.ok(midnight.filter(n=>n.instrument==='arp').length<16);
  const arcade=score('arcade-pulse');assert.ok(arcade.filter(n=>n.instrument==='arp').length>128);
  const call=Array.from({length:16},(_,step)=>notesForStep(step,'arcade-pulse').filter(n=>n.instrument==='arp').map(n=>n.frequency));
  const response=Array.from({length:16},(_,step)=>notesForStep(step+16,'arcade-pulse').filter(n=>n.instrument==='arp').map(n=>n.frequency));
  assert.notDeepEqual(call,response);
});
test('audio-clock scheduling survives a stall without a burst of missed notes',()=> {
  const clock=new MusicClock('classic-house',0.1),notes:{step:number;time:number}[]=[];
  const schedule=(step:number,time:number)=>notes.push({step,time});
  clock.pump(0,schedule);clock.pump(0.05,schedule);assert.deepEqual(notes,[{step:0,time:0.1}]);
  clock.pump(5,schedule);assert.ok(notes.slice(1).every(n=>n.time>=5));assert.ok(notes.length<=2);
});

test('Cello Flow keeps Bach\'s opening, a gentler pulse and a resolving 16-bar loop',()=> {
  const celloAt=(step:number)=>notesForStep(step,'cello-flow').find(n=>n.instrument==='cello')!;
  const pitchAt=(step:number)=>Math.round(69+12*Math.log2(celloAt(step).frequency!/440));
  assert.deepEqual(Array.from({length:32},(_,step)=>pitchAt(step)),[
    43,50,59,57,59,50,59,50,43,50,59,57,59,50,59,50,
    43,52,60,59,60,52,60,52,43,52,60,59,60,52,60,52,
  ]);
  assert.equal(TRACKS['cello-flow'].bpm,104);
  assert.equal(pitchAt(240),38);assert.equal(pitchAt(256),43); // dominant -> tonic
  let pulses=0;
  for(let step=0;step<256;step++) {
    const notes=notesForStep(step,'cello-flow');
    assert.deepEqual(notesForStep(step+256,'cello-flow'),notes);
    assert.ok(celloAt(step).frequency!>=65 && celloAt(step).frequency!<=330);
    assert.ok(celloAt(step).gate!>60/104/4); // slight overlap for a flowing bow
    assert.ok(notes.every(n=>!['clap','ride','arp','openHat'].includes(n.instrument)));
    for(const note of notes.filter(n=>n.instrument==='kick')) {pulses++;assert.ok(note.velocity!<=0.15);}
  }
  assert.equal(pulses,64);
});

test('cello voices reuse one waveform and release their modulation and room tails',()=> {
  const ctx=new Context(),synth=new Synth(ctx as unknown as BaseAudioContext,ctx.destination as unknown as AudioNode,'cello-flow');
  synth.note(0,0.1);synth.note(1,0.25);assert.equal(ctx.waves,1);assert.ok(synth.voiceCount>0);
  synth.stop(0.3);ctx.advance(0.31);assert.equal(synth.voiceCount,0);
  assert.ok(ctx.nodes.every(n=>n.disconnected),'all bow, vibrato, pad, pulse and reflection nodes disconnect on pause');
  synth.note(2,0.4);assert.equal(ctx.waves,1);ctx.advance(4);assert.equal(synth.voiceCount,0);
  assert.ok(ctx.nodes.every(n=>n.disconnected),'natural note endings release the room tail');
});

test('Cello Flow previews use their own tempo and stop cleanly after eight bars',async()=> {
  const {audio,ctx,timers,settings}=setup('cello-flow');settings.music=false;audio.preview();await settle();
  ctx.advance(0.05);timers.run(25);assert.equal(audio.status,'preview');
  ctx.advance(60/104*32+0.11);timers.run(25);assert.equal(audio.status,'idle');assert.equal(timers.count(25),0);
  ctx.advance(20);assert.ok(ctx.nodes.filter(n=>n.startTime!==null).every(n=>n.ended));audio.dispose();
});
test('each mix uses its own tempo; swing stays on odd subdivisions and loops wrap',()=> {
  for(const track of Object.keys(TRACKS) as MusicTrack[]) {
    const clock=new MusicClock(track,0.1,255),notes:{step:number;time:number}[]=[];
    clock.pump(0.05,(step,time)=>notes.push({step,time}));clock.pump(0.2,(step,time)=>notes.push({step,time}));
    assert.equal(notes[0].step,255);assert.ok(Math.abs(notes[0].time-(0.1+TRACKS[track].swing*clock.duration))<1e-10);
    assert.equal(notes[1].step,0);assert.ok(Math.abs(notes[1].time-(0.1+clock.duration))<1e-10);
  }
});
test('pause cancels future sources and the scheduler, then resume keeps the theme position',async()=> {
  const {audio,ctx,timers}=setup();audio.music(true);await settle();
  ctx.advance(0.05);timers.run(25);assert.equal(audio.status,'playing');assert.equal(timers.count(25),1);
  ctx.advance(1);timers.run(25);audio.music(false);
  assert.equal(timers.count(25),0);assert.equal(audio.status,'idle');
  ctx.advance(1.1);timers.run(50);
  assert.ok(ctx.nodes.filter(n=>n.startTime !== null).every(n=>n.ended));
  assert.ok(ctx.nodes.filter(n=>n.kind==='delay').every(n=>n.disconnected));
  audio.music(true);await settle();assert.equal(audio.status,'playing');assert.equal(timers.count(25),1);
  audio.music(true);assert.equal(timers.count(25),1);
  audio.dispose();
});
test('track switching replaces one transport and volume changes do not restart it',async()=> {
  const {audio,ctx,timers,settings}=setup();audio.music(true);await settle();ctx.advance(0.05);timers.run(25);
  settings.musicVolume=0.5;audio.applySettings();assert.equal(timers.count(25),1);
  settings.musicTrack='neon-drive';audio.applySettings();await settle();assert.equal(timers.count(25),1);
  settings.music=false;audio.applySettings();assert.equal(timers.count(25),0);assert.equal(audio.status,'idle');
  settings.music=true;audio.applySettings();await settle();assert.equal(audio.status,'playing');audio.dispose();
});
test('preview works while music is muted, ends at eight bars and stops without leaving echoes',async()=> {
  const {audio,ctx,timers,settings}=setup();settings.music=false;audio.preview();await settle();
  assert.equal(audio.status,'preview');assert.equal(settings.music,false);ctx.advance(0.05);timers.run(25);
  ctx.advance(60/128*32+0.11);timers.run(25);assert.equal(audio.status,'idle');assert.equal(timers.count(25),0);
  ctx.advance(20);timers.run(50);assert.ok(ctx.nodes.filter(n=>n.kind==='delay').every(n=>n.disconnected));audio.dispose();
});
test('a pause or preview cancel before AudioContext.resume resolves cannot start later',async()=> {
  const {audio,ctx,timers}=setup();let release!:()=>void;ctx.state='suspended';
  ctx.resume=()=>new Promise<void>(resolve=>{release=()=>{ctx.state='running';resolve();};});
  audio.preview();audio.stopPreview();release();await settle();assert.equal(audio.status,'idle');assert.equal(timers.count(25),0);
  assert.equal(ctx.nodes.filter(n=>n.startTime!==null).length,0);audio.dispose();
});
test('effects keep their original frequency sweeps and can play with music disabled',async()=> {
  const {audio,ctx,settings}=setup();settings.music=false;await audio.init();audio.music(true);
  for(const [kind,start,end] of [['move',300,600],['rotate',200,400],['drop',100,0.01],['clear',880,1760]] as const) {
    audio.sfx(kind);const osc=ctx.nodes.filter(n=>n.kind==='oscillator').at(-1)!;
    assert.equal(osc.frequency.events[0].value,start);assert.equal(osc.frequency.events[1].value,end);
  }
  const count=ctx.nodes.length;settings.sound=false;audio.applySettings();audio.sfx('drop');assert.equal(ctx.nodes.length,count);
  audio.dispose();
});
test('missing Web Audio never prevents play or leaves a running scheduler',async()=> {
  const timers=new Timers();const audio=new Audio({...defaults},{createContext:()=>{throw new Error('No audio');},timer:(fn,delay)=>timers.set(fn,delay)});
  audio.music(true);await settle();assert.equal(audio.status,'unavailable');assert.equal(timers.count(25),0);audio.sfx('drop');audio.dispose();
});
