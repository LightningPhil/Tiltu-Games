/** Ported from the repository’s standalone TetraGrid; that app remains independent. */
export const WIDTH = 10;
export const HEIGHT = 22;
export const HIDDEN = 2;
export const TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'] as const;
export type Type = typeof TYPES[number];
export type Mode = 'marathon' | 'sprint' | 'ultra' | 'zen';
export type Cell = Type | null;
export type Board = Cell[][];
export type Piece = { type: Type; x: number; y: number; rotation: number };
export const SHAPES: Record<Type, number[][]> = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]], L: [[0,0,1],[1,1,1],[0,0,0]],
  O: [[1,1],[1,1]], S: [[0,1,1],[1,1,0],[0,0,0]],
  T: [[0,1,0],[1,1,1],[0,0,0]], Z: [[1,1,0],[0,1,1],[0,0,0]],
};
export const MODES: Record<Mode, { name: string; tag: string; description: string; goal: string }> = {
  marathon: { name: 'Marathon', tag: 'THE CLASSIC', description: 'Find your rhythm. The pace rises every 10 lines.', goal: 'Keep the stack alive' },
  sprint: { name: 'Sprint', tag: '40 LINES', description: 'Clear 40 lines as fast as you can. Every second counts.', goal: 'Clear 40 lines' },
  ultra: { name: 'Ultra', tag: '2 MINUTES', description: 'Two minutes to make every clear count. Chase your best score.', goal: 'Score before time runs out' },
  zen: { name: 'Zen', tag: 'NO PRESSURE', description: 'No automatic falling. Take your time and try a new technique.', goal: 'Practice at your own pace' },
};
// SRS offsets: the tables use upward-positive Y; the board uses downward-positive Y.
const JLSTZ: Record<string, number[][]> = {
  '0>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]], '1>0': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '1>2': [[0,0],[1,0],[1,-1],[0,2],[1,2]], '2>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '2>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]], '3>2': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '3>0': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]], '0>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
};
const IKICKS: Record<string, number[][]> = {
  '0>1': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]], '1>0': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  '1>2': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]], '2>1': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  '2>3': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]], '3>2': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  '3>0': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]], '0>3': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
};
export function matrix(piece: Pick<Piece, 'type' | 'rotation'>): number[][] {
  let m = SHAPES[piece.type];
  for (let i = 0; i < piece.rotation; i++) m = m[0].map((_, x) => m.map(row => row[x]).reverse());
  return m;
}
export function cells(piece: Piece): [number, number][] {
  return matrix(piece).flatMap((row, y) => row.flatMap((v, x) => v ? [[piece.x + x, piece.y + y] as [number, number]] : []));
}
export function emptyBoard(): Board { return Array.from({ length: HEIGHT }, () => Array<Cell>(WIDTH).fill(null)); }
export type ClearEvent = { id: number; rows: number[]; label: string; points: number; combo: number; b2b: boolean; perfect: boolean };
export type Snapshot = {
  version: 1; mode: Mode; board: Board; active: Piece; queue: Type[]; bag: Type[];
  held: Type | null; canHold: boolean; score: number; lines: number; elapsed: number;
  pieces: number; combo: number; maxCombo: number; b2b: boolean; quads: number; spins: number;
  gravityClock: number; lockClock: number; lockResets: number; lastRotation: boolean;
};
export class Game {
  board = emptyBoard();
  active!: Piece;
  queue: Type[] = [];
  bag: Type[] = [];
  held: Type | null = null;
  canHold = true;
  score = 0; lines = 0; elapsed = 0; pieces = 0; combo = -1; maxCombo = 0;
  b2b = false; quads = 0; spins = 0;
  gravityClock = 0; lockClock = 0; lockResets = 0; lastRotation = false;
  ended: 'topout' | 'complete' | null = null;
  event: ClearEvent | null = null;
  eventId = 0;
  mode: Mode;
  private random: () => number;
  constructor(mode: Mode, random: () => number = Math.random) {
    this.mode = mode; this.random = random;
    this.refill(); this.spawn();
  }
  get level() { return this.mode === 'marathon' ? Math.floor(this.lines / 10) + 1 : 1; }
  get gravity() { return this.mode === 'zen' ? Infinity : Math.max(65, 1000 * Math.pow(0.78, this.level - 1)); }
  refill() {
    while (this.queue.length < 6) {
      if (!this.bag.length) {
        this.bag = [...TYPES];
        for (let i = 6; i > 0; i--) {
          const j = Math.floor(this.random() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      this.queue.push(this.bag.pop()!);
    }
  }
  collides(piece: Piece) {
    return cells(piece).some(([x,y]) => x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || this.board[y][x] !== null);
  }
  spawn(type?: Type) {
    const t = type ?? this.queue.shift()!;
    this.refill();
    this.active = { type: t, rotation: 0, x: t === 'O' ? 4 : 3, y: 1 };
    this.gravityClock = 0; this.lockClock = 0; this.lockResets = 0; this.lastRotation = false;
    if (this.collides(this.active)) this.ended = 'topout';
  }
  grounded() { return this.collides({ ...this.active, y: this.active.y + 1 }); }
  resetLock(wasGrounded: boolean) {
    if (wasGrounded && this.lockResets < 15) { this.lockClock = 0; this.lockResets++; }
  }
  move(direction: number) {
    if (this.ended) return false;
    const p = { ...this.active, x: this.active.x + direction };
    if (this.collides(p)) return false;
    const ground = this.grounded(); this.active = p; this.lastRotation = false; this.resetLock(ground);
    return true;
  }
  rotate(direction: 1 | -1) {
    if (this.ended || this.active.type === 'O') return false;
    const rotation = (this.active.rotation + direction + 4) % 4;
    const offsets = (this.active.type === 'I' ? IKICKS : JLSTZ)[`${this.active.rotation}>${rotation}`];
    for (const [dx,dy] of offsets) {
      const p = { ...this.active, rotation, x: this.active.x + dx, y: this.active.y - dy };
      if (!this.collides(p)) {
        const ground = this.grounded(); this.active = p; this.lastRotation = true; this.resetLock(ground); return true;
      }
    }
    return false;
  }
  down(soft = false) {
    if (this.ended || this.grounded()) return false;
    this.active.y++;
    if (this.lockResets < 15) this.lockClock = 0;
    // A positive drop changes the last action, including before a T-spin check.
    this.lastRotation = false;
    if (soft) this.score++;
    return true;
  }
  ghostY() {
    let y = this.active.y;
    while (!this.collides({ ...this.active, y: y + 1 })) y++;
    return y;
  }
  hardDrop() {
    if (this.ended) return;
    const y = this.ghostY(); const distance = y - this.active.y;
    this.score += distance * 2;
    if (distance > 0) this.lastRotation = false;
    this.active.y = y; this.lock();
  }
  hold() {
    if (this.ended || !this.canHold) return false;
    const current = this.active.type; const previous = this.held;
    this.held = current; this.spawn(previous ?? undefined); this.canHold = false;
    return true;
  }
  tick(dt: number) {
    if (this.ended || dt <= 0) return;
    if (this.mode === 'ultra') {
      dt = Math.min(dt, 120000 - this.elapsed);
      this.elapsed += dt;
      if (this.elapsed >= 120000) { this.ended = 'complete'; return; }
    } else this.elapsed += dt;
    this.gravityClock += dt;
    while (this.gravityClock >= this.gravity) { this.gravityClock -= this.gravity; if (!this.down()) { this.gravityClock = 0; break; } }
    if (this.mode !== 'zen' && this.grounded()) {
      this.lockClock += dt; if (this.lockClock >= 500) this.lock();
    }
  }
  lock() {
    if (this.ended) return;
    const p = this.active;
    const occupied = (x: number,y: number) => x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || this.board[y][x] !== null;
    const spin = p.type === 'T' && this.lastRotation && [[0,0],[2,0],[0,2],[2,2]].filter(([x,y]) => occupied(p.x+x,p.y+y)).length >= 3;
    for (const [x,y] of cells(p)) this.board[y][x] = p.type;
    const rows = this.board.flatMap((row,y) => row.every(Boolean) ? [y] : []);
    const n = rows.length; const level = this.level;
    this.board = [...Array.from({length:n}, () => Array<Cell>(WIDTH).fill(null)), ...this.board.filter((_,y) => !rows.includes(y))];
    this.pieces++; this.lines += n; this.canHold = true;
    const difficult = n > 0 && (n === 4 || spin);
    const backToBack = difficult && this.b2b;
    let points = (spin ? [400,800,1200,1600][n] : [0,100,300,500,800][n]) * level;
    if (backToBack) points *= 1.5;
    if (n) {
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      points += Math.max(0, this.combo) * 50 * level;
      this.b2b = difficult;
    } else this.combo = -1;
    const perfect = n > 0 && this.board.every(row => row.every(cell => cell === null));
    if (perfect) points += 2000 * level;
    this.score += points;
    if (n === 4) this.quads++;
    if (spin) this.spins++;
    this.event = { id: ++this.eventId, rows, label: perfect ? 'ALL CLEAR' : spin ? `T-SPIN${n ? ' ' + ['','SINGLE','DOUBLE','TRIPLE'][n] : ''}` : ['','SINGLE','DOUBLE','TRIPLE','QUAD'][n], points, combo:this.combo, b2b:backToBack, perfect };
    if (this.mode === 'sprint' && this.lines >= 40) { this.ended = 'complete'; return; }
    if (this.board.slice(0,HIDDEN).some(row => row.some(Boolean))) { this.ended = 'topout'; return; }
    this.spawn();
  }
  snapshot(): Snapshot {
    const { mode,board,active,queue,bag,held,canHold,score,lines,elapsed,pieces,combo,maxCombo,b2b,quads,spins,gravityClock,lockClock,lockResets,lastRotation } = this;
    return JSON.parse(JSON.stringify({ version:1,mode,board,active,queue,bag,held,canHold,score,lines,elapsed,pieces,combo,maxCombo,b2b,quads,spins,gravityClock,lockClock,lockResets,lastRotation }));
  }
  static restore(value: unknown, ended: Game['ended'] = null): Game | null {
    if (!value || typeof value !== 'object') return null;
    const s = value as Snapshot;
    const type = (v: unknown) => TYPES.includes(v as Type);
    const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
    if (s.version !== 1 || !Object.hasOwn(MODES,s.mode) || !Array.isArray(s.board) || s.board.length !== HEIGHT || !s.board.every(row => Array.isArray(row) && row.length === WIDTH && row.every(v => v === null || type(v)) && !row.every(Boolean))) return null;
    if (!s.active || !type(s.active.type) || !Number.isInteger(s.active.x) || !Number.isInteger(s.active.y) || !Number.isInteger(s.active.rotation) || !num(s.active.x,-3,9) || !num(s.active.y,-3,21) || !num(s.active.rotation,0,3)) return null;
    if (!Array.isArray(s.queue) || s.queue.length !== 6 || !s.queue.every(type) || !Array.isArray(s.bag) || s.bag.length > 7 || !s.bag.every(type) || new Set(s.bag).size !== s.bag.length || (s.held !== null && !type(s.held))) return null;
    if (![s.canHold,s.b2b,s.lastRotation].every(v => typeof v === 'boolean') || ![s.score,s.lines,s.elapsed,s.pieces,s.maxCombo,s.quads,s.spins,s.gravityClock,s.lockClock,s.lockResets].every(v => num(v,0,1e10)) || !num(s.combo,-1,1e7) || s.lockResets > 15 || s.lockClock > 500 || (!ended && s.mode === 'ultra' && s.elapsed >= 120000) || (!ended && s.mode === 'sprint' && s.lines >= 40)) return null;
    const game = new Game(s.mode);
    // Whitelist data fields; a malformed save must never replace engine methods.
    Object.assign(game, {
      board:s.board.map(row => [...row]),active:{type:s.active.type,x:s.active.x,y:s.active.y,rotation:s.active.rotation},
      queue:[...s.queue],bag:[...s.bag],held:s.held,canHold:s.canHold,score:s.score,lines:s.lines,
      elapsed:s.elapsed,pieces:s.pieces,combo:s.combo,maxCombo:s.maxCombo,b2b:s.b2b,quads:s.quads,spins:s.spins,
      gravityClock:s.gravityClock,lockClock:s.lockClock,lockResets:s.lockResets,lastRotation:s.lastRotation,
    });
    game.ended = ended;
    if (!ended && (game.collides(game.active) || game.board.slice(0,HIDDEN).some(row => row.some(Boolean)))) return null;
    return game;
  }
}
