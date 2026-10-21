import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine, engineVoice } from '../src/arcade-ports/horizon/audio.ts';

class Parameter {
    value = 0;
    values: number[] = [];
    setValueAtTime(value: number) { assert.ok(Number.isFinite(value)); this.values.push(value); this.value = value; }
    setTargetAtTime(value: number) { this.setValueAtTime(value); }
    linearRampToValueAtTime(value: number) { this.setValueAtTime(value); }
    cancelScheduledValues() {}
    exponentialRampToValueAtTime(value: number) { assert.ok(value > 0); this.setValueAtTime(value); }
}

test('engine stays in the bass register and boost adds roar without a turbine whine', () => {
    for (const speed of [0, 60, 108, 180, 225, 999]) {
        const cruise = engineVoice(speed, false), boost = engineVoice(speed, true);
        assert.ok(cruise.fundamental >= 29 && boost.fundamental <= 46);
        assert.ok(cruise.sub >= 23 && boost.sub <= 33);
        assert.ok(boost.cutoff <= 310); assert.ok(boost.roar > cruise.roar * 2);
        assert.ok(boost.rumble > cruise.rumble); assert.ok(boost.fundamental - cruise.fundamental <= 4);
    }
});
class Node {
    gain = new Parameter(); frequency = new Parameter(); Q = new Parameter(); pan = new Parameter();
    detune = new Parameter(); delayTime = new Parameter();
    threshold = new Parameter(); knee = new Parameter(); ratio = new Parameter(); attack = new Parameter(); release = new Parameter();
    connections = 0; disconnected = false; loop = false; onended: (() => void) | null = null;
    connect() { this.connections++; }
    disconnect() { this.disconnected = true; }
    start() {}
    stop() { this.onended?.(); }
}
class Context {
    currentTime = 10; sampleRate = 48000; state = 'suspended'; destination = new Node();
    nodes: Node[] = []; bufferCount = 0; resumeCount = 0;
    create() { const node = new Node(); this.nodes.push(node); return node; }
    createGain() { return this.create(); } createOscillator() { return this.create(); }
    createBiquadFilter() { return this.create(); } createBufferSource() { return this.create(); }
    createDelay() { return this.create(); }
    createStereoPanner() { return this.create(); } createDynamicsCompressor() { return this.create(); }
    createBuffer(_channels: number, length: number) { this.bufferCount++; const data = new Float32Array(length); return { getChannelData: () => data }; }
    async resume() { this.resumeCount++; this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
}

test('flight audio shares buffers, respects the mixer, cleans up voices and has one guarded scheduler', () => {
    const previousWindow = (globalThis as any).window; let timers = 0; const callbacks = new Map<number, () => void>();
    (globalThis as any).window = { AudioContext: Context, setTimeout: callback => { callbacks.set(++timers, callback); return timers; } };
    try {
        AudioEngine.configure(true, .4, .7, true); const ctx = AudioEngine.ctx as unknown as Context;
        assert.equal(ctx.resumeCount, 1); assert.equal(ctx.bufferCount, 2);
        const engineVoices = ctx.nodes.length;
        for (let i = 0; i < 200; i++) AudioEngine.updateFlight({ speed: i * 2, boost: i > 100, brake: false, turn: .7, shields: 80, intensity: .9 });
        assert.equal(ctx.nodes.length, engineVoices, 'continuous flight updates allocate no additional voices');
        AudioEngine.startMusic(); const firstTimer = timers; AudioEngine.startMusic(); assert.equal(timers, firstTimer, 'starting twice cannot duplicate the sequencer');
        const token = AudioEngine.schedulerToken; AudioEngine.stopMusic(); AudioEngine.scheduler(token); assert.equal(timers, firstTimer, 'an old timer cannot revive paused music');
        assert.equal(AudioEngine.musicGain!.gain.value, 0);
        const before = ctx.nodes.length;
        AudioEngine.sfxLaser(); AudioEngine.sfxExplosion(-.8, 300, true); AudioEngine.flyby(.5); AudioEngine.hostile(-.7, 450, true); AudioEngine.impact(true);
        for (const kind of ['hit', 'gate', 'pulse', 'warning', 'victory', 'threat', 'evade'] as const) AudioEngine.cue(kind, .3);
        assert.equal(ctx.bufferCount, 2, 'percussion and explosions reuse their buffer while the engine keeps its low rumble buffer');
        assert.ok(ctx.nodes.slice(before).every(node => node.disconnected), 'one-shot nodes disconnect when their source ends');
        AudioEngine.configure(false, 1, 1, false); assert.equal(AudioEngine.masterGain!.gain.value, 0); assert.equal(AudioEngine.engineGain!.gain.value, 0);
        const suspend = callbacks.get(AudioEngine.suspendTimer)!; suspend(); assert.equal(ctx.state, 'suspended', 'a quiet paused game releases the audio device after effect tails finish');
        const mutedVoices = ctx.nodes.length; AudioEngine.sfxLaser(); AudioEngine.cue('gate'); assert.equal(ctx.nodes.length, mutedVoices);
        AudioEngine.configure(true, 0, 0, false); assert.equal(AudioEngine.effectsGain!.gain.value, 0); assert.equal(AudioEngine.engineGain!.gain.value, 0);
        AudioEngine.configure(true, .4, .7, true); assert.equal(AudioEngine.engineGain!.gain.value, 1); assert.equal(ctx.bufferCount, 2);
        assert.equal(ctx.state, 'running'); suspend(); assert.equal(ctx.state, 'running', 'a stale pause cannot suspend a resumed flight');
        AudioEngine.configure(true, .4, .7, false, true); AudioEngine.startMusic(true);
        assert.equal(AudioEngine.engineGain!.gain.value, 0, 'music previews do not start the engine');
        assert.ok(AudioEngine.musicGain!.gain.value > 0);
        for (const track of ['vector-rush','synthwave','radiant-skies','azure-signal'] as const) {
            const token = AudioEngine.schedulerToken; AudioEngine.selectMusic(track); AudioEngine.scheduler(token);
            assert.equal(AudioEngine.musicTrack, track); assert.equal(AudioEngine.isPlaying, true); assert.equal(ctx.bufferCount, 2);
        }
        suspend(); assert.equal(ctx.state, 'running', 'a stale pause cannot suspend a music preview');
    } finally { AudioEngine.stopMusic(); (globalThis as any).window = previousWindow; }
});

