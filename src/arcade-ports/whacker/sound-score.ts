/** Ported from whack-a; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
export type Sound = "hit" | "bonus" | "crown" | "miss" | "sleepy" | "pop" | "count" | "go" | "combo" | "fever" | "tick" | "pause" | "end" | "record" | "ui";
export interface SoundNote {
  at: number; duration: number; frequency: number; gain: number;
  wave?: OscillatorType; endFrequency?: number; noise?: boolean; filter?: number; pan?: number;
}
export const CUES: Sound[] = ["hit", "bonus", "crown", "miss", "sleepy", "pop", "count", "go", "combo", "fever", "tick", "pause", "end", "record", "ui"];
export const midiFrequency = (note: number) => 440 * 2 ** ((note - 69) / 12);
const bell = (midi: number, at = 0, gain = .13, duration = .35): SoundNote[] => [
  { at, frequency: midiFrequency(midi), gain, duration, wave: "sine" },
  { at, frequency: midiFrequency(midi) * 2.76, gain: gain * .22, duration: duration * .35, wave: "sine" },
];

/** An authored score, shared by live playback and the offline sound check. */
export function cueScore(sound: Sound, streak = 0, pan = 0): SoundNote[] {
  const step = Math.max(0, Math.min(4, Math.floor((Number.isFinite(streak) ? streak : 0) / 5)));
  const pitch = [72, 74, 76, 79, 81][step];
  const bonk: SoundNote[] = [
    { at: 0, duration: .12, frequency: 165, endFrequency: 62, gain: .2, wave: "triangle", filter: 1100 },
    { at: 0, duration: .038, frequency: 0, gain: .055, noise: true, filter: 1500 },
    ...bell(pitch, .016, .105, .22),
  ];
  let notes: SoundNote[];
  switch (sound) {
    case "hit": notes = bonk; break;
    case "bonus": notes = [...bonk, ...bell(pitch + 4, .075, .09), ...bell(pitch + 7, .14, .07)]; break;
    case "crown": notes = [...bonk, ...[0, 4, 7, 12].flatMap((offset, index) => bell(76 + offset, .06 + index * .055, .095, .48))]; break;
    case "miss": notes = [{ at: 0, frequency: 185, endFrequency: 73, duration: .18, gain: .14, wave: "triangle", filter: 800 }, { at: .025, frequency: 0, noise: true, duration: .075, gain: .045, filter: 500 }]; break;
    case "sleepy": notes = [{ at: 0, frequency: 240, endFrequency: 120, duration: .2, gain: .095, wave: "sine" }, ...bell(57, .09, .06, .22), ...bell(55, .2, .045, .28)]; break;
    case "pop": notes = [{ at: 0, frequency: 180, endFrequency: 440, duration: .065, gain: .055, wave: "sine" }]; break;
    case "count": notes = [{ at: 0, frequency: 660, endFrequency: 540, duration: .09, gain: .16, wave: "sine" }, { at: 0, frequency: 0, noise: true, duration: .018, gain: .04, filter: 2400 }]; break;
    case "go": notes = [72, 76, 79, 84].flatMap((note, index) => bell(note, index * .075, .14, .36)); break;
    case "combo": notes = [79, 84].flatMap((note, index) => bell(note + step, index * .08, .09, .3)); break;
    case "fever": notes = [72, 76, 79, 84, 88, 91].flatMap((note, index) => bell(note, index * .075, .12, .42)); break;
    case "tick": notes = [{ at: 0, frequency: 880, duration: .06, gain: .065, wave: "sine" }]; break;
    case "pause": notes = bell(67, 0, .065, .24); break;
    case "end": notes = [79, 76, 74, 72].flatMap((note, index) => bell(note, index * .14, .11, .55)); break;
    case "record": notes = [72, 76, 79, 84, 79, 84, 88].flatMap((note, index) => bell(note, index * .12, .12, .5)); break;
    case "ui": notes = bell(79, 0, .045, .09); break;
  }
  const position = Number.isFinite(pan) ? Math.max(-.7, Math.min(.7, pan)) : 0;
  return notes.map(note => ({ ...note, pan: position }));
}

export const MUSIC_STEP_SECONDS = 60 / 104 / 2;
const melody = [
  76, null, 79, null, 81, 79, 76, null, 74, null, 76, 79, 76, null, 72, null,
  76, null, 79, null, 81, null, 84, 81, 79, null, 76, null, 74, null, null, null,
  77, null, 81, null, 79, 77, 76, null, 74, null, 76, null, 79, null, 74, null,
  76, null, 79, null, 84, 81, 79, null, 76, null, 74, null, 72, null, null, null,
];
const chords = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];
export function musicStep(step: number, fever = false): SoundNote[] {
  const index = ((Math.floor(step) % 64) + 64) % 64;
  const beat = index % 8;
  const chord = chords[Math.floor(index / 16)];
  const notes: SoundNote[] = [];
  if (beat === 0 || beat === 4) {
    notes.push({ at: 0, frequency: midiFrequency(chord[0] - 12), gain: .11, duration: .33, wave: "triangle", filter: 650 });
    chord.forEach((note, i) => notes.push({ at: i * .016, frequency: midiFrequency(note + 12), gain: .034, duration: .32, wave: "triangle", filter: 1800 }));
  }
  const note = melody[index];
  if (note !== null) notes.push(...bell(note, 0, .065, .31));
  if (beat % 2 === 1) notes.push({ at: 0, frequency: 0, gain: fever ? .022 : .012, duration: .035, noise: true, filter: 4800 });
  if (fever && beat % 2 === 0) notes.push(...bell(chord[beat % 3] + 36, .14, .035, .17));
  return notes.map(tone => ({ ...tone, pan: tone.noise ? -.3 : beat % 2 ? .24 : -.12 }));
}
