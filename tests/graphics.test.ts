import test from 'node:test';
import assert from 'node:assert/strict';
import { sudokuBoxTint, sudokuFinishedRows, tetraJoinedEdges } from '../src/board-art.ts';
import { digitalGraphic } from '../src/graphics.ts';
import type { SudokuSize } from '../src/sudoku.ts';

test('Sudoku progress edges require every digit exactly once and box tints follow rectangular boxes', () => {
  for (const size of [4,6,9,12] as SudokuSize[]) {
    const values = Array(size*size).fill(0); values.splice(0,size,...Array.from({length:size},(_,i)=>i+1));
    assert.equal(sudokuFinishedRows(values,size)[0],true);
    assert.equal(sudokuFinishedRows(values,size)[1],false);
    values[0] = values[1]; assert.equal(sudokuFinishedRows(values,size)[0],false);
  }
  assert.equal(sudokuBoxTint(0,2,6),false); assert.equal(sudokuBoxTint(0,3,6),true);
  assert.equal(sudokuBoxTint(1,0,6),false); assert.equal(sudokuBoxTint(2,0,6),true);
  assert.equal(sudokuBoxTint(2,3,6),false);
});

test('TetraVex illuminated joins require real matching neighbours and do not wrap rows', () => {
  const s = {size:2 as const, board:[0,1,2,null], tiles:[{n:1,e:2,s:3,w:4},{n:5,e:3,s:6,w:2},{n:3,e:8,s:9,w:3}]};
  const before = JSON.stringify(s);
  assert.equal(tetraJoinedEdges(s,0),6); // east and south
  assert.equal(tetraJoinedEdges(s,1),8); // west, not the next row
  assert.equal(tetraJoinedEdges(s,2),1); // north
  assert.equal(tetraJoinedEdges(s,3),0);
  assert.equal(JSON.stringify(s),before);
  s.tiles[1].w=9; assert.equal(tetraJoinedEdges(s,0),4);
});

test('Minesweeper segment counters keep negative flag counts readable and cap elapsed seconds', () => {
  assert.match(digitalGraphic(-1), /visually-hidden">-01</);
  assert.match(digitalGraphic(0), /visually-hidden">000</);
  assert.match(digitalGraphic(1000), /visually-hidden">999</);
  assert.match(digitalGraphic(-150), /visually-hidden">-150</);
  assert.equal((digitalGraphic(111).match(/class="segment-on"/g)||[]).length,6);
});
