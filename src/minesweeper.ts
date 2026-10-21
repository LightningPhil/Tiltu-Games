import { isRecord, whole } from './cards.ts';
export const MINE_LEVELS = { beginner: [9, 9, 10], intermediate: [16, 16, 40], expert: [30, 16, 99] } as const;
export type MineLevel = keyof typeof MINE_LEVELS;
export interface MineSession { level: MineLevel; width: number; height: number; count: number; mines: number[]; open: boolean[]; flags: boolean[]; status: 'ready' | 'playing' | 'won' | 'lost'; paused?: boolean; exploded: number; elapsed: number; best: Partial<Record<MineLevel, number>> }
export function newMines(level: MineLevel = 'beginner', best: MineSession['best'] = {}): MineSession {
  const [width, height, count] = MINE_LEVELS[level];
  return { level, width, height, count, mines: [], open: Array(width * height).fill(false), flags: Array(width * height).fill(false), status: 'ready', exploded: -1, elapsed: 0, best: { ...best } };
}
export function mineNeighbours(s: Pick<MineSession, 'width' | 'height'>, at: number): number[] {
  const x = at % s.width, y = Math.floor(at / s.width), out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && x + dx >= 0 && x + dx < s.width && y + dy >= 0 && y + dy < s.height) out.push((y + dy) * s.width + x + dx);
  return out;
}
export const mineNumber = (s: MineSession, at: number): number => mineNeighbours(s, at).filter(i => s.mines.includes(i)).length;
export interface MineHint { cells: number[]; kind: 'safe' | 'flag' | 'conflict' | 'none'; reason: string }
/** Deduce from exposed clues and the player's flags; never inspect covered mines. */
export function mineHint(s: MineSession): MineHint {
  if (s.paused) return { cells: [], kind: 'none', reason: 'Resume the field to inspect its clues.' };
  if (s.status !== 'playing') return { cells: [], kind: 'none', reason: s.status === 'ready' ? 'Open any square first. Its full neighbourhood is safe.' : 'This field is finished. Start a new one to practise.' };
  const clues = s.open.flatMap((open, at) => {
    if (!open) return [];
    const around = mineNeighbours(s, at), cells = around.filter(i => !s.open[i] && !s.flags[i]), flags = around.filter(i => s.flags[i]).length, number = mineNumber(s, at);
    return [{ at, cells, remaining: number - flags, number, flags }];
  });
  const location = (at: number) => `row ${Math.floor(at / s.width) + 1}, column ${at % s.width + 1}`;
  for (const c of clues) {
    if (c.remaining < 0 || c.remaining > c.cells.length) return { cells: [c.at], kind: 'conflict', reason: `Check the flags around ${location(c.at)}. Its ${c.number} clue conflicts with the flags and covered neighbours.` };
    if (!c.cells.length) continue;
    if (c.remaining === 0) return { cells: c.cells, kind: 'safe', reason: `The ${c.number} at ${location(c.at)} already has ${c.flags} flags beside it. The highlighted neighbours are safe if those flags are correct.` };
    if (c.remaining === c.cells.length) return { cells: c.cells, kind: 'flag', reason: `The clue at ${location(c.at)} needs ${c.remaining} more mine${c.remaining === 1 ? '' : 's'}, and has exactly ${c.cells.length} unflagged neighbour${c.cells.length === 1 ? '' : 's'}. Flag the highlighted square${c.cells.length === 1 ? '' : 's'} if your existing flags are correct.` };
  }
  for (const a of clues) for (const b of clues) {
    if (!a.cells.length || a.cells.length >= b.cells.length || !a.cells.every(i => b.cells.includes(i))) continue;
    const extra = b.cells.filter(i => !a.cells.includes(i)), remaining = b.remaining - a.remaining;
    if (remaining === 0 || remaining === extra.length) return { cells: extra, kind: remaining ? 'flag' : 'safe', reason: `Compare the clues at ${location(a.at)} and ${location(b.at)}. Their shared squares account for ${a.remaining} mine${a.remaining === 1 ? '' : 's'}, leaving ${remaining} mine${remaining === 1 ? '' : 's'} in the ${extra.length} highlighted square${extra.length === 1 ? '' : 's'}. This deduction assumes your flags are correct.` };
  }
  return { cells: [], kind: 'none', reason: 'No forced move follows from these clues and flags yet. Look elsewhere on the field; a guess may be necessary. The tutor does not peek under covered squares.' };
}
export function flagMine(s: MineSession, at: number): boolean {
  if (s.paused) return false;
  if (!whole(at, 0, s.open.length - 1) || s.open[at] || s.status === 'won' || s.status === 'lost') return false;
  s.flags[at] = !s.flags[at]; return true;
}
export function openMine(s: MineSession, at: number, random = Math.random): number[] {
  if (s.paused) return [];
  if (!whole(at, 0, s.open.length - 1) || s.flags[at] || s.status === 'won' || s.status === 'lost') return [];
  if (s.status === 'ready') {
    const safe = new Set([at, ...mineNeighbours(s, at)]), candidates = s.open.flatMap((_, i) => safe.has(i) ? [] : [i]);
    for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
    s.mines = candidates.slice(0, s.count); s.status = 'playing';
  }
  let queue = [at];
  if (s.open[at]) {
    const neighbours = mineNeighbours(s, at);
    if (neighbours.filter(i => s.flags[i]).length !== mineNumber(s, at)) return [];
    queue = neighbours.filter(i => !s.open[i] && !s.flags[i]);
  }
  const changed: number[] = [];
  while (queue.length) {
    const i = queue.pop()!;
    if (s.open[i] || s.flags[i]) continue;
    s.open[i] = true; changed.push(i);
    if (s.mines.includes(i)) { s.status = 'lost'; s.exploded = i; break; }
    if (!mineNumber(s, i)) queue.push(...mineNeighbours(s, i));
  }
  if (s.status !== 'lost' && s.open.filter(Boolean).length === s.open.length - s.count) {
    s.status = 'won'; s.mines.forEach(i => { s.flags[i] = true; });
    s.best[s.level] = Math.min(s.best[s.level] ?? Infinity, s.elapsed);
  }
  return changed;
}
export function restoreMines(value: unknown): MineSession | null {
  if (!isRecord(value) || !Object.hasOwn(MINE_LEVELS, value.level as string)) return null;
  const [w, h, n] = MINE_LEVELS[value.level as MineLevel];
  if (value.width !== w || value.height !== h || value.count !== n || !Array.isArray(value.mines) || (value.mines.length !== 0 && value.mines.length !== n) || !value.mines.every(i => whole(i, 0, w * h - 1)) || new Set(value.mines).size !== value.mines.length
    || ![value.open, value.flags].every(a => Array.isArray(a) && a.length === w * h && a.every(v => typeof v === 'boolean')) || !['ready', 'playing', 'won', 'lost'].includes(value.status as string) || !whole(value.exploded, -1, w * h - 1) || !whole(value.elapsed, 0, 10000000)) return null;
  const s = value as unknown as MineSession;
  if (value.paused !== undefined && typeof value.paused !== 'boolean') return null;
  if (s.status !== 'playing' && s.paused) s.paused = false;
  if ((s.status === 'ready') !== (s.mines.length === 0) || (s.status === 'ready' && s.open.some(Boolean)) || (s.status === 'lost' && (!s.mines.includes(s.exploded) || !s.open[s.exploded])) || (s.status !== 'lost' && s.mines.some(i => s.open[i])) || (s.status === 'won' && s.open.filter(Boolean).length !== w * h - n)) return null;
  s.best = isRecord(value.best) ? Object.fromEntries(Object.entries(value.best).filter(([key, time]) => Object.hasOwn(MINE_LEVELS, key) && whole(time, 0, 10000000))) : {};
  return s;
}
