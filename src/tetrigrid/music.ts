/** Ported from the repository’s standalone TetraGrid; that app remains independent. */
export type MusicTrack = 'classic-house' | 'neon-drive' | 'midnight-groove' | 'arcade-pulse' | 'cello-flow';
export type Track = {
  name: string; description: string; bpm: number; swing: number;
  kickStart: number; kickEnd: number; kickLength: number; hats: number; clap: number;
  bassWave: OscillatorType; bassQ: number; bassSweep: number; bassPeak: number;
  leadWave: OscillatorType; secondWave: OscillatorType; detune: number;
  leadPeak: number; leadAttack: number; leadLength: number; leadFilter: number; echo: number;
};
export const TRACKS: Record<MusicTrack, Track> = {
  'classic-house': {
    name: 'Classic House', description: 'The original soundtrack. Familiar theme, rolling bass, pumping drums and bright synth echoes.',
    bpm:128,swing:0,kickStart:120,kickEnd:40,kickLength:0.15,hats:1,clap:1,
    bassWave:'sawtooth',bassQ:5,bassSweep:4,bassPeak:0.6,
    leadWave:'square',secondWave:'sawtooth',detune:2,leadPeak:0.15,leadAttack:0.05,leadLength:0.4,leadFilter:0,echo:0.3,
  },
  'neon-drive': {
    name:'Neon Drive',description:'Night-road acid techno. A sliding bass sequence, rising neon arpeggios and relentless, crisp percussion.',
    bpm:136,swing:0,kickStart:130,kickEnd:40,kickLength:0.15,hats:1.08,clap:0.9,
    bassWave:'sawtooth',bassQ:9,bassSweep:9,bassPeak:0.5,
    leadWave:'sawtooth',secondWave:'triangle',detune:3,leadPeak:0.095,leadAttack:0.012,leadLength:0.18,leadFilter:4200,echo:0.23,
  },
  'midnight-groove': {
    name:'Midnight Groove',description:'Deep dub techno. Rounded sub-bass, spacious minor-chord echoes, soft swung percussion and distant pads.',
    bpm:122,swing:0.2,kickStart:105,kickEnd:35,kickLength:0.18,hats:0.5,clap:0.65,
    bassWave:'triangle',bassQ:2,bassSweep:3,bassPeak:0.45,
    leadWave:'triangle',secondWave:'sawtooth',detune:1.5,leadPeak:0.1,leadAttack:0.04,leadLength:0.3,leadFilter:1800,echo:0.48,
  },
  'arcade-pulse': {
    name:'Arcade Pulse',description:'Playful digital techno. An original call-and-response chip riff, octave bass jumps and glitchy fills.',
    bpm:144,swing:0,kickStart:135,kickEnd:42,kickLength:0.14,hats:0.85,clap:0.8,
    bassWave:'triangle',bassQ:3,bassSweep:5,bassPeak:0.5,
    leadWave:'square',secondWave:'triangle',detune:0,leadPeak:0.075,leadAttack:0.005,leadLength:0.11,leadFilter:6400,echo:0.19,
  },
  'cello-flow': {
    name:'Cello Flow',description:'Bach-inspired calm. Flowing Cello Suite No. 1 Prelude arpeggios, warm bowed tones and a gentle, steady pulse.',
    bpm:104,swing:0,kickStart:68,kickEnd:38,kickLength:0.19,hats:0,clap:0,
    bassWave:'sine',bassQ:0.7,bassSweep:2,bassPeak:0.12,
    leadWave:'triangle',secondWave:'sine',detune:0.4,leadPeak:0.12,leadAttack:0.035,leadLength:0.24,leadFilter:1500,echo:0,
  },
};
// Preserved verbatim from the original TetraGrid AudioEngine (256 sixteenth notes).
export const CLASSIC_MELODY: Record<number,number> = {
  0:76,4:71,6:72,8:74,10:72,12:71,14:69,
  16:69,18:72,20:76,24:74,26:72,28:71,
  32:71,34:72,36:74,40:76,44:72,48:69,52:69,
  64:74,68:77,72:81,74:79,76:77,78:76,
  80:72,82:76,84:74,86:72,88:71,
  96:71,98:72,100:74,104:76,108:72,112:69,116:69,
  128:76,132:71,134:72,136:74,138:72,140:71,142:69,
  144:69,146:72,148:76,152:74,154:72,156:71,
  160:71,162:72,164:74,168:76,172:72,176:69,180:69,
  192:74,196:77,200:81,202:79,204:77,206:76,
  208:72,210:76,212:74,214:72,216:71,
  224:71,226:72,228:74,232:76,236:72,240:69,244:69,
};
export const CLASSIC_BASS = [57,64,52,59,57,64,57,64,62,69,57,64,52,59,57,52,57,64,52,59,57,64,57,64,62,69,57,64,52,59,57,52];
export const midi = (note: number) => 440 * Math.pow(2,(note-69)/12);
export type NoteEvent = {
  instrument:'kick'|'openHat'|'closedHat'|'clap'|'bass'|'lead'|'arp'|'stab'|'pad'|'sub'|'perc'|'ride'|'cello'|'brush';
  frequency?:number; velocity?:number; gate?:number; cutoff?:number; slideFrom?:number; pan?:number; echo?:number;
};
export function notesForStep(step: number,track:MusicTrack='classic-house'): NoteEvent[] {
  step = ((step%256)+256)%256;
  if(track === 'neon-drive') return neonDrive(step);
  if(track === 'midnight-groove') return midnightGroove(step);
  if(track === 'arcade-pulse') return arcadePulse(step);
  if(track === 'cello-flow') return celloFlow(step);
  const notes: NoteEvent[] = [];
  if(step%4 === 0) notes.push({instrument:'kick'});
  if(step%4 === 2) notes.push({instrument:'openHat'});
  if(step%4 !== 2) notes.push({instrument:'closedHat'});
  if(step%16 === 4 || step%16 === 12) notes.push({instrument:'clap'});
  if(step%2 === 1) notes.push({instrument:'bass',frequency:midi(CLASSIC_BASS[Math.floor(step/8)]-12)});
  if(CLASSIC_MELODY[step]) notes.push({instrument:'lead',frequency:midi(CLASSIC_MELODY[step])});
  return notes;
}

// Separate 16-bar compositions. None of these scores use the classic melody or bass.
const ACID_A = [38,null,38,50,41,38,null,45,38,53,null,50,48,38,41,null];
const ACID_B = [38,38,null,41,50,null,45,38,null,48,50,53,45,null,41,36];
const ACID_C = [38,null,50,38,41,45,null,50,53,null,50,48,45,41,38,50];
function neonDrive(step:number):NoteEvent[] {
  const bar=Math.floor(step/16),beat=step%16,unit=60/TRACKS['neon-drive'].bpm/4;
  const notes:NoteEvent[]=[];
  const breakBar=bar === 7;
  if(beat%4 === 0 && (!breakBar || beat === 0)) notes.push({instrument:'kick',velocity:1});
  if(beat%4 === 2) notes.push({instrument:'openHat',velocity:bar%4 === 3 ? 0.85 : 0.65});
  if(beat%4 !== 2) notes.push({instrument:'closedHat',velocity:beat%2 ? 0.38 : 0.65});
  if(beat === 4 || beat === 12) notes.push({instrument:'clap',velocity:0.9});
  if(bar >= 4 && beat%4 === 2 && !breakBar) notes.push({instrument:'ride',velocity:0.18});
  const pattern=bar >= 8 ? ACID_C : bar%4 >= 2 ? ACID_B : ACID_A;
  const transpose=bar%8 === 4 || bar%8 === 5 ? -2 : 0;
  const pitch=pattern[beat];
  if(pitch !== null) {
    const accent=[0,3,8,11,14].includes(beat);
    const previous=pattern[(beat+15)%16];
    notes.push({instrument:'bass',frequency:midi(pitch+transpose),velocity:accent ? 1.1 : 0.72,
      gate:unit*(beat === 3 || beat === 11 ? 1.3 : 0.75),cutoff:400+(bar%8)*190+(accent ? 1300 : 0),
      slideFrom:previous !== null && [3,7,11,15].includes(beat) ? midi(previous+transpose) : undefined});
  }
  // Rising lights above the low acid sequence; bar 8 opens the register.
  if([2,6,10,14].includes(beat) && (!breakBar || beat >= 10)) {
    const riff=bar%4 === 3 ? [74,69,65,62] : [62,65,69,74];
    const pitch=riff[Math.floor(beat/4)]+transpose+(bar >= 8 && bar%2 ? 12 : 0);
    notes.push({instrument:'arp',frequency:midi(pitch),gate:unit*0.9,velocity:0.8,cutoff:2800+bar%4*600,pan:beat%8 === 2 ? -0.22 : 0.22,echo:0.23});
  }
  if(bar%4 === 3 && (beat === 13 || beat === 15)) notes.push({instrument:'perc',frequency:beat === 15 ? 180 : 260,velocity:0.45,gate:0.07});
  return notes;
}

const DUB_HARMONY = [
  {root:41,chord:[53,56,60,63,67]}, // F minor 9
  {root:37,chord:[49,53,56,60,63]}, // D-flat major 9
  {root:39,chord:[51,55,58,65]},    // E-flat add 9
  {root:41,chord:[53,56,60,63,67]},
];
function midnightGroove(step:number):NoteEvent[] {
  const bar=Math.floor(step/16),beat=step%16,quarter=60/TRACKS['midnight-groove'].bpm;
  const harmony=DUB_HARMONY[Math.floor(bar/2)%4],notes:NoteEvent[]=[];
  if(beat%4 === 0 && (bar !== 11 || beat === 0)) notes.push({instrument:'kick',velocity:beat%8 === 0 ? 0.95 : 0.8});
  if([2,6,10,14].includes(beat)) notes.push({instrument:'closedHat',velocity:beat%8 === 2 ? 0.6 : 0.42,cutoff:4600});
  if(beat === 6 || beat === 14) notes.push({instrument:'openHat',velocity:0.32,cutoff:4100});
  if(beat === 4 || beat === 12) notes.push({instrument:'perc',frequency:beat === 4 ? 780 : 620,velocity:0.42,gate:0.05});
  if(bar%2 && [7,15].includes(beat)) notes.push({instrument:'closedHat',velocity:0.25,cutoff:3800});
  if([0,6,10].includes(beat)) notes.push({instrument:'sub',frequency:midi(harmony.root+(beat === 10 ? 7 : 0)),
    velocity:beat === 0 ? 0.9 : 0.7,gate:quarter*(beat === 0 ? 0.8 : 0.45)});
  // A dub chord answers the bass, rather than carrying a continuous melody.
  if(beat === 3 || (beat === 11 && bar%4 !== 3)) {
    for(const [i,pitch] of harmony.chord.slice(0,4).entries()) notes.push({instrument:'stab',frequency:midi(pitch),
      velocity:0.62,gate:quarter*0.2,cutoff:950+bar%4*240,pan:(i%2 ? 1 : -1)*0.2,echo:0.48});
  }
  if(beat === 0 && bar%2 === 0) {
    for(const [i,pitch] of harmony.chord.slice(0,3).entries()) notes.push({instrument:'pad',frequency:midi(pitch),
      velocity:0.65,gate:quarter*3.4,cutoff:1100,pan:(i-1)*0.32});
  }
  if(bar%2 === 1 && beat === 13) notes.push({instrument:'arp',frequency:midi(harmony.chord.at(-1)!+12),
    velocity:0.4,gate:quarter*0.3,cutoff:1700,pan:0.3,echo:0.42});
  return notes;
}

const ARCADE_HARMONY = [
  {root:36,scale:[72,75,77,79,82,84]},
  {root:32,scale:[68,72,73,75,79,80]},
  {root:34,scale:[70,74,75,77,80,82]},
  {root:36,scale:[72,75,77,79,82,84]},
];
const ARCADE_CALL = [0,null,3,1,null,4,3,null,5,4,null,3,2,null,1,3];
const ARCADE_REPLY = [5,3,null,1,0,null,1,2,3,null,4,3,1,0,null,-1];
function arcadePulse(step:number):NoteEvent[] {
  const bar=Math.floor(step/16),beat=step%16,unit=60/TRACKS['arcade-pulse'].bpm/4;
  const harmony=ARCADE_HARMONY[Math.floor(bar/2)%4],notes:NoteEvent[]=[];
  if(beat%4 === 0) notes.push({instrument:'kick',velocity:0.95});
  if(beat === 4 || beat === 12) notes.push({instrument:'clap',velocity:0.85});
  if(beat%2 === 1) notes.push({instrument:'closedHat',velocity:beat%4 === 1 ? 0.55 : 0.32});
  if(beat === 6 || beat === 14) notes.push({instrument:'openHat',velocity:0.6});
  if([0,3,6,8,11,14].includes(beat)) notes.push({instrument:'bass',frequency:midi(harmony.root+([3,11].includes(beat) ? 12 : beat === 14 ? 7 : 0)),
    velocity:0.85,gate:unit*0.8,cutoff:850});
  const degree=(bar%2 ? ARCADE_REPLY : ARCADE_CALL)[beat];
  if(degree !== null && !(bar === 7 && beat < 8)) {
    const pitch=degree === -1 ? harmony.scale[3]-12 : harmony.scale[degree];
    notes.push({instrument:'arp',frequency:midi(pitch+(bar >= 8 && beat === 8 ? 12 : 0)),velocity:beat%4 === 0 ? 1 : 0.75,
      gate:unit*0.55,cutoff:6400,pan:beat%2 ? 0.18 : -0.18,echo:beat === 0 || beat === 8 ? 0.19 : 0});
  }
  if(bar%4 === 3 && [10,13,15].includes(beat)) notes.push({instrument:'perc',frequency:midi(beat === 15 ? 84 : 79),
    velocity:0.45,gate:unit*0.4,pan:beat === 13 ? -0.25 : 0.25});
  return notes;
}

// Bach, BWV 1007 Prelude: the first two bars retain the opening pitches in G major.
// The continuation is a new, compact 16-bar arrangement with a D7 -> G loop cadence,
// rather than a cut-off excerpt of the complete Prelude. No performance is sampled.
// Score reference: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=517
const CELLO_PHRASES = [
  [43,50,59,57,59,50,59,50], // G: Bach's opening
  [43,52,60,59,60,52,60,52], // C/G: Bach's second bar
  [43,54,60,59,60,54,60,54], // D7/G
  [43,55,59,57,59,55,59,55], // G
  [40,47,55,54,55,47,55,47], // Em
  [45,52,60,59,60,52,60,52], // Am
  [38,45,54,52,54,45,60,54], // D7
  [43,50,59,57,59,50,55,50], // G
  [43,50,59,57,59,50,62,59], // G, opening out
  [48,52,60,59,60,52,64,60], // C
  [47,54,62,60,62,54,59,54], // G/B
  [40,47,59,57,59,47,55,47], // Em
  [45,52,60,59,60,52,57,52], // Am
  [38,45,54,52,54,45,60,54], // D7
  [43,50,59,57,59,50,55,50], // G
  [38,45,54,52,54,45,60,54], // D7 resolves into the opening G
];
const CELLO_BED = [
  [43,55,59,62],[43,55,60,64],[43,54,60,62],[43,55,59,62],
  [40,55,59,64],[45,57,60,64],[38,54,60,62],[43,55,59,62],
  [43,55,59,62],[48,55,60,64],[47,55,59,62],[40,55,59,64],
  [45,57,60,64],[38,54,60,62],[43,55,59,62],[38,54,60,62],
];
function celloFlow(step:number):NoteEvent[] {
  const bar=Math.floor(step/16),beat=step%16,quarter=60/TRACKS['cello-flow'].bpm,unit=quarter/4;
  const phrase=CELLO_PHRASES[bar],bed=CELLO_BED[bar];
  // Gentle bow groupings give the continuous sixteenths a breathing phrase.
  const breath=bar === 7 || bar === 15 ? 1-beat*0.012 : 1;
  const notes:NoteEvent[]=[{instrument:'cello',frequency:midi(phrase[beat%8]),
    velocity:(beat%8 === 0 ? 0.95 : beat%4 === 0 ? 0.83 : 0.72)*breath,
    gate:unit*1.08,cutoff:beat%4 === 0 ? 1550 : 1250,pan:-0.08}];
  if(beat%4 === 0) notes.push({instrument:'kick',velocity:beat%8 === 0 ? 0.15 : 0.1});
  if(beat%4 === 2) notes.push({instrument:'brush',velocity:0.3,gate:0.075,pan:0.18});
  if(beat === 0 || beat === 8) notes.push({instrument:'sub',frequency:midi(bed[0]),velocity:0.19,gate:quarter*1.55});
  if(beat === 0) for(const [i,pitch] of bed.slice(1).entries()) {
    notes.push({instrument:'pad',frequency:midi(pitch),velocity:bar >= 8 ? 0.34 : 0.26,
      gate:quarter*2.8,cutoff:850,pan:(i-1)*0.3});
  }
  return notes;
}

// Look ahead on the audio clock, never on requestAnimationFrame or keyboard events.
// After a stall, skip missed subdivisions instead of firing a burst of old notes.
export class MusicClock {
  step: number;
  nextTime: number;
  pending: {step:number;time:number}[] = [];
  constructor(publicTrack: MusicTrack, startTime: number, step = 0) {
    this.track = publicTrack; this.nextTime = startTime; this.step = step;
  }
  track: MusicTrack;
  get duration() { return 60/TRACKS[this.track].bpm/4; }
  pump(now: number, schedule: (step:number,time:number) => void, end = Infinity) {
    const duration = this.duration;
    if(this.nextTime < now) {
      const missed = Math.ceil((now-this.nextTime)/duration);
      this.step = (this.step+missed)%256;this.nextTime += missed*duration;
    }
    this.pending = this.pending.filter(note => note.time >= now);
    while(this.nextTime < now+0.1 && this.nextTime < end) {
      const time = this.nextTime + (this.step%2 ? TRACKS[this.track].swing*duration : 0);
      if(time < end) {schedule(this.step,time);this.pending.push({step:this.step,time});}
      this.step = (this.step+1)%256;this.nextTime += duration;
    }
  }
  resumeStep(now: number) { return this.pending.find(note => note.time >= now)?.step ?? this.step; }
}
