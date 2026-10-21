import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newBlocks,newSalvage as newLiveSalvage,stepSalvage,dockSalvage,upgradeSalvage,nextSector,damagePilot,restoreSalvage,hostile,restoreActionArcade,restoreBlocks,populateSector} from '../src/action-games.ts';
import type {FlightInput} from '../src/action-games.ts';
import {freshState,parseState,GAMES} from '../src/state.ts';
import {ACTION_GAMES} from '../src/action-games.ts';
import {GAME_NAMES,GAME_CATEGORY,GAME_DESCRIPTIONS} from '../src/catalog.ts';
const activeBlocks=()=>{const s=newBlocks();s.phase='playing';s.paused=false;return s;};
const flying=(level=2)=>{const s=newSalvage(level,123);s.phase='flying';s.paused=false;return s;};
// Stable legacy-save/physics fixtures. The current combat loop has its own full-run tests.
const newSalvage=(...args:Parameters<typeof newLiveSalvage>)=>{const s=newLiveSalvage(...args);delete s.arcade;s.x=s.y=900;populateSector(s);return s;};
const idle:FlightInput={turn:0,thrust:0,strafe:0,fire:false,tractor:false,pulse:false,aim:null};
test('all six integrated arcade games have catalogue entries, bringing the collection to fifty-four',()=>{assert.equal(GAMES.length-1,54);assert.equal(GAME_NAMES.blocks,'TetriGrid');for(const g of ACTION_GAMES){assert.ok(GAMES.includes(g));assert.ok(GAME_DESCRIPTIONS[g]);assert.equal(GAME_CATEGORY[g],'Arcade & worlds');}});
test('flight uses inertia, turns progressively and respects world edges',()=>{
  const s=flying();s.rocks=[];s.ships=[];s.angle=0;for(let i=0;i<120;i++)stepSalvage(s,{...idle,thrust:1},1/60);assert.ok(s.x>1000);assert.ok(s.vx>100);
  const speed=s.vx;stepSalvage(s,idle,1/60);assert.ok(s.vx<speed);const a=s.angle;stepSalvage(s,{...idle,turn:1},1/60);assert.ok(s.angle>a);
  s.x=1775;for(let i=0;i<300;i++)stepSalvage(s,{...idle,thrust:1},1/60);assert.ok(s.x<=1776&&s.y>=24&&s.y<=1776);
});
test('a tractor draws in fragments; only collected cargo earns delivery credits',()=>{
  const s=flying();s.ships=[];s.rocks=[];s.relics=[{id:1,x:1000,y:900,kind:0,collected:false}];for(let i=0;i<120;i++)stepSalvage(s,{...idle,tractor:true},1/60);
  assert.equal(s.cargo,1);assert.equal(s.relics[0].collected,true);assert.equal(s.credits,0);assert.equal(dockSalvage(s),true);assert.equal(s.cargo,0);assert.equal(s.delivered,1);assert.equal(s.credits,30);assert.equal(s.score,125);
});
test('docking requires the relay, repairs the ship and cannot pay for cargo twice',()=>{
  const s=flying();s.x=1200;s.cargo=4;assert.equal(dockSalvage(s),false);s.x=900;s.hull=10;s.energy=1;assert.equal(dockSalvage(s),true);assert.equal(s.hull,100);assert.equal(s.energy,100);assert.equal(s.credits,120);assert.equal(dockSalvage(s),false);
  s.phase='flying';assert.equal(dockSalvage(s),true);assert.equal(s.credits,120);
});
test('upgrades require docking and sufficient credits, with three levels maximum',()=>{
  const s=flying();s.credits=2000;assert.equal(upgradeSalvage(s,'weapon'),false);dockSalvage(s);
  for(let i=1;i<=3;i++){const before=s.credits;assert.equal(upgradeSalvage(s,'weapon'),true);assert.equal(s.credits,before-60*i);assert.equal(s.upgrades.weapon,i);}assert.equal(upgradeSalvage(s,'weapon'),false);
  s.credits=0;assert.equal(upgradeSalvage(s,'engine'),false);assert.equal(upgradeSalvage(s,'invalid' as 'engine'),false);
});
test('sector gates require archived quota and all six archives can be completed',()=>{
  const s=flying();dockSalvage(s);assert.equal(nextSector(s),false);
  for(let i=1;i<=6;i++){assert.equal(s.sector,i);s.delivered=s.quota;s.mission.bossDefeated=true;assert.equal(nextSector(s),true);}assert.equal(s.phase,'complete');assert.equal(s.paused,true);assert.equal(nextSector(s),false);
});
test('weapons consume energy, respect rate limits and cannot shoot while paused',()=>{
  const s=flying();s.x=1200;s.ships=[];s.rocks=[];stepSalvage(s,{...idle,fire:true},1/60);assert.equal(s.bolts.length,1);assert.ok(s.energy<100);stepSalvage(s,{...idle,fire:true},1/60);assert.equal(s.bolts.length,1);
  s.energy=0;s.cooldown=0;stepSalvage(s,{...idle,fire:true},1/60);assert.equal(s.bolts.length,1);s.paused=true;const before=structuredClone(s);stepSalvage(s,{...idle,fire:true},.04);assert.deepEqual(s,before);
});
test('EMP disables hostiles in front, spares friends and uses a separate slow recharge',()=>{
  const s=flying();s.x=1200;s.y=900;s.angle=0;s.rocks=[];s.ships=[{id:1,kind:'raider',x:1350,y:900,vx:0,vy:0,angle:0,hp:100,cooldown:5},{id:2,kind:'warden',x:1320,y:900,vx:0,vy:0,angle:0,hp:100,cooldown:5}];
  for(let i=0;i<20;i++)stepSalvage(s,{...idle,pulse:i===0},1/60);assert.equal(s.ships.find(v=>v.id===1)!.hp,100);assert.ok(s.ships.find(v=>v.id===1)!.disabledFor!>4);assert.equal(s.ships.find(v=>v.id===2)!.disabledFor??0,0);assert.ok(s.pulseCooldown>17);assert.equal(s.energy,100);
  stepSalvage(s,{...idle,pulse:true},1/60);assert.equal(s.ships.find(v=>v.id===1)!.hp,100);assert.equal(s.empPulses.length,1);
});
test('shield absorbs damage, invulnerability prevents repeat damage and zero hull ends flight',()=>{
  const s=flying();s.invulnerable=0;s.shield=10;damagePilot(s,30);assert.equal(s.shield,0);assert.equal(s.hull,80);damagePilot(s,30);assert.equal(s.hull,80);s.invulnerable=0;damagePilot(s,100);assert.equal(s.phase,'lost');assert.equal(s.paused,true);
});
test('friendly fire causes a warden pursuit rather than treating every ship as an enemy',()=>{
  const s=flying();s.safety=false;s.rocks=[];const friend={id:2,kind:'warden' as const,x:1100,y:900,vx:0,vy:0,angle:0,hp:100,cooldown:10};s.ships=[friend];assert.equal(hostile(s,friend),false);
  s.x=1050;s.angle=0;s.reputation=2;s.bolts=[{x:1097,y:900,vx:0,vy:0,life:1,owner:0,damage:14}];stepSalvage(s,idle,1/60);assert.equal(s.reputation,3);assert.equal(hostile(s,friend),true);
});
test('difficulty increases hostile count, speed, projectile speed and fire frequency',()=>{
  const values=[];
  for(let level=1;level<=5;level++){
    const s=flying(level),count=s.ships.filter(v=>hostile(s,v)).length;s.rocks=[];s.sectorTime=5;s.x=1300;s.y=900;s.invulnerable=0;s.ships=[{id:4,kind:'raider',x:1500,y:900,vx:0,vy:0,angle:0,hp:100,cooldown:0,arming:true}];stepSalvage(s,idle,1/60);
    values.push({count,speed:Math.hypot(s.ships[0].vx,s.ships[0].vy),bullet:Math.hypot(s.bolts[0].vx,s.bolts[0].vy),cooldown:s.ships[0].cooldown});
  }
  for(let i=1;i<5;i++){assert.ok(values[i].count>values[i-1].count);assert.ok(values[i].speed>values[i-1].speed);assert.ok(values[i].bullet>values[i-1].bullet);assert.ok(values[i].cooldown<values[i-1].cooldown);}
});
test('long flights keep resources, objects and coordinates bounded and recoverable',()=>{
  for(let level=1;level<=5;level++){
    const s=flying(level);for(let i=0;i<6000&&!s.paused;i++)stepSalvage(s,{...idle,thrust:1,turn:.23,fire:true,tractor:true,pulse:i%600===0},1/60);
    assert.ok(s.x>=0&&s.x<=1800&&s.y>=0&&s.y<=1800);assert.ok(s.hull>=0&&s.shield>=0&&s.energy>=0);assert.ok(s.bolts.length<=180&&s.particles.length<=240);assert.ok(restoreSalvage(s));
  }
});
test('saves resume paused and transient flight projectiles are discarded safely',()=>{
  const s=freshState();s.preferences.game='salvage';s.actionArcade.blocks=activeBlocks();s.actionArcade.salvage=flying();stepSalvage(s.actionArcade.salvage,{...idle,fire:true},1/60);
  const restored=parseState(JSON.stringify({version:1,...s}));assert.equal(restored.actionArcade.blocks!.paused,true);assert.equal(restored.actionArcade.salvage!.paused,true);assert.deepEqual(restored.actionArcade.salvage!.bolts,[]);assert.equal(restored.preferences.game,'salvage');
  const {actionArcade,...old}=s;const migration=parseState(JSON.stringify({version:1,...old}));assert.equal(migration.actionArcade.blocks,null);assert.deepEqual(migration.chess,s.chess);
});
test('malformed arcade saves are rejected individually without damaging other progress',()=>{
  const b=activeBlocks(),f=flying();b.run.board[0][0]=NaN;f.hull=101;const loaded=restoreActionArcade({blocks:b,salvage:f,music:false,effects:false,volume:.6});assert.equal(loaded.blocks,null);assert.equal(loaded.salvage,null);assert.equal(loaded.music,false);assert.equal(loaded.volume,.6);const ready=newBlocks();ready.run.board.forEach(row=>row.fill('I'));assert.equal(restoreBlocks(ready),null);
});
