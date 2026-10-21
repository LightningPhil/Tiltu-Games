import assert from 'node:assert/strict';
import { test } from 'node:test';
import { autoNotes, candidates, conflicts, countSolutions, findHint, generatePuzzle, newSudoku, peers, setValue, sudokuSolved, undoSudoku } from '../src/sudoku.ts';
import type { SudokuSize } from '../src/sudoku.ts';

function random(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

test('all four board sizes and puzzle settings have exactly one solution and valid clues', () => {
  for (const size of [4, 6, 9, 12] as SudokuSize[]) for (let difficulty = 1; difficulty <= 4; difficulty++) {
    const p = generatePuzzle(size, difficulty, random(size * 100 + difficulty));
    assert.equal(p.solution.length, size * size);
    assert.equal(conflicts(p.solution, size).length, 0);
    assert(p.puzzle.every((n, i) => !n || n === p.solution[i]));
    assert.equal(countSolutions(p.puzzle, size), 1, `${size} × ${size}, setting ${difficulty}`);
    assert(p.puzzle.some(n => !n));
  }
});

test('fewer-clue settings remove progressively more clues for the same seed', () => {
  for (const size of [4, 6, 9, 12] as SudokuSize[]) {
    let previous = size * size;
    for (let level = 1; level <= 4; level++) {
      const clues = generatePuzzle(size, level, random(84)).puzzle.filter(Boolean).length;
      assert(clues <= previous); previous = clues;
    }
  }
});

test('starting clues stay fixed; notes and peer cleanup undo and redo together', () => {
  const s = newSudoku(generatePuzzle(9, 2, random(10)));
  const fixed = s.puzzle.findIndex(Boolean);
  assert.equal(setValue(s, fixed, 0), false);
  const empty = s.values.findIndex(n => !n), n = s.solution[empty];
  const neighbour = peers(s.size, empty).find(i => !s.values[i])!;
  setValue(s, neighbour, n, true); assert(s.notes[neighbour].includes(n));
  setValue(s, empty, n); assert(!s.notes[neighbour].includes(n));
  assert(undoSudoku(s)); assert(s.notes[neighbour].includes(n)); assert.equal(s.values[empty], 0);
  assert(undoSudoku(s, true)); assert.equal(s.values[empty], n); assert(!s.notes[neighbour].includes(n));
  undoSudoku(s); setValue(s, empty, n, true); assert.equal(s.redo.length, 0);
});

test('auto notes are candidates; duplicate entries mark both cells; hints find wrong non-duplicate entries', () => {
  const s = newSudoku(generatePuzzle(9, 3, random(5)));
  autoNotes(s);
  s.notes.forEach((notes, i) => { if (!s.values[i]) assert.deepEqual(notes, candidates(s.values, s.size, i)); });
  const i = s.values.findIndex(n => !n);
  const peer = peers(s.size, i).find(p => s.values[p])!;
  setValue(s, i, s.values[peer]);
  assert(conflicts(s.values, s.size).includes(i)); assert(conflicts(s.values, s.size).includes(peer));
  const h = findHint(s)!; assert.equal(h.correction, true); assert.equal(h.index, i);
  setValue(s, i, 0);
  const hint = findHint(s)!; assert.equal(hint.value, s.solution[hint.index]); assert(hint.explanation.length > 30);
});

test('paused puzzles block entry and undo; solving and undoing completion work', () => {
  const s = newSudoku(generatePuzzle(4, 1, random(7)));
  s.paused = true;
  assert.equal(setValue(s, s.selected, s.solution[s.selected]), false);
  assert.equal(undoSudoku(s), false);
  s.paused = false;
  s.puzzle.forEach((n, i) => { if (!n) setValue(s, i, s.solution[i]); });
  assert(sudokuSolved(s)); assert.equal(setValue(s, s.selected, 0), false);
  assert(undoSudoku(s)); assert(!sudokuSolved(s));
  assert(undoSudoku(s, true)); assert(sudokuSolved(s));
});

test('invalid and non-unique boards cannot pass uniqueness checks', () => {
  assert.equal(countSolutions(Array(16).fill(0), 4), 2);
  assert.equal(countSolutions([1, 1, ...Array(14).fill(0)], 4), 0);
  assert.equal(countSolutions(Array(81).fill(0), 9, 2, 1), 2);
});
