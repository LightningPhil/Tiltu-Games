import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stickVector} from '../src/arcade-controls.ts';

test('thumb stick has a neutral centre, proportional movement and a circular limit',()=>{
  assert.deepEqual(stickVector(0,0,40),{x:0,y:0});
  assert.deepEqual(stickVector(3,0,40),{x:0,y:0});
  assert.ok(stickVector(20,0,40).x>0&&stickVector(20,0,40).x<1);
  assert.deepEqual(stickVector(-100,0,40),{x:-1,y:0});
  const diagonal=stickVector(100,100,40);assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-9);
});
