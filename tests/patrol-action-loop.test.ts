import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newSalvage,populateSector,stepSalvage,fireSalvage,pulseSalvage,sectorComplete,nextSector,upgradeSalvage,restoreSalvage,retrySalvage,patrolTractorRange,patrolMultiplier,patrolObjective,maxPatrolShield} from '../src/archive-patrol.ts';
import type {SalvageSession,FlightInput,Vessel} from '../src/archive-patrol.ts';
import {renderPatrol} from '../src/patrol-view.ts';
import {emptyActionArcade} from '../src/action-games.ts';
import {playPatrol} from './patrol-action-balance.ts';
const idle:FlightInput={turn:0,thrust:0,strafe:0,fire:false,tractor:false,pulse:false,aim:null,moveX:0,moveY:0};
const live=(level=2,seed=432)=>{const s=newSalvage(level,seed);s.phase='flying';s.paused=false;return s;};
const step=(s:SalvageSession,seconds:number,input:FlightInput=idle)=>{for(let i=0;i<seconds*60&&!s.paused;i++)stepSalvage(s,input,1/60);};
const raider=(id=90,x=1100,y=650):Vessel=>({id,kind:'raider',x,y,vx:0,vy:0,angle:0,hp:30,maxHp:30,cooldown:5,credited:true});
function isolated(){const s=live();s.ships=[];s.rocks=[];s.relics=[];s.pickups=[];s.arcade!.caches=[];return s;}

test('every opening has nearby shootable targets, reachable loot and no allies clearing the fight',()=>{
  for(let seed=1;seed<=30;seed++)for(let level=1;level<=5;level++){
    const s=newSalvage(level,seed);assert.equal(s.y,650);assert.ok(s.ships.length>=2);
    assert.ok(s.ships.every(v=>v.kind==='raider'&&Math.hypot(v.x-s.x,v.y-s.y)<=256));
    assert.ok(s.ships.every(v=>s.rocks.every(r=>Math.hypot(v.x-r.x,v.y-r.y)>=r.r+54)));
    assert.ok(s.arcade!.caches.some(c=>Math.hypot(c.x-s.x,c.y-s.y)<240));assert.equal(s.relics.length,3);assert.equal(s.quota,12);
  }
});
test('live weapons fire immediately at the workshop and keep firing with zero energy',()=>{
  const s=isolated();s.x=s.y=900;s.energy=0;assert.equal(fireSalvage(s),true);assert.equal(s.energy,0);assert.equal(fireSalvage(s),false);
  step(s,.25,{...idle,fire:true});assert.ok(s.stats.shots>=2);s.paused=true;assert.equal(fireSalvage(s),false);
});
test('primary fire follows the nose even with a nearby target and a legacy assistance flag',()=>{
  const s=isolated();s.angle=0;s.aimAssist=true;s.ships=[raider(90,s.x+300,s.y+25)];fireSalvage(s);
  assert.equal(s.bolts[0].vy,0);assert.equal(s.angle,0);
});
test('cores bank on collection; optional workshop visits cannot pay for them again',()=>{
  const s=isolated();s.relics=[{id:1,x:s.x,y:s.y,kind:2,collected:false}];step(s,.02);
  assert.equal(s.delivered,1);assert.equal(s.cargo,0);assert.equal(s.credits,12);assert.equal(s.stats.fragments,1);step(s,.2);assert.equal(s.credits,12);
});
test('every raider drops two cores, credits and useful loot, and destruction pays once',()=>{
  const s=isolated();s.ships=[{...raider(),hp:0}];step(s,.02);assert.equal(s.sectorKills,1);assert.equal(s.relics.length,2);assert.ok(s.pickups.some(p=>p.kind==='credits'));
  const credits=s.credits;step(s,.02);assert.equal(s.relics.length,2);assert.equal(s.credits,credits);
});
test('supply caches break under real projectile collision and release three cores plus a magnet',()=>{
  const s=isolated();s.arcade!.caches=[{id:71,x:1050,y:650,hp:30,maxHp:30,volatile:false,hit:0}];s.bolts=[{x:980,y:650,vx:2000,vy:0,life:1,owner:0,damage:30}];
  stepSalvage(s,idle,.04);assert.equal(s.arcade!.caches.length,0);assert.equal(s.relics.length,3);assert.ok(s.pickups.some(p=>p.kind==='magnet'));assert.equal(s.bolts.length,0);
});
test('volatile caches chain through other caches and nearby enemies without duplicating loot',()=>{
  const s=isolated();s.arcade!.caches=[{id:1,x:1100,y:650,hp:0,maxHp:30,volatile:true,hit:0},{id:2,x:1200,y:650,hp:30,maxHp:30,volatile:false,hit:0}];s.ships=[raider(5,1130,650)];
  step(s,.02);assert.equal(s.arcade!.caches.length,0);assert.equal(s.ships.length,0);assert.equal(s.relics.length,8);assert.ok(s.pickups.some(p=>p.kind==='overdrive'));step(s,.02);assert.equal(s.relics.length,8);
});
test('overdrive improves damage and fire rate, expires in play and freezes on pause',()=>{
  const normal=isolated(),hot=isolated();hot.pickups=[{id:1,x:hot.x,y:hot.y,kind:'overdrive',life:20}];step(hot,.02);fireSalvage(normal);fireSalvage(hot);
  assert.ok(hot.bolts[0].damage>normal.bolts[0].damage);assert.ok(hot.cooldown<normal.cooldown*.6);const time=hot.arcade!.overdrive;hot.paused=true;stepSalvage(hot,idle,.04);assert.equal(hot.arcade!.overdrive,time);
  hot.paused=false;step(hot,13);assert.equal(hot.arcade!.overdrive,0);
});
test('magnet pickup widens the automatic scoop and its reach returns after expiration',()=>{
  const s=isolated(),range=patrolTractorRange(s);s.pickups=[{id:1,x:s.x,y:s.y,kind:'magnet',life:20}];step(s,.02);assert.ok(patrolTractorRange(s)>=320);assert.ok(patrolTractorRange(s)>range*1.8);
  step(s,21);assert.equal(patrolTractorRange(s),range);
});
test('waves have a loot break and telegraphed arrivals; a living or arriving enemy prevents advancement',()=>{
  const s=isolated();step(s,.02);assert.equal(s.arcade!.wave,1);assert.ok(s.arcade!.rest>3);step(s,4.1);assert.equal(s.arcade!.wave,2);assert.ok(s.warps.length>0);assert.equal(s.ships.length,0);
  step(s,2);assert.ok(s.ships.length>0);assert.equal(s.arcade!.wave,2);step(s,1);assert.equal(s.arcade!.rest,0);
});
test('carrier waves are announced through warp rings in sectors three and six only',()=>{
  for(const sector of [1,3,6]){const s=isolated();s.sector=sector;populateSector(s);s.ships=[];s.warps=[];s.arcade!.wave=2;s.arcade!.rest=.01;step(s,.02);
    assert.equal(s.arcade!.wave,3);assert.equal(s.warps.filter(w=>w.kind==='carrier').length,sector===1?0:1);assert.equal(s.ships.length,0);
  }
});
test('the last wave sweeps remaining loot, prevents a shortage and opens upgrades without returning home',()=>{
  const s=isolated();s.x=300;s.y=300;s.arcade!.wave=3;s.delivered=0;step(s,.02);assert.equal(s.arcade!.cleared,true);assert.equal(s.relics.length,s.quota);
  step(s,5);assert.equal(s.phase,'docked');assert.equal(s.paused,true);assert.ok(s.delivered>=s.quota);assert.ok(sectorComplete(s));assert.equal(s.hull,100);assert.ok(s.credits>=s.quota*12);
  assert.ok(upgradeSalvage(s,'weapon'));assert.ok(nextSector(s));assert.equal(s.sector,2);assert.equal(s.arcade!.wave,1);assert.equal(s.phase,'ready');assert.equal(s.upgrades.weapon,1);
});
test('a core target alone cannot skip waves, and a live carrier prevents the final clear',()=>{
  const s=live();s.delivered=s.quota;s.phase='docked';assert.equal(sectorComplete(s),false);assert.equal(nextSector(s),false);
  s.phase='flying';s.arcade!.wave=3;s.ships=[{...raider(),kind:'carrier'}];step(s,.02);assert.equal(s.arcade!.cleared,false);
});
test('a lethal hit during the final loot sweep remains a loss rather than opening the workshop',()=>{
  const s=isolated();s.arcade!.wave=3;s.arcade!.cleared=true;s.arcade!.finishClock=2.49;s.delivered=s.quota;s.hull=1;s.shield=0;s.invulnerable=0;
  s.bolts=[{x:s.x,y:s.y,vx:0,vy:0,life:1,owner:99,damage:100}];stepSalvage(s,idle,.04);assert.equal(s.phase,'lost');assert.equal(s.hull,0);
});
test('chain multipliers cap at four and return to one when the chain expires',()=>{
  const s=isolated();s.combo=100;s.comboClock=6;assert.equal(patrolMultiplier(s),4);step(s,7);assert.equal(patrolMultiplier(s),1);
});
test('saving retains pending wave arrivals, power-up time, caches and the auto-fire choice',()=>{
  const s=live();s.arcade!.wave=2;s.arcade!.overdrive=8;s.arcade!.magnet=14;s.arcade!.autoFire=true;s.ships=[];s.warps=[{x:1000,y:400,clock:1.2,role:'gunship'}];
  const r=restoreSalvage(JSON.parse(JSON.stringify(s)))!;assert.ok(r);assert.equal(r.paused,true);assert.equal(r.arcade!.wave,2);assert.equal(r.arcade!.overdrive,8);assert.equal(r.arcade!.magnet,14);assert.equal(r.arcade!.autoFire,true);assert.equal(r.warps.length,1);assert.equal(r.arcade!.caches.length,7);
  const before=structuredClone(r);stepSalvage(r,{...idle,fire:true},.04);assert.deepEqual(r,before);
});
test('older cargo is credited once during migration and existing upgrades and coordinates survive',()=>{
  const s=live();delete s.arcade;s.cargo=4;s.credits=15;s.upgrades.weapon=2;s.x=420;s.y=510;const r=restoreSalvage(s)!;
  assert.equal(r.cargo,0);assert.equal(r.delivered,4);assert.equal(r.credits,135);assert.equal(r.upgrades.weapon,2);assert.equal(r.x,420);assert.equal(r.y,510);assert.ok(r.arcade);
  const again=restoreSalvage(r)!;assert.equal(again.credits,135);assert.equal(again.delivered,4);
});
test('a finished saved sector opens upgrades on load and never repeats obsolete no-fire instructions',()=>{
  const s=live();s.arcade!.wave=3;s.arcade!.cleared=true;s.ships=[];s.delivered=s.quota;s.notice='Weapons standby inside the relay shield. Fly outside the ring to engage.';
  const r=restoreSalvage(s)!;assert.equal(r.phase,'docked');assert.equal(r.paused,true);assert.match(r.notice,/Choose upgrades/);assert.ok(nextSector(r));
});
test('rejoining after a loss retains banked loot and the remaining wave without respawning paid targets',()=>{
  const s=live();s.phase='lost';s.hull=0;s.credits=222;s.delivered=7;s.arcade!.wave=2;s.ships=s.ships.slice(0,1);s.arcade!.caches.pop();s.relics[0].collected=true;s.upgrades.weapon=1;
  const r=restoreSalvage(s)!,ship=r.ships[0].id,cores=r.relics.length;assert.ok(retrySalvage(r));assert.equal(r.credits,222);assert.equal(r.delivered,7);assert.equal(r.upgrades.weapon,1);assert.equal(r.arcade!.wave,2);
  assert.equal(r.ships.length,1);assert.equal(r.ships[0].id,ship);assert.equal(r.arcade!.caches.length,6);assert.equal(r.relics.length,cores);assert.equal(r.relics[0].collected,true);assert.equal(r.hull,100);assert.equal(r.phase,'ready');assert.equal(retrySalvage(r),false);
});
test('corrupt arcade additions are bounded without discarding the player’s whole expedition',()=>{
  const s=live();Object.assign(s.arcade!,{wave:999,overdrive:Infinity,magnet:-1,caches:[{id:1,x:NaN,y:100,hp:5,maxHp:30,volatile:false}]});const r=restoreSalvage(s)!;
  assert.ok(r);assert.equal(r.arcade!.wave,1);assert.equal(r.arcade!.overdrive,0);assert.equal(r.arcade!.magnet,0);assert.equal(r.arcade!.caches.length,0);
});
test('live help explains the actual action loop and completion rather than ferrying cargo',()=>{
  const s=live(),ui={settings:false,missions:false,confirmReset:false,difficulty:2};s.phase='ready';s.paused=true;
  const html=renderPatrol(s,emptyActionArcade(),ui);assert.match(html,/Blast\. Scoop\. Upgrade/);assert.match(html,/cores bank instantly/);assert.match(html,/EMP/);assert.doesNotMatch(html,/Space tracks a target|mouse aims|Aim assistance/);
  const help=renderPatrol(s,emptyActionArcade(),{...ui,missions:true});assert.match(help,/three waves/);assert.match(help,/never required/);assert.match(patrolObjective(s).title,/Blast the raiders/);
});
test('a pilot using manual steering can finish all sectors with earned upgrades and repair/rejoin',()=>{
  for(const seed of [123,432,729]){const run=playPatrol(2,seed);assert.equal(run.phase,'complete',JSON.stringify(run));assert.ok(run.firstKill<2);assert.ok(run.firstCore<1);assert.ok(run.kills>=90);assert.ok(run.time<600);assert.ok(run.retries<=6);}
});
test('extreme applies a materially higher damage rate and repair burden to the same parked pilot',()=>{
  const relaxed=playPatrol(2,123,true),extreme=playPatrol(5,123,true);
  assert.ok(extreme.damage/extreme.time>relaxed.damage/relaxed.time*2);assert.ok(extreme.retries>relaxed.retries*2);
});
