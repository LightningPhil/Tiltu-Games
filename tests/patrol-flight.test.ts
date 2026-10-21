import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newSalvage,stepSalvage,fireSalvage,pulseSalvage,boostSalvage,restoreSalvage,patrolEMPCharge,EMP_RANGE,EMP_RECHARGE} from '../src/archive-patrol.ts';
import type {FlightInput,SalvageSession,Vessel} from '../src/archive-patrol.ts';
import {flightView} from '../src/archive-renderer.ts';
const idle:FlightInput={turn:0,thrust:0,strafe:0,fire:false,pulse:false,tractor:false,aim:null};
function arena(){const s=newSalvage(2,432);s.phase='flying';s.paused=false;s.x=s.y=900;s.angle=0;s.ships=[];s.rocks=[];s.relics=[];s.pickups=[];s.arcade!.caches=[];
  // Keep a later wave pending so a long mechanics fixture cannot finish the sector.
  s.warps=[{x:1500,y:1500,clock:100,role:'skirmisher'}];return s;}
const run=(s:SalvageSession,seconds:number,input=idle)=>{for(let i=0;i<Math.round(seconds*60);i++)stepSalvage(s,input,1/60);};
const enemy=(id:number,x:number,y:number):Vessel=>({id,kind:'raider',x,y,vx:0,vy:0,angle:0,hp:100,maxHp:100,cooldown:10});
test('forward thrust follows the ship at every orientation, independent of screen coordinates',()=>{
  for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2,.63]){const s=arena();s.angle=a;run(s,1,{...idle,thrust:1});
    const dx=s.x-900,dy=s.y-900;assert.ok(dx*Math.cos(a)+dy*Math.sin(a)>90);assert.ok(Math.abs(-dx*Math.sin(a)+dy*Math.cos(a))<1e-7);}
});
test('thrust and turn build progressively; release coasts while braking slows without reversing',()=>{
  const s=arena();stepSalvage(s,{...idle,thrust:1,turn:1},1/60);const first=Math.hypot(s.vx,s.vy),turn=s.angularVelocity;
  assert.ok(first>0&&first<1);assert.ok(turn>0&&turn<.4);run(s,.5,{...idle,thrust:1,turn:1});assert.ok(Math.hypot(s.vx,s.vy)>first*50);assert.ok(s.angularVelocity>turn*5);
  const coast=arena();coast.vx=200;const brake=structuredClone(coast);run(coast,.5);run(brake,.5,{...idle,thrust:-1});
  assert.ok(coast.vx>150&&coast.vx<200);assert.ok(brake.vx>0&&brake.vx<25);run(brake,3,{...idle,thrust:-1});assert.ok(brake.vx>=0);const stopped=arena();run(stopped,2,{...idle,thrust:-1});assert.equal(stopped.vx,0);assert.equal(stopped.x,900);
});
test('right rotates clockwise relative to a ship pointing down and left reverses that rotation',()=>{
  const right=arena(),left=arena();right.angle=left.angle=Math.PI/2;run(right,.3,{...idle,turn:1});run(left,.3,{...idle,turn:-1});assert.ok(right.angle>Math.PI/2);assert.ok(left.angle<Math.PI/2);assert.equal(right.x,900);assert.equal(left.y,900);
});
test('afterburner momentum decays smoothly when the boost finishes rather than snapping to cruise speed',()=>{
  const s=arena();boostSalvage(s);run(s,.5);const before=s.vx;run(s,.1);assert.ok(s.vx>before*.9);assert.ok(s.vx>310);run(s,2);assert.ok(s.vx<before);
});
test('legacy mouse aim, strafe and screen-axis movement do not turn or move the ship',()=>{
  const s=arena();run(s,1,{...idle,moveX:1,moveY:1,strafe:1,aim:Math.PI/2});assert.equal(s.angle,0);assert.equal(s.x,900);assert.equal(s.y,900);
});
test('all primary weapons fire along the manually steered nose without target magnetism',()=>{
  for(const weapon of ['blaster','scatter','lance'] as const){const s=arena();s.weapon=weapon;s.aimAssist=true;s.ships=[enemy(90,1200,920)];fireSalvage(s);const central=s.bolts[Math.floor(s.bolts.length/2)];assert.equal(central.vy,0);assert.equal(s.angle,0);}
});
test('default camera displays 25 percent more world vertically and horizontally',()=>{
  const s=newSalvage(),canvas={getBoundingClientRect:()=>({width:1000,height:500})} as HTMLCanvasElement;
  assert.deepEqual(flightView(canvas,s),{width:1625,height:812.5});
});
test('legacy saves adopt manual controls and a wider view once without losing credits or position',()=>{
  const old=arena() as any;delete old.flightVersion;delete old.angularVelocity;delete old.engineThrottle;delete old.empPulses;old.flight='direct';old.aimAssist=true;old.zoom=1;old.credits=345;
  const s=restoreSalvage(old)!;assert.equal(s.flight,'classic');assert.equal(s.aimAssist,false);assert.equal(s.zoom,.8);assert.equal(s.credits,345);assert.equal(s.x,900);assert.equal(s.angularVelocity,0);assert.equal(s.engineThrottle,0);assert.deepEqual(s.empPulses,[]);
  assert.equal(restoreSalvage(s)!.zoom,.8);
});
test('EMP travels ahead and disables rather than damages, never hitting the rear, flanks or out of range',()=>{
  const s=arena();s.ships=[enemy(1,1200,900),enemy(2,700,900),enemy(3,1000,1100),enemy(4,900+EMP_RANGE+90,900),{...enemy(5,1100,930),kind:'warden'}];
  assert.ok(pulseSalvage(s));assert.equal(s.ships[0].disabledFor,undefined);assert.equal(s.energy,100);run(s,.6);
  assert.ok(s.ships[0].disabledFor!>4);for(const v of s.ships.slice(1))assert.equal(v.disabledFor??0,0);assert.ok(s.ships.every(v=>v.hp===100));assert.equal(s.stats.hits,0);assert.equal(s.kills,0);
});
test('EMP firing heading is fixed even while the player turns after launch',()=>{
  const s=arena();s.ships=[enemy(1,1200,900),enemy(2,900,1200)];pulseSalvage(s);run(s,.5,{...idle,turn:1});assert.ok(s.angle>.8);assert.ok(s.ships[0].disabledFor!>4);assert.equal(s.ships[1].disabledFor??0,0);
});
test('EMP cone respects its angular and distance boundaries',()=>{
  const s=arena();const polar=(id:number,a:number,r:number)=>enemy(id,900+Math.cos(a)*r,900+Math.sin(a)*r);
  s.ships=[polar(1,.49,300),polar(2,.58,300),polar(3,-.49,300),polar(4,-.58,300)];pulseSalvage(s);run(s,.45);
  assert.ok(s.ships[0].disabledFor!>0);assert.ok(s.ships[2].disabledFor!>0);assert.equal(s.ships[1].disabledFor??0,0);assert.equal(s.ships[3].disabledFor??0,0);
});
test('EMP clears hostile projectiles only in the forward cone and leaves caches and friendly shots intact',()=>{
  const s=arena();s.arcade!.caches=[{id:90,x:1100,y:950,hp:30,maxHp:30,hit:0,volatile:false}];
  s.bolts=[{x:1100,y:900,vx:0,vy:0,life:3,owner:99,damage:20},{x:700,y:900,vx:0,vy:0,life:3,owner:99,damage:20},{x:1100,y:880,vx:0,vy:0,life:3,owner:0,damage:20}];
  pulseSalvage(s);run(s,.3);assert.equal(s.bolts.length,2);assert.ok(s.bolts.some(b=>b.owner>0&&b.x<900));assert.ok(s.bolts.some(b=>b.owner===0));assert.equal(s.arcade!.caches[0].hp,30);
});
test('disabled enemies coast to rest and cannot steer, fire or inflict collision damage',()=>{
  const s=arena();s.invulnerable=0;s.sectorTime=5;s.ships=[{...enemy(1,910,900),cooldown:0,arming:true,disabledFor:2,vx:80,vy:0}];const angle=s.ships[0].angle;
  run(s,1);assert.equal(s.ships[0].angle,angle);assert.ok(s.ships[0].vx<5);assert.equal(s.bolts.length,0);assert.equal(s.shield,100);
});
test('EMP lasts five seconds on raiders, three on carriers, and guns can damage disabled ships',()=>{
  const s=arena();s.ships=[enemy(1,1050,900),{...enemy(2,1050,920),kind:'carrier'}];pulseSalvage(s);run(s,.3);
  assert.ok(s.ships[0].disabledFor!>4.8);assert.ok(s.ships[1].disabledFor!>2.8&&s.ships[1].disabledFor!<=3);
  s.bolts.push({x:s.ships[0].x,y:s.ships[0].y,vx:0,vy:0,life:1,owner:0,damage:20});run(s,.02);assert.equal(s.ships[0].hp,80);
  run(s,3);assert.equal(s.ships[1].disabledFor,0);assert.ok(s.ships[0].disabledFor!>1);run(s,2);assert.equal(s.ships[0].disabledFor,0);
});
test('recovered enemies telegraph a new attack and can be disabled again by a later pulse',()=>{
  const s=arena();s.sectorTime=6;s.ships=[{...enemy(1,1200,900),disabledFor:.02,cooldown:.8}];run(s,.1);assert.equal(s.bolts.length,0);
  pulseSalvage(s);run(s,.5);assert.ok(s.ships[0].disabledFor!>4);
});
test('independent EMP charge takes eighteen active seconds, costs no energy and cannot fire early',()=>{
  const s=arena();s.energy=0;assert.equal(patrolEMPCharge(s),1);assert.ok(pulseSalvage(s));assert.equal(s.energy,0);assert.equal(patrolEMPCharge(s),0);assert.equal(pulseSalvage(s),false);
  run(s,9);assert.ok(Math.abs(patrolEMPCharge(s)-.5)<1e-8);assert.equal(pulseSalvage(s),false);run(s,9.05);assert.equal(s.pulseCooldown,0);assert.equal(patrolEMPCharge(s),1);assert.ok(pulseSalvage(s));assert.equal(s.pulseCooldown,EMP_RECHARGE);
});
test('pause freezes recharge, travelling waves, momentum and enemy disable duration',()=>{
  const s=arena();s.ships=[{...enemy(1,1200,900),disabledFor:4}];pulseSalvage(s);run(s,.1);s.paused=true;const copy=structuredClone(s);run(s,2);assert.deepEqual(s,copy);assert.equal(pulseSalvage(s),false);
});
test('save restoration preserves an in-flight EMP and its recharge without restoring targeting assist',()=>{
  const s=arena();s.ships=[enemy(1,1200,900)];pulseSalvage(s);run(s,.4);const restored=restoreSalvage(s)!;assert.ok(restored);assert.equal(restored.paused,true);assert.equal(restored.pulseCooldown,s.pulseCooldown);assert.deepEqual(restored.empPulses,s.empPulses);assert.equal(restored.ships[0].disabledFor,s.ships[0].disabledFor);
  const invalid=structuredClone(s) as any;invalid.angularVelocity=Infinity;invalid.engineThrottle=NaN;invalid.ships[0].disabledFor=1e10;invalid.empPulses=[{x:NaN,y:1,angle:0,distance:10,hitIds:[]}];const safe=restoreSalvage(invalid)!;assert.equal(safe.angularVelocity,0);assert.equal(safe.engineThrottle,0);assert.equal(safe.ships[0].disabledFor,0);assert.deepEqual(safe.empPulses,[]);
});
