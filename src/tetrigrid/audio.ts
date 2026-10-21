/** Ported from the repository’s standalone TetraGrid; that app remains independent. */
import type { Settings } from './storage.ts';
import { MusicClock, TRACKS, type MusicTrack } from './music.ts';
import { Synth, type Effect } from './synth.ts';

export type AudioStatus = 'idle'|'starting'|'playing'|'preview'|'unavailable';
type Session = { kind:'game'|'preview';track:MusicTrack;gain:GainNode;synth:Synth;clock:MusicClock;end:number };
type AudioOptions = {
  createContext?:()=>AudioContext;
  timer?:(callback:()=>void,delay:number)=>ReturnType<typeof setTimeout>;
  clearTimer?:(id:ReturnType<typeof setTimeout>)=>void;
};
export class Audio {
  ctx:AudioContext|null=null;
  status:AudioStatus='idle';
  onChange:(()=>void)|null=null;
  private master:GainNode|null=null;
  private effectsGain:GainNode|null=null;
  private effectsSynth:Synth|null=null;
  private session:Session|null=null;
  private pending:{kind:Session['kind'];track:MusicTrack}|null=null;
  private timerId:ReturnType<typeof setTimeout>|null=null;
  private generation=0;
  private wantGame=false;
  private cursor:{track:MusicTrack;step:number}|null=null;
  readonly settings:Settings;
  private createContext:()=>AudioContext;
  private timer:NonNullable<AudioOptions['timer']>;
  private clearTimer:NonNullable<AudioOptions['clearTimer']>;
  constructor(settings:Settings,options:AudioOptions={}) {
    this.settings=settings;
    this.createContext=options.createContext ?? (() => {
      const ctor=window.AudioContext ?? (window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
      return new ctor();
    });
    this.timer=options.timer ?? ((fn,delay) => setTimeout(fn,delay));
    this.clearTimer=options.clearTimer ?? (id => clearTimeout(id));
  }
  get previewing() {return this.session?.kind === 'preview';}
  private changed(status:AudioStatus) {this.status=status;this.onChange?.();}
  async init():Promise<boolean> {
    try {
      if(!this.ctx || this.ctx.state === 'closed') {
        this.ctx=this.createContext();this.master=this.ctx.createGain();this.master.gain.value=this.settings.volume;
        // Original master -> pumping compressor chain and its exact parameters.
        const compressor=this.ctx.createDynamicsCompressor();
        compressor.threshold.value=-24;compressor.ratio.value=16;compressor.attack.value=0.003;compressor.release.value=0.15;
        this.master.connect(compressor);compressor.connect(this.ctx.destination);
        this.effectsGain=this.ctx.createGain();this.effectsGain.gain.value=this.settings.sound ? this.settings.effectsVolume : 0;
        this.effectsGain.connect(this.master);this.effectsSynth=new Synth(this.ctx,this.effectsGain);
      }
      if(this.ctx.state === 'suspended') await this.ctx.resume();
      if(this.ctx.state !== 'running') return false;
      return true;
    } catch {return false;}
  }
  private gain(node:GainNode|null,value:number) {
    if(!node || !this.ctx) return;
    node.gain.cancelScheduledValues(this.ctx.currentTime);node.gain.setTargetAtTime(value,this.ctx.currentTime,0.01);
  }
  sfx(kind:Effect) {
    if(this.settings.sound && this.ctx?.state === 'running') this.effectsSynth?.effect(kind);
  }
  reset() {this.wantGame=false;this.stopSession(false);this.cursor=null;}
  music(play:boolean) {
    this.wantGame=play;
    this.gain(this.effectsGain,play && this.settings.sound ? this.settings.effectsVolume : 0);
    if(!play && this.ctx) this.effectsSynth?.stop(this.ctx.currentTime+0.02);
    if(!play || !this.settings.music) {this.stopSession();return;}
    if(this.pending?.kind === 'game' && this.pending.track === this.settings.musicTrack) return;
    if(this.session?.kind === 'game' && this.session.track === this.settings.musicTrack) {this.applySettings();return;}
    const track=this.settings.musicTrack,step=this.cursor?.track === track ? this.cursor.step : 0;
    void this.startSession('game',track,step);
  }
  preview() {
    if(this.status === 'preview' || (this.status === 'starting' && !this.wantGame)) {this.stopPreview();return;}
    void this.startSession('preview',this.settings.musicTrack,0);
  }
  stopPreview() {if(this.previewing || (!this.wantGame && this.status === 'starting')) this.stopSession(false);}
  applySettings() {
    this.gain(this.master,this.settings.volume);
    this.gain(this.effectsGain,this.wantGame && this.settings.sound ? this.settings.effectsVolume : 0);
    if(this.session) this.gain(this.session.gain,this.settings.musicVolume);
    if(this.pending && this.pending.track !== this.settings.musicTrack) {
      const kind=this.pending.kind;
      void this.startSession(kind,this.settings.musicTrack,0);return;
    }
    if(this.session?.track !== this.settings.musicTrack && this.session) {
      const kind=this.session.kind;
      if(kind === 'preview') {void this.startSession('preview',this.settings.musicTrack,0);return;}
      this.stopSession();
    }
    if(this.wantGame) {
      if(!this.settings.music) this.stopSession();
      else if(!this.session && !this.pending) {
        const track=this.settings.musicTrack,step=this.cursor?.track === track ? this.cursor.step : 0;
        void this.startSession('game',track,step);
      }
    }
    this.onChange?.();
  }
  private async startSession(kind:Session['kind'],track:MusicTrack,step:number) {
    this.stopSession();
    const generation=++this.generation;
    this.pending={kind,track};
    this.changed('starting');
    const ready=await this.init();
    if(generation !== this.generation) return;
    this.pending=null;
    if(!ready || !this.ctx || !this.master) {this.changed('unavailable');return;}
    if(kind === 'game' && (!this.wantGame || !this.settings.music)) {this.changed('idle');return;}
    const gain=this.ctx.createGain(),start=this.ctx.currentTime+0.1;
    gain.gain.value=0;gain.gain.linearRampToValueAtTime(this.settings.musicVolume,this.ctx.currentTime+0.02);gain.connect(this.master);
    this.session={kind,track,gain,synth:new Synth(this.ctx,gain,track),clock:new MusicClock(track,start,step),end:kind === 'preview' ? start+60/TRACKS[track].bpm*32 : Infinity};
    this.changed(kind === 'preview' ? 'preview' : 'playing');
    this.pump(generation);
  }
  private pump(generation:number) {
    if(generation !== this.generation || !this.session || !this.ctx) return;
    const session=this.session;
    if(this.ctx.currentTime >= session.end) {this.stopSession(false);return;}
    session.clock.pump(this.ctx.currentTime,(step,time) => session.synth.note(step,time),session.end);
    this.timerId=this.timer(() => this.pump(generation),25);
  }
  private stopSession(preserveCursor=true) {
    this.generation++;
    this.pending=null;
    if(this.timerId !== null) {this.clearTimer(this.timerId);this.timerId=null;}
    const session=this.session;this.session=null;
    if(session && this.ctx) {
      if(preserveCursor && session.kind === 'game') this.cursor={track:session.track,step:session.clock.resumeStep(this.ctx.currentTime)};
      const now=this.ctx.currentTime;
      session.gain.gain.cancelScheduledValues(now);session.gain.gain.setTargetAtTime(0,now,0.003);
      session.synth.stop(now+0.02);
      // Disconnect the muted bus after the short fade, including feedback loops.
      this.timer(() => session.gain.disconnect(),50);
    }
    this.changed('idle');
  }
  dispose() {
    this.wantGame=false;this.stopSession(false);this.effectsSynth?.stop();
    const ctx=this.ctx;this.ctx=null;this.master=null;this.effectsGain=null;this.effectsSynth=null;
    if(ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
  }
}
