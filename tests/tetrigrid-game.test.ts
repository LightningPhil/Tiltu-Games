import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, TYPES, emptyBoard, cells, type Type } from '../src/tetrigrid/game.ts';

const seeded = () => { let seed=1234; return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); };
function quad(game: Game) {
  game.board=emptyBoard();
  for(let y=18;y<22;y++) for(let x=0;x<9;x++) game.board[y][x]='J';
  // Preserve one cell so the all-clear award does not mask basic scoring.
  game.board[17][0]='T';
  game.active={type:'I',x:7,y:18,rotation:1};
  assert.equal(game.collides(game.active),false);
}
test('seven-bag deals every type once per bag, with five visible previews',() => {
  const game=new Game('zen',seeded());const dealt:Type[]=[];
  for(let i=0;i<70;i++) {dealt.push(game.active.type);assert.equal(game.queue.length,6);game.spawn();}
  for(let i=0;i<70;i+=7) assert.deepEqual([...dealt.slice(i,i+7)].sort(),[...TYPES].sort());
});
test('opposite rotations undo one another and floor kicks allow a T to rotate',() => {
  const game=new Game('zen');game.active={type:'T',x:3,y:7,rotation:0};const original={...game.active};
  assert.equal(game.rotate(1),true);assert.equal(game.rotate(-1),true);assert.deepEqual(game.active,original);
  game.active={type:'T',x:3,y:20,rotation:0};assert.equal(game.rotate(1),true);
  assert.equal(game.collides(game.active),false);assert.ok(game.active.y<20);
});
test('I and J wall kicks recover rotations next to the left wall',() => {
  for(const type of ['I','J'] as Type[]) {
    const game=new Game('zen');game.active={type,x:type==='I' ? -2 : -1,y:8,rotation:1};
    assert.equal(game.collides(game.active),false);assert.equal(game.rotate(-1),true);
    assert.equal(game.collides(game.active),false);assert.ok(cells(game.active).every(([x]) => x>=0));
  }
});
test('ghost landing and hard drop agree, award drop points and spawn a new piece',() => {
  const game=new Game('zen');const piece={...game.active};const landing=game.ghostY();
  game.hardDrop();assert.equal(game.pieces,1);assert.equal(game.score,(landing-piece.y)*2);
  assert.ok(cells({...piece,y:landing}).every(([x,y]) => game.board[y][x]===piece.type));
});
test('ground contact waits 500ms; blocked soft drop cannot lock early',() => {
  const game=new Game('marathon');game.active={type:'O',x:4,y:20,rotation:0};
  game.tick(499);assert.equal(game.pieces,0);assert.equal(game.down(true),false);assert.equal(game.pieces,0);
  game.tick(1);assert.equal(game.pieces,1);
});
test('lock delay resets have a finite cap',() => {
  const game=new Game('marathon');game.active={type:'O',x:4,y:20,rotation:0};
  for(let i=0;i<15;i++) {game.tick(100);game.move(i%2 ? 1 : -1);assert.equal(game.lockClock,0);}
  assert.equal(game.lockResets,15);game.tick(300);game.move(1);assert.equal(game.lockClock,300);
  game.tick(200);assert.equal(game.pieces,1);
});
test('floor kicks cannot evade the reset cap by dropping back to the same height',() => {
  const game=new Game('marathon');game.active={type:'T',x:3,y:20,rotation:0};game.lockResets=15;game.lockClock=400;
  assert.equal(game.rotate(1),true);game.down();assert.equal(game.lockClock,400);
});
test('Zen never falls or locks automatically, even on the floor',() => {
  const game=new Game('zen');const y=game.active.y;game.tick(60000);assert.equal(game.active.y,y);
  game.active.y=game.ghostY();game.tick(60000);assert.equal(game.pieces,0);game.hardDrop();assert.equal(game.pieces,1);
});
test('hold works once per piece and checks collision when retrieving held pieces',() => {
  const game=new Game('zen');const original=game.active.type;assert.equal(game.hold(),true);
  assert.equal(game.held,original);assert.equal(game.hold(),false);game.hardDrop();assert.equal(game.canHold,true);
  game.held='O';game.board[1][4]='J';assert.equal(game.hold(),true);assert.equal(game.ended,'topout');
});
test('quad scoring, combos and back-to-back awards use the level before clearing',() => {
  const game=new Game('marathon');game.lines=9;quad(game);game.lock();
  assert.equal(game.event?.points,800);assert.equal(game.lines,13);assert.equal(game.level,2);assert.equal(game.b2b,true);
  quad(game);game.lock();assert.equal(game.event?.points,2500);assert.equal(game.event?.b2b,true);assert.equal(game.maxCombo,1);
});
test('all clear awards a bonus and preserves a 22 by 10 board',() => {
  const game=new Game('zen');quad(game);game.board[17][0]=null;game.lock();
  assert.equal(game.event?.perfect,true);assert.equal(game.score,2800);assert.equal(game.board.length,22);assert.equal(game.board[0].length,10);
});
test('three-corner T-spin is scored only when rotation is the last successful action',() => {
  const game=new Game('zen');game.active={type:'T',x:3,y:19,rotation:0};
  game.board[19][3]='J';game.board[19][5]='J';game.board[21][3]='J';game.lastRotation=true;
  game.lock();assert.equal(game.spins,1);assert.equal(game.score,400);assert.equal(game.event?.label,'T-SPIN');
  const other=new Game('zen');other.active={type:'T',x:3,y:19,rotation:0};
  other.board[19][3]='J';other.board[19][5]='J';other.board[21][3]='J';other.lastRotation=false;other.lock();assert.equal(other.spins,0);
});
test('Sprint ends only at 40 lines; Ultra stops exactly at 120 seconds',() => {
  const sprint=new Game('sprint');sprint.lines=36;quad(sprint);sprint.lock();assert.equal(sprint.ended,'complete');assert.equal(sprint.lines,40);
  const ultra=new Game('ultra');ultra.elapsed=119990;ultra.tick(80);assert.equal(ultra.elapsed,120000);assert.equal(ultra.ended,'complete');
  const score=ultra.score;ultra.hardDrop();assert.equal(ultra.score,score);
});
test('saved runs restore every gameplay timer without sharing mutable state',() => {
  const game=new Game('marathon',seeded());game.down(true);game.move(-1);game.hold();game.elapsed=8000;
  const snapshot=game.snapshot(),restored=Game.restore(snapshot);assert.ok(restored);assert.deepEqual(restored.snapshot(),snapshot);
  restored.board[21][0]='I';assert.equal(game.board[21][0],null);assert.equal(snapshot.board[21][0],null);
});
test('malformed and impossible saved positions fail safely',() => {
  const game=new Game('marathon');assert.equal(Game.restore(null),null);assert.equal(Game.restore({version:1}),null);
  const snapshot=game.snapshot();snapshot.active.x=100;assert.equal(Game.restore(snapshot),null);
  const bad=game.snapshot();bad.score=NaN;assert.equal(Game.restore(bad),null);
  const blocked=game.snapshot();const [x,y]=cells(blocked.active)[0];blocked.board[y][x]='I';assert.equal(Game.restore(blocked),null);
  assert.equal(Game.restore({...game.snapshot(),mode:'toString'}),null);
  const injected=Game.restore({...game.snapshot(),snapshot:'broken',random:0,event:{rows:null}});
  assert.ok(injected);assert.equal(typeof injected.snapshot,'function');assert.equal(injected.event,null);
  const fullRow=game.snapshot();fullRow.board[21].fill('I');assert.equal(Game.restore(fullRow),null);
  const kicked=game.snapshot();kicked.active={type:'I',rotation:2,x:3,y:-1};assert.ok(Game.restore(kicked));
});
test('seeded play never writes outside the board or changes its dimensions',() => {
  const random=seeded();for(let run=0;run<30;run++) {
    const game=new Game('marathon',random);
    for(let i=0;i<100 && !game.ended;i++) {
      for(let m=0;m<Math.floor(random()*6);m++) game.move(random()<.5 ? -1 : 1);
      game.rotate(random()<.5 ? -1 : 1);if(random()<.2) game.hold();game.hardDrop();
      assert.equal(game.board.length,22);assert.ok(game.board.every(row => row.length===10 && row.every(cell => cell===null || TYPES.includes(cell))));
      if(!game.ended) assert.equal(game.collides(game.active),false);
    }
  }
});
