/** Ported from neon-synth-ballistics; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import type { Preferences } from './settings.ts';

export const TRACKS = ['ORBIT SIGNAL', 'NIGHT DRIVE', 'ION STORM'];
const SCORES = [
    { bpm: 112, roots: [48, 44, 51, 46], lead: [12, -1, 19, -1, 15, -1, 10, -1, 12, 15, -1, 19, -1, 22, 19, -1], arp: [0, 7, 12, 15, 7, 12, 19, 12] },
    { bpm: 128, roots: [45, 41, 48, 43], lead: [12, 12, -1, 15, -1, 19, -1, 17, 15, -1, 12, -1, 10, -1, 7, -1], arp: [0, 3, 7, 12, 15, 12, 7, 3] },
    { bpm: 142, roots: [50, 46, 43, 45], lead: [24, -1, 19, 15, -1, 12, 15, -1, 19, -1, 22, 19, 17, 15, -1, 12], arp: [0, 12, 7, 15, 3, 12, 7, 19] },
];
const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

class SynthAudio {
    ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private musicBus: GainNode | null = null;
    private effectsBus: GainNode | null = null;
    private noise: AudioBuffer | null = null;
    private scheduler: ReturnType<typeof setInterval> | null = null;
    private nextNote = 0;
    private step = 0;
    private paused = true;
    private music = 0.22;
    private sfx = 0.65;
    private muted = false;
    private track = 0;
    private chargeOsc: OscillatorNode | null = null;
    private chargeGain: GainNode | null = null;
    private lastWarning = -1;
    private lastFuse = -1;
    private lastBounce = 0;
    private ambienceSource: AudioBufferSourceNode | null = null;
    private windGain: GainNode | null = null;
    private jetGain: GainNode | null = null;
    private lastTread = 0;

    init() {
        if (this.ctx) return;
        const Constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) return;
        const ctx = this.ctx = new Constructor();
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -18; compressor.knee.value = 18;
        compressor.ratio.value = 5; compressor.attack.value = 0.004; compressor.release.value = 0.25;
        this.master = ctx.createGain(); this.master.gain.value = 0;
        this.master.connect(compressor); compressor.connect(ctx.destination);
        this.musicBus = ctx.createGain(); this.effectsBus = ctx.createGain();
        this.musicBus.connect(this.master); this.effectsBus.connect(this.master);
        this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        this.ambienceSource = ctx.createBufferSource(); this.ambienceSource.buffer = this.noise; this.ambienceSource.loop = true;
        const windFilter = ctx.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 480;
        this.windGain = ctx.createGain(); this.windGain.gain.value = 0.004;
        this.ambienceSource.connect(windFilter); windFilter.connect(this.windGain); this.windGain.connect(this.effectsBus);
        const jetFilter = ctx.createBiquadFilter(); jetFilter.type = 'bandpass'; jetFilter.frequency.value = 650; jetFilter.Q.value = 0.7;
        this.jetGain = ctx.createGain(); this.jetGain.gain.value = 0;
        this.ambienceSource.connect(jetFilter); jetFilter.connect(this.jetGain); this.jetGain.connect(this.effectsBus);
        this.ambienceSource.start();
        this.scheduler = setInterval(() => this.schedule(), 40);
        this.applyVolumes();
    }

    configure(p: Pick<Preferences, 'music' | 'sfx' | 'muted' | 'track'>) {
        this.music = p.music; this.sfx = p.sfx; this.muted = p.muted;
        if (this.track !== p.track) { this.track = p.track; this.step = 0; }
        this.applyVolumes();
    }
    private applyVolumes() {
        if (!this.ctx) return;
        const time = this.ctx.currentTime;
        this.master?.gain.setTargetAtTime(this.muted ? 0 : 0.78, time, 0.06);
        this.musicBus?.gain.setTargetAtTime(this.music, time, 0.08);
        this.effectsBus?.gain.setTargetAtTime(this.sfx, time, 0.04);
    }
    resume() {
        if (!this.ctx) return;
        this.paused = false;
        if (this.nextNote < this.ctx.currentTime + 0.01) this.nextNote = this.ctx.currentTime + 0.08;
        void this.ctx.resume().catch(() => {});
    }
    pause() {
        this.paused = true; this.charge(0);
        void this.ctx?.suspend().catch(() => {});
    }
    dispose() {
        if (this.scheduler) clearInterval(this.scheduler);
        this.scheduler = null;
        this.ambienceSource?.stop(); this.ambienceSource = null;
        void this.ctx?.close().catch(() => {});
        this.ctx = null;
    }
    private schedule() {
        const ctx = this.ctx;
        if (!ctx || this.paused || ctx.state !== 'running') return;
        const score = SCORES[this.track];
        if (this.nextNote < ctx.currentTime - 0.1) this.nextNote = ctx.currentTime + 0.03;
        while (this.nextNote < ctx.currentTime + 0.14) {
            this.musicStep(this.step++, this.nextNote);
            this.nextNote += 60 / score.bpm / 4;
        }
    }
    private musicStep(step: number, time: number) {
        const score = SCORES[this.track];
        const beat = step % 16, bar = Math.floor(step / 16);
        const root = score.roots[bar % 4];
        if (beat % 4 === 0 || beat === 7 || beat === 14) this.tone(midi(root - 12), 'triangle', time, 0.19, 0.19, this.musicBus);
        if (beat % 2 === 0) this.tone(midi(root + score.arp[(beat / 2 + Math.floor(bar / 4)) % 8]), 'square', time, 0.11, 0.025, this.musicBus, 1800, (beat / 8 - 1) * 0.5);
        const note = score.lead[(beat + (bar % 2) * 4) % 16];
        if (bar % 8 >= 2 && note >= 0 && beat % 2 === 0) {
            this.tone(midi(root + note), 'triangle', time, 0.24, 0.09, this.musicBus, 2800, 0.25);
            this.tone(midi(root + note), 'triangle', time + 0.22, 0.18, 0.025, this.musicBus, 1800, -0.4);
        }
        if (beat === 0 || beat === 8 || (this.track > 0 && beat === 11)) this.kick(time);
        if (beat === 4 || beat === 12) this.hiss(time, 0.13, 0.11, 1700, this.musicBus);
        if (beat % 2 === 0 || (bar % 4 === 3 && beat > 12)) this.hiss(time, 0.035, 0.035, 6500, this.musicBus, 0.35);
        if (beat === 0 && bar % 4 === 0) {
            for (const interval of [0, 3, 7]) this.tone(midi(root + interval), 'sine', time, 1.8, 0.025, this.musicBus, 600);
        }
    }
    private destination(bus: GainNode | null, pan: number) {
        if (!this.ctx || !bus) return null;
        if (this.ctx.createStereoPanner) {
            const panner = this.ctx.createStereoPanner(); panner.pan.value = Math.max(-0.85, Math.min(0.85, pan)); panner.connect(bus); return panner;
        }
        return bus;
    }
    private tone(frequency: number, type: OscillatorType, at: number, duration: number, volume: number, bus = this.effectsBus, cutoff = 5000, pan = 0, endFrequency?: number) {
        const ctx = this.ctx, destination = this.destination(bus, pan);
        if (!ctx || !destination) return;
        const osc = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
        osc.type = type; osc.frequency.setValueAtTime(Math.max(1, frequency), at);
        if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), at + duration);
        filter.type = 'lowpass'; filter.frequency.value = cutoff;
        gain.gain.setValueAtTime(0.0001, at); gain.gain.linearRampToValueAtTime(volume, at + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
        osc.connect(filter); filter.connect(gain); gain.connect(destination);
        osc.start(at); osc.stop(at + duration + 0.02);
        osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); if (destination !== bus) destination.disconnect(); };
    }
    private hiss(at: number, duration: number, volume: number, cutoff: number, bus = this.effectsBus, pan = 0, lowpass = false) {
        const ctx = this.ctx, destination = this.destination(bus, pan);
        if (!ctx || !destination || !this.noise) return;
        const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
        source.buffer = this.noise; filter.type = lowpass ? 'lowpass' : 'highpass'; filter.frequency.value = cutoff;
        gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
        source.connect(filter); filter.connect(gain); gain.connect(destination);
        source.start(at, Math.random() * 0.5, duration);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); if (destination !== bus) destination.disconnect(); };
    }
    private kick(time: number) { this.tone(125, 'sine', time, 0.18, 0.34, this.musicBus, 800, 0, 32); }
    private get now() { return this.ctx?.currentTime || 0; }
    environment(wind: number, jet: boolean, walking: boolean, pan = 0) {
        if (!this.ctx || this.paused) return;
        this.windGain?.gain.setTargetAtTime(0.004 + Math.min(1, Math.abs(wind) / 0.024) * 0.012, this.now, 0.4);
        this.jetGain?.gain.setTargetAtTime(jet ? 0.16 : 0, this.now, 0.08);
        if (walking && this.now - this.lastTread > 0.18) {
            this.lastTread = this.now; this.hiss(this.now, 0.035, 0.055, 1100, this.effectsBus, pan, true);
        }
    }
    ui(confirm = false) { if (!this.ctx || this.paused) return; this.tone(confirm ? 720 : 460, 'triangle', this.now, 0.065, 0.11); }
    launch(weapon: number, pan = 0) {
        if (!this.ctx || this.paused) return;
        this.charge(0);
        if (weapon === 8) { this.hiss(this.now, 0.13, 0.55, 1400, this.effectsBus, pan, true); this.tone(125, 'triangle', this.now, 0.15, 0.3, this.effectsBus, 700, pan, 40); }
        else if (weapon === 9) this.tone(330, 'square', this.now, 0.12, 0.08, this.effectsBus, 1200, pan, 180);
        else if (weapon === 3) this.tone(1500, 'sawtooth', this.now, 0.22, 0.13, this.effectsBus, 2400, pan, 180);
        else if (weapon === 4) {
            [740, 980, 1480].forEach((frequency, index) => this.tone(frequency, 'square', this.now + index * 0.08, 0.065, 0.09, this.effectsBus, 2600, pan));
            this.hiss(this.now, 0.25, 0.045, 3200, this.effectsBus, pan);
        }
        else if (weapon === 6) {
            this.tone(220, 'sine', this.now, 0.4, 0.15, this.effectsBus, 2800, pan, 1320);
            this.hiss(this.now, 0.35, 0.12, 1800, this.effectsBus, pan);
        }
        else { this.tone(160, 'triangle', this.now, 0.16, 0.35, this.effectsBus, 1600, pan, 35); this.hiss(this.now, 0.3, 0.18, 1000, this.effectsBus, pan, true); }
    }
    explosion(radius: number, pan = 0) {
        if (!this.ctx || this.paused) return;
        const strength = Math.min(1.4, radius / 55), time = this.now;
        this.tone(85 + Math.random() * 20, 'sine', time, 0.6 * strength, 0.62 * strength, this.effectsBus, 1400, pan, 22);
        this.hiss(time, 0.42 * strength, 0.45 * strength, 1700, this.effectsBus, pan, true);
        this.hiss(time + 0.04, 0.22, 0.1 * strength, 2200, this.effectsBus, pan);
    }
    impact(pan = 0) { this.tone(170, 'square', this.now, 0.09, 0.12, this.effectsBus, 900, pan, 55); }
    bounce(pan = 0) {
        if (this.now - this.lastBounce < 0.09 || this.paused) return;
        this.lastBounce = this.now;
        this.tone(260, 'triangle', this.now, 0.055, 0.1, this.effectsBus, 2000, pan, 190);
    }
    grapple(pan = 0) { this.hiss(this.now, 0.17, 0.1, 2400, this.effectsBus, pan); this.tone(700, 'triangle', this.now + 0.08, 0.08, 0.12, this.effectsBus, 2200, pan, 1300); }
    parachute(pan = 0) { this.hiss(this.now, 0.4, 0.16, 1500, this.effectsBus, pan); }
    jump(pan = 0) { this.tone(150, 'square', this.now, 0.12, 0.065, this.effectsBus, 1400, pan, 380); }
    pickup(pan = 0) { [0, 4, 7, 12].forEach((n, i) => this.tone(midi(72 + n), 'triangle', this.now + i * 0.065, 0.2, 0.12, this.effectsBus, 4000, pan)); }
    turn(team: number) { [0, 7, 12].forEach((n, i) => this.tone(midi(60 + team * 2 + n), 'square', this.now + i * 0.09, 0.15, 0.075, this.effectsBus, 2000)); this.lastWarning = -1; }
    victory(draw = false) { (draw ? [0, -2, -5] : [0, 4, 7, 12, 7, 12]).forEach((n, i) => this.tone(midi(60 + n), 'triangle', this.now + i * 0.13, 0.45, 0.2)); }
    splash(pan = 0, strength = 1) {
        const volume = Math.max(0.2, Math.min(1, strength));
        this.hiss(this.now, 0.65, 0.32 * volume, 950, this.effectsBus, pan, true);
        this.tone(150, 'sine', this.now, 0.4, 0.22 * volume, this.effectsBus, 800, pan, 30);
    }
    warning(seconds: number) {
        if (seconds === this.lastWarning || seconds < 1 || seconds > 5 || this.paused) return;
        this.lastWarning = seconds; this.tone(seconds === 1 ? 1100 : 740, 'square', this.now, 0.06, 0.09, this.effectsBus, 2000);
    }
    fuse(remainingTicks: number) {
        const beat = Math.floor(remainingTicks / (remainingTicks < 60 ? 12 : 30));
        const key = beat + (remainingTicks < 60 ? 100 : 0);
        if (this.lastFuse === key || this.paused) return;
        this.lastFuse = key; this.tone(remainingTicks < 60 ? 1000 : 540, 'square', this.now, 0.025, 0.045, this.effectsBus, 1500);
    }
    charge(power: number) {
        const ctx = this.ctx;
        if (!ctx || !this.effectsBus) return;
        if (power <= 0 || this.paused) {
            if (this.chargeGain && this.chargeOsc) {
                const osc = this.chargeOsc, gain = this.chargeGain;
                gain.gain.setTargetAtTime(0, this.now, 0.015); osc.stop(this.now + 0.08);
                osc.onended = () => { osc.disconnect(); gain.disconnect(); };
            }
            this.chargeOsc = null; this.chargeGain = null; return;
        }
        if (!this.chargeOsc) {
            this.chargeOsc = ctx.createOscillator(); this.chargeGain = ctx.createGain();
            this.chargeOsc.type = 'triangle'; this.chargeGain.gain.value = 0.035;
            this.chargeOsc.connect(this.chargeGain); this.chargeGain.connect(this.effectsBus); this.chargeOsc.start();
        }
        this.chargeOsc.frequency.setTargetAtTime(140 + Math.min(1, power) * 560, this.now, 0.025);
    }
}

export const AudioEngine = new SynthAudio();
