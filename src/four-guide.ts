import { applyMove, dropRow, fourLine, other } from './rules.ts';
import type { Board, Player } from './rules.ts';

/** Only immediate, playable threats count: unsupported gaps are not winning moves. */
export function fourThreats(board: Board, player: Player): { column: number; cell: number; line: number[] }[] {
  return Array.from({ length: 7 }, (_, column) => {
    const row = dropRow(board, column);
    if (row < 0) return null;
    const line = fourLine(applyMove('four', board, player, column));
    return line.length ? { column, cell: row * 7 + column, line } : null;
  }).filter((value): value is NonNullable<typeof value> => value !== null);
}

export function explainFour(board: Board, player: Player, column: number): { text: string; cells: number[]; danger: number[] } {
  const win = fourThreats(board, player).find(t => t.column === column);
  const threats = fourThreats(board, other(player));
  const next = applyMove('four', board, player, column);
  const replies = win ? [] : fourThreats(next, other(player));
  if (win) return { text: `Column ${column + 1} completes the four outlined discs. Play it to win.`, cells: win.line, danger: [] };
  const block = threats.find(t => t.column === column);
  if (block) return { text: `Column ${column + 1} fills the gap in your opponent’s outlined line.${replies.length ? ' They have another winning threat as well.' : ' That stops their immediate win.'}`, cells: block.line, danger: threats.map(t => t.cell) };
  const future = fourThreats(next, player);
  return { text: `Try column ${column + 1}. ${replies.length ? 'Be careful: your opponent can win on the next move.' : future.length > 1 ? 'It creates two different winning threats for your next turn.' : future.length ? 'It builds a line that could win on your next turn.' : column === 3 ? 'The centre connects to more potential lines in every direction.' : 'It develops your connections without allowing an immediate win.'}`, cells: future.flatMap(t => t.line).filter(i => board[i] === player), danger: threats.map(t => t.cell) };
}
