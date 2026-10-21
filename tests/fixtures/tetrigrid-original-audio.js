// Original TetraGrid audio engine from repository commit 6dbd450.
// Immutable regression reference; excluded from the production build.
export function createOriginalAudio(ctx) {
const GAME_CONFIG = { BPM: 128 };
const engine = {
    ctx: null,
    masterGain: null,
    isPlaying: false,
    lookahead: 25.0,
    scheduleAheadTime: 0.1,
    nextNoteTime: 0.0,
    current16thNote: 0,
    
    // MIDI Notes
    notes: {
        A3: 57, B3: 59, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, Gs4: 68,
        A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81
    },

    // KOROBEINIKI MELODY (Exact transcription)
    // 32-step loop (2 bars of 16ths) - scaled up for full song
    // A-Section: 16 bars (Steps 0 - 255)
    melodyMap: {
        // BAR 1 (Am)
        0: 76, 4: 71, 6: 72, 8: 74, 10: 72, 12: 71, 14: 69, // E, B, C, D, C, B, A
        // BAR 2 (Am -> E)
        16: 69, 18: 72, 20: 76, 24: 74, 26: 72, 28: 71, // A, C, E, D, C, B
        // BAR 3 (E -> Am)
        32: 71, 34: 72, 36: 74, 40: 76, 44: 72, 48: 69, 52: 69, // B, C, D, E, C, A, A
        
        // BAR 5 (Dm) - The High Part
        64: 74, 68: 77, 72: 81, 74: 79, 76: 77, 78: 76, // D, F, A, G, F, E
        // BAR 6 (Am)
        80: 72, 82: 76, 84: 74, 86: 72, 88: 71, // C, E, D, C, B
        // BAR 7 (E -> Am)
        96: 71, 98: 72, 100: 74, 104: 76, 108: 72, 112: 69, 116: 69, // B, C, D, E, C, A, A

        // --- REPEAT WHOLE PHRASE --- 
        // BAR 9 (Am)
        128: 76, 132: 71, 134: 72, 136: 74, 138: 72, 140: 71, 142: 69,
        // BAR 10
        144: 69, 146: 72, 148: 76, 152: 74, 154: 72, 156: 71,
        // BAR 11
        160: 71, 162: 72, 164: 74, 168: 76, 172: 72, 176: 69, 180: 69,
        // BAR 13 (Dm)
        192: 74, 196: 77, 200: 81, 202: 79, 204: 77, 206: 76,
        // BAR 14
        208: 72, 210: 76, 212: 74, 214: 72, 216: 71,
        // BAR 15
        224: 71, 226: 72, 228: 74, 232: 76, 236: 72, 240: 69, 244: 69
    },

    // 16-Bar Bass Progression (Am - E - Am - Dm - Am - E - Am)
    // Steps represent 16th notes. 1 Bar = 16 steps.
    bassSequence: [
        57, 64, 52, 59, // Bar 1-4: Am, E
        57, 64, 57, 64, // Am
        62, 69, 57, 64, // Bar 5-8: Dm, Am
        52, 59, 57, 52, // E, Am
        57, 64, 52, 59, // Bar 9-12 (Repeat)
        57, 64, 57, 64,
        62, 69, 57, 64, // Bar 13-16
        52, 59, 57, 52
    ],

    init() {
        if(this.ctx) { if(this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;
        
        // Pumping Compressor (Sidechain effect)
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -24;
        comp.ratio.value = 16;
        comp.attack.value = 0.003;
        comp.release.value = 0.15; // Fast release for "pumping"

        this.masterGain.connect(comp);
        comp.connect(this.ctx.destination);
    },

    startMusic() {
        if(this.isPlaying) return;
        this.isPlaying = true;
        this.current16thNote = 0;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.scheduler();
    },

    stopMusic() { 
        this.isPlaying = false; 
        clearTimeout(this.timerID);
    },

    scheduler() {
        if(!this.isPlaying) return;
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            this.nextNote();
        }
        this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
    },

    nextNote() {
        const secondsPerBeat = 60.0 / GAME_CONFIG.BPM;
        this.nextNoteTime += 0.25 * secondsPerBeat; // 16th note
        this.current16thNote = (this.current16thNote + 1) % 256; // 16 bar loop
    },

    scheduleNote(step, time) {
        // --- DRUMS (HOUSE BEAT) ---
        // Kick on 1, 5, 9, 13 (Four on the floor)
        if (step % 4 === 0) {
            this.playKick(time);
        }
        
        // Open Hat on offbeats (3, 7, 11, 15)
        if (step % 4 === 2) {
            this.playOpenHat(time);
        }

        // Closed Hat on 16ths filler
        if (step % 4 !== 2) {
            this.playClosedHat(time);
        }

        // Clap/Snare on 2 and 4 (Steps 4 and 12 in a 0-15 count)
        if ((step % 16 === 4) || (step % 16 === 12)) {
            this.playClap(time);
        }

        // --- BASS (Rolling / Offbeat) ---
        const barIndex = Math.floor(step / 16); // Which bar (0-15)
        const beatInBar = Math.floor(step / 4) % 4; // 0, 1, 2, 3
        
        // Get root note from progression map (simplified to 1 root per 2 beats roughly)
        // Mapping 16 bars to array indices
        const bassNote = this.bassSequence[Math.floor(step / 8)]; 
        
        // Rolling bass pattern: play on off-beats to sync with Hi-Hats
        if (step % 2 === 1) {
             // Ducking volume on kick hits (sidechain simulation via velocity)
             this.playBass(time, this.mtof(bassNote - 12));
        }

        // --- LEAD MELODY ---
        const note = this.melodyMap[step];
        if(note) {
            this.playLead(time, this.mtof(note));
        }
    },

    // --- INSTRUMENTS ---

    playKick(t) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        g.gain.setValueAtTime(1.0, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.connect(g); g.connect(this.masterGain);
        osc.start(t); osc.stop(t + 0.15);
    },

    playClap(t) {
        const noise = this.ctx.createBufferSource();
        const b = this.ctx.createBuffer(1, 4096, this.ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0;i<4096;i++) d[i] = Math.random()*2-1;
        noise.buffer = b;
        const f = this.ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1200;
        const g = this.ctx.createGain(); 
        g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.01, t+0.1);
        noise.connect(f); f.connect(g); g.connect(this.masterGain);
        noise.start(t);
    },

    playClosedHat(t) {
        const noise = this.ctx.createBufferSource();
        const b = this.ctx.createBuffer(1, 2048, this.ctx.sampleRate);
        const d = b.getChannelData(0); for(let i=0;i<2048;i++) d[i]=Math.random()*2-1;
        noise.buffer = b;
        const f = this.ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=6000;
        const g = this.ctx.createGain(); 
        g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.01, t+0.05);
        noise.connect(f); f.connect(g); g.connect(this.masterGain);
        noise.start(t);
    },

    playOpenHat(t) {
        const noise = this.ctx.createBufferSource();
        const b = this.ctx.createBuffer(1, 8096, this.ctx.sampleRate);
        const d = b.getChannelData(0); for(let i=0;i<8096;i++) d[i]=Math.random()*2-1;
        noise.buffer = b;
        const f = this.ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=5000;
        const g = this.ctx.createGain(); 
        g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.01, t+0.2);
        noise.connect(f); f.connect(g); g.connect(this.masterGain);
        noise.start(t);
    },

    playBass(t, freq) {
        const osc = this.ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 5;
        f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(freq*4, t+0.05);
        f.frequency.exponentialRampToValueAtTime(freq, t+0.2);
        
        const g = this.ctx.createGain(); 
        // Ducking for kick
        g.gain.setValueAtTime(0.05, t); 
        g.gain.linearRampToValueAtTime(0.6, t+0.05); 
        g.gain.exponentialRampToValueAtTime(0.01, t+0.3);

        osc.connect(f); f.connect(g); g.connect(this.masterGain);
        osc.start(t); osc.stop(t+0.3);
    },

    playLead(t, freq) {
        const osc = this.ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = freq;
        const osc2 = this.ctx.createOscillator(); osc2.type = 'sawtooth'; osc2.frequency.value = freq+2; // Detune

        const g = this.ctx.createGain(); 
        // Strong sidechain ducking curve
        g.gain.setValueAtTime(0, t); 
        g.gain.linearRampToValueAtTime(0.15, t+0.05);
        g.gain.setTargetAtTime(0, t+0.1, 0.1);

        const d = this.ctx.createDelay(); d.delayTime.value = 60/GAME_CONFIG.BPM * 0.75;
        const dg = this.ctx.createGain(); dg.gain.value = 0.3;

        osc.connect(g); osc2.connect(g); g.connect(this.masterGain);
        g.connect(d); d.connect(dg); dg.connect(d); dg.connect(this.masterGain);

        osc.start(t); osc.stop(t+0.4); osc2.start(t); osc2.stop(t+0.4);
    },

    mtof(note) { return 440 * Math.pow(2, (note - 69) / 12); },

    sfx(type) {
        if(!this.ctx) return;
        const t = this.ctx.currentTime;
        const g = this.ctx.createGain(); g.connect(this.masterGain);
        
        if(type === 'move') {
            const o = this.ctx.createOscillator(); o.type = 'triangle';
            o.frequency.setValueAtTime(300, t); o.frequency.linearRampToValueAtTime(600, t+0.05);
            g.gain.setValueAtTime(0.05, t); g.gain.linearRampToValueAtTime(0, t+0.05);
            o.connect(g); o.start(t); o.stop(t+0.05);
        }
        else if(type === 'rotate') {
            const o = this.ctx.createOscillator(); o.type = 'square';
            o.frequency.setValueAtTime(200, t); o.frequency.linearRampToValueAtTime(400, t+0.05);
            g.gain.setValueAtTime(0.03, t); g.gain.linearRampToValueAtTime(0, t+0.05);
            o.connect(g); o.start(t); o.stop(t+0.05);
        }
        else if(type === 'drop') {
            const o = this.ctx.createOscillator(); 
            o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(0.01, t+0.2);
            g.gain.setValueAtTime(0.2, t); g.gain.linearRampToValueAtTime(0, t+0.2);
            o.connect(g); o.start(t); o.stop(t+0.2);
        }
        else if(type === 'clear') {
            const o = this.ctx.createOscillator(); o.type = 'sine';
            o.frequency.setValueAtTime(880, t); o.frequency.linearRampToValueAtTime(1760, t+0.3);
            g.gain.setValueAtTime(0.2, t); g.gain.linearRampToValueAtTime(0, t+0.3);
            o.connect(g); o.start(t); o.stop(t+0.3);
        }
    }
};
engine.ctx=ctx;engine.masterGain=ctx.createGain();engine.masterGain.gain.value=0.5;
const comp=ctx.createDynamicsCompressor();comp.threshold.value=-24;comp.ratio.value=16;comp.attack.value=0.003;comp.release.value=0.15;
engine.masterGain.connect(comp);comp.connect(ctx.destination);return engine;
}
