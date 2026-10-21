import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotAxis, flightVelocity, flightStick, advanceSpeed } from '../src/arcade-ports/horizon/flight.ts';

test('fly-by-wire rotation stops promptly and keeps the same tap/reverse behaviour at every refresh rate', () => {
    const results: number[] = [];
    for (const hz of [30, 60, 120, 144]) {
        let rate = 0, angle = 0;
        for (const [seconds, demand] of [[.5, 1], [.5, -1], [.5, 0]]) for (let i = 0; i < Math.round(seconds * hz); i++) {
            const step = pilotAxis(rate, demand, .9, 1 / hz); rate = step.rate; angle += step.angle;
        }
        results.push(angle); assert.equal(rate, 0);
        const release = pilotAxis(.9, 0, .9, .1);
        assert.equal(release.rate, 0); assert.ok(release.angle < Math.PI / 180, 'counter-thrust removes the old multi-degree release tail');
    }
    assert.ok(Math.max(...results) - Math.min(...results) < 1e-8);
});

test('virtual stick has a quiet centre, fine correction zone, radial cap and symmetric diagonals', () => {
    assert.deepEqual(flightStick(4, -4, 200), { x: 0, y: 0 });
    const fine = flightStick(30, 0, 200); assert.ok(fine.x > 0 && fine.x < .04);
    const diagonal = flightStick(400, 400, 200); assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-12);
    assert.equal(diagonal.x, diagonal.y); assert.equal(flightStick(-400, -400, 200).x, -diagonal.x);
});

test('assisted velocity and displacement are consistent across refresh rates; strafe does not change aim', () => {
    const results: any[] = [];
    for (const hz of [30, 60, 120, 144]) {
        let velocity = { x: 0, y: 0, z: -100 }, position = { x: 0, y: 0, z: 0 };
        for (let i = 0; i < hz * 2; i++) {
            const step = flightVelocity(velocity, { x: 48, y: 20, z: -100 }, 1 / hz); velocity = step.velocity;
            for (const axis of ['x', 'y', 'z']) position[axis] += step.displacement[axis];
        }
        results.push(position); assert.equal(velocity.z, -100); assert.ok(position.x > 80 && position.y > 30);
    }
    for (const axis of ['x', 'y', 'z']) assert.ok(Math.max(...results.map(p => p[axis])) - Math.min(...results.map(p => p[axis])) < 1e-8);
});

test('drift preserves the travel vector; braking arrests it; boost provides real forward acceleration', () => {
    const drift = flightVelocity({ x: 80, y: 3, z: -100 }, { x: -100, y: 0, z: 0 }, 2, false, true);
    assert.deepEqual(drift.velocity, { x: 80, y: 3, z: -100 }); assert.deepEqual(drift.displacement, { x: 160, y: 6, z: -200 });
    const brake = flightVelocity(drift.velocity, { x: 0, y: 0, z: 0 }, 1, true, true); assert.ok(Math.hypot(...Object.values(brake.velocity)) < .01);
    const opposedBrake = flightVelocity(drift.velocity, { x: 48, y: 40, z: -225 }, 1, true);
    assert.deepEqual(opposedBrake, brake, 'retro thrust overrides throttle and strafing, including while drifting');
    for (const hz of [30, 60, 120, 144]) {
        let speed = 108, velocity = { x: 0, y: 0, z: -108 };
        for (let i = 0; i < hz * 2; i++) { speed = advanceSpeed(speed, 225, 1 / hz).speed; velocity = flightVelocity(velocity, { x: 0, y: 0, z: -speed }, 1 / hz).velocity; }
        assert.ok(-velocity.z > 220 && -velocity.z <= 225);
    }
});
