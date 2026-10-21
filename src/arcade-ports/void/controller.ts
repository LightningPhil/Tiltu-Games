// @ts-nocheck
/** Full gameplay port from neon-void, hosted by Tiltu's Games. */
import type {PortScope,PortHooks} from '../scope.ts';
import {bindScope} from './environment.ts';
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { GAME_CONFIG, COIN_VALUE, ENEMY_DAMAGE_MULTIPLIER, ENEMY_PROJECTILE_DAMAGE_MULTIPLIER, MODULE_KEYS, MODULE_SLOTS, ORDNANCE_KEYS, TURRET_MOUNTS, WAVE_COUNT, WAVE_DURATION_MS, SHOP_WAVE_INTERVAL, STEP_MS, INVASION, SHIPS, getShip, getAct, getCommander, isCommanderWave, createLevels, moduleCount,
    getPlayerStats, getMultishotStats, getPracticeLevels, getUpgradeCost, getSalvageValue, getShipValue, getRepairCost, upgradeLock, getWaveProfile, releasedThreat, getEnemyScale, chooseEnemy } from "./balance.ts";
import { shopDiagram, shipLoadout } from "./shop-art.ts";
import { DIFFICULTIES, ABILITIES, CAREER_GOALS, shipUnlocked, advanceCareer, validateCheckpoint, getDifficulty, scoreMultiplier, formatTime, createRunStats, createProfile, loadProfile, saveProfile, recordRun } from "./progress.ts";
import { drawPlayer, drawEnemy } from "./visuals.ts";
import { MUSIC_TRACKS, MusicPlayer, isMusicTrack, getMusicTrack } from './music.ts';
import { END_SEQUENCE, ShipExplosion } from './ending.ts';
import { playVictorySting } from './victory-audio.ts';
import { FlightPointer, fitFlightArena, compactShop } from './flight-controls.ts';
import { effectsRandom } from './effects-random.ts';
import { VirtualStick, holdControl } from '../../arcade-controls.ts';
export function createGame(scope:PortScope):PortHooks {
bindScope(scope);
// BEGIN GAME RUNTIME
const DROPS_SUPPORT = [
    { type: 'battery', color: '#00ff00', label: 'BATTERY' },
    { type: 'overshield', color: '#ffffff', label: 'OVERSHIELD' }
];
const DROPS_BUFFS = [
    { type: 'buff_rapid', color: '#ffff00', label: 'RAPID FIRE' },
    { type: 'buff_plasma', color: '#00ccff', label: 'ULTRA PLASMA' },
    { type: 'buff_guns', color: '#ff00ff', label: 'EXTRA GUNS' },
    { type: 'buff_missiles', color: '#ffaa00', label: 'HOMING BARRAGE' }
];
const DEFAULT_DROP = { type: 'battery', color: '#00ff00', label: 'BATTERY' }; 

/**
 * =========================================
 * AUDIO ENGINE
 * =========================================
 */
const AudioEngine = {
    ctx: null, masterGain: null, sfxGain: null, bgmGain: null,
    timerId: 0, lastEnemyShot: 0, noiseBuffer: null,
    isPlaying: false, musicPlayer: null, victorySound: null,

    init() {
        if(this.ctx) { if(this.ctx.state!=='running'&&this.ctx.state!=='closed') this.ctx.resume().catch(()=>{}); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this.ctx = new AC(); } catch { return; }
        this.masterGain = this.ctx.createGain(); this.masterGain.connect(this.ctx.destination); this.masterGain.gain.value = 0.5;
        this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.masterGain); this.sfxGain.gain.value = 0.6;
        this.bgmGain = this.ctx.createGain(); this.bgmGain.connect(this.masterGain); this.bgmGain.gain.value = 0.35;
        this.musicPlayer = new MusicPlayer(this.ctx,this.bgmGain,Game.profile.settings.musicTrack);
        this.updateVolumes();
        this.startMusic();
    },
    startMusic() { this.victorySound?.stop();this.victorySound=null;if (!this.ctx || this.isPlaying) return; this.isPlaying = true; this.musicPlayer.setTrack(Game.profile.settings.musicTrack); this.musicPlayer.start(); this.scheduler(); },
    stopMusic() { this.isPlaying = false; cancelAnimationFrame(this.timerId); this.musicPlayer?.stop(); },
    selectTrack(id) { if(this.ctx&&this.ctx.state!=='running'&&this.ctx.state!=='closed')this.ctx.resume().catch(()=>{}); this.musicPlayer?.setTrack(id); },
    updateVolumes() {
        if (!this.ctx) return;
        const prefs = Game.profile.settings, t = this.ctx.currentTime;
        this.masterGain.gain.setTargetAtTime(prefs.muted ? 0 : .55,t,.1);
        this.bgmGain.gain.setTargetAtTime(prefs.music*(Game.paused&&!Game.manualPause ? .4 : 1),t,.12);
        this.sfxGain.gain.setTargetAtTime(prefs.sfx,t,.1);
    },
    sfxEnabled() { return Boolean(this.ctx&&!Game.profile.settings.muted&&Game.profile.settings.sfx>0); },
    playAbility(kind) {
        if(!this.sfxEnabled())return;
        const t=this.ctx.currentTime,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
        osc.type='sine';osc.frequency.setValueAtTime(kind==='dash'?180:75,t);osc.frequency.exponentialRampToValueAtTime(kind==='dash'?700:450,t+.25);
        gain.gain.setValueAtTime(.22,t);gain.gain.exponentialRampToValueAtTime(.001,t+.35);
        osc.connect(gain);gain.connect(this.sfxGain);osc.start(t);osc.stop(t+.36);
    },
    playDamage(hullHit) {
        if(!this.sfxEnabled())return;
        const t=this.ctx.currentTime,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
        osc.type=hullHit?'sawtooth':'triangle';osc.frequency.setValueAtTime(hullHit?160:560,t);osc.frequency.exponentialRampToValueAtTime(hullHit?45:150,t+.18);
        gain.gain.setValueAtTime(hullHit ? .2 : .12,t);gain.gain.exponentialRampToValueAtTime(.001,t+.22);
        osc.connect(gain);gain.connect(this.sfxGain);osc.start(t);osc.stop(t+.23);
    },
    scheduler() {
        if(!this.isPlaying || !this.ctx) return;
        if(!Game.profile.settings.muted&&Game.profile.settings.music>0)this.musicPlayer.tick();
        this.timerId = requestAnimationFrame(() => this.scheduler());
    },
    playShoot(type = 'player', big=false) {
        if(!this.sfxEnabled())return; const t = this.ctx.currentTime;
        if (type === 'enemy' && t-this.lastEnemyShot < .09) return;
        if (type === 'enemy') this.lastEnemyShot = t;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = type === 'player' ? 'square' : 'triangle';
        let startFreq = type === 'player' ? 800 : 300; if(big) startFreq=400;
        const endFreq = type === 'player' ? 100 : 50;
        osc.frequency.setValueAtTime(startFreq, t); osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.1);
        gain.gain.setValueAtTime(0.1, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.connect(gain); gain.connect(this.sfxGain); osc.start(t); osc.stop(t + 0.1);
    },
    playMissile() {
        if(!this.sfxEnabled())return; const t = this.ctx.currentTime; const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, t); osc.frequency.linearRampToValueAtTime(600, t + 0.2);
        gain.gain.setValueAtTime(0.1, t); gain.gain.linearRampToValueAtTime(0, t + 0.2);
        osc.connect(gain); gain.connect(this.sfxGain); osc.start(t); osc.stop(t+0.2);
    },
    playExplosion() {
        if(!this.sfxEnabled())return; const t = this.ctx.currentTime;
        const bSize = this.ctx.sampleRate * 0.5;
        if (!this.noiseBuffer) { this.noiseBuffer = this.ctx.createBuffer(1,bSize,this.ctx.sampleRate); const d=this.noiseBuffer.getChannelData(0); for(let i=0;i<bSize;i++)d[i]=effectsRandom()*2-1; }
        const b=this.noiseBuffer;
        const src = this.ctx.createBufferSource(); src.buffer = b;
        const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, t); filter.frequency.linearRampToValueAtTime(100, t + 0.4);
        const gain = this.ctx.createGain(); gain.gain.setValueAtTime(0.5, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        src.connect(filter); filter.connect(gain); gain.connect(this.sfxGain); src.start(t);
    },
    playCoin() {
        if(!this.sfxEnabled())return; const t = this.ctx.currentTime; const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(1200, t); osc.frequency.setValueAtTime(1800, t + 0.05);
        gain.gain.setValueAtTime(0.1, t); gain.gain.linearRampToValueAtTime(0, t + 0.1);
        osc.connect(gain); gain.connect(this.sfxGain); osc.start(t); osc.stop(t+0.1);
    },
    playPowerup() {
        if(!this.sfxEnabled())return; const t = this.ctx.currentTime; const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(400, t); osc.frequency.linearRampToValueAtTime(800, t + 0.3);
        gain.gain.setValueAtTime(0.2, t); gain.gain.linearRampToValueAtTime(0, t + 0.3);
        osc.connect(gain); gain.connect(this.sfxGain); osc.start(t); osc.stop(t+0.3);
    },
    playCrateBreak() {
        if(!this.sfxEnabled())return; const t = this.ctx.currentTime; const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = 'square'; osc.frequency.setValueAtTime(200, t); osc.frequency.linearRampToValueAtTime(50, t + 0.2);
        gain.gain.setValueAtTime(0.3, t); gain.gain.linearRampToValueAtTime(0, t + 0.2);
        osc.connect(gain); gain.connect(this.sfxGain); osc.start(t); osc.stop(t+0.2);
    },
    playVictory() {
        if(!this.sfxEnabled())return;
        this.victorySound?.stop();
        this.victorySound=playVictorySting(this.ctx,this.sfxGain);
    }
};

/**
 * =========================================
 * GAME STATE
 * =========================================
 */
const CANVAS_GAME = document.getElementById('game-layer'); const CTX = CANVAS_GAME.getContext('2d');
const CANVAS_BG = document.getElementById('bg-layer'); const CTX_BG = CANVAS_BG.getContext('2d');
let WIDTH = window.innerWidth; let HEIGHT = window.innerHeight;

const Game = {
    active: false, paused: false, manualPause: false, lastTime: 0, accumulator: 0, elapsed: 0, shopTimer: 0,
    wave: 1, spawnTimer: 500, spentThreat: 0, clearTimer: 0, bossSpawned: false, victory: false, hudTimer: 0, invasion:null,
    profile: createProfile(), difficulty: 'arcade', endless: false, recordable: true, stats: createRunStats(),
    practice:false,practiceOrigin:null,practiceWave:30,practiceLoadout:'recommended',
    ending:null,lastEnemyExplosion:null,
    shipId:'vanguard',lastClearedWave:0,careerBank:{kills:0,dashes:0,pulses:0},
    pulseCharge: 25, bannerTimer: 0, labels: [], rings: [], pointer: new FlightPointer(),touchMode:false,layout:null,stick:null,fireControl:null,touchFire:false,
    shopPhase: 'fighting', shopTab:'weapons', shopPage:0,salvagePending:null,
    player: null, enemies: [], crates: [], bullets: [], missiles: [], particles: [], drops: [], beacon: null,
    coins: 0,
    keys: { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, " ": false },
    levels: createLevels(),
    bgStars: [], bgGridOffset: 0,

    init() {
        this.profile = loadProfile(undefined,Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
        this.touchMode=Boolean(window.matchMedia?.('(pointer: coarse)').matches);
        this.stick=new VirtualStick(document.getElementById('void-stick'));
        this.fireControl=holdControl(document.getElementById('fire-btn'),held=>{this.touchFire=held;});
        this.resize(); window.addEventListener('resize', () => this.resize()); this.createStars();
        window.visualViewport?.addEventListener('resize',()=>this.resize());
        if(window.ResizeObserver){const observer=new ResizeObserver(()=>this.resize());for(const selector of ['.flight-hud','.flight-bottom'])observer.observe(document.querySelector(selector));}
        window.addEventListener('keydown', e => {
            if(document.getElementById('equipment-dialog').open){if(e.key==='Escape'){e.preventDefault();closeEquipment();}return;}
            if(document.getElementById('salvage-dialog').open){if(e.key==='Escape'){e.preventDefault();cancelSalvage();}return;}
            if(e.ctrlKey||e.metaKey||e.altKey)return;
            if(e.key==='Escape'&&!e.repeat){this.togglePause();return;}
            if(e.key==='Tab'){
                const overlay=document.querySelector('.overlay-screen[style*="flex"]')||(!this.active?document.getElementById('start-screen'):null);
                if(overlay){const controls=[...overlay.querySelectorAll('button:not(:disabled),input,select,summary')].filter(el=>el.getClientRects().length);const first=controls[0],last=controls[controls.length-1];if(first&&((e.shiftKey&&document.activeElement===first)||(!e.shiftKey&&document.activeElement===last))){e.preventDefault();(e.shiftKey?last:first).focus();}}
            }
            if (['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName)) return;
            if (e.target?.tagName==='BUTTON' && [' ','Enter'].includes(e.key)) return;
            const key=e.key.length===1?e.key.toLowerCase():e.key;
            if (this.active&&!this.paused&&[' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Shift'].includes(key))e.preventDefault();
            if (key==='p'&&!e.repeat)this.togglePause();
            if (key==='Enter'&&this.shopPhase==='beacon'&&!this.paused)this.openShop();
            if (key==='Shift'&&!e.repeat&&this.active&&!this.paused)this.player.dash();
            if ((key==='e'||key==='q')&&!e.repeat)this.usePulse();
            if(key==='r'&&!e.repeat)this.player?.launchCluster();
            if (key==='f'&&!e.repeat)this.setPreference('autoFire',!this.profile.settings.autoFire);
            if (key==='m'&&!e.repeat)this.setPreference('muted',!this.profile.settings.muted);
            this.keys[key]=true;
        });
        window.addEventListener('keyup',e=>this.keys[e.key.length===1?e.key.toLowerCase():e.key]=false);
        window.addEventListener('blur',()=>this.pauseForFocus());
        document.addEventListener('visibilitychange',()=>{if(document.hidden){this.pauseForFocus();this.clearKeys();AudioEngine.ctx?.suspend?.().catch(()=>{});}});
        CANVAS_GAME.addEventListener('pointerdown',e=>this.beginPointer(e));
        CANVAS_GAME.addEventListener('pointermove',e=>{if(this.pointer.active)this.movePointer(e);});
        for(const event of ['pointerup','pointercancel','lostpointercapture'])CANVAS_GAME.addEventListener(event,e=>this.pointer.end(e.pointerId));
        CANVAS_GAME.addEventListener('contextmenu',e=>e.preventDefault());
        document.getElementById('repair-decal').innerHTML=shopDiagram('repair');
        const trackOptions=document.getElementById('music-track-options');
        document.getElementById('music-track-count').innerText=`${Object.keys(MUSIC_TRACKS).length} TRACKS`;
        trackOptions.innerHTML=Object.entries(MUSIC_TRACKS).map(([id,track])=>`<button type="button" data-music-track="${id}" aria-pressed="false" style="--track-color:${track.color}"><span><strong>${track.name}</strong><small>${track.style}</small></span><em>${track.bpm}<small>BPM</small></em></button>`).join('');
        trackOptions.querySelectorAll('[data-music-track]').forEach(button=>button.addEventListener('click',()=>this.setPreference('musicTrack',button.dataset.musicTrack)));
        document.getElementById('practice-wave').innerHTML=Array.from({length:WAVE_COUNT},(_,i)=>`<option value="${i+1}">WAVE ${i+1} · ${i+1===WAVE_COUNT?'FINAL FLEET':getWaveProfile(i+1).name}</option>`).join('');
        this.syncSettings();this.focusOverlay('start-screen');this.loop(0);
    },
    pointerPoint(e) {
        const rect=CANVAS_GAME.getBoundingClientRect();
        return {x:(e.clientX-rect.left)/rect.width*WIDTH,y:(e.clientY-rect.top)/rect.height*HEIGHT};
    },
    beginPointer(e) {
        if(!this.active||this.paused||e.button>0||this.pointer.active)return;
        e.preventDefault();
        const point=this.pointerPoint(e);
        if(this.shopPhase==='beacon'&&this.beacon&&dist(point.x,point.y,this.beacon.x,this.beacon.y)<this.beacon.size/2){this.openShop();return;}
        if(e.pointerType!=='mouse'&&!this.touchMode){this.touchMode=true;this.resize();this.updateHUD();}
        if(this.pointer.begin(e.pointerId,e.pointerType,this.pointerPoint(e),this.player))CANVAS_GAME.setPointerCapture(e.pointerId);
    },
    movePointer(e) {
        this.pointer.move(e.pointerId,this.pointerPoint(e),WIDTH,HEIGHT,this.player.radius);
    },
    focusOverlay(id,buttonId) {
        const showing=Boolean(id);
        document.getElementById('ui-layer').inert=showing;CANVAS_GAME.inert=showing;CANVAS_GAME.tabIndex=showing?-1:0;
        const target=id?document.getElementById(buttonId||id):CANVAS_GAME;
        if(id){const overlay=document.getElementById(id);overlay.tabIndex=-1;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');}
        target.focus?.({preventScroll:true});
    },
    resize() {
        const width=window.innerWidth,height=window.innerHeight,oldWidth=WIDTH;
        const side=false;
        document.body.classList.toggle('touch-controls',this.touchMode);document.body.classList.toggle('compact-landscape',side);
        const hud=scope.rect(document.querySelector('.flight-hud')),footer=scope.rect(document.querySelector('.flight-bottom')); 
        const bounds=side?{left:(hud?.right||120)+8,right:(footer?.left||width-120)-8,top:8,bottom:height-8}:
            {left:8,right:width-8,top:(hud?.bottom||100)+8,bottom:(footer?.top||height-110)-8};
        const layout=fitFlightArena(width,height,bounds),rotated=this.layout&&(this.layout.side!==side||this.layout.worldWidth!==layout.worldWidth);
        const changed=!this.layout||['left','top','width','height'].some(key=>Math.abs(layout[key]-this.layout[key])>.5);
        this.layout={...layout,side};WIDTH=layout.worldWidth;HEIGHT=layout.worldHeight;
        const {scale}=layout,dpr=Math.min(window.devicePixelRatio||1,this.touchMode?1.5:2);
        for(const canvas of [CANVAS_GAME,CANVAS_BG]){
            canvas.width=Math.round(WIDTH*scale*dpr);canvas.height=Math.round(HEIGHT*scale*dpr);
            canvas.style.width=`${WIDTH*scale}px`;canvas.style.height=`${HEIGHT*scale}px`;
            canvas.style.left=`${layout.left}px`;canvas.style.top=`${layout.top}px`;
            canvas.getContext('2d').setTransform(canvas.width/WIDTH,0,0,canvas.height/HEIGHT,0,0);
        }
        if(this.player){this.player.x=Math.max(20,Math.min(WIDTH-20,this.player.x/oldWidth*WIDTH));this.player.y=Math.min(HEIGHT-25,this.player.y);}
        if(this.beacon)this.beacon.x=WIDTH/2;
        for(const key of ['enemies','bullets','missiles','drops','crates','bgStars'])this[key]?.forEach(item=>item.x=item.x/oldWidth*WIDTH);
        document.body.style.setProperty('--arena-top',`${layout.top}px`);document.body.style.setProperty('--arena-center',`${layout.left+layout.width/2}px`);
        document.body.style.setProperty('--banner-top',`${layout.top+layout.height*.22}px`);
        if(changed)this.pointer.end();
        if(rotated&&this.active&&!this.paused)this.pauseForFocus();
        if(document.getElementById('shop-screen').style.display==='flex'&&!this.salvagePending)this.openShop();
    },
    createStars() { this.bgStars=[];for(let i=0;i<90;i++)this.bgStars.push({x:effectsRandom()*WIDTH,y:effectsRandom()*HEIGHT,z:effectsRandom()*1.5+.4,phase:i*.73}); },
    syncSettings() {
        const prefs=this.profile.settings;
        document.querySelectorAll('[data-preference]').forEach(input=>{
            const key=input.dataset.preference;
            if(input.type==='checkbox')input.checked=prefs[key];else input.value=prefs[key]*100;
        });
        document.querySelectorAll('[data-music-track]').forEach(button=>{
            const selected=button.dataset.musicTrack===prefs.musicTrack;
            button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
        });
        const track=getMusicTrack(prefs.musicTrack);
        document.getElementById('music-track-name').innerText=track.name;
        document.getElementById('music-track-description').innerText=track.detail;
        document.getElementById('music-listening-note').innerText=prefs.muted?'SOUND MUTED · UNMUTE BELOW TO LISTEN':prefs.music===0?'MUSIC VOLUME IS ZERO · RAISE IT BELOW TO LISTEN':'PLAYS AS YOU CHOOSE · REMEMBERED FOR YOUR NEXT FLIGHT';
        document.getElementById('music-volume-value').innerText=`${Math.round(prefs.music*100)}%`;
        document.getElementById('sfx-volume-value').innerText=`${Math.round(prefs.sfx*100)}%`;
        this.syncPracticeSettings();
        document.querySelectorAll('[data-difficulty]').forEach(button=>{
            const selected=button.dataset.difficulty===prefs.difficulty;
            button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
        });
        document.body.classList.toggle('reduced-motion',prefs.reducedMotion);
        document.getElementById('autofire-btn').innerText=`AUTO FIRE ${prefs.autoFire?'ON':'OFF'} · F`;
        document.getElementById('mute-btn').innerText=prefs.muted?'SOUND OFF · M':'SOUND ON · M';
        const difficulty=getDifficulty(prefs.difficulty);
        document.getElementById('difficulty-note').innerText=`${difficulty.description} Score ×${difficulty.score}.`;
        this.renderCareer();
        this.renderRecords();AudioEngine.updateVolumes();
    },
    setPreference(key,value) {
        if(!['autoFire','music','sfx','musicTrack','muted','reducedMotion','shake'].includes(key))return;
        if(key==='musicTrack'){if(!isMusicTrack(value))return;AudioEngine.selectTrack(value);}
        else if(['music','sfx'].includes(key)){if(typeof value!=='number'||!Number.isFinite(value))return;value=Math.max(0,Math.min(1,value));}
        else if(typeof value!=='boolean')return;
        this.profile.settings[key]=value;if(this.recordable)saveProfile(this.profile);this.syncSettings();
    },
    selectDifficulty(key) {
        if(this.active||!Object.hasOwn(DIFFICULTIES,key))return;
        this.profile.settings.difficulty=key;if(this.recordable)saveProfile(this.profile);this.syncSettings();
    },
    syncPracticeSettings() {
        document.getElementById('practice-wave').value=String(this.practiceWave);
        document.getElementById('practice-loadout').value=this.practiceLoadout;
        const saved=this.practiceOrigin?.profile.checkpoint||this.profile.checkpoint;
        document.getElementById('practice-saved-build').disabled=!saved;
        document.getElementById('practice-launch').disabled=this.practiceLoadout==='saved'&&!saved;
        const levels=this.practiceLoadout==='saved'&&saved?saved.levels:this.practiceLoadout==='stock'?createLevels():getPracticeLevels(this.practiceWave);
        document.getElementById('practice-description').innerText=`${isCommanderWave(this.practiceWave)?'Straight to the commander':'Start of the wave'} · ${getDifficulty(this.profile.settings.difficulty).name} · SHIP VALUE ${getShipValue(levels).toLocaleString()} CR`;
    },
    setPracticeWave(value) { if(!this.active&&Number.isInteger(value)&&value>=1&&value<=WAVE_COUNT){this.practiceWave=value;this.syncPracticeSettings();} },
    setPracticeLoadout(value) { if(!this.active&&['recommended','saved','stock'].includes(value)){this.practiceLoadout=value;this.syncPracticeSettings();} },
    startPractice(wave=this.practiceWave,loadout=this.practiceLoadout) {
        if(this.active||!Number.isInteger(wave)||wave<1||wave>WAVE_COUNT||!['recommended','saved','stock'].includes(loadout))return false;
        const saved=this.practiceOrigin?.profile.checkpoint||this.profile.checkpoint;
        if(loadout==='saved'&&!saved)return false;
        if(!this.practice){
            this.practiceOrigin={profile:this.profile,recordable:this.recordable};
            this.profile=JSON.parse(JSON.stringify(this.profile));this.practice=true;this.recordable=false;
        }
        this.practiceWave=wave;this.practiceLoadout=loadout;
        if(loadout==='saved')this.profile.settings.ship=saved.shipId;
        this.start(null,true);
        this.wave=wave;this.levels={...(loadout==='saved'?saved.levels:loadout==='stock'?createLevels():getPracticeLevels(wave))};
        this.player.updateStats();this.player.regenShield=this.player.maxRegenShield;this.player.refillOrdnance();this.player.hitGrace=1500;
        this.coins=loadout==='saved'?saved.coins:500;this.pulseCharge=100;
        if(isCommanderWave(wave))this.beginCommander();
        this.announce(`PRACTICE · WAVE ${wave}`,`${isCommanderWave(wave)?getCommander(wave).name:getWaveProfile(wave).name} · FULL HULL · EXPEDITION SAVE KEPT`,getAct(wave).color,3000);
        this.updateHUD();return true;
    },
    exitPractice() {
        if(!this.practice)return;
        const settings=this.profile.settings;
        this.profile=this.practiceOrigin.profile;this.recordable=this.practiceOrigin.recordable;this.practice=false;this.practiceOrigin=null;
        for(const key of ['music','sfx','musicTrack','muted','autoFire','reducedMotion','shake'])this.profile.settings[key]=settings[key];
        if(this.recordable)saveProfile(this.profile);
    },
    renderRecords() {
        const key=`${this.profile.settings.difficulty}-expedition`,record=this.profile.records[key];
        document.getElementById('best-score').innerText=(record?.bestScore||0).toLocaleString();
        document.getElementById('best-wave').innerText=record?.bestWave?`${record.bestWave}/${WAVE_COUNT}`:'—';
        document.getElementById('mission-wins').innerText=record?.wins||0;
    },
    selectShip(id) {
        if(this.active||!shipUnlocked(this.profile,id))return;
        this.profile.settings.ship=id;if(this.recordable)saveProfile(this.profile);this.syncSettings();document.querySelector(`[data-ship="${id}"]`)?.focus?.({preventScroll:true});
    },
    renderCareer() {
        const career=this.profile.career,checkpoint=this.profile.checkpoint;
        const designation=document.getElementById('hero-designation');
        if(designation)designation.textContent=`${getShip(this.profile.settings.ship).name} / EXPEDITION FIGHTER`;
        document.getElementById('ship-picker').innerHTML=Object.entries(SHIPS).map(([id,ship])=>{
            const unlocked=shipUnlocked(this.profile,id),selected=this.profile.settings.ship===id;
            return `<button data-ship="${id}" class="${selected?'selected':''}" aria-pressed="${selected}" ${unlocked?'':'disabled'}><strong style="color:${ship.color}">${ship.name}</strong><span>${unlocked?ship.description:`CLEAR WAVE ${ship.unlock} TO UNLOCK`}</span></button>`;
        }).join('');
        document.querySelectorAll('[data-ship]').forEach(button=>button.addEventListener('click',()=>this.selectShip(button.dataset.ship)));
        document.getElementById('career-goals').innerHTML=CAREER_GOALS.map(goal=>{
            const value=Math.min(goal.target,career[goal.field]),done=value>=goal.target;
            return `<div class="career-goal ${done?'complete':''}"><strong>${done?'◆':'◇'} ${goal.name}</strong><span>${goal.detail}</span><small>${done?'COMPLETE':`${value.toLocaleString()} / ${goal.target.toLocaleString()}`}</small><div class="progress-track"><div style="width:${value/goal.target*100}%"></div></div></div>`;
        }).join('');
        document.getElementById('career-total').innerText=`${career.kills.toLocaleString()} SHIPS · ${CAREER_GOALS.filter(goal=>career[goal.field]>=goal.target).length}/${CAREER_GOALS.length} MEDALS`;
        const resume=document.getElementById('resume-run-btn');resume.style.display=checkpoint?'block':'none';
        resume.innerText=checkpoint?`CONTINUE · WAVE ${checkpoint.wave+1} · ${getShip(checkpoint.shipId).name}`:'';
        document.getElementById('checkpoint-note').innerText=checkpoint?`${getDifficulty(checkpoint.difficulty).name} · ${formatTime(checkpoint.elapsed)} flown · loadout and credits saved at resupply.`:'Your expedition autosaves at every resupply station.';
        document.getElementById('launch-btn').innerText=checkpoint?'NEW EXPEDITION · REPLACE DOCK SAVE ↗':'ENGAGE EXPEDITION ↗';
        document.getElementById('keep-save-btn').style.display=this.practice||checkpoint?'block':'none';
        document.getElementById('keep-save-btn').innerText=this.practice?'RETURN TO HANGAR · END PRACTICE':'RETURN TO HANGAR · KEEP LAST DOCK SAVE';
    },
    bankCareer(finished=false,won=false) {
        if(!this.recordable)return;
        this.profile=advanceCareer(this.profile,{kills:this.stats.kills-this.careerBank.kills,dashes:this.stats.dashes-this.careerBank.dashes,pulses:this.stats.pulses-this.careerBank.pulses,clearedWave:this.lastClearedWave,bestChain:this.stats.bestCombo,score:this.stats.score,finished,won});
        this.careerBank={kills:this.stats.kills,dashes:this.stats.dashes,pulses:this.stats.pulses};
    },
    saveCheckpoint() {
        if(!this.active||this.shopPhase!=='beacon')return;
        this.profile.checkpoint=validateCheckpoint({version:5,wave:this.wave,difficulty:this.difficulty,shipId:this.shipId,endless:this.endless,levels:{...this.levels},hull:this.player.hull,shield:this.player.regenShield,tempShield:this.player.tempShield,coins:this.coins,elapsed:this.elapsed,pulseCharge:this.pulseCharge,clusterAmmo:this.player.clusterAmmo,clusterRightAmmo:this.player.clusterRightAmmo,stats:{...this.stats},banked:{...this.careerBank},buffs:{...this.player.buffs}});
        if(this.recordable)saveProfile(this.profile);
    },
    resumeRun() { const checkpoint=validateCheckpoint(this.profile.checkpoint);if(!checkpoint)return false;this.start(checkpoint);return true; },
    toHangar() {
        if(this.active&&!this.paused)return;
        closeEquipment();
        cancelSalvage(false);
        this.active=false;this.paused=false;this.manualPause=false;this.clearKeys();AudioEngine.stopMusic();
        this.ending=null;document.getElementById('end-cinematic').style.display='none';
        for(const id of ['game-over-screen','shop-screen','pause-screen'])document.getElementById(id).style.display='none';
        this.exitPractice();document.getElementById('start-screen').style.display='flex';this.syncSettings();this.focusOverlay('start-screen');
    },
    announce(title,detail='',color='#48e6ff',duration=2300) {
        this.bannerTimer=duration;
        document.getElementById('banner-title').innerText=title;
        document.getElementById('banner-detail').innerText=detail;
        document.getElementById('wave-banner').style.color=color;
        document.getElementById('wave-banner').classList.add('visible');
    },
    usePulse() {
        if(!this.active||this.paused||this.shopPhase==='beacon'||this.pulseCharge<ABILITIES.pulseMax)return false;
        this.pulseCharge=0;this.stats.pulses++;
        this.bullets.forEach(b=>{if(b.owner==='enemy')b.active=false;});
        this.missiles.forEach(m=>{if(m.owner==='enemy')m.active=false;});
        const radius=Math.min(360,WIDTH*.55),p=this.player;
        this.rings.push(new ShockRing(p.x,p.y,radius,'#73f5ff',700));
        for(const e of this.enemies)if(e.active&&e.entryDelay<=0&&dist(p.x,p.y,e.x,e.y)<radius+e.radius)e.takeDamage(100+p.damage*2);
        p.hitGrace=Math.max(p.hitGrace,400);AudioEngine.playAbility('pulse');this.shakeScreen(5);
        createFloatingText(p.x,p.y-40,'SHOCKWAVE','#73f5ff');this.updateHUD();return true;
    },
    registerKill(enemy) {
        this.stats.kills++;this.stats.combo++;this.stats.comboTimer=5000;
        this.stats.bestCombo=Math.max(this.stats.bestCombo,this.stats.combo);
        const points=Math.round(enemy.scoreVal*10*scoreMultiplier(this.stats.combo)*getDifficulty(this.difficulty).score);
        this.stats.score+=points;this.pulseCharge=Math.min(100,this.pulseCharge+ABILITIES.pulsePerKill);
        createFloatingText(enemy.x,enemy.y,`+${points}`,enemy.color);
    },
    clearKeys() { Object.keys(this.keys).forEach(key => this.keys[key] = false); this.pointer.end(); this.stick?.reset();this.fireControl?.reset();this.touchFire=false; },
    togglePause() {
        if (!this.active || (this.paused && !this.manualPause)) return;
        this.manualPause = !this.manualPause; this.paused = this.manualPause;
        this.clearKeys(); this.accumulator = 0;
        document.getElementById('pause-screen').style.display = this.manualPause ? 'flex' : 'none';
        document.getElementById('keep-save-btn').style.display=this.practice||this.profile.checkpoint?'block':'none';
        document.getElementById('keep-save-btn').innerText=this.practice?'RETURN TO HANGAR · END PRACTICE':'RETURN TO HANGAR · KEEP LAST DOCK SAVE';
        this.focusOverlay(this.manualPause?'pause-screen':null);this.updateHUD();
        if(!this.paused)AudioEngine.init();
        AudioEngine.updateVolumes();
    },
    pauseForFocus() { if (this.active && !this.paused) this.togglePause(); this.clearKeys(); },
    start(checkpoint=null,keepPractice=false) {
        closeEquipment();
        cancelSalvage(false);
        if(this.practice&&!keepPractice)this.exitPractice();
        ['start-screen', 'game-over-screen', 'shop-screen', 'pause-screen'].forEach(id => document.getElementById(id).style.display = 'none');
        this.ending=null;this.lastEnemyExplosion=null;document.getElementById('end-cinematic').style.display='none';
        this.levels = createLevels(); this.difficulty=this.profile.settings.difficulty; this.endless=false; this.stats=createRunStats();
        this.shipId=this.profile.settings.ship;this.lastClearedWave=0;this.careerBank={kills:0,dashes:0,pulses:0};
        if(checkpoint){this.shipId=checkpoint.shipId;this.difficulty=checkpoint.difficulty;this.levels={...checkpoint.levels};this.endless=checkpoint.endless;this.stats={...checkpoint.stats};this.careerBank={...checkpoint.banked};this.lastClearedWave=checkpoint.wave;}
        else {this.profile.checkpoint=null;if(this.recordable)saveProfile(this.profile);}
        this.pulseCharge=25;this.labels=[];this.rings=[];this.bannerTimer=0;
        this.player = new Player(); this.enemies = []; this.crates = []; this.bullets = []; this.missiles = []; this.particles = []; this.drops = []; this.beacon = null;
        this.coins = 0; this.elapsed = 0; this.wave = 1; this.victory = false;
        this.shopTimer = 0; this.spawnTimer = 500; this.spentThreat = 0; this.clearTimer = 0; this.bossSpawned = false;
        this.shopPhase = 'fighting'; this.accumulator = 0; this.shake = 0; this.clearKeys();
        this.invasion=null;
        this.active = true; this.paused = false; this.manualPause = false; AudioEngine.init();
        if (!AudioEngine.isPlaying) AudioEngine.startMusic();
        this.focusOverlay(null);
        this.announce('OUTER BLOCKADE',`ACT I / III · ${getDifficulty(this.difficulty).name} · SHIFT TO DASH`);
        if(checkpoint){
            this.wave=checkpoint.wave;this.elapsed=checkpoint.elapsed;this.coins=checkpoint.coins;this.pulseCharge=checkpoint.pulseCharge;
            this.player.hull=checkpoint.hull;this.player.regenShield=checkpoint.shield;this.player.tempShield=checkpoint.tempShield;this.player.buffs={...checkpoint.buffs};this.player.clusterAmmo=checkpoint.clusterAmmo;this.player.clusterRightAmmo=checkpoint.clusterRightAmmo;this.player.updateStats();
            this.shopPhase='beacon';this.beacon=new ShopBeacon();this.openShop();this.announce('FLIGHT RESTORED',`WAVE ${this.wave+1} AWAITS · YOUR SHIP AND CREDITS ARE READY`);
        }
        AudioEngine.updateVolumes();this.updateHUD();
    },
    nextWave(preserveControls = false) {
        this.wave++; this.shopTimer = 0; this.spawnTimer = 500; this.spentThreat = 0;
        this.bossSpawned = false; this.shopPhase = 'fighting'; this.beacon = null;
        this.invasion=null;
        if (!preserveControls) { this.clearKeys(); this.accumulator = 0; }
        this.player.hitGrace = 1000;
        const act=getAct(this.wave);
        this.announce(this.wave===11||this.wave===21?act.name:getWaveProfile(this.wave).name,`ACT ${act.number} / 3 · WAVE ${this.wave}${this.wave<=WAVE_COUNT?` / ${WAVE_COUNT}`:''} · ${this.wave%2?'RESUPPLY NEXT SECTOR':'RESUPPLY AFTER THIS SECTOR'}`,act.color);
        this.updateHUD();
    },
    loop(timestamp) {
        const dt = Math.max(0, Math.min(100, timestamp - this.lastTime)); this.lastTime = timestamp;
        if(this.ending){this.accumulator=0;this.updateEnding(dt);this.draw();}
        else if (this.active && !this.paused) {
            this.accumulator += dt;
            while (this.accumulator >= STEP_MS && this.active && !this.paused) {
                this.update(STEP_MS); this.accumulator -= STEP_MS;
            }
            this.draw();
        } else { this.accumulator = 0; this.drawBg(); }
        requestAnimationFrame((t) => this.loop(t));
    },
    update(dt) {
        if(this.ending){this.updateEnding(dt);return;}
        if(!this.active||this.paused)return;
        this.elapsed += dt;
        if(this.bannerTimer>0){this.bannerTimer-=dt;if(this.bannerTimer<=0)document.getElementById('wave-banner').classList.remove('visible');}
        this.stats.comboTimer=Math.max(0,this.stats.comboTimer-dt);if(!this.stats.comboTimer)this.stats.combo=0;
        if(this.shopPhase!=='beacon')this.pulseCharge=Math.min(100,this.pulseCharge+ABILITIES.pulsePassivePerSecond*dt/1000);
        if (this.shopPhase === 'fighting') {
            this.shopTimer += dt;
            if (this.shopTimer >= WAVE_DURATION_MS) {
                this.shopPhase = 'clearing'; this.clearTimer = 0;
                createFloatingText(WIDTH/2 - 100, HEIGHT/2, 'CLEAR THE SECTOR', '#00f3ff');
            } else this.handleSpawning(dt);
        } else if (this.shopPhase === 'clearing') {
            this.clearTimer += dt;
            if (!this.enemies.some(e => e.active)) {
                if (isCommanderWave(this.wave) && !this.bossSpawned) {
                    this.beginCommander();
                } else this.completeWave();
            }
        } else if (this.shopPhase === 'boss' && !this.enemies.some(e => e.active)) {
            this.completeWave();
        } else if (this.shopPhase === 'beacon' && this.beacon) this.beacon.update(dt);

        if(!this.active||this.paused)return;
        if(this.invasion&&this.shopPhase==='boss')this.updateInvasion(dt);
        if(!this.active)return;
        this.player.update(dt);
        this.enemies.forEach(e => { if(e.active) e.update(dt); });
        this.crates.forEach(c => { if(c.active) c.update(dt); });
        this.bullets.forEach(b => { if(b.active) b.update(dt); });
        this.missiles.forEach(m => { if(m.active) m.update(dt); });
        this.drops.forEach(d => { if(d.active) d.update(dt); });
        this.particles.forEach(p => p.update(dt));this.labels.forEach(p=>p.update(dt));this.rings.forEach(p=>p.update(dt));
        this.handleCollisions();
        ['enemies', 'crates', 'bullets', 'missiles', 'drops', 'particles', 'labels', 'rings'].forEach(key => this[key] = this[key].filter(entity => entity.active));
        this.hudTimer -= dt;
        if (this.hudTimer <= 0) { this.updateHUD(); this.hudTimer = 100; }
    },
    beginCommander() {
        this.bossSpawned=true;this.shopPhase='boss';
        const commander=getCommander(this.wave);
        if(commander.pattern==='invasion'){this.startInvasion();return;}
        this.enemies.push(new Enemy(commander.type,this.wave,true));
        this.announce(commander.name,'COMMAND SHIP · KEEP MOVING · SHIFT TO DASH','#ffd47e',3200);
    },
    startInvasion() {
        const columns=WIDTH<700?INVASION.narrowColumns:INVASION.wideColumns;
        const span=Math.min(WIDTH*.62,620),spacing=span/(columns-1),difficulty=getDifficulty(this.difficulty);
        const members=[];
        for(let row=0;row<INVASION.rows;row++)for(let column=0;column<columns;column++){
            const ship=new Enemy('INVADER',this.wave);ship.isInvader=true;ship.entryDelay=0;
            ship.row=row;ship.column=column;ship.x=(WIDTH-span)/2+column*spacing;ship.y=90+row*INVASION.rowSpacing;
            ship.hp=INVASION.rowHull[row]*INVASION.hullMultiplier*(INVASION.wideColumns/columns)*difficulty.health*(1+Math.max(0,this.wave-WAVE_COUNT)*.02);ship.maxHp=ship.hp;
            ship.color=['#b89aff','#ff80a8','#ffbd78','#82e5d2'][row];ship.fireTimer=Infinity;
            ship.commander=getCommander(this.wave);members.push(ship);
        }
        this.enemies.push(...members);
        this.invasion={members,total:members.length,maxHp:members.reduce((sum,e)=>sum+e.maxHp,0),direction:1,
            velocityX:0,dropTimer:0,descent:INVASION.descent*(WIDTH<700?.65:1),descents:0,fireTimer:INVASION.openingGrace,volley:0,phase:1,breachY:HEIGHT-55};
        this.announce('CORE INVASION FLEET','GOLD RINGS WARN SHOTS · DESTROY EVERY SHIP BEFORE THEY BREACH','#ffbd78',2000);
    },
    updateInvasion(dt) {
        const fleet=this.invasion,alive=fleet.members.filter(e=>e.active);
        if(!alive.length)return;
        const cleared=1-alive.length/fleet.total,difficulty=getDifficulty(this.difficulty);
        if(fleet.phase===1&&alive.length<=Math.floor(fleet.total/2)){
            fleet.phase=2;fleet.fireTimer=1600;
            for(const ship of alive){ship.fireTimer=Infinity;ship.lockedTarget=null;}
            this.bullets.forEach(b=>{if(b.owner==='enemy')b.active=false;});
            this.announce('FLEET OVERDRIVE','FEWER SHIPS · FASTER MARCH · KEEP CLEARING LANES','#ff8aab',2500);
        }
        // Move the formation continuously, with eased turns and descents. The
        // surviving edges define travel space, so clearing a column buys time.
        if(fleet.dropTimer>0){
            const ease=t=>t*t*(3-2*t),before=1-fleet.dropTimer/INVASION.descentDuration;
            const step=Math.min(dt,fleet.dropTimer);fleet.dropTimer-=step;
            const after=1-fleet.dropTimer/INVASION.descentDuration;
            for(const ship of alive)ship.y+=fleet.descent*(ease(after)-ease(before));
        }else{
            const speed=(INVASION.speed+(INVASION.lastSpeed-INVASION.speed)*cleared)*Math.max(.4,WIDTH/1200);
            const left=Math.min(...alive.map(e=>e.x-e.radius)),right=Math.max(...alive.map(e=>e.x+e.radius));
            const remaining=fleet.direction>0?WIDTH-18-right:left-18;
            const targetSpeed=fleet.direction*speed*Math.max(.15,Math.min(1,Math.sqrt(Math.max(0,remaining)/40)));
            const oldVelocity=fleet.velocityX;fleet.velocityX+=(targetSpeed-fleet.velocityX)*(1-Math.exp(-dt/INVASION.accelerationMs));
            const travel=(oldVelocity+fleet.velocityX)*.5*dt/1000;
            const dx=Math.max(18-left,Math.min(WIDTH-18-right,travel));
            for(const ship of alive)ship.x+=dx;
            if(Math.abs(dx)<Math.abs(travel)-.001){fleet.direction*=-1;fleet.velocityX=0;fleet.dropTimer=INVASION.descentDuration;fleet.descents++;}
        }
        if(alive.some(e=>e.y+e.radius>=fleet.breachY)){
            this.stats.lastHit='INVASION FLEET REACHED THE BREACH LINE';this.player.hull=0;this.gameOver();return;
        }
        // Only the lowest survivor in a column may shoot. Telegraph a small
        // rotating selection, with forward lanes and one locked-position shot.
        fleet.fireTimer-=dt;
        if(fleet.fireTimer<=INVASION.warning&&!alive.some(e=>e.fireTimer<=INVASION.warning)){
            const fronts=[...new Set(alive.map(e=>e.column))].sort((a,b)=>a-b).map(column=>alive.filter(e=>e.column===column).sort((a,b)=>b.y-a.y)[0]);
            const count=Math.min(fronts.length,fleet.phase===2?3:2);
            for(let i=0;i<count;i++){
                const ship=fronts[(fleet.volley+Math.floor(i*fronts.length/count))%fronts.length];
                ship.fireTimer=Math.max(0,fleet.fireTimer);
                // One announced shot locks the current position; the remaining
                // gunners fire forward. Moving after the warning defeats the lock.
                ship.lockedTarget=i===0?{x:this.player.x,y:this.player.y}:null;
            }
        }
        for(const ship of alive)if(Number.isFinite(ship.fireTimer))ship.fireTimer=Math.max(0,fleet.fireTimer);
        if(fleet.fireTimer<=0){
            for(const ship of alive)if(ship.fireTimer===0){
                const speed=(INVASION.shotSpeed+cleared)*difficulty.shotSpeed;
                if(ship.lockedTarget){const angle=Math.atan2(ship.lockedTarget.y-ship.y-ship.radius,ship.lockedTarget.x-ship.x);this.bullets.push(new Bullet(ship.x,ship.y+ship.radius,Math.cos(angle)*speed,Math.sin(angle)*speed,ship.damage,'enemy'));}
                else for(const offset of fleet.phase===2?[-9,9]:[0])this.bullets.push(new Bullet(ship.x+offset,ship.y+ship.radius,0,speed,ship.damage,'enemy'));
                ship.fireTimer=Infinity;ship.lockedTarget=null;
            }
            AudioEngine.playShoot('enemy');fleet.volley++;
            fleet.fireTimer=(INVASION.shotDelay+(INVASION.lastShotDelay-INVASION.shotDelay)*cleared)*difficulty.fireDelay;
        }
    },
    completeWave() {
        if(!this.active||this.lastClearedWave>=this.wave)return;
        const reward = getWaveProfile(this.wave, WIDTH).reward;
        this.coins += reward;
        this.stats.creditsEarned+=reward;this.stats.score+=Math.round(this.wave*100*getDifficulty(this.difficulty).score);
        this.player.hull = Math.min(this.player.maxHull, this.player.hull + GAME_CONFIG.CLEAR_HULL_REPAIR);
        this.player.regenShield = Math.min(this.player.maxRegenShield,this.player.regenShield+this.player.maxRegenShield*GAME_CONFIG.CLEAR_SHIELD_FRACTION);
        this.lastClearedWave=this.wave;
        if (this.wave === WAVE_COUNT && !this.victory) { this.gameOver(true); return; }
        createFloatingText(WIDTH/2 - 100, HEIGHT/2, `SECTOR CLEAR +${reward} CR`, '#ffff00');
        if (this.wave % SHOP_WAVE_INTERVAL === 0) {
            this.shopPhase = 'beacon'; this.beacon = new ShopBeacon();
            this.bankCareer();
            this.saveCheckpoint();
            this.announce(this.wave===10?'ACT I COMPLETE':this.wave===20?'ACT II COMPLETE':'RESUPPLY AVAILABLE',this.wave===10?'STRIKER UNLOCKED · COLLECT LOOT, THEN DOCK':this.wave===20?'SPECTRE UNLOCKED · COLLECT LOOT, THEN DOCK':`+${reward} CREDITS · COLLECT LOOT, THEN DOCK OR PRESS ENTER`,'#ffd47e',5000);
        } else this.nextWave(true);
    },
    handleSpawning(dt) {
        const base=getWaveProfile(this.wave,WIDTH),difficulty=getDifficulty(this.difficulty);
        const profile={...base,maxThreat:base.maxThreat*difficulty.threat,budget:base.budget*difficulty.threat};
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = profile.spawnDelay * (0.85 + Math.random() * 0.3);
            const threat = this.enemies.filter(e => e.active).reduce((sum, e) => sum + GAME_CONFIG.ENEMIES[e.type].threat, 0);
            const available = Math.min(profile.maxThreat - threat, releasedThreat(profile.budget,this.shopTimer) - this.spentThreat);
            const type = chooseEnemy(profile.pool, available, Math.random);
            if(type){
                const cost=GAME_CONFIG.ENEMIES[type].threat;
                const formation=this.wave>=3&&cost<=2&&Math.random()<.28?Math.min(3,Math.floor(available/cost)):1;
                const centre=WIDTH*(.2+Math.random()*.6),spacing=Math.min(85,WIDTH*.12);
                for(let i=0;i<formation;i++){
                    const enemy=new Enemy(type,this.wave);
                    if(formation>1){enemy.x=Math.max(enemy.radius,Math.min(WIDTH-enemy.radius,centre+(i-(formation-1)/2)*spacing));enemy.entryDelay+=i*150;}
                    this.enemies.push(enemy);this.spentThreat+=cost;
                }
            }
        }
        if (Math.random() < GAME_CONFIG.SPAWN_RATES.AMBIENT_COIN) this.drops.push(new Coin(Math.random() * WIDTH, -20, 10));
        if (Math.random() < GAME_CONFIG.SPAWN_RATES.LOOT_CRATE) this.crates.push(new LootCrate());
    },

    handleCollisions() {
        if (!this.active || this.paused) return;
        for (const b of this.bullets) {
            if(!this.active)return;
            if (!b.active) continue;
            if (b.owner === 'player') {
                const target = this.enemies.find(e => e.active && e.entryDelay<=0 && dist(b.x, b.y, e.x, e.y) < e.radius + b.radius)
                    ?? this.crates.find(c => c.active && dist(b.x, b.y, c.x, c.y) < c.size/2 + b.radius);
                if (target) { b.active = false; if(target instanceof Enemy)this.stats.hits++; target.takeDamage(b.damage); createParticles(b.x, b.y, b.color, 3); }
            } else if (dist(b.x, b.y, this.player.x, this.player.y) < this.player.radius + b.radius) {
                b.active = false; this.player.takeDamage(b.damage,'HOSTILE VOLLEY');
            }
        }
        for (const m of this.missiles) {
            if(!this.active)return;
            if (!m.active) continue;
            if(m.kind==='cluster')continue;
            const target = m.owner === 'player'
                ? this.enemies.find(e => e.active && e.entryDelay<=0 && dist(m.x, m.y, e.x, e.y) < e.radius + 6)
                : (dist(m.x, m.y, this.player.x, this.player.y) < this.player.radius + 6 ? this.player : null);
            if (target) { m.active = false; if(m.owner==='player')this.stats.hits++; target.takeDamage(m.damage,m.owner==='enemy'?'GUIDED MISSILE':undefined); AudioEngine.playExplosion(); createParticles(m.x, m.y, '#ffaaff', 8); }
        }
        for (const e of this.enemies) {
            if (!e.active || e.entryDelay>0 || !this.active) continue;
            if (dist(e.x, e.y, this.player.x, this.player.y) < e.radius + this.player.radius && this.player.hitGrace <= 0) {
                e.takeDamage(60); this.player.takeDamage(22 * ENEMY_DAMAGE_MULTIPLIER,`${e.type} COLLISION`); if(!e.isInvader)e.y -= 30; AudioEngine.playExplosion();
            }
        }
        if(!this.active)return;
        for (const c of this.crates) {
            if (c.active && dist(c.x, c.y, this.player.x, this.player.y) < c.size/2 + this.player.radius) c.takeDamage(9999);
        }
        this.drops.forEach(d => { if (d.active && dist(d.x, d.y, this.player.x, this.player.y) < this.player.radius + d.radius + 15) d.collect(); });
    },

    draw() {
        CTX.clearRect(0, 0, WIDTH, HEIGHT);
        this.drawBg();
        CTX.save();
        if (this.shake > 0) {
            const dx = (effectsRandom() - 0.5) * this.shake; const dy = (effectsRandom() - 0.5) * this.shake;
            CTX.translate(dx, dy); this.shake *= 0.9; if(this.shake < 0.5) this.shake = 0;
        }
        
        if (this.beacon) this.beacon.draw();
        if(this.invasion&&this.shopPhase==='boss'){
            CTX.save();CTX.strokeStyle='#ff668580';CTX.lineWidth=2;CTX.beginPath();CTX.moveTo(0,this.invasion.breachY);CTX.lineTo(WIDTH,this.invasion.breachY);CTX.stroke();
            CTX.fillStyle='#ff9eb4';CTX.font='13px "Roboto Mono",monospace';CTX.fillText('BREACH LINE · STOP THE FLEET',16,this.invasion.breachY+18);CTX.restore();
        }

        this.drops.forEach(d => d.draw());
        this.crates.forEach(c => c.draw());
        if(this.player.hull>0)this.player.draw();
        this.enemies.forEach(e => {if(e.active)e.draw();});
        this.bullets.forEach(b => b.draw());
        this.missiles.forEach(m => m.draw());
        this.particles.forEach(p => p.draw());this.rings.forEach(p=>p.draw());this.labels.forEach(p=>p.draw());
        this.ending?.explosion.draw(CTX);
        CTX.restore();
    },

    drawBg() {
        const t=this.active||this.ending?this.elapsed+(this.ending?.elapsed||0):Date.now(),reduced=this.profile.settings.reducedMotion;
        const gradient=CTX_BG.createLinearGradient(0,0,0,HEIGHT);
        gradient.addColorStop(0,'#060b18');gradient.addColorStop(.55,getAct(this.wave).background);gradient.addColorStop(1,'#060a14');
        CTX_BG.fillStyle=gradient;CTX_BG.fillRect(0,0,WIDTH,HEIGHT);
        CTX_BG.save();CTX_BG.globalAlpha=.09;CTX_BG.strokeStyle='#80b8dd';CTX_BG.lineWidth=1;
        CTX_BG.beginPath();CTX_BG.arc(WIDTH*.84,HEIGHT*.16,105,0,Math.PI*2);CTX_BG.stroke();
        CTX_BG.beginPath();CTX_BG.ellipse(WIDTH*.84,HEIGHT*.16,155,32,-.35,0,Math.PI*2);CTX_BG.stroke();CTX_BG.restore();
        CTX_BG.strokeStyle='rgba(72,230,255,.045)';CTX_BG.lineWidth=1;CTX_BG.beginPath();
        const horizon=HEIGHT*.27;
        for(let x=-WIDTH;x<WIDTH*2;x+=140){CTX_BG.moveTo(WIDTH/2+(x-WIDTH/2)*.1,horizon);CTX_BG.lineTo(x,HEIGHT);}
        const drift=reduced?0:(t*.00003)%1;
        for(let i=0;i<13;i++){const f=((i/13+drift)%1)**2,y=horizon+(HEIGHT-horizon)*f;CTX_BG.moveTo(0,y);CTX_BG.lineTo(WIDTH,y);}
        CTX_BG.stroke();
        for(const star of this.bgStars){
            const y=reduced?star.y:(star.y+t*.035*star.z)%HEIGHT;
            CTX_BG.globalAlpha=.25+star.z*.2;CTX_BG.fillStyle=star.z>1.3?'#9fdcff':'#edf5ff';
            CTX_BG.fillRect(star.x,y,star.z,star.z*(this.player?.dashTimer>0?5:1));
        }
        CTX_BG.globalAlpha=1;
    },
    shakeScreen(amount) { if(this.profile.settings.shake&&!this.profile.settings.reducedMotion)this.shake = amount; },

    openShop() {
        if (!this.active || this.shopPhase !== 'beacon') return;
        this.drops.forEach(d=>{if(d.active&&dist(d.x,d.y,this.player.x,this.player.y)<this.player.radius+d.radius+15)d.collect();});
        const shopWasOpen=document.getElementById('shop-screen').style.display==='flex';
        if(!shopWasOpen)this.shopPage=0;
        const previousBuy=document.activeElement?.dataset?.buy,previousSalvage=document.activeElement?.dataset?.salvage;
        this.player.updateStats();
        if(!shopWasOpen){this.player.refillOrdnance();this.player.pendingShots=[];this.player.fireTimer=0;}
        this.paused = true; this.clearKeys(); this.accumulator = 0;AudioEngine.updateVolumes();
        const shopUI = document.getElementById('shop-screen');
        const grid = document.getElementById('shop-grid');
        document.getElementById('shop-coins').innerText = Math.floor(this.coins);
        document.getElementById('shop-ship-value').innerText = getShipValue(this.levels).toLocaleString();
        document.getElementById('shop-summary').innerText = `ACT ${getAct(this.wave).number}/3 · WAVE ${this.wave} CLEAR · ${getShip(this.shipId).name} · HULL ${Math.ceil(this.player.hull)}/${this.player.maxHull}`;
        document.getElementById('ship-loadout').innerHTML = shipLoadout(this.levels, this.player);
        const repairCost=getRepairCost(this.levels,this.player.hull,this.player.maxHull);
        const repairButton=document.getElementById('repair-btn');
        repairButton.disabled = !repairCost || this.coins < repairCost;
        repairButton.innerText=repairCost?`REPAIR · ${repairCost.toLocaleString()} CR`:'HULL FULL';
        repairButton.title='Restore all missing hull. Cost: 10% of ship value × fraction of hull missing, rounded up to a whole credit.';
        document.getElementById('repair-detail').innerText=repairCost?`${Math.round((1-this.player.hull/this.player.maxHull)*100)}% HULL MISSING`:'100% INTEGRITY';
        grid.innerHTML = '';
        const current = getPlayerStats(this.levels,this.shipId);
        const displayValue = (key, stats) => ({
            weaponPower: `${stats.damage} DMG`, missilePower:`${stats.missileBaseDamage} DMG`, spread: `${stats.spreadCount} SHOTS · ${stats.volleyDamage.toFixed(1)} VOLLEY DMG`,
            sideGuns: stats.sideGunLevel ? `${Math.round(stats.damage * stats.sideDamageFactor)} DMG × 2` : 'OFF',
            missiles:stats.missileLevel?`${Math.round(stats.missileDamage)} DMG · ${(1000/stats.missileDelay).toFixed(2)}/s`:'OFF',fireRate: `${(1000/stats.fireDelay).toFixed(1)} VOLLEYS/S`,
            megaCannon:stats.megaLevel?`${Math.round(stats.damage*stats.megaDamageFactor)} DMG · ${(1000/stats.fireDelay).toFixed(1)}/s · ½ BEAT`:'OFF',
            cluster:stats.clusterLevel?`${Math.round(stats.clusterDamage)} / SEEKER · 3 / DOCK`:'OFF',
            clusterRight:stats.clusterRightLevel?`${Math.round(stats.clusterRightDamage)} / SEEKER · 3 / DOCK`:'OFF',
            turret:stats.turretLevel?`${Math.round(stats.damage*stats.turretLevel)} DMG · ${(1000/stats.fireDelay).toFixed(1)}/s`:'OFF',
            turretRight:stats.turretRightLevel?`${Math.round(stats.damage*stats.turretRightLevel)} DMG · ${(1000/stats.fireDelay).toFixed(1)}/s`:'OFF',
            turretFront:stats.turretFrontLevel?`${Math.round(stats.damage*stats.turretFrontLevel)} DMG · ${(1000/stats.fireDelay).toFixed(1)}/s`:'OFF',
            speed: `${stats.speedBase.toFixed(1)} SPEED`, shieldGen: `${stats.maxRegenShield} / ${stats.regenPerSecond.toFixed(1)}/SEC`, magnet: stats.magnetRange ? `${stats.magnetRange} RANGE` : 'OFF',
        })[key];
        document.querySelectorAll('[data-shop-tab]').forEach(button=>{const selected=button.dataset.shopTab===this.shopTab;button.classList.toggle('selected',selected);button.setAttribute('aria-selected',String(selected));});
        const catalogue=Object.keys(GAME_CONFIG.UPGRADES).filter(key=>this.shopTab==='ordnance'?ORDNANCE_KEYS.includes(key):this.shopTab==='weapons'?MODULE_KEYS.includes(key)&&!ORDNANCE_KEYS.includes(key):!MODULE_KEYS.includes(key));
        const pageSize=compactShop(window.innerWidth,window.innerHeight)?2:6,pages=Math.ceil(catalogue.length/pageSize);
        this.shopPage=Math.max(0,Math.min(pages-1,this.shopPage));
        document.getElementById('shop-pagination').hidden=pages<=1;
        document.getElementById('shop-page-label').innerText=`${this.shopPage+1} / ${pages}`;
        document.getElementById('shop-prev').disabled=this.shopPage===0;document.getElementById('shop-next').disabled=this.shopPage>=pages-1;
        catalogue.slice(this.shopPage*pageSize,(this.shopPage+1)*pageSize).forEach(key => {
            const u = GAME_CONFIG.UPGRADES[key]; const level = this.levels[key]||0;
            const cost = getUpgradeCost(key, this.levels); const lock = upgradeLock(key, this.levels, this.wave);
            const affordable = this.coins >= cost && !lock;
            const next = getPlayerStats({ ...this.levels, [key]: level + 1 },this.shipId);
            const div = document.createElement('div'); div.className = 'shop-item';div.dataset.upgrade=key;div.tabIndex=-1;div.setAttribute('aria-label',u.name);
            div.innerHTML = `
                <button type="button" class="shop-decal equipment-info" data-info="${key}" aria-label="About ${u.name}" title="Equipment details">${shopDiagram(key)}<span aria-hidden="true">ⓘ</span></button>
                <div class="shop-title">${u.name}</div>
                <div class="shop-lvl">RANK ${level}/${u.max}</div>
                <div class="shop-description">${u.description}</div>
                <div class="shop-values">${displayValue(key, current)}${level < u.max ? ` → <span>${displayValue(key, next)}</span>` : ''}</div>
                <button data-buy="${key}" class="shop-btn ${affordable ? 'affordable' : ''}" ${affordable ? '' : 'disabled'}>${lock || `${affordable?'BUY':'NEED'} · ${cost} CR`}</button>
                ${getSalvageValue(key,this.levels)>0?`<button data-salvage="${key}" class="salvage-btn" title="Remove this weapon and recover 60% of the credits paid.">SALVAGE · +${getSalvageValue(key,this.levels)} CR</button>`:''}`;
            div.querySelector('[data-buy]').addEventListener('click', () => buyUpgrade(key));
            div.querySelector('[data-info]').addEventListener('click',()=>showEquipment(key));
            div.querySelector('[data-salvage]')?.addEventListener('click', () => requestSalvage(key));
            grid.appendChild(div);
        });
        shopUI.style.display = 'flex';
        this.saveCheckpoint();document.getElementById('shop-save-note').innerText=this.practice?'PRACTICE FLIGHT · EXPEDITION SAVE KEPT':this.recordable?`DOCK SAVE UPDATED · CONTINUE AT WAVE ${this.wave+1} ANY TIME`:'DEVELOPMENT FLIGHT · SAVE DISABLED';
        if(!shopWasOpen){shopUI.scrollTop=0;this.focusOverlay('shop-screen');}
        else if(previousBuy||previousSalvage){const key=previousBuy||previousSalvage;const candidate=grid.querySelector(`[data-buy="${key}"]:not(:disabled)`)||grid.querySelector(`[data-upgrade="${key}"]`);candidate?.focus?.({preventScroll:true});}
    },
    selectShopTab(tab) { if(this.salvagePending||!['weapons','ordnance','systems'].includes(tab))return;this.shopTab=tab;this.shopPage=0;this.openShop();document.querySelector(`[data-shop-tab="${tab}"]`)?.focus?.({preventScroll:true}); },
    changeShopPage(direction) { if(this.salvagePending)return;this.shopPage+=direction;this.openShop();document.getElementById(direction>0?'shop-prev':'shop-next').focus?.({preventScroll:true}); },

    updateHUD() {
        document.getElementById('hud-coins').innerText = Math.floor(this.coins);
        document.getElementById('dock-btn').hidden=this.shopPhase!=='beacon'||!this.active;
        document.getElementById('hud-score').innerText=this.stats.score.toLocaleString();
        document.getElementById('hud-combo').innerText=this.stats.combo>=4?`${scoreMultiplier(this.stats.combo).toFixed(2)}× · ${this.stats.combo} CHAIN`:'BUILD YOUR CHAIN';
        document.getElementById('hud-hull').innerText=`${Math.ceil(this.player.hull)}/${this.player.maxHull}`;
        document.getElementById('hull-label').innerText=this.player.hull<=30?'HULL CRITICAL':'HULL';
        document.getElementById('hull-label').classList.toggle('critical',this.player.hull<=30);
        document.getElementById('hud-shield').innerText=`${Math.ceil(this.player.regenShield)}/${this.player.maxRegenShield}`;
        const dash=document.getElementById('dash-btn'),pulse=document.getElementById('pulse-btn');
        const canAct=this.active&&!this.paused&&this.shopPhase!=='beacon';
        dash.disabled=!canAct||this.player.dashCooldown>0;dash.innerText=this.player.dashCooldown>0?`DASH · ${(this.player.dashCooldown/1000).toFixed(1)}s`:this.touchMode?'DASH':'SHIFT · DASH';
        pulse.disabled=!canAct||this.pulseCharge<100;pulse.innerText=this.touchMode?this.pulseCharge>=100?'PULSE READY':`PULSE ${Math.floor(this.pulseCharge)}%`:this.pulseCharge>=100?'E · SHOCKWAVE READY':`SHOCKWAVE · ${Math.floor(this.pulseCharge)}%`;
        document.getElementById('pulse-charge').style.width=`${this.pulseCharge}%`;
        pulse.classList.toggle('ready',this.pulseCharge>=100);
        const cluster=document.getElementById('cluster-btn'),ammo=this.player.clusterAmmo+this.player.clusterRightAmmo;
        cluster.disabled=!canAct||!ammo||this.player.clusterCooldown>0;
        cluster.innerText=this.touchMode?this.player.clusterCapacity?`ROCKETS ${ammo}/${this.player.clusterCapacity}`:'ROCKETS —':this.player.clusterCapacity?`R · CLUSTER ${ammo}/${this.player.clusterCapacity}`:'R · CLUSTER NOT FITTED';
        document.body.classList.toggle('beacon-ready',this.shopPhase==='beacon');
        const boss=this.enemies.find(e=>e.isBoss&&e.active),invaders=this.invasion?.members.filter(e=>e.active)||[];
        document.getElementById('boss-hud').style.display=boss||invaders.length?'block':'none';
        if(invaders.length){document.getElementById('boss-name').innerText=`CORE INVASION FLEET · ${invaders.length} SHIPS · ${this.invasion.phase===2?'OVERDRIVE':'ARMOURED FORMATION'}`;document.getElementById('boss-fill').style.width=`${invaders.reduce((sum,e)=>sum+Math.max(0,e.hp),0)/this.invasion.maxHp*100}%`;}
        else if(boss){document.getElementById('boss-name').innerText=`${boss.commander.name} · PHASE ${boss.phase}`;document.getElementById('boss-fill').style.width=`${Math.max(0,boss.hp/boss.maxHp)*100}%`;}
        document.getElementById('chapter-label').innerText=this.endless?'ENDLESS EXPEDITION':`ACT ${getAct(this.wave).number}/3 · ${getAct(this.wave).name}`;
        document.getElementById('hud-mode').innerText=`${this.practice?'PRACTICE · ':''}${getDifficulty(this.difficulty).name}`;
        document.getElementById('hud-time').innerText = formatTime(this.elapsed);
        document.getElementById('hud-wave').innerText = this.wave > WAVE_COUNT ? `ENDLESS ${this.wave - WAVE_COUNT}` : `WAVE ${this.wave}/${WAVE_COUNT}`;
        document.getElementById('hud-modules').innerText = `WEAPONS ${moduleCount(this.levels)}/${MODULE_SLOTS}`;
        const wavesToShop = SHOP_WAVE_INTERVAL - (this.wave - 1) % SHOP_WAVE_INTERVAL;
        document.getElementById('hud-shop').innerText = this.shopPhase === 'beacon' ? 'RESUPPLY READY' : this.wave===WAVE_COUNT&&!this.endless?'FINAL ENGAGEMENT':`SHOP IN ${wavesToShop} ${wavesToShop === 1 ? 'WAVE' : 'WAVES'}`;
        const status = this.ending ? this.ending.won?'VICTORY · CORE FLEET DESTROYED':'FLIGHT LOST · SHIP DESTROYED' : this.shopPhase === 'fighting' ? `${getWaveProfile(this.wave).name} • ${Math.max(0, Math.ceil((WAVE_DURATION_MS - this.shopTimer)/1000))}s` : this.shopPhase === 'boss' ? this.invasion?`DESTROY THE FLEET • ${this.invasion.dropTimer>0?'DESCENDING!':'HOLD THE BREACH LINE'}`:'COMMAND SHIP • DESTROY TO ADVANCE' : this.shopPhase === 'clearing' ? 'CLEARING • ENEMIES RETREATING' : 'SECTOR CLEAR • DOCK OR PRESS ENTER';
        document.getElementById('hud-phase').innerText = status;
        document.getElementById('bar-hull').style.width = Math.max(0, (this.player.hull / this.player.maxHull) * 100) + '%';
        document.getElementById('bar-deflector').style.width = Math.max(0, (this.player.regenShield / this.player.maxRegenShield) * 100) + '%';
        let osPct = Math.min(100, (this.player.tempShield / 100) * 100);
        document.getElementById('bar-overshield').style.width = osPct + '%';
        const timerPct = Math.min(100, (this.shopTimer / WAVE_DURATION_MS) * 100);
        document.getElementById('bar-shop').style.width = timerPct + '%';

        const buffsDiv = document.getElementById('active-buffs');
        buffsDiv.innerHTML = '';
        if(this.player.buffs) {
            Object.keys(this.player.buffs).forEach(k => {
                if(this.player.buffs[k] > 0) {
                    const span = document.createElement('span'); span.className = 'buff-icon';
                    let label = k.replace('buff_', '').toUpperCase();
                    let color = '#fff';
                    if(k === 'buff_rapid') color = '#ffff00'; if(k === 'buff_plasma') color = '#00ccff'; if(k === 'buff_guns') color = '#ff00ff'; if(k === 'buff_missiles') color = '#ffaa00';
                    span.style.color = color; span.style.borderColor = color; span.innerText = label + " " + Math.ceil(this.player.buffs[k]/1000) + "s";
                    buffsDiv.appendChild(span);
                }
            });
        }
    },

    gameOver(won = false) {
        if(!this.active)return;
        this.paused=false;this.manualPause=false;
        document.getElementById('pause-screen').style.display='none';document.getElementById('shop-screen').style.display='none';
        this.active = false; this.victory = won; this.clearKeys();
        const ended=!won&&this.player.hull>0;
        const resultScreen=document.getElementById('game-over-screen');
        resultScreen.classList.toggle('victory',won);resultScreen.classList.toggle('defeat',!won&&!ended);
        document.getElementById('result-eyebrow').innerText=won?this.practice?'PRACTICE VICTORY · FINAL FLEET DESTROYED':'EXPEDITION COMPLETE · BLOCKADE BROKEN':'FLIGHT RECORDER / MISSION DEBRIEF';
        document.getElementById('result-title').innerText = won ? 'YOU WIN' : ended?'FLIGHT ENDED':'SHIP DESTROYED';
        document.getElementById('final-score').innerText = `${won ? this.practice?'FINAL WAVE CONQUERED':'ALL 30 SECTORS CLEARED' : `WAVE ${this.wave}`} · ${formatTime(this.elapsed)}`;
        document.getElementById('result-detail').innerText = won ? 'Congratulations, pilot! You shattered the Core Invasion Fleet. The blockade is broken. Enjoy your victory—or take your ship into endless space.' : ended?'Your flight is recorded. Try another route, difficulty or weapon build.':`Last hit: ${this.stats.lastHit||'HOSTILE FIRE'}. Your career progress is kept. Try another ship or build on your next expedition.`;
        document.getElementById('endless-btn').style.display = won ? 'block' : 'none';
        resultScreen.style.display = 'none';
        const accuracy=this.stats.shots?Math.min(100,Math.round(this.stats.hits/this.stats.shots*100)):0;
        document.getElementById('result-stats').innerHTML=[['SCORE',this.stats.score.toLocaleString()],['SHIPS DESTROYED',this.stats.kills],['BEST CHAIN',this.stats.bestCombo],['ACCURACY',`${accuracy}%`],['DASHES',this.stats.dashes],['SHOCKWAVES',this.stats.pulses]].map(([label,value])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('');
        this.profile.checkpoint=null;
        if(this.recordable){this.bankCareer(true,won);this.profile=recordRun(this.profile,{difficulty:this.difficulty,endless:this.endless,won,score:this.stats.score,wave:this.wave,kills:this.stats.kills,elapsed:this.elapsed,mode:'expedition'});saveProfile(this.profile);}
        this.renderRecords();
        this.renderCareer();
        const record=this.profile.records[`${this.difficulty}-${this.endless?'endless':'expedition'}`];
        document.getElementById('result-record').innerText=this.practice?'PRACTICE FLIGHT · CAREER AND EXPEDITION SAVE KEPT':this.recordable?`${getDifficulty(this.difficulty).name} ${this.endless?'ENDLESS':'EXPEDITION'} BEST · ${(record?.bestScore||0).toLocaleString()}`:'DEVELOPMENT FLIGHT · SCORE NOT SAVED';
        document.getElementById('replay-btn').innerText=this.practice?'PRACTICE AGAIN ↗':won?'FLY ANOTHER EXPEDITION ↗':'TRY AGAIN ↗';
        if(this.practice&&!won){document.getElementById('result-detail').innerText=`Practice started at wave ${this.practiceWave}. Try again or return to the hangar to choose another wave or loadout. Your expedition and career are kept.`;}
        document.getElementById('wave-banner').classList.remove('visible');
        AudioEngine.stopMusic();
        if(ended){this.showResults();return;}
        const reduced=this.profile.settings.reducedMotion,origin=won?(this.lastEnemyExplosion||{x:WIDTH/2,y:HEIGHT*.3,color:'#b89aff',radius:27}):{x:this.player.x,y:this.player.y,color:this.player.color,radius:24};
        this.ending={won,elapsed:0,duration:reduced?END_SEQUENCE.reduced:won?END_SEQUENCE.victory:END_SEQUENCE.defeat,effectClock:0,celebrated:false,
            explosion:new ShipExplosion(origin.x,origin.y,origin.color,Math.max(.9,origin.radius/27),reduced)};
        this.bullets=[];this.missiles=[];this.player.pendingShots=[];
        this.updateHUD();
        document.getElementById('boss-hud').style.display='none';
        const cinematic=document.getElementById('end-cinematic');cinematic.classList.remove('celebrating');cinematic.classList.toggle('won',won);cinematic.style.display='flex';
        document.getElementById('cinematic-title').innerText=won?'YOU WIN':'SHIP DESTROYED';
        document.getElementById('cinematic-detail').innerText=won?'CORE INVASION FLEET ELIMINATED':'FLIGHT RECORDER RECOVERED';
        document.getElementById('ui-layer').inert=true;CANVAS_GAME.inert=true;document.activeElement?.blur?.();
        if(!won){AudioEngine.playExplosion();this.shakeScreen(reduced?0:7);}
    },
    updateEnding(dt) {
        const ending=this.ending;if(!ending)return;
        ending.elapsed+=dt;ending.explosion.update(dt);ending.effectClock+=dt;
        // Existing particles keep their fixed simulation rate; only effects run.
        while(ending.effectClock>=STEP_MS){
            this.particles.forEach(p=>p.update());this.rings.forEach(r=>r.update(STEP_MS));this.labels.forEach(l=>l.update(STEP_MS));ending.effectClock-=STEP_MS;
        }
        for(const key of ['particles','rings','labels'])this[key]=this[key].filter(effect=>effect.active);
        if(ending.elapsed>=END_SEQUENCE.celebrationAt&&!ending.celebrated){
            ending.celebrated=true;document.getElementById('end-cinematic').classList.add('celebrating');if(ending.won)AudioEngine.playVictory();
        }
        if(ending.elapsed>=ending.duration){this.ending=null;this.showResults();}
    },
    showResults() {
        document.getElementById('end-cinematic').style.display='none';
        document.getElementById('game-over-screen').style.display='flex';this.focusOverlay('game-over-screen');
    }
};

function startGame() { if(Game.practice)Game.startPractice();else Game.start(); }
function closeShop() {
    if (!Game.active || !Game.paused || Game.shopPhase !== 'beacon') return;
    if(Game.salvagePending)return;
    document.getElementById('shop-screen').style.display = 'none'; Game.paused = false; Game.nextWave();Game.focusOverlay(null);AudioEngine.updateVolumes();
}
function continueEndless() {
    if (!Game.victory || Game.active || Game.ending) return;
    document.getElementById('game-over-screen').style.display = 'none';
    Game.endless=true;Game.active = true; Game.paused = false; Game.shopPhase = 'beacon'; Game.beacon = new ShopBeacon();
    Game.player.refillOrdnance();AudioEngine.startMusic(); Game.openShop();
}
function buyUpgrade(key) {
    if(Game.salvagePending)return;
    if (!Game.active || !Game.paused || Game.shopPhase !== 'beacon' || !Object.hasOwn(GAME_CONFIG.UPGRADES, key)) return;
    const cost = getUpgradeCost(key, Game.levels);
    if (upgradeLock(key, Game.levels, Game.wave) || Game.coins < cost) return;
    const oldShieldMax = Game.player.maxRegenShield;
    const firstInstall=!Game.levels[key];
    Game.coins -= cost; Game.stats.spent+=cost; Game.levels[key]=(Game.levels[key]||0)+1; Game.player.updateStats();
    if(firstInstall&&key==='cluster')Game.player.clusterAmmo=3;
    if(firstInstall&&key==='clusterRight')Game.player.clusterRightAmmo=3;
    if (key === 'shieldGen') Game.player.regenShield += Game.player.maxRegenShield - oldShieldMax;
    AudioEngine.playPowerup(); Game.openShop(); Game.updateHUD();
}
function buyRepair() {
    if(Game.salvagePending)return;
    if (!Game.active || !Game.paused || Game.shopPhase !== 'beacon') return;
    const cost=getRepairCost(Game.levels,Game.player.hull,Game.player.maxHull);
    if (cost > 0 && Game.coins >= cost) {
        Game.coins -= cost; Game.stats.spent+=cost;
        Game.player.hull = Game.player.maxHull; Game.player.hullWarned=false;
        AudioEngine.playCrateBreak(); Game.openShop(); Game.updateHUD();
    }
}
function requestSalvage(key) {
    if(Game.salvagePending||!Game.active||!Game.paused||Game.shopPhase!=='beacon'||!Object.hasOwn(GAME_CONFIG.UPGRADES,key))return;
    const refund=getSalvageValue(key,Game.levels);if(!refund)return;
    Game.salvagePending={key,rank:Game.levels[key],refund};
    document.getElementById('salvage-name').innerText=GAME_CONFIG.UPGRADES[key].name;
    document.getElementById('salvage-rank').innerText=`REMOVE ALL ${Game.levels[key]} ${Game.levels[key]===1?'RANK':'RANKS'}`;
    document.getElementById('salvage-decal').innerHTML=shopDiagram(key);
    document.getElementById('salvage-refund').innerText=`${refund.toLocaleString()} CR`;
    document.getElementById('salvage-confirm').innerText=`SCRAP FOR ${refund.toLocaleString()} CR`;
    document.getElementById('salvage-dialog').showModal();
    document.getElementById('salvage-cancel').focus();
}
function showEquipment(key) {
    if(!Game.active||!Game.paused||Game.shopPhase!=='beacon'||Game.salvagePending||!Object.hasOwn(GAME_CONFIG.UPGRADES,key))return;
    const upgrade=GAME_CONFIG.UPGRADES[key];
    document.getElementById('equipment-name').innerText=upgrade.name;
    document.getElementById('equipment-description').innerText=upgrade.description;
    document.getElementById('equipment-art').innerHTML=shopDiagram(key);
    document.getElementById('equipment-rank').innerText=`RANK ${Game.levels[key]} / ${upgrade.max} · ${upgradeLock(key,Game.levels,Game.wave)||`NEXT RANK ${getUpgradeCost(key,Game.levels).toLocaleString()} CR`}`;
    document.getElementById('equipment-dialog').dataset.item=key;
    document.getElementById('equipment-dialog').showModal();document.getElementById('equipment-close').focus();
}
function closeEquipment() {
    const dialog=document.getElementById('equipment-dialog');if(!dialog.open)return;
    dialog.close();(document.querySelector(`[data-info="${dialog.dataset.item}"]`)||document.getElementById('shop-screen'))?.focus?.({preventScroll:true});
}
function cancelSalvage(restoreFocus=true) {
    const pending=Game.salvagePending;Game.salvagePending=null;
    const dialog=document.getElementById('salvage-dialog');if(dialog.open)dialog.close();
    if(restoreFocus&&pending){Game.openShop();(document.querySelector(`[data-salvage="${pending.key}"]`)||document.getElementById('shop-screen'))?.focus?.({preventScroll:true});}
}
function confirmSalvage() {
    const pending=Game.salvagePending;if(!pending)return;
    cancelSalvage(false);
    if(Game.levels[pending.key]!==pending.rank||getSalvageValue(pending.key,Game.levels)!==pending.refund)return;
    salvageModule(pending.key);
    document.querySelector(`[data-upgrade="${pending.key}"]`)?.focus?.({preventScroll:true});
}
function salvageModule(key) {
    if(!Game.active||!Game.paused||Game.shopPhase!=='beacon'||!Object.hasOwn(GAME_CONFIG.UPGRADES,key))return;
    const refund=getSalvageValue(key,Game.levels);if(!refund)return;
    Game.coins+=refund;Game.levels[key]=0;Game.player.updateStats();if(key==='cluster')Game.player.clusterAmmo=0;if(key==='clusterRight')Game.player.clusterRightAmmo=0;
    AudioEngine.playCoin();Game.openShop();Game.updateHUD();
}

/**
 * =========================================
 * ENTITIES
 * =========================================
 */

class ShopBeacon {
    constructor() {
        this.x = WIDTH / 2;
        this.y = Math.max(90, Math.min(HEIGHT - 100, Game.player.y - 140));
        this.size = 100;
        this.active = true;
        this.vy = 1.0;
        this.glow = 0;
    }
    update(dt) {
        this.glow += 0.05;
    }
    draw() {
        CTX.save();
        CTX.translate(this.x, this.y);
        const alpha = 0.5 + Math.sin(this.glow) * 0.3;
        CTX.shadowBlur = 20; CTX.shadowColor = '#00f3ff';
        CTX.strokeStyle = `rgba(0, 243, 255, ${alpha})`;
        CTX.lineWidth = 4;
        CTX.strokeRect(-this.size/2, -30, this.size, 60);
        CTX.fillStyle = `rgba(0, 243, 255, 0.1)`;
        CTX.fillRect(-this.size/2, -30, this.size, 60);
        CTX.fillStyle = '#fff';
        CTX.font = '20px "Roboto Mono", monospace';
        CTX.textAlign = 'center';
        CTX.fillText("SHOP", 0, 8);
        CTX.font = '10px "Roboto Mono", monospace';
        CTX.fillText("TAP / ENTER TO DOCK", 0, 22);
        CTX.restore();
    }
}

class Player {
    constructor() {
        this.x = WIDTH / 2; this.y = HEIGHT - 100; this.radius = GAME_CONFIG.PLAYER.RADIUS; this.color = getShip(Game.shipId).color; this.tilt = 0;
        this.shipId=Game.shipId;this.maxHull = getShip(this.shipId).hull; this.hull = this.maxHull;
        this.maxRegenShield = 0; this.regenShield = 0; this.tempShield = 0; 
        this.fireTimer = 0; this.missileTimer = 0; this.missileDelay = 1400;
        this.pendingShots=[];this.turrets=TURRET_MOUNTS.map(mount=>({...mount,angle:mount.axis,target:null}));
        this.clusterAmmo=0;this.clusterRightAmmo=0;this.clusterCooldown=0;this.nextClusterSide='left';
        this.hitGrace = 0; this.rechargeDelay = 0;
        this.hullWarned=false;
        this.dashCooldown=0;this.dashTimer=0;this.dashX=0;this.dashY=-1;this.lastDX=0;this.lastDY=-1;
        this.buffs = { buff_rapid: 0, buff_plasma: 0, buff_guns: 0, buff_missiles: 0 };
        this.updateStats();
        this.regenShield = this.maxRegenShield;
    }

    updateStats() {
        if(this.hull>40)this.hullWarned=false;
        const previousDelay=this.fireDelay;
        Object.assign(this, getPlayerStats(Game.levels,Game.shipId));
        if (this.buffs.buff_plasma > 0) this.damage *= 1.5;
        if (this.buffs.buff_rapid > 0) this.fireDelay /= 1.3;
        if (this.buffs.buff_guns > 0) this.spreadCount += 2;
        Object.assign(this,getMultishotStats(this.damage,this.spreadCount));
        if(this.buffs.buff_missiles>0){this.missileLevel=Math.max(1,this.missileLevel);this.missileCount++;this.missileDamage=this.missileBaseDamage*this.missileLevel;}
        if(previousDelay>0&&previousDelay!==this.fireDelay){
            const ratio=this.fireDelay/previousDelay;this.fireTimer*=ratio;
            this.pendingShots.forEach(shot=>shot.timer*=ratio);
        }
    }

    update(dt) {
        Object.keys(this.buffs).forEach(k => this.buffs[k] = Math.max(0, this.buffs[k] - dt));
        this.dashCooldown=Math.max(0,this.dashCooldown-dt);this.dashTimer=Math.max(0,this.dashTimer-dt);
        this.clusterCooldown=Math.max(0,this.clusterCooldown-dt);
        this.hitGrace = Math.max(0, this.hitGrace - dt);
        this.rechargeDelay = Math.max(0, this.rechargeDelay - dt);
        this.updateStats();
        if (this.rechargeDelay <= 0) this.regenShield = Math.min(this.regenShield + this.regenPerSecond * dt/1000, this.maxRegenShield);

        let dx = 0, dy = 0;
        if (Game.keys.w || Game.keys.ArrowUp) dy = -1;
        if (Game.keys.s || Game.keys.ArrowDown) dy = 1;
        if (Game.keys.a || Game.keys.ArrowLeft) dx = -1;
        if (Game.keys.d || Game.keys.ArrowRight) dx = 1;
        if(!dx&&!dy&&Game.stick){dx=Game.stick.x;dy=Game.stick.y;}
        if(Game.pointer.active&&!dx&&!dy){const px=Game.pointer.x-this.x,py=Game.pointer.y-this.y,d=Math.hypot(px,py);if(d>1){const step=Math.min(1,d/this.speedBase);dx=px/d*step;dy=py/d*step;}}
        const moveLen=Math.hypot(dx,dy);if(moveLen>1){dx/=moveLen;dy/=moveLen;}
        if(moveLen>.05){this.lastDX=dx;this.lastDY=dy;}
        if(this.dashTimer>0){dx=this.dashX*ABILITIES.dashSpeed;dy=this.dashY*ABILITIES.dashSpeed;if(!Game.profile.settings.reducedMotion)createParticles(this.x,this.y,'#48e6ff',1);}
        
        if (dx < 0) this.tilt = Math.max(this.tilt - 0.1, -0.4);
        else if (dx > 0) this.tilt = Math.min(this.tilt + 0.1, 0.4);
        else this.tilt *= 0.8;


        this.x += dx * this.speedBase; this.y += dy * this.speedBase;
        this.x = Math.max(this.radius, Math.min(WIDTH - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(HEIGHT - this.radius, this.y));

        this.fireTimer -= dt;
        const firing=Game.keys[' ']||Game.touchFire||Game.pointer.active||Game.profile.settings.autoFire;
        this.updateTurrets(dt);
        if(!firing)this.pendingShots=[];
        else {
            for(const shot of this.pendingShots){shot.timer-=dt;if(shot.timer<=0){if(shot.key==='megaCannon')this.shootMega();else this.shootTurret(shot.key);}}
            this.pendingShots=this.pendingShots.filter(shot=>shot.timer>0);
        }
        if(firing&&this.fireTimer<=0)this.shoot();

        if (this.missileLevel > 0) {
            this.missileTimer -= dt;
            if (this.missileTimer <= 0 && Game.enemies.length > 0) {
                this.shootMissile();
                this.missileTimer = this.missileDelay;
            }
        }
    }

    dash() {
        if(!Game.active||Game.paused||Game.shopPhase==='beacon'||this.dashCooldown>0)return false;
        let dx=Number(!!(Game.keys.d||Game.keys.ArrowRight))-Number(!!(Game.keys.a||Game.keys.ArrowLeft));
        let dy=Number(!!(Game.keys.s||Game.keys.ArrowDown))-Number(!!(Game.keys.w||Game.keys.ArrowUp));
        if(!dx&&!dy){dx=this.lastDX;dy=this.lastDY;}
        const length=Math.hypot(dx,dy)||1;this.dashX=dx/length;this.dashY=dy/length;
        this.dashCooldown=getShip(Game.shipId).dashCooldown;this.dashTimer=ABILITIES.dashDuration;
        this.hitGrace=Math.max(this.hitGrace,ABILITIES.dashDuration+40);Game.stats.dashes++;AudioEngine.playAbility('dash');Game.updateHUD();return true;
    }
    shoot() {
        Game.stats.shots+=this.spreadCount+(this.sideGunLevel>0?2:0);
        // Carry a partial frame forward so the displayed firing cadence is real.
        // Clamp an idle timer to avoid banking a burst while the trigger is up.
        this.fireTimer = this.fireDelay + Math.min(0,Math.max(-STEP_MS,this.fireTimer));
        // One clock drives every gun, preserving its phase when rapid fire changes.
        const carry=this.fireTimer-this.fireDelay;
        this.pendingShots=[];
        if(this.megaLevel>0)this.pendingShots.push({key:'megaCannon',timer:this.fireDelay/2+carry});
        const mounted=this.turrets.filter(t=>this.turretLevels[t.key]>0);
        mounted.forEach((t,i)=>this.pendingShots.push({key:t.key,timer:this.fireDelay*(i+1)/(mounted.length+1)+carry}));
        const spread = this.spreadCount;
        for(let i=0; i<spread; i++) {
            let offset = (i - (spread-1)/2) * 0.2; let bx = this.x + (i - (spread-1)/2) * 10;
            Game.bullets.push(new Bullet(bx, this.y - 20, 0, -15, this.mainShotDamage, 'player', offset, this.buffs.buff_plasma > 0));
        }
        if (this.sideGunLevel > 0) {
            for(const side of [-1,1]){
                const shot=new Bullet(this.x+side*28,this.y+6,side*15,0,this.damage*this.sideDamageFactor,'player',0,this.buffs.buff_plasma>0);
                shot.kind='side';shot.color='#ffaa44';Game.bullets.push(shot);
            }
        }
        AudioEngine.playShoot('player', this.buffs.buff_plasma > 0);
    }

    shootMissile() {
        const enemies=Game.enemies.filter(e=>e.active&&e.entryDelay<=0).sort((a,b)=>dist(this.x,this.y,a.x,a.y)-dist(this.x,this.y,b.x,b.y));
        if(!enemies.length)return;
        AudioEngine.playMissile();
        for(let i=0;i<this.missileCount;i++){
            Game.missiles.push(new Missile(this.x+(i%2?-18:18),this.y,enemies[i%enemies.length],this.missileDamage,'player'));
            Game.stats.shots++;
        }
    }

    shootMega() {
        if(!this.megaLevel)return;
        const shot=new Bullet(this.x,this.y-35,0,-this.megaSpeed,this.damage*this.megaDamageFactor,'player');shot.kind='mega';shot.radius=this.megaRadius;shot.color='#ffb35d';
        Game.bullets.push(shot);Game.stats.shots++;AudioEngine.playShoot('player',true);
    }
    turretTarget(turret) {
        return [...Game.enemies.filter(e=>e.active&&e.entryDelay<=0),...Game.crates.filter(e=>e.active)].filter(target=>{
            const bearing=Math.atan2(target.y-this.y,target.x-this.x),delta=Math.atan2(Math.sin(bearing-turret.axis),Math.cos(bearing-turret.axis));
            return Math.abs(delta)<=Math.PI/2+1e-9;
        }).sort((a,b)=>dist(this.x,this.y,a.x,a.y)-dist(this.x,this.y,b.x,b.y))[0]||null;
    }
    turretBearing(turret,target) {
        const angle=Math.atan2(target.y-this.y-turret.y,target.x-this.x-turret.x),delta=Math.atan2(Math.sin(angle-turret.axis),Math.cos(angle-turret.axis));
        return turret.axis+Math.max(-Math.PI/2,Math.min(Math.PI/2,delta));
    }
    updateTurrets(dt) {
        for(const turret of this.turrets){
            if(!this.turretLevels[turret.key]){turret.target=null;continue;}
            turret.target=this.turretTarget(turret);if(!turret.target)continue;
            const delta=this.turretBearing(turret,turret.target)-turret.angle,turn=this.turretTurn*dt/1000;
            turret.angle+=Math.max(-turn,Math.min(turn,delta));
        }
    }
    shootTurret(key) {
        const turret=this.turrets.find(t=>t.key===key),rank=this.turretLevels[key];
        if(!turret||!rank)return;
        const target=this.turretTarget(turret);if(!target)return;
        turret.target=target;turret.angle=this.turretBearing(turret,target);
        const dx=Math.cos(turret.angle),dy=Math.sin(turret.angle);
        const shot=new Bullet(this.x+turret.x+dx*10,this.y+turret.y+dy*10,dx*this.turretSpeed,dy*this.turretSpeed,this.damage*rank,'player');
        shot.kind='turret';shot.mount=key;shot.color=turret.color;Game.bullets.push(shot);
        Game.stats.shots++;
    }
    refillOrdnance() { this.clusterAmmo=this.clusterLevel?3:0;this.clusterRightAmmo=this.clusterRightLevel?3:0;this.clusterCooldown=0;this.nextClusterSide='left'; }
    launchCluster() {
        if(!Game.active||Game.paused||Game.shopPhase==='beacon'||!(this.clusterAmmo+this.clusterRightAmmo)||this.clusterCooldown>0)return false;
        const target=Game.enemies.filter(e=>e.active&&e.entryDelay<=0).sort((a,b)=>dist(this.x,this.y,a.x,a.y)-dist(this.x,this.y,b.x,b.y))[0];
        if(!target)return false;
        const right=this.clusterRightAmmo>0&&(this.nextClusterSide==='right'||!this.clusterAmmo);
        if(right)this.clusterRightAmmo--;else this.clusterAmmo--;
        this.nextClusterSide=right?'left':'right';this.clusterCooldown=600;
        Game.missiles.push(new ClusterMissile(this.x+(right?34:-34),this.y-4,target,right?this.clusterRightDamage:this.clusterDamage,right?this.clusterRightSpeed:this.clusterSpeed,right?this.clusterRightLevel:this.clusterLevel));
        AudioEngine.playMissile();Game.updateHUD();return true;
    }

    takeDamage(amount,source='HOSTILE FIRE') {
        if (this.hitGrace > 0 || !Game.active) return;
        Game.stats.combo=0;Game.stats.comboTimer=0;Game.stats.lastHit=source;
        this.hitGrace = GAME_CONFIG.HIT_GRACE_MS;
        this.rechargeDelay = GAME_CONFIG.SHIELD_REGEN_DELAY_MS;
        let remaining = amount;
        if (this.tempShield > 0) { const absorb = Math.min(this.tempShield, remaining); this.tempShield -= absorb; remaining -= absorb; }
        if (remaining > 0 && this.regenShield > 0) { const absorb = Math.min(this.regenShield, remaining); this.regenShield -= absorb; remaining -= absorb; }
        Game.rings.push(new ShockRing(this.x,this.y,remaining>0?42:32,remaining>0?'#ff6685':'#68b4ff',330));
        AudioEngine.playDamage(remaining>0);
        if (remaining > 0) {
            Game.stats.hullLost+=Math.min(this.hull,remaining);this.hull = Math.max(0, this.hull - remaining);
            createFloatingText(this.x,this.y-38,`-${Math.ceil(remaining)} HULL`,'#ff8aab');
            if (this.hull <= 0) Game.gameOver();
            else if(this.hull<=30&&!this.hullWarned){this.hullWarned=true;Game.announce('HULL CRITICAL','SHIFT TO DASH · REPAIR AT THE NEXT DOCK','#ff8aab',2600);}
        }
        Game.shakeScreen(3);
    }

    draw() { drawPlayer(CTX,this,Game.elapsed,Game.profile.settings.reducedMotion); }

}

class ClusterMissile {
    constructor(x,y,target,damage,speed,rank){Object.assign(this,{x,y,target,damage,speed,rank,kind:'cluster',owner:'player',active:true,time:0,angle:-Math.PI/2});}
    update(dt){
        if(!this.active)return;
        this.time+=dt;
        if(!this.target?.active)this.target=Game.enemies.filter(e=>e.active&&e.entryDelay<=0).sort((a,b)=>dist(this.x,this.y,a.x,a.y)-dist(this.x,this.y,b.x,b.y))[0];
        if(this.target){
            const inRange=()=>dist(this.x,this.y,this.target.x,this.target.y)<=this.target.radius+GAME_CONFIG.CLUSTER.PROXIMITY;
            if(inRange()){this.detonate();return;}
            this.angle=Math.atan2(this.target.y-this.y,this.target.x-this.x);
            this.x+=Math.cos(this.angle)*this.speed*dt/STEP_MS;this.y+=Math.sin(this.angle)*this.speed*dt/STEP_MS;
            if(inRange()){this.detonate();return;}
        } else this.y-=this.speed*dt/STEP_MS;
        if(this.time>8000){this.detonate();return;}
        if(!Game.profile.settings.reducedMotion)createParticles(this.x,this.y,GAME_CONFIG.CLUSTER.COLOR,1);
    }
    detonate(){
        if(!this.active)return;this.active=false;AudioEngine.playExplosion();Game.rings.push(new ShockRing(this.x,this.y,90,GAME_CONFIG.CLUSTER.COLOR,450));
        for(let i=0;i<16;i++)Game.missiles.push(new ClusterSeeker(this.x,this.y,i/16*Math.PI*2,this.damage));
        Game.stats.shots+=16;
    }
    draw(){
        CTX.save();CTX.translate(this.x,this.y);CTX.rotate(this.angle+Math.PI/2);CTX.strokeStyle='#d8baff';CTX.fillStyle='#482584';CTX.lineWidth=2;CTX.shadowColor=GAME_CONFIG.CLUSTER.COLOR;CTX.shadowBlur=12;
        CTX.beginPath();CTX.moveTo(0,-12);CTX.lineTo(7,-3);CTX.lineTo(7,9);CTX.lineTo(-7,9);CTX.lineTo(-7,-3);CTX.closePath();CTX.fill();CTX.stroke();
        CTX.restore();
    }
}
class ClusterSeeker {
    constructor(x,y,angle,damage){
        Object.assign(this,{x:x+Math.cos(angle)*22,y:y+Math.sin(angle)*22,angle,damage,kind:'cluster-seeker',owner:'player',active:true,time:0,radius:4,target:null,retargetTimer:0,color:GAME_CONFIG.PLAYER_MISSILE_COLOR});
        this.vx=Math.cos(angle)*GAME_CONFIG.CLUSTER.SEEKER_SPEED;this.vy=Math.sin(angle)*GAME_CONFIG.CLUSTER.SEEKER_SPEED;
    }
    update(dt){
        if(!this.active)return;
        this.time+=dt;this.retargetTimer-=dt;
        if(this.time>=GAME_CONFIG.CLUSTER.SEEKER_LIFETIME_MS){this.active=false;return;}
        if(this.time>=GAME_CONFIG.CLUSTER.HOMING_DELAY_MS){
            if(this.retargetTimer<=0||!this.target?.active){
                this.target=Game.enemies.filter(e=>e.active&&e.entryDelay<=0).sort((a,b)=>dist(this.x,this.y,a.x,a.y)-dist(this.x,this.y,b.x,b.y))[0]||null;
                this.retargetTimer=200;
            }
            if(this.target){
                const desired=Math.atan2(this.target.y-this.y,this.target.x-this.x),delta=Math.atan2(Math.sin(desired-this.angle),Math.cos(desired-this.angle));
                const turn=GAME_CONFIG.CLUSTER.TURN_RATE*dt/1000;
                this.angle+=Math.max(-turn,Math.min(turn,delta));
            }
        }
        this.vx=Math.cos(this.angle)*GAME_CONFIG.CLUSTER.SEEKER_SPEED;this.vy=Math.sin(this.angle)*GAME_CONFIG.CLUSTER.SEEKER_SPEED;
        this.x+=this.vx*dt/STEP_MS;this.y+=this.vy*dt/STEP_MS;
        if(this.x<-120||this.x>WIDTH+120||this.y<-120||this.y>HEIGHT+120)this.active=false;
        if(!Game.profile.settings.reducedMotion)createParticles(this.x-this.vx,this.y-this.vy,this.color,1);
    }
    draw(){ Missile.prototype.draw.call(this); }
}
class Missile {
    constructor(x, y, target, damage, owner) { 
        this.x = x; this.y = y; this.target = target; this.damage = damage * (owner==='enemy'?ENEMY_PROJECTILE_DAMAGE_MULTIPLIER:1); this.owner = owner;
        this.vx = 0; this.vy = owner==='player'?-5:5; this.speed = owner==='player'? GAME_CONFIG.PLAYER_MISSILE_SPEED : GAME_CONFIG.ENEMY_MISSILE_SPEED; 
        this.active = true; 
        this.life = owner === 'enemy' ? GAME_CONFIG.MISSILE_LIFETIME : 300;
    }
    update() {
        if(this.life > 0) this.life--;
        else { this.active = false; createParticles(this.x, this.y, '#aaa', 5); return; }

        let tgt = this.owner==='player' ? this.target : Game.player;
        if(this.owner==='player'&&(!tgt||!tgt.active)){this.target=Game.enemies.filter(e=>e.active&&e.entryDelay<=0).sort((a,b)=>dist(this.x,this.y,a.x,a.y)-dist(this.x,this.y,b.x,b.y))[0];tgt=this.target;}
        if(tgt){
            const angle = Math.atan2(tgt.y - this.y, tgt.x - this.x);
            this.vx += Math.cos(angle) * (this.owner==='player'?1.1:.5); this.vy += Math.sin(angle) * (this.owner==='player'?1.1:.5);
            const len = Math.sqrt(this.vx*this.vx + this.vy*this.vy)||1;
            this.vx = (this.vx/len) * this.speed; this.vy = (this.vy/len) * this.speed;
        }
        this.x += this.vx; this.y += this.vy;
        createParticles(this.x, this.y, this.owner==='player'?GAME_CONFIG.PLAYER_MISSILE_COLOR:GAME_CONFIG.ENEMY_PLASMA_COLOR, 1);
        if (this.y < -50 || this.y > HEIGHT + 50 || this.x < 0 || this.x > WIDTH) this.active = false;
    }
    draw() { 
        CTX.save(); CTX.translate(this.x, this.y); 
        CTX.fillStyle = this.owner==='player'?GAME_CONFIG.PLAYER_MISSILE_COLOR:GAME_CONFIG.ENEMY_PLASMA_COLOR;
        if(this.owner==='player'){CTX.beginPath();CTX.arc(0,0,4,0,Math.PI*2);CTX.fill();}
        else{CTX.rotate(Math.atan2(this.vy,this.vx));CTX.strokeStyle='#b8d6ff';CTX.lineWidth=1.5;CTX.shadowColor=GAME_CONFIG.ENEMY_PLASMA_COLOR;CTX.shadowBlur=9;CTX.beginPath();CTX.moveTo(10,0);CTX.lineTo(-6,-5);CTX.lineTo(-3,0);CTX.lineTo(-6,5);CTX.closePath();CTX.fill();CTX.stroke();}
        CTX.restore(); 
    }
}

class Enemy {
    constructor(type, wave, isBoss = false) {
        const stats = GAME_CONFIG.ENEMIES[type]; const scale = getEnemyScale(wave);const difficulty=getDifficulty(Game.difficulty);
        this.type = type; this.isBoss = isBoss; this.active = true; this.time = 0;this.entryDelay=isBoss?0:450;this.hitFlash=0;this.phase=1;
        this.commander=isBoss?getCommander(wave):null;
        this.radius = isBoss?this.commander.radius:stats.radius;
        this.x = this.radius + Math.random() * Math.max(0, WIDTH - 2*this.radius); this.y = -this.radius;
        this.hp = (isBoss ? this.commander.hp*scale.hullBonus*(1+Math.max(0,wave-WAVE_COUNT)*.02) : stats.hp * scale.hp)*difficulty.health;
        this.maxHp = this.hp; this.damage = stats.damage * scale.damage*difficulty.damage * ENEMY_DAMAGE_MULTIPLIER;
        this.fireDelay = (isBoss ? this.commander.fireDelay : stats.fireDelay)*difficulty.fireDelay;
        this.fireTimer = 800 + Math.random() * 1000;
        this.aimAngle = null; this.volley = 0;
        this.speedY = stats.speed; this.scoreVal = isBoss ? 200+Math.min(wave,30)*12 : stats.score; this.color = stats.color;
    }
    update(dt) {
        this.hitFlash=Math.max(0,this.hitFlash-dt);
        if(this.entryDelay>0){this.entryDelay=Math.max(0,this.entryDelay-dt);return;}
        this.time += dt / 1000;
        if(this.isInvader)return;
        if(this.isBoss&&this.phase===1&&this.hp<=this.maxHp*.5){
            this.phase=2;this.fireDelay=this.commander.fireDelay*.85*getDifficulty(Game.difficulty).fireDelay;this.fireTimer=1600;
            Game.bullets.forEach(b=>{if(b.owner==='enemy')b.active=false;});
            Game.missiles.forEach(m=>{if(m.owner==='enemy')m.active=false;});
            Game.rings.push(new ShockRing(this.x,this.y,160,'#ff6685',800));
            Game.announce('COMMAND CORE EXPOSED','PHASE 2 · WATCH THE GAPS','#ff8aab',2400);
        }
        if (this.isBoss) {
            this.y = Math.min(Math.min(130, HEIGHT * 0.22), this.y + 2);
            // Hold position while the gold firing warning charges. This gives
            // smaller early builds an opening to land shots before dodging.
            this.patrolTime=(this.patrolTime||0)+(this.fireTimer>450?dt/1000:0);
            this.x = WIDTH/2 + Math.sin(this.patrolTime * 0.55) * Math.max(0, WIDTH/2 - this.radius - 30);
        } else {
            this.retreatSpeed=Game.shopPhase==='clearing'?Math.min(Math.max(4,this.speedY),(this.retreatSpeed??this.speedY)+dt*.004):this.speedY;
            this.y += this.retreatSpeed;
            if (this.type === 'INTERMEDIATE') this.x += Math.sin(this.time * 3) * 2;
            if (this.type === 'ADVANCED') this.x += Math.sign(Game.player.x - this.x) * 0.6;
            if (this.type === 'INTERCEPTOR') this.x += Math.sin(this.time * 7) * 4;
            if (this.type === 'STRAFER') this.x += Math.cos(this.time*1.8)*3;
            if (this.type === 'LANCER') this.x += Math.sign(Game.player.x-this.x)*.4;
            this.x = Math.max(this.radius, Math.min(WIDTH - this.radius, this.x));
        }
        if (this.y >= this.radius) this.fireTimer -= dt;
        const aimed=this.isBoss?this.volley%2===0:['ADVANCED','INTERCEPTOR','LANCER'].includes(this.type);
        if (aimed && this.y >= this.radius && this.fireTimer <= 450 && this.aimAngle === null) {
            this.aimAngle = Math.atan2(Game.player.y - this.y, Game.player.x - this.x);
        }
        if (this.fireTimer <= 0 && this.y >= this.radius && this.y < HEIGHT - 40) {
            this.fireWeapon(); this.aimAngle = null; this.fireTimer = this.fireDelay * (0.9 + Math.random() * 0.2);
        }
        if (!this.isBoss && this.y > HEIGHT + this.radius) this.active = false;
    }
    fireWeapon() {
        AudioEngine.playShoot('enemy'); const by = this.y + this.radius;
        const aim=this.aimAngle??Math.atan2(Game.player.y-this.y,Game.player.x-this.x);
        if(this.isBoss){this.fireCommanderWeapon();return;}
        if (this.type === 'BASIC') { Game.bullets.push(new Bullet(this.x, by, 0, 5, this.damage, 'enemy')); }
        else if (this.type === 'INTERMEDIATE') { for(const offset of [-10,10])Game.bullets.push(new Bullet(this.x+offset,by,0,5.5,this.damage,'enemy')); }
        else if (this.type === 'CORVETTE') { Game.bullets.push(new Bullet(this.x, by, 2, 7, this.damage, 'enemy', 'cyan')); Game.bullets.push(new Bullet(this.x, by, -2, 7, this.damage, 'enemy', 'cyan')); }
        else if (this.type === 'ADVANCED') { for(let i=-1;i<=1;i++){const angle=aim+i*.3;Game.bullets.push(new Bullet(this.x,by,Math.cos(angle)*5.5,Math.sin(angle)*5.5,this.damage,'enemy','purple'));} }
        else if (this.type === 'BOMBER') { for(let i=-2; i<=2; i++) Game.bullets.push(new Bullet(this.x, by, i*2, 4, this.damage, 'enemy', 'green')); }
        else if (this.type === 'DESTROYER') { const centre=Math.PI/2+Math.sin(this.time)*.2;for(let i=-3;i<=3;i++){const a=centre+i*.24;Game.bullets.push(new Bullet(this.x,by,Math.cos(a)*4.5,Math.sin(a)*4.5,this.damage,'enemy','orange'));} }
        else if (this.type === 'INTERCEPTOR') { const aim=this.aimAngle??Math.atan2(Game.player.y-this.y,Game.player.x-this.x);Game.bullets.push(new Bullet(this.x,by,Math.cos(aim)*6.5,Math.sin(aim)*6.5,this.damage,'enemy','cyan')); }
        else if (this.type === 'FRIGATE') { Game.missiles.push(new Missile(this.x, by, null, this.damage, 'enemy')); }
        else if (this.type === 'DREADNOUGHT') { for(let i=0; i<8; i++) { let ang = (i/8) * Math.PI * 2 + this.time; Game.bullets.push(new Bullet(this.x, this.y, Math.cos(ang)*4, Math.sin(ang)*4 + 2, this.damage, 'enemy', 'white')); } }
        else if (this.type === 'STRAFER') {for(const x of [-18,18])Game.bullets.push(new Bullet(this.x+x,by,Math.sin(this.time)*1.8,5.5,this.damage,'enemy'));}
        else if (this.type === 'LANCER') {for(const speed of [4.5,6,7.5])Game.bullets.push(new Bullet(this.x,by,Math.cos(aim)*speed,Math.sin(aim)*speed,this.damage,'enemy'));}
        else if (this.type === 'CARRIER') {if(this.volley++%2===0)for(const x of [-30,30])Game.missiles.push(new Missile(this.x+x,by,null,this.damage,'enemy'));else for(let i=-2;i<=2;i++)Game.bullets.push(new Bullet(this.x,by,i*1.8,4.5,this.damage,'enemy'));}
    }
    fireCommanderWeapon() {
        const volley=this.volley++,phase=this.phase===2?1:0,pattern=this.commander.pattern;
        const fan=(angle,count,spacing,speed)=>{for(let i=-count;i<=count;i++){const a=angle+i*spacing;Game.bullets.push(new Bullet(this.x,this.y,Math.cos(a)*speed,Math.sin(a)*speed,this.damage,'enemy'));}};
        if(volley%2===0){fan(this.aimAngle??Math.atan2(Game.player.y-this.y,Game.player.x-this.x),pattern==='crown'?3+phase:2+phase,.22,5);return;}
        if(pattern==='missiles'){
            for(const x of [-this.radius*.65,this.radius*.65])Game.missiles.push(new Missile(this.x+x,this.y+this.radius,null,this.damage,'enemy'));
            if(phase)fan(Math.PI/2,2,.35,4);return;
        }
        if(pattern==='crossfire'){fan(Math.PI/2-.55,1+phase,.25,5.5);fan(Math.PI/2+.55,1+phase,.25,5.5);return;}
        if(pattern==='fan'){fan(Math.PI/2,3+phase,.25,4.5);return;}
        const count=pattern==='crown'?12+phase*4:pattern==='spiral'?10+phase*2:8+phase*2;
        for(let i=0;i<count;i++){const a=i/count*Math.PI*2+volley*.33;Game.bullets.push(new Bullet(this.x,this.y,Math.cos(a)*3.7,Math.sin(a)*3.7+.8,this.damage,'enemy'));}
    }
    takeDamage(amt) { if (!this.active) return; this.hitFlash=90;this.hp -= amt; if (this.hp <= 0) { this.active = false; this.explode(); } }
    explode() {
        Game.registerKill(this);Game.rings.push(new ShockRing(this.x,this.y,this.isBoss?135:Math.max(24,this.radius),this.color,400));
        AudioEngine.playExplosion(); createParticles(this.x, this.y, this.color, this.isBoss?35:15);
        Game.drops.push(new Coin(this.x, this.y, this.scoreVal));
        Game.lastEnemyExplosion={x:this.x,y:this.y,color:this.color,radius:this.radius};
        if(Game.active&&Game.wave===WAVE_COUNT&&Game.shopPhase==='boss'&&Game.enemies.includes(this)&&!Game.enemies.some(enemy=>enemy.active))Game.completeWave();
    }
    draw() { drawEnemy(CTX,this,Game.profile.settings.reducedMotion); }

}

class LootCrate {
    constructor() { this.x = Math.random() * (WIDTH - 60) + 30; this.y = -50; this.size = 25; this.active = true; this.hp = 1; this.vy = 1.5; this.lootRoll = Math.random(); }
    get isCoinCache() { return this.lootRoll < GAME_CONFIG.LOOT_CHANCES.COIN_JACKPOT; }
    update(dt) { this.y += this.vy; if(this.y > HEIGHT + 50) this.active = false; }
    takeDamage(amt) { if (!this.active) return; this.hp -= amt; if(this.hp <= 0) { this.active = false; this.breakOpen(); } }
    breakOpen() {
        AudioEngine.playCrateBreak(); createParticles(this.x, this.y, this.isCoinCache ? '#ffd45e' : '#ffffff', 20);
        if(this.isCoinCache) {
            createFloatingText(this.x, this.y - 30, 'COIN CACHE', '#ffd45e');
            for(let i=0; i<GAME_CONFIG.LOOT_DETAILS.COIN_CACHE_COUNT; i++) {
                Game.drops.push(new Coin(this.x + (Math.random()*40-20), this.y, GAME_CONFIG.LOOT_DETAILS.COIN_CACHE_VALUE));
            }
        } else if(this.lootRoll < GAME_CONFIG.LOOT_CHANCES.COIN_JACKPOT + GAME_CONFIG.LOOT_CHANCES.SUPPORT_ITEM) {
            Game.drops.push(new Powerup(this.x, this.y, DROPS_SUPPORT[Math.floor(Math.random()*DROPS_SUPPORT.length)]));
        } else {
            Game.drops.push(new Powerup(this.x, this.y, DROPS_BUFFS[Math.floor(Math.random()*DROPS_BUFFS.length)]));
        }
    }
    draw() {
        const gold=this.isCoinCache;
        CTX.save(); CTX.translate(this.x, this.y); CTX.shadowBlur = 12; CTX.shadowColor = gold ? '#ffd45e' : '#ffffff'; CTX.strokeStyle = CTX.shadowColor; CTX.lineWidth = 2;
        CTX.fillStyle = gold ? '#38270d' : '#172232'; CTX.fillRect(-this.size/2, -this.size/2, this.size, this.size); CTX.strokeRect(-this.size/2, -this.size/2, this.size, this.size);
        CTX.beginPath(); CTX.moveTo(-this.size/2, -7); CTX.lineTo(this.size/2, -7); CTX.stroke();
        CTX.fillStyle = gold ? '#ffe89a' : '#ffffff'; CTX.font = 'bold 16px monospace'; CTX.textAlign = 'center'; CTX.fillText(gold ? '$' : '+', 0, 8); CTX.restore();
    }
}

class Bullet {
    constructor(x, y, vx, vy, damage, owner, extra1=0, extra2=false) {
        this.x = x; this.y = y; this.damage = damage * (owner==='enemy'?ENEMY_PROJECTILE_DAMAGE_MULTIPLIER:1); this.owner = owner; this.active = true;
        this.vy = vy;
        
        if (owner === 'player') {
            this.vx = vx + (extra1 * 5);
            this.isPlasma = extra2;
            this.radius = this.isPlasma ? 8 : 4;
            this.color = this.isPlasma ? '#00ccff' : '#00f3ff';
        } else {
            const speed=getDifficulty(Game.difficulty).shotSpeed;this.vx = vx*speed;this.vy=vy*speed;
            this.isPlasma = false;
            this.radius = 5;
            this.color = GAME_CONFIG.ENEMY_PLASMA_COLOR;
        }
    }
    update() { this.x += this.vx; this.y += this.vy; if (this.y < -50 || this.y > HEIGHT + 50 || this.x < -50 || this.x > WIDTH + 50) this.active = false; }
    draw() {
        CTX.save();CTX.lineCap='round';CTX.shadowBlur=6;CTX.shadowColor=this.color;
        if(this.owner==='player'){CTX.strokeStyle=this.color;CTX.lineWidth=this.kind==='mega'?this.radius*1.5:this.isPlasma?6:3;CTX.beginPath();CTX.moveTo(this.x-this.vx*.65,this.y-this.vy*.65);CTX.lineTo(this.x,this.y);CTX.stroke();}
        else{
            CTX.translate(this.x,this.y);CTX.rotate(Math.atan2(this.vy,this.vx));
            CTX.fillStyle=this.color;CTX.strokeStyle='#b8d6ff';CTX.lineWidth=1.2;
            CTX.beginPath();CTX.moveTo(8,0);CTX.lineTo(0,-4.5);CTX.lineTo(-7,0);CTX.lineTo(0,4.5);CTX.closePath();CTX.fill();CTX.stroke();
            CTX.strokeStyle='#deefff';CTX.lineWidth=1.5;CTX.beginPath();CTX.moveTo(-3,0);CTX.lineTo(3,0);CTX.stroke();
        }
        CTX.restore();
    }
}

class Coin {
    constructor(x, y, val) {
        this.x = x; this.y = y; this.value = val; this.vx = (Math.random() - 0.5) * 4; this.vy = 2 + Math.random(); this.active = true; this.radius = 8; this.gravity = 0.15;
    }
    update() {
        if (Game.player && Game.player.magnetRange > 0) {
            const dx = Game.player.x - this.x; const dy = Game.player.y - this.y; const dist = Math.hypot(dx, dy);
            if (dist > 0 && dist < Game.player.magnetRange) { const pull = (GAME_CONFIG.MAGNET.PULL_STRENGTH / (dist * 0.05 + 1)); this.vx += (dx / dist) * pull; this.vy += (dy / dist) * pull; }
        }
        this.x += this.vx; this.y += this.vy; this.vx *= 0.9; if (this.vy < 3) this.vy += this.gravity; if (this.y > HEIGHT + 20) this.active = false;
    }
    collect() { if (!this.active) return; this.active = false; const credit=Math.max(1,Math.round(this.value*COIN_VALUE));Game.coins += credit; Game.stats.creditsEarned+=credit; AudioEngine.playCoin(); createFloatingText(this.x, this.y, `+${credit}`, '#ffff00'); }
    draw() { CTX.save(); CTX.translate(this.x, this.y); CTX.shadowBlur = 8; CTX.shadowColor = '#ffff00'; CTX.fillStyle = '#ffff00'; CTX.beginPath(); CTX.arc(0,0, 6, 0, Math.PI*2); CTX.fill(); CTX.strokeStyle = '#fff'; CTX.lineWidth = 1; CTX.stroke(); CTX.fillStyle = '#000'; CTX.font = '8px monospace'; CTX.textAlign='center'; CTX.fillText("$", 0, 3); CTX.restore(); }
}

class Powerup {
    constructor(x, y, config) { 
        this.x = x; this.y = y; 
        this.config = config || DEFAULT_DROP; 
        this.vy = 1; this.active = true; this.radius = 12; this.vx = 0; 
    }
    update() { 
        if (Game.player && Game.player.magnetRange > 0) {
            const dx = Game.player.x - this.x; const dy = Game.player.y - this.y; const dist = Math.hypot(dx, dy);
            if (dist > 0 && dist < Game.player.magnetRange) { 
                const pull = (GAME_CONFIG.MAGNET.PULL_STRENGTH / (dist * 0.05 + 1)) * GAME_CONFIG.MAGNET.BONUS_ITEM_PULL_FACTOR; 
                this.vx += (dx / dist) * pull; this.vy += (dy / dist) * pull; 
            }
        }
        this.x += this.vx; this.y += this.vy; if (this.y > HEIGHT + 20) this.active = false; 
    }
    collect() {
        if (!this.active) return;
        this.active = false; AudioEngine.playPowerup();
        if (this.config.type === 'battery') { Game.player.regenShield = Game.player.maxRegenShield; createFloatingText(this.x, this.y, "SYSTEM RECHARGED", "#00ff00"); }
        else if (this.config.type === 'overshield') { Game.player.tempShield = Math.min(100, Game.player.tempShield + GAME_CONFIG.LOOT_DETAILS.OVERSHIELD_AMOUNT); createFloatingText(this.x, this.y, `OVERSHIELD +${GAME_CONFIG.LOOT_DETAILS.OVERSHIELD_AMOUNT}`, "#ffffff"); }
        else if (this.config.type.startsWith('buff_')) {
            Game.player.buffs[this.config.type] = GAME_CONFIG.LOOT_DETAILS.BUFF_DURATION_MS;
            createFloatingText(this.x, this.y, this.config.label, this.config.color);
        }
    }
    draw() {
        CTX.save(); CTX.translate(this.x, this.y);
        
        if (this.config.type === 'battery') {
            CTX.shadowBlur = 5; CTX.shadowColor = '#00ff00';
            CTX.fillStyle = '#333'; CTX.fillRect(-6, -8, 12, 16);
            CTX.fillStyle = '#00ff00'; CTX.fillRect(-4, -4, 8, 10); 
            CTX.fillStyle = '#aaa'; CTX.fillRect(-3, -10, 6, 2); 
        }
        else {
            CTX.shadowBlur = 8; CTX.shadowColor = this.config.color; CTX.strokeStyle = this.config.color; CTX.lineWidth = 2;
            CTX.strokeRect(-8, -8, 16, 16); CTX.fillStyle = '#fff'; CTX.font = '9px monospace'; CTX.textAlign = 'center';
            let lbl = this.config.type.replace('buff_', '').substring(0,3).toUpperCase();
            if(this.config.label === 'OVERSHIELD') lbl = 'SHD';
            CTX.fillText(lbl, 0, 3);
        }
        CTX.restore();
    }
}

class Particle {
    constructor(x, y, color) { this.x = x; this.y = y; this.vx = (effectsRandom() - 0.5) * 8; this.vy = (effectsRandom() - 0.5) * 8; this.life = 1.0; this.color = color; this.active = true; }
    update() { this.x += this.vx; this.y += this.vy; this.life -= 0.03; if(this.life <= 0) this.active = false; }
    draw() { CTX.globalAlpha = this.life; CTX.fillStyle = this.color; CTX.fillRect(this.x, this.y, 3, 3); CTX.globalAlpha = 1; }
}

function createParticles(x, y, color, count) { if(Game.profile.settings.reducedMotion)count=Math.min(2,count);else if(Game.touchMode)count=Math.min(6,count);for(let i=0; i<count&&Game.particles.length<(Game.touchMode?200:450); i++) Game.particles.push(new Particle(x, y, color)); }
class FloatingLabel {
    constructor(x,y,text,color){this.x=x;this.y=y;this.text=text;this.color=color;this.life=850;this.active=true;}
    update(dt){this.life-=dt;if(!Game.profile.settings.reducedMotion)this.y-=.35;this.active=this.life>0;}
    draw(){CTX.save();CTX.globalAlpha=Math.min(1,this.life/220);CTX.font='bold 13px monospace';CTX.textAlign='center';CTX.lineWidth=3;CTX.strokeStyle='#030a13';CTX.strokeText(this.text,this.x,this.y);CTX.fillStyle=this.color;CTX.fillText(this.text,this.x,this.y);CTX.restore();}
}
class ShockRing {
    constructor(x,y,radius,color,duration){this.x=x;this.y=y;this.radius=radius;this.color=color;this.duration=duration;this.life=duration;this.active=true;}
    update(dt){this.life-=dt;this.active=this.life>0;}
    draw(){const t=1-this.life/this.duration;CTX.save();CTX.globalAlpha=(1-t)*.8;CTX.strokeStyle=this.color;CTX.lineWidth=(1-t)*5+1;CTX.beginPath();CTX.arc(this.x,this.y,this.radius*(Game.profile.settings.reducedMotion ? .65 : t),0,Math.PI*2);CTX.stroke();CTX.restore();}
}
function createFloatingText(x,y,text,color){if(Game.labels.length<60)Game.labels.push(new FloatingLabel(x,y,text,color));}

function dist(x1, y1, x2, y2) { return Math.hypot(x2-x1, y2-y1); }

async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen?.();}catch{}}

Game.init();

// Preserve the original HTML onclick handlers after moving the code into a module.
Object.assign(window,{buyRepair,closeShop,startGame,continueEndless,toggleFullscreen,endMission:()=>Game.gameOver(false),togglePause:()=>Game.togglePause(),dash:()=>Game.player?.dash(),usePulse:()=>Game.usePulse(),
    cancelSalvage,confirmSalvage,closeEquipment,changeShopPage:direction=>Game.changeShopPage(direction),dock:()=>Game.openShop(),
    launchCluster:()=>Game.player?.launchCluster(),selectShopTab:tab=>Game.selectShopTab(tab),setPreference:(key,value)=>Game.setPreference(key,value),selectDifficulty:key=>Game.selectDifficulty(key),resumeRun:()=>Game.resumeRun(),returnToTitle:()=>Game.toHangar(),
    startPractice:()=>Game.startPractice(),setPracticeWave:value=>Game.setPracticeWave(Number(value)),setPracticeLoadout:value=>Game.setPracticeLoadout(value)});

// Development fixtures exercise the actual engine and DOM, without a separate demo renderer.

// END GAME RUNTIME
for(const node of scope.root.querySelectorAll('[data-inline-0]'))node.addEventListener('click',function(event){window.dock()});
for(const node of scope.root.querySelectorAll('[data-inline-1]'))node.addEventListener('click',function(event){window.dash()});
for(const node of scope.root.querySelectorAll('[data-inline-2]'))node.addEventListener('click',function(event){window.usePulse()});
for(const node of scope.root.querySelectorAll('[data-inline-3]'))node.addEventListener('click',function(event){window.launchCluster()});
for(const node of scope.root.querySelectorAll('[data-inline-4]'))node.addEventListener('click',function(event){window.togglePause()});
for(const node of scope.root.querySelectorAll('[data-inline-5]'))node.addEventListener('click',function(event){window.selectDifficulty('chill')});
for(const node of scope.root.querySelectorAll('[data-inline-6]'))node.addEventListener('click',function(event){window.selectDifficulty('arcade')});
for(const node of scope.root.querySelectorAll('[data-inline-7]'))node.addEventListener('click',function(event){window.selectDifficulty('veteran')});
for(const node of scope.root.querySelectorAll('[data-inline-8]'))node.addEventListener('click',function(event){window.resumeRun()});
for(const node of scope.root.querySelectorAll('[data-inline-9]'))node.addEventListener('click',function(event){window.startGame()});
for(const node of scope.root.querySelectorAll('[data-inline-10]'))node.addEventListener('change',function(event){window.setPracticeWave(this.value)});
for(const node of scope.root.querySelectorAll('[data-inline-11]'))node.addEventListener('change',function(event){window.setPracticeLoadout(this.value)});
for(const node of scope.root.querySelectorAll('[data-inline-12]'))node.addEventListener('click',function(event){window.startPractice()});
for(const node of scope.root.querySelectorAll('[data-inline-13]'))node.addEventListener('change',function(event){window.setPreference('autoFire',this.checked)});
for(const node of scope.root.querySelectorAll('[data-inline-14]'))node.addEventListener('change',function(event){window.setPreference('reducedMotion',this.checked)});
for(const node of scope.root.querySelectorAll('[data-inline-15]'))node.addEventListener('change',function(event){window.setPreference('shake',this.checked)});
for(const node of scope.root.querySelectorAll('[data-inline-16]'))node.addEventListener('change',function(event){window.setPreference('muted',this.checked)});
for(const node of scope.root.querySelectorAll('[data-inline-17]'))node.addEventListener('click',function(event){window.toggleFullscreen()});
for(const node of scope.root.querySelectorAll('[data-inline-18]'))node.addEventListener('click',function(event){window.buyRepair()});
for(const node of scope.root.querySelectorAll('[data-inline-19]'))node.addEventListener('click',function(event){window.selectShopTab('weapons')});
for(const node of scope.root.querySelectorAll('[data-inline-20]'))node.addEventListener('click',function(event){window.selectShopTab('ordnance')});
for(const node of scope.root.querySelectorAll('[data-inline-21]'))node.addEventListener('click',function(event){window.selectShopTab('systems')});
for(const node of scope.root.querySelectorAll('[data-inline-22]'))node.addEventListener('click',function(event){window.changeShopPage(-1)});
for(const node of scope.root.querySelectorAll('[data-inline-23]'))node.addEventListener('click',function(event){window.changeShopPage(1)});
for(const node of scope.root.querySelectorAll('[data-inline-24]'))node.addEventListener('click',function(event){window.returnToTitle()});
for(const node of scope.root.querySelectorAll('[data-inline-25]'))node.addEventListener('click',function(event){window.closeShop()});
for(const node of scope.root.querySelectorAll('[data-inline-26]'))node.addEventListener('click',function(event){window.continueEndless()});
for(const node of scope.root.querySelectorAll('[data-inline-27]'))node.addEventListener('click',function(event){window.startGame()});
for(const node of scope.root.querySelectorAll('[data-inline-28]'))node.addEventListener('click',function(event){window.returnToTitle()});
for(const node of scope.root.querySelectorAll('[data-inline-29]'))node.addEventListener('click',function(event){window.togglePause()});
for(const node of scope.root.querySelectorAll('[data-inline-30]'))node.addEventListener('input',function(event){window.setPreference('music',this.value/100)});
for(const node of scope.root.querySelectorAll('[data-inline-31]'))node.addEventListener('input',function(event){window.setPreference('sfx',this.value/100)});
for(const node of scope.root.querySelectorAll('[data-inline-32]'))node.addEventListener('change',function(event){window.setPreference('autoFire',this.checked)});
for(const node of scope.root.querySelectorAll('[data-inline-33]'))node.addEventListener('change',function(event){window.setPreference('reducedMotion',this.checked)});
for(const node of scope.root.querySelectorAll('[data-inline-34]'))node.addEventListener('change',function(event){window.setPreference('shake',this.checked)});
for(const node of scope.root.querySelectorAll('[data-inline-35]'))node.addEventListener('change',function(event){window.setPreference('muted',this.checked)});
for(const node of scope.root.querySelectorAll('[data-inline-36]'))node.addEventListener('click',function(event){window.setPreference('autoFire',!document.querySelector('[data-preference=autoFire]').checked)});
for(const node of scope.root.querySelectorAll('[data-inline-37]'))node.addEventListener('click',function(event){window.setPreference('muted',!document.querySelector('[data-preference=muted]').checked)});
for(const node of scope.root.querySelectorAll('[data-inline-38]'))node.addEventListener('click',function(event){window.toggleFullscreen()});
for(const node of scope.root.querySelectorAll('[data-inline-39]'))node.addEventListener('click',function(event){window.togglePause()});
for(const node of scope.root.querySelectorAll('[data-inline-40]'))node.addEventListener('click',function(event){window.returnToTitle()});
for(const node of scope.root.querySelectorAll('[data-inline-41]'))node.addEventListener('click',function(event){window.endMission()});
for(const node of scope.root.querySelectorAll('[data-inline-42]'))node.addEventListener('cancel',function(event){event.preventDefault();window.closeEquipment()});
for(const node of scope.root.querySelectorAll('[data-inline-43]'))node.addEventListener('click',function(event){window.closeEquipment()});
for(const node of scope.root.querySelectorAll('[data-inline-44]'))node.addEventListener('cancel',function(event){event.preventDefault();window.cancelSalvage()});
for(const node of scope.root.querySelectorAll('[data-inline-45]'))node.addEventListener('click',function(event){window.cancelSalvage()});
for(const node of scope.root.querySelectorAll('[data-inline-46]'))node.addEventListener('click',function(event){window.confirmSalvage()});
return {pause:()=>{Game.pauseForFocus();Game.clearKeys();AudioEngine.stopMusic();AudioEngine.victorySound?.stop();},running:()=>Game.active&&!Game.paused,resize:()=>Game.resize(),resetClock:()=>{Game.lastTime=performance.now();Game.accumulator=0;}};
}
