import { chessGraphic } from './graphics.ts';
import { chessCaptures, chessEngine, chessIndex, chessPlayer, chessSquare, PIECE_NAMES } from './chess.ts';
import type { ChessSession } from './chess.ts';
import { goCoordinate, goGroup, goPositions, placeGo, scoreGo } from './go.ts';
import type { GoSession } from './go.ts';
import type { MatchOptions } from './state.ts';
import type { Player } from './rules.ts';
import { LEVELS } from './ai.ts';

export interface ViewContext { canPlay: boolean; busy: boolean; selected: number | null; focus: number; message: string; tools?: string; flipped?: boolean; inspectMode?: boolean; inspected?: number | null; threats?: boolean; pending?: number | null; atari?: boolean }
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const name = (options: MatchOptions, p: Player) => options.mode === 'computer' ? p === options.human ? 'You' : 'Computer' : p === 1 ? 'Player 1' : 'Player 2';
function players(options: MatchOptions, turn: Player, result: Player | 0 | null, scores: number[], colours: string[], detail: string[]): string {
  return `<div class="players">${([1, -1] as Player[]).map((p, i) => `<div class="player-card ${turn === p && result === null ? 'active-player' : ''}"><span class="player-avatar ${colours[i] === 'White' ? 'white-stone' : 'black-stone'}" aria-hidden="true">${colours[i] === 'White' ? '○' : '●'}</span><div><strong>${name(options, p)}</strong><span>${colours[i]}${detail[i] ? ` · ${detail[i]}` : ''}</span></div><b>${scores[i]}<small> wins</small></b></div>`).join('')}</div>`;
}
function history(moves: { player: Player; text: string }[]): string {
  return `<div class="game-meta"><span>Move ${moves.length + 1}</span><details class="move-history"><summary>Move history (${moves.length})</summary><ol>${moves.map((m, i) => `<li><span>${i + 1}. ${m.player === 1 ? '○' : '●'}</span>${escape(m.text)}</li>`).join('') || '<li>No moves yet.</li>'}</ol></details></div>`;
}
function status(title: string, detail: string, result: boolean, busy: boolean): string {
  return `<div class="status-card ${result ? 'result-card' : ''}" role="status" aria-live="polite" aria-atomic="true"><span class="status-icon ${busy ? 'thinking' : ''}" aria-hidden="true">${result ? '✦' : '○'}</span><div><h2>${escape(title)}</h2><p>${escape(detail)}</p></div>${result ? '<button class="button primary" id="play-again">Play again ↗</button>' : ''}</div>`;
}
export function chessArena(s: ChessSession, context: ViewContext): string {
  const engine = chessEngine(s), turn = chessPlayer(engine), check = engine.isCheck(), moves = engine.history({ verbose: true }), last = moves.at(-1);
  const captures = chessCaptures(moves);
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const balance = engine.board().flat().reduce((sum, p) => sum + (p ? (p.color === 'w' ? 1 : -1) * values[p.type] : 0), 0);
  const capturePanel = `<aside class="chess-captures" aria-label="Captured chess pieces"><h2>Captured pieces</h2>${(['white', 'black'] as const).map(colour => {
    const taken = captures[colour].slice().sort((a, b) => values[b] - values[a]), capturedColour = colour === 'white' ? 'Black' : 'White';
    return `<section class="capture-group" aria-labelledby="captured-by-${colour}"><h3 id="captured-by-${colour}">Taken by ${colour === 'white' ? 'White' : 'Black'}</h3><p class="capture-count">${taken.length} ${taken.length === 1 ? 'piece' : 'pieces'}</p><div class="captured-pieces">${taken.map(piece => `<span class="captured-piece chess-${capturedColour.toLowerCase()}" role="img" aria-label="${capturedColour} ${PIECE_NAMES[piece]}" title="${capturedColour} ${PIECE_NAMES[piece]}">${chessGraphic(piece)}</span>`).join('') || '<span class="captures-empty">None yet</span>'}</div></section>`;
  }).join('')}<p class="material-balance">${balance === 0 ? 'Material is level' : `${balance > 0 ? 'White' : 'Black'} +${Math.abs(balance)} in material`}<small>Pawn 1 · knight / bishop 3<br>Rook 5 · queen 9</small></p></aside>`;
  const targets = context.selected === null ? [] : engine.moves({ square: chessSquare(context.selected), verbose: true }).map(m => chessIndex(m.to));
  const flipped = context.flipped ?? (s.options.mode === 'computer' && s.options.human === -1);
  const indices = Array.from({ length: 64 }, (_, i) => flipped ? 63 - i : i);
  const pieces = engine.board().flat();
  const opponent = engine.turn() === 'w' ? 'b' : 'w';
  const canPlay = context.canPlay;
  const board = `<div class="chess-board" id="board" tabindex="0" role="group" aria-label="Chess board${flipped ? ', Black side at the bottom' : ''}. Arrow keys move focus; Enter selects a piece and destination.">${indices.map(i => {
    const piece = pieces[i], square = chessSquare(i), colour = piece?.color === 'w' ? 'White' : 'Black';
    const target = targets.includes(i), checkedKing = check && piece?.type === 'k' && (piece.color === 'w' ? 1 : -1) === turn;
    const attacked = context.threats && engine.isAttacked(square, opponent);
    return `<button class="chess-square ${(Math.floor(i / 8) + i % 8) % 2 === 0 ? 'light-square' : ''} ${context.selected === i ? 'selected-square' : ''} ${target ? 'target-square' : ''} ${last && (last.from === square || last.to === square) ? 'last-square' : ''} ${checkedKing ? 'king-in-check' : ''} ${attacked && piece?.color === engine.turn() ? 'under-attack' : ''}" data-chess-square="${i}" tabindex="${context.focus === i ? '0' : '-1'}" ${!canPlay ? 'disabled' : ''} aria-label="${square}, ${piece ? `${colour} ${PIECE_NAMES[piece.type]}` : 'empty'}${target ? ', legal destination' : ''}${checkedKing ? ', in check' : ''}${attacked ? `, attacked by ${opponent === 'w' ? 'White' : 'Black'}` : ''}">${attacked ? '<span class="threat-dot" aria-hidden="true">!</span>' : ''}<span class="square-coordinate" aria-hidden="true">${square}</span>${piece ? `<span class="chess-piece ${piece.color === 'w' ? 'chess-white' : 'chess-black'}" aria-hidden="true">${chessGraphic(piece.type)}</span>` : target ? '<span class="move-dot" aria-hidden="true"></span>' : ''}</button>`;
  }).join('')}</div>`;
  const result = s.result !== null, who = name(s.options, s.result || turn);
  const title = result ? s.result === 0 ? 'A drawn game.' : `${who === 'You' ? 'You win' : `${who} wins`}!`
    : context.busy ? 'Computer is thinking…' : check ? `${turn === 1 ? 'White' : 'Black'} is in check.` : `${name(s.options, turn) === 'You' ? 'Your' : `${name(s.options, turn)}’s`} move.`;
  const detail = context.message || (result ? s.reason : context.busy ? `${LEVELS[s.options.level - 1].name} · finding a legal move.` : check ? 'Protect your king: capture, block or move away.' : 'Select a piece, then a marked square. White moves first.');
  return `${players(s.options, turn, s.result, s.scores, ['White', 'Black'], ['', ''])}${context.tools ?? ''}<div class="board-stage chess"><div class="chess-table">${board}${capturePanel}</div></div>${status(title, detail, result, context.busy)}${history(moves.map(m => ({ player: m.color === 'w' ? 1 : -1, text: m.san })))}`;
}
export function goArena(s: GoSession, context: ViewContext): string {
  const scoring = s.phase === 'score', score = scoring ? scoreGo(s.board, s.size, s.komi, s.dead) : null;
  const stars = s.size === 9 ? [2, 6] : s.size === 13 ? [3, 9] : [3, 9, 15];
  const last = s.moves.at(-1)?.point, result = s.result !== null;
  const canSelect = context.inspectMode || (scoring ? !result : context.canPlay);
  const inspected = context.inspected != null ? goGroup(s.board, s.size, context.inspected) : null;
  const preview = context.pending != null && !context.inspectMode ? placeGo(s.board, s.size, s.turn, context.pending, goPositions(s)) : null;
  const board = `<div class="go-board" id="board" style="--go-size:${s.size}" tabindex="0" role="group" aria-label="${s.size} by ${s.size} Go board. Arrow keys move focus; Enter places a stone${scoring ? ' or marks a dead group' : ''}.">${s.board.map((n, i) => {
    const row = Math.floor(i / s.size), col = i % s.size, star = (stars.includes(row) && stars.includes(col)) || (row === Math.floor(s.size / 2) && col === row);
    const group = n ? goGroup(s.board, s.size, i) : null, territory = score?.territory[i];
    return `<button class="go-point ${inspected?.stones.includes(i) ? 'inspected-stone' : ''} ${inspected?.liberties.includes(i) ? 'inspected-liberty' : ''} ${row === 0 ? 'edge-top' : ''} ${row === s.size - 1 ? 'edge-bottom' : ''} ${col === 0 ? 'edge-left' : ''} ${col === s.size - 1 ? 'edge-right' : ''} ${i === last ? 'last-point' : ''} ${s.dead.includes(i) ? 'dead-group' : ''} ${preview?.captured.includes(i) ? 'preview-captured' : ''}" data-point="${i}" tabindex="${context.focus === i ? '0' : '-1'}" ${!canSelect || (!scoring && !!n && !context.inspectMode) ? 'disabled' : ''} aria-label="${goCoordinate(i, s.size)}, ${n ? `${n === 1 ? 'Black' : 'White'} stone, ${group!.liberties.length} liberties${s.dead.includes(i) ? ', marked dead' : ''}` : context.pending === i && preview && !preview.error ? `preview ${s.turn === 1 ? 'Black' : 'White'} stone, not placed` : 'empty'}">${inspected?.liberties.includes(i) ? '<span class="liberty-marker" aria-hidden="true"></span>' : ''}${row === 0 ? `<span class="go-column-label" aria-hidden="true">${'ABCDEFGHJKLMNOPQRST'[col]}</span>` : ''}${col === 0 ? `<span class="go-row-label" aria-hidden="true">${s.size - row}</span>` : ''}${n ? `<span class="go-stone ${n === 1 ? 'black-stone' : 'white-stone'}" aria-hidden="true">${i === last ? '<span class="last-stone-mark"></span>' : ''}${s.dead.includes(i) ? '<span class="dead-mark">×</span>' : ''}${context.atari && group?.liberties.length === 1 && i === Math.min(...group.stones) ? '<span class="atari-mark" title="Atari: one liberty">!</span>' : ''}</span>` : context.pending === i && preview && !preview.error ? `<span class="go-stone ${s.turn === 1 ? 'black-stone' : 'white-stone'} go-preview" aria-hidden="true">?</span>` : territory ? `<span class="territory-mark ${territory === 1 ? 'black-stone' : 'white-stone'}" aria-hidden="true"></span>` : star ? '<span class="hoshi" aria-hidden="true"></span>' : ''}</button>`;
  }).join('')}</div>`;
  const title = result ? `${name(s.options, s.result || 1)} ${s.result === s.options.human && s.options.mode === 'computer' ? 'win' : 'wins'}!` : scoring ? 'Review the score.' : context.busy ? 'Computer is thinking…' : `${name(s.options, s.turn) === 'You' ? 'Your' : `${name(s.options, s.turn)}’s`} move.`;
  const detail = context.message || (result ? s.reason : scoring ? 'Click whole groups both sides agree are dead. Resume play to settle disputed groups.' : context.busy ? `${LEVELS[s.options.level - 1].name} · reading the board.` : `${s.turn === 1 ? 'Black' : 'White'} to play. Stones go on intersections. ${s.passes ? 'One pass: a second pass opens scoring.' : 'Surround groups to capture them.'}`);
  const scorePanel = score ? `<div class="score-panel"><div><span>Black area</span><strong>${score.black}</strong><small>${score.stones[0]} stones + ${score.empty[0]} surrounded points</small></div><div><span>White area</span><strong>${score.white}</strong><small>${score.stones[1]} stones + ${score.empty[1]} points + ${s.komi} komi</small></div><p>Area scoring. Captures are shown for reference and are not added again. Dead groups require review; disputed groups should be played out.</p>${!result ? '<div class="two-fields"><button class="button" id="resume-go">Resume play</button><button class="button primary" id="finish-go">Confirm score</button></div>' : ''}</div>` : '';
  return `${players(s.options, s.turn, s.result, s.scores, ['Black', 'White'], [`${s.captures[0]} captures`, `${s.captures[1]} captures`])}${context.tools ?? ''}<div class="board-stage go">${board}</div>${scorePanel}${status(title, detail, result, context.busy)}${history(s.moves)}`;
}
export function advancedRules(game: 'chess' | 'go'): string {
  return `<details class="rules-card"><summary>How to play <span aria-hidden="true">＋</span></summary>${game === 'chess'
    ? '<p>White plays first. Select a piece to see its legal moves, then choose a destination. Win by checkmating the other king; a king is never captured.</p><p>Castling, en passant and promotion are supported. Choose queen, rook, bishop or knight when your pawn reaches the last rank. A check must be answered.</p><p>Stalemate, insufficient material, threefold repetition and the 50-move rule are draws. Repetition and the 50-move rule are applied automatically in this casual app.</p><p>Arrow keys move focus, Enter selects. When playing Black against the computer, the board faces your side.</p>'
    : '<p>Black plays first. Put a stone on an empty intersection. Stones stay put; a connected group is captured when all its adjacent empty points (liberties) are occupied by the opponent.</p><p>Suicide is forbidden. Positional superko forbids repeating an earlier board position. Capturing stones before checking your own liberties allows legal capture escapes.</p><p>Two consecutive passes open scoring. Mark whole groups both players agree are dead, or resume play to resolve disputes. Confirm when the board is settled.</p><p>Chinese-style area scoring counts living stones plus empty regions bordered only by that colour. White gets 7.5 komi. Mixed-border empty regions are neutral. Captures are not added separately. No automatic life-and-death adjudication is used.</p><p>Choose 9 × 9 for a quick game, or 13 × 13 / 19 × 19 for larger boards. Arrow keys move focus, Enter places a stone. The Go computer is a practice bot with local tactical reading.</p><a href="https://britgo.org/intro/intro2.html" target="_blank" rel="noopener">Learn Go with the British Go Association ↗</a>'}</details>`;
}
