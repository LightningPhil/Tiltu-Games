export type SudokuSize = 4 | 6 | 9 | 12;
export interface Puzzle { size: SudokuSize; difficulty: number; puzzle: number[]; solution: number[] }
export interface SudokuSnapshot { values: number[]; notes: number[][]; hints: number }
export interface SudokuSession extends Puzzle, SudokuSnapshot {
  selected: number; history: SudokuSnapshot[]; redo: SudokuSnapshot[]; elapsed: number; paused: boolean;
}
export const boxShape = (size: SudokuSize): [number, number] => size === 4 ? [2, 2] : size === 6 ? [2, 3] : size === 12 ? [3, 4] : [3, 3];
export const symbol = (n: number) => n === 0 ? '' : n <= 9 ? String(n) : 'ABC'[n - 10];

export function peers(size: SudokuSize, index: number): number[] {
  const [br, bc] = boxShape(size), r = Math.floor(index / size), c = index % size;
  const indices = new Set<number>();
  for (let i = 0; i < size; i++) { indices.add(r * size + i); indices.add(i * size + c); }
  const startR = r - r % br, startC = c - c % bc;
  for (let y = 0; y < br; y++) for (let x = 0; x < bc; x++) indices.add((startR + y) * size + startC + x);
  indices.delete(index);
  return [...indices];
}

const peerCache = new Map<number, number[][]>();
function allPeers(size: SudokuSize): number[][] {
  if (!peerCache.has(size)) peerCache.set(size, Array.from({ length: size * size }, (_, i) => peers(size, i)));
  return peerCache.get(size)!;
}

export function candidates(values: number[], size: SudokuSize, index: number): number[] {
  const used = new Set(allPeers(size)[index].map(i => values[i]));
  return Array.from({ length: size }, (_, i) => i + 1).filter(n => !used.has(n));
}

export function conflicts(values: number[], size: SudokuSize): number[] {
  return values.flatMap((n, i) => n && allPeers(size)[i].some(p => values[p] === n) ? [i] : []);
}

export function cellGuide(values: number[], size: SudokuSize, index: number): { row: number[]; column: number[]; box: number[]; possible: number[] } {
  const [br, bc] = boxShape(size), row = Math.floor(index / size), column = index % size;
  const missing = (cells: number[]) => Array.from({ length: size }, (_, i) => i + 1).filter(n => !cells.some(i => i !== index && values[i] === n));
  const rows = missing(Array.from({ length: size }, (_, i) => row * size + i));
  const columns = missing(Array.from({ length: size }, (_, i) => i * size + column));
  const boxes = missing(Array.from({ length: br * bc }, (_, i) => (row - row % br + Math.floor(i / bc)) * size + column - column % bc + i % bc));
  return { row: rows, column: columns, box: boxes, possible: rows.filter(n => columns.includes(n) && boxes.includes(n)) };
}

export function countSolutions(values: number[], size: SudokuSize, limit = 2, nodeLimit = 100_000): number {
  if (conflicts(values, size).length) return 0;
  const b = values.slice();
  let nodes = 0;
  function solve(): number {
    if (++nodes > nodeLimit) return limit; // Unproven uniqueness is never accepted.
    let index = -1, options: number[] = [];
    for (let i = 0; i < b.length; i++) {
      if (b[i]) continue;
      const possible = candidates(b, size, i);
      if (!possible.length) return 0;
      if (index === -1 || possible.length < options.length) { index = i; options = possible; }
      if (options.length === 1) break;
    }
    if (index === -1) return 1;
    let count = 0;
    for (const n of options) {
      b[index] = n;
      count += solve();
      if (count >= limit) break;
    }
    b[index] = 0;
    return Math.min(limit, count);
  }
  return solve();
}

function shuffled<T>(input: T[], random: () => number): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

export function generatePuzzle(size: SudokuSize, difficulty: number, random = Math.random): Puzzle {
  const [br, bc] = boxShape(size), range = (n: number) => Array.from({ length: n }, (_, i) => i);
  const rows = shuffled(range(size / br), random).flatMap(b => shuffled(range(br), random).map(r => b * br + r));
  const cols = shuffled(range(size / bc), random).flatMap(b => shuffled(range(bc), random).map(c => b * bc + c));
  const nums = shuffled(range(size).map(n => n + 1), random);
  const solution = rows.flatMap(r => cols.map(c => nums[(r * bc + Math.floor(r / br) + c) % size]));
  const puzzle = solution.slice();
  const removalTargets = { 4: [6, 8, 10, 11], 6: [14, 18, 22, 24], 9: [35, 44, 51, 56], 12: [58, 72, 84, 94] };
  const target = removalTargets[size][Math.max(0, Math.min(3, difficulty - 1))];
  let removed = 0;
  for (const i of shuffled(range(size * size), random)) {
    const prev = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle, size, 2, size === 12 ? 5_000 : 15_000) === 1) removed++;
    else puzzle[i] = prev;
    if (removed >= target) break;
  }
  return { size, difficulty, puzzle, solution };
}

export function newSudoku(puzzle: Puzzle): SudokuSession {
  return { ...puzzle, values: puzzle.puzzle.slice(), notes: puzzle.puzzle.map(() => []), selected: puzzle.puzzle.findIndex(n => !n),
    history: [], redo: [], elapsed: 0, hints: 0, paused: false };
}

export const sudokuSolved = (s: SudokuSession) => s.values.every((n, i) => n === s.solution[i]);
export const snapshot = (s: SudokuSession): SudokuSnapshot => ({ values: s.values.slice(), notes: s.notes.map(n => n.slice()), hints: s.hints });
export function remember(s: SudokuSession): void {
  s.history.push(snapshot(s));
  if (s.history.length > 150) s.history.shift();
  s.redo = [];
}

export function setValue(s: SudokuSession, index: number, n: number, noteMode = false): boolean {
  if (s.paused || sudokuSolved(s) || !Number.isInteger(index) || !Number.isInteger(n) || s.puzzle[index] || index < 0 || index >= s.values.length || n < 0 || n > s.size) return false;
  if (noteMode && n && !s.values[index]) {
    remember(s);
    s.notes[index] = s.notes[index].includes(n) ? s.notes[index].filter(v => v !== n) : [...s.notes[index], n].sort((a, b) => a - b);
  } else {
    if (s.values[index] === n && !s.notes[index].length) return false;
    remember(s);
    s.values[index] = n;
    s.notes[index] = [];
    if (n) allPeers(s.size)[index].forEach(i => { s.notes[i] = s.notes[i].filter(v => v !== n); });
  }
  return true;
}

export function undoSudoku(s: SudokuSession, redo = false): boolean {
  if (s.paused) return false;
  const source = redo ? s.redo : s.history, destination = redo ? s.history : s.redo;
  const prev = source.pop();
  if (!prev) return false;
  destination.push(snapshot(s));
  s.values = prev.values.slice(); s.notes = prev.notes.map(n => n.slice()); s.hints = prev.hints;
  return true;
}

export function autoNotes(s: SudokuSession): void {
  if (s.paused || sudokuSolved(s)) return;
  remember(s);
  s.notes = s.values.map((n, i) => n ? [] : candidates(s.values, s.size, i));
}

export interface Hint { index: number; value: number; explanation: string; correction: boolean }
export function findHint(s: SudokuSession): Hint | null {
  const wrong = s.values.findIndex((n, i) => n && n !== s.solution[i]);
  if (wrong >= 0) return { index: wrong, value: s.solution[wrong], correction: true, explanation: 'This entry disagrees with the unique solution. Clear it and try its candidates.' };
  const coordinate = (i: number) => `Row ${Math.floor(i / s.size) + 1}, column ${i % s.size + 1}`;
  const blanks = s.values.flatMap((n, i) => n ? [] : [i]);
  for (const i of blanks) {
    const options = candidates(s.values, s.size, i);
    if (options.length === 1) return { index: i, value: options[0], correction: false, explanation: `${coordinate(i)} can only be ${symbol(options[0])}: every other number is already in its row, column or box.` };
  }
  const [br, bc] = boxShape(s.size), units: { cells: number[]; name: string }[] = [];
  for (let i = 0; i < s.size; i++) {
    units.push({ cells: Array.from({ length: s.size }, (_, c) => i * s.size + c), name: `row ${i + 1}` });
    units.push({ cells: Array.from({ length: s.size }, (_, r) => r * s.size + i), name: `column ${i + 1}` });
  }
  for (let r = 0; r < s.size; r += br) for (let c = 0; c < s.size; c += bc) {
    units.push({ cells: Array.from({ length: br * bc }, (_, i) => (r + Math.floor(i / bc)) * s.size + c + i % bc), name: 'this box' });
  }
  for (const unit of units) for (let n = 1; n <= s.size; n++) {
    if (unit.cells.some(i => s.values[i] === n)) continue;
    const possible = unit.cells.filter(i => !s.values[i] && candidates(s.values, s.size, i).includes(n));
    if (possible.length === 1) return { index: possible[0], value: n, correction: false, explanation: `${coordinate(possible[0])} is the only place ${symbol(n)} can go in ${unit.name}.` };
  }
  if (!blanks.length) return null;
  const index = blanks.includes(s.selected) ? s.selected : blanks[0];
  return { index, value: s.solution[index], correction: false, explanation: `${coordinate(index)} is ${symbol(s.solution[index])} in the unique solution. This reveal uses the solution rather than a single-step deduction.` };
}
