import test from 'node:test';
import assert from 'node:assert/strict';
import {seededRandom} from '../src/skill.ts';
import {freshState,parseState} from '../src/state.ts';
import {newTurnGame,chooseTurnMove,turnMoves,playTurn} from '../src/collection/turn-games.ts';
import {newBackgammon,rollBackgammon,backgammonPaths,chooseBackgammonPath,backgammonCubeDecision,offerBackgammonDouble} from '../src/collection/backgammon.ts';
import {bearoffOutcomes,bearoffWinChance} from '../src/collection/bearoff.ts';
import {newCribbage,chooseCribDiscards,discardCribbage,cutCribbage,chooseCribPeg,cribLegalCards,playCribbage} from '../src/collection/cribbage.ts';
import {newGin,chooseGinDraw,chooseGinDiscard,drawGin,discardGin,validGin} from '../src/club-plus/gin.ts';
import {newMemory,flipMemory,chooseMemory,resolveMemory} from '../src/club-plus/playful.ts';
import {newDominoes,DOMINO_TILES,chooseDomino,dominoMoves,playDomino} from '../src/club-plus/dominoes.ts';
import {newHop,chooseHop,hopMoves,moveHop} from '../src/club-plus/hop.ts';
import {newAbstract,abstractMoves,chooseAbstract,playAbstract} from '../src/club-plus/abstracts.ts';
import {newPoker,dealPoker,choosePokerAction,choosePokerDiscards,actPoker} from '../src/poker.ts';
import {newLife,chooseLifeEdits,editLife,stepLife,lifeComputer} from '../src/life.ts';
import {newGo,chooseGoMove,placeGo,goPositions} from '../src/go.ts';
import {defaultOptions} from '../src/state.ts';
import {newTricks,trickLegal,chooseTrick,playTrick,collectTrick,whistEndingValues} from '../src/club-plus/tricks.ts';
import {Chess,chooseChessMove} from '../src/chess.ts';
import {renderGin} from '../src/club-plus/view-cards.ts';
import type {PlusUI} from '../src/club-plus/view-types.ts';

test('new computer skill preferences survive saves, migrate old saves and reject invalid levels',()=>{
  for(let level=1;level<=5;level++){
    const s=freshState();s.preferences.pokerLevel=level;s.preferences.lifeLevel=6-level;
    const restored=parseState(JSON.stringify({version:1,...s}));
    assert.equal(restored.preferences.pokerLevel,level);assert.equal(restored.preferences.lifeLevel,6-level);
  }
  for(const invalid of [undefined,0,6,2.5,'5',null]){
    const s=freshState();Object.assign(s.preferences,{pokerLevel:invalid,lifeLevel:invalid});
    const p=parseState(JSON.stringify({version:1,...s})).preferences;
    assert.equal(p.pokerLevel,3);assert.equal(p.lifeLevel,3);
  }
});

test('Expert Reversi solves the former wrong endgame, without mutating the root',()=>{
  const s=newTurnGame('reversi');s.board=[-1,1,0,-1,1,1,1,1,1,1,1,-1,-1,-1,1,1,1,1,1,-1,1,-1,-1,0,1,1,1,-1,1,1,-1,-1,1,1,-1,1,1,1,-1,-1,1,-1,1,0,1,1,-1,-1,1,1,1,1,0,0,-1,1,1,1,1,-1,0,0,-1,1];s.turn=-1;
  const before=structuredClone(s);
  // Independently solved final margins: 2:-30, 43:-46, 52:-42, 53:-38.
  for(const seed of [1,17,99])assert.equal(chooseTurnMove(s,5,seededRandom(seed))?.to,2);
  assert.deepEqual(s,before);
});

test('Expert Kalah solves low-seed endings rather than truncating an extra-turn line',()=>{
  const s=newTurnGame('kalah');s.board=[1,1,2,0,2,0,20,0,0,0,0,1,1,20];s.turn=1;
  const before=structuredClone(s);
  // Independent final store margins for pits 0,1,2,4 are +4,+2,+2,+4.
  for(const seed of [1,17,99])assert.ok([0,4].includes(chooseTurnMove(s,5,seededRandom(seed))!.to));
  assert.deepEqual(s,before);
});

test('Expert Dots and Boxes sees complete chains and retained turns in the last fourteen edges',()=>{
  const s=newTurnGame('dots','computer',5,3);s.turn=1;s.board=[-1,1,0,-1,-1,1,0,-1,0,0,1,0,0,0,1,-1,1,1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0];
  const before=structuredClone(s);
  // Independent exact future box margins: 2/6/18:+5, 13:+1, 12:-1, all others:-9.
  for(const seed of [1,17,99])assert.ok([2,6,18].includes(chooseTurnMove(s,5,seededRandom(seed))!.to));
  assert.deepEqual(s,before);
});

test('all five turn-game opponents return a listed legal move in each rule family',()=>{
  for(const kind of ['noughts','reversi','dots','morris','kalah'] as const)for(let level=1;level<=5;level++){
    const s=newTurnGame(kind,'computer',level,3),before=structuredClone(s);
    const m=chooseTurnMove(s,level,seededRandom(31));assert.ok(m);
    assert.ok(turnMoves(s).some(v=>JSON.stringify(v)===JSON.stringify(m)),`${kind} ${level}`);
    assert.deepEqual(s,before);assert.ok(playTurn(s,m!));
    s.result=1;assert.equal(chooseTurnMove(s,level),null);
  }
});

test('every Backgammon level obeys the complete dice path, bar entry and higher-die constraints',()=>{
  for(const scenario of ['opening','bar','bearoff'])for(let level=1;level<=5;level++){
    const s=newBackgammon('computer',level,81);s.turn=1;s.phase='move';s.dice=[1,6];s.rolled=[1,6];
    if(scenario==='bar'){s.board.fill(0);s.board[23]=-2;s.board[22]=2;s.board[0]=-13;s.bar=[13,0];}
    if(scenario==='bearoff'){s.board.fill(0);s.board[0]=1;s.board[23]=-1;s.bar=[0,0];s.off=[14,14];}
    const before=structuredClone(s),paths=backgammonPaths(s),choice=chooseBackgammonPath(s,level,seededRandom(47));
    assert.ok(paths.some(p=>JSON.stringify(p)===JSON.stringify(choice)));assert.deepEqual(s,before);
  }
});

test('computer doubling decisions cannot offer a cube owned by the opponent or overflow it',()=>{
  for(let level=1;level<=5;level++){
    const s=newBackgammon('computer',level,81);s.phase='roll';s.turn=1;s.board.fill(0);s.off=[14,0];s.board[0]=1;s.board[23]=-15;
    const before=structuredClone(s);backgammonCubeDecision(s,level);assert.deepEqual(s,before);
    for(const phase of ['opening','move','double','finished'] as const){s.phase=phase;assert.equal(backgammonCubeDecision(s,level).offer,false);}
    s.phase='roll';s.cubeOwner=-1;assert.equal(backgammonCubeDecision(s,level).offer,false);
    s.cubeOwner=0;s.cube=2**1023;assert.equal(backgammonCubeDecision(s,level).offer,false);
    s.cube=1;const decision=backgammonCubeDecision(s,level);if(decision.offer)assert.ok(offerBackgammonDouble(s));
  }
});

test('small-race Backgammon solver obeys the same overshoot, doubles and maximum-dice rules as live play',()=>{
  const rng=seededRandom(81),key=(a:number[])=>a.join(',');
  for(let fixture=0;fixture<24;fixture++){
    const counts=Array(6).fill(0);for(let j=0;j<1+fixture%6;j++)counts[Math.floor(rng()*6)]++;
    for(let a=1;a<=6;a++)for(let b=a;b<=6;b++){
      const s=newBackgammon('local',5,81);s.board.fill(0);counts.forEach((n,i)=>s.board[i]=n);s.board[23]=-1;s.off=[15-counts.reduce((n,v)=>n+v,0),14];s.phase='move';s.dice=a===b?[a,a,a,a]:[a,b];
      const expected=new Set(backgammonPaths(s).map(path=>{const result=counts.slice();for(const m of path){result[m.from]--;if(m.to>=0)result[m.to]++;}return key(result);}));
      assert.deepEqual(new Set(bearoffOutcomes(counts,a,b).map(key)),expected);
    }
  }
  assert.equal(bearoffWinChance([1,0,0,0,0,0],[0,0,0,0,0,1]),1);
  assert.ok(Math.abs(bearoffWinChance([0,0,0,0,0,1],[1,0,0,0,0,0])-.75)<1e-12);
});

test('Gin never chooses an empty source, a forced forbidden draw or a third phase action',()=>{
  for(let level=1;level<=5;level++){
    const s=newGin(42);s.phase='draw';s.discard.push(...s.stock.splice(0));s.forcedStock=false;
    assert.ok(validGin(s));assert.equal(chooseGinDraw(s,level),'discard');assert.ok(drawGin(s,'discard'));
    assert.equal(chooseGinDraw(s,level),null);
    const move=chooseGinDiscard(s,level);assert.ok(move);assert.notEqual(move!.card,s.drawn);assert.ok(discardGin(s,move!.card,move!.knock));
    const forced=newGin(42);forced.phase='draw';forced.forcedStock=true;assert.equal(chooseGinDraw(forced,level),'stock');
    forced.stock=[];assert.equal(chooseGinDraw(forced,level),null);
    forced.result=0;assert.equal(chooseGinDiscard(forced,level),null);
  }
});

test('Gin renders a temporarily empty discard pile after either player takes its last upcard',()=>{
  const ui={selected:null,cards:[],hint:[],notice:'',thinking:false,busy:false,zoom:false,notes:false,towers:true,wordFrom:null,wordPreview:[],outline:null,bid:3,hintEntry:null,loading:false} as PlusUI;
  for(const actor of [0,1]){
    const s=newGin(42);s.turn=actor;assert.ok(drawGin(s,'discard'));assert.equal(s.discard.length,0);
    const view=renderGin(s,ui);assert.match(view.board,/aria-label="Discard pile empty"/);assert.match(view.board,/card-placeholder/);assert.ok(!view.board.includes('undefined'));
    assert.match(view.board,/data-plus="gin-draw:discard" class="gin-discard" disabled/);
    const move=chooseGinDiscard(s,5)!;assert.ok(discardGin(s,move.card,move.knock));assert.doesNotThrow(()=>renderGin(s,ui));
  }
});

test('Gin choices use only own cards, discards and observed opponent takes at every level',()=>{
  for(let level=1;level<=5;level++){
    const a=newGin(81);a.phase='draw';const b=structuredClone(a),hidden=[...b.hands[1],...b.stock].reverse();
    b.hands[1]=hidden.splice(0,10);b.stock=hidden;
    const before=structuredClone(a);assert.equal(chooseGinDraw(a,level),chooseGinDraw(b,level));assert.deepEqual(a,before);
    drawGin(a,'stock');const c=structuredClone(a),rest=[...c.hands[1],...c.stock].reverse();c.hands[1]=rest.splice(0,10);c.stock=rest;
    const saved=structuredClone(a);assert.deepEqual(chooseGinDiscard(a,level),chooseGinDiscard(c,level));assert.deepEqual(a,saved);
  }
});

test('Memory waits for the two exposed tiles to resolve and never reads concealed faces',()=>{
  for(let level=1;level<=5;level++){
    const a=newMemory(12,81),b=structuredClone(a);b.deck.reverse();
    assert.equal(chooseMemory(a,level),chooseMemory(b,level));
    const first=chooseMemory(a,level)!;assert.ok(flipMemory(a,first));const second=chooseMemory(a,level)!;assert.notEqual(first,second);assert.ok(flipMemory(a,second));
    assert.equal(chooseMemory(a,level),null);assert.ok(resolveMemory(a));
    a.result=0;assert.equal(chooseMemory(a,level),null);
  }
});

test('Dominoes prioritises a visible Fives match win over simply ending the round',()=>{
  const id=(a:number,b:number)=>DOMINO_TILES.findIndex(t=>t[0]===a&&t[1]===b);
  for(let level=3;level<=5;level++){
    const s=newDominoes('fives',81);s.target=50;s.scores=[40,0];s.turn=0;s.opening=null;
    s.chain=[{tile:id(0,5),left:5,right:0},{tile:id(0,6),left:0,right:6}];s.hands[0]=[id(5,6)];
    const used=new Set([...s.chain.map(t=>t.tile),...s.hands[0]]),rest=DOMINO_TILES.flatMap((_,i)=>used.has(i)?[]:[i]);s.hands[1]=rest.splice(0,7);s.stock=rest;
    const before=structuredClone(s),m=chooseDomino(s,level);assert.deepEqual(m,{tile:id(5,6),end:1});assert.deepEqual(s,before);
    assert.ok(playDomino(s,m!));assert.equal(s.result,0);
  }
});

test('all Dominoes styles and levels return only a legal tile and end',()=>{
  for(const variant of ['draw','block','fives'] as const)for(let level=1;level<=5;level++){
    const s=newDominoes(variant,81),before=structuredClone(s),m=chooseDomino(s,level);
    assert.ok(m&&dominoMoves(s).some(v=>v.tile===m.tile&&v.end===m.end));assert.deepEqual(s,before);assert.ok(playDomino(s,m!));
    s.result=0;assert.equal(chooseDomino(s,level),null);
  }
});

test('strong hop opponents finish the actual target camp with a legal move',()=>{
  for(const kind of ['chinese','halma'] as const)for(let level=3;level<=5;level++){
    const s=newHop(kind,10);s.board.fill(0);s.turn=0;
    const own=kind==='chinese'?[102,112,113,114,115,116,117,118,119,120]:[69,77,78,79,87,88,89,96,97,98];
    own.forEach(at=>s.board[at]=1);for(let i=25;i<=34;i++)s.board[i]=2;
    const before=structuredClone(s),m=chooseHop(s,level);assert.ok(m&&hopMoves(s).some(v=>v.from===m.from&&v.to===m.to));assert.deepEqual(s,before);
    assert.ok(moveHop(s,m!.from,m!.to));assert.equal(s.result,0);
  }
});

test('Hex handles its final legal cell at every skill without an infinite score leaking into choice',()=>{
  for(let level=1;level<=5;level++){
    const s=newAbstract('hex',7,'normal',81);s.board=[...'1221112211221121211211111222121212121121212022222'].map(Number);s.moves=48;
    const before=structuredClone(s);assert.deepEqual(abstractMoves(s),[43]);assert.equal(chooseAbstract(s,level),43);assert.deepEqual(s,before);assert.ok(playAbstract(s,43));
  }
});

test('Gomoku creates its own forcing fork before defending an opposing three',()=>{
  const s=newAbstract('gomoku',15,'normal',42);s.board=s.board.map((_,i)=>1+((Math.floor(i/15)+2*(i%15))%4<2?0:1));
  for(const row of [5,9]){for(const col of [3,4,8,9])s.board[row*15+col]=0;for(const col of [5,6,7])s.board[row*15+col]=row===5?1:2;}s.board[0]=0;s.board[2]=2;
  assert.ok([79,83].includes(chooseAbstract(s,5)!));
  let successes=0;for(let seed=1;seed<=64;seed++){s.seed=seed*7919;const before=structuredClone(s),at=chooseAbstract(s,3);assert.ok(abstractMoves(s).includes(at!));assert.deepEqual(s,before);if([79,83].includes(at!))successes++;}
  assert.ok(successes>45,'Challenging should reliably recognise its forcing win');
});

test('Expert Go preserves a three-stone group instead of accepting a one-stone capture bait',()=>{
  for(const size of [9,19] as const){
    const s=newGo(size,defaultOptions()),offset=Math.floor((size-9)/2),at=(r:number,c:number)=>(r+offset)*size+c+offset;
    for(const [r,c] of [[4,4],[4,5],[4,6],[1,2],[2,1],[2,3]])s.board[at(r,c)]=1;
    for(const [r,c] of [[2,2],[3,4],[3,5],[3,6],[4,3],[4,7],[5,4],[5,5]])s.board[at(r,c)]=-1;
    const before=structuredClone(s),choice=chooseGoMove(s,5,seededRandom(81));assert.deepEqual(s,before);assert.equal(choice.move,at(5,6));
    assert.equal(placeGo(s.board,size,s.turn,choice.move,goPositions(s)).error,'');
  }
});

test('Expert chess reads exact pawn-race tempi for both colours and converts without repeating',()=>{
  for(const [fen,first,owner] of [
    ['K7/8/8/1k6/8/8/7P/8 w - - 0 1','h4','w'],
    ['8/7p/8/8/1K6/8/8/k7 b - - 0 1','h5','b']
  ] as const){
    const chess=new Chess(fen),answer=chooseChessMove({startFen:fen,moves:[]},5);assert.equal(answer.move,first);assert.equal(answer.solved,'KPK');
    for(let ply=0;ply<80;ply++){
      assert.ok(!chess.isDraw(),'A winning pawn ending must not repeat or stall');
      if(chess.board().flat().some(p=>p?.color===owner&&['q','r'].includes(p.type)))break;
      const position=chess.fen(),move=chooseChessMove({startFen:position,moves:[]},5);assert.equal(move.solved,'KPK');assert.equal(chess.fen(),position);assert.ok(chess.moves().includes(move.move!));chess.move(move.move!);
    }
    assert.ok(chess.board().flat().some(p=>p?.color===owner&&['q','r'].includes(p.type)));
  }
});

test('camp endgames rearrange home pieces to force the next finish',()=>{
  for(const [kind,size,own,winning] of [
    ['chinese',7,[105,112,113,114,115,116,117,118,119,120],['113:111']],
    ['halma',10,[69,78,79,87,88,89,95,96,97,98],['97:99']],
    ['halma',16,[190,191,205,206,207,219,220,221,222,223,235,236,237,238,239,251,252,253,254],['221:255','253:255']]
  ] as const){
    const s=newHop(kind,size,42);s.board.fill(0);own.forEach(at=>s.board[at]=1);own.forEach((_,i)=>s.board[30+i]=2);
    const before=structuredClone(s),move=chooseHop(s,5);assert.ok(move);assert.ok(winning.includes(`${move!.from}:${move!.to}` as never));assert.deepEqual(s,before);
    assert.ok(moveHop(s,move!.from,move!.to));assert.equal(s.result,null,'This must test a setup rather than an immediate win');
    for(const reply of hopMoves(s)){
      const n=structuredClone(s);moveHop(n,reply.from,reply.to);if(n.result!==null){assert.equal(n.result,0);continue;}
      assert.ok(hopMoves(n).some(m=>{const v=structuredClone(n);moveHop(v,m.from,m.to);return v.result===0;}),'Every reply must permit the proven finish');
    }
  }
});

test('Poker decisions and exchanges are legal at every skill and ignore hidden hands and live deck order',()=>{
  for(const variant of ['holdem','omaha','draw'] as const)for(let level=1;level<=5;level++){
    const a=newPoker(variant);dealPoker(a,seededRandom(81));const b=structuredClone(a),other=1-a.turn,hidden=[...b.holes[other],...b.deck].reverse(),count=b.holes[other].length;
    b.holes[other]=hidden.splice(0,count);b.deck=hidden;
    const before=structuredClone(a),move=choosePokerAction(a,seededRandom(41),level);
    assert.equal(move,choosePokerAction(b,seededRandom(41),level));assert.deepEqual(a,before);assert.ok(move&&actPoker(a,move));
    a.phase='showdown';assert.equal(choosePokerAction(a,seededRandom(41),level),null);
    if(variant==='draw'){
      const hand=before.holes[1],copy=hand.slice(),indices=choosePokerDiscards(hand,level,seededRandom(41));assert.equal(new Set(indices).size,indices.length);assert.ok(indices.every(i=>Number.isInteger(i)&&i>=0&&i<5));assert.deepEqual(hand,copy);
    }
  }
});

test('Cribbage pegging follows the acting seat and remains fair when hidden cards change',()=>{
  for(let level=1;level<=5;level++)for(const actor of [0,1] as const){
    const a=newCribbage(level,81);assert.ok(discardCribbage(a,chooseCribDiscards(a.hands[0],a.dealer===0,level)));assert.ok(cutCribbage(a));a.turn=actor;
    const b=structuredClone(a),enemy=1-actor,hidden=[...b.hands[enemy],...b.stock].reverse(),count=b.hands[enemy].length;b.hands[enemy]=hidden.splice(0,count);b.kept[enemy]=b.hands[enemy].slice();b.stock=hidden;
    const before=structuredClone(a),card=chooseCribPeg(a);assert.equal(card,chooseCribPeg(b));assert.deepEqual(a,before);assert.ok(card!==null&&cribLegalCards(a).includes(card));assert.ok(playCribbage(a,card!));
  }
});

test('Expert Whist enumerates public-consistent endings and ignores actual concealed assignments',()=>{
  let endings=0;
  for(let seed=1;seed<=8;seed++){
    const s=newTricks('whist',40000+seed);
    for(let action=0;action<70&&s.logs.length<13;action++){
      if(s.phase==='collect'){collectTrick(s);continue;}
      if(s.hands.every(h=>h.length<=2)&&trickLegal(s).length>1){
        const before=structuredClone(s),values=whistEndingValues(s);assert.ok(values);const choice=chooseTrick(s,5);assert.equal(choice,values![0].card);assert.deepEqual(s,before);
        const other=structuredClone(s),hidden=other.hands.flatMap((h,p)=>p===s.turn?[]:h).reverse();other.hands.forEach((h,p)=>{if(p!==s.turn)other.hands[p]=hidden.splice(0,h.length);});
        assert.deepEqual(whistEndingValues(other),values);assert.equal(chooseTrick(other,5),choice);endings++;
      }
      assert.ok(playTrick(s,chooseTrick(s,3)!));
    }
  }
  assert.ok(endings>5);
});

test('LifeGenesis plans exactly the permitted edits, evolves once and leaves the player a fresh turn',()=>{
  for(let level=1;level<=5;level++)for(const wrap of [false,true]){
    const s=newLife('colonies');s.turn=-1;s.wrap=wrap;s.edits=level%2?3:1;const before=structuredClone(s),plan=chooseLifeEdits(s,level,seededRandom(41));
    assert.deepEqual(s,before);assert.ok(plan.length<=s.edits);
    const applied=structuredClone(s);for(const at of plan)assert.ok(editLife(applied,at),`Level ${level}: illegal cell ${at}`);assert.ok(stepLife(applied));
    lifeComputer(s,level,seededRandom(41));assert.deepEqual(s,applied);assert.equal(s.generation,before.generation+1);assert.equal(s.turn,1);assert.equal(s.edits,3);assert.ok(s.cells.every(n=>[-1,0,1].includes(n)));
  }
  const s=newLife('colonies');assert.deepEqual(chooseLifeEdits(s,5),[]);const before=structuredClone(s);lifeComputer(s,5);assert.deepEqual(s,before);
  s.turn=-1;s.edits=0;assert.deepEqual(chooseLifeEdits(s,5),[]);lifeComputer(s,5);assert.equal(s.turn,1);
});
