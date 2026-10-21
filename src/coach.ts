import { chessEngine, chessIndex, PIECE_NAMES } from './chess.ts';
import type { ChessSession } from './chess.ts';
import { applyMove, draughtsMoves, initialBoard, moveLabel } from './rules.ts';
import type { Board, DraughtsMove } from './rules.ts';
import type { DuelSession } from './state.ts';
export interface MoveAdvice { title: string; reasons: string[]; chess?: string; draughts?: DraughtsMove }
export function chessPosition(s: ChessSession): string[] {
  const chess = chessEngine(s), pieces = chess.board().flat().filter(p => p !== null), values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const material = pieces.reduce((n, p) => n + (p.color === 'w' ? 1 : -1) * values[p.type], 0);
  return [chess.isCheck() ? 'Your king is in check: every legal move must answer it.' : 'Develop pieces, keep your king safe and look at the opponent’s threats before moving.', `${chess.moves().length} legal moves. ${material === 0 ? 'Material is level.' : `${material > 0 ? 'White' : 'Black'} has about ${Math.abs(material)} pawn${Math.abs(material) > 1 ? 's' : ''} more material.`}`, 'Piece values are a guide: pawn 1, knight/bishop 3, rook 5, queen 9. Checkmate matters more than material.'];
}
export function explainChessMove(s: ChessSession, san: string): MoveAdvice {
  const chess = chessEngine(s), wasCheck = chess.isCheck(), played = chess.move(san), reasons: string[] = [];
  if (chess.isCheckmate()) reasons.push('This move checkmates: the king has no legal way to escape the attack.');
  else {
    if (wasCheck) reasons.push('This is a legal reply to check and makes the king safe.');
    if (played.captured) reasons.push(`Captures a ${PIECE_NAMES[played.captured]}. Count the possible recaptures before taking material.`);
    if (played.isKingsideCastle() || played.isQueensideCastle()) reasons.push('Castling moves the king away from the centre and brings the rook toward an active file.');
    if (played.promotion) reasons.push(`The pawn promotes to a ${PIECE_NAMES[played.promotion]}.`);
    if (chess.isCheck()) reasons.push('Gives check, forcing the opponent to answer the king’s threat.');
    const reply = chess.moves({ verbose: true }).find(m => m.to === played.to && m.captured);
    if (reply) reasons.push(`The opponent can capture on ${played.to} with ${reply.san}; this may be an exchange rather than a free gain.`);
    const index = chessIndex(played.to), row = Math.floor(index / 8), column = index % 8;
    if ((played.piece === 'n' || played.piece === 'b') && row >= 2 && row <= 5 && column >= 2 && column <= 5) reasons.push('A central minor piece can influence more useful squares.');
    if (chess.isStalemate()) reasons.push('This produces stalemate: the opponent has no legal move and is not in check, so the game is drawn.');
    else if (chess.isDraw()) reasons.push('This position is drawn under the game’s draw rules.');
    if (!reasons.length) reasons.push(`Moves the ${PIECE_NAMES[played.piece]} from ${played.from} to ${played.to}. The search compares activity, material and king safety after the opponent’s replies; check their forcing checks, captures and threats.`);
  }
  reasons.push('The tutor is a practice guide using a limited search. Try the idea on the board, or use Undo to compare another move.');
  return { title: `Try ${played.san}`, reasons, chess: played.san };
}
export function draughtsPosition(s: DuelSession): string[] {
  const moves = draughtsMoves(s.board, s.turn), men = s.board.filter(n => n * s.turn > 0 && Math.abs(n) === 1).length, kings = s.board.filter(n => n * s.turn > 0 && Math.abs(n) === 2).length;
  return [moves[0]?.captures.length ? 'A capture is compulsory. You may choose any legal capture branch, but must finish that piece’s full sequence.' : 'Men move one dark square diagonally forward. Kings also move and capture backwards.', `${moves.length} legal turns. This side has ${men} men and ${kings} kings.`, 'Keep pieces supported, look for forced jumps and work toward the far edge to make kings.'];
}
export function explainDraughtsMove(s: DuelSession, move: DraughtsMove): MoveAdvice {
  const board = applyMove('draughts', s.board, s.turn, move), landing = move.path.at(-1)!, reasons: string[] = [];
  if (move.captures.length) reasons.push(`Takes ${move.captures.length} piece${move.captures.length > 1 ? 's' : ''}${move.captures.length > 1 ? ' in one compulsory multi-jump' : ''}. Follow every landing square.`);
  if (Math.abs(s.board[move.from]) === 1 && Math.abs(board[landing]) === 2) reasons.push('Reaches the far edge and becomes a king. In English draughts, promotion ends this turn.');
  if (draughtsMoves(board, s.turn === 1 ? -1 : 1).some(m => m.captures.includes(landing))) reasons.push('The opponent can jump this piece next. The tutor may be choosing an exchange; compare what each side gains.');
  else reasons.push('The moved piece cannot be taken by an immediate legal jump.');
  if(Math.abs(s.board[move.from])===1&&Math.abs(board[landing])===1)reasons.push(`This man is now ${s.turn===1?Math.floor(landing/8):7-Math.floor(landing/8)} row(s) from the crowning edge.`);
  if (!move.captures.length) reasons.push('A quiet positional move. Keep diagonal support and check whether you are giving the opponent a forced capture.');
  reasons.push('This is a practical suggestion from a limited search, rather than a guaranteed winning line.');
  return { title: `Try ${moveLabel('draughts', move)}`, reasons, draughts: move };
}
export interface CoachLesson { title: string; question: string; choices: string[]; correct: number; explanation: string; fen?: string; board?: Board }
const diagram = (...pieces: [number, number][]): Board => { const board = Array(64).fill(0); pieces.forEach(([i, p]) => { board[i] = p; }); return board; };
export const CHESS_LESSONS: CoachLesson[] = [
  { title: 'Protect the king', fen: '4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1', question: 'The white rook shields its king. What happens if it moves sideways to d2?', choices: ['It is a legal developing move', 'It is illegal: it exposes the king to check', 'It wins the black rook'], correct: 1, explanation: 'The e2 rook is pinned to its king by the black rook. A move exposing your own king to check is illegal.' },
  { title: 'Find checkmate', fen: '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1', question: 'White can play Qg7. What is the result?', choices: ['Stalemate', 'A draw by repetition', 'Checkmate'], correct: 2, explanation: 'Qg7 checks the king on h8. The white king protects the queen, and every escape square is covered.' },
  { title: 'Castling', fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', question: 'When may the white king castle?', choices: ['When the route is clear, king and rook have not moved, and the king is not in, through or into check', 'Whenever the rook is safe', 'Even after the king has moved back to e1'], correct: 0, explanation: 'All three king squares must be safe, the squares between king and rook must be empty, and the castling rights must remain.' },
  { title: 'Promotion', fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1', question: 'The white pawn reaches a8. What can it become?', choices: ['Only a queen', 'Queen, rook, bishop or knight', 'Any captured piece, including a king'], correct: 1, explanation: 'Choose queen, rook, bishop or knight. A queen is often strongest, but an underpromotion can solve a particular position.' },
  { title: 'Piece values', fen: '4k3/8/8/8/8/8/3N4/4K3 w - - 0 1', question: 'What is a useful approximate value for a knight?', choices: ['One pawn', 'Three pawns', 'Nine pawns'], correct: 1, explanation: 'A knight is roughly three pawns, like a bishop. Activity and king safety can matter more than this rough count.' },
  { title: 'Stalemate', fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', question: 'Black has no legal move, but its king is not attacked. What is that?', choices: ['Checkmate for White', 'Black must pass', 'Stalemate: a draw'], correct: 2, explanation: 'No legal moves plus no check is stalemate. Always leave a threat to the king when trying to finish a winning endgame.' },
];
export const DRAUGHTS_LESSONS: CoachLesson[] = [
  { title: 'Dark squares', board: initialBoard('draughts'), question: 'How does an uncrowned man move in English draughts?', choices: ['One dark square diagonally forward', 'One square in any direction', 'Any distance diagonally'], correct: 0, explanation: 'Men move and capture forward on dark squares. A king can use either diagonal direction.' },
  { title: 'Capture is compulsory', board: diagram([42, 1], [35, -1], [49, 1]), question: 'Circle can jump from 42 over 35 to 28. May Circle choose a quiet move instead?', choices: ['Yes, if the quiet move makes a king', 'No, a capture must be taken', 'Only when playing the computer'], correct: 1, explanation: 'If any capture is available, a quiet move is illegal. Any complete legal capture branch may be chosen.' },
  { title: 'Finish the jump', board: diagram([42, 1], [35, -1], [21, -1]), question: 'After jumping from 42 to 28, this man can also jump to 14. What must happen?', choices: ['Stop after the first capture', 'Move a different piece', 'Continue with the same piece to 14'], correct: 2, explanation: 'A capture sequence is one turn. The same piece must finish its available jumps before the opponent plays.' },
  { title: 'Kings go back', board: diagram([28, 2], [35, -1]), question: 'Can this crowned Circle king jump backwards over the Diamond man?', choices: ['Yes, kings capture in either diagonal direction', 'No, all pieces only capture forward', 'Only after a quiet move'], correct: 0, explanation: 'English draughts kings move one diagonal square, and jump adjacent enemy pieces in either direction. They are not flying kings.' },
  { title: 'Crowning ends the turn', board: diagram([17, 1], [10, -1], [12, -1]), question: 'A man jumps into the far row and becomes a king. Can it immediately jump back as a king?', choices: ['Yes, every new king gets an extra jump', 'No, promotion ends this turn', 'Only if it captures two pieces'], correct: 1, explanation: 'In English draughts, reaching the king row ends the capture turn. The crowned king can move backwards on its next turn.' },
  { title: 'Supported pieces', board: diagram([42, 1], [49, 1], [33, -1]), question: 'Why keep pieces connected diagonally?', choices: ['It makes them immune to capture', 'It lets a man move backwards', 'A supporting piece can often recapture after an exchange'], correct: 2, explanation: 'Support helps you avoid losing a piece for nothing. Still calculate forced jumps: a supported piece can be part of a tactical trap.' },
];
