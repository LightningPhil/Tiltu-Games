// @ts-nocheck
/** Ported from neon-void; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
/** A short sports-arena fanfare, synthesized locally so the game stays offline. */
export const VICTORY_STING_DURATION = 5.2;

export function playVictorySting(ctx: BaseAudioContext, destination: AudioNode) {
    const start = ctx.currentTime + .015;
    const nodes = new Set<AudioNode>();
    const sources = new Set<AudioScheduledSourceNode>();
    const keep = <T extends AudioNode>(node: T): T => { nodes.add(node); return node; };
    const mix = keep(ctx.createGain()), compressor = keep(ctx.createDynamicsCompressor());
    const output = keep(ctx.createGain()), room = keep(ctx.createConvolver()), wet = keep(ctx.createGain());
    compressor.threshold.value = -13; compressor.knee.value = 10; compressor.ratio.value = 5;
    compressor.attack.value = .004; compressor.release.value = .16;
    output.gain.value = .72; wet.gain.value = .24;
    mix.connect(compressor); mix.connect(room); room.connect(wet); wet.connect(compressor);
    compressor.connect(output); output.connect(destination);
    output.gain.setValueAtTime(.72, start + 4.4);
    output.gain.linearRampToValueAtTime(0, start + VICTORY_STING_DURATION);

    // Private seeded noise avoids changing any gameplay random sequences.
    let seed = 0x51ad1;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 31 - 1; };
    const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 1.4), ctx.sampleRate);
    const noiseData = noise.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = random();
    const impulse = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * 1.15), ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < data.length; i++) {
            // A few early reflections give the brass a spacious stadium tail.
            const time = i / ctx.sampleRate;
            data[i] = time < .022 ? 0 : random() * Math.exp(-time * 6) * .35;
        }
    }
    room.buffer = impulse;

    const voice = (source: AudioScheduledSourceNode, chain: AudioNode[], time: number, duration: number) => {
        sources.add(source);
        let previous: AudioNode = source;
        for (const node of chain) { previous.connect(node); previous = node; }
        previous.connect(mix);
        source.onended = () => {
            source.disconnect(); chain.forEach(node => node.disconnect()); sources.delete(source);
        };
        source.start(start + time); source.stop(start + time + duration);
    };
    const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
    const brass = (midi: number, time: number, duration: number, pan: number, level = 1) => {
        // Slightly detuned paired horns: a firm low attack, then a warmer sustain.
        for (const detune of [-5, 5]) {
            const horn = ctx.createOscillator(), filter = ctx.createBiquadFilter();
            const gain = ctx.createGain(), stereo = ctx.createStereoPanner();
            horn.type = 'sawtooth'; horn.frequency.value = frequency(midi); horn.detune.value = detune;
            filter.type = 'lowpass'; filter.Q.value = .65;
            filter.frequency.setValueAtTime(750, start + time);
            filter.frequency.linearRampToValueAtTime(2400, start + time + .045);
            filter.frequency.exponentialRampToValueAtTime(950, start + time + duration);
            const peak = .075 * level;
            gain.gain.setValueAtTime(0, start + time);
            gain.gain.linearRampToValueAtTime(peak, start + time + .018);
            gain.gain.linearRampToValueAtTime(peak * .7, start + time + .09);
            gain.gain.setValueAtTime(peak * .65, start + time + duration - .11);
            gain.gain.exponentialRampToValueAtTime(.0001, start + time + duration);
            stereo.pan.value = pan + detune * .018;
            voice(horn, [filter, gain, stereo], time, duration + .015);
        }
    };
    const drum = (time: number, midi: number, level = 1) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.frequency.setValueAtTime(frequency(midi) * 2.3, start + time);
        osc.frequency.exponentialRampToValueAtTime(frequency(midi), start + time + .09);
        gain.gain.setValueAtTime(.65 * level, start + time);
        gain.gain.exponentialRampToValueAtTime(.0001, start + time + .42);
        voice(osc, [gain], time, .44);
    };
    const noiseHit = (time: number, duration: number, level: number, cymbal = false, pan = 0) => {
        const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
        const gain = ctx.createGain(), stereo = ctx.createStereoPanner();
        source.buffer = noise; filter.type = cymbal ? 'highpass' : 'bandpass';
        filter.frequency.value = cymbal ? 5700 : 1900; filter.Q.value = cymbal ? .7 : .65;
        gain.gain.setValueAtTime(level, start + time);
        gain.gain.exponentialRampToValueAtTime(.0001, start + time + duration);
        stereo.pan.value = pan;
        voice(source, [filter, gain, stereo], time, duration);
    };

    // Snare pickup, three bold brass calls, a rising fill, then the winning chord.
    const beat = 60 / 126;
    for (const [time, level] of [[0, .11], [.075, .15], [.15, .2]]) noiseHit(time, .16, level);
    const calls = [
        {at: .5, length: .7, notes: [50, 57, 62, 66]},
        {at: 1.5, length: .7, notes: [50, 57, 62, 66]},
        {at: 2.5, length: .9, notes: [55, 59, 62, 67]},
        {at: 3.5, length: .42, notes: [57, 61, 64, 69]},
        {at: 4, length: .42, notes: [57, 61, 64, 69]},
        {at: 4.5, length: 3.9, notes: [50, 57, 62, 66, 69]}
    ];
    for (const call of calls) {
        const time = call.at * beat, duration = call.length * beat;
        call.notes.forEach((note, i) => brass(note, time, duration, (i / (call.notes.length - 1) - .5) * .8));
        drum(time, 32, call.at === 4.5 ? 1 : .75);
    }
    for (const [at, note] of [[2, 43], [3, 41], [3.5, 38], [3.75, 36], [4, 34], [4.25, 32]]) drum(at * beat, note, .55);
    for (const at of [1, 2, 3]) noiseHit(at * beat, .2, .22);
    for (let i = 0; i < 6; i++) noiseHit((3.75 + i * .125) * beat, .13, .12 + i * .025, false, i % 2 ? .3 : -.3);
    noiseHit(.5 * beat, .65, .14, true, -.3);
    noiseHit(4.5 * beat, 1.3, .35, true, .25);

    // A silent clock source releases the effect buses after the room tail.
    const clock = ctx.createBufferSource();
    clock.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); clock.loop = true; clock.connect(output);
    let active = true;
    clock.onended = () => {
        active = false; clock.disconnect();
        sources.forEach(source => source.disconnect()); sources.clear();
        nodes.forEach(node => node.disconnect()); nodes.clear();
    };
    clock.start(start); clock.stop(start + VICTORY_STING_DURATION + .02);
    return {
        stop() {
            if (!active) return;
            active = false;
            const now = ctx.currentTime;
            output.gain.cancelScheduledValues(now);
            output.gain.setValueAtTime(output.gain.value, now);
            output.gain.linearRampToValueAtTime(0, now + .03);
            sources.forEach(source => source.stop(now + .04));
            clock.stop(now + .05);
        }
    };
}
