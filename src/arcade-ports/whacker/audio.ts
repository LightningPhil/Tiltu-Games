/** Ported from whack-a; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { cueScore, MUSIC_STEP_SECONDS, musicStep } from "./sound-score.ts";
import type { Sound, SoundNote } from "./sound-score.ts";

type Voice = { source: AudioScheduledSourceNode; gain: GainNode; bus: "effects" | "music"; start: number; end: number };
export interface SoundGraph {
  context: BaseAudioContext; master: GainNode; effects: GainNode; music: GainNode;
  noise: AudioBuffer; voices: Set<Voice>;
}

function holdGain(gain: AudioParam, when: number) {
  if (typeof gain.cancelAndHoldAtTime === "function") gain.cancelAndHoldAtTime(when);
  else {
    const current = gain.value;
    gain.cancelScheduledValues(when);
    gain.setValueAtTime(current, when);
  }
}

export function createSoundGraph(context: BaseAudioContext): SoundGraph {
  const master = context.createGain(), effects = context.createGain(), music = context.createGain();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -15; compressor.knee.value = 16; compressor.ratio.value = 4;
  compressor.attack.value = .004; compressor.release.value = .16;
  effects.gain.value = .9; music.gain.value = .38; master.gain.value = .65;
  effects.connect(master); music.connect(master); master.connect(compressor); compressor.connect(context.destination);
  const reverb = context.createConvolver();
  const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * .26), context.sampleRate);
  const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
  let seed = 6871;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0xffffffff * 2 - 1; };
  for (let channel = 0; channel < 2; channel++) {
    const samples = impulse.getChannelData(channel);
    for (let i = 0; i < samples.length; i++) samples[i] = random() * (1 - i / samples.length) ** 3 * .35;
  }
  const noiseSamples = noise.getChannelData(0);
  for (let i = 0; i < noiseSamples.length; i++) noiseSamples[i] = random();
  reverb.buffer = impulse;
  const wet = context.createGain(); wet.gain.value = .13;
  effects.connect(reverb); music.connect(reverb); reverb.connect(wet); wet.connect(master);
  return { context, master, effects, music, noise, voices: new Set() };
}

export function scheduleNotes(graph: SoundGraph, notes: SoundNote[], when: number, bus: "effects" | "music" = "effects") {
  const context = graph.context;
  for (const note of notes) {
    const start = Math.max(context.currentTime, when + note.at), end = start + note.duration;
    if (graph.voices.size >= 80 && [...graph.voices].filter(voice => voice.end > start && voice.start < end).length >= 80) continue;
    const gain = context.createGain();
    gain.gain.value = 0;
    const source = note.noise ? context.createBufferSource() : context.createOscillator();
    if (source instanceof OscillatorNode) {
      source.type = note.wave ?? "sine";
      source.frequency.setValueAtTime(note.frequency, start);
      if (note.endFrequency) source.frequency.exponentialRampToValueAtTime(note.endFrequency, end);
    } else source.buffer = graph.noise;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(note.gain, start + .004);
    gain.gain.exponentialRampToValueAtTime(.0001, Math.max(start + .005, end - .008));
    gain.gain.linearRampToValueAtTime(0, end);
    let route: AudioNode = source;
    const nodes: AudioNode[] = [source, gain];
    if (note.filter) {
      const filter = context.createBiquadFilter(); filter.type = "lowpass";
      filter.frequency.value = note.filter; filter.Q.value = .55;
      route.connect(filter); route = filter; nodes.push(filter);
    }
    route.connect(gain);
    const panner = context.createStereoPanner(); panner.pan.value = note.pan ?? 0;
    gain.connect(panner); panner.connect(graph[bus]); nodes.push(panner);
    const voice: Voice = { source, gain, bus, start, end };
    graph.voices.add(voice);
    source.onended = () => { graph.voices.delete(voice); nodes.forEach(node => node.disconnect()); };
    source.start(start); source.stop(end + .01);
  }
}

export class GameAudio {
  private context: AudioContext | null = null;
  private graph: SoundGraph | null = null;
  private soundOn = true;
  private musicOn = true;
  private level = .65;
  private scene: "idle" | "playing" | "fever" | "paused" = "idle";
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private step = 0;

  get enabled() { return this.soundOn; }
  set enabled(value: boolean) { this.soundOn = value; this.updateVolume(); if (!value) this.stopVoices(); this.syncMusic(); }
  get musicEnabled() { return this.musicOn; }
  set musicEnabled(value: boolean) { this.musicOn = value; this.syncMusic(); }
  get volume() { return this.level; }
  set volume(value: number) { this.level = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .65; this.updateVolume(); }

  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        this.context = new AudioContext({ latencyHint: "interactive" });
        this.graph = createSoundGraph(this.context);
        this.updateVolume();
      }
      void this.context.resume().then(() => this.syncMusic()).catch(() => {});
    } catch { /* Visual feedback and gameplay remain available when audio is unsupported. */ }
  }

  setScene(scene: typeof this.scene) {
    if (scene === this.scene) return;
    this.scene = scene;
    if (scene === "paused" || scene === "idle") this.stopVoices();
    this.syncMusic();
  }

  stop() { this.scene = "idle"; this.stopVoices(); this.syncMusic(); }

  play(sound: Sound, options: { streak?: number; pan?: number } = {}) {
    if (!this.enabled || !this.graph || this.context?.state !== "running") return;
    scheduleNotes(this.graph, cueScore(sound, options.streak, options.pan), this.context.currentTime);
  }

  private updateVolume() {
    if (!this.graph) return;
    const now = this.graph.context.currentTime;
    holdGain(this.graph.master.gain, now);
    this.graph.master.gain.setTargetAtTime(this.enabled ? this.level : 0, now, .018);
  }

  private stopVoices(bus?: "music") {
    if (!this.graph) return;
    const now = this.graph.context.currentTime;
    for (const voice of this.graph.voices) {
      if (bus && voice.bus !== bus) continue;
      if (voice.start > now) {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(0, now);
      } else {
        holdGain(voice.gain.gain, now);
        voice.gain.gain.linearRampToValueAtTime(0, now + .025);
      }
      try { voice.source.stop(now + .035); } catch { /* Already ended. */ }
    }
  }

  private syncMusic() {
    const active = this.enabled && this.musicOn && this.context?.state === "running" && (this.scene === "playing" || this.scene === "fever");
    if (!active) {
      if (this.scheduler !== null) clearInterval(this.scheduler);
      this.scheduler = null;
      this.stopVoices("music");
      return;
    }
    if (this.scheduler !== null) return;
    this.nextBeat = this.context!.currentTime + .035;
    this.step = 0;
    const schedule = () => {
      if (!this.context || !this.graph || this.context.state !== "running") return;
      if (this.nextBeat < this.context.currentTime - .1) this.nextBeat = this.context.currentTime + .02;
      while (this.nextBeat < this.context.currentTime + .12) {
        scheduleNotes(this.graph, musicStep(this.step++, this.scene === "fever"), this.nextBeat, "music");
        this.nextBeat += MUSIC_STEP_SECONDS;
      }
    };
    schedule();
    this.scheduler = setInterval(schedule, 40);
  }
}
