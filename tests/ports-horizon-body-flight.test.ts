import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { rotateBody, readAttitude, autoBankAngle, recoverBody, liftAndGravity, chaseCounterBank, GRAVITY } from '../src/arcade-ports/horizon/flight-body.ts';
import { flightVelocity } from '../src/arcade-ports/horizon/flight.ts';

const forward = q => new THREE.Vector3(0, 0, -1).applyQuaternion(q);
const near = (a: number, b: number, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('positive roll lowers the left wing; automatic bank agrees with left and right yaw', () => {
    const level = new THREE.Quaternion(), left = rotateBody(level, 0, 0, .4), right = rotateBody(level, 0, 0, -.4);
    assert.ok(new THREE.Vector3(-1, 0, 0).applyQuaternion(left).y < 0);
    assert.ok(new THREE.Vector3(1, 0, 0).applyQuaternion(right).y < 0);
    assert.ok(autoBankAngle(readAttitude(level), .9, .1) > 0);
    assert.ok(autoBankAngle(readAttitude(level), -.9, .1) < 0);
    near(readAttitude(left).bank, .4); near(readAttitude(right).bank, -.4);
});

test('at a 90 degree bank, pitch turns toward the craft canopy rather than city up', () => {
    for (const sign of [-1, 1]) {
        const banked = rotateBody(new THREE.Quaternion(), 0, 0, sign * Math.PI / 2);
        const nose = forward(rotateBody(banked, .2, 0, 0));
        near(nose.x, -sign * Math.sin(.2)); near(nose.y, 0); near(nose.z, -Math.cos(.2));
        const yawed = forward(rotateBody(banked, 0, .2, 0));
        near(yawed.x, 0); near(yawed.y, -sign * Math.sin(.2));
    }
});

test('inverted pitch and strafing use the craft frame, and neutral rotation preserves a manual bank', () => {
    const inverted = rotateBody(new THREE.Quaternion(), 0, 0, Math.PI);
    assert.ok(forward(rotateBody(inverted, .2, 0, 0)).y < 0, 'pulling up while inverted points toward the ground');
    assert.ok(new THREE.Vector3(0, 40, 0).applyQuaternion(inverted).y < 0, 'local vertical thrusters remain craft-relative');
    near(rotateBody(inverted, 0, 0, 0).angleTo(inverted), 0);
});

test('body rotation passes through vertical and full loops without an Euler clamp, with consistent mixed-axis integration', () => {
    const loop = rotateBody(new THREE.Quaternion(), Math.PI, 0, 0); near(forward(loop).z, 1);
    near(rotateBody(loop, Math.PI, 0, 0).angleTo(new THREE.Quaternion()), 0);
    const results = [30,60,120,144].map(hz => {
        let q = new THREE.Quaternion();
        for (let i = 0; i < hz * 4; i++) q = rotateBody(q, .7 / hz, .31 / hz, .48 / hz);
        near(q.length(), 1); return q;
    });
    for (const q of results) assert.ok(q.angleTo(results[0]) < 1e-7);
});

test('gravity stays world-down, lift tilts with the craft, and banked or inverted flight loses vertical support', () => {
    const level = new THREE.Quaternion(), banked = rotateBody(level, 0, 0, Math.PI / 2), inverted = rotateBody(level, 0, 0, Math.PI);
    near(liftAndGravity(level, 0, true, false).y, 0, 1e-8);
    const side = liftAndGravity(banked, 108, true, false); near(side.x, -GRAVITY); near(side.y, -GRAVITY);
    near(liftAndGravity(inverted, 108, true, false).y, -GRAVITY * 2);
    assert.deepEqual(liftAndGravity(banked, 0, false, false), {x:0,y:-GRAVITY,z:0});
    near(liftAndGravity(level, 0, true, true).y, -GRAVITY);
    near(liftAndGravity(level, 108, false, false).y, 0);
});

test('gravity integrates velocity and displacement exactly in drift and consistently during coupled motion', () => {
    const force = {x:0,y:-GRAVITY,z:0}, zero = {x:0,y:0,z:0};
    const falling = flightVelocity(zero, zero, 2, false, true, force);
    near(falling.velocity.y, -GRAVITY * 2); near(falling.displacement.y, -GRAVITY * 2);
    const results = [30,60,120,144].map(hz => {
        let v={x:0,y:0,z:-100}, y=0;
        for (let i=0;i<hz*2;i++) { const step=flightVelocity(v,{x:0,y:0,z:-100},1/hz,false,false,force);v=step.velocity;y+=step.displacement.y; }
        return {v,y};
    });
    for (const result of results) { near(result.v.y,results[0].v.y); near(result.y,results[0].y); }
});

test('level recovery unwinds inverted flight while preserving the chosen heading', () => {
    const heading=.6, target=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),heading);
    for (const hz of [30,60,120,144]) {
        let q=rotateBody(target,.4,0,Math.PI), complete=false;
        for (let i=0;i<hz*2;i++) { const recovered=recoverBody(q,heading,1/hz);q=recovered.orientation;complete=recovered.complete; }
        assert.equal(complete,true);assert.ok(q.angleTo(target)<1e-7);
    }
});

test('chase camera compensation is continuous and periodic through full rolls', () => {
    near(chaseCounterBank(Math.PI-1e-6,false),chaseCounterBank(-Math.PI+1e-6,false),.00001);
    near(chaseCounterBank(0,false),chaseCounterBank(Math.PI*2,false));
    near(chaseCounterBank(.8,true),-.8);
});
