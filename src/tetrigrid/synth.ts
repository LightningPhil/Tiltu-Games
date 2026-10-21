/** Ported from the repository’s standalone TetraGrid; that app remains independent. */
import { TRACKS, notesForStep, type MusicTrack, type NoteEvent } from './music.ts';
export type Effect = 'move'|'rotate'|'hold'|'drop'|'clear'|'start';
type Voice = { sources:AudioScheduledSourceNode[]; nodes:AudioNode[]; finish:()=>void };
export class Synth {
  private voices = new Set<Voice>();
  private celloWave:PeriodicWave|null=null;
  readonly ctx:BaseAudioContext;
  readonly output:AudioNode;
  readonly track:MusicTrack;
  constructor(ctx:BaseAudioContext,output:AudioNode,track:MusicTrack='classic-house') {this.ctx=ctx;this.output=output;this.track=track;}
  get voiceCount() { return this.voices.size; }
  private own(sources:AudioScheduledSourceNode[],nodes:AudioNode[],cleanupAt?:number) {
    // A silent source keeps echo graphs alive for their tail, then releases them.
    if(cleanupAt !== undefined) {
      const cleanup = this.ctx.createConstantSource();cleanup.offset.value=0;
      sources.push(cleanup);nodes.push(cleanup);cleanup.start();cleanup.stop(cleanupAt);
    }
    let remaining=sources.length,finished=false;
    const voice:Voice={sources,nodes,finish:() => {
      if(finished) return;finished=true;
      nodes.forEach(node => node.disconnect());this.voices.delete(voice);
    }};
    sources.forEach(source => source.onended = () => {if(--remaining === 0) voice.finish();});
    this.voices.add(voice);
  }
  stop(time=this.ctx.currentTime) {
    for(const voice of this.voices) for(const source of voice.sources) {
      try {source.stop(time);} catch { /* Already-ended sources are harmless. */ }
    }
  }
  note(step:number,time:number) { for(const event of notesForStep(step,this.track)) this.instrument(event,time); }
  instrument(event:NoteEvent,t:number) {
    if(event.instrument === 'cello' || event.instrument === 'brush') {this.acoustic(event,t);return;}
    if(['arp','stab','pad','sub','perc','ride'].includes(event.instrument) || (this.track !== 'classic-house' && event.instrument === 'bass')) {
      this.techno(event,t);return;
    }
    const p=TRACKS[this.track];
    const velocity=event.velocity ?? 1;
    if(event.instrument === 'kick') {
      const osc=this.ctx.createOscillator(),g=this.ctx.createGain();
      osc.frequency.setValueAtTime(p.kickStart,t);osc.frequency.exponentialRampToValueAtTime(p.kickEnd,t+p.kickLength);
      g.gain.setValueAtTime(velocity,t);g.gain.exponentialRampToValueAtTime(0.01,t+p.kickLength);
      osc.connect(g);g.connect(this.output);this.own([osc],[osc,g]);osc.start(t);osc.stop(t+p.kickLength);
    } else if(['openHat','closedHat','clap'].includes(event.instrument)) {
      const clap=event.instrument === 'clap',open=event.instrument === 'openHat';
      const samples=clap ? 4096 : open ? 8096 : 2048;
      const noise=this.ctx.createBufferSource(),buffer=this.ctx.createBuffer(1,samples,this.ctx.sampleRate);
      const data=buffer.getChannelData(0);for(let i=0;i<samples;i++) data[i]=Math.random()*2-1;
      noise.buffer=buffer;
      const f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();
      f.type=clap ? 'bandpass' : 'highpass';f.frequency.value=event.cutoff ?? (clap ? 1200 : open ? 5000 : 6000);
      g.gain.setValueAtTime((clap ? 0.5*p.clap : (open ? 0.2 : 0.1)*p.hats)*velocity,t);
      g.gain.exponentialRampToValueAtTime(0.01,t+(clap ? 0.1 : open ? 0.2 : 0.05));
      noise.connect(f);f.connect(g);g.connect(this.output);this.own([noise],[noise,f,g],t+samples/this.ctx.sampleRate+0.04);noise.start(t);
    } else if(event.instrument === 'bass') {
      const freq=event.frequency!,osc=this.ctx.createOscillator(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();
      osc.type=p.bassWave;osc.frequency.value=freq;f.type='lowpass';f.Q.value=p.bassQ;
      f.frequency.setValueAtTime(freq,t);f.frequency.exponentialRampToValueAtTime(freq*p.bassSweep,t+0.05);f.frequency.exponentialRampToValueAtTime(freq,t+0.2);
      g.gain.setValueAtTime(0.05,t);g.gain.linearRampToValueAtTime(p.bassPeak,t+0.05);g.gain.exponentialRampToValueAtTime(0.01,t+0.3);
      osc.connect(f);f.connect(g);g.connect(this.output);this.own([osc],[osc,f,g],t+0.7);osc.start(t);osc.stop(t+0.3);
    } else {
      const freq=event.frequency!,osc=this.ctx.createOscillator(),osc2=this.ctx.createOscillator(),g=this.ctx.createGain();
      osc.type=p.leadWave;osc.frequency.value=freq;osc2.type=p.secondWave;osc2.frequency.value=freq+p.detune;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(p.leadPeak,t+p.leadAttack);g.gain.setTargetAtTime(0,t+0.1,0.1);
      const delay=this.ctx.createDelay(),feedback=this.ctx.createGain();delay.delayTime.value=60/p.bpm*0.75;feedback.gain.value=p.echo;
      const nodes:AudioNode[]=[osc,osc2,g,delay,feedback];
      osc.connect(g);osc2.connect(g);
      let send:AudioNode=g;
      if(p.leadFilter) {const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=p.leadFilter;g.connect(filter);send=filter;nodes.push(filter);}
      send.connect(this.output);send.connect(delay);delay.connect(feedback);feedback.connect(delay);feedback.connect(this.output);
      this.own([osc,osc2],nodes,t+p.leadLength+5);
      osc.start(t);osc.stop(t+p.leadLength);osc2.start(t);osc2.stop(t+p.leadLength);
    }
  }
  private techno(event:NoteEvent,t:number) {
    const p=TRACKS[this.track],velocity=event.velocity ?? 1,gate=event.gate ?? 0.12,freq=event.frequency ?? 220;
    const nodes:AudioNode[]=[],sources:AudioScheduledSourceNode[]=[];
    const gain=this.ctx.createGain();nodes.push(gain);
    let send:AudioNode=gain,finish=t+gate+0.1;
    if(event.instrument === 'ride') {
      const noise=this.ctx.createBufferSource(),buffer=this.ctx.createBuffer(1,Math.round(this.ctx.sampleRate*0.25),this.ctx.sampleRate);
      const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
      noise.buffer=buffer;
      const filter=this.ctx.createBiquadFilter();filter.type='highpass';filter.frequency.value=7800;
      noise.connect(filter);filter.connect(gain);nodes.push(noise,filter);sources.push(noise);
      gain.gain.setValueAtTime(0.2*velocity,t);gain.gain.exponentialRampToValueAtTime(0.001,t+0.23);finish=t+0.3;
    } else {
      const osc=this.ctx.createOscillator();nodes.push(osc);sources.push(osc);
      osc.type=event.instrument === 'sub' || event.instrument === 'perc' ? 'sine' : event.instrument === 'bass' ? p.bassWave : p.leadWave;
      osc.frequency.setValueAtTime(event.slideFrom ?? freq,t);
      if(event.slideFrom) osc.frequency.exponentialRampToValueAtTime(freq,t+Math.min(0.055,gate*0.5));
      if(event.instrument === 'perc') {
        osc.frequency.exponentialRampToValueAtTime(freq*0.45,t+gate);osc.connect(gain);
        gain.gain.setValueAtTime(0.16*velocity,t);gain.gain.exponentialRampToValueAtTime(0.001,t+gate);finish=t+gate+0.025;
      } else if(event.instrument === 'sub') {
        const octave=this.ctx.createOscillator();octave.type='triangle';octave.frequency.setValueAtTime(freq*0.5,t);
        osc.connect(gain);octave.connect(gain);nodes.push(octave);sources.push(octave);
        gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(0.2*velocity,t+0.025);
        gain.gain.linearRampToValueAtTime(0.14*velocity,t+gate*0.7);gain.gain.linearRampToValueAtTime(0,t+gate+0.05);finish=t+gate+0.06;
      } else {
        const filter=this.ctx.createBiquadFilter();filter.type='lowpass';nodes.push(filter);osc.connect(filter);filter.connect(gain);
        const cutoff=event.cutoff ?? 2400;
        if(event.instrument === 'bass') {
          filter.Q.value=p.bassQ;filter.frequency.setValueAtTime(Math.max(90,cutoff*0.35),t);
          filter.frequency.exponentialRampToValueAtTime(cutoff,t+0.018);filter.frequency.exponentialRampToValueAtTime(Math.max(90,cutoff*0.22),t+gate+0.05);
          // A short swell leaves room for each kick without changing the acid pitch.
          gain.gain.setValueAtTime(0.035*velocity,t);gain.gain.linearRampToValueAtTime(p.bassPeak*velocity,t+0.025);
          gain.gain.exponentialRampToValueAtTime(0.001,t+gate+0.04);finish=t+gate+0.08;
        } else {
          const second=this.ctx.createOscillator();second.type=p.secondWave;second.frequency.setValueAtTime(freq+p.detune,t);
          second.connect(filter);nodes.push(second);sources.push(second);
          const pad=event.instrument === 'pad',stab=event.instrument === 'stab';
          filter.Q.value=stab ? 2 : 0.7;filter.frequency.setValueAtTime(pad ? cutoff*0.7 : cutoff,t);
          filter.frequency.exponentialRampToValueAtTime(Math.max(200,cutoff*(pad ? 1.2 : 0.3)),t+gate);
          const attack=pad ? 0.25 : stab ? 0.009 : p.leadAttack;
          const peak=(pad ? 0.025 : stab ? 0.075 : p.leadPeak)*velocity;
          gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(peak,t+attack);
          if(pad) {gain.gain.linearRampToValueAtTime(peak*0.8,t+gate);gain.gain.linearRampToValueAtTime(0,t+gate+0.7);finish=t+gate+0.72;}
          else {gain.gain.exponentialRampToValueAtTime(0.001,t+gate+0.04);finish=t+gate+0.06;}
        }
      }
    }
    if(event.pan) {const pan=this.ctx.createStereoPanner();pan.pan.value=event.pan;send.connect(pan);nodes.push(pan);send=pan;}
    send.connect(this.output);
    const echo=event.echo ?? 0;
    let cleanup=finish+0.1;
    if(echo) {
      const delay=this.ctx.createDelay(),feedback=this.ctx.createGain();delay.delayTime.value=60/p.bpm*0.75;feedback.gain.value=echo;
      send.connect(delay);delay.connect(feedback);feedback.connect(delay);feedback.connect(this.output);nodes.push(delay,feedback);
      cleanup=finish+delay.delayTime.value*Math.ceil(Math.log(0.00001)/Math.log(echo));
    }
    const realSources=[...sources];
    this.own(sources,nodes,cleanup);
    for(const source of realSources) {source.start(t);source.stop(finish);}
  }
  private acoustic(event:NoteEvent,t:number) {
    const gate=event.gate ?? 0.16,velocity=event.velocity ?? 1;
    const gain=this.ctx.createGain(),pan=this.ctx.createStereoPanner();pan.pan.value=event.pan ?? 0;
    const sources:AudioScheduledSourceNode[]=[],nodes:AudioNode[]=[gain,pan];
    let finish=t+gate+0.075;
    if(event.instrument === 'brush') {
      const noise=this.ctx.createBufferSource(),buffer=this.ctx.createBuffer(1,Math.ceil(this.ctx.sampleRate*gate),this.ctx.sampleRate);
      const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
      noise.buffer=buffer;
      const filter=this.ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=2100;filter.Q.value=0.6;
      noise.connect(filter);filter.connect(gain);sources.push(noise);nodes.push(noise,filter);
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(0.035*velocity,t+0.012);
      gain.gain.linearRampToValueAtTime(0,t+gate);finish=t+gate+0.01;
    } else {
      // A cached harmonic bow waveform, mellow body resonance and subtle vibrato.
      // Synthesis keeps the complete game offline without a recorded cello sample.
      this.celloWave ??= this.ctx.createPeriodicWave(new Float32Array(9),new Float32Array([0,1,0.45,0.3,0.22,0.12,0.08,0.05,0.03]));
      const bow=this.ctx.createOscillator(),vibrato=this.ctx.createOscillator(),depth=this.ctx.createGain();
      bow.setPeriodicWave(this.celloWave);bow.frequency.setValueAtTime(event.frequency!,t);
      vibrato.frequency.value=4.8;depth.gain.setValueAtTime(0,t);depth.gain.linearRampToValueAtTime(3,t+0.1);
      vibrato.connect(depth);depth.connect(bow.detune);
      const body=this.ctx.createBiquadFilter(),filter=this.ctx.createBiquadFilter();
      body.type='peaking';body.frequency.value=230;body.Q.value=0.8;body.gain.value=2.5;
      filter.type='lowpass';filter.frequency.value=event.cutoff ?? 1400;filter.Q.value=0.6;
      bow.connect(body);body.connect(filter);filter.connect(gain);
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(0.2*velocity,t+0.035);
      gain.gain.linearRampToValueAtTime(0.15*velocity,t+gate);gain.gain.linearRampToValueAtTime(0,t+gate+0.07);
      sources.push(bow,vibrato);nodes.push(bow,vibrato,depth,body,filter);
      // A quiet, filtered room reflection gives space without rhythmic echo repeats.
      const room=this.ctx.createDelay(),damping=this.ctx.createBiquadFilter(),wet=this.ctx.createGain();
      room.delayTime.value=0.093;damping.type='lowpass';damping.frequency.value=1200;wet.gain.value=0.12;
      gain.connect(room);room.connect(damping);damping.connect(wet);wet.connect(pan);nodes.push(room,damping,wet);
    }
    gain.connect(pan);pan.connect(this.output);
    const realSources=[...sources];this.own(sources,nodes,finish+0.15);
    for(const source of realSources) {source.start(t);source.stop(finish);}
  }
  effect(kind:Effect) {
    if(kind === 'start') return; // The original game starts with its soundtrack alone.
    const t=this.ctx.currentTime,g=this.ctx.createGain(),o=this.ctx.createOscillator();g.connect(this.output);
    if(kind === 'move' || kind === 'hold') {
      o.type='triangle';o.frequency.setValueAtTime(300,t);o.frequency.linearRampToValueAtTime(600,t+0.05);
      g.gain.setValueAtTime(0.05,t);g.gain.linearRampToValueAtTime(0,t+0.05);
    } else if(kind === 'rotate') {
      o.type='square';o.frequency.setValueAtTime(200,t);o.frequency.linearRampToValueAtTime(400,t+0.05);
      g.gain.setValueAtTime(0.03,t);g.gain.linearRampToValueAtTime(0,t+0.05);
    } else if(kind === 'drop') {
      o.frequency.setValueAtTime(100,t);o.frequency.exponentialRampToValueAtTime(0.01,t+0.2);
      g.gain.setValueAtTime(0.2,t);g.gain.linearRampToValueAtTime(0,t+0.2);
    } else {
      o.type='sine';o.frequency.setValueAtTime(880,t);o.frequency.linearRampToValueAtTime(1760,t+0.3);
      g.gain.setValueAtTime(0.2,t);g.gain.linearRampToValueAtTime(0,t+0.3);
    }
    const length=kind === 'clear' ? 0.3 : kind === 'drop' ? 0.2 : 0.05;
    o.connect(g);this.own([o],[o,g]);o.start(t);o.stop(t+length);
  }
}
