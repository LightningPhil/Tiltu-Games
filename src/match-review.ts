import { chessGraphic, discEmblem } from './graphics.ts';
import { applyMove, draughtsMoves, dropRow, moveLabel, squareName } from './rules.ts';
import type { DraughtsMove } from './rules.ts';
import { chessEngine, chessIndex, playChess, PIECE_NAMES } from './chess.ts';
import { goCoordinate } from './go.ts';
import { BoardMotion, draughtsMotion } from './movement.ts';
import type { MotionSpeed, MotionStep } from './movement.ts';
import type { MatchGame, SavedState } from './state.ts';

export interface ReviewFrame { cells: string[]; caption: string; steps: MotionStep[]; piece?: string }
const disc = (n: number) => n ? `<span class="disc p${n > 0 ? 1 : 2} ${Math.abs(n) === 2 ? 'king-disc' : ''}"><span class="piece-mark">${discEmblem(n)}</span></span>` : '';
const same = (a: number[], b: number[]) => a.every((n, i) => n === b[i]);
export function matchFrames(state: SavedState, game: MatchGame): ReviewFrame[] {
  if (game === 'chess') {
    const engine = chessEngine({ ...state.chess, moves: [] });
    const cells = () => engine.board().flat().map(p => p ? `<span class="chess-piece ${p.color === 'w' ? 'chess-white' : 'chess-black'}">${chessGraphic(p.type)}</span>` : '');
    const frames: ReviewFrame[] = [{ cells: cells(), caption: 'Starting position', steps: [] }];
    state.chess.moves.forEach((san, i) => {
      const m = engine.move(san), steps: MotionStep[] = [{ from: chessIndex(m.from), to: chessIndex(m.to), captures: m.isEnPassant() ? [chessIndex(m.to) + (m.color === 'w' ? 8 : -8)] : m.captured ? [chessIndex(m.to)] : [] }];
      if (m.isKingsideCastle()) steps[0].second = { from: m.color === 'w' ? 63 : 7, to: m.color === 'w' ? 61 : 5 };
      if (m.isQueensideCastle()) steps[0].second = { from: m.color === 'w' ? 56 : 0, to: m.color === 'w' ? 59 : 3 };
      frames.push({ cells: cells(), steps, caption: `${i + 1}. ${m.color === 'w' ? 'White' : 'Black'} · ${m.san} · ${PIECE_NAMES[m.piece]} ${m.from} → ${m.to}${m.captured ? ` · takes ${PIECE_NAMES[m.captured]}` : ''}${m.promotion ? ` · promotes to ${PIECE_NAMES[m.promotion]}` : ''}` });
    });
    return frames;
  }
  const s = state[game], boards = [...s.history.map(h => h.board), s.board];
  return boards.map((b, i) => {
    const before = boards[i - 1], move = s.moves[i - 1];
    let steps: MotionStep[] = [], piece: string | undefined;
    if (before && move) {
      if (game === 'four') { const col = b.findIndex((n, j) => n !== before[j]) % 7; steps = [{ from: null, to: dropRow(before, col) * 7 + col, captures: [] }]; piece = disc(move.player); }
      else if (game === 'draughts') { const m = draughtsMoves(before, move.player).find(m => same(applyMove('draughts', before, move.player, m), b)); if (m) steps = draughtsMotion(m); }
      else { const m = state.go.moves[i - 1]; if (m.point !== null) { steps = [{ from: null, to: m.point, captures: before.map((n, j) => n && !b[j] ? j : -1).filter(j => j >= 0) }]; piece = `<span class="go-stone ${m.player === 1 ? 'black-stone' : 'white-stone'}"></span>`; } }
    }
    return { cells: b.map(n => game === 'go' ? n ? `<span class="go-stone ${n === 1 ? 'black-stone' : 'white-stone'}"></span>` : '' : disc(n)), caption: !move ? 'Starting position' : `${i}. ${game === 'go' ? move.player === 1 ? 'Black' : 'White' : move.player === 1 ? 'Circle' : 'Diamond'} · ${move.text}`, steps, piece };
  });
}

/** Review uses copies of positions. It never rewinds the live match or its scores. */
export function openMatchReview(state: SavedState, game: MatchGame, onClose: () => void, preview?: string | DraughtsMove): void {
  let frames: ReviewFrame[];
  if (preview) {
    const copy = structuredClone(state);
    if (game === 'chess' && typeof preview === 'string') playChess(copy.chess, preview);
    else if (game === 'draughts' && typeof preview !== 'string') {
      const s = copy.draughts; s.history.push({ board: s.board.slice(), turn: s.turn, quiet: s.quiet }); s.moves.push({ player: s.turn, text: moveLabel('draughts', preview) }); s.board = applyMove('draughts', s.board, s.turn, preview);
    }
    frames = matchFrames(copy, game).slice(-2); frames[0].caption = 'Your current position'; frames[1].caption = `Suggested move · ${frames[1].caption}`;
  } else frames = matchFrames(state, game);
  const size = game === 'four' ? 7 : game === 'go' ? state.go.size : 8;
  const dialog = document.createElement('dialog'), motion = new BoardMotion();
  dialog.className = 'confirm-dialog review-dialog';
  dialog.innerHTML = '<div class="review-heading"><div><p class="eyebrow">MOVE REVIEW</p><h2>Watch it again</h2></div><button class="button" data-review="close">Back to game</button></div><p class="review-caption" role="status"></p><div class="review-stage"></div><div class="review-controls"><button class="button" data-review="first" aria-label="Starting position">|←</button><button class="button" data-review="prev">← Previous</button><button class="button primary" data-review="next">Next →</button><button class="button" data-review="replay">▶ Replay move</button></div><label>Position<input type="range" min="0" step="1" aria-label="Review position"></label><p class="setting-help">← → step through moves. Home / End jump to the start or latest position. Your live match stays where you left it.</p>';
  document.body.append(dialog);
  if (preview) { dialog.querySelector('h2')!.textContent = 'Try the idea'; dialog.querySelector('.eyebrow')!.textContent = 'TUTOR PREVIEW'; }
  let index = frames.length - 1, playing = false, revision = 0;
  const slider = dialog.querySelector<HTMLInputElement>('input')!; slider.max = String(index);
  const paint = () => {
    const frame = frames[index]; slider.value = String(index); slider.setAttribute('aria-valuetext', frame.caption);
    dialog.querySelector('.review-caption')!.textContent = frame.caption;
    dialog.querySelector('.review-stage')!.innerHTML = `<div class="review-board ${game === 'four' ? 'four-board' : game === 'draughts' ? 'draughts-board' : game === 'chess' ? 'chess-board' : 'go-board'}" style="--go-size:${size};grid-template-columns:repeat(${size},minmax(0,1fr))">${frame.cells.map((html, i) => `<span data-review-square="${i}" class="${game === 'four' ? 'four-slot' : game === 'go' ? 'go-point' : game === 'chess' ? 'chess-square' : 'draughts-square'} ${(Math.floor(i / size) + i % size) % 2 === 0 && (game === 'draughts' || game === 'chess') ? 'light-square' : ''}" aria-label="${game === 'go' ? goCoordinate(i, size) : game === 'four' ? `Column ${i % 7 + 1}, row ${Math.floor(i / 7) + 1}` : squareName(i)}">${html}</span>`).join('')}</div>`;
    dialog.querySelector<HTMLButtonElement>('[data-review="prev"]')!.disabled = index === 0;
    dialog.querySelector<HTMLButtonElement>('[data-review="first"]')!.disabled = index === 0;
    dialog.querySelector<HTMLButtonElement>('[data-review="next"]')!.disabled = index === frames.length - 1;
    dialog.querySelector<HTMLButtonElement>('[data-review="replay"]')!.disabled = index === 0;
  };
  const cancel = () => { revision++; motion.cancel(); playing = false; };
  const show = async (next: number, animate: boolean) => {
    cancel(); const id = revision, target = Math.max(0, Math.min(frames.length - 1, next));
    if (animate && target > 0) {
      index = target - 1; paint(); index = target; playing = true;
      dialog.querySelector('.review-caption')!.textContent = frames[target].caption;
      await motion.play(dialog.querySelector('.review-board')!, frames[target].steps, state.preferences.motion as MotionSpeed, i => `[data-review-square="${i}"]`, frames[target].piece);
      if (id !== revision) return;
    }
    index = target; playing = false; paint();
  };
  dialog.addEventListener('click', event => { const action = (event.target as HTMLElement).closest<HTMLElement>('[data-review]')?.dataset.review; if (!action) return; if (action === 'close') { dialog.close(); return; } if (playing) cancel(); void show(action === 'first' ? 0 : action === 'prev' ? index - 1 : action === 'next' ? index + 1 : index, action === 'next' || action === 'replay'); });
  slider.addEventListener('input', () => { void show(Number(slider.value), false); });
  dialog.addEventListener('keydown', event => { if (event.target === slider || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); void show(event.key === 'Home' ? 0 : event.key === 'End' ? frames.length - 1 : index + (event.key === 'ArrowRight' ? 1 : -1), event.key === 'ArrowRight'); });
  const previous = document.activeElement as HTMLElement;
  dialog.addEventListener('close', () => { cancel(); dialog.remove(); previous?.focus(); onClose(); }, { once: true });
  paint(); dialog.showModal();
  if (preview) void show(index, true);
}
