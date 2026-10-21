import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './ports-void-harness.ts';
import { INVASION, STEP_MS, GAME_CONFIG } from '../src/arcade-ports/void/balance.ts';
import { simulateInvasion } from './ports-void-invasion-sim.ts';

function fleet(width=1200){const runtime=loadGame(1,width,800);runtime.Game.recordable=false;runtime.Game.wave=30;runtime.Game.beginCommander();return runtime;}

test('the final fleet marches together, reverses at a live edge, and steps down without breaking formation',()=>{
    const {Game}=fleet(),ships=Game.enemies,f=Game.invasion;
    assert.equal(ships.length,20);assert.ok(ships.every(e=>e.hp>=4500));
    const start=ships.map(e=>({x:e.x,y:e.y}));Game.updateInvasion(STEP_MS);
    const dx=ships[0].x-start[0].x;assert.ok(dx>0);
    ships.forEach((e,i)=>{assert.ok(Math.abs(e.x-start[i].x-dx)<1e-6);assert.equal(e.y,start[i].y);});
    for(let i=0;i<60;i++){const x=ships[0].x;Game.updateInvasion(STEP_MS);assert.ok(ships[0].x>x);assert.ok(ships[0].x-x<2);}
    const shift=1200-18-Math.max(...ships.map(e=>e.x+e.radius));ships.forEach(e=>e.x+=shift);
    Game.updateInvasion(STEP_MS);assert.equal(f.direction,-1);assert.equal(f.descents,1);
    for(let i=0;i<39;i++)Game.updateInvasion(STEP_MS);
    ships.forEach((e,i)=>assert.ok(Math.abs(e.y-start[i].y-INVASION.descent)<1e-6));
    assert.ok(ships.every(e=>e.x-e.radius>=18-1e-6&&e.x+e.radius<=1182+1e-6));
});

test('only front survivors charge and fire; a locked shot leaves its target fixed during the warning',()=>{
    const {Game}=fleet();const f=Game.invasion;f.fireTimer=INVASION.warning;Game.updateInvasion(STEP_MS);
    const charged=Game.enemies.filter(e=>Number.isFinite(e.fireTimer));assert.equal(charged.length,2);assert.ok(charged.every(e=>e.row===3));
    const lock=charged.find(e=>e.lockedTarget),position={...lock.lockedTarget};Game.player.x=30;Game.player.y=700;
    assert.deepEqual({...lock.lockedTarget},position);f.fireTimer=1;Game.updateInvasion(STEP_MS);
    assert.equal(Game.bullets.length,2);assert.ok(Game.bullets.every(b=>b.color===GAME_CONFIG.ENEMY_PLASMA_COLOR));
    assert.ok(Game.bullets.some(b=>b.vx===0&&b.vy>0));
    const aimed=Game.bullets.find(b=>b.vx!==0);
    assert.ok(Math.abs(Math.atan2(aimed.vy,aimed.vx)-Math.atan2(position.y-aimed.y,position.x-aimed.x))<1e-6);
    Game.enemies.filter(e=>e.row===3).forEach(e=>e.takeDamage(100000));f.fireTimer=INVASION.warning;Game.bullets=[];Game.updateInvasion(STEP_MS);
    assert.ok(Game.enemies.filter(e=>e.active&&Number.isFinite(e.fireTimer)).every(e=>e.row===2));
});

test('every invader must die; overdrive clears old shots and reaching the marked line loses',()=>{
    const {Game}=fleet();Game.enemies.slice(0,-1).forEach(e=>e.takeDamage(100000));
    Game.update(STEP_MS);assert.equal(Game.active,true);assert.equal(Game.victory,false);assert.equal(Game.invasion.phase,2);
    assert.equal(Game.bullets.filter(b=>b.owner==='enemy').length,0);assert.ok(Game.invasion.fireTimer>1000);
    const last=Game.enemies.find(e=>e.active);last.y=Game.invasion.breachY-last.radius-1;Game.invasion.dropTimer=650;
    Game.update(100);assert.equal(Game.active,false);assert.equal(Game.victory,false);assert.match(Game.stats.lastHit,/BREACH LINE/);
    const next=fleet().Game;next.enemies.slice(0,-1).forEach(e=>e.takeDamage(100000));next.update(STEP_MS);
    next.enemies.find(e=>e.active).takeDamage(100000);next.update(STEP_MS);assert.equal(next.victory,true);
});

test('prepared endgame builds beat both arena sizes; underpowered builds and camping are punished',()=>{
    for(const width of [1200,600])for(const style of ['forward','flanking','crossfire','recommended'] as const){
        const result=simulateInvasion(3,style,width);assert.equal(result.won,true,JSON.stringify(result));assert.ok(result.seconds<90);assert.ok(result.maxShots<=24);
    }
    assert.equal(simulateInvasion(3,'modest',1200).won,false);
    const idle=simulateInvasion(1,'forward',1200,{stationary:true});assert.equal(idle.won,false);assert.equal(idle.minHull,0);
});
