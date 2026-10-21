import { Chess, DEFAULT_POSITION, SQUARES } from 'chess.js';
import {kingPawnMove} from './chess-kpk.ts';
import type { Move as ChessMove, PieceSymbol, Square } from 'chess.js';
import type { Player } from './rules.ts';
import type { MatchOptions } from './state.ts';

export { Chess, SQUARES };
export type { ChessMove, PieceSymbol, Square };
export interface ChessSession {
  options: MatchOptions; moves: string[]; startFen: string; result: Player | 0 | null;
  reason: string; scores: [number, number, number];
}
export const chessPlayer = (chess: Chess): Player => chess.turn() === 'w' ? 1 : -1;
export const chessIndex = (square: string) => (8 - Number(square[1])) * 8 + 'abcdefgh'.indexOf(square[0]);
export const chessSquare = (index: number): Square => SQUARES[index];
export const PIECE_NAMES: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
export const PIECE_GLYPHS: Record<PieceSymbol, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };

export function newChess(options: MatchOptions, scores: [number, number, number] = [0, 0, 0]): ChessSession {
  return { options: { ...options, starter: 1 }, startFen: DEFAULT_POSITION, moves: [], result: null, reason: '', scores: [...scores] };
}
export function chessEngine(s: Pick<ChessSession, 'startFen' | 'moves'>): Chess {
  const chess = new Chess(s.startFen);
  for (const move of s.moves) chess.move(move, { strict: true });
  return chess;
}
export function chessCaptures(moves: readonly ChessMove[]): { white: PieceSymbol[]; black: PieceSymbol[] } {
  const captures: { white: PieceSymbol[]; black: PieceSymbol[] } = { white: [], black: [] };
  for (const move of moves) {
    if (move.captured) captures[move.color === 'w' ? 'white' : 'black'].push(move.captured);
  }
  return captures;
}
export function chessOutcome(chess: Chess): { result: Player | 0 | null; reason: string } {
  if (chess.isCheckmate()) return { result: chessPlayer(chess) === 1 ? -1 : 1, reason: 'Checkmate' };
  if (chess.isStalemate()) return { result: 0, reason: 'Stalemate' };
  if (chess.isThreefoldRepetition()) return { result: 0, reason: 'Threefold repetition' };
  if (chess.isInsufficientMaterial()) return { result: 0, reason: 'Insufficient material' };
  if (lockedPawnDeadPosition(chess)) return { result: 0, reason: 'Dead position · no possible checkmate' };
  if (chess.isDrawByFiftyMoves()) return { result: 0, reason: '50 moves each without a pawn move or capture' };
  return { result: null, reason: '' };
}
// A sufficient test, not a general fortress solver. Overestimate each king's
// reachable squares: if neither can even reach an enemy pawn, no pawn can ever
// move, and the kings alone cannot give a legal check.
export function lockedPawnDeadPosition(chess: Chess): boolean {
  if (chess.isCheck() || chess.fen().split(' ')[3] !== '-') return false;
  const board = chess.board().flat(), pawns = board.filter(p => p?.type === 'p');
  if (!pawns.length || board.some(p => p && p.type !== 'k' && p.type !== 'p')) return false;
  for (const p of pawns) {
    const at = chessIndex(p!.square), r = Math.floor(at / 8), c = at % 8, dr = p!.color === 'w' ? -1 : 1;
    if (r + dr < 0 || r + dr > 7 || board[at + dr * 8]?.type !== 'p') return false;
    for (const dc of [-1, 1]) if (c + dc >= 0 && c + dc < 8) {
      const target = board[at + dr * 8 + dc];
      if (target?.type === 'p' && target.color !== p!.color) return false;
    }
  }
  for (const colour of ['w', 'b'] as const) {
    const start = board.findIndex(p => p?.type === 'k' && p.color === colour);
    const attacked = new Set<number>();
    for (const p of pawns) if (p!.color !== colour) {
      const at = chessIndex(p!.square), r = Math.floor(at / 8), c = at % 8, dr = p!.color === 'w' ? -1 : 1;
      for (const dc of [-1, 1]) if (r + dr >= 0 && r + dr < 8 && c + dc >= 0 && c + dc < 8) attacked.add(at + dr * 8 + dc);
    }
    const seen = new Set([start]), queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i], r = Math.floor(at / 8), c = at % 8;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if ((!dr && !dc) || r + dr < 0 || r + dr > 7 || c + dc < 0 || c + dc > 7) continue;
        const to = at + dr * 8 + dc, p = board[to];
        if (seen.has(to) || attacked.has(to) || p?.type === 'p' && p.color === colour) continue;
        if (p?.type === 'p') return false;
        seen.add(to); queue.push(to);
      }
    }
  }
  return true;
}
export function playChess(s: ChessSession, move: string | { from: string; to: string; promotion?: string }): ChessMove {
  if (s.result !== null) throw new Error('Game finished');
  const chess = chessEngine(s), played = chess.move(move);
  s.moves.push(played.san);
  Object.assign(s, chessOutcome(chess));
  if (s.result !== null) s.scores[s.result === 1 ? 0 : s.result === -1 ? 1 : 2]++;
  return played;
}
export function undoChess(s: ChessSession): boolean {
  const chess = chessEngine(s), history = chess.history({ verbose: true });
  const index = s.options.mode === 'local' ? history.length - 1 : history.map(m => m.color === 'w' ? 1 : -1).lastIndexOf(s.options.human);
  if (index < 0) return false;
  if (s.result !== null) s.scores[s.result === 1 ? 0 : s.result === -1 ? 1 : 2]--;
  s.moves.splice(index); s.result = null; s.reason = '';
  return true;
}

const values: Record<PieceSymbol, number> = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
export const CHESS_LEVELS = [
  { depth: 0, nodes: 0, description: 'Random legal moves. A gentle introduction.' },
  { depth: 1, nodes: 400, description: 'Looks for material, checks and simple opportunities.' },
  { depth: 2, nodes: 3_500, description: 'Checks the reply and avoids obvious tactical losses.' },
  { depth: 3, nodes: 18_000, description: 'Plans combinations and looks past forcing exchanges.' },
  { depth: 4, nodes: 90_000, description: 'Our deepest chess search, with careful forcing-move analysis.' },
] as const;
export interface ChessAIResult { move: string | null; depth: number; nodes: number; solved?:'KPK' }
function evaluateChess(chess: Chess): number {
  let score = 0;
  const pieces = chess.board().flat().filter(p => p !== null);
  const endgame = pieces.filter(p => p.type !== 'k' && p.type !== 'p').length < 5;
  for (const piece of pieces) {
    const i = chessIndex(piece.square), r = Math.floor(i / 8), c = i % 8, advancement = piece.color === 'w' ? 6 - r : r - 1;
    const centre = 7 - (Math.abs(3.5 - r) + Math.abs(3.5 - c));
    let value = values[piece.type];
    if (piece.type === 'p') value += advancement * (endgame ? 14 : 7) + (3.5 - Math.abs(3.5 - c)) * 3;
    if (piece.type === 'n' || piece.type === 'b') value += centre * 9;
    if (piece.type === 'k') value += endgame ? centre * 8 : -centre * 8;
    score += (piece.color === 'w' ? 1 : -1) * value;
  }
  return score * chessPlayer(chess);
}
const chessOrder = (moves: ChessMove[], preferred?: string): ChessMove[] => moves.sort((a, b) => {
  const priority = (m: ChessMove) => (m.san === preferred ? 20_000 : 0) + (m.captured ? values[m.captured] * 10 - values[m.piece] : 0) + (m.promotion ? values[m.promotion] : 0) + (m.san.includes('+') ? 35 : 0);
  return priority(b) - priority(a);
});

export function chooseChessMove(session: Pick<ChessSession, 'startFen' | 'moves'>, level: number, random = Math.random): ChessAIResult {
  const chess = chessEngine(session), settings = CHESS_LEVELS[Math.max(0, Math.min(4, level - 1))];
  if (chessOutcome(chess).result !== null) return { move: null, nodes: 0, depth: 0 };
  if(level===5){const move=kingPawnMove(chess);if(move)return {move,nodes:0,depth:0,solved:'KPK'};}
  const moves = chess.moves({ verbose: true });
  if (level <= 1) return { move: moves[Math.floor(random() * moves.length)].san, nodes: 0, depth: 0 };
  let nodes = 0, best = moves[0].san, completed = 0;
  const abort = Symbol('budget');
  const deadline = performance.now() + [0, 300, 800, 2000, 4500][Math.max(0, Math.min(4, level - 1))];
  function search(depth: number, alpha: number, beta: number, ply: number, quiet = 3): number {
    if (++nodes > settings.nodes || (nodes % 16 === 0 && performance.now() > deadline)) throw abort;
    if (chess.isCheckmate()) return -100000 + ply;
    if (chess.isDraw()) return 0;
    const inCheck = chess.isCheck();
    let choices = chess.moves({ verbose: true });
    if (depth <= 0) {
      const standing = evaluateChess(chess);
      if (quiet <= 0 || level === 2) return standing;
      if (!inCheck) {
        if (standing >= beta) return standing;
        alpha = Math.max(alpha, standing);
        choices = choices.filter(m => m.isCapture() || m.isEnPassant() || m.isPromotion());
        if (!choices.length) return standing;
      }
      quiet--;
    }
    let score = depth <= 0 && !inCheck ? evaluateChess(chess) : -Infinity;
    for (const m of chessOrder(choices)) {
      chess.move(m);
      let value: number;
      try { value = -search(depth - 1, -beta, -alpha, ply + 1, quiet); } finally { chess.undo(); }
      score = Math.max(score, value); alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return score;
  }
  for (let depth = 1; depth <= settings.depth; depth++) {
    let candidate = best, score = -Infinity;
    try {
      for (const m of chessOrder(moves.slice(), best)) {
        chess.move(m);
        let value: number;
        try { value = -search(depth - 1, -Infinity, -score, 1); } finally { chess.undo(); }
        if (value > score) { score = value; candidate = m.san; }
      }
      best = candidate; completed = depth;
      if (score > 99900) break;
    } catch (error) { if (error !== abort) throw error; break; }
  }
  return { move: best, depth: completed, nodes };
}
