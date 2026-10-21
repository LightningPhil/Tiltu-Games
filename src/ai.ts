import { applyMove, draughtsMoves, fourLine, fourMoves, legalMoves, other, positionKey, winner } from './rules.ts';
import type { Board, DraughtsMove, DuelGame, Move, Player } from './rules.ts';

export const LEVELS = [
  { name: 'Easy', description: 'Finding its feet. Plays random legal moves.', fourDepth: 0, draughtsDepth: 0, nodes: 0 },
  { name: 'Casual', description: 'Spots immediate wins and threats. In draughts, favours material and promotion.', fourDepth: 1, draughtsDepth: 1, nodes: 0 },
  { name: 'Challenging', description: 'Plans ahead and looks for tactical combinations.', fourDepth: 3, draughtsDepth: 3, nodes: 18_000 },
  { name: 'Hard', description: 'Searches further to set traps and avoid exchanges that lose.', fourDepth: 5, draughtsDepth: 5, nodes: 90_000 },
  { name: 'Expert', description: 'Our strongest opponent. Deep search, careful tactics and endgame play.', fourDepth: 9, draughtsDepth: 9, nodes: 400_000 },
] as const;

export interface AIResult { move: Move | null; depth: number; nodes: number; score: number }
const MATE = 1_000_000;
const windows: number[][] = [];
for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    if (r + dr * 3 < 6 && c + dc * 3 >= 0 && c + dc * 3 < 7) {
      windows.push(Array.from({ length: 4 }, (_, j) => (r + dr * j) * 7 + c + dc * j));
    }
  }
}

export function evaluate(game: DuelGame, board: Board, player: Player): number {
  let score = 0;
  if (game === 'four') {
    for (let r = 0; r < 6; r++) score += board[r * 7 + 3] * player * 7;
    for (const cells of windows) {
      let own = 0, opp = 0;
      cells.forEach(i => { if (board[i] === player) own++; else if (board[i]) opp++; });
      if (!opp) score += [0, 1, 12, 90, MATE][own];
      if (!own) score -= [0, 1, 12, 90, MATE][opp];
    }
  } else {
    for (let i = 0; i < 64; i++) {
      const piece = board[i];
      if (!piece) continue;
      const row = Math.floor(i / 8), col = i % 8, side = Math.sign(piece);
      let value = Math.abs(piece) === 2 ? 185 : 100 + (side > 0 ? 7 - row : row) * 4;
      value += (col >= 2 && col <= 5 && row >= 2 && row <= 5) ? 7 : 0;
      if (Math.abs(piece) === 1 && (side > 0 ? row === 7 : row === 0)) value += 8;
      // Protected adjacent men are less vulnerable to a forced trade.
      const backRow = row + side;
      if (backRow >= 0 && backRow < 8) for (const dc of [-1, 1]) {
        if (col + dc >= 0 && col + dc < 8 && board[backRow * 8 + col + dc] * side > 0) value += 3;
      }
      score += value * side * player;
    }
  }
  return score;
}

function ordered(game: DuelGame, board: Board, moves: Move[], preferred?: Move): Move[] {
  const key = (m: Move) => JSON.stringify(m);
  const p = preferred === undefined ? '' : key(preferred);
  if (game === 'four') return moves.slice().sort((a, b) => Number(key(b) === p) - Number(key(a) === p));
  const priority = (move: Move) => {
    const m = move as DraughtsMove, row = Math.floor(m.path.at(-1)! / 8);
    return (key(m) === p ? 10_000 : 0) + m.captures.reduce((sum, i) => sum + Math.abs(board[i]) * 20, 0)
      + (Math.abs(board[m.from]) === 1 && (row === 0 || row === 7) ? 15 : 0);
  };
  return moves.slice().sort((a, b) => priority(b) - priority(a));
}

export function chooseMove(game: DuelGame, board: Board, player: Player, level: number, random = Math.random): AIResult {
  const settings = LEVELS[Math.max(0, Math.min(4, level - 1))];
  const moves = legalMoves(game, board, player);
  if (!moves.length || winner(game, board, player) !== null) return { move: null, depth: 0, nodes: 0, score: 0 };
  if (level <= 1) return { move: moves[Math.min(moves.length - 1, Math.floor(random() * moves.length))], depth: 0, nodes: 0, score: 0 };
  // Every level above Easy takes a win in one. Casual also blocks a win in one.
  const immediate = moves.find(m => winner(game, applyMove(game, board, player, m), other(player)) === player);
  if (immediate !== undefined) return { move: immediate, depth: 1, nodes: moves.length, score: MATE };
  if (level === 2) {
    const scored = moves.map(move => {
      const next = applyMove(game, board, player, move);
      // Casual has one-turn tactics, but no positional plan in Four in a Row.
      // Safe columns are equally likely; Challenging adds deliberate setup play.
      let score = game === 'four' ? 0 : evaluate(game, next, player);
      if (game === 'four' && fourMoves(next).some(m => fourLine(applyMove(game, next, other(player), m)).length)) score -= MATE;
      return { move, score };
    });
    const best = Math.max(...scored.map(m => m.score));
    const ties = scored.filter(m => m.score === best);
    const chosen = ties[Math.min(ties.length - 1, Math.floor(random() * ties.length))];
    return { ...chosen, depth: 1, nodes: moves.length };
  }
  let nodes = 0;
  const maxDepth = game === 'four' ? settings.fourDepth : settings.draughtsDepth;
  const aborted = Symbol('node budget');
  interface Entry { depth: number; score: number; flag: 'exact' | 'lower' | 'upper'; move?: Move }
  let cache = new Map<string, Entry>();
  function search(b: Board, turn: Player, depth: number, alpha: number, beta: number, ply: number, extensions = 4): number {
    if (++nodes > settings.nodes) throw aborted;
    const result = winner(game, b, turn);
    if (result !== null) return result === 0 ? 0 : result === turn ? MATE - ply : -MATE + ply;
    let children = legalMoves(game, b, turn);
    // Finish forcing captures before evaluating a draughts position.
    if (depth <= 0) {
      if (game !== 'draughts' || extensions <= 0 || !(children[0] as DraughtsMove).captures.length) return evaluate(game, b, turn);
      depth = 0;
      extensions--;
    }
    const hash = `${positionKey(b, turn)}:${extensions}:${ply}`;
    const entry = cache.get(hash), originalAlpha = alpha, originalBeta = beta;
    if (entry && entry.depth >= depth) {
      if (entry.flag === 'exact') return entry.score;
      if (entry.flag === 'lower') alpha = Math.max(alpha, entry.score);
      else beta = Math.min(beta, entry.score);
      if (alpha >= beta) return entry.score;
    }
    children = ordered(game, b, children, entry?.move);
    let best = -Infinity, bestMove: Move | undefined;
    for (const move of children) {
      const value = -search(applyMove(game, b, turn, move), other(turn), depth - 1, -beta, -alpha, ply + 1, extensions);
      if (value > best) { best = value; bestMove = move; }
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    cache.set(hash, { depth, score: best, move: bestMove, flag: best <= originalAlpha ? 'upper' : best >= originalBeta ? 'lower' : 'exact' });
    return best;
  }
  let bestMove = moves[0], completed = 0, bestScore = -Infinity;
  // Keep the last completed iteration, never a partially searched root.
  for (let depth = 1; depth <= maxDepth; depth++) {
    cache = new Map();
    let candidate = bestMove, score = -Infinity, alpha = -Infinity;
    try {
      for (const move of ordered(game, board, moves, bestMove)) {
        const value = -search(applyMove(game, board, player, move), other(player), depth - 1, -Infinity, -alpha, 1);
        if (value > score) { score = value; candidate = move; }
        alpha = Math.max(alpha, score);
      }
      bestMove = candidate; bestScore = score; completed = depth;
      if (Math.abs(score) >= MATE - 100) break;
    } catch (error) { if (error !== aborted) throw error; break; }
  }
  return { move: bestMove, depth: completed, nodes, score: bestScore };
}
