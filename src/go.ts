import { other } from './rules.ts';
import type { Board, Player } from './rules.ts';
import type { MatchOptions } from './state.ts';

export type GoSize = 9 | 13 | 19;
export interface GoSnapshot { board: Board; turn: Player; passes: number; captures: [number, number]; phase: 'play' | 'score' }
export interface GoSession extends GoSnapshot {
  size: GoSize; komi: number; options: MatchOptions; history: GoSnapshot[];
  moves: { player: Player; point: number | null; text: string }[];
  dead: number[]; result: Player | 0 | null; reason: string; scores: [number, number, number];
}
export const goNeighbours = (i: number, size: number): number[] => [i - size, i + size, ...(i % size ? [i - 1] : []), ...(i % size < size - 1 ? [i + 1] : [])].filter(p => p >= 0 && p < size * size);
export function goGroup(board: Board, size: number, point: number): { stones: number[]; liberties: number[] } {
  if (!board[point]) return { stones: [], liberties: [] };
  const stones = new Set([point]), liberties = new Set<number>(), queue = [point], colour = board[point];
  while (queue.length) for (const n of goNeighbours(queue.pop()!, size)) {
    if (!board[n]) liberties.add(n);
    else if (board[n] === colour && !stones.has(n)) { stones.add(n); queue.push(n); }
  }
  return { stones: [...stones], liberties: [...liberties] };
}
export const goKey = (board: Board) => board.join(',');
export const goCoordinate = (point: number, size: number) => `${'ABCDEFGHJKLMNOPQRST'[point % size]}${size - Math.floor(point / size)}`;
export function newGo(size: GoSize, options: MatchOptions, scores: [number, number, number] = [0, 0, 0]): GoSession {
  return { size, komi: 7.5, board: Array(size * size).fill(0), turn: 1, passes: 0, captures: [0, 0], phase: 'play',
    options: { ...options, starter: 1 }, history: [], moves: [], dead: [], result: null, reason: '', scores: [...scores] };
}
export interface GoPlacement { board: Board; captured: number[]; error: string }
export function placeGo(board: Board, size: number, player: Player, point: number, previous: Set<string> = new Set()): GoPlacement {
  const invalid = (error: string) => ({ board, captured: [], error });
  if (!Number.isInteger(point) || point < 0 || point >= board.length || board[point]) return invalid('Choose an empty intersection.');
  const next = board.slice(), captured = new Set<number>();
  next[point] = player;
  for (const n of goNeighbours(point, size)) if (next[n] === -player) {
    const group = goGroup(next, size, n);
    if (!group.liberties.length) group.stones.forEach(i => { captured.add(i); });
  }
  captured.forEach(i => { next[i] = 0; });
  if (!goGroup(next, size, point).liberties.length) return invalid('That move is suicide: your group would have no liberties.');
  if (previous.has(goKey(next))) return invalid('Ko: a move may not repeat an earlier board position.');
  return { board: next, captured: [...captured], error: '' };
}
export function goPositions(s: GoSession): Set<string> { return new Set([...s.history.map(h => goKey(h.board)), goKey(s.board)]); }
export function playGo(s: GoSession, point: number | null): GoPlacement {
  if (s.phase !== 'play' || s.result !== null) throw new Error('Game is not playing');
  const result = point === null ? { board: s.board.slice(), captured: [], error: '' } : placeGo(s.board, s.size, s.turn, point, goPositions(s));
  if (result.error) return result;
  s.history.push({ board: s.board.slice(), turn: s.turn, passes: s.passes, captures: [...s.captures], phase: s.phase });
  s.moves.push({ player: s.turn, point, text: point === null ? 'Pass' : goCoordinate(point, s.size) });
  s.board = result.board;
  s.captures[s.turn === 1 ? 0 : 1] += result.captured.length;
  s.passes = point === null ? s.passes + 1 : 0;
  s.turn = other(s.turn);
  if (s.passes >= 2) { s.phase = 'score'; s.dead = []; }
  return result;
}
export function undoGo(s: GoSession): boolean {
  const index = s.options.mode === 'local' ? s.history.length - 1 : s.history.map(h => h.turn).lastIndexOf(s.options.human);
  if (index < 0) return false;
  if (s.result !== null) s.scores[s.result === 1 ? 0 : s.result === -1 ? 1 : 2]--;
  const h = s.history[index];
  s.board = h.board.slice(); s.turn = h.turn; s.passes = h.passes; s.captures = [...h.captures]; s.phase = h.phase;
  s.history.splice(index); s.moves.splice(index); s.dead = []; s.result = null; s.reason = '';
  return true;
}
export interface GoScore { black: number; white: number; territory: number[]; stones: [number, number]; empty: [number, number] }
export function scoreGo(board: Board, size: number, komi = 7.5, dead: number[] = []): GoScore {
  const b = board.slice(); dead.forEach(i => { b[i] = 0; });
  const territory = Array(b.length).fill(0), seen = new Set<number>(), stones: [number, number] = [0, 0], empty: [number, number] = [0, 0];
  b.forEach(n => { if (n) stones[n === 1 ? 0 : 1]++; });
  for (let i = 0; i < b.length; i++) {
    if (b[i] || seen.has(i)) continue;
    const region = [i], queue = [i], borders = new Set<number>(); seen.add(i);
    while (queue.length) for (const n of goNeighbours(queue.pop()!, size)) {
      if (b[n]) borders.add(b[n]);
      else if (!seen.has(n)) { seen.add(n); region.push(n); queue.push(n); }
    }
    if (borders.size === 1) {
      const colour = [...borders][0]; empty[colour === 1 ? 0 : 1] += region.length;
      region.forEach(p => { territory[p] = colour; });
    }
  }
  return { black: stones[0] + empty[0], white: stones[1] + empty[1] + komi, territory, stones, empty };
}
export function toggleDead(s: GoSession, point: number): void {
  if (s.phase !== 'score' || s.result !== null || !s.board[point]) return;
  const stones = goGroup(s.board, s.size, point).stones;
  s.dead = s.dead.includes(point) ? s.dead.filter(i => !stones.includes(i)) : [...new Set([...s.dead, ...stones])];
}
export function finishGo(s: GoSession): void {
  if (s.phase !== 'score' || s.result !== null) return;
  const score = scoreGo(s.board, s.size, s.komi, s.dead), margin = score.black - score.white;
  s.result = margin > 0 ? 1 : margin < 0 ? -1 : 0;
  s.reason = `${margin > 0 ? 'Black' : 'White'} by ${Math.abs(margin)} points · area scoring`;
  s.scores[s.result === 1 ? 0 : s.result === -1 ? 1 : 2]++;
}
export function resumeGo(s: GoSession): void {
  if (s.phase !== 'score' || s.result !== null) return;
  // Retract the two passes so the same position/turn resumes and replays cleanly.
  const index = s.history.length - 2, before = s.history[index];
  if (!before) return;
  s.board = before.board.slice(); s.turn = before.turn; s.captures = [...before.captures]; s.passes = 0; s.phase = 'play';
  s.history.splice(index); s.moves.splice(index); s.dead = [];
}

export const GO_LEVELS = [
  { description: 'Random legal moves. A relaxed way to practise captures.' },
  { description: 'Looks for captures, saves groups in atari and connects stones.' },
  { description: 'Checks the reply and balances liberties with board influence.' },
  { description: 'Reads forcing captures further and protects group shape.' },
  { description: 'Our strongest Go bot: deeper local reading and careful shape. A club practice opponent.' },
] as const;
export interface GoAIResult { move: number | null; depth: number; nodes: number }

function goEvaluation(board: Board, size: number, player: Player): number {
  let score = 0;
  const seen = new Set<number>();
  for (let i = 0; i < board.length; i++) {
    if (!board[i] || seen.has(i)) continue;
    const group = goGroup(board, size, i), colour = board[i]; group.stones.forEach(p => seen.add(p));
    const liberties = group.liberties.length;
    score += colour * player * (group.stones.length * 28 + Math.min(liberties, 6) * 5 - (liberties === 1 ? group.stones.length * 24 : 0));
  }
  // Influence is a heuristic, not territory ownership or automatic life/death.
  for (let i = 0; i < board.length; i++) if (!board[i]) {
    const neighbours = goNeighbours(i, size), influence = neighbours.reduce((sum, n) => sum + board[n], 0);
    score += Math.sign(influence) * player * 2;
  }
  return score;
}
function goCandidates(board: Board, size: number, player: Player, previous: Set<string>, width: number, stop?: () => void): { point: number; board: Board; score: number }[] {
  const options: { point: number; board: Board; score: number }[] = [];
  const seen = new Set<number>(), liberties = new Set<number>();
  for (let i = 0; i < board.length; i++) if (board[i] && !seen.has(i)) {
    const g = goGroup(board, size, i); g.stones.forEach(p => seen.add(p));
    if (g.liberties.length <= 2) g.liberties.forEach(p => liberties.add(p));
  }
  const occupied = board.some(Boolean);
  for (let point = 0; point < board.length; point++) {
    if (point % 32 === 0) stop?.();
    if (board[point]) continue;
    const r = Math.floor(point / size), c = point % size, edge = Math.min(r, c, size - 1 - r, size - 1 - c);
    const around = goNeighbours(point, size), friendly = around.filter(n => board[n] === player), enemies = around.filter(n => board[n] === -player);
    // Do not fill a safe own eye during ordinary play.
    if (around.every(n => board[n] === player) && !liberties.has(point)) continue;
    const placement = placeGo(board, size, player, point, previous);
    if (placement.error) continue;
    const group = goGroup(placement.board, size, point);
    const attack = around.filter(n => placement.board[n] === -player && goGroup(placement.board, size, n).liberties.length === 1).length;
    let score = placement.captured.length * 120 + attack * 24 + (liberties.has(point) ? 32 : 0) + Math.min(group.liberties.length, 6) * 3;
    score += friendly.length * 5 + enemies.length * 4 + (edge === 2 || edge === 3 ? 10 : edge === 0 ? -6 : 0);
    if (group.liberties.length === 1) score -= 90;
    if (!occupied) score += size - Math.abs(r - size / 2) - Math.abs(c - size / 2);
    options.push({ point, board: placement.board, score });
  }
  return options.sort((a, b) => b.score - a.score).slice(0, width);
}
export function chooseGoMove(s: GoSession, level: number, random = Math.random): GoAIResult {
  if (s.phase !== 'play' || s.result !== null) return { move: null, depth: 0, nodes: 0 };
  // Mixing two measured policies avoids the odd/even horizon reversal of an
  // intermediate search depth. Expert uses the deepest reading every turn.
  if(level===4)return chooseGoMove(s,random()<.7?5:3,random);
  const previous = goPositions(s);
  if (level <= 1) {
    const legal = s.board.flatMap((n, i) => !n && !placeGo(s.board, s.size, s.turn, i, previous).error ? [i] : []);
    return { move: legal.length ? legal[Math.floor(random() * legal.length)] : null, depth: 0, nodes: legal.length };
  }
  const width = [0, 8, 10, 12, 14][level - 1], maxDepth = [0, 1, 2, 3, 4][level - 1], budget = [0, 200, 1200, 5000, 18000][level - 1];
  let nodes = 0, completed = 1;
  const moves = goCandidates(s.board, s.size, s.turn, previous, width);
  // A deeper positional estimate must still account for a group which can be
  // removed on the very next move. Only legal replies (including superko) count.
  const tacticalRisk=new Map<number,number>();
  if(level>=3)for(const move of moves){
    const liberties=new Set<number>(),seen=new Set<number>();
    for(let at=0;at<move.board.length;at++)if(move.board[at]===s.turn&&!seen.has(at)){
      const group=goGroup(move.board,s.size,at);group.stones.forEach(i=>seen.add(i));if(group.liberties.length===1)liberties.add(group.liberties[0]);
    }
    const positions=new Set(previous);positions.add(goKey(move.board));let loss=0;
    for(const at of liberties){const reply=placeGo(move.board,s.size,other(s.turn),at,positions);if(!reply.error)loss=Math.max(loss,reply.captured.length);}
    const captured=s.board.filter(n=>n===-s.turn).length-move.board.filter(n=>n===-s.turn).length;
    tacticalRisk.set(move.point,Math.max(0,loss-captured)*50);
  }
  // Pass rather than filling own territory once there are no productive moves.
  if (!moves.length) return { move: null, depth: 1, nodes };
  const urgent = moves[0].score > 40;
  if (s.passes && !urgent && s.board.filter(Boolean).length > s.size * s.size * .6) return { move: null, depth: 1, nodes };
  if (level === 2) return { move: moves[0].point, depth: 1, nodes: moves.length };
  const abort = Symbol('budget');
  const deadline = performance.now() + [0, 250, 600, 1200, 2400][Math.max(0, Math.min(4, level - 1))];
  const stop = () => { if (performance.now() > deadline) throw abort; };
  function search(board: Board, player: Player, depth: number, alpha: number, beta: number, positions: Set<string>): number {
    if (++nodes > budget) throw abort;
    stop();
    if (depth === 0) return goEvaluation(board, s.size, player);
    const children = goCandidates(board, s.size, player, positions, Math.min(width, 6), stop);
    if (!children.length) return goEvaluation(board, s.size, player);
    let best = -Infinity;
    for (const child of children) {
      const key = goKey(child.board); positions.add(key);
      let value: number;
      try { value = -search(child.board, other(player), depth - 1, -beta, -alpha, positions); } finally { positions.delete(key); }
      best = Math.max(best, value); alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = moves[0].point;
  for (let depth = 1; depth <= maxDepth; depth++) {
    let candidate = best, bestScore = -Infinity;
    try {
      for (const move of moves.slice().sort((a, b) => Number(b.point === best) - Number(a.point === best))) {
        const positions = new Set(previous); positions.add(goKey(move.board));
        const value = -search(move.board, other(s.turn), depth - 1, -Infinity, Infinity, positions) + move.score * .03-(tacticalRisk.get(move.point)??0);
        if (value > bestScore) { bestScore = value; candidate = move.point; }
      }
      best = candidate; completed = depth;
    } catch (error) { if (error !== abort) throw error; break; }
  }
  return { move: best, depth: completed, nodes };
}
