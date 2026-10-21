import { isRecord, whole } from './cards.ts';
export type TetraSize = 2 | 3 | 4;
export interface EdgeTile { n: number; e: number; s: number; w: number }
export interface TetraSnapshot { board: (number | null)[]; tray: (number | null)[]; moves: number; hints: number }
export interface TetraSession extends TetraSnapshot { size: TetraSize; tiles: EdgeTile[]; history: TetraSnapshot[]; elapsed: number }
export interface TilePlace { area: 'board' | 'tray'; index: number }
export function newTetra(size: TetraSize = 3, random = Math.random): TetraSession {
  const tiles: EdgeTile[] = [];
  for (let i = 0; i < size * size; i++) tiles.push({ n: i >= size ? tiles[i - size].s : Math.floor(random() * 10), w: i % size ? tiles[i - 1].e : Math.floor(random() * 10), e: Math.floor(random() * 10), s: Math.floor(random() * 10) });
  const tray = tiles.map((_, i) => i);
  for (let i = tray.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [tray[i], tray[j]] = [tray[j], tray[i]]; }
  return { size, tiles, board: Array(size * size).fill(null), tray, history: [], elapsed: 0, moves: 0, hints: 0 };
}
export function tileFits(s: Pick<TetraSession, 'size' | 'tiles'>, board: (number | null)[], at: number, tile: number): boolean {
  const t = s.tiles[tile], x = at % s.size, y = Math.floor(at / s.size);
  return (y === 0 || board[at - s.size] === null || s.tiles[board[at - s.size]!].s === t.n)
    && (x === 0 || board[at - 1] === null || s.tiles[board[at - 1]!].e === t.w)
    && (y === s.size - 1 || board[at + s.size] === null || s.tiles[board[at + s.size]!].n === t.s)
    && (x === s.size - 1 || board[at + 1] === null || s.tiles[board[at + 1]!].w === t.e);
}
export const tetraWon = (s: TetraSession): boolean => s.board.every((tile, i) => tile !== null && tileFits(s, s.board, i, tile));
export function explainTetraHint(s:TetraSession,at:number):string {
  const id=s.board[at];if(id===null||id===undefined)return 'No tile was placed.';
  const tile=s.tiles[id],row=Math.floor(at/s.size),col=at%s.size,matches:string[]=[];
  if(row&&s.board[at-s.size]!==null)matches.push(`top ${tile.n}`);
  if(col&&s.board[at-1]!==null)matches.push(`left ${tile.w}`);
  if(row<s.size-1&&s.board[at+s.size]!==null)matches.push(`bottom ${tile.s}`);
  if(col<s.size-1&&s.board[at+1]!==null)matches.push(`right ${tile.e}`);
  return `Revealed a tile at row ${row+1}, column ${col+1}: top ${tile.n}, right ${tile.e}, bottom ${tile.s}, left ${tile.w}. ${matches.length?`Its ${matches.join(', ')} edge${matches.length===1?'':'s'} match the touching neighbours.`:'There are no placed neighbours yet; matching alone does not force this tile.'} A full search found a complete arrangement keeping your existing placements. This is one solution reveal, not proof that this tile is the only local fit. Undo can take it back.`;
}
export function canMoveTile(s: TetraSession, from: TilePlace, to: TilePlace): boolean {
  if (tetraWon(s) || !whole(from.index, 0, s.board.length - 1) || !whole(to.index, 0, s.board.length - 1) || (from.area === to.area && from.index === to.index) || s[from.area][from.index] === null) return false;
  const board = s.board.slice(), tray = s.tray.slice(), piles = { board, tray };
  [piles[from.area][from.index], piles[to.area][to.index]] = [piles[to.area][to.index], piles[from.area][from.index]];
  return board.every((tile, i) => tile === null || tileFits(s, board, i, tile));
}
function remember(s: TetraSession): void { s.history.push({ board: s.board.slice(), tray: s.tray.slice(), moves: s.moves, hints: s.hints }); if (s.history.length > 150) s.history.shift(); s.moves++; }
export function moveTile(s: TetraSession, from: TilePlace, to: TilePlace): boolean {
  if (!canMoveTile(s, from, to)) return false;
  const board = s.board.slice(), tray = s.tray.slice(), piles = { board, tray };
  [piles[from.area][from.index], piles[to.area][to.index]] = [piles[to.area][to.index], piles[from.area][from.index]];
  if (!board.every((tile, i) => tile === null || tileFits(s, board, i, tile))) return false;
  remember(s); s.board = board; s.tray = tray; return true;
}
export function tileMoveIssue(s: TetraSession, from: TilePlace, to: TilePlace): string {
  if (s[from.area][from.index] === null) return 'Choose a tile first.';
  const board = s.board.slice(), tray = s.tray.slice(), piles = { board, tray };
  [piles[from.area][from.index], piles[to.area][to.index]] = [piles[to.area][to.index], piles[from.area][from.index]];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) continue;
    const tile = s.tiles[board[i]!], row = Math.floor(i / s.size), col = i % s.size;
    for (const [near, a, b, side] of [[i + 1, 'e', 'w', 'right'], [i + s.size, 's', 'n', 'bottom']] as const) {
      if ((side === 'right' && col === s.size - 1) || near >= board.length || board[near] === null) continue;
      const other = s.tiles[board[near]!];
      if (tile[a] !== other[b]) return `Row ${row + 1}, column ${col + 1}: its ${side} edge is ${tile[a]}, but the touching edge is ${other[b]}. Match those numbers. Your tile stays selected.`;
    }
  }
  return 'Choose a different destination. Tiles cannot rotate.';
}
export function sortTetraTray(s: TetraSession): boolean {
  const sorted = s.tray.filter((id): id is number => id !== null).sort((a, b) => s.tiles[a].n - s.tiles[b].n || s.tiles[a].w - s.tiles[b].w || s.tiles[a].e - s.tiles[b].e || s.tiles[a].s - s.tiles[b].s || a - b);
  const next: (number | null)[] = [...sorted, ...Array(s.tray.length - sorted.length).fill(null)];
  if (next.every((id, i) => id === s.tray[i])) return false;
  remember(s); s.moves--; s.tray = next; return true;
}
export function undoTetra(s: TetraSession): boolean { const previous = s.history.pop(); if (!previous) return false; Object.assign(s, previous); return true; }
export function solveTetra(s: TetraSession, limit = 300000): { board: number[] | null; exhausted: boolean } {
  const board = s.board.slice(), remaining = new Set(s.tray.filter((n): n is number => n !== null)); let nodes = 0, exhausted = false;
  function fill(): boolean {
    if (++nodes > limit) { exhausted = true; return false; }
    if (!remaining.size) return true;
    let at = -1, choices: number[] = [];
    for (let i = 0; i < board.length; i++) if (board[i] === null) {
      const fits = [...remaining].filter(tile => tileFits(s, board, i, tile));
      if (!fits.length) return false;
      if (at < 0 || fits.length < choices.length) { at = i; choices = fits; }
    }
    for (const tile of choices) { board[at] = tile; remaining.delete(tile); if (fill()) return true; remaining.add(tile); board[at] = null; if (exhausted) return false; }
    return false;
  }
  return { board: fill() ? board as number[] : null, exhausted };
}
export function hintTetra(s: TetraSession): 'placed' | 'blocked' | 'budget' | 'complete' {
  if (tetraWon(s)) return 'complete';
  const answer = solveTetra(s);
  if (!answer.board) return answer.exhausted ? 'budget' : 'blocked';
  const index = s.board.indexOf(null), from = s.tray.indexOf(answer.board[index]);
  if (!moveTile(s, { area: 'tray', index: from }, { area: 'board', index })) return 'blocked';
  s.hints++; return 'placed';
}
export function restoreTetra(value: unknown): TetraSession | null {
  if (!isRecord(value) || ![2, 3, 4].includes(value.size as number) || !Array.isArray(value.tiles) || value.tiles.length !== (value.size as number) ** 2 || !value.tiles.every(t => isRecord(t) && ['n', 'e', 's', 'w'].every(k => whole(t[k], 0, 9))) || !whole(value.elapsed, 0, 10000000)) return null;
  const size = value.size as TetraSize, count = size * size;
  const valid = (v: unknown): boolean => {
    if (!isRecord(v) || ![v.board, v.tray].every(p => Array.isArray(p) && p.length === count && p.every(n => n === null || whole(n, 0, count - 1))) || !whole(v.moves, 0, 1000000) || !whole(v.hints, 0, 1000000)) return false;
    const all = [...v.board as (number | null)[], ...v.tray as (number | null)[]].filter(n => n !== null);
    return all.length === count && new Set(all).size === count && (v.board as (number | null)[]).every((t, i, board) => t === null || tileFits({ size, tiles: value.tiles as EdgeTile[] }, board, i, t));
  };
  return valid(value) && Array.isArray(value.history) && value.history.length <= 150 && value.history.every(valid) ? value as unknown as TetraSession : null;
}
