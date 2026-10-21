import test from 'node:test';
import assert from 'node:assert/strict';
import { gateApproach, clearApproach } from '../src/arcade-ports/horizon/navigation.ts';
import { segmentBoxFraction } from '../src/arcade-ports/horizon/flight.ts';

test('training gates prefer a level, forward route when the avenue is clear', () => {
    const origin = { x: 0, y: 115, z: 0 };
    const gate = gateApproach(origin, { x: 0, y: 0, z: -1 }, 115, true, () => true)!;
    assert.deepEqual(gate, { x: 0, y: 115, z: -400 });
});
test('gate placement checks the approach, not just whether the ring itself fits', () => {
    const origin = { x: 0, y: 115, z: 0 }, wall = { min: { x: -45, y: 0, z: -280 }, max: { x: 45, y: 240, z: -150 } };
    const gate = gateApproach(origin, { x: 0, y: 0, z: -1 }, 115, true, point => segmentBoxFraction(origin, point, wall, 3) === null)!;
    assert.ok(gate); assert.equal(segmentBoxFraction(origin, gate, wall, 3), null);
    assert.ok(gate.x !== 0 || gate.y > wall.max.y, 'the safe route must go around or over the obstruction');
});
test('a boxed-in pilot gets no impossible gate; the director can retry after the pilot moves', () => {
    assert.equal(gateApproach({ x: 0, y: 90, z: 0 }, { x: 0, y: 1, z: 0 }, 90, true, () => false), null);
    const gate = gateApproach({ x: 0, y: 90, z: 0 }, { x: 0, y: 1, z: 0 }, 90, true, () => true)!;
    assert.ok(Number.isFinite(gate.x) && Number.isFinite(gate.z)); assert.ok(gate.z < 0, 'a vertical look still produces a usable horizontal approach');
});
test('a gate corridor allows departure beside a wall but rejects a route that scrapes it', () => {
    const origin = { x: 0, y: 115, z: 0 }, wall = { min: { x: 4, y: 0, z: -100 }, max: { x: 54, y: 220, z: 100 } };
    const clear = (start, end, padding) => segmentBoxFraction(start, end, wall, padding) === null;
    assert.equal(clearApproach(origin, { x: -100, y: 115, z: -400 }, clear), true);
    assert.equal(clearApproach(origin, { x: 0, y: 115, z: -400 }, clear), false);
});
