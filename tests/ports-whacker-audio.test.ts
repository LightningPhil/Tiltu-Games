import { test } from "node:test";
import assert from "node:assert/strict";
import { CUES, cueScore, MUSIC_STEP_SECONDS, musicStep } from "../src/arcade-ports/whacker/sound-score.ts";
import { GameAudio, createSoundGraph, scheduleNotes } from "../src/arcade-ports/whacker/audio.ts";

test("every cue has a bounded, finite score and meaningful output", () => {
  for (const cue of CUES) {
    const notes = cueScore(cue, 25, .6);
    assert.ok(notes.length > 0);
    for (const note of notes) {
      assert.ok(Number.isFinite(note.at) && note.at >= 0 && note.at < 1);
      assert.ok(Number.isFinite(note.duration) && note.duration > .008 && note.duration < 1);
      assert.ok(Number.isFinite(note.gain) && note.gain > 0 && note.gain <= .2);
      assert.ok(note.noise || (note.frequency > 20 && note.frequency < 12000));
      assert.equal(note.pan, .6);
    }
  }
  assert.deepEqual(cueScore("hit", NaN, Infinity), cueScore("hit", 0, 0));
  assert.ok(cueScore("crown").length > cueScore("hit").length);
  assert.ok(cueScore("fever").length > cueScore("combo").length);
});

test("garden music loops on a stable beat and fever adds a fuller arrangement", () => {
  assert.ok(MUSIC_STEP_SECONDS > .25 && MUSIC_STEP_SECONDS < .35);
  for (let step = 0; step < 64; step++) {
    assert.deepEqual(musicStep(step), musicStep(step + 64));
    assert.ok(musicStep(step, true).length >= musicStep(step).length);
    musicStep(step, true).forEach(note => assert.ok(Number.isFinite(note.frequency) && note.duration > 0));
  }
});

class Param {
  value = 0;
  held = false;
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number) { this.value = value; }
  exponentialRampToValueAtTime(value: number) { this.value = value; }
  setTargetAtTime(value: number) { this.value = value; }
  cancelScheduledValues() {}
  cancelAndHoldAtTime() { this.held = true; }
}
class Node {
  gain = new Param(); frequency = new Param(); pan = new Param(); Q = new Param();
  threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param();
  disconnected = false;
  connect(node: Node) { return node; }
  disconnect() { this.disconnected = true; }
}
class Source extends Node {
  stops: number[] = [];
  onended: (() => void) | null = null;
  start() {}
  stop(time: number) { this.stops.push(time); }
}
class Oscillator extends Source { type = "sine"; }
class Context {
  static created: Context[] = [];
  currentTime = 0; sampleRate = 8000; state = "running"; destination = new Node();
  sources: Source[] = []; gains: Node[] = [];
  constructor() { Context.created.push(this); }
  createGain() { const node = new Node(); this.gains.push(node); return node; }
  createDynamicsCompressor() { return new Node(); }
  createConvolver() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createStereoPanner() { return new Node(); }
  createBuffer(channels: number, length: number) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { getChannelData: (channel: number) => data[channel] }; }
  createOscillator() { const source = new Oscillator(); this.sources.push(source); return source; }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  resume() { return Promise.resolve(); }
}
Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: Context });
Object.defineProperty(globalThis, "OscillatorNode", { configurable: true, value: Oscillator });

test("audio waits for an unlock gesture, clamps volume, and does not create a context when muted", async () => {
  const before = Context.created.length;
  const audio = new GameAudio();
  audio.enabled = false;
  audio.unlock(); audio.play("hit");
  assert.equal(Context.created.length, before);
  audio.volume = 9; assert.equal(audio.volume, 1);
  audio.volume = -1; assert.equal(audio.volume, 0);
  audio.volume = NaN; assert.equal(audio.volume, .65);
  audio.enabled = true; audio.musicEnabled = false; audio.unlock();
  await Promise.resolve();
  assert.equal(Context.created.length, before + 1);
  const context = Context.created.at(-1)!;
  assert.equal(context.sources.length, 0);
  audio.play("hit");
  assert.ok(context.sources.length > 0);
  audio.enabled = false;
  assert.ok(context.sources.every(source => source.stops.at(-1)! <= .035));
  assert.equal(context.gains[0].gain.value, 0);
  audio.stop();
});

test("pause stops scheduled music and effects; restarting the scene creates only one scheduler", async () => {
  const audio = new GameAudio();
  audio.unlock(); await Promise.resolve();
  audio.setScene("playing");
  const context = Context.created.at(-1)!;
  const first = context.sources.length;
  assert.ok(first > 0);
  audio.setScene("playing");
  assert.equal(context.sources.length, first);
  audio.play("crown");
  audio.setScene("paused");
  assert.ok(context.sources.every(source => source.stops.at(-1)! <= .035));
  audio.setScene("playing");
  assert.ok(context.sources.length > first);
  audio.stop();
});

test("music can be silenced independently while effects remain available", async () => {
  const audio = new GameAudio(); audio.unlock(); await Promise.resolve();
  audio.setScene("playing");
  const context = Context.created.at(-1)!;
  const music = [...context.sources];
  audio.musicEnabled = false;
  assert.ok(music.every(source => source.stops.at(-1)! <= .035));
  const count = context.sources.length;
  audio.play("bonus");
  assert.ok(context.sources.length > count);
  assert.equal(audio.enabled, true);
  audio.stop();
});

test("volume and mute still work when the browser lacks gain hold automation", async () => {
  const audio = new GameAudio(); audio.musicEnabled = false; audio.unlock(); await Promise.resolve();
  audio.play("crown");
  const context = Context.created.at(-1)!;
  for (const gain of context.gains) Object.defineProperty(gain.gain, "cancelAndHoldAtTime", { value: undefined });
  audio.volume = .4;
  assert.equal(context.gains[0].gain.value, .4);
  audio.enabled = false;
  assert.equal(context.gains[0].gain.value, 0);
  assert.ok(context.sources.every(source => source.stops.at(-1)! <= .035));
  audio.stop();
});

test("the voice limit prevents overlapping bursts but allows a full future score to render", () => {
  const context = new Context();
  const graph = createSoundGraph(context as unknown as BaseAudioContext);
  const note = { at: 0, duration: .1, frequency: 440, gain: .1 };
  scheduleNotes(graph, Array(100).fill(note), 0);
  assert.equal(context.sources.length, 80);
  scheduleNotes(graph, [note], 1);
  assert.equal(context.sources.length, 81);
  context.sources[0].onended?.();
  assert.equal(graph.voices.size, 80);
  assert.equal(context.sources[0].disconnected, true);
});
