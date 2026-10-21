import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHT, advanceAxis, advanceSpeed, axisInput, interceptTime, segmentBoxFraction, awardKill } from '../src/arcade-ports/horizon/flight.ts';

function near(actual: number, expected: number, tolerance = 1e-9) { assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`); }
function steeringRun(hz: number) {
    let rate = 0, angle = 0;
    for (const [seconds, input] of [[0.1, 1], [0.3, 0], [1, 1], [0.3, -1], [0.3, 0]]) {
        for (let i = 0; i < Math.round(seconds * hz); i++) {
            const step = advanceAxis(rate, input * FLIGHT.yawRate, 1 / hz); rate = step.rate; angle += step.angle;
        }
    }
    return { rate, angle };
}
test('identical tap/hold/reverse/release at 30, 60, 120 and 144 Hz', () => {
    const reference = steeringRun(120);
    for (const hz of [30, 60]) { const result = steeringRun(hz); near(result.rate, reference.rate); near(result.angle, reference.angle); }
    // 144Hz cannot represent a 100ms tap exactly; compare within one sample of rotation.
    assert.ok(Math.abs(steeringRun(144).angle - reference.angle) < FLIGHT.yawRate / 144);
});
test('short taps stay small and release stops before accumulating a long drift', () => {
    const tap = advanceAxis(0, FLIGHT.yawRate, 0.08);
    assert.ok(tap.angle < 0.02); assert.ok(tap.rate < FLIGHT.yawRate / 3);
    const release = advanceAxis(tap.rate, 0, 0.1);
    near(release.rate, 0); assert.ok(release.angle < 0.005);
});
test('held steering reaches its limit without overshooting; opposing input brakes quickly', () => {
    const held = advanceAxis(0, FLIGHT.yawRate, 1);
    near(held.rate, FLIGHT.yawRate);
    const reverse = advanceAxis(held.rate, -FLIGHT.yawRate, 0.1);
    assert.ok(reverse.rate < 0);
    near(advanceAxis(held.rate, 0, 0.1).rate, 0);
});
test('opposite keys cancel, including alias combinations', () => {
    assert.equal(axisInput(true, true), 0); assert.equal(axisInput(false, false), 0);
    assert.equal(axisInput(true, false), 1); assert.equal(axisInput(false, true), -1);
});
test('speed acceleration and travelled distance are independent of frame rate', () => {
    function run(hz: number) {
        let speed = 0, distance = 0;
        for (const target of [108, 235, 42]) for (let i = 0; i < hz; i++) {
            const next = advanceSpeed(speed, target, 1 / hz); speed = next.speed; distance += next.distance;
        }
        return { speed, distance };
    }
    const reference = run(120);
    for (const hz of [30, 60, 144]) { const result = run(hz); near(result.speed, reference.speed); near(result.distance, reference.distance); }
});
test('fast shots hit crossed objects, and the closest obstacle wins', () => {
    const start = { x: 0, y: 0, z: 0 }, end = { x: 0, y: 0, z: -100 };
    const wall = { min: { x: -5, y: -5, z: -32 }, max: { x: 5, y: 5, z: -30 } };
    const target = { min: { x: -5, y: -5, z: -62 }, max: { x: 5, y: 5, z: -60 } };
    near(segmentBoxFraction(start, end, wall)!, 0.3); near(segmentBoxFraction(start, end, target)!, 0.6);
    assert.ok(segmentBoxFraction(start, end, wall)! < segmentBoxFraction(start, end, target)!);
    assert.equal(segmentBoxFraction({ x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: -100 }, wall), null);
    near(segmentBoxFraction({ x: 0, y: 0, z: -31 }, end, wall)!, 0);
});
test('relative sweep catches a target crossing the shot during a step', () => {
    const targetNow = { min: { x: 4, y: -1, z: -6 }, max: { x: 6, y: 1, z: -4 } };
    // Target moves from x=-5 to x=5; move laser start by the same +10 delta.
    assert.notEqual(segmentBoxFraction({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: -10 }, targetNow), null);
});
test('lead solves the actual crossing-target intercept', () => {
    const relative = { x: 0, y: 0, z: -700 }, velocity = { x: 60, y: 0, z: 28 };
    const t = interceptTime(relative, velocity, FLIGHT.laserSpeed);
    near(Math.hypot(velocity.x * t, 0, relative.z + velocity.z * t), FLIGHT.laserSpeed * t);
    assert.ok(t > 0 && t < 0.5);
    near(interceptTime({ x: 0, y: 0, z: -500 }, { x: 0, y: 0, z: 0 }, 1000), 0.5);
    near(interceptTime({ x: 0, y: 0, z: 0 }, velocity, 1000), 0);
});
test('assist stays narrow and rewards build gradually, cap at ×4, and expire', () => {
    near(FLIGHT.assistAngle * 180 / Math.PI, 3);
    assert.equal(awardKill(100, 2, 1).multiplier, 1);
    assert.equal(awardKill(100, 3, 1).points, 200);
    assert.equal(awardKill(100, 30, 1).multiplier, 4);
    assert.deepEqual(awardKill(100, 30, 0), { streak: 1, multiplier: 1, points: 100 });
});
