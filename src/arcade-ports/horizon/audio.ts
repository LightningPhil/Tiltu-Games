/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { clamp } from './flight.ts';
import { TrancePlayer } from './music-player.ts';
import { DEFAULT_MUSIC_TRACK, isMusicTrack, type MusicTrackId } from './soundtrack.ts';

export type AudioCue = 'hit' | 'gate' | 'pulse' | 'warning' | 'victory' | 'threat' | 'evade';
export type FlightSound = { speed: number; boost: boolean; brake: boolean; turn: number; shields: number; intensity: number };

export function engineVoice(speed: number, boost: boolean) {
    const power = clamp(speed / 225, 0, 1);
    return { fundamental: 29 + power * 13 + (boost ? 4 : 0), sub: 23 + power * 10,
        cutoff: 115 + power * 100 + (boost ? 95 : 0), rumble: .075 + power * .045 + (boost ? .075 : 0),
        roar: .012 + power * .018 + (boost ? .065 : 0) };
}

/** All sound is synthesized locally. Shared noise buffers and persistent engine voices avoid per-frame allocations. */
export const AudioEngine = {
    ctx: null as AudioContext | null,
    masterGain: null as GainNode | null,
    musicGain: null as GainNode | null,
    effectsGain: null as GainNode | null,
    engineGain: null as GainNode | null,
    engine: null as any,
    musicPlayer: null as TrancePlayer | null,
    musicTrack: DEFAULT_MUSIC_TRACK as MusicTrackId,
    noise: null as AudioBuffer | null,
    rumbleNoise: null as AudioBuffer | null,
    isPlaying: false, nextNoteTime: 0, beatCount: 0, schedulerTimer: 0, schedulerToken: 0,
    suspendTimer: 0,
    musicLevel: .48, effectsLevel: .8, enabled: true, active: false, previewing: false, intensity: 0,
    targets: new WeakMap<AudioParam, number>(),
    init() {
        if (this.ctx) return;
        const Context = window.AudioContext || (window as any).webkitAudioContext;
        if (!Context) return;
        try {
            this.ctx = new Context(); const ctx = this.ctx!;
            this.masterGain = ctx.createGain(); this.masterGain.gain.value = .72;
            const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -16; limiter.knee.value = 10;
            limiter.ratio.value = 5; limiter.attack.value = .006; limiter.release.value = .18;
            this.masterGain.connect(limiter); limiter.connect(ctx.destination);
            this.musicGain = ctx.createGain(); this.effectsGain = ctx.createGain(); this.engineGain = ctx.createGain();
            this.musicGain.gain.value = 0; this.effectsGain.gain.value = this.effectsLevel * .6; this.engineGain.gain.value = 0;
            this.musicGain.connect(this.masterGain); this.effectsGain.connect(this.masterGain); this.engineGain.connect(this.effectsGain);
            this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
            const data = this.noise.getChannelData(0); let state = 73591;
            for (let i = 0; i < data.length; i++) { state = (Math.imul(state, 1664525) + 1013904223) | 0; data[i] = ((state >>> 0) / 4294967296) * 2 - 1; }
            this.rumbleNoise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
            const brown = this.rumbleNoise.getChannelData(0); let last = 0;
            for (let i = 0; i < brown.length; i++) { last = (last + data[i % data.length] * .035) / 1.035; brown[i] = last * 5.5; }
            // Crossfade the seam so a sustained engine has no repeating click.
            const seam = Math.min(2048, brown.length / 4);
            for (let i = 0; i < seam; i++) { const mix = i / seam; brown[brown.length - seam + i] = brown[brown.length - seam + i] * (1 - mix) + brown[i] * mix; }
            this.createEngine();
        } catch { this.ctx = null; }
    },
    smooth(param: AudioParam, value: number, seconds = .08) {
        if (!this.ctx) return;
        if (Math.abs((this.targets.get(param) ?? Infinity) - value) < .0001) return;
        this.targets.set(param, value);
        if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(this.ctx.currentTime);
        param.setTargetAtTime(value, this.ctx.currentTime, seconds);
    },
    configure(enabled: boolean, music: number, effects: number, active: boolean, preview = false) {
        clearTimeout(this.suspendTimer);
        this.enabled = enabled; this.musicLevel = clamp(music, 0, 1); this.effectsLevel = clamp(effects, 0, 1); this.active = active; this.previewing = preview;
        const audible = enabled && (active || preview);
        if (audible && !this.ctx) this.init();
        if (!this.ctx) return;
        if (audible && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
        this.smooth(this.masterGain!.gain, enabled ? .72 : 0, .025);
        this.smooth(this.effectsGain!.gain, this.effectsLevel * .6);
        this.smooth(this.engineGain!.gain, enabled && active ? 1 : 0, .08);
        this.smooth(this.musicGain!.gain, audible && this.isPlaying ? this.musicLevel * .45 : 0);
        if (!audible) this.suspendTimer = window.setTimeout(() => {
            if ((!this.enabled || !this.active && !this.previewing) && this.ctx?.state === 'running') void this.ctx.suspend().catch(() => {});
        }, 2000);
    },
    createEngine() {
        const ctx = this.ctx!, bus = this.engineGain!;
        const low = ctx.createOscillator(), sub = ctx.createOscillator(); low.type = sub.type = 'sine'; low.frequency.value = 34; sub.frequency.value = 26;
        const lowGain = ctx.createGain(), subGain = ctx.createGain(); lowGain.gain.value = .09; subGain.gain.value = .045;
        low.connect(lowGain); lowGain.connect(bus); sub.connect(subGain); subGain.connect(bus);
        const body = ctx.createBufferSource(); body.buffer = this.rumbleNoise; body.loop = true;
        body.loopStart = 2048 / ctx.sampleRate; body.loopEnd = 4;
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 170; filter.Q.value = .55;
        const rumbleGain = ctx.createGain(); rumbleGain.gain.value = .11; body.connect(filter); filter.connect(rumbleGain); rumbleGain.connect(bus);
        const roar = ctx.createBufferSource(); roar.buffer = this.noise; roar.loop = true;
        const roarFilter = ctx.createBiquadFilter(); roarFilter.type = 'lowpass'; roarFilter.frequency.value = 240; roarFilter.Q.value = .45;
        const roarGain = ctx.createGain(); roarGain.gain.value = .015; roar.connect(roarFilter); roarFilter.connect(roarGain); roarGain.connect(bus);
        const flutter = ctx.createOscillator(), flutterGain = ctx.createGain(); flutter.type = 'sine'; flutter.frequency.value = 3.7; flutterGain.gain.value = .008;
        flutter.connect(flutterGain); flutterGain.connect(rumbleGain.gain);
        low.start(); sub.start(); body.start(); roar.start(); flutter.start();
        this.engine = { low, sub, filter, lowGain, subGain, body, rumbleGain, roar, roarFilter, roarGain, flutter };
    },
    updateFlight(sound: FlightSound) {
        if (!this.ctx || !this.engine || !this.active) return;
        const voice = engineVoice(sound.speed, sound.boost), engine = this.engine;
        this.intensity += (clamp(sound.intensity, 0, 1) - this.intensity) * .025;
        this.smooth(engine.low.frequency, voice.fundamental, .24); this.smooth(engine.sub.frequency, voice.sub, .3);
        this.smooth(engine.lowGain.gain, sound.boost ? .14 : .09, .15);
        this.smooth(engine.filter.frequency, voice.cutoff, .2); this.smooth(engine.rumbleGain.gain, voice.rumble, .18);
        this.smooth(engine.roarFilter.frequency, voice.cutoff * 1.55, .2); this.smooth(engine.roarGain.gain, voice.roar, .14);
        this.smooth(engine.flutter.frequency, sound.boost ? 5.4 : 3.7, .3);
    },
    ignite() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        this.noiseHit(t, .5, .22, 350, this.effectsGain!);
        this.oscillator(62, 'sine', t, .55, .20, this.effectsGain!, 34);
    },
    selectMusic(track: MusicTrackId) {
        if (!isMusicTrack(track) || track === this.musicTrack) return;
        const playing = this.isPlaying; this.stopMusic(); this.musicTrack = track;
        if (track !== 'synthwave' && this.musicPlayer) this.musicPlayer.setTrack(track);
        this.beatCount = 0;
        if (playing) this.startMusic(true);
    },
    resetMusic() { this.beatCount = 0; this.musicPlayer?.rewind(); },
    startMusic(audition = false) {
        if (this.isPlaying) return;
        if (!this.ctx) this.init(); if (!this.ctx) return;
        this.isPlaying = true; this.nextNoteTime = this.ctx.currentTime + .06;
        if (this.musicTrack !== 'synthwave') {
            if (!this.musicPlayer) this.musicPlayer = new TrancePlayer(this.ctx, this.musicGain!, this.noise!, this.musicTrack);
            this.musicPlayer.setTrack(this.musicTrack); this.musicPlayer.start(audition);
        }
        this.smooth(this.musicGain!.gain, this.enabled && (this.active || this.previewing) ? this.musicLevel * .45 : 0, .15);
        const token = ++this.schedulerToken;
        this.scheduler(token);
    },
    stopMusic() {
        this.isPlaying = false; this.schedulerToken++; clearTimeout(this.schedulerTimer);
        this.musicPlayer?.stop();
        if (this.musicGain) this.smooth(this.musicGain.gain, 0, .045);
    },
    scheduler(token: number) {
        if (!this.isPlaying || token !== this.schedulerToken || !this.ctx) return;
        // Do not burst through a background-tab scheduling backlog.
        if (this.nextNoteTime < this.ctx.currentTime - .12) this.nextNoteTime = this.ctx.currentTime + .02;
        if (this.musicTrack !== 'synthwave') this.musicPlayer?.tick();
        else while (this.nextNoteTime < this.ctx.currentTime + .12) {
            this.playBeat(this.nextNoteTime, this.beatCount++); this.nextNoteTime += 60 / 112 / 4;
        }
        this.schedulerTimer = window.setTimeout(() => this.scheduler(token), 30);
    },
    oscillator(frequency: number, type: OscillatorType, time: number, duration: number, volume: number, bus: AudioNode, endFrequency = frequency, pan = 0) {
        if (!this.ctx) return;
        const ctx = this.ctx, osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = type;
        osc.frequency.setValueAtTime(frequency, time); osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFrequency), time + duration);
        gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), time + .008);
        gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
        osc.connect(gain); const nodes: AudioNode[] = [osc, gain];
        if (pan && ctx.createStereoPanner) { const panner = ctx.createStereoPanner(); panner.pan.value = clamp(pan, -1, 1); gain.connect(panner); panner.connect(bus); nodes.push(panner); }
        else gain.connect(bus);
        osc.onended = () => nodes.forEach(node => node.disconnect()); osc.start(time); osc.stop(time + duration + .02);
    },
    noiseHit(time: number, duration: number, volume: number, frequency: number, bus: AudioNode, highpass = false, pan = 0) {
        if (!this.ctx) return;
        const ctx = this.ctx, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain(); source.buffer = this.noise;
        filter.type = highpass ? 'highpass' : 'lowpass'; filter.frequency.setValueAtTime(frequency, time);
        if (!highpass) filter.frequency.exponentialRampToValueAtTime(70, time + duration);
        gain.gain.setValueAtTime(Math.max(.0001, volume), time); gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
        source.connect(filter); filter.connect(gain); const nodes: AudioNode[] = [source, filter, gain];
        if (pan && ctx.createStereoPanner) { const panner = ctx.createStereoPanner(); panner.pan.value = clamp(pan, -1, 1); gain.connect(panner); panner.connect(bus); nodes.push(panner); } else gain.connect(bus);
        source.onended = () => nodes.forEach(node => node.disconnect()); source.start(time, (time * .17) % .8); source.stop(time + duration + .02);
    },
    playBeat(time: number, beat: number) {
        const bar = Math.floor(beat / 16), step = beat % 16, roots = [55, 43.654, 65.406, 48.999], chord = Math.floor(bar / 2) % 4, root = roots[chord], third = chord === 0 ? 3 : 4, bus = this.musicGain!;
        if (step % 4 === 0) this.oscillator(125, 'sine', time, .30, .37, bus, 35);
        if (step === 4 || step === 12) {this.noiseHit(time, .14, .17, 1300, bus, true);this.oscillator(180, 'triangle', time, .12, .12, bus, 80);}
        if (step % 2 === 0 || this.intensity > .5) this.noiseHit(time, step % 4 === 2 ? .07 : .035, step % 2 ? .022 : .047, 6500, bus, true, step % 4 ? .22 : -.22);
        if (step % 2 === 0) this.oscillator(root * (step === 14 ? 2 : 1), 'triangle', time, .20, .34, bus);
        const intervals = [0, 7, 12, third, 7, 12, third + 12, 7], melody = root * 4 * 2 ** (intervals[Math.floor(step / 2) % 8] / 12);
        if (step % 2 === 0) {this.oscillator(melody, 'triangle', time, .34, .07 + this.intensity * .025, bus, melody, step % 4 ? -.35 : .35);this.oscillator(melody, 'sine', time + .20, .25, .025, bus, melody, step % 4 ? .45 : -.45);}
        // Slow, wide chords are the bed; the extra octave enters when combat intensifies.
        if (step === 0) for (const [index, interval] of [0, third, 7, 14].entries()) {
            const frequency = root * 4 * 2 ** (interval / 12);
            this.oscillator(frequency, 'sine', time + index * .012, 1.95, .065, bus, frequency, (index - 1.5) * .30);
        }
        if (this.intensity > .65 && step % 4 === 2) this.oscillator(melody * 2, 'sine', time, .18, .04, bus, melody * 2, -.5);
    },
    sfxLaser() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime, bus = this.effectsGain!;
        this.oscillator(1050, 'triangle', t, .105, .18, bus, 220, -.12);
        this.oscillator(1540, 'sine', t + .008, .085, .08, bus, 420, .12);
        this.noiseHit(t, .045, .07, 2600, bus, true);
    },
    sfxExplosion(pan = 0, distance = 200, large = false) {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime, bus = this.effectsGain!, volume = clamp(1 - distance / 1700, .15, 1);
        this.noiseHit(t, large ? 1.6 : .7, volume * .72, 1800, bus, false, pan);
        this.oscillator(large ? 105 : 160, 'sine', t, large ? 1.3 : .5, volume * .5, bus, 30, pan);
        this.noiseHit(t + .025, .12, volume * .30, 4800, bus, true, pan);
    },
    flyby(pan = 0) {
        if (this.ctx && this.enabled) this.noiseHit(this.ctx.currentTime, .3, .19, 2400, this.effectsGain!, true, pan);
    },
    hostile(pan = 0, distance = 400, boss = false) {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime, volume = clamp(1 - distance / 1200, .15, .85);
        this.oscillator(boss ? 310 : 540, 'triangle', t, .22, volume * .20, this.effectsGain!, 95, pan);
        this.noiseHit(t, .055, volume * .12, 3800, this.effectsGain!, true, pan);
    },
    impact(collision = false, strength = 1) {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        this.noiseHit(t, collision ? .34 : .16, strength * .40, collision ? 950 : 2400, this.effectsGain!);
        this.oscillator(collision ? 92 : 185, 'triangle', t, .24, strength * .24, this.effectsGain!, 42);
    },
    cue(kind: AudioCue, pan = 0) {
        if (!this.ctx || !this.enabled) return;
        const notes = kind === 'gate' ? [440, 659.25, 880] : kind === 'victory' ? [329.63, 440, 554.37, 659.25, 880]
            : kind === 'pulse' ? [130.81, 65.41, 32.70] : kind === 'warning' ? [246.94, 196] : kind === 'threat' ? [392, 523.25] : kind === 'evade' ? [783.99, 1174.66] : [1174.66];
        const t = this.ctx.currentTime;
        notes.forEach((frequency, index) => this.oscillator(frequency, kind === 'pulse' ? 'triangle' : 'sine', t + index * .09,
            kind === 'pulse' ? .6 : .23, kind === 'hit' ? .10 : kind === 'threat' ? .14 : .25, this.effectsGain!, kind === 'pulse' ? frequency * .3 : frequency, pan));
        if (kind === 'pulse') this.noiseHit(t, .65, .45, 2800, this.effectsGain!);
    },
    sfxCrash() { this.stopMusic(); this.sfxExplosion(0, 0, true); },
};
