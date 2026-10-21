// Pure rules shared by the interface, computer opponents and regression tests.
export type Player = 1 | -1;
export type DuelGame = 'four' | 'draughts';
export type Board = number[];
export interface DraughtsMove { from: number; path: number[]; captures: number[] }
export type Move = number | DraughtsMove;
export const other = (player: Player): Player => player === 1 ? -1 : 1;

export function initialBoard(game: DuelGame): Board {
  if (game === 'four') return Array(42).fill(0);
  return Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8), col = i % 8;
    return (row + col) % 2 === 0 ? 0 : row < 3 ? -1 : row > 4 ? 1 : 0;
  });
}

export function fourMoves(board: Board): number[] {
  return [3, 2, 4, 1, 5, 0, 6].filter(col => board[col] === 0);
}

export function dropRow(board: Board, col: number): number {
  if (!Number.isInteger(col) || col < 0 || col > 6) return -1;
  for (let row = 5; row >= 0; row--) if (!board[row * 7 + col]) return row;
  return -1;
}

export function fourLine(board: Board): number[] {
  for (let row = 0; row < 6; row++) for (let col = 0; col < 7; col++) {
    const start = row * 7 + col;
    if (!board[start]) continue;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const endRow = row + dr * 3, endCol = col + dc * 3;
      if (endRow < 0 || endRow > 5 || endCol < 0 || endCol > 6) continue;
      const line = Array.from({ length: 4 }, (_, j) => (row + dr * j) * 7 + col + dc * j);
      if (line.every(i => board[i] === board[start])) return line;
    }
  }
  return [];
}

const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const directions = (piece: number) => Math.abs(piece) === 2 ? [-1, 1] : piece > 0 ? [-1] : [1];
const crowned = (piece: number, row: number) => Math.abs(piece) === 1 && (piece > 0 ? row === 0 : row === 7);

// English draughts: mandatory captures; a complete multi-jump is one move.
// Men capture forwards, kings step in either direction, and crowning ends a turn.
export function draughtsMoves(board: Board, player: Player): DraughtsMove[] {
  const captures: DraughtsMove[] = [], quiet: DraughtsMove[] = [];
  function jumps(b: Board, from: number, at: number, piece: number, path: number[], taken: number[]): void {
    const row = Math.floor(at / 8), col = at % 8;
    let continued = false;
    for (const dr of directions(piece)) for (const dc of [-1, 1]) {
      const r = row + dr * 2, c = col + dc * 2, mid = (row + dr) * 8 + col + dc;
      // Captured pieces remain blockers until the entire sequence is complete.
      if (!inside(r, c) || b[r * 8 + c] !== 0 || b[mid] * player >= 0 || taken.includes(mid)) continue;
      continued = true;
      const to = r * 8 + c, next = b.slice();
      next[at] = 0;
      next[to] = piece;
      const nextPath = [...path, to], nextTaken = [...taken, mid];
      if (crowned(piece, r)) captures.push({ from, path: nextPath, captures: nextTaken });
      else jumps(next, from, to, piece, nextPath, nextTaken);
    }
    if (!continued && taken.length) captures.push({ from, path, captures: taken });
  }
  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (piece * player <= 0) continue;
    jumps(board, from, from, piece, [], []);
    const row = Math.floor(from / 8), col = from % 8;
    for (const dr of directions(piece)) for (const dc of [-1, 1]) {
      const r = row + dr, c = col + dc;
      if (inside(r, c) && board[r * 8 + c] === 0) quiet.push({ from, path: [r * 8 + c], captures: [] });
    }
  }
  return captures.length ? captures : quiet;
}

export function legalMoves(game: DuelGame, board: Board, player: Player): Move[] {
  return game === 'four' ? fourMoves(board) : draughtsMoves(board, player);
}

export function applyMove(game: DuelGame, board: Board, player: Player, move: Move): Board {
  const next = board.slice();
  if (game === 'four') {
    const col = move as number, row = dropRow(board, col);
    if (row < 0) throw new Error('Illegal column');
    next[row * 7 + col] = player;
  } else {
    const m = move as DraughtsMove, piece = board[m.from], to = m.path.at(-1)!;
    next[m.from] = 0;
    m.captures.forEach(i => { next[i] = 0; });
    next[to] = crowned(piece, Math.floor(to / 8)) ? player * 2 : piece;
  }
  return next;
}

export function winner(game: DuelGame, board: Board, turn: Player): Player | 0 | null {
  if (game === 'four') {
    const line = fourLine(board);
    return line.length ? board[line[0]] as Player : fourMoves(board).length ? null : 0;
  }
  return draughtsMoves(board, turn).length ? null : other(turn);
}

export const positionKey = (board: Board, turn: Player) => `${turn}:${board.join(',')}`;

export function drawReason(positions: string[], quietPlies: number): string | null {
  const last = positions.at(-1);
  if (last && positions.filter(p => p === last).length >= 3) return 'Threefold repetition';
  // 40 turns by each player with neither a capture nor a man advancing.
  if (quietPlies >= 80) return '40 moves each without a capture or a man moving';
  return null;
}

export const squareName = (i: number) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;
export function moveLabel(game: DuelGame, move: Move): string {
  if (game === 'four') return `Column ${(move as number) + 1}`;
  const m = move as DraughtsMove;
  return [m.from, ...m.path].map(squareName).join(m.captures.length ? ' × ' : ' → ');
}
