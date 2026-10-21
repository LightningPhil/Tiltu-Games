import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/arcade-ports/ballistics/settings.ts';

class Param {
    value = 0;
    values: number[] = [];
    record(value: number, time = 0) { assert.ok(Number.isFinite(value) && Number.isFinite(time), 'Audio automation must be finite'); assert.ok(time >= 0); this.values.push(value); this.value = value; }
    setValueAtTime(value: number, time: number) { this.record(value, time); }
    linearRampToValueAtTime(value: number, time: number) { this.record(value, time); }
    exponentialRampToValueAtTime(value: number, time: number) { assert.ok(value > 0); this.record(value, time); }
    setTargetAtTime(value: number, time: number, constant: number) { assert.ok(constant > 0); this.record(value, time); }
}
class Node {
    gain = new Param(); frequency = new Param(); pan = new Param(); Q = new Param();
    threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param();
    type = ''; buffer: unknown = null; loop = false; starts = 0; stops = 0;
    onended: (() => void) | null = null;
    connect(_node: unknown) { return _node; }
    disconnect() {}
    start(time = 0, _offset = 0, _duration = 0) { assert.ok(Number.isFinite(time) && time >= 0); this.starts++; }
    stop(time = 0) { assert.ok(Number.isFinite(time) && time >= 0); this.stops++; }
}
class FakeAudioContext {
    static created = 0;
    sampleRate = 24000; currentTime = 0; state = 'suspended'; destination = new Node();
    oscillators: Node[] = []; gains: Node[] = []; panners: Node[] = []; compressors: Node[] = [];
    constructor() { FakeAudioContext.created++; }
    createGain() { const node = new Node(); this.gains.push(node); return node; }
    createOscillator() { const node = new Node(); this.oscillators.push(node); return node; }
    createStereoPanner() { const node = new Node(); this.panners.push(node); return node; }
    createBiquadFilter() { return new Node(); }
    createBufferSource() { return new Node(); }
    createDynamicsCompressor() { const node = new Node(); this.compressors.push(node); return node; }
    createBuffer(_channels: number, length: number, _rate: number) { return { getChannelData: () => new Float32Array(length) }; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
}

test('synth tracks and combat audio schedule finite envelopes, clamp stereo positions, mute, pause and reuse one context', async () => {
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = { AudioContext: FakeAudioContext };
    const { AudioEngine } = await import('../src/arcade-ports/ballistics/audio.ts');
    try {
        AudioEngine.init(); AudioEngine.init();
        assert.equal(FakeAudioContext.created, 1);
        const ctx = AudioEngine.ctx as unknown as FakeAudioContext;
        assert.equal(ctx.compressors.length, 1);
        assert.ok(ctx.compressors[0].ratio.value >= 4, 'Explosions need dynamic range control');
        AudioEngine.configure(DEFAULTS); AudioEngine.resume(); assert.equal(ctx.state, 'running');
        for (let track = 0; track < 3; track++) {
            AudioEngine.configure({ ...DEFAULTS, track });
            for (let step = 0; step < 130; step++) { ctx.currentTime += 0.11; (AudioEngine as any).schedule(); }
        }
        const musicalVoices = ctx.oscillators.length; assert.ok(musicalVoices > 200);
        for (const pan of [-10, 0, 10]) {
            for (let weapon = 0; weapon < 10; weapon++) AudioEngine.launch(weapon, pan);
            AudioEngine.explosion(90, pan); AudioEngine.impact(pan); AudioEngine.bounce(pan);
            AudioEngine.grapple(pan); AudioEngine.parachute(pan); AudioEngine.jump(pan); AudioEngine.pickup(pan); AudioEngine.splash(pan);
            AudioEngine.environment(0.024, true, true, pan); ctx.currentTime += 0.2;
        }
        AudioEngine.charge(0.3); const charged = ctx.oscillators.length;
        AudioEngine.charge(1); assert.equal(ctx.oscillators.length, charged, 'Charging must reuse a single oscillator');
        AudioEngine.charge(0); AudioEngine.charge(0);
        for (let second = 5; second >= 1; second--) { AudioEngine.warning(second); AudioEngine.warning(second); }
        AudioEngine.turn(1); AudioEngine.victory(); AudioEngine.victory(true); AudioEngine.fuse(50);
        assert.ok(ctx.panners.every(node => node.pan.value >= -0.85 && node.pan.value <= 0.85));
        AudioEngine.configure({ ...DEFAULTS, muted: true }); assert.equal(ctx.gains[0].gain.value, 0);
        AudioEngine.pause(); assert.equal(ctx.state, 'suspended');
        const before = ctx.oscillators.length; (AudioEngine as any).schedule(); assert.equal(ctx.oscillators.length, before);
        AudioEngine.resume(); assert.equal(ctx.state, 'running');
        assert.ok(ctx.oscillators.every(node => node.starts === 1 && node.stops === 1));
    } finally { AudioEngine.dispose(); (globalThis as any).window = originalWindow; }
});
