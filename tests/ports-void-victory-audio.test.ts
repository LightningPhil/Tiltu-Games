import test from 'node:test';
import assert from 'node:assert/strict';
import {playVictorySting,VICTORY_STING_DURATION} from '../src/arcade-ports/void/victory-audio.ts';

class Param {
    value=0;
    setValueAtTime(value,time){assert.ok(Number.isFinite(value)&&Number.isFinite(time));this.value=value;}
    linearRampToValueAtTime(value,time){this.setValueAtTime(value,time);}
    exponentialRampToValueAtTime(value,time){assert.ok(value>0);this.setValueAtTime(value,time);}
    cancelScheduledValues(){}
}
class Node {
    context;disconnected=false;connections=[];startTime=null;stopTime=null;onended=null;
    gain=new Param();frequency=new Param();detune=new Param();pan=new Param();Q=new Param();
    threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();
    constructor(context){this.context=context;}
    connect(node){this.connections.push(node);return node;}
    disconnect(){this.disconnected=true;}
    start(time){assert.ok(time>=this.context.currentTime);this.startTime=time;}
    stop(time){assert.ok(time>=this.context.currentTime);this.stopTime=time;}
}
class Context {
    currentTime=7;sampleRate=22050;nodes=[];
    make(){const node=new Node(this);this.nodes.push(node);return node;}
    createGain(){return this.make();}createDynamicsCompressor(){return this.make();}createConvolver(){return this.make();}
    createOscillator(){return this.make();}createBiquadFilter(){return this.make();}createStereoPanner(){return this.make();}createBufferSource(){return this.make();}
    createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return{getChannelData:channel=>data[channel]};}
    advanceTo(time){this.currentTime=time;for(const node of this.nodes)if(node.onended&&node.stopTime<=time){const ended=node.onended;node.onended=null;ended();}}
}

test('victory fanfare routes through the supplied effects bus and releases all voices and room effects',()=>{
    const ctx=new Context(),bus=ctx.createGain(),sting=playVictorySting(ctx as any,bus as any);
    const voices=ctx.nodes.filter(node=>node.startTime!==null);
    assert.ok(voices.length>40);assert.ok(voices.every(node=>node.stopTime>node.startTime));
    assert.ok(voices.every(node=>node.stopTime<7+VICTORY_STING_DURATION+.1));
    assert.equal(ctx.nodes.filter(node=>node.connections.includes(bus)).length,1);
    assert.ok(ctx.nodes.some(node=>node.type==='sawtooth'&&node.frequency.value<200));
    ctx.advanceTo(7+VICTORY_STING_DURATION+.1);
    assert.ok(ctx.nodes.filter(node=>node!==bus).every(node=>node.disconnected));
    assert.equal(bus.disconnected,false);assert.doesNotThrow(()=>sting.stop());
});

test('cancelling a fanfare fades out and cancels even the brass notes scheduled in the future',()=>{
    const ctx=new Context(),bus=ctx.createGain(),sting=playVictorySting(ctx as any,bus as any);
    ctx.advanceTo(7.2);sting.stop();sting.stop();
    assert.ok(ctx.nodes.filter(node=>node.startTime!==null).every(node=>node.stopTime<=7.251));
    ctx.advanceTo(7.26);
    assert.ok(ctx.nodes.filter(node=>node!==bus).every(node=>node.disconnected));
});
