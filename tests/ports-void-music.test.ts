import test from 'node:test';
import assert from 'node:assert/strict';
import {MUSIC_TRACKS,DEFAULT_MUSIC_TRACK,MusicPlayer,musicStep,isMusicTrack,midiFrequency} from '../src/arcade-ports/void/music.ts';
import {createProfile,loadProfile,saveProfile} from '../src/arcade-ports/void/progress.ts';
import {loadGame} from './ports-void-harness.ts';
import {POLYMETRIC_TRACKS,POLYMETRIC_PATTERNS} from '../src/arcade-ports/void/polymetric-scores.ts';

test('nine distinct soundtracks include the exact original bass sequence and eight complete arrangements',()=>{
    assert.equal(Object.keys(MUSIC_TRACKS).length,9);
    const original=[110,110,220,110,130.8,130.8,261.6,130.8,98,98,196,98,110,110,164.8,110];
    for(let i=0;i<32;i++){
        const notes=musicStep('original',i);assert.equal(notes.length,1);
        assert.equal(notes[0].frequency,original[i%16]/2);assert.equal(notes[0].duration,.2);assert.equal(notes[0].velocity,.5);
    }
    assert.equal(MUSIC_TRACKS.original.bpm,140);assert.equal(midiFrequency(69),440);
    const scores=new Set();
    for(const id of Object.keys(MUSIC_TRACKS).filter(id=>id!=='original')){
        const track=MUSIC_TRACKS[id],instruments=new Set(),notes=[];
        assert.ok(track.bars>=64);assert.ok(track.bars*4*60/track.bpm>100);
        for(let step=0;step<track.bars*16;step++){
            const events=musicStep(id,step);assert.ok(events.length<=16);
            for(const event of events){
                instruments.add(event.instrument);notes.push([step,event.instrument,event.midi]);
                assert.ok(Number.isFinite(event.midi)&&event.midi>=0&&event.midi<=108);
                assert.ok(Number.isFinite(event.duration)&&event.duration>0);
                assert.ok(event.velocity>0&&event.velocity<=1);assert.ok(Math.abs(event.pan)<=1);
            }
        }
        for(const instrument of [id in POLYMETRIC_TRACKS?'sub':'bass','pad','arp','hat',id==='last-horizon'?'taiko':'kick'])assert.ok(instruments.has(instrument),`${id} missing ${instrument}`);
        assert.ok(instruments.has('lead')||instruments.has('bell')||instruments.has('piano'));
        const section=(bar)=>Array.from({length:16},(_,i)=>musicStep(id,bar*16+i));
        assert.notDeepEqual(section(0),section(8));assert.notDeepEqual(section(8),section(40));
        assert.ok(section(id==='phase-lancer'?32:24).flat().every(note=>!['kick','snare','hat','clap','openHat'].includes(note.instrument)));
        assert.deepEqual(musicStep(id,track.bars*16),musicStep(id,0));scores.add(JSON.stringify(notes));
    }
    assert.equal(scores.size,8);
});

test('polymetric layers retain their independent clocks across bars, harmony changes and breakdowns',()=>{
    const gcd=(a,b)=>b?gcd(b,a%b):a,lcm=(a,b)=>a/gcd(a,b)*b;
    for(const [id,patterns]of Object.entries(POLYMETRIC_PATTERNS)){
        const track=POLYMETRIC_TRACKS[id],lengths=[16,...Object.values(patterns).map(p=>p.length)];
        const alignment=lengths.reduce(lcm);
        assert.equal(alignment,id==='obsidian-circuit'?1680:1008);
        assert.equal((track.bars*16)%alignment,0,'loop must end on a complete rhythmic alignment');
        for(let step=1;step<alignment;step++)assert.ok(lengths.some(length=>step%length!==0),'layers must not all converge early');
        const hits=(step,instrument)=>musicStep(id,step).filter(n=>n.instrument===instrument);
        // Check several real boundaries, including the return from the first
        // breakdown. A bar/section-local sequencer would restart at index zero.
        for(const boundary of [8,14,32,40,48,56])for(let offset=0;offset<32;offset++){
            const step=boundary*16+offset;
            assert.equal(hits(step,'sub').length,patterns.bass[step%patterns.bass.length]===-99?0:1,`${id} bass clock at ${step}`);
            assert.equal(hits(step,'pluck').length,patterns.arp[step%patterns.arp.length]===-99?0:1,`${id} melodic clock at ${step}`);
            assert.equal(hits(step,'rim').length,patterns.percussion[step%patterns.percussion.length]?1:0,`${id} percussion clock at ${step}`);
        }
        assert.notDeepEqual(Array.from({length:16},(_,i)=>hits(40*16+i,'sub').length),Array.from({length:16},(_,i)=>hits(41*16+i,'sub').length));
        // Muted layers keep counting while absent: re-entry uses the global
        // phase, so the first note need not land on the first beat.
        assert.equal(hits(24*16,'kick').length,0);
        assert.equal(hits(32*16,'pluck').length,patterns.arp[32*16%patterns.arp.length]===-99?0:1);
        for(let offset=0;offset<64;offset++)assert.deepEqual(musicStep(id,track.bars*16+offset),musicStep(id,offset));
        assert.ok(track.bpm>=140);assert.ok(track.bars*4*60/track.bpm>=300);
    }
});

test('new scores build through distinct long sections while keeping a driving pulse',()=>{
    for(const id of Object.keys(POLYMETRIC_TRACKS)){
        const bars=[8,40,id==='obsidian-circuit'?88:112,id==='obsidian-circuit'?176:216];
        const sections=bars.map(bar=>Array.from({length:16*8},(_,i)=>musicStep(id,bar*16+i)).flat());
        for(const section of sections){
            assert.ok(section.filter(n=>n.instrument==='kick').length>=32);
            assert.ok(section.filter(n=>n.instrument==='snare').length>=16);
            for(const instrument of ['sub','pluck','dub','rim'])assert.ok(section.some(n=>n.instrument===instrument),`${id}: ${instrument} must be audible`);
        }
        assert.ok(sections[2].filter(n=>n.instrument==='hat').length>sections[1].filter(n=>n.instrument==='hat').length,'later build adds rhythmic energy');
        assert.notDeepEqual(sections[2],sections[3],'late return develops the first peak');
    }
});

class AudioParamMock {
    value=0;events=[];
    setValueAtTime(value,time){this.value=value;this.events.push([value,time]);}
    linearRampToValueAtTime(value,time){this.value=value;this.events.push([value,time]);}
    exponentialRampToValueAtTime(value,time){assert.ok(value>0);this.value=value;this.events.push([value,time]);}
    cancelScheduledValues(_time){}
}
class AudioNodeMock {
    context;connections=[];disconnected=false;type='';onended=null;startTime=null;endTime=null;buffer=null;
    gain=new AudioParamMock();frequency=new AudioParamMock();Q=new AudioParamMock();pan=new AudioParamMock();detune=new AudioParamMock();
    threshold=new AudioParamMock();knee=new AudioParamMock();ratio=new AudioParamMock();attack=new AudioParamMock();release=new AudioParamMock();delayTime=new AudioParamMock();
    constructor(context){this.context=context;}
    connect(node){this.connections.push(node);return node;}
    disconnect(){this.disconnected=true;}
    start(time){assert.ok(time>=this.context.currentTime);assert.equal(this.startTime,null);this.startTime=time;}
    stop(time){this.endTime=time;}
}
class AudioContextMock {
    currentTime=0;sampleRate=22050;nodes=[];
    make(){const node=new AudioNodeMock(this);this.nodes.push(node);return node;}
    createGain(){return this.make();}createOscillator(){return this.make();}createBiquadFilter(){return this.make();}
    createStereoPanner(){return this.make();}createBufferSource(){return this.make();}createDelay(_time){return this.make();}createDynamicsCompressor(){return this.make();}
    createBuffer(_channels,length,_rate){return {getChannelData:()=>new Float32Array(length)};}
    advanceTo(time){this.currentTime=time;for(const node of this.nodes)if(node.onended&&node.endTime<=time){const ended=node.onended;node.onended=null;ended();}}
}

test('the audio scheduler stays ahead of playback, skips stalled time, and releases old voices when switching or stopping',()=>{
    const ctx=new AudioContextMock(),output=ctx.createGain(),player=new MusicPlayer(ctx,output,'neon-run');
    player.start();const first=ctx.nodes.filter(n=>n.startTime!==null);assert.ok(first.length>0);
    player.start();assert.equal(ctx.nodes.filter(n=>n.startTime!==null).length,first.length);
    for(const id of ['ion-storm','overdrive','corebreaker','last-horizon','phase-lancer','obsidian-circuit','ghost-vector','original','neon-run']){
        ctx.advanceTo(ctx.currentTime+.1);const old=ctx.nodes.filter(n=>n.startTime!==null&&!n.disconnected);
        assert.equal(player.setTrack(id),true);assert.ok(old.every(n=>n.endTime<=ctx.currentTime+.041));
        const before=ctx.nodes.length;assert.equal(player.setTrack(id),false);assert.equal(ctx.nodes.length,before);
        ctx.advanceTo(ctx.currentTime+.05);assert.ok(old.every(n=>n.disconnected));
        const step=player.step;player.tick();assert.ok(player.step>=step);
    }
    ctx.advanceTo(60);player.tick();assert.ok(player.nextTime>60&&player.nextTime<60.3);
    ctx.advanceTo(60.14);player.tick();
    const recent=ctx.nodes.filter(n=>n.startTime>=60);assert.ok(recent.length>0);assert.ok(recent.every(n=>n.startTime<60.26));
    player.stop();ctx.advanceTo(60.2);assert.equal(player.playing,false);
    assert.ok(ctx.nodes.filter(n=>n.startTime!==null).every(n=>n.disconnected));
    const count=ctx.nodes.length;player.tick();player.stop();assert.equal(ctx.nodes.length,count);
    player.start();assert.equal(player.playing,true);assert.ok(player.step>0&&player.step<3);
});

test('long polymetric scores play beyond the old loop limit and wrap only on their own alignment',()=>{
    for(const id of Object.keys(POLYMETRIC_TRACKS)){
        const ctx=new AudioContextMock(),player=new MusicPlayer(ctx,ctx.createGain(),id);player.start();
        player.step=64*16-1;player.nextTime=.04;player.tick();assert.equal(player.step,64*16);
        ctx.advanceTo(.1);player.tick();assert.ok(player.step>64*16,'must not restart after the previous 64-bar limit');
        player.step=MUSIC_TRACKS[id].bars*16-1;player.nextTime=ctx.currentTime+.04;player.tick();assert.equal(player.step,0);
        player.stop();ctx.advanceTo(ctx.currentTime+.1);assert.ok(ctx.nodes.filter(n=>n.startTime!==null).every(n=>n.disconnected));
    }
});

test('soundtrack choices persist independently of volume and old profiles receive the new default',()=>{
    let data='';const store={getItem:()=>data,setItem:(_key,value)=>data=value};
    assert.equal(createProfile().settings.musicTrack,DEFAULT_MUSIC_TRACK);
    data=JSON.stringify({settings:{musicTrack:'starlight-drift',music:.4,sfx:.7}});
    const migrated=loadProfile(store);assert.equal(migrated.settings.musicTrack,'overdrive');
    assert.equal(migrated.settings.music,.4);assert.equal(migrated.settings.sfx,.7);
    assert.equal(isMusicTrack('starlight-drift'),false);
    assert.equal(MUSIC_TRACKS.overdrive.bpm,138);
    const groove=Array.from({length:16},(_,i)=>musicStep('overdrive',8*16+i)).flat();
    assert.ok(groove.filter(note=>note.instrument==='kick').length>=4);
    assert.ok(groove.filter(note=>note.instrument==='bass').length>=10);
    assert.ok(groove.filter(note=>note.instrument==='lead').length>=8);
    for(const id of Object.keys(MUSIC_TRACKS)){
        const profile=createProfile();profile.settings.musicTrack=id;profile.settings.music=.4;profile.settings.sfx=.7;
        assert.equal(saveProfile(profile,store),true);assert.deepEqual(loadProfile(store),profile);
    }
    for(const id of [undefined,'constructor','__proto__','missing',42,null]){
        data=JSON.stringify({settings:{musicTrack:id,music:.6,muted:true}});
        const profile=loadProfile(store);assert.equal(profile.settings.musicTrack,DEFAULT_MUSIC_TRACK);
        assert.equal(profile.settings.music,.6);assert.equal(profile.settings.muted,true);assert.equal(isMusicTrack(id),false);
    }
});

test('choosing a track in pause settings changes music without moving the ship or disturbing the run',()=>{
    const {Game,AudioEngine,elements}=loadGame();Game.recordable=false;Game.coins=765;Game.player.hull=53;Game.togglePause();
    let selected='';AudioEngine.selectTrack=id=>selected=id;
    const elapsed=Game.elapsed,x=Game.player.x;
    for(const id of Object.keys(MUSIC_TRACKS)){
        Game.setPreference('musicTrack',id);assert.equal(Game.profile.settings.musicTrack,id);assert.equal(selected,id);
        assert.equal(elements.get('music-track-name').innerText,MUSIC_TRACKS[id].name);
        Game.update(1000/60);assert.equal(Game.elapsed,elapsed);assert.equal(Game.player.x,x);assert.equal(Game.player.hull,53);assert.equal(Game.coins,765);
        assert.equal(Game.paused,true);
    }
    Game.setPreference('musicTrack','missing');assert.equal(Game.profile.settings.musicTrack,'original');
    Game.setPreference('music',0);assert.match(elements.get('music-listening-note').innerText,/VOLUME IS ZERO/);
    Game.setPreference('muted',true);assert.match(elements.get('music-listening-note').innerText,/SOUND MUTED/);
    Game.togglePause();assert.equal(Game.paused,false);assert.equal(Game.profile.settings.musicTrack,'original');
});

test('muting effects or setting them to zero skips synthesis without changing music preferences',()=>{
    const {Game,AudioEngine,originalAudio}=loadGame();AudioEngine.ctx={};
    assert.equal(originalAudio.sfxEnabled.call(AudioEngine),true);
    Game.profile.settings.muted=true;assert.equal(originalAudio.sfxEnabled.call(AudioEngine),false);
    Game.profile.settings.muted=false;Game.profile.settings.sfx=0;assert.equal(originalAudio.sfxEnabled.call(AudioEngine),false);
    Game.profile.settings.sfx=.5;Game.profile.settings.music=0;assert.equal(originalAudio.sfxEnabled.call(AudioEngine),true);
});
