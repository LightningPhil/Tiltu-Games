import { boxShape } from './sudoku.ts';
import type { SudokuSize } from './sudoku.ts';
import type { TetraSession } from './tetravex.ts';

/** Only complete, valid units earn the quiet progress edge on a Sudoku board. */
export function sudokuFinishedRows(values: number[], size: SudokuSize): boolean[] {
  return Array.from({ length: size }, (_, row) => {
    const unit = values.slice(row * size, (row + 1) * size);
    return unit.every(n => n >= 1 && n <= size) && new Set(unit).size === size;
  });
}
export function sudokuBoxTint(row: number, col: number, size: SudokuSize): boolean {
  const [height, width] = boxShape(size);
  return (Math.floor(row / height) + Math.floor(col / width)) % 2 === 1;
}
/** Clockwise N/E/S/W bits; row boundaries never count as neighbouring tiles. */
export function tetraJoinedEdges(s: Pick<TetraSession, 'board' | 'tiles' | 'size'>, at: number): number {
  const id = s.board[at]; if (id == null) return 0;
  const t = s.tiles[id], row = Math.floor(at / s.size), col = at % s.size;
  const adjacent = (i: number) => s.board[i] == null ? null : s.tiles[s.board[i]!];
  const north = row > 0 ? adjacent(at - s.size) : null, east = col + 1 < s.size ? adjacent(at + 1) : null;
  const south = row + 1 < s.size ? adjacent(at + s.size) : null, west = col > 0 ? adjacent(at - 1) : null;
  return (north?.s === t.n ? 1 : 0) | (east?.w === t.e ? 2 : 0) | (south?.n === t.s ? 4 : 0) | (west?.e === t.w ? 8 : 0);
}

/** The win thread follows the actual slot centres, including after a resize. */
export class BoardArtwork {
  private board: HTMLElement | null = null;
  private observer: ResizeObserver | null = null;
  mount(root: HTMLElement): void {
    this.observer?.disconnect();
    this.board = root.querySelector('.four-board:has(.winning)');
    if (!this.board) return;
    this.paint();
    this.observer ??= new ResizeObserver(() => this.paint()); this.observer.observe(this.board);
  }
  private paint(): void {
    const board = this.board; if (!board?.isConnected) return;
    board.querySelector('.winning-thread')?.remove();
    const slots = [...board.querySelectorAll<HTMLElement>('.four-slot:has(.winning)')]; if (slots.length < 4) return;
    const box = board.getBoundingClientRect(), width = board.clientWidth, height = board.clientHeight;
    const points = slots.map(slot => { const r = slot.getBoundingClientRect(); return { x: r.left - box.left - board.clientLeft + r.width / 2, y: r.top - box.top - board.clientTop + r.height / 2, radius: r.width * .46 }; });
    // Slots are emitted column first, so first/last are always the line ends.
    const a = points[0], b = points.at(-1)!, svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('class', 'winning-thread'); svg.setAttribute('aria-hidden','true');
    if (slots[0].querySelector('.p2')) svg.classList.add('rival-thread');
    svg.innerHTML = `<path class="thread-glow" d="M${a.x} ${a.y}L${b.x} ${b.y}"/><path class="thread-core" pathLength="1" d="M${a.x} ${a.y}L${b.x} ${b.y}"/>${points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${p.radius}"/>`).join('')}`;
    board.append(svg);
  }
}
