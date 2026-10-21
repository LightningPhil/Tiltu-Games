/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
// Original instrumental scores. Degrees are relative to each track's tonic, not transcriptions.
export const MUSIC_TRACKS = {
    'vector-rush': { name: 'Vector Rush', bpm: 138, key: 'F♯ minor', style: 'Driving club trance', detail: 'A heavy octave bassline, clipped synth calls and a wide, rising answer.', bars: 96 },
    'azure-signal': { name: 'Azure Signal', bpm: 140, key: 'D major', style: 'Supersaw anthem', detail: 'Bright layered leads climb over a bittersweet progression and sparkling arpeggios.', bars: 96 },
    'starlight-current': { name: 'Starlight Current', bpm: 136, key: 'A major', style: 'Uplifting melodic trance', detail: 'Long, singing synth phrases and open chords build into a luminous chorus.', bars: 96 },
    'daybreak-circuit': { name: 'Daybreak Circuit', bpm: 138, key: 'E minor', style: 'Plucked melodic trance', detail: 'Interlocking synth plucks, rolling bass and a delayed lead with a sharp club lift.', bars: 96 },
    'radiant-skies': { name: 'Radiant Skies', bpm: 137, key: 'F minor', style: 'Emotional peak-time trance', detail: 'Warm chord inversions, a lyrical synth lead and a strong answering phrase.', bars: 96 },
    'beyond-the-horizon': { name: 'Beyond the Horizon', bpm: 138, key: 'E♭ major', style: 'Euphoric widescreen trance', detail: 'Spacious extended harmony grows into a high, sustained melodic release.', bars: 96 },
    'endless-vector': { name: 'Endless Vector', bpm: 140, key: 'A minor', style: 'Relentless instrumental trance', detail: 'A pulsing sixteenth-note sequence, moving bass and a final dominant lift.', bars: 96 },
    synthwave: { name: 'Night Drive', bpm: 112, key: 'A minor', style: 'Original synthwave', detail: 'The earlier relaxed synthwave arrangement, with warm chords and a gently answering lead.', bars: 64 },
} as const;
export type MusicTrackId = keyof typeof MUSIC_TRACKS;
export type TranceTrackId = Exclude<MusicTrackId, 'synthwave'>;
export const DEFAULT_MUSIC_TRACK: MusicTrackId = 'azure-signal';
export function isMusicTrack(value: unknown): value is MusicTrackId { return typeof value === 'string' && Object.hasOwn(MUSIC_TRACKS, value); }
export type Instrument = 'kick' | 'clap' | 'hat' | 'open-hat' | 'crash' | 'rise' | 'bass' | 'pad' | 'lead' | 'pluck' | 'arp';
export type MusicNote = { instrument: Instrument; midi: number; duration: number; velocity: number; pan: number; brightness: number };
type Chord = readonly [number, number, number]; // root offset, third, seventh (0 for an open/add9 voicing)
type Phrase = readonly (readonly [number, number, number])[]; // sixteenth offset, scale degree, length in sixteenths
type Score = { tonic: number; major: boolean; chords: readonly Chord[]; melody: readonly Phrase[]; answer: readonly Phrase[]; bass: readonly number[]; arp: readonly number[]; voice: 'lead' | 'pluck'; width: number };
const REST = -99;
export const SCORES: Record<TranceTrackId, Score> = {
    'vector-rush': {
        tonic: 42, major: false, chords: [[0,3,0],[-4,4,11],[-2,4,0],[-5,3,10]],
        melody: [[[0,4,3],[4,7,2],[7,6,1],[10,4,2],[14,5,2]],[[0,7,5],[6,9,2],[10,8,2],[14,6,2]],[[0,6,3],[4,4,2],[8,3,3],[12,2,2]],[[0,4,5],[7,2,2],[10,1,2],[14,0,2]]],
        answer: [[[0,11,3],[4,9,2],[7,7,1],[10,8,3],[14,9,2]],[[0,12,5],[6,11,2],[10,9,3],[14,7,2]],[[0,9,3],[4,8,2],[8,6,2],[11,7,2],[14,4,2]],[[0,6,4],[6,4,2],[10,2,2],[14,4,2]]],
        bass: [REST,0,12,0,REST,0,7,12,REST,0,12,0,REST,0,7,12], arp: [0,4,7,9,7,4,2,4], voice: 'lead', width: 8,
    },
    'azure-signal': {
        tonic: 38, major: true, chords: [[-3,3,10],[-7,4,11],[0,4,11],[-5,4,0]],
        melody: [[[0,9,3],[4,7,2],[8,6,2],[11,7,3]],[[0,8,5],[6,6,2],[10,4,2],[14,6,2]],[[0,7,3],[4,9,2],[8,11,3],[12,9,2]],[[0,8,5],[7,6,2],[10,4,2],[14,5,2]]],
        answer: [[[0,11,3],[4,9,2],[8,7,2],[11,9,3]],[[0,13,5],[6,11,2],[10,8,2],[14,9,2]],[[0,14,3],[4,11,2],[8,9,3],[12,11,2]],[[0,12,4],[6,11,2],[10,8,2],[14,6,2]]],
        bass: [REST,REST,0,0,REST,REST,0,12,REST,REST,0,0,REST,REST,7,12], arp: [0,4,7,11,9,7,4,2], voice: 'lead', width: 12,
    },
    'starlight-current': {
        tonic: 45, major: true, chords: [[0,4,11],[-5,4,0],[-3,3,10],[-7,4,11]],
        melody: [[[0,4,6],[8,6,3],[12,7,4]],[[0,8,6],[8,6,3],[12,5,4]],[[0,7,6],[8,9,3],[12,8,4]],[[0,6,6],[8,4,3],[12,2,4]]],
        answer: [[[0,11,6],[8,9,3],[12,7,4]],[[0,12,6],[8,11,3],[12,8,4]],[[0,9,6],[8,11,3],[12,14,4]],[[0,13,5],[7,11,3],[12,8,4]]],
        bass: [REST,REST,0,REST,REST,REST,0,12,REST,REST,0,REST,REST,REST,7,REST], arp: [0,2,4,7,9,7,4,2], voice: 'lead', width: 7,
    },
    'daybreak-circuit': {
        tonic: 40, major: false, chords: [[0,3,10],[-2,4,0],[-4,4,11],[-2,4,0]],
        melody: [[[0,7,2],[3,4,1],[6,5,2],[10,7,2],[13,9,2]],[[0,8,3],[4,6,2],[8,4,2],[12,3,3]],[[0,5,2],[3,7,1],[6,9,2],[10,8,2],[14,7,2]],[[0,6,3],[4,4,2],[8,3,2],[12,1,3]]],
        answer: [[[0,11,2],[3,9,1],[6,7,2],[10,9,2],[13,12,2]],[[0,13,3],[4,11,2],[8,8,2],[12,6,3]],[[0,12,2],[3,11,1],[6,9,2],[10,8,2],[14,7,2]],[[0,8,3],[4,6,2],[8,4,2],[12,6,3]]],
        bass: [REST,0,0,12,REST,0,7,0,REST,0,0,12,REST,7,0,12], arp: [0,7,4,9,2,7,4,11], voice: 'pluck', width: 5,
    },
    'radiant-skies': {
        tonic: 41, major: false, chords: [[0,3,10],[-4,4,11],[3,4,11],[-2,4,0]],
        melody: [[[0,4,5],[6,6,2],[10,7,4],[15,6,1]],[[0,5,6],[8,4,3],[12,2,4]],[[0,7,5],[6,9,2],[10,11,4],[15,9,1]],[[0,8,5],[6,6,2],[10,4,5]]],
        answer: [[[0,11,5],[6,9,2],[10,7,4],[15,9,1]],[[0,12,6],[8,11,3],[12,9,4]],[[0,14,5],[6,13,2],[10,11,4],[15,9,1]],[[0,13,5],[6,11,2],[10,8,5]]],
        bass: [REST,REST,0,12,REST,REST,0,REST,REST,REST,0,12,REST,REST,7,0], arp: [0,4,9,7,2,4,7,11], voice: 'lead', width: 9,
    },
    'beyond-the-horizon': {
        tonic: 39, major: true, chords: [[5,4,11],[-3,3,10],[-5,4,0],[0,4,11]],
        melody: [[[0,8,7],[8,9,3],[12,11,4]],[[0,9,7],[8,7,3],[12,6,4]],[[0,8,6],[8,6,3],[12,4,4]],[[0,7,10],[12,9,4]]],
        answer: [[[0,15,7],[8,13,3],[12,11,4]],[[0,16,7],[8,14,3],[12,11,4]],[[0,15,6],[8,13,3],[12,11,4]],[[0,14,10],[12,11,4]]],
        bass: [REST,REST,0,REST,REST,REST,0,12,REST,REST,0,REST,REST,REST,7,12], arp: [0,4,8,7,11,9,7,4], voice: 'lead', width: 10,
    },
    'endless-vector': {
        tonic: 45, major: false, chords: [[0,3,10],[-2,4,0],[-4,4,11],[-7,3,10],[0,3,0],[3,4,11],[-2,4,0],[-5,4,0]],
        melody: [[[0,7,2],[2,4,1],[4,6,2],[7,7,1],[9,9,2],[12,7,2],[15,4,1]],[[0,6,2],[2,3,1],[4,4,2],[7,6,1],[9,8,2],[12,6,2],[15,3,1]],[[0,5,2],[2,2,1],[4,4,2],[7,5,1],[9,7,2],[12,5,2],[15,2,1]],[[0,4,2],[2,1,1],[4,3,2],[7,4,1],[9,6,2],[12,4,2],[15,1,1]]],
        answer: [[[0,14,2],[2,11,1],[4,13,2],[7,14,1],[9,16,2],[12,14,2],[15,11,1]],[[0,13,2],[2,10,1],[4,11,2],[7,13,1],[9,15,2],[12,13,2],[15,10,1]],[[0,12,2],[2,9,1],[4,11,2],[7,12,1],[9,14,2],[12,12,2],[15,9,1]],[[0,11,2],[2,8,1],[4,10,2],[7,11,1],[9,13,2],[12,11,2],[15,8,1]]],
        bass: [REST,0,12,0,REST,0,7,0,REST,0,12,0,REST,7,0,12], arp: [0,4,7,4,2,6,9,6], voice: 'pluck', width: 6,
    },
};

export function midiFrequency(midi: number) { return 440 * 2 ** ((midi - 69) / 12); }
export function arrangement(bar: number) {
    const b = ((bar % 96) + 96) % 96;
    return b < 8 ? 'Launch' : b < 32 ? 'First light' : b < 40 ? 'Breakdown' : b < 48 ? 'Ascent' : b < 80 ? 'Euphoria' : b < 88 ? 'Afterglow' : 'Return';
}
export function musicStep(id: TranceTrackId, absoluteStep: number): MusicNote[] {
    const track = MUSIC_TRACKS[id], score = SCORES[id], step = ((absoluteStep % 1536) + 1536) % 1536;
    const bar = Math.floor(step / 16), beat = step % 16, tick = 60 / track.bpm / 4;
    const intro = bar < 8, breakdown = bar >= 32 && bar < 40, build = bar >= 40 && bar < 48, peak = bar >= 48 && bar < 80, outro = bar >= 88;
    const full = !intro && !breakdown && !build && !outro, chordIndex = Math.floor(bar / 2) % score.chords.length;
    const [offset, third, seventh] = score.chords[chordIndex], root = score.tonic + offset;
    const brightness = breakdown ? .36 : build ? .3 + (bar - 40 + beat / 16) / 8 * .7 : intro ? .48 : peak ? 1 : .8;
    const events: MusicNote[] = [];
    const add = (instrument: Instrument, midi: number, length: number, velocity: number, pan = 0) => events.push({ instrument, midi, duration: tick * length, velocity, pan, brightness });
    const scale = score.major ? [0,2,4,5,7,9,11] : [0,2,3,5,7,8,10];
    const note = (degree: number) => score.tonic + 24 + Math.floor(degree / 7) * 12 + scale[((degree % 7) + 7) % 7];
    // Pads use inversions with a shared high register; 9ths and sevenths keep the chord bed open.
    if (beat === 0 && bar % 2 === 0) for (const [index, interval] of [7,12,12 + third,seventh ? 12 + seventh : 14].entries()) add('pad', root + 12 + interval, 29, breakdown ? .85 : .48, (index - 1.5) * .4);
    if (!breakdown && !(build && bar >= 46) && (!outro || bar < 92)) {
        const bass = score.bass[beat];
        if (bass !== REST) add('bass', root + bass, .85, intro ? .62 : .9);
    }
    if (bar >= 4 && (!outro || beat % 4 === 0) && beat % (id === 'daybreak-circuit' || id === 'endless-vector' ? 1 : 2) === 0) {
        const intervals = [0,third,7,seventh || 12,14], degree = score.arp[(beat + Math.floor(bar / 2)) % score.arp.length];
        const tone = intervals[degree % intervals.length] + (degree > 6 ? 12 : 0);
        add('arp', root + 12 + tone, 1.6, breakdown ? .35 : peak ? .36 : .25, beat % 4 < 2 ? -.5 : .5);
    }
    // Four pairs of bars form an eight-bar statement; the second bar answers and breathes.
    if (full || breakdown || build && bar >= 44 || intro && bar >= 6) {
        const phrase = (peak ? score.answer : score.melody)[Math.floor(bar / 2) % score.melody.length];
        for (const [position, degree, length] of phrase) if (beat === position && (bar % 2 === 0 || position < 8 || full && bar % 8 === 7)) {
            let midi = note(degree);
            // The last dominant in Endless Vector raises G to G♯ before returning to A.
            if (id === 'endless-vector' && chordIndex === 7 && midi % 12 === 7) midi++;
            add(breakdown ? 'pluck' : score.voice, midi, length * (breakdown ? 1.3 : .92), full ? peak ? .86 : .75 : .35, bar % 2 ? .12 : -.12);
        }
    }
    const drums = !breakdown && (!intro || bar >= 2) && (!outro || bar < 94);
    if (drums) {
        if (beat % 4 === 0 && !(build && bar === 47 && beat >= 12)) add('kick', 0, 2.2, .9);
        if ((bar >= 4 || build) && [4,12].includes(beat)) add('clap', 0, 1.3, .67);
        if (beat % 2 === 0) add(beat % 4 === 2 ? 'open-hat' : 'hat', 0, beat % 4 === 2 ? 1.25 : .35, beat % 4 === 2 ? .38 : .25, beat % 4 === 2 ? .32 : -.32);
        if ((peak || id === 'endless-vector' && full) && beat % 2) add('hat', 0, .3, beat % 4 === 3 ? .16 : .1, -.25);
        if (build && beat % (bar < 44 ? 4 : bar < 46 ? 2 : 1) === 0) add('clap', 0, .7, .2 + (bar - 40) * .045, beat % 2 ? -.2 : .2);
        if (full && bar % 8 === 7 && beat >= 14) add('clap', 0, .65, .26, beat === 14 ? -.2 : .2);
    }
    if ([8,48,80].includes(bar) && beat === 0) add('crash', 0, 12, .5, .25);
    if ([7,47,95].includes(bar) && beat === 0) add('rise', 0, 15.8, bar === 47 ? .65 : .3, -.2);
    return events;
}
