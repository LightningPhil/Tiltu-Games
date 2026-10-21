import {test} from 'node:test';
import assert from 'node:assert/strict';
import {patrolKey,patrolFlightInput} from '../src/patrol-input.ts';
import {newSalvage,stepSalvage} from '../src/archive-patrol.ts';

test('WASD and arrows produce identical ship-relative flights, turns, coasting and braking',()=>{
  const exercise=(layout:string[],heading:number)=>{
    const s=newSalvage(2,729);s.x=s.y=900;s.angle=heading;s.phase='flying';s.paused=false;s.rocks=[];s.relics=[];s.ships=[];s.arcade!.caches=[];
    for(let i=0;i<180;i++){
      const codes=i<35?[layout[0]]:i<70?[layout[0],layout[3]]:i<100?[layout[2]]:i<125?[]:[layout[1]];
      stepSalvage(s,patrolFlightInput(codes.map(c=>patrolKey(c)!)),1/60);
    }
    return s;
  };
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2,.7]){
    const letters=exercise(['KeyW','KeyS','KeyA','KeyD'],heading),arrows=exercise(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'],heading);
    assert.deepEqual(letters,arrows);assert.ok(Math.hypot(letters.x-900,letters.y-900)>50);assert.ok(Math.hypot(letters.vx,letters.vy)<8);
  }
});
test('opposite turns cancel; duplicate movement aliases do not double thrust or turning',()=>{
  const decode=(codes:string[])=>patrolFlightInput(codes.map(c=>patrolKey(c)!));
  assert.deepEqual(decode(['KeyW','ArrowUp','KeyD','ArrowRight']),decode(['KeyW','KeyD']));
  assert.equal(decode(['KeyA','ArrowRight']).turn,0);assert.equal(decode(['KeyW','ArrowDown']).brake,true);
});
test('primary fire, boost and steering can be held together without triggering the secondary weapon repeatedly',()=>{
  const controls=patrolFlightInput(['thrust','left','fire','boost','pulse']);
  assert.equal(controls.thrust,1);assert.equal(controls.turn,-1);assert.equal(controls.fire,true);assert.equal(controls.boost,true);assert.equal(controls.pulse,false);
  assert.equal(patrolKey('KeyE'),'pulse');assert.equal(patrolKey('Space'),'fire');assert.equal(patrolKey('ShiftLeft'),'boost');assert.equal(patrolKey('ShiftRight'),'boost');
});
test('secondary EMP is separate from docking and boost is separate from collecting',()=>{
  assert.equal(patrolKey('KeyG'),'dock');assert.notEqual(patrolKey('KeyE'),patrolKey('KeyG'));
  const collect=patrolFlightInput(['tractor']);assert.equal(collect.tractor,true);assert.equal(collect.scan,true);assert.equal(collect.boost,false);
  assert.equal(patrolFlightInput(['boost']).tractor,false);assert.equal(patrolKey('KeyF'),'tractor');
});
test('keyboard fallback supports upper/lowercase WASD, Space and arrow names when code is absent',()=>{
  for(const [code,key] of [['KeyW','w'],['KeyW','W'],['KeyA','a'],['KeyS','s'],['KeyD','d'],['KeyE','e'],['Space',' '],['ArrowLeft','ArrowLeft'],['ShiftLeft','Shift']]){
    assert.equal(patrolKey('',key),patrolKey(code));assert.equal(patrolKey('Unidentified',key),patrolKey(code));
  }
  assert.equal(patrolKey('F11','w'),undefined);assert.equal(patrolKey('','?'),undefined);
});
test('mouse primary and optional continuous fire retain manual steering, with no automatic aim',()=>{
  const controls=patrolFlightInput(['right'],{x:0,y:0},true);assert.equal(controls.fire,true);assert.equal(controls.turn,1);assert.equal(controls.aim,null);
  assert.equal(patrolFlightInput([],{x:0,y:0},false,true).fire,true);
});
