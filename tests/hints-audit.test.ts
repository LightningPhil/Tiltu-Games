import test from 'node:test';
import assert from 'node:assert/strict';
import {newNonogram,nonogramHint,newSliding,slidingHint,moveSliding,slidingNeighbours} from '../src/collection/puzzles.ts';
import {newFreeCell,hintFreeCell,moveFreeCell,canMoveFreeCell,newSpider,hintSpider,moveSpider,canMoveSpider} from '../src/collection/patience-collection.ts';
import {explainFreeCellHint,explainSpiderHint,explainTurnHint} from '../src/collection/guidance.ts';
import {newTurnGame,chooseTurnMove,playTurn,turnMoves} from '../src/collection/turn-games.ts';
import {loopHint,hashiHint} from '../src/club-plus/hints.ts';
import {newLoop,newHashi,setLoopEdge,loopSolved,hashiSolved,bridgeCross} from '../src/club-plus/networks.ts';
import {newNumbers,numberHint,enterNumber} from '../src/club-plus/numbers.ts';
import {seededRandom} from '../src/skill.ts';
import {newMines,openMine,mineHint} from '../src/minesweeper.ts';
import {newSudoku,generatePuzzle,findHint,setValue} from '../src/sudoku.ts';
import {newBlackjack,canDouble,canSplit} from '../src/blackjack.ts';
import {blackjackAdvice} from '../src/blackjack-tutor.ts';
import {visibleBlackjackCount} from '../src/counting.ts';
import {newPoker,dealPoker,pokerAdvice,actPoker} from '../src/poker.ts';
import {newTetra,hintTetra,explainTetraHint,tileFits,undoTetra} from '../src/tetravex.ts';
import {CHESS_LESSONS,explainChessMove,explainDraughtsMove,DRAUGHTS_LESSONS} from '../src/coach.ts';
import {newChess,chooseChessMove,chessEngine} from '../src/chess.ts';
import {initialBoard,draughtsMoves} from '../src/rules.ts';
import {newDuel} from '../src/state.ts';
import {GAME_NAMES} from '../src/catalog.ts';

test('a wrong picture entry is corrected before it can imply a false forced square',()=>{
 const s=newNonogram(0);s.cells[3]=-1;const before=structuredClone(s),hint=nonogramHint(s)!;
 assert.equal(hint.at,3);assert.equal(hint.value,1);assert.match(hint.reason,/correction uses the solution/);assert.deepEqual(s,before);
 for(let picture=0;picture<27;picture++){const p=newNonogram(picture),h=nonogramHint(p);if(h)assert.equal(h.value===1,!!p.solution[h.at]);p.paused=true;assert.equal(nonogramHint(p),null);}
});

test('FreeCell hints follow legal moves without the former two-move oscillations',()=>{
 for(let deal=1;deal<=5;deal++){
  const s=newFreeCell(deal),key=()=>JSON.stringify([s.columns,s.cells,s.foundations]),seen=new Set([key()]);
  for(let turn=0;turn<30;turn++){const before=structuredClone(s),m=hintFreeCell(s);assert.deepEqual(s,before);if(!m)break;assert.ok(canMoveFreeCell(s,m));assert.match(explainFreeCellHint(s,m),/Move .* (foundation|cell|column)/);moveFreeCell(s,m);assert.ok(!seen.has(key()),`deal ${deal} repeats at ${turn}`);seen.add(key());}
 }
});
test('Spider hints keep same-suit runs legal and avoid the former repeated layouts',()=>{
 for(let deal=1;deal<=5;deal++){
  const s=newSpider(1,deal),key=()=>JSON.stringify([s.columns,s.completed]),seen=new Set([key()]);
  for(let turn=0;turn<30;turn++){const before=structuredClone(s),m=hintSpider(s);assert.deepEqual(s,before);if(!m)break;assert.ok(canMoveSpider(s,m.from,m.at,m.to));assert.match(explainSpiderHint(s,m),/column/);moveSpider(s,m.from,m.at,m.to);assert.ok(!seen.has(key()),`deal ${deal} repeats at ${turn}`);seen.add(key());}
 }
});
for(const size of [4,5] as const)test(`distant ${size}×${size} sliding hints stay legal and do not bounce between two layouts`,()=>{
 const s=newSliding(size,seededRandom(1234)),seen=new Set([s.board.join(',')]);
 for(let step=0;step<12;step++){const before=structuredClone(s),at=slidingHint(s);assert.deepEqual(s,before);assert.notEqual(at,null);assert.ok(slidingNeighbours(s.board,size).includes(at!));moveSliding(s,at!);assert.ok(!seen.has(s.board.join(',')),`repeats at ${step}`);seen.add(s.board.join(','));}
 s.paused=true;assert.equal(slidingHint(s),null);
});

for(const kind of ['noughts','reversi','dots','morris','kalah'] as const)test(`${kind} hints are legal, pure and explain their actual board effect`,()=>{
 const s=newTurnGame(kind,'local',1,3);
 for(let turn=0;turn<4&&s.result===null;turn++){const before=structuredClone(s),m=chooseTurnMove(s,5);assert.deepEqual(s,before);if(!m)break;const text=explainTurnHint(s,m);assert.ok(text.length>70);assert.doesNotMatch(text,/no longer/);assert.ok(turnMoves(s).some(v=>v.to===m.to&&v.from===m.from));playTurn(s,m);}
});
test('loop hints complete the same checked solution and correct wrong marks before reasoning',()=>{
 for(const seed of [1,42,99]){
  const s=newLoop(4,2,seed);for(let i=0;i<s.edges.length&&s.result===null;i++){const before=structuredClone(s),h=loopHint(s);assert.deepEqual(s,before);assert.ok(h);assert.ok(!s.givens[h.at]);assert.equal(h.value,s.solution[h.at]);assert.ok(h.reason.length>50);assert.ok(setLoopEdge(s,h.at,h.value));}assert.ok(loopSolved(s));
 }
 const s=newLoop(4,2,21),at=s.givens.findIndex(v=>!v);s.edges[at]=-s.solution[at];const h=loopHint(s)!;assert.equal(h.at,at);assert.equal(h.value,0);assert.match(h.reason,/solution-based correction/);
});
test('bridge hints respect crossing, island capacities and exclusions without repeating a no-bridge reveal',()=>{
 for(const seed of [1,42,99]){
  const s=newHashi(7,2,seed);let previous=-1;
  for(let i=0;i<s.values.length*2&&s.result===null;i++){
   const before=structuredClone(s),h=hashiHint(s);assert.deepEqual(s,before);if(!h)break;assert.ok(!s.givens[h.at]);assert.equal(Math.max(0,h.value),s.solution[h.at]);assert.notEqual(s.values[h.at],h.value);assert.ok(h.reason.length>50);s.values[h.at]=h.value;previous=h.at;
   assert.ok(s.links.every((_,a)=>s.values[a]<=0||s.links.every((_,b)=>s.values[b]<=0||!bridgeCross(s,a,b))));if(hashiSolved(s))s.result=0;
  }assert.ok(hashiSolved(s),`seed ${seed} ended at ${previous}`);
 }
 const s=newHashi(7,2,8),at=s.givens.findIndex((v,i)=>!v&&!s.solution[i]);if(at>=0){s.values[at]=2;const h=hashiHint(s)!;assert.equal(h.at,at);assert.equal(h.value,-1);assert.match(h.reason,/correction uses the solution|correction|Correct/);}
});
for(const kind of ['kakuro','futoshiki','skyscrapers'] as const)test(`${kind} hints distinguish corrections, deductions and solution reveals`,()=>{
 const s=newNumbers(kind,kind==='kakuro'?7:4,2,42);for(let n=0;n<8&&s.result===null;n++){const before=structuredClone(s),h=numberHint(s);assert.deepEqual(s,before);assert.ok(h);assert.equal(h.value,s.solution[h.at]);assert.ok(h.reason.length>40);assert.ok(enterNumber(s,h.at,h.value));}
 const at=s.givens.findIndex((v,i)=>!v&&s.white[i]);s.values[at]=s.solution[at]===1?2:1;const correction=numberHint(s)!;assert.equal(correction.at,at);assert.equal(correction.value,0);
});
test('Sudoku advice is correct for every supported grid size and corrects working errors first',()=>{
 for(const size of [4,6,9,12] as const){const s=newSudoku(generatePuzzle(size,1,seededRandom(size)));for(let i=0;i<6;i++){const before=structuredClone(s),h=findHint(s);assert.deepEqual(s,before);if(!h)break;assert.equal(h.value,s.solution[h.index]);assert.ok(h.explanation.length>40);setValue(s,h.index,h.value);}const at=s.puzzle.findIndex(v=>!v);s.values[at]=s.solution[at]%size+1;assert.ok(findHint(s)?.correction);}
});
test('Minesweeper only gives safe/flag deductions consistent with exposed clues and correct flags',()=>{
 for(let seed=1;seed<=30;seed++){const s=newMines();openMine(s,40,seededRandom(seed));const before=structuredClone(s),h=mineHint(s);assert.deepEqual(s,before);if(h.kind==='safe')assert.ok(h.cells.every(i=>!s.mines.includes(i)));if(h.kind==='flag')assert.ok(h.cells.every(i=>s.mines.includes(i)));assert.ok(h.reason.length>45);}
});
test('Blackjack advice always names an available action and does not read the hole card',()=>{
 for(let a=0;a<13;a++)for(let b=13;b<26;b++)for(let up=26;up<39;up++){
  const s=newBlackjack();s.phase='player';s.bank=100;s.hands=[{cards:[a,b],bet:25,status:'playing',split:false,splitAces:false,outcome:null}];s.dealer=[up,51];const before=structuredClone(s),h=blackjackAdvice(s)!;assert.deepEqual(s,before);assert.ok(h.reason.length>50);if(h.action==='double')assert.ok(canDouble(s));if(h.action==='split')assert.ok(canSplit(s));s.dealer[1]=50;assert.deepEqual(blackjackAdvice(s),h);
 }
 const s=newBlackjack();s.phase='player';s.bank=0;s.dealer=[31,51];s.hands=[{cards:[0,19],bet:25,status:'playing',split:false,splitAces:false,outcome:null}];assert.equal(blackjackAdvice(s)?.action,'stand');assert.match(blackjackAdvice(s)!.reason,/Doubling is unavailable/);
});
test('count tutor excludes the dealer hole card until revealed',()=>{
 const s=newBlackjack();s.phase='player';s.shoe=Array.from({length:312},(_,i)=>i).filter(i=>![0,1,2,3].includes(i));s.hands=[{cards:[0,1],bet:25,status:'playing',split:false,splitAces:false,outcome:null}];s.dealer=[2,3];assert.equal(visibleBlackjackCount(s).seen,3);s.phase='dealer';assert.equal(visibleBlackjackCount(s).seen,4);
});
test('Poker tutor explains each variant, pot price and legal exchange without reading concealed cards',()=>{
 assert.equal(pokerAdvice(newPoker('holdem')).action,'Deal a hand first');
 for(const variant of ['holdem','omaha','draw'] as const){const s=newPoker(variant);dealPoker(s,seededRandom(42));if(variant==='draw'){while(s.phase==='betting')actPoker(s,s.highest>s.contributions[s.turn]?'call':'check');}const before=structuredClone(s),h=pokerAdvice(s);assert.deepEqual(s,before);assert.ok(h.explanation.length>100);if(variant==='draw'){assert.match(h.explanation,/all 32 legal/);assert.equal(new Set(h.discards).size,h.discards.length);assert.ok(h.discards.every(i=>i>=0&&i<5));}else assert.ok(h.explanation.includes(variant==='omaha'?'exactly two':'best five'));s.deck.reverse();s.holes[1].reverse();assert.deepEqual(pokerAdvice(s),h);}
});
test('Edge Matching reveal explains the actual tile and preserves an undoable legal placement',()=>{
 const s=newTetra(3,seededRandom(4)),before=structuredClone(s);assert.equal(hintTetra(s),'placed');const at=s.board.findIndex(v=>v!==null);assert.ok(tileFits(s,s.board,at,s.board[at]!));assert.match(explainTetraHint(s,at),/top \d, right \d, bottom \d, left \d/);assert.match(explainTetraHint(s,at),/one solution reveal/);undoTetra(s);assert.deepEqual(s,before);
});
test('Chess and draughts tutors describe legal forced tactics and their lessons use the configured rules',()=>{
 const opts={mode:'local' as const,human:1 as const,level:1};const s=newChess(opts);s.startFen='7k/5Q2/6K1/8/8/8/8/8 w - - 0 1';const move=chooseChessMove(s,5).move!;assert.match(explainChessMove(s,move).reasons.join(' '),/checkmates/);
 for(const lesson of CHESS_LESSONS)assert.doesNotThrow(()=>chessEngine({startFen:lesson.fen!,moves:[]}));
 const d=newDuel('draughts',opts);d.board=initialBoard('draughts');const m=draughtsMoves(d.board,d.turn)[0];assert.ok(explainDraughtsMove(d,m).reasons.some(r=>r.includes('immediate legal jump')));assert.equal(DRAUGHTS_LESSONS.length,6);
});
test('all 54 catalogue names retain their saved identifiers and use the reviewed visible labels',()=>{
 assert.equal(Object.keys(GAME_NAMES).length,55);assert.equal(GAME_NAMES.tetravex,'Edge Matching');assert.equal(GAME_NAMES.nonograms,'Picture Logic');assert.equal(GAME_NAMES.memory,'Matching Pairs');assert.equal(GAME_NAMES.four,'Four in a Row');assert.equal(GAME_NAMES.ski,'Downhill Skiing');
});
