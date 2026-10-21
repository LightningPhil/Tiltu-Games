import {skillChoice,skillIndex,seededRandom} from './skill.ts';
import { isRecord, whole } from './cards.ts';
export type LifeMode = 'sandbox' | 'garden' | 'colonies';
export interface LifeSnapshot { cells: number[]; generation: number; turn: 1 | -1; edits: number; result: 1 | -1 | 0 | null; seed?: number[]; seedEdit?: boolean }
export interface LifeBookmark extends LifeSnapshot { width: number; height: number; wrap: boolean; seed: number[] }
export interface LifeSession extends LifeSnapshot { width: number; height: number; mode: LifeMode; opponent: 'computer' | 'local'; wrap: boolean; running: boolean; seed: number[]; history: LifeSnapshot[]; replacement?: LifeSnapshot; bookmark?: LifeBookmark }
export const LIFE_PATTERNS: Record<string, number[][]> = {
  glider: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
  blinker: [[0, 1], [1, 1], [2, 1]],
  block: [[0, 0], [1, 0], [0, 1], [1, 1]],
  toad: [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1]],
  spaceship: [[1, 0], [4, 0], [0, 1], [0, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3]],
  beacon: [[0, 0], [1, 0], [0, 1], [1, 1], [2, 2], [3, 2], [2, 3], [3, 3]],
  rpentomino: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
  pulsar: [2, 3, 4, 8, 9, 10].flatMap(n => [[n, 0], [n, 5], [n, 7], [n, 12], [0, n], [5, n], [7, n], [12, n]]),
  gun: [[24,0],[22,1],[24,1],[12,2],[13,2],[20,2],[21,2],[34,2],[35,2],[11,3],[15,3],[20,3],[21,3],[34,3],[35,3],[0,4],[1,4],[10,4],[16,4],[20,4],[21,4],[0,5],[1,5],[10,5],[14,5],[16,5],[17,5],[22,5],[24,5],[10,6],[16,6],[24,6],[11,7],[15,7],[12,8],[13,8]],
};
export function newLife(mode: LifeMode = 'sandbox', opponent: LifeSession['opponent'] = 'computer'): LifeSession {
  const s: LifeSession = { width: 40, height: 28, cells: Array(1120).fill(0), seed: [], generation: 0, turn: 1, edits: 3, result: null, mode, opponent, wrap: mode !== 'colonies', running: false, history: [] };
  if (mode === 'sandbox') seedLife(s, 'glider');
  else {
    for (const [cx, colour] of [[10, 1], [29, -1]]) for (const [dx, dy] of LIFE_PATTERNS[mode === 'garden' ? 'rpentomino' : 'beacon']) s.cells[(11 + dy) * s.width + cx + dx] = colour;
    s.seed = s.cells.slice();
  }
  return s;
}
export function lifeNext(cells: readonly number[], width: number, height: number, wrap = false): number[] {
  return cells.map((cell, i) => {
    const x = i % width, y = Math.floor(i / width); let count = 0, colours = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      let nx = x + dx, ny = y + dy;
      if (wrap) { nx = (nx + width) % width; ny = (ny + height) % height; }
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = cells[ny * width + nx]; if (n) { count++; colours += n; }
    }
    return cell ? count === 2 || count === 3 ? cell : 0 : count === 3 ? colours > 0 ? 1 : -1 : 0;
  });
}
function remember(s: LifeSession, seedEdit = false): void { s.history.push({ cells: s.cells.slice(), generation: s.generation, turn: s.turn, edits: s.edits, result: s.result, ...(seedEdit ? { seedEdit: true } : {}) }); if (s.history.length > 80) s.history.shift(); }
export function stepLife(s: LifeSession): boolean {
  if (s.mode === 'colonies' && s.result !== null) return false;
  if (s.mode !== 'colonies') s.result = null;
  remember(s); s.cells = lifeNext(s.cells, s.width, s.height, s.wrap); s.generation++;
  if (s.mode === 'colonies') {
    const blue = s.cells.filter(n => n === 1).length, red = s.cells.filter(n => n === -1).length;
    if (!blue || !red || s.generation >= 200) s.result = blue === red ? 0 : !red || (s.generation >= 200 && blue > red) ? 1 : -1;
    s.turn = s.turn === 1 ? -1 : 1; s.edits = 3;
  }
  return true;
}
/** A simulation keeps its run intent through navigation and visibility changes. */
export function advanceLife(s: LifeSession, elapsed: number, speed: number, clock = 0): number {
  if (s.mode === 'colonies' || !s.running) return 0;
  let remaining = clock + Math.max(0, Math.min(250, elapsed));
  const interval = Math.max(16, speed);
  while (remaining >= interval) { stepLife(s); remaining -= interval; }
  return remaining;
}
export function lifeActivity(s: LifeSession): { births: number; deaths: number; label: string } {
  const previous = s.history.at(-1)?.cells;
  const births = previous ? s.cells.filter((n, i) => n && !previous[i]).length : 0;
  const deaths = previous ? s.cells.filter((n, i) => !n && previous[i]).length : 0;
  const population = s.cells.filter(Boolean).length;
  let label = !population ? 'Empty world · add a pattern to bring it to life' : !previous ? 'Ready to grow' : !births && !deaths ? 'Still life · the population is stable' : `Evolving · ${births} births / ${deaths} deaths`;
  if (population && (births || deaths)) for (let period = 2; period <= Math.min(12, s.history.length); period++) {
    if (s.history[s.history.length - period].cells.every((n, i) => n === s.cells[i])) { label = `Oscillating · repeats every ${period} generations`; break; }
  }
  return { births, deaths, label };
}
export function lifePattern(pattern: string, rotation = 0, mirror = false): number[][] | undefined {
  if (!LIFE_PATTERNS[pattern]) return undefined;
  const points = LIFE_PATTERNS[pattern].map(([px, py]) => { let x = mirror ? -px : px, y = py; for (let n = 0; n < ((rotation % 4) + 4) % 4; n++) [x, y] = [-y, x]; return [x, y]; });
  const minX = Math.min(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1]));
  return points.map(([x, y]) => [x - minX, y - minY]);
}
export function stampLife(s: LifeSession, pattern: string, at: number, colour = 1, rotation = 0, mirror = false): boolean {
  const points = lifePattern(pattern, rotation, mirror);
  if (s.mode === 'colonies' || !points || !whole(at, 0, s.cells.length - 1)) return false;
  const ox = at % s.width - Math.floor(Math.max(...points.map(p => p[0])) / 2), oy = Math.floor(at / s.width) - Math.floor(Math.max(...points.map(p => p[1])) / 2);
  remember(s, s.generation === 0);
  for (const [dx, dy] of points) {
    let x = ox + dx, y = oy + dy;
    if (s.wrap) { x = (x + s.width) % s.width; y = (y + s.height) % s.height; }
    if (x >= 0 && y >= 0 && x < s.width && y < s.height) s.cells[y * s.width + x] = s.mode === 'garden' ? colour === -1 ? -1 : 1 : 1;
  }
  if (!s.generation) s.seed = s.cells.slice();
  return true;
}
export function resizeLife(s: LifeSession, width: 40 | 80): void {
  if (s.mode === 'colonies' || s.width === width) return;
  const height = width === 80 ? 56 : 28, cells = Array(width * height).fill(0);
  const ox = Math.floor((width - s.width) / 2), oy = Math.floor((height - s.height) / 2);
  s.cells.forEach((n, i) => { const x = i % s.width + ox, y = Math.floor(i / s.width) + oy; if (x >= 0 && y >= 0 && x < width && y < height) cells[y * width + x] = n; });
  s.width = width; s.height = height; s.cells = cells; s.seed = cells.slice(); s.history = []; s.generation = 0; delete s.replacement;
}
export function editLife(s: LifeSession, at: number, value?: number, record = true): boolean {
  if (!whole(at, 0, s.cells.length - 1) || s.result !== null || (s.mode === 'colonies' && s.edits === 0)) return false;
  const next = s.mode === 'colonies' ? s.cells[at] ? 0 : s.turn : value ?? (s.cells[at] ? 0 : 1);
  if (next === s.cells[at]) return false;
  if (record) remember(s, s.mode !== 'colonies' && s.generation === 0); s.cells[at] = next;
  if (s.mode === 'colonies') s.edits--;
  if (s.mode !== 'colonies' && s.generation === 0) s.seed = s.cells.slice();
  return true;
}
export function seedLife(s: LifeSession, pattern: string, random = Math.random): void {
  const previous: LifeSnapshot | null = s.seed.length === s.cells.length ? { cells: s.cells.slice(), seed: s.seed.slice(), generation: s.generation, turn: s.turn, edits: s.edits, result: s.result } : null;
  if (previous) s.replacement = previous;
  const history = previous ? [...s.history, previous].slice(-80) : [];
  s.cells.fill(0); s.generation = 0; s.history = history; s.result = null; s.turn = 1; s.edits = 3;
  if (pattern === 'random') s.cells = s.cells.map((_, i) => random() < .22 ? s.mode === 'garden' && i % s.width >= s.width / 2 ? -1 : 1 : 0);
  else if (LIFE_PATTERNS[pattern]) {
    const points = LIFE_PATTERNS[pattern], ox = Math.floor((s.width - Math.max(...points.map(p => p[0])) - 1) / 2), oy = Math.floor((s.height - Math.max(...points.map(p => p[1])) - 1) / 2);
    points.forEach(([x, y]) => { s.cells[(y + oy) * s.width + x + ox] = 1; });
  }
  s.seed = s.cells.slice();
}
export function resetLife(s: LifeSession): void { s.cells = s.seed.slice(); s.generation = 0; s.turn = 1; s.edits = 3; s.result = null; s.history = []; s.running = false; }
export function undoLife(s: LifeSession): boolean {
  let index = s.history.length - 1;
  if (s.mode === 'colonies' && s.opponent === 'computer') { for (; index >= 0; index--) if (s.history[index].turn === 1 && s.history[index].edits === 3) break; }
  if (index < 0) return false;
  const previous = s.history[index]; Object.assign(s, previous); if (previous.seedEdit) s.seed = (previous.seed ?? previous.cells).slice(); else if (previous.seed) delete s.replacement; delete s.seedEdit; s.history.splice(index); return true;
}
export function undoLifeReplacement(s: LifeSession): boolean {
  let index = s.history.length - 1;
  while (index >= 0 && (s.history[index].seed === undefined || s.history[index].seedEdit)) index--;
  const previous = s.replacement ?? (index >= 0 ? s.history[index] : null);
  if (!previous) return false;
  Object.assign(s, previous); s.history.splice(Math.max(0, index)); delete s.replacement; return true;
}
function lifeBookmark(s: LifeSession): LifeBookmark { return { width: s.width, height: s.height, wrap: s.wrap, cells: s.cells.slice(), seed: s.seed.slice(), generation: s.generation, turn: s.turn, edits: s.edits, result: s.result }; }
export function saveLifeBookmark(s: LifeSession): boolean { if (s.mode === 'colonies') return false; s.bookmark = lifeBookmark(s); return true; }
export function swapLifeBookmark(s: LifeSession): boolean {
  if (s.mode === 'colonies' || !s.bookmark) return false;
  const before = lifeBookmark(s), saved = s.bookmark;
  Object.assign(s, saved); s.bookmark = before; s.running = false; s.history = []; delete s.replacement;
  return true;
}
export const LIFE_LEVELS=[{horizon:0,candidates:0},{horizon:1,candidates:24},{horizon:2,candidates:60},{horizon:3,candidates:100},{horizon:5,candidates:160}] as const;
export function chooseLifeEdits(s:LifeSession,level=3,random=seededRandom(s.generation*7919+s.cells.reduce((n,c,i)=>n+c*i,31))):number[]{
 if(s.mode!=='colonies'||s.turn!==-1||s.result!==null)return [];
 const index=skillIndex(level),config=LIFE_LEVELS[index],working=s.cells.slice(),plan:number[]=[];
 const candidates=(cells:number[])=>{const active=new Set<number>();cells.forEach((n,i)=>{if(!n)return;const r=Math.floor(i/s.width),c=i%s.width;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let y=r+dy,x=c+dx;if(s.wrap){y=(y+s.height)%s.height;x=(x+s.width)%s.width;}if(y>=0&&y<s.height&&x>=0&&x<s.width)active.add(y*s.width+x);}});return [...active];};
 const score=(cells:number[])=>{let value=0,next=cells;for(let turn=0;turn<config.horizon;turn++){next=lifeNext(next,s.width,s.height,s.wrap);value+=next.reduce((n,c)=>n-c,0)/(turn+1);}return value;};
 const rank=(cells:number[],limit:number=config.candidates)=>{const choices=candidates(cells);if(choices.length>limit){for(let i=choices.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}choices.length=limit;}return choices.map(at=>{const next=cells.slice();next[at]=next[at]?0:-1;return {at,next,value:score(next)};}).sort((a,b)=>b.value-a.value);};
 for(let edit=0;edit<s.edits;edit++){
  if(level<=1){const at=Math.floor(random()*working.length);plan.push(at);working[at]=working[at]?0:-1;continue;}
  let ranked=rank(working);if(!ranked.length)break;
  if(level>=4&&edit+1<s.edits){const deeper=ranked.slice(0,level===5?8:4).map(v=>{const replies=rank(v.next,level===5?60:32);return {...v,value:v.value*.3+(replies[0]?.value??v.value)*.7};});ranked=deeper.sort((a,b)=>b.value-a.value);}
  const selected=skillChoice(ranked,level,random);plan.push(selected.at);working[selected.at]=working[selected.at]?0:-1;
 }return plan;
}
export function lifeComputer(s:LifeSession,level=3,random?:()=>number):void{
 if(s.mode!=='colonies'||s.turn!==-1||s.result!==null)return;
 for(const at of chooseLifeEdits(s,level,random))editLife(s,at);stepLife(s);
}
export function restoreLife(value: unknown): LifeSession | null {
  if (!isRecord(value) || !((value.width === 40 && value.height === 28) || (value.width === 80 && value.height === 56)) || !['sandbox', 'garden', 'colonies'].includes(value.mode as string) || !['computer', 'local'].includes(value.opponent as string) || typeof value.wrap !== 'boolean' || (value.running !== undefined && typeof value.running !== 'boolean')) return null;
  const count = (value.width as number) * (value.height as number);
  const valid = (v: unknown, length = count): boolean => isRecord(v) && Array.isArray(v.cells) && v.cells.length === length && v.cells.every(n => whole(n, -1, 1)) && (v.seed === undefined || Array.isArray(v.seed) && v.seed.length === length && v.seed.every(n => whole(n, -1, 1))) && (v.seedEdit === undefined || typeof v.seedEdit === 'boolean') && whole(v.generation, 0, 100000000) && (v.turn === 1 || v.turn === -1) && whole(v.edits, 0, 3) && [null, -1, 0, 1].includes(v.result as null);
  const bookmark = value.bookmark;
  const bookmarkValid = bookmark === undefined || isRecord(bookmark) && ((bookmark.width === 40 && bookmark.height === 28) || (bookmark.width === 80 && bookmark.height === 56)) && typeof bookmark.wrap === 'boolean' && Array.isArray(bookmark.seed) && valid(bookmark, (bookmark.width as number) * (bookmark.height as number));
  return bookmarkValid && valid(value) && Array.isArray(value.seed) && value.seed.length === count && value.seed.every(n => whole(n, -1, 1)) && (value.replacement === undefined || valid(value.replacement) && isRecord(value.replacement) && Array.isArray(value.replacement.seed) && value.replacement.seed.length === count) && Array.isArray(value.history) && value.history.length <= 80 && value.history.every(snapshot => valid(snapshot)) ? { ...value, running: value.mode !== 'colonies' && value.running === true } as unknown as LifeSession : null;
}
