import test from 'node:test';
import assert from 'node:assert/strict';
import { newTurnGame,turnMoves,playTurn,undoTurn,chooseTurnMove,reversiFlips,MORRIS_MILLS } from '../src/collection/turn-games.ts';
import { newBackgammon,backgammonMoves,backgammonPaths,backgammonSingleSteps,rollBackgammon,moveBackgammon,offerBackgammonDouble,answerBackgammonDouble,chooseBackgammonPath } from '../src/collection/backgammon.ts';
import { scoreCribHand,scorePegging,newCribbage,discardCribbage,cutCribbage,cribLegalCards,playCribbage,goCribbage,countCribbage,nextCribbageDeal,undoCribbage,chooseCribPeg } from '../src/collection/cribbage.ts';
import { newMahjong,mahjongFree,mahjongPairs,mahjongMatches,removeMahjong,shuffleMahjong } from '../src/collection/mahjong.ts';
import { newSnake,turnSnake,stepSnake,restoreSnake } from '../src/collection/snake.ts';
import { newSliding,moveSliding,slidingNeighbours,slidingSolved,newPegs,pegMoves,movePeg,newNonogram,NONO_PICTURES,nonogramLines,linePossibilities,solveNonogram,markNonogram,nonogramSolved } from '../src/collection/puzzles.ts';
import { newFreeCell,freeCellMoves,freeCellCapacity,canMoveFreeCell,moveFreeCell,newSpider,spiderMoves,canMoveSpider,dealSpider,moveSpider,spiderRun,restoreFreeCell,restoreSpider } from '../src/collection/patience-collection.ts';
import { freshState,parseState,saveState,STORAGE_KEY } from '../src/state.ts';
import { newLife,resizeLife } from '../src/life.ts';
import { restoreCollection } from '../src/collection/store.ts';
const rng=(seed=42)=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
test('Noughts and Crosses recognises every line, draws, undo, and an immediate win',()=>{
  const s=newTurnGame('noughts','local');for(const to of [0,3,1,4,2])assert.ok(playTurn(s,{to}));assert.equal(s.result,1);assert.deepEqual(s.last,[0,1,2]);assert.ok(undoTurn(s));assert.equal(s.result,null);assert.equal(s.board[2],0);assert.equal(chooseTurnMove(s,5,()=>.5)?.to,2);
  const draw=newTurnGame('noughts','local');for(const to of [0,4,8,5,3,6,2,1,7])assert.ok(playTurn(draw,{to}));assert.equal(draw.result,0);assert.deepEqual(turnMoves(draw),[]);
});
test('Expert Noughts and Crosses never loses against any reachable human replies',()=>{
  const initial=newTurnGame('noughts','local'),seen=new Set<string>();
  function visit(s:ReturnType<typeof newTurnGame>):void{const key=s.board.join(',')+s.turn;if(seen.has(key))return;seen.add(key);assert.notEqual(s.result,1);if(s.result!==null)return;if(s.turn===-1){const move=chooseTurnMove(s,5,()=>0)!;assert.ok(playTurn(s,move));visit(s);}else for(const move of turnMoves(s)){const n=structuredClone(s);playTurn(n,move);visit(n);}}
  visit(initial);
});
test('Reversi flips all bracketed directions, rejects unsupported placements and completes a full game',()=>{
  const s=newTurnGame('reversi','local');assert.equal(turnMoves(s).length,4);assert.deepEqual(reversiFlips(s.board,19,1),[27]);assert.ok(!playTurn(s,{to:0}));assert.ok(playTurn(s,{to:19}));assert.equal(s.board[27],1);const random=rng();let n=0;while(s.result===null&&n++<70){const moves=turnMoves(s);assert.ok(moves.length);playTurn(s,moves[Math.floor(random()*moves.length)]);}assert.notEqual(s.result,null);assert.ok(s.board.filter(Boolean).length<=64);
  const b=Array(64).fill(0);b[27]=0;for(const [dr,dc]of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]){b[(3+dr)*8+3+dc]=-1;b[(3+2*dr)*8+3+2*dc]=1;}assert.equal(reversiFlips(b,27,1).length,8);
});
test('Dots and Boxes claims both boxes from one edge and keeps the scoring player on turn',()=>{
  const s=newTurnGame('dots','local',3,3),n=s.size,start=2*n*(n+1);s.board.fill(1,0,start);s.board[start+0]=s.board[start+1]=0;const shared=n*(n+1)+1;s.board[shared]=0;s.turn=-1;assert.ok(playTurn(s,{to:shared}));assert.equal(s.board[start],-1);assert.equal(s.board[start+1],-1);assert.equal(s.turn,-1);assert.notEqual(s.result,null);
});
test('Morris protects mills, permits flying at three, and does not lose during early placement',()=>{
  const s=newTurnGame('morris','local');assert.ok(playTurn(s,{to:0}));assert.equal(s.result,null);s.board.fill(0);[0,1].forEach(i=>s.board[i]=1);[3,4,5,6].forEach(i=>s.board[i]=-1);s.turn=1;s.reserve=[7,5];assert.ok(playTurn(s,{to:2}));assert.equal(s.phase,'take');assert.deepEqual(turnMoves(s).map(m=>m.to),[6]);assert.ok(playTurn(s,{to:6,capture:true}));assert.equal(s.turn,-1);s.board.fill(0);[0,1,2].forEach(i=>s.board[i]=1);[3,4,5,6].forEach(i=>s.board[i]=-1);s.reserve=[0,0];s.turn=1;s.phase='play';assert.ok(turnMoves(s).some(m=>m.from===0&&m.to===23));
  for(const mill of MORRIS_MILLS)assert.equal(mill.length,3);
});
test('Kalah skips the opposing store, captures occupied opposites and sweeps each owner’s seeds',()=>{
  const s=newTurnGame('kalah','local');assert.ok(playTurn(s,{to:2}));assert.equal(s.turn,1);assert.equal(s.board[6],1);assert.equal(s.board.reduce((a,n)=>a+n,0),48);
  s.board=Array(14).fill(0);s.board[0]=1;s.board[1]=0;s.board[11]=5;s.board[2]=1;s.board[7]=1;s.board[6]=20;s.board[13]=20;s.turn=1;s.result=null;assert.ok(playTurn(s,{to:0}));assert.equal(s.board[6],26);assert.equal(s.turn,-1);
  const ending=newTurnGame('kalah','local');ending.board=[0,0,0,0,0,1,20,1,2,3,4,5,6,6];assert.ok(playTurn(ending,{to:5}));assert.equal(ending.board[6],21);assert.equal(ending.board[13],27);assert.equal(ending.result,-1);
});
test('every strategy level makes legal moves without changing input, across all five turn games',()=>{for(const kind of ['noughts','reversi','dots','morris','kalah'] as const){const s=newTurnGame(kind),before=structuredClone(s);for(let level=1;level<=5;level++){const m=chooseTurnMove(s,level,()=>.4);assert.ok(m);assert.ok(turnMoves(s).some(x=>JSON.stringify(x)===JSON.stringify(m)));assert.deepEqual(s,before);}}});
test('Backgammon uses both dice when possible, the higher die when only one fits, and bar priority',()=>{
  const s=newBackgammon('local');s.board.fill(0);s.board[0]=1;s.off=[14,15];s.phase='move';s.dice=[1,2];assert.deepEqual(backgammonMoves(s).map(m=>m.die),[2]);
  s.board.fill(0);s.board[23]=2;s.board[22]=-2;s.bar=[1,0];s.dice=[1,2];const moves=backgammonMoves(s);assert.ok(moves.every(m=>m.from===24&&m.die===1));assert.ok(backgammonPaths(s).every(p=>p.length===2));
  s.board.fill(0);s.board[23]=-2;s.board[22]=-2;assert.equal(backgammonMoves(s).length,0);
});
test('Backgammon bearing off respects the farthest checker, hits and gammons count correctly',()=>{
  const s=newBackgammon('local');s.board.fill(0);s.board[5]=1;s.board[0]=1;s.bar=[0,0];s.off=[13,0];s.phase='move';s.dice=[6];assert.deepEqual(backgammonSingleSteps(s,6).filter(m=>m.to===-1).map(m=>m.from),[5]);
  s.board.fill(0);s.board[0]=1;s.board[23]=-15;s.off=[14,0];s.dice=[1];s.turn=1;assert.ok(moveBackgammon(s,{from:0,to:-1,die:1,hit:false}));assert.equal(s.result,1);assert.equal(s.points,2);
  const hit=newBackgammon('local');hit.board.fill(0);hit.board[3]=1;hit.board[2]=-1;hit.dice=[1];hit.phase='move';assert.ok(moveBackgammon(hit,{from:3,to:2,die:1,hit:true}));assert.equal(hit.bar[1],1);assert.equal(hit.board[2],1);
});
test('Backgammon opening ties reroll, doubles give four uses and cube ownership follows acceptance',()=>{
  const s=newBackgammon('local',3,42);assert.ok(rollBackgammon(s,[3,3]));assert.equal(s.phase,'opening');assert.ok(rollBackgammon(s,[5,2]));assert.equal(s.turn,1);assert.equal(s.dice.length,2);s.phase='roll';assert.ok(offerBackgammonDouble(s));assert.ok(answerBackgammonDouble(s,true));assert.equal(s.cube,2);assert.equal(s.cubeOwner,-1);assert.ok(!offerBackgammonDouble(s));assert.ok(rollBackgammon(s,[2,2]));assert.equal(s.dice.length,4);
  const path=chooseBackgammonPath(s,3,()=>.5),before=structuredClone(s);assert.ok(path.length);assert.deepEqual(s,before);for(const move of path)assert.ok(moveBackgammon(s,move));
});
test('Cribbage scores the 29 hand, hand/crib flush differences, nobs and multiplicity',()=>{
  // 5♠ 5♥ 5♦ J♣ + 5♣ = the maximum 29.
  assert.equal(scoreCribHand([4,17,43,36],30).points,29);
  assert.equal(scoreCribHand([0,2,6,8],24).items.find(i=>i.label.includes('flush'))?.points,4);assert.ok(!scoreCribHand([0,2,6,8],24,true).items.some(i=>i.label.includes('flush')));
  assert.equal(scoreCribHand([2,15,3,4],17).items.filter(i=>i.label.startsWith('Run')).reduce((a,i)=>a+i.points,0),12);
});
test('Cribbage pegging uses consecutive suffixes, score-31 has no extra last-card point',()=>{
  assert.equal(scorePegging([2,16,4]).items.find(i=>i.label.startsWith('Run'))?.points,3);assert.equal(scorePegging([4,17,30]).items.find(i=>i.label.includes('kind'))?.points,6);
  const s=newCribbage(3,42);s.phase='peg';s.turn=0;s.sequence=[9,22,35];s.hands=[[0],[]];s.kept=[[0],[]];s.played=[{card:9,player:1},{card:22,player:0},{card:35,player:1}];s.scores=[0,0];assert.ok(playCribbage(s,0));assert.equal(s.scores[0],2);assert.equal(s.phase,'show');
});
test('Cribbage plays complete seeded deals to 121, never allows a false Go, and undo preserves history',()=>{
  const s=newCribbage(3,212);let actions=0;while(s.result===null&&actions++<1500){if(s.phase==='discard')assert.ok(discardCribbage(s,s.hands[0].slice(0,2)));else if(s.phase==='cut')assert.ok(cutCribbage(s));else if(s.phase==='peg'){const legal=cribLegalCards(s);if(legal.length){assert.ok(!goCribbage(s));const c=s.turn===1?chooseCribPeg(s):legal[0];assert.ok(playCribbage(s,c!));}else assert.ok(goCribbage(s));}else if(s.phase==='show')assert.ok(countCribbage(s));else if(s.phase==='next')assert.ok(nextCribbageDeal(s));else assert.fail(s.phase);assert.ok(s.sequence.reduce((a,c)=>a+Math.min(10,c%13+1),0)<=31);}
  assert.notEqual(s.result,null);assert.ok(actions<1500);assert.ok(undoCribbage(s));assert.ok(Array.isArray(s.history));
});
test('Mahjong uses the complete 144-tile set and exact standard/special matching',()=>{for(const layout of ['turtle','bridge','flat'] as const){const s=newMahjong(layout,42);assert.equal(s.tiles.length,144);for(let face=0;face<34;face++)assert.equal(s.tiles.filter(t=>t.face===face).length,4);for(let face=34;face<42;face++)assert.equal(s.tiles.filter(t=>t.face===face).length,1);assert.ok(mahjongPairs(s).length);const [a,b]=mahjongPairs(s)[0];assert.ok(removeMahjong(s,a,b));assert.equal(s.tiles.filter(t=>!t.removed).length,142);assert.ok(shuffleMahjong(s));assert.equal(s.tiles.filter(t=>!t.removed).length,142);}assert.ok(mahjongMatches(34,37));assert.ok(mahjongMatches(38,41));assert.ok(!mahjongMatches(34,38));assert.ok(!mahjongMatches(1,2));});
test('Mahjong partial covers and two blocked sides prevent selection',()=>{
  const tile=(id:number,x:number,y:number,z:number)=>({id,x,y,z,face:0,removed:false});assert.ok(!mahjongFree([tile(0,1,1,0),tile(1,1.5,1.5,1)],0));assert.ok(!mahjongFree([tile(0,1,1,0),tile(1,0,1,0),tile(2,2,1,0)],0));assert.ok(mahjongFree([tile(0,1,1,0),tile(1,0,1,0)],0));
});
test('Snake queues turns safely, permits moving into a vacating tail and preserves best on death',()=>{
  const s=newSnake(2,false,0,42);s.phase='running';assert.ok(!turnSnake(s,'left'));assert.ok(turnSnake(s,'up'));assert.ok(turnSnake(s,'left'));assert.ok(!turnSnake(s,'down'));assert.equal(stepSnake(s),'move');assert.equal(s.direction,'up');assert.equal(stepSnake(s),'move');assert.equal(s.direction,'left');s.body=[25,24,48,49];s.previous=s.body.slice();s.direction='down';s.queue=[];s.food=99;assert.equal(stepSnake(s),'move');s.body=[0,1,2];s.direction='left';s.queue=[];assert.equal(stepSnake(s),'crash');assert.equal(s.phase,'over');const copy=newSnake();copy.phase='running';assert.equal(restoreSnake(copy)?.phase,'paused');
});
test('Sliding puzzles keep solvable parity, permit adjacent slides and recognise the solved board',()=>{
  for(const size of [3,4,5] as const){const s=newSliding(size,rng(size));assert.equal(new Set(s.board).size,size*size);const flat=s.board.filter(Boolean),inversions=flat.reduce((sum,v,i)=>sum+flat.slice(i+1).filter(n=>n<v).length,0),rowFromBottom=size-Math.floor(s.board.indexOf(0)/size);assert.equal(size%2?inversions%2:(inversions+rowFromBottom)%2,size%2?0:1);assert.ok(moveSliding(s,slidingNeighbours(s.board,size)[0]));assert.equal(s.moves,1);}
  const s=newSliding(4);s.board=Array.from({length:16},(_,i)=>(i+1)%16);[s.board[14],s.board[15]]=[s.board[15],s.board[14]];assert.ok(moveSliding(s,15));assert.ok(slidingSolved(s.board));
});
test('Peg Solitaire removes precisely one jumped peg and rejects diagonal movement',()=>{const s=newPegs(),moves=pegMoves(s);assert.equal(s.board.filter(Boolean).length,32);assert.equal(moves.length,4);const m=moves[0];assert.ok(!movePeg(s,m.from,m.to+1));assert.ok(movePeg(s,m.from,m.to));assert.equal(s.board.filter(Boolean).length,31);assert.equal(s.board[m.over],0);});
test('Every original Nonogram has exactly one solution, with sound line arrangements',()=>{
  assert.deepEqual(linePossibilities([2],3),[[1,1,-1],[-1,1,1]]);assert.deepEqual(linePossibilities([0],3,[0,1,0]),[]);
  for(let i=0;i<NONO_PICTURES.length;i++){const s=newNonogram(i),{rows,cols}=nonogramLines(s.solution,s.size),result=solveNonogram(rows,cols,s.cells);assert.equal(result.count,1,NONO_PICTURES[i].name);assert.deepEqual(result.solution?.map(n=>n===1?1:0),s.solution);assert.ok(markNonogram(s,s.solution.flatMap((n,i)=>n?[i]:[]),1));assert.ok(nonogramSolved(s));}
});
test('FreeCell supermoves count temporary cells and exclude an empty destination',()=>{
  const s=newFreeCell(42);s.cells=[0,1,2,3];s.columns=Array.from({length:8},()=>[10]);assert.equal(freeCellCapacity(s,0),1);s.cells=[null,null,2,3];assert.equal(freeCellCapacity(s,0),3);s.columns[7]=[];assert.equal(freeCellCapacity(s,0),6);assert.equal(freeCellCapacity(s,7),3);
});
test('FreeCell seeded play conserves 52 physical cards and rejects arbitrary supermoves',()=>{
  const s=newFreeCell(42),random=rng();for(let i=0;i<80;i++){const moves=freeCellMoves(s);if(!moves.length)break;assert.ok(moveFreeCell(s,moves[Math.floor(random()*moves.length)]));const cards=[...s.columns.flat(),...s.cells.filter(c=>c!==null),...s.foundations.flat()];assert.equal(cards.length,52);assert.equal(new Set(cards).size,52);}assert.ok(restoreFreeCell(s));assert.equal(s.history[0].moves,0);
});
test('Spider deals 54/50, blocks stock with empty columns, transports only suited runs and conserves 104 cards',()=>{
  for(const suits of [1,2,4] as const){const s=newSpider(suits,42);assert.equal(s.columns.flat().length,54);assert.equal(s.stock.length,50);assert.equal(s.columns.filter(c=>c.length===6).length,4);assert.ok(dealSpider(s));assert.equal(s.stock.length,40);const moves=spiderMoves(s);if(moves.length){const m=moves[0];assert.ok(moveSpider(s,m.from,m.at,m.to));}const cards=[...s.stock,...s.columns.flat().map(c=>c.id),...s.completed.flat()];assert.equal(cards.length,104);assert.equal(new Set(cards).size,104);assert.ok(restoreSpider(s));const saved=s.columns[0];s.columns[0]=[];assert.ok(!dealSpider(s));s.columns[0]=saved;}
  const s=newSpider(4,1);s.columns[0]=[{id:12,up:true},{id:24,up:true}];assert.equal(spiderRun(s,0,0).length,0);assert.ok(!canMoveSpider(s,0,0,1));
});
test('all new game saves round trip independently and older Grid Club saves retain existing progress',()=>{
  const s=freshState();for(const kind of ['noughts','reversi','dots','morris','kalah'] as const)s.collection[kind]=newTurnGame(kind);s.collection.backgammon=newBackgammon();s.collection.cribbage=newCribbage();s.collection.mahjong=newMahjong();s.collection.snake=newSnake();s.collection.sliding=newSliding();s.collection.pegs=newPegs();s.collection.nonograms=newNonogram();s.collection.freecell=newFreeCell();s.collection.spider=newSpider();s.preferences.patienceVariant='spider';s.preferences.game='mahjong';const copy=parseState(JSON.stringify({version:1,...s}));assert.deepEqual(copy,s);const damaged=structuredClone(s.collection);damaged.mahjong!.tiles[0].face=999;const restored=restoreCollection(damaged);assert.equal(restored.mahjong,null);assert.deepEqual(restored.freecell,s.collection.freecell);const old={...s,collection:undefined};assert.equal(parseState(JSON.stringify({version:1,...old})).four.board.length,42);
});

test('Backgammon histories stay serialisable after rolls, moves and undo',()=>{const s=freshState();s.collection.backgammon=newBackgammon('local',3,47);const b=s.collection.backgammon;rollBackgammon(b,[6,3]);for(const m of chooseBackgammonPath(b,3))moveBackgammon(b,m);const raw=JSON.stringify({version:1,...s});const copy=parseState(raw);assert.deepEqual(copy.collection.backgammon,b);assert.ok(!raw.includes('history\":null'));});
test('every generated Mahjong layout has a complete legal removal path over many seeds',()=>{for(const layout of ['turtle','bridge','flat'] as const)for(let seed=1;seed<=12;seed++){const s=newMahjong(layout,seed);assert.equal(s.solution.length,72);for(const [a,b]of s.solution.slice())assert.ok(removeMahjong(s,a,b),`${layout}/${seed}/${a}/${b}`);assert.ok(s.tiles.every(t=>t.removed));}});
test('Morris computer undo rewinds the whole human mill and removal before its reply',()=>{const s=newTurnGame('morris','computer');s.board.fill(0);[0,1].forEach(i=>s.board[i]=1);[3,4,5,6].forEach(i=>s.board[i]=-1);s.reserve=[7,5];const before=structuredClone(s.board);playTurn(s,{to:2});playTurn(s,{to:6,capture:true});playTurn(s,turnMoves(s)[0]);assert.ok(undoTurn(s));assert.deepEqual(s.board,before);assert.equal(s.phase,'play');assert.equal(s.turn,1);});
test('long Cribbage games remain restorable through pegging, Go, hand counting and deals',()=>{for(let seed=1;seed<=8;seed++){const state=freshState(),s=state.collection.cribbage=newCribbage(3,seed);let actions=0;while(s.result===null&&actions++<1600){if(s.phase==='discard')discardCribbage(s,s.hands[0].slice(0,2));else if(s.phase==='cut')cutCribbage(s);else if(s.phase==='peg'){const legal=cribLegalCards(s);if(legal.length)playCribbage(s,legal[0]);else goCribbage(s);}else if(s.phase==='show')countCribbage(s);else if(s.phase==='next')nextCribbageDeal(s);if(actions%29===0)assert.deepEqual(parseState(JSON.stringify({version:1,...state})).collection.cribbage,s);}assert.notEqual(s.result,null);}});
test('Spider removes a completed run and undo restores all physical cards together',()=>{const s=newSpider(1,42),runs=Array.from({length:8},(_,i)=>Array.from({length:13},(_,n)=>i*13+12-n));s.stock=[];s.completed=runs.slice(0,7);s.columns=Array.from({length:10},()=>[]);s.columns[0]=runs[7].slice(0,12).map(id=>({id,up:true}));s.columns[1]=[{id:runs[7][12],up:true}];const before=structuredClone(s);assert.ok(moveSpider(s,1,0,0));assert.equal(s.completed.length,8);assert.equal(s.score,599);Object.assign(s,s.history.pop());assert.deepEqual(s,before);});
test('damaged collection entries cannot discard another game or the preferences',()=>{const s=freshState();s.preferences.game='reversi';s.preferences.theme='woodland';s.collection.reversi=newTurnGame('reversi');const copy=JSON.parse(JSON.stringify({version:1,...s}));copy.collection.mahjong={layout:'turtle',tiles:Array(144).fill(null)};const loaded=parseState(JSON.stringify(copy));assert.equal(loaded.preferences.theme,'woodland');assert.deepEqual(loaded.collection.reversi,s.collection.reversi);assert.equal(loaded.collection.mahjong,null);});
test('large multi-game saves compact old undo snapshots without changing live games',()=>{
  const s=freshState(),m=s.collection.mahjong=newMahjong('turtle',42),sp=s.collection.spider=newSpider(4,42);m.history=Array.from({length:100},()=>({tiles:structuredClone(m.tiles),solution:structuredClone(m.solution),moves:0,shuffles:0,hints:0}));sp.history=Array.from({length:300},()=>({columns:structuredClone(sp.columns),stock:sp.stock.slice(),completed:[],moves:0,score:500}));s.life=newLife();resizeLife(s.life,80);s.life.history=Array.from({length:80},()=>({cells:s.life!.cells.slice(),generation:0,turn:1,edits:3,result:null}));let saved='';const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem:(key:string,value:string)=>{assert.equal(key,STORAGE_KEY);assert.ok(value.length<1_800_000);saved=value;}}});try{assert.ok(saveState(s));const loaded=parseState(saved);assert.deepEqual(loaded.collection.mahjong?.tiles,m.tiles);assert.deepEqual(loaded.collection.spider?.columns,sp.columns);assert.deepEqual(loaded.life?.cells,s.life.cells);assert.equal(m.history.length,100);assert.equal(sp.history.length,300);assert.ok(loaded.collection.mahjong!.history.length<100||loaded.collection.spider!.history.length<300);}finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete (globalThis as any).localStorage;}
});

test('Backgammon redoubles are not limited by the printed 64 cube face',()=>{const state=freshState(),s=state.collection.backgammon=newBackgammon('local');s.phase='roll';s.cube=64;s.cubeOwner=1;assert.ok(offerBackgammonDouble(s));assert.ok(answerBackgammonDouble(s,true));assert.equal(s.cube,128);assert.equal(s.cubeOwner,-1);assert.deepEqual(parseState(JSON.stringify({version:1,...state})).collection.backgammon,s);});
test('malformed Cribbage score breakdowns recover without losing another saved game',()=>{const s=freshState();s.collection.cribbage=newCribbage();s.collection.kalah=newTurnGame('kalah');const copy=JSON.parse(JSON.stringify({version:1,...s}));copy.collection.cribbage.lastScore={points:4,items:[null]};const restored=parseState(JSON.stringify(copy));assert.equal(restored.collection.cribbage,null);assert.deepEqual(restored.collection.kalah,s.collection.kalah);});
