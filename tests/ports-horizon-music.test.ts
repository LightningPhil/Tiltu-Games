import test from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC_TRACKS, SCORES, musicStep, arrangement, isMusicTrack, midiFrequency } from '../src/arcade-ports/horizon/soundtrack.ts';
import { parseSettings } from '../src/arcade-ports/horizon/game.ts';
import { TrancePlayer } from '../src/arcade-ports/horizon/music-player.ts';

test('seven distinct instrumental scores have bounded notes, deliberate sections and seamless score loops', () => {
    const signatures = new Set<string>();
    for (const id of Object.keys(SCORES) as (keyof typeof SCORES)[]) {
        const track = MUSIC_TRACKS[id]; assert.ok(track.bpm >= 136 && track.bpm <= 140);
        assert.equal(parseSettings(JSON.stringify({musicTrack:id})).musicTrack, id);
        let leads = 0, bass = 0, kicks = 0;
        for (let step = 0; step < track.bars * 16; step++) {
            const notes = musicStep(id, step);
            assert.ok(notes.length < 15);
            for (const note of notes) {
                assert.ok(Number.isFinite(note.duration) && note.duration > 0 && note.duration < 4);
                assert.ok(note.velocity > 0 && note.velocity <= 1); assert.ok(Math.abs(note.pan) <= 1);
                if (['pad','bass','lead','arp','pluck'].includes(note.instrument)) assert.ok(note.midi >= 24 && note.midi <= 100);
                if (note.instrument === 'lead' || note.instrument === 'pluck') leads++;
                if (note.instrument === 'bass') bass++;
                if (note.instrument === 'kick') kicks++;
                if (step >= 32*16 && step < 40*16) assert.ok(note.instrument !== 'kick' && note.instrument !== 'bass');
            }
        }
        assert.ok(leads > 100 && bass > 200 && kicks > 200);
        assert.deepEqual(musicStep(id, 0), musicStep(id, 1536));
        const first = Array.from({length:128},(_,i)=>musicStep(id,128+i).filter(n=>n.instrument==='lead'||n.instrument==='pluck'));
        const peak = Array.from({length:128},(_,i)=>musicStep(id,768+i).filter(n=>n.instrument==='lead'||n.instrument==='pluck'));
        assert.notDeepEqual(first, peak, 'the second release develops the melodic statement'); signatures.add(JSON.stringify(first));
    }
    assert.equal(signatures.size,7); assert.equal(Object.keys(MUSIC_TRACKS).length,8);
    assert.deepEqual([0,8,32,40,48,80,88,96].map(arrangement),['Launch','First light','Breakdown','Ascent','Euphoria','Afterglow','Return','Launch']);
    assert.equal(isMusicTrack('__proto__'),false); assert.equal(isMusicTrack('toString'),false);
    assert.equal(midiFrequency(69),440); assert.equal(parseSettings('{"musicTrack":"missing"}').musicTrack,'azure-signal');
});

class Param {
    value=0;
    setValueAtTime(v:number,t:number){assert.ok(Number.isFinite(v)&&Number.isFinite(t));this.value=v;}
    linearRampToValueAtTime(v:number,t:number){this.setValueAtTime(v,t);}
    exponentialRampToValueAtTime(v:number,t:number){assert.ok(v>0);this.setValueAtTime(v,t);}
    cancelScheduledValues(){}
}
class Node {
    gain=new Param();frequency=new Param();Q=new Param();pan=new Param();detune=new Param();delayTime=new Param();
    threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();
    onended:(()=>void)|null=null; disconnected=false; stopAt=Infinity; source=false;
    connect(){} disconnect(){this.disconnected=true;} start(){this.source=true;} stop(t:number){this.stopAt=t;}
}
class Context {
    currentTime=10;nodes:Node[]=[];
    create(){const n=new Node();this.nodes.push(n);return n;}
    createGain(){return this.create();}createOscillator(){return this.create();}createBufferSource(){return this.create();}
    createBiquadFilter(){return this.create();}createStereoPanner(){return this.create();}createDelay(){return this.create();}createDynamicsCompressor(){return this.create();}
    advance(t:number){this.currentTime=t;for(const n of this.nodes)if(n.onended&&n.stopAt<=t){const ended=n.onended;n.onended=null;ended();}}
}
test('track switches retire every source and delay graph; pause resumes the phrase; late schedulers stay bounded',()=>{
    const ctx=new Context(),output=ctx.create(),player=new TrancePlayer(ctx as any,output as any,{} as any,'azure-signal');
    player.start(true);assert.ok(player.step>=128);const count=ctx.nodes.length;player.start();assert.equal(ctx.nodes.length,count);
    let most=0;
    for(let t=10.05;t<33;t+=.05){ctx.advance(t);player.tick();most=Math.max(most,ctx.nodes.filter(n=>n.source&&!n.disconnected).length);}
    assert.ok(most<110,'active polyphony stays bounded through overlapping pads and lead tails');
    const old=ctx.nodes.slice(1),step=player.step;player.stop();ctx.advance(ctx.currentTime+.1);
    assert.ok(old.every(n=>n.disconnected));assert.equal(player.step,step);player.start();assert.ok(player.step>=step);
    for(const id of Object.keys(SCORES) as (keyof typeof SCORES)[]){
        const previous=ctx.nodes.slice(1);player.setTrack(id);ctx.advance(ctx.currentTime+.1);assert.ok(previous.every(n=>n.disconnected));
        player.tick();assert.ok(player.playing);
    }
    ctx.advance(ctx.currentTime+90);const before=ctx.nodes.length;player.tick();assert.ok(ctx.nodes.length-before<100,'a background backlog never creates a burst of old notes');
    player.rewind();assert.ok(player.step<16);player.stop();ctx.advance(ctx.currentTime+.1);assert.ok(ctx.nodes.slice(1).every(n=>n.disconnected));
});
