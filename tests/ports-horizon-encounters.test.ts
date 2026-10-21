import test from 'node:test';
import assert from 'node:assert/strict';
import { routeCode, parseRoute } from '../src/arcade-ports/horizon/routes.ts';
import { attackPlan, closestApproach, patrolPlan, cannonStep } from '../src/arcade-ports/horizon/combat.ts';
import { levelAttitude, segmentBoxFraction } from '../src/arcade-ports/horizon/flight.ts';
import { createRun, dodgeReward, randomSource, ENEMIES } from '../src/arcade-ports/horizon/game.ts';

test('route codes round-trip all seed bits and reproduce city randomness', () => {
    for (const seed of [0, 1, 12345678, 0x80000000, 0xffffffff]) {
        const code = routeCode(seed); assert.equal(code.length, 10);
        assert.equal(parseRoute(code), seed); assert.equal(parseRoute(code.toLowerCase()), seed);
        assert.equal(parseRoute(' ' + code.slice(3) + ' '), seed);
        const first = randomSource(seed), repeated = randomSource(parseRoute(code)!);
        assert.deepEqual(Array.from({ length: 100 }, first), Array.from({ length: 100 }, repeated));
    }
});
test('invalid, partial and overflowing route codes are rejected without changing a route', () => {
    for (const code of ['', 'NEON', 'NH-', 'NH-123456', 'NH-12345678', 'NH-!!!!!!!', 'ZZZZZZZ', 'NH-00000_0', 'NH-00000.0']) assert.equal(parseRoute(code), null, code);
});
test('level recovery settles smoothly and consistently across refresh rates', () => {
    const results = [30, 60, 120, 144].map(hz => {
        let pitch = 0.9, bank = -1;
        for (let i = 0; i < hz; i++) { const next = levelAttitude(pitch, bank, 1 / hz); assert.ok(next.pitch <= pitch && next.bank >= bank); pitch = next.pitch; bank = next.bank; }
        assert.ok(Math.abs(pitch) < 0.008 && Math.abs(bank) < 0.008);
        return { pitch, bank };
    });
    for (const value of results) { assert.ok(Math.abs(value.pitch - results[0].pitch) < 1e-12); assert.ok(Math.abs(value.bank - results[0].bank) < 1e-12); }
});
test('Strikers have sequential aimed shots; Warden fans have an escape gap', () => {
    assert.ok(ENEMIES[2].health > ENEMIES[1].health && ENEMIES[2].speed < ENEMIES[1].speed, 'the armored gun platform trades agility for durability');
    const striker = attackPlan(1, false, 1, 0, 'arcade'), warden = attackPlan(2, false, 1, 0, 'arcade');
    assert.equal(striker.shots.length, 2); assert.ok(striker.shots[1].delay > 0);
    assert.ok(striker.shots.every(s => s.yaw === 0));
    assert.equal(warden.shots.length, 3); assert.ok(warden.shots[0].yaw < 0 && warden.shots[2].yaw > 0);
    assert.ok(warden.charge > striker.charge, 'the wider attack has a longer warning');
});
test('Sentinel alternates fan and burst patterns; phase two remains bounded and telegraphed', () => {
    for (const difficulty of ['relaxed', 'arcade', 'ace'] as const) {
        for (const health of [1, 0.5, 0.1]) for (const cycle of [0, 1, 2, 3]) {
            const attack = attackPlan(2, true, health, cycle, difficulty);
            assert.ok(attack.charge >= 1 && attack.cooldown >= 2.5); assert.ok(attack.shots.length <= 5);
            assert.ok(attack.shots.every(s => Math.abs(s.yaw) <= 0.24 && s.delay >= 0 && s.delay < 0.6));
            assert.equal(attack.shots.some(s => s.delay > 0), cycle % 2 === 1);
        }
    }
    assert.ok(attackPlan(2, true, 0.4, 0, 'arcade').cooldown < attackPlan(2, true, 1, 0, 'arcade').cooldown);
});
test('a swept close evade is detected even when a fast shot crosses between frames', () => {
    for (const extent of [3, 30, 300]) {
        const close = closestApproach({ x: 11, y: 0, z: extent }, { x: 11, y: 0, z: -extent });
        assert.equal(close.distance, 11); assert.equal(close.fraction, 0.5);
    }
    const box = { min: { x: -3, y: -2.5, z: -3.5 }, max: { x: 3, y: 2.5, z: 3.5 } };
    assert.notEqual(segmentBoxFraction({ x: 0, y: 0, z: 30 }, { x: 0, y: 0, z: -30 }, box), null);
    assert.ok(closestApproach({ x: 0, y: 0, z: 30 }, { x: 0, y: 0, z: -30 }).distance < 7, 'a direct hit is outside the evade reward band');
    assert.equal(closestApproach({ x: 11, y: 0, z: -30 }, { x: 11, y: 0, z: -60 }).fraction, 0, 'an already passed bolt cannot pay again');
});
test('evasion rewards preserve a chain, restore bounded energy, and never enter practice scoring', () => {
    const run = createRun('mission', 'arcade', 1); run.multiplier = 3; run.streak = 8; run.energy.amount = 97;
    assert.equal(dodgeReward(run), 225); assert.equal(run.dodges, 1); assert.equal(run.energy.amount, 100);
    assert.equal(run.combo, 2); assert.equal(run.streak, 8);
    run.outcome = 'victory'; assert.equal(dodgeReward(run), 0); assert.equal(run.dodges, 1);
    assert.equal(dodgeReward(createRun('practice', 'arcade', 1)), 0);
});
test('formations scale with challenge and respect the active-enemy cap', () => {
    for (const difficulty of ['relaxed', 'arcade', 'ace'] as const) for (const slots of [0, 1, 2, 3, 5]) {
        const patrol = patrolPlan({ mode: 'mission', sector: 1, difficulty, slots, boss: false }, randomSource(123));
        assert.ok(patrol.length <= slots);
        assert.equal(patrol.length, Math.min(slots, difficulty === 'relaxed' ? 1 : difficulty === 'arcade' ? 2 : 3));
        for (let i = 1; i < patrol.length; i++) assert.ok(Math.abs(patrol[i].lateral - patrol[i - 1].lateral) >= 100, 'ships have enough visual separation to aim between them');
    }
    const safe = patrolPlan({ mode: 'practice', sector: 5, difficulty: 'ace', slots: 5, boss: false }, randomSource(9));
    assert.equal(safe.length, 1); assert.equal(safe[0].type, 0);
    assert.equal(patrolPlan({ mode: 'mission', sector: 2, difficulty: 'ace', slots: 5, boss: true }, randomSource(9)).length, 1);
});
test('continuous cannons maintain their cadence across refresh rates', () => {
    const counts = [30, 60, 120, 144].map(hz => {
        let cooldown = 0, shots = 0;
        for (let i = 0; i < hz * 10; i++) { const step = cannonStep(cooldown, 1 / hz, true); cooldown = step.cooldown; if (step.fire) shots++; }
        return shots;
    });
    assert.ok(counts.every(count => count === counts[0] && count >= 62 && count <= 63), counts.join(', '));
});
test('tapping or flickering auto alignment cannot bypass the cannon interval', () => {
    let cooldown = 0, shots = 0;
    for (let i = 0; i < 1200; i++) { const step = cannonStep(cooldown, 1 / 120, i % 2 === 0); cooldown = step.cooldown; if (step.fire) shots++; }
    assert.ok(shots <= 63 && shots >= 60, String(shots));
});
test('idle cannons fire promptly without accumulating a burst of overdue shots', () => {
    let cooldown = 0;
    for (let i = 0; i < 1200; i++) cooldown = cannonStep(cooldown, 1 / 120, false).cooldown;
    const first = cannonStep(cooldown, 1 / 120, true), second = cannonStep(first.cooldown, 1 / 120, true);
    assert.equal(first.fire, true); assert.equal(second.fire, false); assert.ok(second.cooldown > 0.14);
});
