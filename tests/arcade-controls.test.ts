import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stickVector,FollowingStick} from '../src/arcade-controls.ts';

test('thumb stick has a neutral centre, proportional movement and a circular limit',()=>{
  assert.deepEqual(stickVector(0,0,40),{x:0,y:0});
  assert.deepEqual(stickVector(3,0,40),{x:0,y:0});
  assert.ok(stickVector(20,0,40).x>0&&stickVector(20,0,40).x<1);
  assert.deepEqual(stickVector(-100,0,40),{x:-1,y:0});
  const diagonal=stickVector(100,100,40);assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-9);
});


test('floating stick starts neutral wherever the thumb lands',()=>{const stick=new FollowingStick(32);stick.begin(45,70);assert.equal(stick.x,0);assert.equal(stick.y,0);stick.move(47,71);assert.equal(stick.x,0);assert.equal(stick.y,0);stick.move(61,70);assert.ok(Math.abs(stick.x-4/9)<1e-8);assert.equal(stick.y,0);});
test('following stick can reverse after a long drag without crossing the original origin',()=>{const stick=new FollowingStick(32);stick.begin(10,10);stick.move(200,10);assert.equal(stick.x,1);assert.deepEqual(stick.origin,{x:168,y:10});stick.move(168,10);assert.equal(stick.x,0);stick.move(152,10);assert.ok(stick.x<-.4);});
test('following stick preserves analogue diagonals and clamps visual travel',()=>{const stick=new FollowingStick(32);stick.begin(0,0);stick.move(200,-200);assert.ok(Math.abs(Math.hypot(stick.x,stick.y)-1)<1e-9);assert.ok(Math.abs(Math.hypot(stick.tip.x,stick.tip.y)-32)<1e-9);assert.ok(stick.x>0&&stick.y<0);stick.begin(300,400);assert.deepEqual(stick.tip,{x:0,y:0});assert.equal(stick.x,0);assert.equal(stick.y,0);});
