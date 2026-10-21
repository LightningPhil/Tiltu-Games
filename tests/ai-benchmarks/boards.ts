// Reproducible research batteries. Run: node tests/ai-benchmarks/boards.ts [exact|tactics]
// These measure reference regret; they do not assert a rating or pointwise superiority.
import assert from 'node:assert/strict';
import {newTurnGame,turnMoves,playTurn,chooseTurnMove,dotBoxEdges,MORRIS_POINTS} from '../../src/collection/turn-games.ts';
import type {TurnSession,TurnMove} from '../../src/collection/turn-games.ts';
import {seededRandom} from '../../src/skill.ts';
import {Chess,chooseChessMove} from '../../src/chess.ts';
import {newGo,chooseGoMove,placeGo,playGo,goPositions,goKey} from '../../src/go.ts';
import {defaultOptions} from '../../src/state.ts';
import {newBackgammon,chooseBackgammonPath,backgammonPaths,moveBackgammon} from '../../src/collection/backgammon.ts';

const repetitions=Number(process.env.AI_REPETITIONS??8);
function collector(game:string){const regret=Array(5).fill(0),misses=Array(5).fill(0),examples:any[]=[];let decisions=0;return {add(level:number,best:number,value:number,example?:unknown){regret[level-1]+=best-value;if(value<best){misses[level-1]++;if(level===5&&examples.length<5)examples.push(example);}if(level===1)decisions++;},finish(){console.log(JSON.stringify({game,decisionsPerLevel:decisions,regret,misses,expertExamples:examples}));}};}
function checked(s:TurnSession,level:number,rng:()=>number):TurnMove{const before=structuredClone(s),m=chooseTurnMove(s,level,rng)!;assert.ok(turnMoves(s).some(v=>JSON.stringify(v)===JSON.stringify(m)));assert.deepEqual(s,before);return m;}
function terminalOracle(s:TurnSession){const p=s.turn,memo=new Map<string,number>();function solve(v:TurnSession):number{if(v.result!==null)return v.kind==='reversi'?v.board.reduce((a,n)=>a+n*p,0):v.kind==='noughts'?v.result===0?0:v.result===p?1:-1:(v.board[6]-v.board[13])*p;const key=v.board.join(',')+'/'+v.turn;if(memo.has(key))return memo.get(key)!;const vals=turnMoves(v).map(m=>{const n=structuredClone(v);playTurn(n,m,false);return solve(n);});const value=(v.turn===p?Math.max:Math.min)(...vals);memo.set(key,value);return value;}return solve;}

function reversiAndKalah(){for(const kind of ['reversi','kalah'] as const){const result=collector(kind);for(let seed=1;seed<=(kind==='reversi'?6:16);seed++){const s=newTurnGame(kind,'local'),opening=seededRandom(seed);if(kind==='reversi'){while(s.result===null&&s.board.filter(n=>!n).length>7){const m=turnMoves(s);playTurn(s,m[Math.floor(opening()*m.length)],false);}if(s.result!==null)continue;}else{s.board.fill(0);s.board[6]=s.board[13]=20;for(let j=0;j<8;j++){const at=Math.floor(opening()*12);s.board[at<6?at:at+1]++;}if(!s.board.slice(0,6).some(Boolean)||!s.board.slice(7,13).some(Boolean))continue;}const solve=terminalOracle(s),best=solve(s);for(let rep=0;rep<repetitions;rep++)for(let level=1;level<=5;level++){const m=checked(s,level,seededRandom(seed+73+1009*rep)),next=structuredClone(s);playTurn(next,m,false);result.add(level,best,solve(next),{seed,rep,board:s.board,to:m.to});}}result.finish();}}

function noughts(){const seen=new Set<string>(),positions:TurnSession[]=[];function visit(s:TurnSession){const key=s.board.join(',')+'/'+s.turn;if(seen.has(key))return;seen.add(key);if(s.result!==null)return;positions.push(s);for(const m of turnMoves(s)){const n=structuredClone(s);playTurn(n,m,false);visit(n);}}visit(newTurnGame('noughts','local'));const result=collector('noughts-all-reachable');for(let i=0;i<positions.length;i++){const s=positions[i],solve=terminalOracle(s),best=solve(s);for(let level=1;level<=5;level++){const m=checked(s,level,seededRandom(i+73)),n=structuredClone(s);playTurn(n,m,false);result.add(level,best,solve(n),{board:s.board,turn:s.turn,to:m.to});}}result.finish();}

function dots(){const result=collector('dots-exact-12-edges');for(let seed=1;seed<=24;seed++){const s=newTurnGame('dots','local',3,3),opening=seededRandom(seed);while(turnMoves(s).length>12){const m=turnMoves(s);playTurn(s,m[Math.floor(opening()*m.length)],false);}const full=(1<<24)-1,boxes=Array.from({length:9},(_,i)=>dotBoxEdges(3,i).reduce((m,e)=>m|(1<<e),0)),mask=s.board.slice(0,24).reduce((m,n,i)=>n?m|(1<<i):m,0),memo=new Map<number,number>();function solve(m:number):number{if(m===full)return 0;if(memo.has(m))return memo.get(m)!;let best=-99;for(let i=0;i<24;i++)if(!(m&(1<<i))){const n=m|(1<<i),earned=boxes.filter(b=>(n&b)===b&&(m&b)!==b).length;best=Math.max(best,earned+(earned?solve(n):-solve(n)));}memo.set(m,best);return best;}const best=solve(mask);for(let rep=0;rep<repetitions;rep++)for(let level=1;level<=5;level++){const move=checked(s,level,seededRandom(seed+73+1009*rep)),n=mask|(1<<move.to),earned=boxes.filter(b=>(n&b)===b&&(mask&b)!==b).length;result.add(level,best,earned+(earned?solve(n):-solve(n)),{seed,rep,to:move.to});}}result.finish();}

function morris(){const result=collector('morris-immediate-winning-mill');for(let rotation=0;rotation<4;rotation++){const s=newTurnGame('morris','local');s.reserve=[0,0];const transform=(i:number)=>{let [x,y]=MORRIS_POINTS[i];for(let k=0;k<rotation;k++)[x,y]=[6-y,x];return MORRIS_POINTS.findIndex(([a,b])=>a===x&&b===y);};for(const i of [0,1,9])s.board[transform(i)]=1;for(const i of [3,4,8])s.board[transform(i)]=-1;function value(m:TurnMove){const n=structuredClone(s);playTurn(n,m,false);return n.phase==='take'&&n.turn===s.turn?1:0;}assert.ok(turnMoves(s).some(m=>value(m)===1));for(let rep=0;rep<repetitions;rep++)for(let level=1;level<=5;level++){const m=checked(s,level,seededRandom(rotation+73+1009*rep));result.add(level,1,value(m),{rotation,rep,to:m.to,from:m.from});}}result.finish();}

function chessTactics(){
 const fixtures=[
  {fen:'7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',mate:false},
  {fen:'6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',mate:false},
  {fen:'4k3/8/8/8/8/8/3q4/3RK3 w - - 0 1',mate:false},
  {fen:'3r2k1/8/8/3p4/8/8/8/3Q2K1 w - - 0 1',mate:false},
  {fen:'7k/8/5K2/8/8/8/8/Q7 w - - 0 1',mate:true},
  {fen:'7k/8/5K2/8/8/8/8/1Q6 w - - 0 1',mate:true}
 ];
 const result=collector('chess-mate-material-and-mate-in-two'),values:any={p:100,n:320,b:330,r:500,q:900,k:0};
 function forced(c:Chess,plies:number,p:'w'|'b'):boolean{if(c.isCheckmate())return c.turn()!==p;if(c.isDraw()||!plies)return false;const values=c.moves().map(m=>{c.move(m);const v=forced(c,plies-1,p);c.undo();return v;});return c.turn()===p?values.some(Boolean):values.every(Boolean);}
 for(let seed=0;seed<fixtures.length;seed++){
  const {fen,mate}=fixtures[seed],reference=new Chess(fen),own=reference.turn();
  function score(san:string){const c=new Chess(fen);c.move(san);if(mate)return c.isCheckmate()?2:forced(c,2,own)?1:0;if(c.isCheckmate())return 100000;const material=()=>c.board().flat().reduce((a,p)=>a+(p?(p.color===own?1:-1)*values[p.type]:0),0);let worst=material();for(const reply of c.moves()){c.move(reply);worst=Math.min(worst,c.isCheckmate()?-100000:material());c.undo();}return worst;}
  const legal=reference.moves(),best=Math.max(...legal.map(score));for(let rep=0;rep<Math.min(4,repetitions);rep++)for(let level=1;level<=5;level++){const answer=chooseChessMove({startFen:fen,moves:[]},level,seededRandom(seed+73+1009*rep));assert.ok(legal.includes(answer.move!));result.add(level,1,score(answer.move!)===best?1:0,{fen,rep,move:answer.move});}
 }
 result.finish();
}

function goTactics(){for(const size of [9,19] as const){const result=collector('go-'+size+'-two-ply-capture');for(let rotation=0;rotation<4;rotation++){const s=newGo(size,defaultOptions());const transform=(r:number,c:number)=>{for(let k=0;k<rotation;k++)[r,c]=[8-c,r];return (r+Math.floor((size-9)/2))*size+c+Math.floor((size-9)/2);};for(const [r,c]of [[4,4],[4,5],[4,6],[1,2],[2,1],[2,3]])s.board[transform(r,c)]=1;for(const [r,c]of [[2,2],[3,4],[3,5],[3,6],[4,3],[4,7],[5,4],[5,5]])s.board[transform(r,c)]=-1;const previous=goPositions(s),values=new Map<number|null,number>();function score(at:number|null){if(values.has(at))return values.get(at)!;if(at===null)return -3;const placed=placeGo(s.board,size,1,at,previous);if(placed.error)return -1000;const nextPrevious=new Set(previous);nextPrevious.add(goKey(placed.board));let enemyBest=0;for(let i=0;i<s.board.length;i++)if(!placed.board[i]){const reply=placeGo(placed.board,size,-1,i,nextPrevious);if(!reply.error)enemyBest=Math.max(enemyBest,reply.captured.length);}const value=placed.captured.length-enemyBest;values.set(at,value);return value;}let best=-Infinity;for(let i=0;i<s.board.length;i++)if(!s.board[i]&&!placeGo(s.board,size,1,i,previous).error)best=Math.max(best,score(i));for(let rep=0;rep<Math.min(4,repetitions);rep++)for(let level=1;level<=5;level++){const before=structuredClone(s),answer=chooseGoMove(s,level,seededRandom(rotation+73+1009*rep));assert.deepEqual(s,before);if(answer.move!==null)assert.equal(placeGo(s.board,size,s.turn,answer.move,previous).error,'');result.add(level,best,score(answer.move),{rotation,rep,to:answer.move,best});}}result.finish();}}

function backgammon(){const result=collector('backgammon-next-roll-bear-off-probability');for(let seed=1;seed<=Number(process.env.AI_RACE_SEEDS??24);seed++){const s=newBackgammon('local',3,seed),random=seededRandom(seed);s.board.fill(0);s.off=[11,14];s.bar=[0,0];s.board[18]=-1;for(let i=0;i<4;i++)s.board[Math.floor(random()*6)]++;s.phase='move';s.turn=1;s.dice=s.rolled=[1+Math.floor(random()*6),1+Math.floor(random()*6)];if(s.dice[0]===s.dice[1])s.dice=Array(4).fill(s.dice[0]);const legal=backgammonPaths(s);const cache=new Map<string,number>();function score(path:typeof legal[number]){const n=structuredClone(s);for(const m of path)assert.ok(moveBackgammon(n,m));if(n.result===1)return 1;const key=n.board.join(',')+'/'+n.off;if(cache.has(key))return cache.get(key)!;let wins=0;for(let a=1;a<=6;a++)for(let b=a;b<=6;b++){const v=structuredClone(n);v.turn=1;v.phase='move';v.result=null;v.dice=a===b?[a,a,a,a]:[a,b];const canFinish=backgammonPaths(v).some(p=>p.filter(m=>m.to===-1).length+v.off[0]===15);if(canFinish)wins+=a===b?1:2;}const value=wins/36;cache.set(key,value);return value;}const best=Math.max(...legal.map(score));for(let rep=0;rep<repetitions;rep++)for(let level=1;level<=5;level++){const before=structuredClone(s),path=chooseBackgammonPath(s,level,seededRandom(seed+73+1009*rep));assert.deepEqual(s,before);assert.ok(legal.some(p=>JSON.stringify(p)===JSON.stringify(path)));result.add(level,best,score(path),{seed,rep,path});}}result.finish();}

// Independent prisoner-only minimax. This intentionally measures short capture
// tactics rather than territory or the eventual value of a Go sacrifice.
function goContinuation(){
 const s=newGo(9,defaultOptions());for(const i of [40,41,42,11,19,21])s.board[i]=1;for(const i of [20,31,32,33,39,43,49,50])s.board[i]=-1;
 let nodes=0;
 function search(board:number[],turn:1|-1,d:number,alpha:number,beta:number,positions:Set<string>):{value:number;line:(number|null)[]}{
  nodes++;if(!d)return {value:0,line:[]};const moves:{point:number|null;board:number[];captured:number[]}[]=[{point:null,board,captured:[]}];
  for(let at=0;at<81;at++)if(!board[at]){const placed=placeGo(board,9,turn,at,positions);if(!placed.error)moves.push({point:at,...placed});}
  moves.sort((a,b)=>b.captured.length-a.captured.length);let best=-Infinity,line:(number|null)[]=[];
  for(const move of moves){const key=goKey(move.board),had=positions.has(key);positions.add(key);const child=search(move.board,turn===1?-1:1,d-1,move.captured.length-beta,move.captured.length-alpha,positions);if(!had)positions.delete(key);const value=move.captured.length-child.value;if(value>best){best=value;line=[move.point,...child.line];}alpha=Math.max(alpha,best);if(alpha>=beta)break;}
  return {value:best,line};
 }
 for(const root of [29,51])for(const depth of [3,4]){nodes=0;const placed=placeGo(s.board,9,1,root,goPositions(s)),positions=goPositions(s);positions.add(goKey(placed.board));const answer=search(placed.board,-1,depth-1,-Infinity,Infinity,positions);console.log(JSON.stringify({game:'go-continuation',root,depth,netCaptures:placed.captured.length-answer.value,line:[root,...answer.line],nodes}));}
}

function goReading(mix=false){
 const result=collector('go-seeded-four-ply-capture-reading');
 const mixRegret=[0,0,0],mixMisses=[0,0,0];let mixCases=0;
 for(let seed=1;seed<=Number(process.env.AI_GO_CASES??8);seed++){
  const s=newGo(9,defaultOptions()),random=seededRandom(seed*971);
  for(let ply=0;ply<16;ply++){const legal=Array.from({length:25},(_,i)=>(2+Math.floor(i/5))*9+2+i%5).filter(at=>!placeGo(s.board,9,s.turn,at,goPositions(s)).error);if(!legal.length)break;playGo(s,legal[Math.floor(random()*legal.length)]);}
  let nodes=0;
  function search(board:number[],turn:1|-1,d:number,alpha:number,beta:number,positions:Set<string>):number{
   nodes++;if(!d)return 0;const moves:{point:number|null;board:number[];captured:number[]}[]=[{point:null,board,captured:[]}];
   for(let at=0;at<81;at++)if(!board[at]){const placed=placeGo(board,9,turn,at,positions);if(!placed.error)moves.push({point:at,...placed});}
   moves.sort((a,b)=>b.captured.length-a.captured.length);let best=-Infinity;
   for(const move of moves){const key=goKey(move.board),had=positions.has(key);positions.add(key);const value=move.captured.length-search(move.board,turn===1?-1:1,d-1,move.captured.length-beta,move.captured.length-alpha,positions);if(!had)positions.delete(key);best=Math.max(best,value);alpha=Math.max(alpha,best);if(alpha>=beta)break;}
   return best;
  }
  const best=search(s.board,s.turn,4,-Infinity,Infinity,goPositions(s));
  if(mix){
   const original=structuredClone(s),a=chooseGoMove(s,3,seededRandom(seed+73)),b=chooseGoMove(s,5,seededRandom(seed+73));assert.deepEqual(s,original);
   const scores=[a,b].map(answer=>{const move=answer.move===null?{board:s.board,captured:[],error:''}:placeGo(s.board,9,s.turn,answer.move,goPositions(s));assert.equal(move.error,'');const positions=goPositions(s);positions.add(goKey(move.board));return move.captured.length-search(move.board,s.turn===1?-1:1,3,-Infinity,Infinity,positions);});
   for(let rep=0;rep<Number(process.env.AI_GO_REPETITIONS??64);rep++){const random=seededRandom(seed+73+1009*rep),values=[scores[0],random()<.7?scores[1]:scores[0],scores[1]];values.forEach((value,i)=>{mixRegret[i]+=best-value;if(value<best)mixMisses[i]++;});mixCases++;}
   continue;
  }
  for(let level=1;level<=5;level++){const before=structuredClone(s),answer=chooseGoMove(s,level,seededRandom(seed+73));assert.deepEqual(s,before);const move=answer.move===null?{board:s.board,captured:[],error:''}:placeGo(s.board,9,s.turn,answer.move,goPositions(s));assert.equal(move.error,'');const positions=goPositions(s);positions.add(goKey(move.board));const value=move.captured.length-search(move.board,s.turn===1?-1:1,3,-Infinity,Infinity,positions);result.add(level,best,value,{seed,board:s.board,turn:s.turn,to:answer.move,best,value});}
 }
 if(mix)console.log(JSON.stringify({game:'go-prototype-Hard-70percent-Expert-30percent-Challenging',levels:[3,4,5],decisionsPerLevel:mixCases,regret:mixRegret,misses:mixMisses}));else result.finish();
}

const mode=process.argv[2]??'all';
if(['all','exact','endgames'].includes(mode))reversiAndKalah();
if(['all','exact','noughts'].includes(mode))noughts();
if(['all','exact','dots'].includes(mode))dots();
if(['all','tactics','morris'].includes(mode))morris();
if(['all','tactics','chess'].includes(mode))chessTactics();
if(['all','tactics','go'].includes(mode))goTactics();
if(mode==='go-continuation')goContinuation();
if(mode==='go-reading')goReading();
if(mode==='go-mix')goReading(true);
if(['all','tactics','backgammon'].includes(mode))backgammon();
