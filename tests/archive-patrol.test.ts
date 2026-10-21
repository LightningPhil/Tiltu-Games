import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newSalvage as newLiveSalvage,stepSalvage,populateSector,fireSalvage,pulseSalvage,boostSalvage,damagePilot,dockSalvage,upgradeSalvage,nextSector,retrySalvage,restoreSalvage,selectPatrolWeapon,selectPatrolChassis,maxPatrolShield,sectorComplete,patrolNavigation,setPatrolWaypoint,patrolSegmentHit,patrolStorms,hostile,WEAPON_INFO} from '../src/archive-patrol.ts';
import type {SalvageSession,Vessel,FlightInput,PatrolWeapon} from '../src/archive-patrol.ts';
import {renderPatrol} from '../src/patrol-view.ts';
import {emptyActionArcade} from '../src/action-games.ts';

// Stable legacy-save/physics fixtures. The current combat loop has its own full-run tests.
const newSalvage=(...args:Parameters<typeof newLiveSalvage>)=>{const s=newLiveSalvage(...args);delete s.arcade;s.x=s.y=900;populateSector(s);return s;};
const idle:FlightInput={turn:0,thrust:0,strafe:0,fire:false,tractor:false,pulse:false,aim:null,moveX:0,moveY:0};
function flying(level=2,seed=121){const s=newSalvage(level,seed);s.phase='flying';s.paused=false;return s;}
function arena(){const s=flying();s.ships=[];s.rocks=[];s.relics=[];s.mission.beacons=[];s.x=500;s.y=400;s.angle=0;return s;}
const raider=(id:number,x=800,y=400,role:'skirmisher'|'gunship'|'sniper'='skirmisher'):Vessel=>({id,kind:'raider',role,x,y,vx:0,vy:0,angle:Math.PI,hp:200,maxHp:200,cooldown:10});
function run(s:SalvageSession,seconds:number,input:FlightInput=idle){for(let i=0;i<Math.ceil(seconds*60)&&!s.paused;i++)stepSalvage(s,input,1/60);}

test('each sector has a repeatable, clear spawn, enough fragments and a nearby first collection',()=>{
  for(let level=1;level<=5;level++)for(let sector=1;sector<=6;sector++){
    const s=newSalvage(level,sector*233);s.sector=sector;populateSector(s);assert.equal(s.relics.length,s.quota+5);assert.equal(s.mission.beacons.length,3);assert.ok(s.rocks.every(r=>Math.hypot(r.x-900,r.y-900)>320));
    for(const r of s.relics)assert.ok(s.rocks.every(rock=>Math.hypot(r.x-rock.x,r.y-rock.y)>=rock.r+35));
    for(const b of s.mission.beacons)assert.ok(s.rocks.every(rock=>Math.hypot(b.x-rock.x,b.y-rock.y)>=rock.r+60));
    assert.equal(s.mission.bossRequired,sector===3||sector===6);
  }
  const s=newSalvage(2,17);assert.deepEqual(s,newSalvage(2,17));assert.ok(Math.hypot(s.relics[0].x-900,s.relics[0].y-900)<=250);
});
test('ship-relative thrust accelerates and braking stops faster than coasting',()=>{
  const a=arena();run(a,1,{...idle,thrust:1});assert.ok(a.x>580&&a.x<680);assert.equal(a.y,400);
  const brake=structuredClone(a),coast=structuredClone(a);run(brake,.5,{...idle,brake:true});run(coast,.5);assert.ok(Math.hypot(brake.vx,brake.vy)<Math.hypot(coast.vx,coast.vy)*.25);
});
test('mouse aim and screen-axis input cannot override ship-relative steering',()=>{
  const s=arena();stepSalvage(s,{...idle,moveX:-1,aim:Math.PI},1/60);assert.equal(s.vx,0);assert.equal(s.angle,0);stepSalvage(s,{...idle,turn:1},1/60);assert.ok(s.angle>0&&s.angle<.01);
});
test('a forward boost consumes energy once and builds speed over time with a cooldown',()=>{
  const s=arena();s.angle=-Math.PI/2;assert.equal(boostSalvage(s),true);assert.equal(s.energy,82);assert.equal(s.stats.boosts,1);assert.equal(s.vy,0);assert.equal(boostSalvage(s),false);run(s,.5);assert.ok(s.vy< -450&&s.y<280);
  s.paused=true;assert.equal(boostSalvage(s),false);s.paused=false;s.boostCooldown=0;s.energy=17;assert.equal(boostSalvage(s),false);
});
test('three chassis have real trade-offs and cannot be swapped for free shields in flight',()=>{
  const s=newSalvage();assert.equal(selectPatrolChassis(s,'swift'),true);assert.equal(maxPatrolShield(s),80);assert.equal(s.shield,80);
  assert.equal(selectPatrolChassis(s,'bulwark'),true);assert.equal(s.shield,125);s.upgrades.shield=3;assert.equal(maxPatrolShield(s),200);
  s.phase='flying';assert.equal(selectPatrolChassis(s,'ranger'),false);s.phase='docked';assert.equal(selectPatrolChassis(s,'ranger'),true);assert.equal(s.shield,175);
  const swift=arena(),bulwark=arena();swift.chassis='swift';bulwark.chassis='bulwark';run(swift,2,{...idle,thrust:1});run(bulwark,2,{...idle,thrust:1});assert.ok(swift.x>bulwark.x+100);
});
test('each weapon has distinct projectiles, reach, cost and a rate limit that switching cannot bypass',()=>{
  const counts={blaster:1,scatter:5,lance:1};const speeds=[];
  for(const weapon of Object.keys(WEAPON_INFO) as PatrolWeapon[]){const s=arena();assert.equal(selectPatrolWeapon(s,weapon),true);assert.equal(fireSalvage(s),true);assert.equal(s.bolts.length,counts[weapon]);assert.equal(s.energy,100-WEAPON_INFO[weapon].cost);assert.equal(s.stats.shots,1);
    const cooldown=s.cooldown;selectPatrolWeapon(s,'blaster');assert.equal(fireSalvage(s),false);assert.equal(s.cooldown,cooldown);speeds.push(Math.hypot(s.bolts[0].vx,s.bolts[0].vy));}
  assert.ok(speeds[2]>speeds[0]&&speeds[0]>speeds[1]);const s=arena();s.upgrades.weapon=2;fireSalvage(s);assert.equal(s.bolts.length,2);
});
test('the relay is a two-way no-fire zone: banking is safe, but defeating enemies requires leaving',()=>{
  const s=flying();assert.equal(fireSalvage(s),false);assert.equal(pulseSalvage(s),false);assert.equal(s.energy,100);assert.equal(s.stats.shots,0);s.x=1050;assert.equal(fireSalvage(s),true);assert.equal(s.energy,96);
});
test('carrier armour reduces damage until its core is exposed',()=>{
  const s=arena(),boss={...raider(1,650),kind:'carrier' as const,hp:1000,maxHp:1000};s.ships=[boss];s.bolts=[{x:650,y:400,vx:0,vy:0,life:1,owner:0,damage:100}];stepSalvage(s,idle,1/60);assert.equal(boss.hp,935);
  boss.hp=300;s.bolts=[{x:boss.x,y:boss.y,vx:0,vy:0,life:1,owner:0,damage:100}];stepSalvage(s,idle,1/60);assert.equal(boss.hp,200);
});
test('segment collisions catch fast shots, stationary overlaps, tangencies and misses',()=>{
  assert.equal(patrolSegmentHit(0,0,100,0,50,0,10),.4);assert.equal(patrolSegmentHit(50,0,50,0,50,0,10),0);assert.equal(patrolSegmentHit(0,10,100,10,50,0,10),.5);assert.equal(patrolSegmentHit(0,11,100,11,50,0,10),Infinity);assert.equal(patrolSegmentHit(100,0,110,0,50,0,10),Infinity);
});
test('fast projectiles hit an intervening rock before a ship behind it',()=>{
  const s=arena();s.ships=[raider(1,650,400)];s.rocks=[{x:600,y:400,r:22,rotation:0,hp:60}];s.bolts=[{x:550,y:400,vx:5000,vy:0,life:1,owner:0,damage:40}];stepSalvage(s,idle,.04);
  assert.equal(s.ships[0].hp,200);assert.equal(s.rocks[0].hp,20);assert.equal(s.bolts.length,0);
});
test('a lance pierces up to three different targets and cannot damage the same target twice',()=>{
  const s=arena();s.ships=[raider(1,650),raider(2,720),raider(3,790),raider(4,860)];s.bolts=[{x:600,y:400,vx:8000,vy:0,life:1,owner:0,damage:40,kind:'lance',pierce:2,hitIds:[]}];stepSalvage(s,idle,.04);
  assert.deepEqual(s.ships.map(v=>v.hp),[160,160,160,200]);assert.equal(s.bolts.length,0);assert.equal(s.stats.hits,3);
});
test('IFF protects friendly ships by default; disabling it makes friendly fire meaningful',()=>{
  for(const safety of [true,false]){const s=arena();s.safety=safety;s.ships=[{...raider(1,700),kind:'warden'}];s.bolts=[{x:700,y:400,vx:0,vy:0,life:1,owner:0,damage:20}];stepSalvage(s,idle,1/60);assert.equal(s.ships[0].hp,safety?200:180);assert.equal(s.reputation,safety?0:1);}
  const s=arena();s.reputation=3;const v={...raider(1),kind:'warden' as const};assert.equal(hostile(s,v),true);
});
test('enemy fire can threaten an escorted courier but cannot cross the relay shield',()=>{
  const s=arena();s.ships=[{...raider(2,700),kind:'courier',active:true}];s.bolts=[{x:700,y:400,vx:0,vy:0,life:1,owner:8,damage:20}];stepSalvage(s,idle,1/60);assert.equal(s.ships[0].hp,180);
  s.x=s.y=900;s.invulnerable=0;s.bolts=[{x:650,y:900,vx:8000,vy:0,life:1,owner:8,damage:200}];stepSalvage(s,idle,.04);assert.equal(s.hull,100);assert.equal(s.shield,100);assert.equal(s.reputation,0);
});
test('enemy roles move differently and all show a charge before their timed attacks',()=>{
  const velocities=[];
  for(const role of ['skirmisher','gunship','sniper'] as const){const s=arena();s.sectorTime=5;s.ships=[{...raider(1,800,400,role),cooldown:.4}];stepSalvage(s,idle,1/60);stepSalvage(s,idle,1/60);assert.ok(s.ships[0].charge!>0);velocities.push([s.ships[0].vx,s.ships[0].vy]);run(s,.6);assert.ok(s.bolts.length>=1);}
  assert.notDeepEqual(velocities[0],velocities[1]);assert.notDeepEqual(velocities[1],velocities[2]);
});
test('carrier damage thresholds change its attack phase and announce reinforcements',()=>{
  const s=arena();s.sectorTime=5;s.ships=[{...raider(1,850),kind:'carrier',hp:110,maxHp:300,cooldown:0,arming:true}];stepSalvage(s,idle,1/60);assert.equal(s.ships[0].phase,1);assert.equal(s.warps.length,2);assert.equal(s.bolts.length,3);
  s.ships[0].hp=60;s.ships[0].cooldown=0;stepSalvage(s,idle,1/60);assert.equal(s.ships[0].phase,2);assert.equal(s.bolts.length,8);assert.ok(s.notice.includes('core exposed'));
});
test('the survey requires proximity and an explicit scan or tractor; rewards happen only once',()=>{
  const s=arena();s.mission.beacons=[{id:3,x:500,y:400,progress:0,scanned:false},{id:4,x:900,y:400,progress:0,scanned:false},{id:5,x:1300,y:400,progress:0,scanned:false}];run(s,2);assert.equal(s.mission.beacons[0].scanned,false);run(s,2,{...idle,scan:true});assert.equal(s.mission.beacons[0].scanned,true);assert.equal(s.credits,20);run(s,2,{...idle,scan:true});assert.equal(s.credits,20);
  s.x=900;run(s,2,{...idle,tractor:true});s.x=1300;run(s,2,{...idle,scan:true});assert.equal(s.credits,150);assert.equal(s.mission.rewards.filter(x=>x==='survey').length,1);run(s,2,{...idle,scan:true});assert.equal(s.credits,150);
});
test('couriers wait to be found, pause when abandoned and reward a completed escort once',()=>{
  const s=arena();s.ships=[{...raider(3,1200,900),kind:'courier',active:false}];run(s,2);assert.equal(s.ships[0].active,false);assert.equal(s.ships[0].x,1200);
  s.x=1150;s.y=900;run(s,.1);assert.equal(s.ships[0].active,true);const x=s.ships[0].x;s.x=300;s.y=300;run(s,1);assert.ok(s.ships[0].x>=x-1);
  s.ships[0].x=950;s.ships[0].y=900;run(s,.1);assert.equal(s.courierSaved,true);assert.equal(s.credits,50);run(s,1);assert.equal(s.credits,50);
});
test('a lost courier does not make the main recovery mission unwinnable',()=>{
  const s=arena();s.ships=[{...raider(3,1200),kind:'courier',hp:0}];stepSalvage(s,idle,1/60);assert.equal(s.mission.courierLost,true);assert.equal(s.reputation,0);s.x=s.y=900;s.cargo=s.quota;dockSalvage(s);assert.equal(sectorComplete(s),true);assert.equal(nextSector(s),true);
});
test('wardens do not earn the player free kills or bounty; player victories pay once',()=>{
  const s=arena();s.ships=[{...raider(1),hp:0}];stepSalvage(s,idle,1/60);assert.equal(s.kills,0);assert.equal(s.credits,0);
  s.ships=[{...raider(2),hp:0,credited:true},{...raider(3),hp:0,credited:true},{...raider(4),hp:0,credited:true}];stepSalvage(s,idle,1/60);assert.equal(s.kills,3);assert.equal(s.credits,114);const score=s.score;run(s,.1);assert.equal(s.credits,114);assert.equal(s.score,score);
});
test('resource pickups help when needed, remain available when full and expire without granting rewards',()=>{
  const s=arena();s.pickups=[{id:1,x:500,y:400,kind:'repair',life:10}];run(s,.1);assert.equal(s.pickups.length,1);s.hull=40;run(s,.1);assert.equal(s.hull,75);assert.equal(s.pickups.length,0);
  s.pickups=[{id:2,x:1000,y:1000,kind:'credits',life:.02}];run(s,.1);assert.equal(s.pickups.length,0);assert.equal(s.credits,0);
});
test('only ore asteroids drop credits and a destroyed asteroid cannot pay twice',()=>{
  const s=arena();s.rocks=[{x:600,y:400,r:25,rotation:0,hp:0,ore:true},{x:700,y:400,r:20,rotation:0,hp:0,ore:false}];stepSalvage(s,idle,1/60);assert.equal(s.rocks.length,0);assert.equal(s.pickups.length,1);stepSalvage(s,idle,1/60);assert.equal(s.pickups.length,1);
});
test('quick collections build a chain; the first fragment and every delivery retain their stated base value',()=>{
  const s=arena();s.relics=[{id:1,x:500,y:400,kind:0,collected:false}];stepSalvage(s,idle,1/60);assert.equal(s.score,25);s.relics.push({id:2,x:500,y:400,kind:1,collected:false});stepSalvage(s,idle,1/60);assert.ok(s.score>50);const score=s.score;s.x=s.y=900;dockSalvage(s);assert.equal(s.score,score+200);assert.equal(s.credits,60);assert.equal(s.cargo,0);assert.equal(s.delivered,2);
});
test('shield regeneration waits after damage and a directional EMP disables hostiles while sparing allies',()=>{
  const s=arena();s.invulnerable=0;damagePilot(s,30);run(s,2);assert.equal(s.shield,70);run(s,3);assert.ok(s.shield>70);
  s.ships=[raider(1,600),{...raider(2,550),kind:'warden'}];s.bolts=[{x:600,y:400,vx:0,vy:0,life:2,owner:1,damage:20}];s.energy=100;pulseSalvage(s);run(s,.2);assert.equal(s.ships[0].hp,200);assert.ok(s.ships[0].disabledFor!>4);assert.equal(s.ships[1].hp,200);assert.equal(s.ships[1].disabledFor??0,0);assert.equal(s.bolts.length,0);
});
test('storm hazards have three seconds of warning before an active interval and leave the relay safe',()=>{
  const s=arena();s.sector=5;s.sectorTime=10;const warning=patrolStorms(s)[0];assert.equal(warning.warning,true);assert.equal(warning.active,false);s.sectorTime=12.2;const storm=patrolStorms(s)[0];assert.equal(storm.active,true);s.x=storm.x;s.y=storm.y;s.invulnerable=0;const shield=s.shield;stepSalvage(s,idle,1/60);assert.ok(s.shield<shield);assert.ok(patrolStorms(s).every(q=>Math.hypot(q.x-900,q.y-900)>q.r+145));
});
test('new raiders appear through an announced warp ring, with bounded reinforcements',()=>{
  const s=arena();s.sectorTime=20;s.waveClock=0;stepSalvage(s,idle,1/60);assert.equal(s.warps.length,1);assert.equal(s.ships.length,0);assert.ok(s.notice.includes('warping'));run(s,2.5);assert.equal(s.warps.length,0);assert.equal(s.ships.length,1);
});
test('navigation tracks a moving objective, returns to the relay and never targets a collected fragment',()=>{
  const s=arena();s.relics=[{id:1,x:600,y:400,kind:0,collected:true},{id:2,x:800,y:400,kind:1,collected:false}];assert.equal(patrolNavigation(s).x,800);s.cargo=s.quota;assert.equal(patrolNavigation(s).name,'Archive relay');
  setPatrolWaypoint(s,'point',5000,-5);assert.deepEqual(s.waypoint,{kind:'point',x:1770,y:30});setPatrolWaypoint(s,'point',NaN,1);assert.equal(s.waypoint.x,1770);setPatrolWaypoint(s,'beacons');assert.equal(patrolNavigation(s).name,'Archive relay');
});
test('a carrier-gated sector cannot be skipped by delivering cargo; all primary objectives permit departure',()=>{
  const s=arena();s.sector=3;populateSector(s);s.phase='flying';s.paused=false;s.x=s.y=900;s.cargo=s.quota;dockSalvage(s);assert.equal(nextSector(s),false);s.mission.bossDefeated=true;assert.equal(nextSector(s),true);assert.equal(s.sector,4);
});
test('retrying an undocked sector reproduces its original world, without resetting the personal best',()=>{
  const s=flying(),world=structuredClone({ships:s.ships,relics:s.relics,rocks:s.rocks});s.score=2000;s.best=2000;s.credits=800;s.phase='lost';s.paused=true;assert.equal(retrySalvage(s),true);assert.deepEqual({ships:s.ships,relics:s.relics,rocks:s.rocks},world);assert.equal(s.best,2000);assert.equal(s.score,0);assert.equal(s.credits,0);assert.equal(s.retries,1);assert.equal(s.paused,true);
});
test('relay checkpoints retain deliveries, upgrades and the remaining world without duplicate cargo rewards',()=>{
  const s=flying();s.ships=[];s.rocks=[];s.relics[0].collected=true;s.cargo=3;s.x=s.y=900;dockSalvage(s);assert.equal(s.credits,90);upgradeSalvage(s,'weapon');assert.equal(s.credits,30);const delivered=s.delivered,remaining=s.relics.filter(r=>!r.collected).length;
  s.phase='flying';s.paused=false;s.cargo=4;s.credits=99;s.score+=500;s.phase='lost';s.paused=true;assert.equal(retrySalvage(s),true);assert.equal(s.cargo,0);assert.equal(s.delivered,delivered);assert.equal(s.credits,30);assert.equal(s.upgrades.weapon,1);assert.equal(s.relics.filter(r=>!r.collected).length,remaining);
  s.phase='flying';s.paused=false;dockSalvage(s);assert.equal(s.credits,30);assert.equal(s.delivered,3);
});
test('checkpoint retries survive save/load and checkpoint snapshots cannot nest recursively',()=>{
  const s=flying();s.cargo=2;dockSalvage(s);s.phase='lost';const restored=restoreSalvage(s)!;assert.ok(restored);assert.equal(restored.checkpoint!.snapshot!.checkpoint,null);assert.equal(retrySalvage(restored),true);assert.equal(restored.delivered,2);assert.equal(restored.credits,60);
  const tampered=structuredClone(s);tampered.checkpoint!.snapshot!.checkpoint=structuredClone(tampered.checkpoint);const recovered=restoreSalvage(tampered)!;assert.ok(recovered);assert.equal(recovered.checkpoint!.snapshot,undefined);
});
test('old saves bank existing cargo at its promised value while retaining coordinates and upgrades',()=>{
  const source=flying();source.score=1234;source.credits=178;source.x=410;source.y=870;source.cargo=3;source.upgrades.engine=2;const legacy:Record<string,unknown>={};
  for(const key of ['seed','sector','difficulty','hull','shield','energy','credits','score','best','x','y','vx','vy','angle','elapsed','cooldown','pulseCooldown','invulnerable','phase','paused','cargo','delivered','quota','reputation','kills','sectorKills','rescues','courierSaved','upgrades','ships','bolts','particles','relics','rocks','notice','noticeTime','nextId'])legacy[key]=source[key as keyof SalvageSession];
  const s=restoreSalvage(legacy)!;assert.ok(s);assert.equal(s.score,1534);assert.equal(s.credits,268);assert.equal(s.x,410);assert.equal(s.cargo,0);assert.equal(s.delivered,3);assert.equal(s.upgrades.engine,2);assert.equal(s.flight,'classic');assert.equal(s.aimAssist,false);assert.equal(s.safety,true);assert.equal(s.paused,true);assert.ok(s.checkpoint);
});
test('pause and terminal states freeze simulation and reject combat actions',()=>{
  for(const phase of ['flying','docked','lost','complete'] as const){const s=flying();s.phase=phase;s.paused=true;const copy=structuredClone(s);run(s,1,{...idle,fire:true,pulse:true,boost:true,moveX:1});assert.equal(fireSalvage(s),false);assert.equal(pulseSalvage(s),false);assert.equal(boostSalvage(s),false);assert.deepEqual(s,copy);}
});
test('views explain mechanics, expose ship choices and escape restored log and status text',()=>{
  const s=newSalvage(),ui={settings:false,missions:false,confirmReset:false,difficulty:2},store=emptyActionArcade();let html=renderPatrol(s,store,ui);assert.ok(html.includes('Launch patrol'));assert.ok(html.includes('chassis-swift'));assert.ok(html.includes('role="meter"'));assert.ok(html.includes('data-patrol-stick'));
  s.notice='<img src=x onerror=alert(1)>';s.log=[{text:s.notice,time:0,kind:'info'}];html=renderPatrol(s,store,{...ui,missions:true});assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));
  s.phase='lost';html=renderPatrol(s,store,ui);assert.ok(html.includes('Retry from checkpoint'));assert.ok(html.includes('banked cargo'));
});
test('seeded mixed-input flights keep every resource, shot, ship and save finite at all five difficulties',()=>{
  for(let level=1;level<=5;level++)for(let sector=1;sector<=6;sector++){
    const s=flying(level,level*349+sector);s.sector=sector;populateSector(s);s.phase='flying';s.paused=false;s.upgrades={engine:2,weapon:2,shield:2,tractor:2};s.shield=maxPatrolShield(s);
    for(let i=0;i<1500&&!s.paused;i++)stepSalvage(s,{...idle,turn:Math.sin(i*.017),thrust:Math.cos(i*.013),fire:true,tractor:i%3===0,scan:true,pulse:i%600===0,boost:i%300===0},1/60);
    assert.ok(s.x>=24&&s.x<=1776&&s.y>=24&&s.y<=1776);assert.ok(s.hull>=0&&s.hull<=100&&s.shield>=0&&s.shield<=maxPatrolShield(s)&&s.energy>=0&&s.energy<=100);assert.ok(s.bolts.length<=200&&s.particles.length<=300&&s.ships.length<=40&&s.warps.length<=8);assert.ok(restoreSalvage(s),`level ${level} sector ${sector}`);
  }
});
