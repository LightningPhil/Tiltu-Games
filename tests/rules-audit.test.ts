import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess,chessOutcome,lockedPawnDeadPosition,chooseChessMove} from '../src/chess.ts';
import {newRace,raceFinish,raceDestination,moveRace,LUDO_TRACK,ludoGlobal,migrateLudo} from '../src/club-plus/race.ts';
import {restorePlus,emptyPlus} from '../src/club-plus/store.ts';
import {snapshot} from '../src/club-plus/common.ts';
import {newHop,moveHop} from '../src/club-plus/hop.ts';
import {newAbstract,abstractMoves,chooseAbstract,playAbstract,fiveLine} from '../src/club-plus/abstracts.ts';
import {newFreeCell,canMoveFreeCell,moveFreeCell} from '../src/collection/patience-collection.ts';
import {newPatience,patienceMoves,canMovePatience,movePatience,patienceHint} from '../src/patience.ts';
import {newNumbers,enterNumber,numberSolved,numberConflicts} from '../src/club-plus/numbers.ts';
import {newLoop,newHashi,setLoopEdge,setBridge,loopSolved,hashiSolved,singleLoop} from '../src/club-plus/networks.ts';
import {newMemory,flipMemory,newWordSearch,findWord,wordPath} from '../src/club-plus/playful.ts';
import {newTangram,moveTan} from '../src/club-plus/tangrams.ts';
import {newNonogram,markNonogram,nonogramSolved} from '../src/collection/puzzles.ts';
import {newSudoku,generatePuzzle,setValue,sudokuSolved} from '../src/sudoku.ts';
import {newTricks,nextTrickDeal} from '../src/club-plus/tricks.ts';
import {renderTricks} from '../src/club-plus/view-cards.ts';
import {cardName} from '../src/cards.ts';
import type {PlusUI} from '../src/club-plus/view-types.ts';
import {initialBoard,draughtsMoves,fourMoves,applyMove,winner} from '../src/rules.ts';
import type {DraughtsMove,Player} from '../src/rules.ts';
import {newTurnGame,turnMoves,playTurn} from '../src/collection/turn-games.ts';
import {PEG_POINTS,newPegs,pegMoves,movePeg,newSliding,slidingNeighbours,moveSliding} from '../src/collection/puzzles.ts';

test('Ludo enters each private lane after 51 shared points and finishes exactly at 56',()=>{
  assert.equal(raceFinish('ludo'),56);
  for(const players of [2,3,4])for(let p=0;p<players;p++){
    const s=newRace('ludo',players,42);s.turn=p;s.phase='move';s.roll=1;s.pawns[p]=[50,-1,-1,-1];
    assert.equal(raceDestination(s,0),51);assert.ok(moveRace(s,0));assert.equal(s.pawns[p][0],51);
    const shared=LUDO_TRACK[ludoGlobal(s,p,50)];
    const first=p===0?[7,1]:players===2||p===2?[7,13]:p===1?[1,7]:[13,7];
    assert.equal(Math.abs(shared[0]-first[0])+Math.abs(shared[1]-first[1]),1,`${players} players, seat ${p}`);
    s.turn=p;s.phase='move';s.pawns[p]=[56,56,56,55];s.roll=2;
    assert.equal(raceDestination(s,3),null);s.roll=1;assert.ok(moveRace(s,3));assert.equal(s.result,p);
  }
});
test('Ludo private lanes cannot capture another player and old saves migrate once, including undo',()=>{
  const s=newRace('ludo',2,42);s.phase='move';s.roll=1;s.pawns=[[50,-1,-1,-1],[25,-1,-1,-1]];
  assert.ok(moveRace(s,0));assert.equal(s.pawns[1][0],25);
  const old=newRace('ludo',2,42);delete old.ludoRoute;old.pawns=[[57,56,52,51],[-1,0,1,50]];
  old.history=[snapshot(old)];const games=emptyPlus();games.ludo=old;
  const loaded=restorePlus(games).ludo as typeof old;
  assert.ok(loaded);assert.deepEqual(loaded.pawns[0],[56,55,51,50]);
  assert.deepEqual((loaded.history[0] as typeof old).pawns[0],[56,55,51,50]);
  const before=structuredClone(loaded);migrateLudo(loaded);assert.deepEqual(loaded,before);
  assert.equal(old.pawns[0][0],57,'restoration must not mutate caller');
});
test('Brandubh captures a king against all eight hostile corner approaches',()=>{
  const transform=(at:number,rot:number,mirror:boolean)=>{let r=Math.floor(at/7),c=at%7;if(mirror)c=6-c;for(let i=0;i<rot;i++)[r,c]=[c,6-r];return r*7+c;};
  for(let rot=0;rot<4;rot++)for(const mirror of [false,true]){
    const s=newHop('tafl');s.board.fill(0);s.board[transform(1,rot,mirror)]=3;s.board[transform(9,rot,mirror)]=2;s.board[24]=1;s.turn=1;
    assert.ok(moveHop(s,transform(9,rot,mirror),transform(2,rot,mirror)));assert.equal(s.result,1);assert.equal(s.board.includes(3),false);
  }
  const s=newHop('tafl');s.board.fill(0);s.board[23]=3;s.board[15]=2;s.board[48]=1;s.turn=1;
  assert.ok(moveHop(s,15,22));assert.equal(s.board[23],3,'empty throne is never hostile to the king');
});
test('all Gomoku skill levels play the last empty point without changing the searched position',()=>{
  for(let level=1;level<=5;level++){
    const s=newAbstract('gomoku',15,'normal',42);
    s.board=s.board.map((_,i)=>1+((Math.floor(i/15)+2*(i%15))%4<2?0:1));s.board[0]=0;
    for(let i=0;i<225;i++)assert.equal(fiveLine(s.board,15,i).length,0);
    const before=structuredClone(s);assert.equal(chooseAbstract(s,level),0);assert.deepEqual(s,before);
    assert.ok(playAbstract(s,0));assert.equal(s.result,-1);assert.deepEqual(abstractMoves(s),[]);
  }
});
test('Hex move enumeration includes the legal pie swap exactly on the second turn',()=>{
  const s=newAbstract('hex',7);assert.ok(!abstractMoves(s).includes(-1));playAbstract(s,24);
  assert.ok(abstractMoves(s).includes(-1));const b=s.board.slice();assert.ok(playAbstract(s,-1));
  assert.deepEqual(s.board,b);assert.deepEqual(s.colours,[2,1]);assert.ok(!abstractMoves(s).includes(-1));
});
test('chess recognises a permanently locked pawn wall, conservatively excluding movable or capturable pawns',()=>{
  for(const turn of ['w','b']){
    const fen=`7k/8/8/p1p1p1p1/P1P1P1P1/8/8/K7 ${turn} - - 0 1`,c=new Chess(fen);
    assert.ok(lockedPawnDeadPosition(c));assert.equal(chessOutcome(c).result,0);
    assert.equal(chooseChessMove({startFen:fen,moves:[]},1).move,null);
  }
  for(const fen of [
    '7k/8/8/p1p3p1/P1P1P1P1/8/8/K7 w - - 0 1',
    '7k/8/8/p1p1p1p1/PKP1P1P1/8/8/8 w - - 0 1',
    '7k/8/8/p1p1p1p1/P1P1P1P1/8/8/K1B5 w - - 0 1',
    '7k/8/8/3pP3/8/8/8/K7 w - d6 0 1',
  ])assert.equal(lockedPawnDeadPosition(new Chess(fen)),false,fen);
  assert.equal(chessOutcome(new Chess('7k/6Q1/5K2/8/8/8/8/8 b - - 0 1')).reason,'Checkmate');
});
test('FreeCell foundations are permanent while an exposed Ace can legally move into one',()=>{
  const s=newFreeCell(42);s.columns=Array.from({length:8},()=>[]);s.cells=[null,null,null,null];s.foundations=[[0],[],[],[]];
  const m={from:{area:'foundation' as const,index:0,at:0},to:{area:'cell' as const,index:0,at:0}},before=structuredClone(s);
  assert.ok(!canMoveFreeCell(s,m));assert.ok(!moveFreeCell(s,m));assert.deepEqual(s,before);
  s.columns[0]=[13];assert.ok(moveFreeCell(s,{from:{area:'column',index:0,at:0},to:{area:'foundation',index:1,at:0}}));
});
test('Klondike exposes every King-column relocation but keeps redundant relocations out of hints',()=>{
  const s=newPatience();s.tableau=Array.from({length:7},(_,i)=>i===0?[{card:25,up:true}]:[]);s.stock=[];s.waste=[];s.foundations=[[],[],[],[]];
  const moves=patienceMoves(s);for(let index=1;index<7;index++)assert.ok(moves.some(m=>m.from.index===0&&m.from.at===0&&m.to.pile==='tableau'&&m.to.index===index));
  assert.equal(patienceHint(s),null);assert.ok(movePatience(s,{pile:'tableau',index:0,at:0},{pile:'tableau',index:1}));
  for(let seed=1;seed<=12;seed++){
    const p=newPatience(1,Array.from({length:52},(_,i)=>(i+seed)%52)),listed=patienceMoves(p);
    for(let col=0;col<7;col++)for(let at=0;at<p.tableau[col].length;at++)for(const pile of ['tableau','foundation'] as const)for(let i=0;i<(pile==='tableau'?7:4);i++){
      const from={pile:'tableau' as const,index:col,at},to={pile,index:i};
      assert.equal(listed.some(m=>JSON.stringify(m.from)===JSON.stringify(from)&&JSON.stringify(m.to)===JSON.stringify(to)),canMovePatience(p,from,to));
    }
  }
});
test('number puzzles accept conflicting working entries, protect fixed clues and finish only a valid grid',()=>{
  for(const kind of ['kakuro','futoshiki','skyscrapers'] as const){
    const s=newNumbers(kind,kind==='kakuro'?7:4,1,42),at=s.white.findIndex((n,i)=>n&&!s.givens[i]),fixed=s.givens.findIndex(Boolean);
    assert.ok(at>=0);if(fixed>=0)assert.equal(enterNumber(s,fixed,0),false);
    assert.ok(enterNumber(s,at,s.solution[at]===1?2:1));assert.equal(s.result,null);assert.ok(!numberSolved(s));
    for(let i=0;i<s.values.length;i++)if(s.white[i]&&!s.givens[i])assert.ok(enterNumber(s,i,s.solution[i]));
    assert.equal(s.result,0);assert.ok(numberSolved(s));
    const bad=structuredClone(s);bad.givens.fill(0);bad.values=bad.values.map(v=>v?v+9:0);assert.ok(!numberSolved(bad));
  }
  const s=newNumbers('futoshiki',4,1,42);s.givens.fill(0);s.values.fill(0);enterNumber(s,0,1);enterNumber(s,1,1);
  assert.deepEqual(numberConflicts(s),[0,1]);assert.equal(s.result,null);
  const sky=newNumbers('skyscrapers',4,1,42);sky.givens.fill(0);sky.values=sky.solution.slice();
  const clue=sky.clues[0].findIndex(n=>n>0);sky.clues[0][clue]=sky.clues[0][clue]===1?4:1;
  assert.ok(numberConflicts(sky).some(i=>Math.floor(i/sky.size)===clue),'Visibility conflict must be highlighted');
  const sudoku=newSudoku(generatePuzzle(4,1,()=>.37)),at=sudoku.puzzle.findIndex(n=>!n);
  assert.ok(setValue(sudoku,at,sudoku.solution[at]===1?2:1));assert.ok(!sudokuSolved(sudoku));
});
test('puzzle and memory input boundaries reject non-cell indices and impossible values without mutation',()=>{
  const loop=newLoop(4,1,42),hashi=newHashi(7,1,42),memory=newMemory(6,42),word=newWordSearch(10,'garden',42),tan=newTangram(0,42),nono=newNonogram(0),sudoku=newSudoku(generatePuzzle(4,1,()=>.37));
  for(const at of [NaN,Infinity,-1,.5,99999]){
    const before=JSON.stringify([loop,hashi,memory,word,tan,nono,sudoku]);
    assert.ok(!setLoopEdge(loop,at));assert.ok(!setBridge(hashi,at));assert.ok(!flipMemory(memory,at));
    assert.ok(!findWord(word,at,0));assert.deepEqual(wordPath(word,at,0),[]);assert.ok(!moveTan(tan,at,tan.pieces[0]));assert.ok(!markNonogram(nono,[at],1));assert.ok(!setValue(sudoku,at,1));
    assert.equal(JSON.stringify([loop,hashi,memory,word,tan,nono,sudoku]),before);
  }
  const at=loop.givens.findIndex(n=>!n),before=structuredClone(loop);assert.ok(!setLoopEdge(loop,at,2));assert.deepEqual(loop,before);
  const solved={...loop,edges:loop.solution.slice()};assert.ok(loopSolved(solved));solved.edges[0]=2;assert.ok(!loopSolved(solved));assert.ok(!singleLoop(4,solved.edges));
  const h={...hashi,values:hashi.solution.slice()};assert.ok(hashiSolved(h));h.values[0]=3;assert.ok(!hashiSolved(h));
  const n={...nono,cells:nono.solution.slice()};assert.ok(nonogramSolved(n));n.cells[n.solution.findIndex(v=>!v)]=2;assert.ok(!nonogramSolved(n));
});
test('Whist visibly identifies the turned trump card even when a computer dealt',()=>{
  const s=newTricks('whist',42);s.phase='summary';nextTrickDeal(s);
  const u={selected:null,cards:[],hint:[],notice:'',thinking:false,busy:false,zoom:false,notes:false,towers:true,wordFrom:null,wordPreview:[],outline:null,bid:3,hintEntry:null,loading:false} as PlusUI;
  assert.notEqual(s.dealer,0);const html=JSON.stringify(renderTricks(s,u));assert.ok(html.includes('Turned card: '+cardName(s.exposed)));
});

test('draughts complete move sets agree with an independent capture-tree enumeration over 1,000 positions',()=>{
  function reference(board:number[],p:Player):DraughtsMove[]{
    const quiet:DraughtsMove[]=[],captures:DraughtsMove[]=[];
    const directions=(piece:number)=>Math.abs(piece)===2?[[-1,-1],[-1,1],[1,-1],[1,1]]:p===1?[[-1,-1],[-1,1]]:[[1,-1],[1,1]];
    const inBoard=(r:number,c:number)=>r>=0&&r<8&&c>=0&&c<8;
    for(let from=0;from<64;from++)if(board[from]*p>0){
      const piece=board[from];
      for(const [dr,dc]of directions(piece)){const r=Math.floor(from/8)+dr,c=from%8+dc;if(inBoard(r,c)&&!board[r*8+c])quiet.push({from,path:[r*8+c],captures:[]});}
      const walk=(at:number,path:number[],taken:number[])=>{
        let extended=false;const occupied=(i:number)=>i===at?piece:i===from||path.includes(i)?0:board[i];
        for(const [dr,dc]of directions(piece)){
          const r=Math.floor(at/8)+dr*2,c=at%8+dc*2,over=at+dr*8+dc,to=r*8+c;
          if(!inBoard(r,c)||occupied(to)||occupied(over)*p>=0||taken.includes(over))continue;
          extended=true;const nextPath=[...path,to],nextTaken=[...taken,over];
          if(Math.abs(piece)===1&&(p===1?r===0:r===7))captures.push({from,path:nextPath,captures:nextTaken});else walk(to,nextPath,nextTaken);
        }
        if(!extended&&taken.length)captures.push({from,path,captures:taken});
      };walk(from,[],[]);
    }
    return captures.length?captures:quiet;
  }
  const encode=(moves:DraughtsMove[])=>moves.map(m=>JSON.stringify(m)).sort();
  let seed=81,positions=0;
  for(let game=0;positions<1000;game++){
    let b=initialBoard('draughts'),p:Player=1;
    for(let ply=0;ply<100&&positions<1000;ply++,positions++){
      const expected=reference(b,p),actual=draughtsMoves(b,p);assert.deepEqual(encode(actual),encode(expected),`game ${game}, ply ${ply}`);
      if(!expected.length)break;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      b=applyMove('draughts',b,p,expected[seed%expected.length]);p=p===1?-1:1;
    }
  }
});
test('Four in a Row and Reversi move sets agree with independent square-by-square rules during complete games',()=>{
  let seed=17;const pick=(n:number)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let game=0;game<20;game++){
    let b=initialBoard('four'),p:Player=1;
    while(winner('four',b,p)===null){const expected=Array.from({length:7},(_,c)=>c).filter(c=>!b[c]);assert.deepEqual(fourMoves(b).slice().sort(),expected);b=applyMove('four',b,p,expected[pick(expected.length)]);p=p===1?-1:1;}
    const s=newTurnGame('reversi','local');while(s.result===null){
      const expected:number[]=[];
      for(let at=0;at<64;at++)if(!s.board[at]){
        let brackets=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy){let r=Math.floor(at/8)+dy,c=at%8+dx,n=0;while(r>=0&&r<8&&c>=0&&c<8&&s.board[r*8+c]===-s.turn){n++;r+=dy;c+=dx;}if(n&&r>=0&&r<8&&c>=0&&c<8&&s.board[r*8+c]===s.turn)brackets=true;}
        if(brackets)expected.push(at);
      }
      assert.deepEqual(turnMoves(s).map(m=>m.to).sort((a,b)=>a-b),expected);assert.ok(playTurn(s,{to:expected[pick(expected.length)]}));
    }
  }
});
test('Peg Solitaire and Sliding Tiles expose precisely all geometrically legal moves',()=>{
  let seed=29;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let game=0;game<15;game++){
    const s=newPegs(game%2?'english':'diamond');
    for(let n=0;n<32;n++){
      const expected:typeof s.last[]=[];
      PEG_POINTS.forEach(([r,c],from)=>{if(!s.board[from])return;PEG_POINTS.forEach(([y,x],to)=>{if(s.board[to]||!((r===y&&Math.abs(c-x)===2)||(c===x&&Math.abs(r-y)===2)))return;const over=PEG_POINTS.findIndex(([a,b])=>a===(r+y)/2&&b===(c+x)/2);if(over>=0&&s.board[over])expected.push({from,to,over});});});
      const key=(m:any)=>[m.from,m.over,m.to].join('/');assert.deepEqual(pegMoves(s).map(key).sort(),expected.map(key).sort());if(!expected.length)break;const m=expected[Math.floor(random()*expected.length)]!;assert.ok(movePeg(s,m.from,m.to));
    }
    const sliding=newSliding(game%3===0?3:game%3===1?4:5,random);
    for(let n=0;n<50&&!sliding.completed;n++){
      const empty=sliding.board.indexOf(0),expected=sliding.board.flatMap((v,i)=>v&&Math.abs(i%sliding.size-empty%sliding.size)+Math.abs(Math.floor(i/sliding.size)-Math.floor(empty/sliding.size))===1?[i]:[]);
      assert.deepEqual(slidingNeighbours(sliding.board,sliding.size).sort((a,b)=>a-b),expected);assert.ok(moveSliding(sliding,expected[Math.floor(random()*expected.length)]));
    }
  }
});
