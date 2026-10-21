import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/tetrigrid/game.ts';
import {newBlocks,restoreBlocks} from '../src/tetrigrid/session.ts';
import {Handling} from '../src/tetrigrid/handling.ts';
import {freshState,parseState} from '../src/state.ts';

test('collection saves restore a live TetriGrid game paused and preserve other games',()=>{
  const s=freshState(),b=s.actionArcade.blocks=newBlocks('ultra'),g=Game.restore(b.run)!;
  g.hold();g.hardDrop();g.tick(756);b.run=g.snapshot();b.phase='playing';b.paused=false;b.elapsed=g.elapsed/1000;
  s.actionArcade.blocksSettings.musicTrack='cello-flow';s.actionArcade.blocksSettings.handling='fast';s.actionArcade.blocksRecords.marathon=[{score:1200,lines:6,elapsed:65000,pieces:20,date:'2026-10-19'}];
  const loaded=parseState(JSON.stringify({version:1,...s}));assert.equal(loaded.actionArcade.blocks!.paused,true);assert.deepEqual(loaded.actionArcade.blocks!.run,g.snapshot());assert.deepEqual(loaded.chess,s.chess);assert.deepEqual(loaded.actionArcade.blocksSettings,s.actionArcade.blocksSettings);assert.deepEqual(loaded.actionArcade.blocksRecords,s.actionArcade.blocksRecords);
});
test('completed and topped-out results remain viewable after reload without being ranked twice',()=>{
  for(const ended of ['complete','topout'] as const){const s=newBlocks('ultra'),g=Game.restore(s.run)!;g.ended=ended;if(ended==='complete')g.elapsed=120000;else g.board[1][4]='O';s.run=g.snapshot();s.ended=ended;s.phase=ended==='complete'?'won':'over';s.resultRecorded=true;
    const restored=restoreBlocks(JSON.parse(JSON.stringify(s)));assert.ok(restored);assert.equal(restored.ended,ended);assert.equal(restored.resultRecorded,true);assert.equal(Game.restore(restored.run,restored.ended)!.ended,ended);
  }
});
test('legacy mixed-form runs are replaced individually; collection settings and progress survive',()=>{
  const s=freshState();(s.actionArcade as any).blocks={board:Array(192).fill(0),mode:'flow'};s.actionArcade.music=false;
  const loaded=parseState(JSON.stringify({version:1,...s}));assert.equal(loaded.actionArcade.blocks,null);assert.equal(loaded.actionArcade.music,false);assert.deepEqual(loaded.sudoku,s.sudoku);
});
test('last pressed horizontal input wins and releasing it restores the other direction',()=>{
  const moves:string[]=[],h=new Handling(a=>moves.push(a));h.press('left-key','left');h.tick(100);h.press('right-key','right');h.tick(200);assert.equal(moves.at(-1),'right');const count=moves.filter(a=>a==='left').length;
  h.release('right-key');h.tick(40);assert.ok(moves.filter(a=>a==='left').length>count);h.clear();const total=moves.length;h.tick(1000);assert.equal(moves.length,total);
});
test('handling presets repeat progressively, duplicate presses are ignored, and soft drop is independent',()=>{
  const totals=[];for(const preset of ['relaxed','balanced','fast'] as const){let count=0;const h=new Handling(()=>count++,preset);h.press('a','left');h.press('a','left');for(let i=0;i<60;i++)h.tick(1000/60);totals.push(count);}
  assert.ok(totals[0]<totals[1]&&totals[1]<totals[2]);const moves:string[]=[],h=new Handling(a=>moves.push(a));h.press('left','left');h.press('down','soft');h.tick(100);assert.equal(moves.filter(a=>a==='soft').length,3);h.release('down');h.tick(100);assert.equal(moves.filter(a=>a==='soft').length,3);
});
