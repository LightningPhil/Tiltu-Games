import {Game,MODES,cells,type Mode} from './game.ts';
import {Audio} from './audio.ts';
import {TRACKS,type MusicTrack} from './music.ts';
import {saveRecord,type Settings} from './storage.ts';
import {newBlocks,type BlocksSession} from './session.ts';
import {Handling,type InputAction} from './handling.ts';
import {draw,preview,type Visuals} from './render.ts';
import {readArcadePalette,type ArcadePalette} from '../action-renderer.ts';
import type {SavedState} from '../state.ts';
import './style.css';

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const number=(n:number)=>Math.floor(n).toLocaleString();
const time=(ms:number)=>{const cs=Math.floor(Math.max(0,ms)/10);return `${Math.floor(cs/6000)}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`;};
const button=(action:string,label:string,extra='')=>`<button type="button" data-action-arcade="${action}" ${extra}>${label}</button>`;
const keys:Record<string,InputAction>={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowDown:'soft',KeyS:'soft',ArrowUp:'cw',KeyW:'cw',KeyX:'cw',KeyZ:'ccw',Space:'hard',KeyC:'hold',ShiftLeft:'hold',ShiftRight:'hold'};
type Panel='settings'|'help'|'records'|'confirm'|null;

export class TetriGridController {
  private active=false;private engine:Game|null=null;private bound:BlocksSession|null=null;
  private canvas:HTMLCanvasElement|null=null;private palette:ArcadePalette|null=null;
  private frame=0;private last=0;private hudClock=0;private saveClock=0;private countdown=0;private lastCount=0;
  private panel:Panel=null;private resultBest=false;private seen=0;
  private flash=0;private flashRows:number[]=[];private drop:Visuals['drop']=null;private message='';private messageClock=0;
  private audio:Audio;private input:Handling;
  private pointerButtons=new Map<number,HTMLButtonElement>();
  constructor(private root:HTMLElement,private state:SavedState,private changed:()=>void,private saveOnly:()=>void){
    this.audio=new Audio(state.actionArcade.blocksSettings);this.audio.onChange=()=>this.updateAudio();
    this.input=new Handling(action=>this.apply(action));
    window.addEventListener('keyup',e=>this.input.release(e.code));
    window.addEventListener('blur',()=>{if(this.active)this.pause();});
    window.addEventListener('pagehide',()=>{if(this.active){this.sync();this.saveOnly();}});
    document.addEventListener('visibilitychange',()=>{if(this.active&&document.hidden)this.pause();});
    root.addEventListener('pointerdown',e=>{
      if(!this.active||!this.playing||e.button!==0)return;
      const control=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-action-hold]');
      if(!control||control.disabled)return;e.preventDefault();control.setPointerCapture(e.pointerId);control.classList.add('pressed');this.pointerButtons.set(e.pointerId,control);this.input.press('pointer-'+e.pointerId,control.dataset.actionHold as InputAction);
    });
    const release=(e:PointerEvent)=>{this.input.release('pointer-'+e.pointerId);this.pointerButtons.get(e.pointerId)?.classList.remove('pressed');this.pointerButtons.delete(e.pointerId);};
    window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);root.addEventListener('lostpointercapture',release);
    root.addEventListener('input',e=>{
      const el=e.target;if(!this.active||!(el instanceof HTMLInputElement)||!el.dataset.tgVolume)return;
      const key=el.dataset.tgVolume as 'volume'|'musicVolume'|'effectsVolume';this.prefs[key]=Math.max(0,Math.min(1,Number(el.value)));this.audio.applySettings();this.updateAudio();this.saveOnly();
    });
  }
  private get store(){return this.state.actionArcade;}
  private get prefs(){return this.store.blocksSettings;}
  private get session(){return this.store.blocks!;}
  private get game(){return this.engine!;}
  private get playing(){return this.active&&this.session.phase==='playing'&&!this.session.paused&&!this.panel&&this.countdown<=0;}
  ensure(){
    this.store.blocks??=newBlocks(this.prefs.mode);const session=this.session;
    if(this.bound!==session){this.engine=Game.restore(session.run,session.ended);if(!this.engine){this.store.blocks=newBlocks(this.prefs.mode);this.engine=Game.restore(this.session.run)!;}this.bound=this.session;this.seen=this.game.eventId;this.resultBest=false;}
    this.active=true;this.input.preset=this.prefs.handling;
  }
  private clear(){this.input.clear();this.pointerButtons.clear();this.root.querySelectorAll('.tg-page .pressed').forEach(el=>el.classList.remove('pressed'));}
  private sync(){if(!this.engine||!this.bound)return;this.bound.run=this.engine.snapshot();this.bound.elapsed=this.engine.elapsed/1000;this.bound.ended=this.engine.ended;}
  private checkpoint(){this.sync();this.saveOnly();this.saveClock=0;}
  leave(){if(this.active){this.session.paused=true;this.sync();}this.active=false;this.countdown=0;this.panel=null;this.clear();this.audio.music(false);this.audio.stopPreview();cancelAnimationFrame(this.frame);this.canvas=null;}
  mount(){
    this.ensure();cancelAnimationFrame(this.frame);this.canvas=this.root.querySelector('#action-canvas');this.palette=readArcadePalette();this.last=performance.now();this.hudClock=0;this.paint(1);this.updateHud();this.frame=requestAnimationFrame(t=>this.tick(t));
  }
  private paint(dt:number){if(this.canvas&&this.palette)this.canvas.dataset.phase=this.countdown>0?'countdown':this.session.phase; if(this.canvas&&this.palette)draw(this.canvas,this.game,this.palette,{flash:this.flash,rows:this.flashRows,drop:this.drop,motion:this.prefs.effects,ghost:this.prefs.ghost,dt});}
  private tick(now:number){
    if(!this.active)return;const dt=Math.min(100,Math.max(0,now-this.last));this.last=now;
    if(this.countdown>0){
      this.countdown=Math.max(0,this.countdown-dt);const count=Math.ceil(this.countdown/600);if(count!==this.lastCount){this.lastCount=count;const el=this.root.querySelector('#tg-countdown');if(el)el.textContent=String(Math.max(1,count));}
      if(!this.countdown){this.session.paused=false;this.session.phase='playing';this.audio.music(true);this.audio.sfx('start');this.changed();this.canvas?.focus({preventScroll:true});return;}
    }else if(this.playing){this.input.tick(dt);this.game.tick(dt);this.events();if(this.game.ended)return;this.saveClock+=dt;if(this.saveClock>=1500)this.checkpoint();}
    this.flash=Math.max(0,this.flash-dt/1000);this.messageClock=Math.max(0,this.messageClock-dt/1000);if(this.drop){this.drop.clock-=dt/1000;if(this.drop.clock<=0)this.drop=null;}
    this.paint(dt/1000);this.hudClock+=dt;if(this.hudClock>=75){this.hudClock=0;this.updateHud();}this.frame=requestAnimationFrame(t=>this.tick(t));
  }
  private events(){
    const g=this.game,event=g.event;
    if(event&&event.id!==this.seen){this.seen=event.id;if(event.label){this.audio.sfx('clear');this.flash=.5;this.flashRows=event.rows;this.message=`${event.label} · +${number(event.points)}${event.b2b?' · back-to-back':''}${event.combo>0?` · combo ${event.combo}`:''}`;this.messageClock=3;}this.checkpoint();}
    if(g.ended&&!['over','won'].includes(this.session.phase)){
      this.session.phase=g.ended==='complete'?'won':'over';this.session.paused=true;this.clear();this.audio.music(false);
      if(!this.session.resultRecorded){const result=saveRecord(this.store.blocksRecords,g);this.store.blocksRecords=result.records;this.resultBest=result.best;this.session.resultRecorded=true;}
      this.sync();this.changed();
    }
  }
  private apply(action:InputAction){
    if(!this.playing)return;const g=this.game;
    if(action==='left'||action==='right'){if(g.move(action==='left'?-1:1))this.audio.sfx('move');}
    if(action==='cw'||action==='ccw'){if(g.rotate(action==='cw'?1:-1))this.audio.sfx('rotate');}
    if(action==='soft')g.down(true);
    if(action==='hold'&&g.hold()){this.audio.sfx('hold');this.checkpoint();}
    if(action==='hard'){this.drop={points:cells(g.active),distance:g.ghostY()-g.active.y,clock:.17};g.hardDrop();this.audio.sfx('drop');}
    this.events();this.sync();this.updateHud();
  }
  private pause(){
    this.clear();this.audio.music(false);this.audio.stopPreview();const was=this.countdown>0;this.countdown=0;
    if(!this.active)return;if(!this.session.paused||was){this.session.paused=true;this.checkpoint();this.changed();}
  }
  private start(){
    if(this.game.ended||this.panel||document.hidden)return;this.clear();this.audio.stopPreview();void this.audio.init();this.session.paused=true;this.session.phase='playing';this.countdown=1800;this.lastCount=3;this.changed();this.canvas?.focus({preventScroll:true});
  }
  private replace(){
    this.clear();this.audio.reset();this.store.blocks=newBlocks(this.prefs.mode);this.bound=null;this.panel=null;this.countdown=0;this.flash=0;this.drop=null;this.messageClock=0;this.ensure();this.changed();this.start();
  }
  action(action:string){
    if(!this.active)return;
    if(action==='play'){this.start();return;}
    if(action==='pause'){if(this.playing||this.countdown>0)this.pause();else if(!this.panel)this.start();return;}
    if(action==='new'){this.pause();this.audio.stopPreview();if(!this.game.ended&&(this.game.pieces||this.game.elapsed)){this.panel='confirm';this.changed();}else this.replace();return;}
    if(action==='confirm-new'){this.replace();return;}
    if(action==='cancel-new'){this.panel=null;this.changed();return;}
    if(['settings','help','records'].includes(action)){this.pause();this.panel=action as Panel;this.changed();return;}
    if(action.startsWith('close-')){this.audio.stopPreview();this.panel=null;this.changed();return;}
    if(action.startsWith('mode-')){const mode=action.slice(5) as Mode;if(Object.hasOwn(MODES,mode)){const ask=!this.panel&&!this.game.ended&&this.session.phase!=='ready'&&mode!==this.game.mode; if(ask)this.pause();this.prefs.mode=mode;if(this.session.phase==='ready'){this.store.blocks=newBlocks(mode);this.bound=null;this.ensure();}else if(ask)this.panel='confirm';this.checkpoint();this.changed();}return;}
    if(action==='music'){this.prefs.music=!this.prefs.music;this.audio.applySettings();this.checkpoint();this.updateAudio();return;}
    if(action==='preview'){this.audio.preview();return;}
    if(['ghost','effects','sound'].includes(action)){const key=action as 'ghost'|'effects'|'sound';this.prefs[key]=!this.prefs[key];this.audio.applySettings();this.checkpoint();this.changed();return;}
    if(action==='finish-zen'&&this.game.mode==='zen'&&!this.game.ended){this.pause();this.game.ended='complete';this.events();return;}
    if(['rotate','counterrotate','drop','reserve'].includes(action))this.apply(({rotate:'cw',counterrotate:'ccw',drop:'hard',reserve:'hold'} as const)[action as 'rotate']);
  }
  setting(id:string,value:string){
    if(id==='action-tg-mode'&&Object.hasOwn(MODES,value)){this.action('mode-'+value);return;}
    if(id==='action-tg-handling'&&['relaxed','balanced','fast'].includes(value)){this.prefs.handling=value as Settings['handling'];this.input.preset=this.prefs.handling;this.clear();}
    if(id==='action-tg-track'&&Object.hasOwn(TRACKS,value)){this.prefs.musicTrack=value as MusicTrack;this.audio.applySettings();this.updateAudio();}
    this.checkpoint();
  }
  tapHold(action:string){this.apply((action==='down'?'soft':action) as InputAction);}
  keydown(e:KeyboardEvent){
    if(!this.active||e.ctrlKey||e.metaKey||e.altKey||(e.target as HTMLElement).closest('input,select,textarea'))return;
    if((e.target as HTMLElement).closest('button')&&['Space','Enter'].includes(e.code))return;
    if(!keys[e.code]&&!['KeyP','Escape','KeyR','Enter'].includes(e.code))return;e.preventDefault();if(e.repeat)return;
    if(e.code==='Escape'){if(this.panel)this.action('close-panel');else this.action('pause');return;}
    if(e.code==='KeyP'||e.code==='Enter'){this.action('pause');return;}
    if(e.code==='KeyR'){this.action('new');return;}
    if(this.playing)this.input.press(e.code,keys[e.code]);
  }
  private updateAudio(){
    if(!this.active)return;const track=TRACKS[this.prefs.musicTrack],set=(id:string,text:string)=>{const el=this.root.querySelector('#'+id);if(el)el.textContent=text;};
    set('tg-track-name',track.name);set('tg-track-description',track.description);
    set('tg-audio-status',this.audio.status==='unavailable'?'Audio could not start. Try Preview again.':this.audio.previewing?`Preview playing · ${track.bpm} BPM · eight bars`:this.audio.status==='starting'?'Starting audio…':`${track.bpm} BPM · ${this.prefs.music?'Music starts after the countdown':'Music muted during play'}`);
    const music=this.root.querySelector<HTMLButtonElement>('[data-action-arcade="music"]');if(music){music.textContent=`♫ ${this.prefs.music?'On':'Off'}`;music.setAttribute('aria-pressed',String(this.prefs.music));music.setAttribute('aria-label',`${this.prefs.music?'Mute':'Enable'} music`);}
    const audition=this.root.querySelector<HTMLButtonElement>('[data-action-arcade="preview"]');if(audition){audition.textContent=this.audio.previewing||this.audio.status==='starting'?'Stop preview':'Preview track';audition.setAttribute('aria-pressed',String(this.audio.previewing));}
    for(const key of ['volume','musicVolume','effectsVolume'] as const)set('tg-'+key,`${Math.round(this.prefs[key]*100)}%`);
  }
  private updateHud(){
    if(!this.active||!this.engine)return;const g=this.game;
    const set=(id:string,text:string)=>{const el=this.root.querySelector('#'+id);if(el&&el.textContent!==text)el.textContent=text;};
    set('action-score',number(g.score));set('action-progress',g.mode==='sprint'?`${g.lines} / 40`:String(g.lines));set('tg-level',String(g.level));set('action-time',time(g.mode==='ultra'?120000-g.elapsed:g.elapsed));set('tg-pps',g.elapsed?`${(g.pieces/(g.elapsed/1000)).toFixed(2)}`:'0.00');
    set('action-notice',this.messageClock>0?this.message:this.countdown>0?'Find your rhythm.':this.playing?g.mode==='zen'?'Zen · no gravity, no automatic lock. Space places your piece.':'← → move · ↑ / X rotate · Z turn back · Space drop · C / Shift hold':MODES[g.mode].goal);
    const next=this.root.querySelector('#action-next'),hold=this.root.querySelector<HTMLButtonElement>('#action-reserve'),signature=g.queue.slice(0,5).join('');
    if(next&&next.getAttribute('data-queue')!==signature){next.innerHTML=g.queue.slice(0,5).map((t,i)=>`<div class="tg-queue-piece" aria-label="Next ${i+1}: ${t}"><span>${i+1}</span>${preview(t)}</div>`).join('');next.setAttribute('data-queue',signature);}
    if(hold){if(hold.getAttribute('data-piece')!==String(g.held)){hold.innerHTML=preview(g.held);hold.setAttribute('data-piece',String(g.held));}hold.disabled=!this.playing||!g.canHold;hold.setAttribute('aria-label',g.held?`Hold ${g.held} piece${g.canHold?'':', available after next drop'}`:'Hold current piece, C or Shift');}
    for(const b of this.root.querySelectorAll<HTMLButtonElement>('.tg-touch button'))b.disabled=!this.playing;
    set('tg-hold-hint',g.canHold?'C / Shift':'After next drop');
    const pause=this.root.querySelector<HTMLButtonElement>('[data-action-arcade="pause"]');if(pause){pause.textContent=this.playing||this.countdown>0?'Pause · P':'Resume · P';pause.disabled=this.session.phase==='ready'||!!g.ended||!!this.panel;}
    this.updateAudio();
  }
  private modeOptions(){return (Object.entries(MODES) as [Mode,typeof MODES[Mode]][]).map(([mode,info])=>`<option value="${mode}" ${this.prefs.mode===mode?'selected':''}>${info.name} · ${mode==='marathon'?'endless':mode==='sprint'?'40 lines':mode==='ultra'?'2 minutes':'no gravity'}</option>`).join('');}
  private records(){const list=this.store.blocksRecords[this.prefs.mode]??[];return list.length?`<ol class="tg-records">${list.map(r=>`<li><strong>${this.prefs.mode==='sprint'?time(r.elapsed):number(r.score)}</strong><span>${r.lines} lines · ${time(r.elapsed)}</span></li>`).join('')}</ol>`:'<p class="tg-empty-records">A fresh start. Your best five runs will appear here.</p>';}
  private overlay(){
    const g=this.game;
    if(this.panel==='settings')return `<section class="action-settings tg-settings" aria-label="TetriGrid settings"><div class="action-panel-heading"><h2>Make it yours</h2>${button('close-settings','Done')}</div><div class="tg-settings-grid"><section><h3>Play your way</h3><label>Next run<select id="action-tg-mode">${this.modeOptions()}</select></label><label>Movement<select id="action-tg-handling">${(['relaxed','balanced','fast'] as const).map((p,i)=>`<option value="${p}" ${this.prefs.handling===p?'selected':''}>${['Relaxed · 190 / 65 ms','Balanced · 150 / 40 ms','Fast · 100 / 20 ms'][i]}</option>`).join('')}</select></label><div class="tg-preferences">${(['ghost','effects','sound'] as const).map((key,i)=>button(key,`${['Landing guide','Visual effects','Sound effects'][i]} <strong>${this.prefs[key]?'On':'Off'}</strong>`,`aria-pressed="${this.prefs[key]}"`)).join('')}</div><p>Modes apply to your next run. Your current board stays saved until you choose New run.</p></section><section><h3>The soundtrack</h3><label>Five locally synthesized mixes<select id="action-tg-track">${(Object.entries(TRACKS) as [MusicTrack,typeof TRACKS[MusicTrack]][]).map(([id,t])=>`<option value="${id}" ${this.prefs.musicTrack===id?'selected':''}>${t.name}${id==='classic-house'?' — Original':''} · ${t.bpm} BPM</option>`).join('')}</select></label><p id="tg-track-description">${esc(TRACKS[this.prefs.musicTrack].description)}</p>${button('preview','Preview track','aria-pressed="false"')}<p id="tg-audio-status" role="status"></p>${(['volume','musicVolume','effectsVolume'] as const).map((key,i)=>`<label>${['Master volume','Music volume','Effects volume'][i]}<output id="tg-${key}">${Math.round(this.prefs[key]*100)}%</output><input type="range" min="0" max="1" step=".01" value="${this.prefs[key]}" data-tg-volume="${key}" aria-label="${['Master','Music','Effects'][i]} volume"/></label>`).join('')}</section></div></section>`;
    if(this.panel==='help')return `<section class="action-settings tg-help" aria-label="How to play"><div class="action-panel-heading"><h2>A place for every piece</h2>${button('close-help','Done')}</div><p>Complete a horizontal line to clear it. The seven tetrominoes arrive in shuffled bags: each piece appears once before the next bag. Use the dotted landing guide to see exactly where a hard drop will land.</p><dl><dt>Move / soft drop</dt><dd>← → ↓ or A D S. Soft drop earns 1 point per cell.</dd><dt>Rotate</dt><dd>↑ / W / X clockwise · Z anticlockwise. Rotation kicks can shift a piece around a wall or the floor when there is room.</dd><dt>Drop / hold</dt><dd>Space places the piece immediately, earning 2 points per cell. C / Shift swaps hold once per placed piece.</dd><dt>Pause / restart</dt><dd>P / Escape pauses. R asks before replacing your run. Leaving the tab pauses automatically.</dd></dl><p><strong>Scoring:</strong> 100 / 300 / 500 / 800 × level for 1 / 2 / 3 / 4 lines. Consecutive clears earn combos; quads and T-spin clears earn a back-to-back bonus. An empty board adds 2,000 × level.</p><p>A T-spin uses three occupied diagonal corners after rotation, with no mini category. Grounded pieces wait 500 ms and allow up to 15 lock resets. Zen locks only when you hard drop. The top two hidden spawn rows must remain clear after a lock.</p><p>Marathon speeds up every 10 lines. Sprint races 40 lines; Ultra lasts two active minutes. Sprint and Ultra stay at level 1. Pauses and countdowns never count toward results.</p></section>`;
    if(this.panel==='records')return `<section class="action-settings tg-record-panel" aria-label="Personal bests"><div class="action-panel-heading"><h2>Your best runs</h2>${button('close-records','Done')}</div><label>Mode<select id="action-tg-mode">${this.modeOptions()}</select></label>${this.prefs.mode==='zen'?'<p>Zen is for practice. Take your time; no leaderboard.</p>':this.records()}<p>Records are saved on this browser. Only completed Sprints enter the time leaderboard.</p></section>`;
    if(this.panel==='confirm')return `<section class="action-overlay"><div><p class="eyebrow">A FRESH BOARD</p><h2>Start a new ${MODES[this.prefs.mode].name} run?</h2><p>This replaces your current board. Your records and settings stay.</p><div class="action-setting-row">${button('cancel-new','Keep this run')}${button('confirm-new','Start new run','class="primary"')}</div></div></section>`;
    if(this.countdown>0)return `<section class="action-overlay tg-countdown"><div><p class="eyebrow">${MODES[g.mode].name}</p><strong id="tg-countdown">${Math.max(1,Math.ceil(this.countdown/600))}</strong><p>Find your rhythm.</p></div></section>`;
    if(this.playing)return '';
    const ready=this.session.phase==='ready',ended=!!g.ended;
    return `<section class="action-overlay tg-cover"><div><p class="eyebrow">${ready?'SEVEN PIECES. ENDLESS POSSIBILITY.':ended?MODES[g.mode].name:'TAKE A BREATHER'}</p><h2>${ready?'Find your next rhythm.':ended?g.mode==='sprint'&&g.ended==='complete'?'40 lines. Beautiful.':g.mode==='zen'?'Nice practice.':g.ended==='complete'?'Time well spent.':'One more good run.':'Game paused.'}</h2>${ready?`<label class="tg-mode-label">Choose your mode<select id="action-tg-mode">${this.modeOptions()}</select></label><p>${MODES[g.mode].description}</p>`:ended?`<strong class="tg-result-value">${g.mode==='sprint'&&g.ended==='complete'?time(g.elapsed):number(g.score)}</strong><p>${this.resultBest?'✦ New personal best · ':''}${g.lines} lines · ${time(g.elapsed)} · ${g.maxCombo} best combo</p>`:'<p>Your board is right where you left it.</p>'}<div class="action-setting-row">${button(ended?'new':'play',ready?'Start run':ended?'Play again':'Resume','class="primary"')}${button('settings','Settings & music')}</div><p class="action-music-copy">${ready?'Seven-bag · five previews · hold · landing guide. ':''}${this.prefs.music?'Classic House and four more mixes await.':'Music is off.'}</p></div></section>`;
  }
  render(){
    this.ensure();this.sync();const g=this.game,stat=(label:string,id:string,value:string)=>`<div><span>${label}</span><strong id="${id}">${value}</strong></div>`;
    return `<main class="action-page blocks-page tg-page"><header class="action-heading"><div><p class="eyebrow">BUILD · CLEAR · FIND YOUR RHYTHM</p><h1 id="page-title" tabindex="-1">TetriGrid</h1></div><span class="action-mode-chip">${MODES[g.mode].name} · ${MODES[g.mode].goal}</span><div class="action-heading-buttons">${button('help','How to play')}${button('settings','Settings','aria-label="TetriGrid settings and music"')}</div></header><section class="action-hud" aria-label="Game status">${stat('Score','action-score',number(g.score))}${stat('Level','tg-level',String(g.level))}${stat(g.mode==='sprint'?'Lines / goal':'Lines','action-progress',g.mode==='sprint'?`${g.lines} / 40`:String(g.lines))}${stat(g.mode==='ultra'?'Time left':'Time','action-time',time(g.mode==='ultra'?120000-g.elapsed:g.elapsed))}</section><div class="action-play-area tg-play-area"><aside class="tg-companion"><section class="tg-modes"><h2>Find your pace</h2>${(Object.entries(MODES) as [Mode,typeof MODES[Mode]][]).map(([mode,info])=>button('mode-'+mode,`<strong>${info.name}</strong><span>${info.tag}</span>`,`aria-pressed="${this.prefs.mode===mode}"`)).join('')}<p>${MODES[this.prefs.mode].description}</p></section><section class="tg-mini-stats"><h2>In the groove</h2><div><span>Pieces / second</span><strong id="tg-pps">0.00</strong></div>${button('records','Your best runs →')}<p id="tg-track-name">${TRACKS[this.prefs.musicTrack].name}</p></section></aside><div class="action-stage tg-stage"><canvas id="action-canvas" tabindex="0" aria-label="TetriGrid 10 by 20 playfield. Arrow keys move and rotate, Space drops, C holds.">This game needs Canvas support.</canvas></div><aside class="action-forms tg-forms" aria-label="Held and upcoming pieces"><section class="tg-hold"><h2>Hold</h2><button id="action-reserve" data-action-hold="hold" aria-label="Hold current piece">${preview(g.held)}</button><p id="tg-hold-hint">C / Shift</p></section><section class="tg-next"><h2>Next five</h2><div id="action-next"></div></section></aside>${this.overlay()}</div><p class="action-notice tg-notice" id="action-notice" role="status" aria-live="polite">${MODES[g.mode].goal}</p><div class="action-controls"><div class="action-run-controls">${button('pause',this.playing?'Pause · P':'Resume · P')}${button('new','New run')}${g.mode==='zen'?button('finish-zen','Finish practice',g.ended?'disabled':''):''}${button('records','Records','class="tg-mobile-records"')}${button('music',`♫ ${this.prefs.music?'On':'Off'}`,`aria-pressed="${this.prefs.music}"`)}</div><div class="action-touch-controls tg-touch" aria-label="Piece controls">${(['left','ccw','cw','right','soft','hard'] as const).map((action,i)=>`<button type="button" data-action-hold="${action}" aria-label="${['Move left','Rotate anticlockwise','Rotate clockwise','Move right','Soft drop','Hard drop'][i]}">${['←','↶','↷','→','↓','Drop'][i]}</button>`).join('')}</div></div></main>`;
  }
}
