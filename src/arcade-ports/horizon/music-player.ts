/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { MUSIC_TRACKS, SCORES, musicStep, midiFrequency, type MusicNote, type TranceTrackId } from './soundtrack.ts';

type Session = { bus: GainNode; drums: GainNode; tones: GainNode; duck: GainNode; send: GainNode; sources: Set<AudioScheduledSourceNode>; nodes: AudioNode[]; stopped: boolean; disconnected: boolean };

/** The game's existing guarded scheduler drives this player. No per-track timers or fetched assets. */
export class TrancePlayer {
    track: TranceTrackId;
    step = 0;
    nextTime = 0;
    playing = false;
    private session: Session | null = null;
    readonly context: AudioContext;
    readonly output: AudioNode;
    readonly noise: AudioBuffer;
    constructor(context: AudioContext, output: AudioNode, noise: AudioBuffer, track: TranceTrackId) { this.context = context; this.output = output; this.noise = noise; this.track = track; }
    start(audition = false) {
        if (this.playing) return;
        if (audition) this.step = 8 * 16;
        this.playing = true; this.nextTime = this.context.currentTime + .04; this.session = this.createSession(); this.tick();
    }
    stop() { this.playing = false; this.retire(); }
    rewind() { const playing = this.playing; this.stop(); this.step = 0; if (playing) this.start(); }
    setTrack(track: TranceTrackId) {
        if (track === this.track) return;
        const playing = this.playing; this.stop(); this.track = track; this.step = 8 * 16; if (playing) this.start();
    }
    tick() {
        if (!this.playing || !this.session) return;
        const now = this.context.currentTime, tick = 60 / MUSIC_TRACKS[this.track].bpm / 4;
        if (this.nextTime < now - .15) { this.step = (this.step + Math.floor((now - this.nextTime) / tick)) % 1536; this.nextTime = now + .025; }
        while (this.nextTime < now + .12) {
            const notes = musicStep(this.track, this.step);
            if (notes.some(note => note.instrument === 'kick')) {
                const param = this.session.duck.gain, time = this.nextTime;
                param.setValueAtTime(.48, time); param.exponentialRampToValueAtTime(1, time + tick * 1.6);
            }
            for (const note of notes) this.play(note, this.nextTime, this.session);
            this.step = (this.step + 1) % 1536; this.nextTime += tick;
        }
    }
    private createSession(): Session {
        const ctx = this.context, bus = ctx.createGain(), drums = ctx.createGain(), tones = ctx.createGain(), duck = ctx.createGain(), send = ctx.createGain();
        const hp = ctx.createBiquadFilter(), limiter = ctx.createDynamicsCompressor();
        hp.type = 'highpass'; hp.frequency.value = 28; hp.Q.value = .5;
        limiter.threshold.value = -10; limiter.knee.value = 9; limiter.ratio.value = 4; limiter.attack.value = .003; limiter.release.value = .16;
        tones.connect(duck); duck.connect(hp); drums.connect(hp); hp.connect(limiter); limiter.connect(bus); bus.connect(this.output);
        bus.gain.setValueAtTime(0, ctx.currentTime); bus.gain.linearRampToValueAtTime(.95, ctx.currentTime + .04);
        const delay = ctx.createDelay(1), feedback = ctx.createGain(), wet = ctx.createGain(), filter = ctx.createBiquadFilter(), pan = ctx.createStereoPanner();
        delay.delayTime.value = 60 / MUSIC_TRACKS[this.track].bpm * .75; feedback.gain.value = .28; wet.gain.value = .19;
        filter.type = 'bandpass'; filter.frequency.value = 1700; filter.Q.value = .55; pan.pan.value = .42;
        send.connect(delay); delay.connect(filter); filter.connect(feedback); feedback.connect(delay); filter.connect(wet); wet.connect(pan); pan.connect(duck);
        return { bus, drums, tones, duck, send, sources: new Set(), nodes: [bus,drums,tones,duck,send,hp,limiter,delay,feedback,wet,filter,pan], stopped: false, disconnected: false };
    }
    private disposeSession(session: Session) {
        if (!session.disconnected) { session.disconnected = true; for (const node of session.nodes) node.disconnect(); }
    }
    private retire() {
        const session = this.session; if (!session) return; this.session = null; session.stopped = true;
        const now = this.context.currentTime;
        if (session.bus.gain.cancelAndHoldAtTime) session.bus.gain.cancelAndHoldAtTime(now);
        else { session.bus.gain.cancelScheduledValues(now); session.bus.gain.setValueAtTime(session.bus.gain.value, now); }
        session.bus.gain.linearRampToValueAtTime(0, now + .035);
        for (const source of session.sources) { try { source.stop(now + .045); } catch {} }
        if (!session.sources.size) this.disposeSession(session);
    }
    private source(source: AudioScheduledSourceNode, nodes: AudioNode[], time: number, duration: number, session: Session) {
        session.sources.add(source);
        source.onended = () => { source.disconnect(); nodes.forEach(node => node.disconnect()); session.sources.delete(source); if (session.stopped && !session.sources.size) this.disposeSession(session); };
        source.start(time); source.stop(time + duration);
    }
    private tone(type: OscillatorType, midi: number, time: number, duration: number, gainValue: number, panValue: number, cutoff: number, attack: number, release: number, detune: number, session: Session, send = false, pluck = false) {
        const ctx = this.context, osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
        osc.type = type; osc.frequency.value = midiFrequency(midi); osc.detune.value = detune;
        filter.type = 'lowpass'; filter.Q.value = pluck ? 1.1 : .65;
        filter.frequency.setValueAtTime(Math.max(100, cutoff * (pluck ? 1 : .6)), time);
        filter.frequency.exponentialRampToValueAtTime(Math.max(100, cutoff * (pluck ? .22 : 1)), time + Math.max(.02, duration * .7));
        pan.pan.value = panValue;
        gain.gain.setValueAtTime(.0001, time); gain.gain.linearRampToValueAtTime(gainValue, time + attack);
        gain.gain.setValueAtTime(gainValue * (pluck ? .35 : .72), time + Math.max(attack, duration * .65));
        gain.gain.exponentialRampToValueAtTime(.0001, time + duration + release);
        osc.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(session.tones); if (send) pan.connect(session.send);
        this.source(osc, [filter,gain,pan], time, duration + release + .015, session);
    }
    private play(note: MusicNote, time: number, session: Session) {
        const ctx = this.context, v = note.velocity;
        if (note.instrument === 'kick') {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.frequency.setValueAtTime(155, time); osc.frequency.exponentialRampToValueAtTime(47, time + .14);
            gain.gain.setValueAtTime(.0001, time); gain.gain.linearRampToValueAtTime(.61 * v, time + .003); gain.gain.exponentialRampToValueAtTime(.0001, time + note.duration);
            osc.connect(gain); gain.connect(session.drums); this.source(osc, [gain], time, note.duration + .01, session); return;
        }
        if (['clap','hat','open-hat','crash','rise'].includes(note.instrument)) {
            const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
            source.buffer = this.noise; source.loop = note.duration > 1.8; pan.pan.value = note.pan;
            const clap = note.instrument === 'clap', rise = note.instrument === 'rise';
            filter.type = rise ? 'bandpass' : 'highpass'; filter.frequency.setValueAtTime(rise ? 450 : clap ? 1400 : 6000, time); filter.Q.value = rise ? .7 : .5;
            const level = v * (clap ? .26 : note.instrument === 'crash' || rise ? .15 : .15);
            gain.gain.setValueAtTime(.0001, time); gain.gain.linearRampToValueAtTime(rise ? .0002 : level, time + .003);
            if (clap) for (let i = 1; i <= 3; i++) { gain.gain.linearRampToValueAtTime(.001, time + i * .011); gain.gain.linearRampToValueAtTime(level, time + i * .011 + .003); }
            if (rise) { filter.frequency.exponentialRampToValueAtTime(7000, time + note.duration); gain.gain.exponentialRampToValueAtTime(level, time + note.duration - .02); }
            gain.gain.exponentialRampToValueAtTime(.0001, time + note.duration);
            source.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(session.drums);
            this.source(source, [filter,gain,pan], time, note.duration + .02, session); return;
        }
        if (note.instrument === 'bass') {
            this.tone('sawtooth', note.midi, time, note.duration, .16 * v, 0, 420 + note.brightness * 350, .003, .045, 0, session, false, true);
            this.tone('sine', note.midi - 12, time, note.duration, .19 * v, 0, 220, .004, .035, 0, session); return;
        }
        if (note.instrument === 'pad') {
            this.tone('sawtooth', note.midi, time, note.duration, .022 * v, note.pan, 950 + note.brightness * 1200, .28, .45, -5, session, true);
            this.tone('triangle', note.midi, time, note.duration, .037 * v, -note.pan, 2600, .35, .55, 5, session, true); return;
        }
        if (note.instrument === 'arp') {
            this.tone('triangle', note.midi, time, note.duration, .11 * v, note.pan, 2800, .004, .12, -3, session, true, true); return;
        }
        const pluck = note.instrument === 'pluck', width = SCORES[this.track].width;
        for (const [detune, pan] of [[-width,-.48],[0,0],[width,.48]]) this.tone('sawtooth', note.midi, time, note.duration, (pluck ? .038 : .045) * v, pan + note.pan, 1400 + note.brightness * 3000, pluck ? .004 : .012, pluck ? .13 : .25, detune, session, true, pluck);
        this.tone('triangle', note.midi - 12, time, note.duration, .045 * v, note.pan, 1800, .008, .15, 0, session, true);
    }
}
