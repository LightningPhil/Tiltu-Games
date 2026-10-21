import {SKILL_NAMES} from './skill.ts';
import {panelNavigation} from './arcade-controls.ts';
import {lifeLayout} from './life-layout.ts';
import LifeWorker from './ai-worker.ts?worker&inline';
import { tetraJoinedEdges } from './board-art.ts';
import { digitalGraphic, mineGraphic } from './graphics.ts';
import { drawLifeField } from './life-renderer.ts';
import type { ArcadeGame, Game, SavedState } from './state.ts';
import { flagMine, mineHint, mineNeighbours, mineNumber, newMines, openMine } from './minesweeper.ts';
import type { MineHint } from './minesweeper.ts';
import { advanceLife, editLife, lifeActivity, lifeComputer, lifePattern, LIFE_PATTERNS, newLife, resetLife, resizeLife, saveLifeBookmark, seedLife, stampLife, stepLife, swapLifeBookmark, undoLife, undoLifeReplacement } from './life.ts';
import type { LifeMode, LifeSession } from './life.ts';
import { canMoveTile, explainTetraHint, hintTetra, moveTile, newTetra, sortTetraTray, tetraWon, tileMoveIssue, undoTetra } from './tetravex.ts';
import type { TilePlace } from './tetravex.ts';
import { newSki, SKI_CAPTURE_DURATION, skiDistance, stepSki } from './ski.ts';
import { SkiRenderer } from './ski-renderer.ts';
import { MOTION } from './movement.ts';
export const isArcade = (game: Game): game is ArcadeGame => ['mines', 'life', 'ski', 'tetravex'].includes(game);
const names = { mines: 'Minesweeper', life: 'Conway’s Game of Life', ski: 'Downhill Skiing', tetravex: 'Edge Matching' };
const patternName = (name: string) => ({ rpentomino: 'R-pentomino', gun: 'Glider gun', spaceship: 'Lightweight spaceship', cell: 'Draw / erase cells', pan: 'Pan the world' } as Record<string, string>)[name] ?? name[0].toUpperCase() + name.slice(1);
const option = (value: string | number, label: string, current: string | number) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`;
const place = (value: string): TilePlace | null => { const m = /^(board|tray):(\d+)$/.exec(value); return m ? { area: m[1] as TilePlace['area'], index: Number(m[2]) } : null; };
const time = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
function tileGraphic(n: number, e: number, s: number, w: number, joins = 0): string {
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path class="tile-n tile-face" style="--edge-hue:${['210','0','120','45','275','180','330','90','245','25'][n]}" d="M0 0H100L50 50Z"/><path class="tile-e tile-face" style="--edge-hue:${['210','0','120','45','275','180','330','90','245','25'][e]}" d="M100 0V100L50 50Z"/><path class="tile-s tile-face" style="--edge-hue:${['210','0','120','45','275','180','330','90','245','25'][s]}" d="M0 100H100L50 50Z"/><path class="tile-w tile-face" style="--edge-hue:${['210','0','120','45','275','180','330','90','245','25'][w]}" d="M0 0V100L50 50Z"/><path class="tile-lines" d="M0 0L100 100M100 0L0 100"/><path class="tile-bevel" d="M2 96V2H96M4 4 47 47"/><path class="tile-under-edge" d="M4 98h94V4M53 53l43 43"/><circle class="tile-hub" cx="50" cy="50" r="3"/>${['M7 2H93','M98 7V93','M7 98H93','M2 7V93'].map((d,i)=>joins & 1 << i ? `<path class="tile-joined-edge" d="${d}"/>` : '').join('')}<text x="50" y="24">${n}</text><text x="80" y="56">${e}</text><text x="50" y="88">${s}</text><text x="20" y="56">${w}</text></svg>`;
}
export class ArcadeController {
  private game: ArcadeGame | null = null;
  private lifeWorker:Worker|null=null;
  private lifeRevision=0;
  private raf = 0; private last = 0; private second = 0; private lifeClock = 0;
  private running = false; private thinking = false; private timer: ReturnType<typeof setTimeout> | null = null;
  private flagMode = false; private mineFit = false; private mineFocus = 0; private lifeFocus = 14 * 40 + 20;
  private mineHelp: MineHint | null = null; private mineOpened: number[] = []; private mineOrigin = 0;
  private press: { timer: ReturnType<typeof setTimeout>; x: number; y: number } | null = null; private mineLong: number | null = null;
  private lifeBrush = 'cell'; private lifeColour = 1; private lifeHover: number | null = null; private lifeBefore: number[] = []; private lifePulse = 0;
  private lifeRotation = 0; private lifeMirror = false; private showLifeTrails = false; private lifeTrails: number[] = [];
  private lifeWorlds = new Map<LifeMode, LifeSession>();
  private lifeZoom = 1; private lifePan: { pointer: number; x: number; y: number; left: number; top: number } | null = null;
  private lifeTab=0;
  private paint: { pointer: number; value: number; first: boolean; last: number } | null = null;
  private selected: TilePlace | null = null;
  private tetraLarge = false; private tetraColours = true;
  private tileDrag: { source: TilePlace; pointer: number; x: number; y: number; ghost: HTMLElement | null; el: HTMLElement } | null = null;
  private suppress = 0;
  private held = new Map<number, number>(); private steer = 0; private mouse: number | null = null; private brake = false; private jump = false; private fast = false;
  private skiKeys = new Set<string>(); private skiRenderer = new SkiRenderer(); private skiNotice = ''; private skiNoticeUntil = 0;
  private skiCountdown = 0;
  private skiSetupTab=0;
  private skiControls=new Map<number,HTMLElement>();
  private message = '';
  constructor(private app: HTMLElement, private state: SavedState, private changed: () => void) {
    app.addEventListener('contextmenu', e => { const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-mine]'); if (cell && this.game === 'mines') { e.preventDefault(); if (this.mineLong === Number(cell.dataset.mine)) return; this.mineHelp = null; this.message = ''; this.mineOpened = []; flagMine(this.state.mines!, Number(cell.dataset.mine)); this.changed(); } });
    app.addEventListener('pointerdown', e => this.pointerDown(e));
    app.addEventListener('pointermove', e => this.pointerMove(e));
    app.addEventListener('pointerover', e => { if (this.game === 'mines') this.showMineClue(Number((e.target as HTMLElement).closest<HTMLElement>('[data-mine]')?.dataset.mine ?? -1)); });
    app.addEventListener('focusin', e => { if (this.game === 'mines') this.showMineClue(Number((e.target as HTMLElement).closest<HTMLElement>('[data-mine]')?.dataset.mine ?? -1)); });
    app.addEventListener('pointerup', e => this.pointerUp(e));
    app.addEventListener('pointercancel', event => { if(this.game==='ski')this.releaseSkiControl(event.pointerId);else this.clearPointer(); });
    app.addEventListener('lostpointercapture',event=>{if(this.game==='ski')this.releaseSkiControl((event as PointerEvent).pointerId);});
    app.addEventListener('pointerout', e => { if ((e.target as HTMLElement).id === 'ski-canvas') this.mouse = null; });
    document.addEventListener('keyup', e => { if (this.game === 'ski') { this.skiKeys.delete(this.skiKey(e)); this.steer = Number(this.skiKeys.has('ArrowRight')) - Number(this.skiKeys.has('ArrowLeft')); this.brake = this.skiKeys.has('ArrowUp') || this.skiKeys.has('ArrowDown'); } });
    document.addEventListener('visibilitychange', () => { this.last = 0; if (document.hidden) { if (this.game !== 'life') this.running = false; this.steer = 0; this.brake = false; this.clearSkiControls(); this.skiKeys.clear(); this.clearPointer(); if (this.game) this.changed(); } });
    window.addEventListener('blur', () => { this.steer = 0; this.brake = false; this.clearSkiControls(); this.skiKeys.clear(); this.clearPointer();if(this.game==='ski'&&this.running){this.running=false;this.skiCountdown=0;this.changed();} });
  }
  ensure(game: ArcadeGame): void {
    const p = this.state.preferences;
    if (game === 'mines') this.state.mines ??= newMines(p.mineLevel);
    if (game === 'life') this.state.life ??= newLife(p.lifeMode, p.lifeOpponent);
    if (game === 'tetravex') this.state.tetravex ??= newTetra(p.tetraSize);
    if (game === 'ski') this.state.ski ??= newSki(p.skiMode);
  }
  leave(): void {
    this.skiCountdown = 0;this.cancelLifeTurn();
    cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0; this.running = false; this.thinking = false;
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    this.clearPointer(); this.clearSkiControls();this.game = null; this.skiKeys.clear(); this.steer = 0; this.mouse = null; this.brake = false; this.jump = false; this.lifeClock = 0;
    this.message = ''; this.selected = null; this.mineLong = null;
  }
  mount(game: ArcadeGame): void {
    this.ensure(game); this.game = game;
    if (game === 'life') {this.running = this.state.life!.running;lifeLayout(this.app,this.lifeTab,index=>{this.lifeTab=index;});}
    if(game==='ski'){
      const panel=this.app.querySelector<HTMLElement>('.ski-settings-panel')!,children=[...panel.children],help=children.findIndex(e=>e.tagName==='H2'&&e.textContent==='How to play'),done=children.at(-1)!;
      const host=document.createElement('div');host.id='ski-setup-panels';
      panelNavigation(host,'Ski setup sections',[{name:'Run & steering',elements:children.slice(0,help)},{name:'How to play',elements:children.slice(help,-1)}],this.skiSetupTab,index=>{this.skiSetupTab=index;});
      panel.append(done,host);
    }
    this.app.querySelector<HTMLDetailsElement>('.ski-settings')?.addEventListener('toggle', event => {
      if (this.game === 'ski' && (event.currentTarget as HTMLDetailsElement).open && this.running) {
        this.running = false; this.last = 0; this.skiKeys.clear(); this.clearSkiControls(); this.steer = 0; this.mouse = null; this.brake = false; this.changed();
      }
    });
    this.draw(); if (game === 'mines') this.showMineClue(this.mineFocus); if (!this.raf) this.raf = requestAnimationFrame(t => this.frame(t)); this.scheduleLife();
  }
  setting(id: string, value: string): void {
    if (this.game !== 'life') return;
    const s = this.state.life!;
    if (id === 'life-mode' && s.mode !== value) { this.lifeWorlds.set(s.mode, s); this.leave(); this.state.life = this.lifeWorlds.get(value as LifeMode) ?? newLife(value as LifeMode, this.state.preferences.lifeOpponent); this.lifeBefore = []; this.lifeTrails = []; this.lifeBrush = 'cell'; }
    if(['life-level','life-opponent','life-size'].includes(id))this.cancelLifeTurn();
    if (id === 'life-opponent') s.opponent = value as LifeSession['opponent'];
    if (id === 'life-size') { resizeLife(s, Number(value) as 40 | 80); this.lifeFocus = Math.floor(s.height / 2) * s.width + Math.floor(s.width / 2); this.lifeBefore = []; }
    if (id.startsWith('life-brush')) this.lifeBrush = value;
  }
  private frame(now: number): void {
    this.raf = -1; if (!this.game) { this.raf = 0; return; }
    const dt = this.last ? Math.min(.25, (now - this.last) / 1000) : 0; this.last = now;
    if (!document.hidden) {
      if (this.game === 'ski' && this.running && this.skiCountdown > 0) this.skiCountdown = Math.max(0, this.skiCountdown - dt);
      else if (this.game === 'ski' && this.running) {
        const s = this.state.ski!,steering=[...this.held.values()].filter(n=>Math.abs(n)<=1), steer = steering.length ? steering.reduce((a,b)=>a+b,0) : this.state.preferences.skiInput === 'mouse' && this.mouse !== null ? Math.max(-1, Math.min(1, (this.mouse - s.x) / 70)) : this.steer;
        const before = { tumble: s.tumble, jump: s.jump, gates: s.gates, misses: s.misses, score: s.score, yeti: s.yeti?.phase, status: s.status };
        stepSki(s, { steer, brake: this.brake || [...this.held.values()].includes(2), jump: this.jump, fast: this.fast }, dt); this.jump = false;
        const notice = s.status === 'caught' && before.status !== 'caught' ? 'Yeti lunch. At least the skis are crunchy.' : s.yeti?.phase === 'windup' && before.yeti !== 'windup' ? 'He is about to pounce! Change your line!' : s.yeti?.phase === 'recover' && before.yeti !== 'recover' ? 'Missed! Make your escape!' : !before.yeti && s.yeti ? 'YETI! Fast mode or dodge the leap!' : !before.tumble && s.tumble ? 'Oof! Skis, limbs and snow everywhere.' : before.tumble && !s.tumble ? 'Back on your feet. Point them downhill.' : s.misses > before.misses ? 'Missed gate · +3 seconds' : s.gates > before.gates ? 'Clean gate · +50' : before.jump && !s.jump && !s.crash ? `Landed · +${s.score - before.score}` : !before.jump && s.jump ? s.jumpPeak > 50 ? 'Big air! Carve for trick points.' : 'Airborne · carve for trick points' : '';
        if (notice) { this.skiNotice = notice; this.skiNoticeUntil = now + 2200; }
        if (s.status === 'finished' || s.status === 'caught' && s.captureAge >= SKI_CAPTURE_DURATION) { this.running = false; this.changed(); }
        else if (s.status !== before.status) this.changed();
      }
      if (this.game === 'life' && this.running && this.state.life!.mode !== 'colonies') {
        const s = this.state.life!, generation = s.generation, before = s.cells.slice();
        this.lifeClock = advanceLife(s, dt * 1000, this.state.preferences.lifeSpeed, this.lifeClock);
        if (generation !== s.generation) { this.lifeBefore = before; this.lifePulse = now; this.lifeTrails = s.cells.map((n, i) => before[i] && !n ? 6 : Math.max(0, (this.lifeTrails[i] ?? 0) - (s.generation - generation))); }
      }
      this.second += dt;
      if (this.second >= 1) {
        this.second -= 1;
        if (this.game === 'mines' && this.state.mines!.status === 'playing' && !this.state.mines!.paused) this.state.mines!.elapsed++;
        if (this.game === 'tetravex' && this.state.tetravex!.moves && !tetraWon(this.state.tetravex!)) this.state.tetravex!.elapsed++;
      }
      this.draw(); this.stats();
    }
    this.raf = requestAnimationFrame(t => this.frame(t));
  }
  private stats(): void {
    const update = (key: string, text: string) => { this.app.querySelectorAll(`[data-stat="${key}"]`).forEach(el => { if (el.textContent !== text) { if (key === 'mine-time') { el.innerHTML = digitalGraphic(Number(text)); el.setAttribute('aria-label', `${Number(text)} seconds`); } else el.textContent = text; } }); };
    if (this.game === 'mines') update('mine-time', String(Math.min(999, this.state.mines!.elapsed)).padStart(3, '0'));
    if (this.game === 'tetravex') update('tetra-time', time(this.state.tetravex!.elapsed));
    if (this.game === 'life') { const s = this.state.life!, activity = lifeActivity(s); update('generation', String(s.generation)); update('population', String(s.cells.filter(Boolean).length)); update('births', `+${activity.births} / −${activity.deaths}`); update('life-activity', activity.label); this.app.querySelectorAll<HTMLButtonElement>('[data-arcade="undo"]').forEach(undo => { undo.disabled = !s.history.length; }); }
    if (this.game === 'ski') { const countdown = this.app.querySelector<HTMLElement>('.ski-countdown'); if (countdown) { countdown.hidden = !this.running || this.skiCountdown <= 0; countdown.textContent = String(Math.ceil(this.skiCountdown / .6)); } const s = this.state.ski!; update('ski-distance', `${skiDistance(s)} m`); update('ski-score', String(s.score)); update('ski-time', `${s.elapsed.toFixed(1)} s`); update('ski-fast', this.fast ? 'Fast on' : 'Fast'); update('ski-speed', `${Math.round(s.speed / 3)} m/s`); const gate = s.objects.find(o => o.kind === 'gate' && !o.passed && o.y > s.y); update('ski-guide', s.status === 'finished' ? s.mode === 'slalom' ? `${(s.elapsed + s.misses * 3).toFixed(1)} s final · ${s.gates} clean · ${s.misses} missed` : `${s.score} freestyle points` : s.yeti ? s.yeti.phase === 'windup' ? 'Pounce coming · dodge sideways!' : s.yeti.phase === 'pounce' ? 'INCOMING!' : s.yeti.phase === 'feast' ? 'Yeti snack time' : s.yeti.phase === 'recover' ? 'He missed · get away!' : `Yeti ${Math.max(0, Math.round((s.y - s.yeti.y) / 3))} m behind · F for fast mode!` : s.mode === 'slalom' ? `${s.gates} clean · ${s.misses} missed${gate ? ` · next ${gate.x < s.x - 45 ? '←' : gate.x > s.x + 45 ? '→' : '↓'} ${Math.round((gate.y - s.y) / 3)} m` : ''}` : s.jump ? 'Airborne · carve to score' : this.brake ? 'Braking' : 'Carve between the trees'); update('ski-notice', performance.now() < this.skiNoticeUntil ? this.skiNotice : ''); }
  }
  action(action: string): void {
    const game = this.state.preferences.game; if (!isArcade(game)) return; this.ensure(game);
    if (action === 'setup') { const settings = this.app.querySelector<HTMLDetailsElement>('.ski-settings'); if (settings) settings.open = !settings.open; return; }
    if (action === 'close-setup') {
      const settings = this.app.querySelector<HTMLDetailsElement>('.ski-settings'); settings?.removeAttribute('open');
      const compactToggle = this.app.querySelector<HTMLButtonElement>('.ski-setup-toggle');
      if (compactToggle?.offsetParent) compactToggle.focus(); else settings?.querySelector<HTMLElement>('summary')?.focus();
      return;
    }
    if (action === 'new') {
      if (game === 'ski') this.app.querySelector<HTMLDetailsElement>('.ski-settings')?.removeAttribute('open');
      this.leave(); this.message = ''; this.selected = null; this.second = 0; this.mineHelp = null; this.mineOpened = []; this.skiNotice = ''; this.lifeBefore = [];
      if (game === 'mines') this.state.mines = newMines(this.state.preferences.mineLevel, this.state.mines!.best);
      if (game === 'life') { this.state.life = newLife(this.state.preferences.lifeMode, this.state.preferences.lifeOpponent); this.lifeWorlds.delete(this.state.preferences.lifeMode); }
      if (game === 'tetravex') this.state.tetravex = newTetra(this.state.preferences.tetraSize);
      if (game === 'ski') { this.state.ski = newSki(this.state.preferences.skiMode, this.state.ski!.best); this.fast = false; }
    } else if (game === 'mines') {
      if (action === 'pause' && this.state.mines!.status === 'playing') { this.state.mines!.paused = !this.state.mines!.paused; this.second = 0; this.mineHelp = null; this.mineOpened = []; this.message = ''; this.clearPointer(); }
      if (action === 'flag-mode') { this.flagMode = !this.flagMode; this.message = ''; }
      if (action === 'fit-field') this.mineFit = !this.mineFit;
      if (action === 'hint') { this.message = ''; this.mineHelp = mineHint(this.state.mines!); }
      if (action.startsWith('cell:')) { const at = Number(action.split(':')[1]); if (this.mineLong === at) { this.mineLong = null; return; } this.mineHelp = null; this.mineOpened = []; this.mineFocus = at; this.mineOrigin = at; if (this.state.mines!.status === 'ready') this.second = 0; if (this.flagMode && !this.state.mines!.open[at]) flagMine(this.state.mines!, at); else { const mine = this.state.mines!, around = mineNeighbours(mine, at), number = mine.open[at] ? mineNumber(mine, at) : 0, flags = around.filter(i => mine.flags[i]).length; this.message = number && number !== flags ? `This ${number} needs ${Math.abs(number - flags)} ${flags < number ? 'more' : 'fewer'} adjacent flag${Math.abs(number - flags) === 1 ? '' : 's'} before its neighbours can open. Flags must be correct.` : mine.flags[at] ? 'This square is flagged. Unflag it first to reveal it.' : ''; this.mineOpened = openMine(mine, at); } }
    } else if (game === 'life') {
      const s = this.state.life!;
      if(['reset','undo','undo-replacement','swap-snapshot','wrap','step','stamp-centre'].includes(action)||action.startsWith('pattern:'))this.cancelLifeTurn();
      if (['reset', 'undo', 'undo-replacement', 'swap-snapshot'].includes(action) || action.startsWith('pattern:')) this.lifeTrails = [];
      if (action === 'run' && s.mode !== 'colonies') { s.running = !s.running; this.running = s.running; this.lifeClock = 0; }
      if (action === 'zoom') { this.lifeZoom = this.lifeZoom === 3 ? 1 : this.lifeZoom + 1; if (this.lifeZoom > 1) this.lifeBrush = 'pan'; }
      if (action === 'fit-life') { this.lifeZoom = 1; this.lifeBrush = 'cell'; this.lifePan = null; const stage = this.app.querySelector('.life-stage'); if (stage) { stage.scrollLeft = 0; stage.scrollTop = 0; } }
      if (action === 'life-speed') { const speeds = [1000, 500, 250, 125, 65], i = speeds.indexOf(this.state.preferences.lifeSpeed); this.state.preferences.lifeSpeed = speeds[(i + 1) % speeds.length]; }
      if (action === 'rotate-pattern') this.lifeRotation = (this.lifeRotation + 1) % 4;
      if (action === 'mirror-pattern') this.lifeMirror = !this.lifeMirror;
      if (action === 'trails') this.showLifeTrails = !this.showLifeTrails;
      if (action === 'save-snapshot') { saveLifeBookmark(s); this.message = `Snapshot saved at generation ${s.generation}. Swap with it to compare another experiment.`; }
      if (action === 'swap-snapshot' && swapLifeBookmark(s)) { this.running = false; this.lifeClock = 0; this.lifeBefore = []; this.lifeTrails = []; this.lifeFocus = Math.floor(s.height / 2) * s.width + Math.floor(s.width / 2); this.message = `Snapshot restored at generation ${s.generation}. Your previous world is now the saved snapshot; swap again to return.`; }
      if (action === 'stamp-centre' && LIFE_PATTERNS[this.lifeBrush]) stampLife(s, this.lifeBrush, Math.floor(s.height / 2) * s.width + Math.floor(s.width / 2), this.lifeColour, this.lifeRotation, this.lifeMirror);
      if (action === 'step' && s.mode !== 'colonies') { this.running = s.running = false; this.lifeBefore = s.cells.slice(); stepLife(s); this.lifePulse = performance.now(); }
      if (action === 'reset') { this.running = false; resetLife(s); this.lifeBefore = []; }
      if (action === 'undo') { this.running = s.running = false; undoLife(s); this.lifeBefore = []; }
      if (action === 'undo-replacement') { this.running = s.running = false; undoLifeReplacement(s); this.lifeBefore = []; this.lifeClock = 0; }
      if (action === 'colour') this.lifeColour *= -1;
      if (action === 'wrap') s.wrap = !s.wrap;
      if (action.startsWith('pattern:') && s.mode !== 'colonies') { seedLife(s, action.split(':')[1]); this.lifeBefore = []; }
      if (action === 'end-turn' && s.mode === 'colonies' && !this.thinking && (s.opponent === 'local' || s.turn === 1)) stepLife(s);
    } else if (game === 'ski') {
      const s = this.state.ski!;
      if (action === 'run' && (s.status === 'ready' || s.status === 'skiing' || s.status === 'caught' && s.captureAge < SKI_CAPTURE_DURATION)) { if (s.status === 'ready') s.status = 'skiing'; if (!this.running) this.app.querySelector<HTMLDetailsElement>('.ski-settings')?.removeAttribute('open'); this.running = !this.running; this.last = 0; }
      if (action === 'fast') this.fast = !this.fast;
      if (action === 'run') this.skiCountdown = this.running && s.status === 'skiing' ? 1.8 : 0;
      if(action==='run'){this.clearSkiControls();this.skiKeys.clear();this.steer=0;this.brake=false;this.mouse=null;}
      if (action === 'jump' && this.running && this.skiCountdown <= 0) this.jump = true;
    } else if (game === 'tetravex') {
      if (action === 'tetra-colours') this.tetraColours = !this.tetraColours;
      if (action === 'tile-size') this.tetraLarge = !this.tetraLarge;
      if (action === 'sort-tray') { const before = this.tileRects(), sorted = sortTetraTray(this.state.tetravex!); this.selected = null; this.message = sorted ? 'Tray sorted by top edge, then left edge. Undo restores its previous order.' : 'The tray is already sorted by top edge, then left edge. No move was added.'; this.changed(); if (sorted) this.animateTiles(before); return; }
      if (action === 'return-tile' && this.selected?.area === 'board') { const at = this.state.tetravex!.tray.indexOf(null); if (at >= 0 && this.move(this.selected, { area: 'tray', index: at })) return; }
      if (action === 'undo') { this.message = undoTetra(this.state.tetravex!) ? 'Move taken back.' : 'No moves to undo.'; this.selected = null; }
      if (action === 'deselect') { this.selected = null; this.message = ''; }
      if (action === 'hint') { const before = this.tileRects(),at=this.state.tetravex!.board.indexOf(null),outcome = hintTetra(this.state.tetravex!); this.message = outcome === 'placed' ? explainTetraHint(this.state.tetravex!,at) : outcome === 'blocked' ? 'This arrangement cannot be completed. Undo a placement or return a board tile to the tray.' : outcome === 'budget' ? 'This partial layout needs more searching. Try undoing a placement.' : 'Every edge matches!'; this.selected = null; this.changed(); if (outcome === 'placed') this.animateTiles(before); return; }
      if (action.startsWith('tile:') && performance.now() >= this.suppress) {
        const to = place(action.slice(5)); if (to) { if (this.selected?.area === to.area && this.selected.index === to.index) this.selected = null; else if (this.selected) { const empty = this.state.tetravex![this.selected.area][this.selected.index] === null; if (empty && this.state.tetravex![to.area][to.index] === null) { this.selected = to; this.message = ''; } else if (this.selected.area === 'tray' && to.area === 'tray' && this.state.tetravex!.tray[to.index] !== null) { this.selected = to; this.message = ''; } else { if (this.move(empty ? to : this.selected, empty ? this.selected : to)) return; this.changed(); return; } } else this.selected = to; }
      }
    }
    this.changed();
  }
  private move(from: TilePlace, to: TilePlace, draggedFrom?: DOMRect): boolean {
    const old = this.tileRects();
    if (draggedFrom) old.set(String(this.state.tetravex![from.area][from.index]), draggedFrom);
    if (!moveTile(this.state.tetravex!, from, to)) { this.message = tileMoveIssue(this.state.tetravex!, from, to); return false; }
    this.selected = null; this.message = ''; this.changed();
    this.animateTiles(old);
    return true;
  }
  private tileRects(): Map<string | undefined, DOMRect> { return new Map(Array.from(this.app.querySelectorAll<HTMLElement>('[data-tile-key]'), el => [el.dataset.tileKey, el.getBoundingClientRect()])); }
  private animateTiles(old: Map<string | undefined, DOMRect>): void {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.app.querySelectorAll<HTMLElement>('[data-tile-key]').forEach(el => { const from = old.get(el.dataset.tileKey), to = el.getBoundingClientRect(); if (from) el.animate([{ transform: `translate(${from.x - to.x}px,${from.y - to.y}px)`, zIndex: 20 }, { transform: 'translate(0,0)', zIndex: 20 }], { duration: MOTION[this.state.preferences.motion].travel, easing: 'ease-out' }); });
  }
  private cancelLifeTurn():void {
    this.lifeRevision++;
    this.lifeWorker?.terminate();this.lifeWorker=null;
    if(this.timer)clearTimeout(this.timer);this.timer=null;this.thinking=false;
  }
  private scheduleLife(): void {
    const s = this.state.life;
    if (this.game !== 'life' || !s || s.mode !== 'colonies' || s.opponent !== 'computer' || s.turn !== -1 || s.result !== null || this.thinking) return;
    this.thinking = true;
    const revision=this.lifeRevision,active=()=>this.game==='life'&&this.state.life===s&&this.lifeRevision===revision;
    this.timer=setTimeout(()=>{
      this.timer=null;if(!active())return;
      const level=this.state.preferences.lifeLevel;
      const finish=(next:LifeSession)=>{if(!active())return;this.lifeWorker?.terminate();this.lifeWorker=null;this.state.life=next;this.thinking=false;this.changed();};
      const fallback=()=>{if(active()){lifeComputer(s,level);finish(s);}};
      try{
        this.lifeWorker=new LifeWorker();
        this.lifeWorker.onmessage=e=>{if(!active())return;if(e.data.error)fallback();else finish(e.data.result);};
        this.lifeWorker.onerror=fallback;
        this.lifeWorker.postMessage({type:'life',session:structuredClone(s),level});
      }catch{fallback();}
    },650);
  }
  private showMineClue(at: number): void {
    const s = this.state.mines;
    this.app.querySelectorAll('.mine-neighbour, .mine-active-clue').forEach(el => el.classList.remove('mine-neighbour', 'mine-active-clue'));
    const label = this.app.querySelector('[data-stat="mine-clue"]');
    if (!s || s.paused || at < 0 || !s.open[at] || s.mines.includes(at)) { if (label) label.textContent = s?.paused ? 'Field paused · resume whenever you are ready.' : 'Hover or focus a revealed number to inspect its neighbours.'; return; }
    const neighbours = mineNeighbours(s, at), flagged = neighbours.filter(i => s.flags[i]).length, covered = neighbours.filter(i => !s.open[i] && !s.flags[i]), number = mineNumber(s, at);
    this.app.querySelector(`[data-mine="${at}"]`)?.classList.add('mine-active-clue');
    covered.forEach(i => this.app.querySelector(`[data-mine="${i}"]`)?.classList.add('mine-neighbour'));
    if (label) label.textContent = `Row ${Math.floor(at / s.width) + 1}, column ${at % s.width + 1}: ${number} mines · ${flagged} flags · ${covered.length} covered neighbours${number && number === flagged && covered.length ? ' · click the number to reveal them if your flags are correct' : ''}.`;
  }
  keydown(e: KeyboardEvent): void {
    if (!this.game || e.ctrlKey || e.metaKey || e.altKey) return;
    if(this.game==='life'&&e.key.toLowerCase()==='p'&&!(e.target as HTMLElement).closest('input,select,textarea')){e.preventDefault();if(!e.repeat&&this.state.life!.mode!=='colonies')this.action('run');return;}
    if (this.game === 'tetravex' && e.key.startsWith('Arrow')) {
      const from = place((e.target as HTMLElement).dataset.tilePlace ?? '');
      if (from) { e.preventDefault(); const size = this.state.tetravex!.size, x = from.index % size, y = Math.floor(from.index / size); let area = from.area, col = Math.max(0, Math.min(size - 1, x + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0))); const row = Math.max(0, Math.min(size - 1, y + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0))); if (e.key === 'ArrowRight' && x === size - 1 && area === 'board') { area = 'tray'; col = 0; } else if (e.key === 'ArrowLeft' && !x && area === 'tray') { area = 'board'; col = size - 1; } this.app.querySelector<HTMLElement>(`[data-tile-place="${area}:${row * size + col}"]`)?.focus(); return; }
    }
    if (this.game === 'mines' && e.key.toLowerCase() === 'p' && !e.repeat) { e.preventDefault(); this.action('pause'); return; }
    if (this.game === 'ski') {
      if((e.target as HTMLElement).closest('input,select,textarea'))return;
      if((e.target as HTMLElement).closest('button')&&['Space','Enter'].includes(e.code))return;
      if (this.app.querySelector<HTMLDetailsElement>('.ski-settings')?.open) { if (e.key === 'Escape') { e.preventDefault(); this.action('close-setup'); } return; }
      const key=this.skiKey(e);
      if (key.startsWith('Arrow') || e.code === 'Space' || ['f','p','Escape','Enter'].includes(key)) e.preventDefault();
      if (key.startsWith('Arrow')) { this.skiKeys.add(key); this.mouse = null; this.steer = Number(this.skiKeys.has('ArrowRight')) - Number(this.skiKeys.has('ArrowLeft')); }
      if (key === 'ArrowUp' || key === 'ArrowDown') this.brake = true;
      if (e.code === 'Space' && !e.repeat) this.action('jump'); if (key==='f' && !e.repeat) this.action('fast'); if (['p','Escape','Enter'].includes(key) && !e.repeat){this.clearSkiControls();this.skiKeys.clear();this.steer=0;this.brake=false;this.action('run');}
    } else if (this.game === 'life' && (e.target as HTMLElement).id === 'life-canvas') {
      const s = this.state.life!, x = this.lifeFocus % s.width, y = Math.floor(this.lifeFocus / s.width);
      if (this.lifeBrush === 'pan' && e.key.startsWith('Arrow')) { e.preventDefault(); this.app.querySelector('.life-stage')?.scrollBy({ left: e.key === 'ArrowLeft' ? -80 : e.key === 'ArrowRight' ? 80 : 0, top: e.key === 'ArrowUp' ? -80 : e.key === 'ArrowDown' ? 80 : 0, behavior: 'smooth' }); return; }
      if (e.key.startsWith('Arrow')) { e.preventDefault(); this.lifeFocus = (Math.max(0, Math.min(s.height - 1, y + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0)))) * s.width + Math.max(0, Math.min(s.width - 1, x + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0))); this.draw(); }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (this.lifeBrush === 'pan') return; if (!this.thinking && (s.mode !== 'colonies' && this.lifeBrush !== 'cell' || !this.running && (s.mode !== 'colonies' || s.opponent === 'local' || s.turn === 1))) { if (s.mode !== 'colonies' && this.lifeBrush !== 'cell') stampLife(s, this.lifeBrush, this.lifeFocus, this.lifeColour, this.lifeRotation, this.lifeMirror); else editLife(s, this.lifeFocus, s.cells[this.lifeFocus] ? 0 : this.lifeColour); this.changed(); } }
      if (s.mode !== 'colonies' && LIFE_PATTERNS[this.lifeBrush] && ['r', 'm'].includes(e.key.toLowerCase())) { e.preventDefault(); this.action(e.key.toLowerCase() === 'r' ? 'rotate-pattern' : 'mirror-pattern'); }
      if (e.key.toLowerCase() === 'p' && s.mode !== 'colonies') { e.preventDefault(); this.action('run'); }
    } else if (this.game === 'tetravex' && e.key === 'Escape') { this.selected = null; this.message = ''; this.changed();
    } else if (this.game === 'mines' && (e.target as HTMLElement).dataset.mine !== undefined) {
      const s = this.state.mines!, at = Number((e.target as HTMLElement).dataset.mine);
      if (e.key.toLowerCase() === 'f') { e.preventDefault(); this.mineHelp = null; this.message = ''; flagMine(s, at); this.changed(); }
      if (e.key.startsWith('Arrow')) { e.preventDefault(); const x = at % s.width, y = Math.floor(at / s.width); this.mineFocus = Math.max(0, Math.min(s.height - 1, y + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0))) * s.width + Math.max(0, Math.min(s.width - 1, x + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0))); this.app.querySelector<HTMLElement>(`[data-mine="${this.mineFocus}"]`)?.focus(); }
    }
  }
  private clearPointer(): void { this.paint = null; this.lifePan = null; if (this.press) clearTimeout(this.press.timer); this.press = null; if (this.tileDrag) { this.tileDrag.ghost?.remove(); this.tileDrag.el.style.visibility = ''; if (this.tileDrag.el.hasPointerCapture(this.tileDrag.pointer)) this.tileDrag.el.releasePointerCapture(this.tileDrag.pointer); } this.tileDrag = null; }
  private paintAt(e: PointerEvent): void {
    const s = this.state.life!, canvas = this.app.querySelector<HTMLCanvasElement>('#life-canvas')!, rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / rect.width * s.width), y = Math.floor((e.clientY - rect.top) / rect.height * s.height);
    if (x < 0 || y < 0 || x >= s.width || y >= s.height || !this.paint) return;
    const at = y * s.width + x; this.lifeFocus = at; if (this.paint.last === at) return;
    let fromX=this.paint.last<0?x:this.paint.last%s.width,fromY=this.paint.last<0?y:Math.floor(this.paint.last/s.width);
    const dx=Math.abs(x-fromX),dy=-Math.abs(y-fromY),sx=fromX<x?1:-1,sy=fromY<y?1:-1;let error=dx+dy;
    while(true){if(editLife(s,fromY*s.width+fromX,this.paint.value,this.paint.first))this.paint.first=false;if(fromX===x&&fromY===y)break;const twice=2*error;if(twice>=dy){error+=dy;fromX+=sx;}if(twice<=dx){error+=dx;fromY+=sy;}}
    this.paint.last = at;
    this.draw(); this.stats();
  }
  private skiKey(event:KeyboardEvent):string{return ({KeyA:'ArrowLeft',KeyD:'ArrowRight',KeyW:'ArrowUp',KeyS:'ArrowDown'} as Record<string,string>)[event.code]??(event.key.length===1?event.key.toLowerCase():event.key);}
  private releaseSkiControl(id:number){const control=this.skiControls.get(id);this.held.delete(id);this.skiControls.delete(id);if(control&&![...this.skiControls.values()].includes(control))control.classList.remove('held');}
  private clearSkiControls(){const controls=[...this.skiControls];this.skiControls.clear();this.held.clear();for(const [id,control] of controls){control.classList.remove('held');if(control.hasPointerCapture(id))control.releasePointerCapture(id);}}
  private pointerDown(e: PointerEvent): void {
    const target = e.target as HTMLElement, control = target.closest<HTMLElement>('[data-ski-control]');
    if(this.game==='life'&&target.id==='life-canvas'&&(this.paint||this.lifePan||e.button>0))return;
    if (control && this.game === 'ski') { if (!this.running||e.button>0) return; const value = control.dataset.skiControl; this.mouse = null; if (value === 'jump') { if (this.skiCountdown <= 0) this.jump = true; } else this.held.set(e.pointerId, value === 'brake' ? 2 : value === 'left' ? -1 : 1);this.skiControls.set(e.pointerId,control);control.classList.add('held'); control.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    const mine = target.closest<HTMLElement>('[data-mine]');
    if (mine && this.game === 'mines' && e.pointerType === 'touch') { this.clearPointer(); this.mineLong = null; const at = Number(mine.dataset.mine); this.press = { x: e.clientX, y: e.clientY, timer: setTimeout(() => { this.press = null; this.mineLong = at; this.mineHelp = null; this.message = ''; this.mineOpened = []; flagMine(this.state.mines!, at); this.changed(); }, 450) }; }
    if (target.id === 'life-canvas' && this.game === 'life' && this.lifeBrush === 'pan') { const stage = target.parentElement!; this.lifePan = { pointer: e.pointerId, x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop }; target.setPointerCapture(e.pointerId); target.focus(); e.preventDefault(); return; }
    if (target.id === 'life-canvas' && this.game === 'life' && this.state.life!.mode !== 'colonies' && this.lifeBrush !== 'cell') {
      const s = this.state.life!, rect = target.getBoundingClientRect(), x = Math.floor((e.clientX - rect.left) / rect.width * s.width), y = Math.floor((e.clientY - rect.top) / rect.height * s.height);
      this.lifeFocus = y * s.width + x; stampLife(s, this.lifeBrush, this.lifeFocus, this.lifeColour, this.lifeRotation, this.lifeMirror); this.lifeBefore = []; e.preventDefault(); this.changed(); return;
    }
    if (target.id === 'life-canvas' && this.game === 'life' && !this.running && !this.thinking) {
      const s = this.state.life!; if (s.mode === 'colonies' && s.opponent === 'computer' && s.turn === -1) return;
      const rect = target.getBoundingClientRect(), at = Math.floor((e.clientY - rect.top) / rect.height * s.height) * s.width + Math.floor((e.clientX - rect.left) / rect.width * s.width);
      this.paint = { pointer: e.pointerId, value: s.cells[at] ? 0 : this.lifeColour, first: true, last: -1 }; target.setPointerCapture(e.pointerId); target.focus(); this.paintAt(e); e.preventDefault();
    }
    const tile = target.closest<HTMLElement>('[data-tile-place]'), source = place(tile?.dataset.tilePlace ?? '');
    if (tile && source && this.game === 'tetravex' && this.state.tetravex![source.area][source.index] !== null && !tetraWon(this.state.tetravex!)) { this.tileDrag = { source, pointer: e.pointerId, x: e.clientX, y: e.clientY, ghost: null, el: tile }; tile.setPointerCapture(e.pointerId); }
  }
  private pointerMove(e: PointerEvent): void {
    if (this.lifePan?.pointer === e.pointerId) { const stage = this.app.querySelector('.life-stage')!; stage.scrollLeft = this.lifePan.left + this.lifePan.x - e.clientX; stage.scrollTop = this.lifePan.top + this.lifePan.y - e.clientY; e.preventDefault(); return; }
    if (this.press && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 7) { clearTimeout(this.press.timer); this.press = null; }
    if ((e.target as HTMLElement).id === 'life-canvas' && this.game === 'life') { const s = this.state.life!, r = (e.target as HTMLElement).getBoundingClientRect(); this.lifeHover = Math.floor((e.clientY - r.top) / r.height * s.height) * s.width + Math.floor((e.clientX - r.left) / r.width * s.width); }
    if ((e.target as HTMLElement).id === 'ski-canvas' && this.game === 'ski' && e.pointerType === 'mouse') { const r = (e.target as HTMLElement).getBoundingClientRect(); this.mouse = (e.clientX - r.left) / r.width * 600; }
    if (this.paint?.pointer === e.pointerId) { this.paintAt(e); e.preventDefault(); }
    const drag = this.tileDrag;
    if (drag && drag.pointer === e.pointerId && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 7) {
      if (!drag.ghost) { const rect = drag.el.getBoundingClientRect(); drag.ghost = drag.el.cloneNode(true) as HTMLElement; drag.ghost.classList.add('tile-ghost'); Object.assign(drag.ghost.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` }); document.body.append(drag.ghost); drag.el.style.visibility = 'hidden'; }
      drag.ghost.style.transform = `translate(${e.clientX - drag.x}px,${e.clientY - drag.y}px)`; e.preventDefault();
    }
  }
  private pointerUp(e: PointerEvent): void {
    if (this.lifePan?.pointer === e.pointerId) this.lifePan = null;
    if (this.press) { clearTimeout(this.press.timer); this.press = null; }
    this.releaseSkiControl(e.pointerId);
    if (this.paint?.pointer === e.pointerId) { this.paint = null; this.changed(); }
    const drag = this.tileDrag;
    if (drag?.pointer === e.pointerId) {
      if (drag.ghost) { const to = place(document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-tile-place]')?.dataset.tilePlace ?? ''), bounds = drag.ghost.getBoundingClientRect(); this.suppress = performance.now() + 200; this.clearPointer(); if (!to || !this.move(drag.source, to, bounds)) this.changed(); e.preventDefault(); } else this.clearPointer();
    }
  }
  render(game: ArcadeGame): string {
    this.ensure(game); const p = this.state.preferences;
    let settings = '', board = '', detail = this.message, title: string = names[game], tag = 'RETRO CLASSIC';
    if (game === 'mines') {
      const s = this.state.mines!, flags = s.flags.filter(Boolean).length, opened = new Set(this.mineOpened); this.mineOpened = [];
      settings = `<label>Field<select id="mine-level">${option('beginner', 'Beginner · 9 × 9 · 10 mines', p.mineLevel)}${option('intermediate', 'Intermediate · 16 × 16 · 40 mines', p.mineLevel)}${option('expert', 'Expert · 30 × 16 · 99 mines', p.mineLevel)}</select></label><button class="button wide ${this.flagMode ? 'selected-toggle' : ''}" data-arcade="flag-mode" aria-pressed="${this.flagMode}">⚑ ${this.flagMode ? 'Flag mode' : 'Reveal mode'}</button><button class="button wide" data-arcade="hint" ${['won', 'lost'].includes(s.status) ? 'disabled' : ''}>Explain a logical next move</button><p class="setting-help">Right-click or press F to flag. On a phone, hold a square to flag, or switch Flag mode. Your first opening and its neighbours are safe.</p><p class="setting-help">Best for this field: ${s.best[s.level] !== undefined ? time(s.best[s.level]!) : '—'}</p>`;
      board = `<div class="arcade-toolbar mine-tools"><button class="button" data-arcade="flag-mode" aria-pressed="${this.flagMode}">⚑ ${this.flagMode ? 'Flagging' : 'Revealing'}</button><button class="button" data-arcade="fit-field" aria-pressed="${this.mineFit}">${this.mineFit ? 'Larger squares' : 'Fit entire field'}</button><button class="button" data-arcade="hint" ${['won', 'lost'].includes(s.status) ? 'disabled' : ''}>Explain a move</button><button class="button" data-arcade="pause" ${s.status !== 'playing' ? 'disabled' : ''}>${s.paused ? '▶ Resume' : 'Ⅱ Pause'}</button><span>${Math.max(0, s.open.length - s.count - s.open.filter((v,i) => v && !s.mines.includes(i)).length)} safe squares left</span></div>${this.mineHelp || this.message ? `<p class="action-feedback" role="status">${this.mineHelp?.reason ?? this.message}</p>` : ''}<div class="retro-window mine-window ${this.mineFit ? 'fit-minefield' : ''}" style="--mine-cols:${s.width}"><div class="retro-titlebar"><strong>Minesweeper</strong></div><div class="mine-dashboard"><span class="digital-counter" role="img" aria-label="Mines minus flags: ${s.count - flags}">${digitalGraphic(s.count - flags)}</span><button class="mine-smiley" data-arcade="new" aria-label="Restart Minesweeper">${mineGraphic(s.status === 'lost' ? 'lost' : s.status === 'won' ? 'won' : 'happy')}</button><span class="digital-counter" data-stat="mine-time" role="img" aria-label="${Math.min(999,s.elapsed)} seconds">${digitalGraphic(Math.min(999, s.elapsed))}</span></div><p class="mine-clue-guide" data-stat="mine-clue">Hover or focus a revealed number to inspect its neighbours.</p><div class="mine-scroll">${s.paused ? '<div class="mine-pause"><h2>Field paused</h2><p>The timer and field are paused.</p><button class="button primary" data-arcade="pause">Resume field</button></div>' : `<div class="mine-board" style="--mine-cols:${s.width};--mine-fit-max:${s.width * 34}px" role="group" aria-label="${s.width} by ${s.height} minefield">${s.open.map((open, i) => {
        const mine = s.mines.includes(i), number = open && !mine ? mineNumber(s, i) : 0, exposed = open || s.status === 'lost' && mine;
        const wrong = s.status === 'lost' && s.flags[i] && !mine;
        const delay = Math.min(450, Math.hypot(i % s.width - this.mineOrigin % s.width, Math.floor(i / s.width) - Math.floor(this.mineOrigin / s.width)) * 25);
        return `<button class="mine-cell ${exposed ? 'mine-open' : ''} ${opened.has(i) ? 'mine-arriving' : ''} ${this.mineHelp?.cells.includes(i) ? `mine-hint mine-hint-${this.mineHelp.kind}` : ''} ${s.exploded === i ? 'mine-exploded' : ''} mine-number-${number}" ${opened.has(i) ? `style="animation-delay:${delay}ms"` : ''} data-mine="${i}" data-arcade="cell:${i}" tabindex="${i === this.mineFocus ? 0 : -1}" aria-label="Row ${Math.floor(i / s.width) + 1}, column ${i % s.width + 1}, ${wrong ? 'incorrect flag on a safe square' : exposed ? mine ? 'mine' : number ? `${number} neighbouring mines` : 'empty' : s.flags[i] ? 'flagged' : 'covered'}${this.mineHelp?.cells.includes(i) ? `, tutor ${this.mineHelp.kind}` : ''}">${wrong ? '×' : exposed ? mine ? mineGraphic('mine') : number || '' : s.flags[i] ? mineGraphic('flag') : ''}</button>`;
      }).join('')}</div>`}</div></div>`;
      title = s.paused ? 'Field paused.' : s.status === 'won' ? 'Field cleared!' : s.status === 'lost' ? 'A mine! Try another field.' : 'Read the neighbours.';
      detail ||= s.paused ? 'The field is covered and its timer is paused. Resume whenever you are ready.' : s.status === 'playing' ? 'A number counts the mines in its eight neighbouring squares. Click an open number to reveal its neighbours when enough flags surround it.' : s.status === 'ready' ? 'Open a square to begin. Your first opening is safe.' : s.status === 'won' ? `Cleared in ${time(s.elapsed)}. Every safe square is open.` : 'The exploded square is marked. Wrong flags show ×.';
      if (this.mineHelp) { title = this.mineHelp.kind === 'safe' ? 'A safe opening to consider.' : this.mineHelp.kind === 'flag' ? 'These squares need flags.' : this.mineHelp.kind === 'conflict' ? 'Check these flags.' : 'Read the clues.'; detail = this.mineHelp.reason; }
    } else if (game === 'life') {
      const s = this.state.life!; tag = s.mode === 'garden' ? 'TWO-COLOUR LIFE · B3 / S23' : s.mode !== 'colonies' ? 'CONWAY · B3 / S23' : 'LIFEGENESIS INSPIRED';
      const activity = lifeActivity(s);
      settings = `<label>Mode<select id="life-mode">${option('sandbox', 'Conway’s Life · continuous simulation', s.mode)}${option('garden', 'Two-colour Life · continuous simulation', s.mode)}${option('colonies', 'Two-Colour Colonies · turn-based colonies', s.mode)}</select></label>${s.mode === 'colonies' ? `<label>Opponent<select id="life-opponent">${option('computer', 'Club computer', s.opponent)}${option('local', 'Two players · same device', s.opponent)}</select></label><label>Computer skill<select id="life-level">${SKILL_NAMES.map((name,i)=>option(i+1,`${i+1} · ${name}`,p.lifeLevel)).join('')}</select></label><p class="setting-help">Higher levels examine more edits, look further ahead and plan edits together.</p>` : `<label>Generation speed<select id="life-speed">${[1000, 500, 250, 125, 65].map(ms => option(ms, `${Math.round(1000 / ms)} generation${ms === 1000 ? '' : 's'} / second`, p.lifeSpeed)).join('')}</select></label><label>World size<select id="life-size">${option(40, '40 × 28 · close-up', s.width)}${option(80, '80 × 56 · more room', s.width)}</select></label><p class="setting-help">Resizing centres the current pattern and resets the generation counter.</p><label>Drawing tool<select id="life-brush">${['cell', 'pan', ...Object.keys(LIFE_PATTERNS)].map(name => option(name, patternName(name), this.lifeBrush)).join('')}</select></label>${s.mode === 'garden' ? `<button class="button wide" data-arcade="colour"><i class="colony-swatch colony-${this.lifeColour === 1 ? 'one' : 'two'}" aria-hidden="true"></i>Plant ${this.lifeColour === 1 ? 'Colony 1' : 'Colony 2'} · switch colour</button>` : ''}<p class="setting-help">Draw or erase cells while paused. Pattern stamps can be planted while Life runs. Zoom and use Pan to explore the world; choose Draw to edit again. P pauses or resumes.</p>`}<button class="button wide" data-arcade="wrap" aria-pressed="${s.wrap}">${s.wrap ? '↔ Wrap-around edges on' : 'Bounded edges'}</button><p class="setting-help">${s.wrap ? 'Patterns leaving one edge reappear at the opposite edge.' : 'Cells outside the world are empty. A travelling pattern can leave the board.'}</p><button class="button wide" data-arcade="reset">Reset seed</button><button class="button wide" data-arcade="undo" ${!s.history.length ? 'disabled' : ''}>↶ Undo generation / edit</button>`;
      board = `<div class="puzzle-stats life-stats"><div><span>Generation</span><strong data-stat="generation">${s.generation}</strong></div><div><span>Population</span><strong data-stat="population">${s.cells.filter(Boolean).length}</strong></div>${s.mode !== 'colonies' ? `<div><span>Births / deaths</span><strong class="life-change" data-stat="births">+${activity.births} / −${activity.deaths}</strong></div>` : `<div class="${s.result === null ? 'colony-active' : ''}"><span>${s.turn === 1 ? 'Colony 1’s turn' : s.opponent === 'computer' ? 'Computer growing…' : 'Colony 2’s turn'}</span><strong>${s.edits}<small> edits left</small></strong></div>`}</div><div class="life-console"><span class="life-run-state ${s.running ? 'is-running' : ''}">${s.mode === 'colonies' ? 'Colony match' : s.running ? '● Running continuously' : 'Ⅱ Paused'}</span><span data-stat="life-activity">${activity.label}</span></div><div class="life-stage"><canvas id="life-canvas" width="800" height="560" style="width:${this.lifeZoom * 100}%" class="${this.lifeBrush === 'pan' ? 'life-pan-tool' : ''}" tabindex="0" aria-label="Life grid. Click or drag to edit while paused. Arrow keys select a cell; Space changes it."></canvas></div><div class="arcade-toolbar">${s.mode !== 'colonies' ? `<label class="life-quick-tool">Tool<select id="life-brush-quick">${['cell', 'pan', ...Object.keys(LIFE_PATTERNS)].map(name => option(name, patternName(name), this.lifeBrush)).join('')}</select></label><button class="button primary" data-arcade="run">${s.running ? 'Pause' : 'Run continuously'}</button><button class="button" data-arcade="step">One generation</button><button class="button" data-arcade="undo" ${!s.history.length ? 'disabled' : ''}>↶ Back</button><button class="button" data-arcade="life-speed">${Math.round(1000 / p.lifeSpeed)} gen/s · speed</button><button class="button" data-arcade="fit-life">Fit world</button>${LIFE_PATTERNS[this.lifeBrush] ? `<button class="button" data-arcade="stamp-centre">Plant ${patternName(this.lifeBrush)} in centre</button>` : ''}<button class="button" data-arcade="zoom">Zoom ${this.lifeZoom}× · change</button>${LIFE_PATTERNS[this.lifeBrush] ? `<button class="button" data-arcade="rotate-pattern">Rotate ${this.lifeRotation * 90}° · R</button><button class="button" data-arcade="mirror-pattern" aria-pressed="${this.lifeMirror}">Mirror · M</button>` : ''}<span>${s.width} × ${s.height} · ${s.wrap ? 'wrap-around' : 'bounded'} world</span>` : `<button class="button primary" data-arcade="end-turn" ${this.thinking || s.result !== null || s.opponent === 'computer' && s.turn === -1 ? 'disabled' : ''}>End turn · evolve</button><span class="colony-legend"><i class="colony-one"></i> Colony 1 ${s.cells.filter(n => n === 1).length} · <i class="colony-two"></i> Colony 2 ${s.cells.filter(n => n === -1).length}</span>`}</div>${s.mode !== 'colonies' ? `<details class="life-experiments" data-remember="life-experiments"><summary>Snapshots & trails${s.bookmark ? ` · saved generation ${s.bookmark.generation}` : ''}</summary><div class="arcade-toolbar"><button class="button" data-arcade="trails" aria-pressed="${this.showLifeTrails}">Trails ${this.showLifeTrails ? 'on' : 'off'}</button><button class="button" data-arcade="save-snapshot">Save snapshot</button><button class="button" data-arcade="swap-snapshot" ${!s.bookmark ? 'disabled' : ''}>Swap snapshot${s.bookmark ? ` · gen ${s.bookmark.generation}` : ''}</button></div><p class="setting-help">Save a world, experiment, then swap between the two. Snapshots keep cells, generation, seed, size and edge behaviour across visits. Swapping pauses Life.</p></details><details class="life-library" data-remember="life-library"><summary>Replace the world with a new pattern</summary><div class="arcade-toolbar">${s.replacement || s.history.some(h => h.seed && !h.seedEdit) ? '<button class="button" data-arcade="undo-replacement">↶ Undo replacement</button>' : ''}${['glider', 'blinker', 'beacon', 'pulsar', 'rpentomino', 'gun', 'random', 'clear'].map(pattern => `<button class="button" data-arcade="pattern:${pattern}">${patternName(pattern)}</button>`).join('')}</div><p class="setting-help">These replace the world. Undo replacement restores the previous world and seed, even after Life advances; Back steps one generation. Use Tool to add a pattern instead. The Run setting is kept.</p></details>` : ''}`;
      title = s.result !== null ? s.result === 0 ? 'Colony match drawn.' : `${s.result === 1 ? 'Colony 1' : 'Colony 2'} wins!` : s.mode !== 'colonies' ? s.running ? 'Life is unfolding.' : 'Plant a little pattern.' : 'Grow your colony.';
      detail ||= s.mode !== 'colonies' ? 'There is no turn limit or automatic stop. Even empty worlds and still lifes keep counting generations until you press Pause. Running resumes when you return to this game or browser tab.' : 'Each turn permits three additions or removals, then one generation. Newborns take the majority colour of their three parents. Remove the other colony, or lead after 200 generations. This is our turn-based two-colony variant of Conway’s automaton.';
    } else if (game === 'ski') {
      const s = this.state.ski!, catching = s.status === 'caught' && s.captureAge < SKI_CAPTURE_DURATION, ended = s.status === 'finished' || s.status === 'caught' && !catching; tag = s.mode === 'free' ? 'FREE SKI · YETI CHASE' : s.mode === 'slalom' ? 'SLALOM · 1,000 M' : 'FREESTYLE · 1,000 M';
      settings = `<label>Run<select id="ski-mode">${option('free', 'Free ski · endless with yeti', p.skiMode)}${option('slalom', 'Slalom · race through gates', p.skiMode)}${option('freestyle', 'Freestyle · jumps and tricks', p.skiMode)}</select></label><p class="setting-help">Steer with ← → or touch buttons. Setup can enable mouse steering. Hold ↑ / ↓ or Brake to stop on snow. Space jumps. F toggles fast mode; P pauses. Keyboard steering takes priority when you press an arrow.</p><button class="button wide" data-arcade="fast" aria-pressed="${this.fast}"><span data-stat="ski-fast">${this.fast ? 'Fast on' : 'Fast'}</span></button><p class="setting-help">Best distance ${s.best.distance} m · freestyle ${s.best.freestyle}. ${s.best.slalom !== null ? `Best slalom ${s.best.slalom.toFixed(1)} s.` : ''}</p>`;
      board = `<div class="puzzle-stats"><div><span>Distance</span><strong data-stat="ski-distance">${skiDistance(s)} m</strong></div><div><span>Score</span><strong data-stat="ski-score">${s.score}</strong></div><div><span>Time</span><strong data-stat="ski-time">${s.elapsed.toFixed(1)} s</strong></div></div><div class="ski-hud"><strong data-stat="ski-speed">${Math.round(s.speed / 3)} m/s</strong><span data-stat="ski-guide">${s.mode === 'slalom' ? `${s.gates} clean · ${s.misses} missed` : 'Carve between the trees'}</span>${!this.running ? `<span class="ski-run-state">${s.status === 'ready' ? 'Ready · press Start' : s.status === 'caught' ? catching ? 'Snack time · paused' : 'The yeti got lunch!' : s.status === 'finished' ? 'Finish line!' : 'Paused'}</span>` : ''}</div><div class="ski-view"><div class="ski-stage" data-ski-state="${!this.running && !ended && s.status !== 'ready' ? 'paused' : s.status}"><canvas id="ski-canvas" width="600" height="500" tabindex="0" aria-label="Ski slope. Arrow keys steer and brake. Space jumps, F changes speed, P pauses."></canvas><div class="ski-countdown" role="status" aria-live="polite" ${!this.running || this.skiCountdown <= 0 ? 'hidden' : ''} aria-label="Get ready">${Math.ceil(this.skiCountdown / .6)}</div><div class="ski-notice" data-stat="ski-notice" aria-live="polite"></div></div></div><div class="ski-controls"><button class="button" data-ski-control="left" ${!this.running ? 'disabled' : ''} aria-label="Steer left">←</button><button class="button" data-ski-control="brake" ${!this.running ? 'disabled' : ''}>Brake</button><button class="button" data-ski-control="jump" ${!this.running ? 'disabled' : ''}>Jump</button><button class="button" data-ski-control="right" ${!this.running ? 'disabled' : ''} aria-label="Steer right">→</button><button class="button ski-fast-toggle" data-arcade="fast" aria-pressed="${this.fast}"><span data-stat="ski-fast">${this.fast ? 'Fast on' : 'Fast'}</span></button><button class="button" data-arcade="${ended ? 'new' : 'run'}">${this.running ? 'Pause' : s.status === 'ready' ? 'Start' : !ended ? 'Resume' : 'New run'}</button></div>`;
      title = s.mode === 'slalom' ? 'Find the racing line.' : s.mode === 'freestyle' ? 'Make the landing count.' : 'Fresh tracks. Keep moving.';
      detail ||= 'Carve fresh tracks, aim at the downhill ramp lip and land your jumps. The yeti arrives after 2,000 metres: watch his wind-up, then dodge the leap or use Fast to outrun him. Slalom adds three seconds for each missed gate.';
    } else {
      const s = this.state.tetravex!; tag = `${s.size} × ${s.size} · MATCH THE EDGES`;
      const selectedPlace = this.selected, fitCount = selectedPlace && s[selectedPlace.area][selectedPlace.index] !== null ? s.board.filter((_, index) => canMoveTile(s, selectedPlace, { area: 'board', index })).length : null;
      settings = `<label>Tile grid<select id="tetra-size">${[2, 3, 4].map(size => option(size, `${size} × ${size}`, p.tetraSize)).join('')}</select></label><button class="button wide" data-arcade="undo" ${!s.history.length ? 'disabled' : ''}>↶ Undo</button><button class="button wide" data-arcade="hint" ${tetraWon(s) ? 'disabled' : ''}>Reveal and explain one tile</button><button class="button wide" data-arcade="deselect" ${!this.selected ? 'disabled' : ''}>Clear selection · Esc</button><p class="setting-help">Select a tile to see matching destinations, or select an empty destination to see which tiles fit. A highlighted fit checks the touching edges; it does not promise a complete solution.</p>`;
      const grid = (area: 'board' | 'tray') => `<div class="tetra-grid" style="--tile-size:${s.size}" role="group" aria-label="${area === 'board' ? 'Target grid' : 'Tile tray'}">${s[area].map((id, index) => { const t = id === null ? null : s.tiles[id], pos = { area, index }, selected = this.selected?.area === area && this.selected.index === index, fits = this.selected && !selected && (s[this.selected.area][this.selected.index] === null ? canMoveTile(s, pos, this.selected) : !(this.selected.area === 'tray' && area === 'tray') && canMoveTile(s, this.selected, pos)); return `<button class="edge-tile ${selected ? 'selected-edge-tile' : ''} ${fits ? 'legal-edge-tile' : ''} ${t ? '' : 'empty-edge-tile'}" data-tile-place="${area}:${index}" ${id !== null ? `data-tile-key="${id}"` : ''} data-arcade="tile:${area}:${index}" aria-pressed="${selected}" aria-label="${area === 'board' ? 'Grid' : 'Tray'} row ${Math.floor(index / s.size) + 1}, column ${index % s.size + 1}${t ? `, top ${t.n}, right ${t.e}, bottom ${t.s}, left ${t.w}` : ', empty'}${fits ? ', fits selection' : ''}">${t ? tileGraphic(t.n, t.e, t.s, t.w, area === 'board' ? tetraJoinedEdges(s, index) : 0) : '<span aria-hidden="true">＋</span>'}</button>`; }).join('')}</div>`;
      board = `<div class="puzzle-stats"><div><span>Time</span><strong data-stat="tetra-time">${time(s.elapsed)}</strong></div><div><span>Placed</span><strong>${s.board.filter(n => n !== null).length}<small> / ${s.size ** 2}</small></strong></div><div><span>Moves / hints</span><strong>${s.moves}<small> / ${s.hints}</small></strong></div></div><div class="arcade-toolbar tetra-tools"><button class="button" data-arcade="tile-size" aria-pressed="${this.tetraLarge}">${this.tetraLarge ? 'See both grids' : 'Larger tiles'}</button><button class="button" data-arcade="undo" ${!s.history.length ? 'disabled' : ''}>↶ Undo</button><button class="button" data-arcade="tetra-colours" aria-pressed="${this.tetraColours}">Edge colours</button><button class="button" data-arcade="hint" ${tetraWon(s) ? 'disabled' : ''}>Reveal 1 tile</button><button class="button" data-arcade="sort-tray" ${tetraWon(s) ? 'disabled' : ''}>Sort tray</button><button class="button" data-arcade="return-tile" ${this.selected?.area !== 'board' || s.board[this.selected.index] === null ? 'disabled' : ''}>Return to tray</button><button class="button" data-arcade="deselect" ${!this.selected ? 'disabled' : ''}>Clear selection</button></div>${this.message ? `<p class="action-feedback" role="status">${this.message}</p>` : ''}<div class="tetra-guide">${this.selected ? fitCount !== null ? `${fitCount} matching board destination${fitCount === 1 ? '' : 's'} · selection outlined` : 'Choose a highlighted tile for this empty position' : 'Select either a tile or a destination to explore the matches'}</div><div class="tetra-tables ${this.tetraLarge ? 'large-tetra-tiles' : ''} ${this.tetraColours ? 'coloured-edges' : ''}"><section><h2>Match here</h2>${grid('board')}</section><section><h2>Your tiles</h2>${grid('tray')}</section></div>${this.selected && s[this.selected.area][this.selected.index] !== null ? (() => { const t = s.tiles[s[this.selected!.area][this.selected!.index]!]; return `<details class="tetra-inspector" data-remember="tetra-inspector"><summary>Inspect selected tile · larger numbers</summary><div class="${this.tetraColours ? 'coloured-edges' : ''}"><div class="edge-tile">${tileGraphic(t.n,t.e,t.s,t.w)}</div><p>Top <b>${t.n}</b><br>Right <b>${t.e}</b><br>Bottom <b>${t.s}</b><br>Left <b>${t.w}</b></p></div></details>`; })() : ''}${tetraWon(s) ? '<button class="button primary wide" data-arcade="new">Next puzzle ↗</button>' : ''}`;
      title = tetraWon(s) ? 'Every edge matches!' : 'Find the fit.'; detail ||= 'Click a tile and its destination, or drag it. Touching numbers must match on every edge. You can swap tiles when both new positions fit.';
    }
    if (game === 'ski') return `<main class="play-page ski-page"><div class="page-heading"><h1 id="page-title" tabindex="-1">Downhill Skiing</h1><span class="chip">${tag}</span><details class="ski-settings"><summary>Setup & help</summary><div class="ski-settings-panel"><h2>Game setup</h2>${settings}<label>Steering<select id="ski-input">${option('keys', 'Arrow keys & touch buttons', p.skiInput)}${option('mouse', 'Follow the mouse pointer', p.skiInput)}</select></label><p class="setting-help">Hold Brake to stop. Release it to ski downhill again. Start and Resume give you a short countdown.</p><button class="button primary wide" id="new-game">New run ↗</button><p class="setting-help">Changed setup applies to a new run. Your other games stay saved.</p><h2>How to play</h2><p class="setting-help">${detail} Free ski is endless; Slalom and Freestyle finish at 1,000 metres. Runs pause when you leave this game or hide the tab.</p><button class="button wide" data-arcade="close-setup">Done</button></div></details></div><section class="arena ski-arena" aria-label="Downhill Skiing play area">${board}</section></main>`;
    return `<main class="play-page arcade-page"><div class="page-heading"><div><p class="eyebrow">SMALL CLASSICS. ROOM TO EXPLORE.</p><h1 id="page-title" tabindex="-1">${names[game]}</h1></div><span class="chip">${tag}</span></div><div class="play-layout"><aside class="sidebar"><section class="settings-card"><p class="eyebrow">MAKE IT YOUR GAME</p><h2>Game setup</h2>${settings}<button class="button primary wide" id="new-game">New ${game === 'tetravex' ? 'puzzle' : game === 'life' ? 'world' : 'field'} ↗</button><p class="setting-help">${game === 'life' ? 'Life settings apply immediately. Mode switches keep each world during this visit.' : 'Changed setup applies to a new game.'} Your other games stay saved.</p></section><details class="rules-card"><summary>How to play <span>＋</span></summary><p>${game === 'mines' ? 'Open every safe square to win. Flags are reminders; flagging alone does not win. Numbers count all eight neighbours. Click a revealed number with the correct number of flags around it to open the other neighbours; wrong flags can explode a mine. Arrow keys move focus, Enter opens, F flags.' : game === 'life' ? 'Conway’s B3/S23 rules update every cell simultaneously. There is no win condition in the sandbox. Bounded edges treat outside cells as empty; wrap-around makes opposite edges neighbours. Colony mode keeps each survivor’s colour and gives births the majority colour. Three edits and one generation make a turn. Colony 1 goes first.'  : 'Four triangles show a tile’s north, east, south and west numbers. Neighbouring edges must match; outer borders have no restrictions. Tiles cannot rotate. Hints solve around your current placements; a locally matching placement can still block a full solution, so use Undo if needed.'}</p></details></aside><section class="arena">${board}<div class="status-card" role="status" aria-live="polite"><span class="status-icon" aria-hidden="true">${game === 'mines' ? '⚑' : '▦'}</span><div><h2>${title}</h2><p>${detail}</p></div></div></section></div></main>`;
  }
  private draw(): void {
    const canvas = this.app.querySelector<HTMLCanvasElement>(this.game === 'life' ? '#life-canvas' : '#ski-canvas');
    if (!canvas || (this.game !== 'life' && this.game !== 'ski')) return;
    const ctx = canvas.getContext('2d')!;
    const style = getComputedStyle(document.documentElement), accent = style.getPropertyValue('--accent').trim(), bg = style.getPropertyValue('--cell').trim(), text = style.getPropertyValue('--text').trim();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.game === 'life') {
      const s = this.state.life!, cw = canvas.width / s.width, ch = canvas.height / s.height;
      const light = ['classic', 'woodland'].includes(document.documentElement.dataset.theme ?? 'tron');
      const first = style.getPropertyValue('--p1').trim(), second = style.getPropertyValue('--p2').trim();
      const pulse = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : Math.min(1, (performance.now() - this.lifePulse) / Math.min(180, this.state.preferences.lifeSpeed * .7));
      drawLifeField(ctx, s, { background: bg, grid: style.getPropertyValue('--line').trim(), accent, first, second, light }, this.lifeBefore, pulse, this.showLifeTrails ? this.lifeTrails : []);
      if (s.mode !== 'colonies' && this.lifeBrush !== 'cell' && this.lifeBrush !== 'pan') {
        const at = this.lifeHover ?? this.lifeFocus, points = lifePattern(this.lifeBrush, this.lifeRotation, this.lifeMirror)!, ox = at % s.width - Math.floor(Math.max(...points.map(p => p[0])) / 2), oy = Math.floor(at / s.width) - Math.floor(Math.max(...points.map(p => p[1])) / 2);
        ctx.fillStyle = s.mode === 'garden' ? this.lifeColour === 1 ? first : second : accent; ctx.globalAlpha = .35;
        points.forEach(([dx, dy]) => { let x = ox + dx, y = oy + dy; if (s.wrap) { x = (x + s.width) % s.width; y = (y + s.height) % s.height; } if (x >= 0 && y >= 0 && x < s.width && y < s.height) ctx.fillRect(x * cw + 1, y * ch + 1, cw - 2, ch - 2); }); ctx.globalAlpha = 1;
      }
      if (document.activeElement === canvas) { ctx.strokeStyle = text; ctx.lineWidth = 3; ctx.strokeRect(this.lifeFocus % s.width * cw + 1, Math.floor(this.lifeFocus / s.width) * ch + 1, cw - 2, ch - 2); }
      canvas.setAttribute('aria-label', `Life grid. Generation ${s.generation}. ${this.lifeBrush === 'pan' ? 'Pan tool. Drag or use arrows to move through the world; P pauses or resumes.' : `Row ${Math.floor(this.lifeFocus / s.width) + 1}, column ${this.lifeFocus % s.width + 1}, ${s.cells[this.lifeFocus] ? 'alive' : 'empty'}. Arrow keys move focus; ${this.lifeBrush === 'cell' ? 'Space edits while paused.' : `Space plants a ${patternName(this.lifeBrush)}.`}`}`);
      return;
    }
    this.skiRenderer.draw(canvas, this.state.ski!, accent, document.documentElement.dataset.theme ?? 'tron', this.brake || [...this.held.values()].includes(2), { snow: style.getPropertyValue('--snow').trim(), shade: style.getPropertyValue('--snow-shade').trim(), deep: style.getPropertyValue('--snow-deep').trim() });
  }
}
