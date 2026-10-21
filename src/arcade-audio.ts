const hz=(m:number)=>440*Math.pow(2,(m-69)/12);
/** Archive Patrol’s local, adaptive 128 BPM EDM score. TetriGrid owns its five-track synth. */
export class ArcadeAudio {
  private context:AudioContext|null=null;private music:GainNode|null=null;private fx:GainNode|null=null;private compressor:DynamicsCompressorNode|null=null;
  private delay:DelayNode|null=null;private timer:ReturnType<typeof setInterval>|null=null;private next=0;private step=0;private playing=false;
  private noise:AudioBuffer|null=null;private revision=0;private intensity=0;
  enabled=true;effects=true;volume=.3;error='';
  get active():boolean{return this.playing&&!!this.context&&this.context.state==='running'&&this.enabled;}
  get position():number{return this.step;}
  setIntensity(value:number):void{this.intensity=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;}
  private initialise():boolean {
    try{if(this.context?.state==='closed')this.context=null;if(this.context)return true;
      const c=this.context=new AudioContext();this.music=c.createGain();this.fx=c.createGain();this.compressor=c.createDynamicsCompressor();
      this.compressor.threshold.value=-15;this.compressor.knee.value=12;this.compressor.ratio.value=5;this.compressor.connect(c.destination);
      this.music.connect(this.compressor);this.fx.connect(this.compressor);
      this.delay=c.createDelay(.8);this.delay.delayTime.value=.31;const feedback=c.createGain();feedback.gain.value=.22;
      const wet=c.createGain();wet.gain.value=.18;this.delay.connect(feedback);feedback.connect(this.delay);this.delay.connect(wet);wet.connect(this.music);
      this.noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const data=this.noise.getChannelData(0);let n=9173;for(let i=0;i<data.length;i++){n=Math.imul(n,1664525)+1013904223>>>0;data[i]=n/2147483648-1;}
      this.applyVolume();return true;
    }catch{this.error='Audio unavailable in this browser. Play continues silently.';return false;}
  }
  configure(enabled:boolean,volume:number,effects:boolean):void{this.enabled=enabled;this.volume=Math.max(0,Math.min(1,volume));this.effects=effects;this.applyVolume();}
  private applyVolume():void{if(this.context){this.music?.gain.setTargetAtTime(this.playing&&this.enabled?this.volume:0,this.context.currentTime,.045);this.fx?.gain.setTargetAtTime(this.playing&&this.effects?this.volume*.7:0,this.context.currentTime,.035);}}
  async start(_game:'salvage'):Promise<void>{
    const revision=++this.revision;if(!this.initialise())return;const c=this.context!;try{await c.resume();}catch{this.error='Tap Music to enable audio.';return;}if(revision!==this.revision)return;this.error='';
    this.playing=true;this.applyVolume();
    if(!this.timer){this.next=c.currentTime+.045;this.timer=setInterval(()=>this.schedule(),25);}this.schedule();
  }
  pause():void{this.revision++;this.playing=false;if(this.timer)clearInterval(this.timer);this.timer=null;this.applyVolume();this.next=0;}
  dispose():void{this.pause();void this.context?.close().catch(()=>{});this.context=null;}
  private tone(midi:number,t:number,length:number,gain:number,type:OscillatorType='sine',destination?:AudioNode,cutoff=1800):void{
    const c=this.context!;const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.type=type;o.frequency.value=hz(midi);f.type='lowpass';f.frequency.setValueAtTime(cutoff,t);f.frequency.exponentialRampToValueAtTime(Math.max(100,cutoff*.3),t+length);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.001,gain),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+length);o.connect(f);f.connect(g);g.connect(destination??this.music!);if(destination===this.delay)g.connect(this.music!);o.start(t);o.stop(t+length+.01);o.onended=()=>{o.disconnect();f.disconnect();g.disconnect();};
  }
  private kick(t:number,gain=.65):void{const c=this.context!,o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(42,t+.15);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+.24);o.connect(g);g.connect(this.music!);o.start(t);o.stop(t+.25);o.onended=()=>{o.disconnect();g.disconnect();};}
  private percussion(t:number,gain:number,cutoff:number,length:number,destination?:AudioNode):void{const c=this.context!,n=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();n.buffer=this.noise;f.type='highpass';f.frequency.value=cutoff;g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+length);n.connect(f);f.connect(g);g.connect(destination??this.music!);n.start(t);n.stop(t+length+.01);n.onended=()=>{n.disconnect();f.disconnect();g.disconnect();};}
  private chirp(from:number,to:number,t:number,length:number,gain:number,type:OscillatorType='sine'):void{const c=this.context!,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(hz(from),t);o.frequency.exponentialRampToValueAtTime(hz(to),t+length);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+length);o.connect(g);g.connect(this.fx!);o.start(t);o.stop(t+length+.01);o.onended=()=>{o.disconnect();g.disconnect();};}
  private schedule():void{
    if(!this.context||!this.playing)return;const c=this.context,interval=60/128/4;
    if(this.next<c.currentTime-.1)this.next=c.currentTime+.025;
    while(this.next<c.currentTime+.12){const n=this.step++,t=this.next;this.next+=interval;if(!this.enabled||!this.volume)continue;
      {
        const bar=n%16,root=36+[0,0,3,-2][Math.floor(n/64)%4],drive=this.intensity;if(n%4===0)this.kick(t,.4+drive*.18);
        if(n%4===2)this.percussion(t,.055+drive*.04,6000,.09);if(bar===4||bar===12)this.percussion(t,.13+drive*.06,1100,.12);
        if(drive>.55&&n%2===1)this.percussion(t,.025,8000,.027);
        if(n%2===1)this.tone(root+(n%8===7?12:0),t,.11,.12+drive*.05,'sawtooth',undefined,650+drive*650);
        if(n%2===0)this.tone(root+24+[0,7,12,15,7,19,12,10][Math.floor(n/2)%8],t,.15,.04+drive*.025,'triangle',this.delay!,2400+drive*1000);
        if(drive>.7&&[3,7,11,15].includes(bar))this.tone(root+36+[7,12,10,15][Math.floor(bar/4)],t,.08,.025,'sine',this.delay!,4200);
        if(bar===0||bar===10)for(const note of [0,7,15])this.tone(root+12+note,t,.32,.035,'sawtooth',this.delay!,1200);
      }
    }
  }
  effect(kind:'move'|'lock'|'clear'|'collect'|'shot'|'hit'|'dock'|'boost'|'pulse'|'scan'|'explosion'|'powerup'):void{
    if(!this.context||!this.playing||!this.effects)return;const t=this.context.currentTime;
    if(kind==='boost'){this.chirp(38,65,t,.22,.12,'triangle');this.percussion(t,.035,1700,.16,this.fx!);return;}
    if(kind==='pulse'){this.chirp(55,27,t,.38,.19);this.chirp(76,42,t,.24,.05);return;}
    if(kind==='scan'){[60,67,72,79].forEach((note,i)=>this.tone(note,t+i*.08,.19,.085,'sine',this.fx!,2400));return;}
    if(kind==='explosion'){this.chirp(39,19,t,.3,.16,'triangle');this.percussion(t,.2,130,.28,this.fx!);return;}
    if(kind==='shot'){this.chirp(87,54,t,.065,.055,'triangle');return;}
    if(kind==='powerup'){[67,74,79,86].forEach((note,i)=>this.tone(note,t+i*.045,.2,.11,'triangle',this.fx!,3000));return;}
    const notes={move:[58],lock:[42,49],clear:[60,67,74],collect:[76,83],hit:[32,33],dock:[48,55,60,67]}[kind];
    notes.forEach((n,i)=>this.tone(n,t+i*.045,.14,.13,kind==='hit'?'sawtooth':'sine',this.fx!,2000));
  }
}
