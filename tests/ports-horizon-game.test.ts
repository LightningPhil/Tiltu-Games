import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, tickRun, damageRun, killReward, gateReward, nearMissReward, createEnergy, tickEnergy, usePulse,
    crossesGate, shapeAxis, randomSource, parseSettings, parseScores, rankRun, sentinelCruise, ENERGY } from '../src/arcade-ports/horizon/game.ts';
import { advanceSpeed } from '../src/arcade-ports/horizon/flight.ts';

const near = (a: number, b: number, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('a contract progresses through six scouts, eight hostiles, and a Sentinel victory', () => {
    const run = createRun('mission', 'arcade', 42);
    for (let i = 0; i < 5; i++) { assert.equal(killReward(run, 100).advanced, false); tickRun(run, 2); }
    assert.equal(killReward(run, 100).advanced, true); assert.equal(run.sector, 1); assert.equal(run.sectorKills, 0);
    for (let i = 0; i < 7; i++) { killReward(run, 220); tickRun(run, 2); }
    assert.equal(killReward(run, 360).advanced, true); assert.equal(run.sector, 2);
    killReward(run, 220); assert.equal(run.outcome, 'flying', 'support ships do not finish the contract');
    const before = run.score; killReward(run, 2000, true);
    assert.equal(run.outcome, 'victory'); assert.ok(run.score > before + 2000); assert.ok(run.bonus > 0);
    const finalScore = run.score, finalTime = run.remaining;
    tickRun(run, 20); killReward(run, 100); gateReward(run); nearMissReward(run, true);
    assert.equal(run.score, finalScore); assert.equal(run.remaining, finalTime);
});
test('a timeout ends the contract once; practice and endless flights have no deadline', () => {
    const timed = createRun('mission', 'ace', 1); tickRun(timed, 1000);
    assert.equal(timed.outcome, 'timeout'); assert.equal(timed.remaining, 0);
    assert.equal(killReward(timed, 1000).points, 0);
    for (const mode of ['endless', 'practice'] as const) {
        const run = createRun(mode, 'ace', 1); tickRun(run, 1000); assert.equal(run.outcome, 'flying');
    }
});
test('gunfire has a recovery window, interrupts a chain, and cannot bypass practice immunity', () => {
    const run = createRun('mission', 'arcade', 2); tickRun(run, 3); killReward(run, 100);
    assert.equal(damageRun(run, 28), true); assert.equal(run.shields, 72); assert.equal(run.combo, 0); assert.equal(run.streak, 0);
    assert.equal(damageRun(run, 100), false, 'a cluster of simultaneous impacts is one hit');
    tickRun(run, 1.4); assert.equal(damageRun(run, 12), true); assert.equal(run.shields, 60);
    tickRun(run, 6); near(run.shields, 60); tickRun(run, 2); near(run.shields, 64);
    const practice = createRun('practice', 'ace', 2); tickRun(practice, 3);
    assert.equal(damageRun(practice, 1000), false); assert.equal(practice.shields, 100); assert.equal(practice.outcome, 'flying');
});

test('a single collision is fatal in every mode and difficulty, including protection windows', () => {
    for (const mode of ['mission','endless','practice','cruise'] as const)
    for (const difficulty of ['relaxed','arcade','ace'] as const)
    for (const invulnerable of [0, .72, 2]) {
        const run = createRun(mode, difficulty, 7); run.invulnerable = invulnerable; run.combo = 5; run.streak = 4;
        assert.equal(damageRun(run, 1, true), true, `${mode}/${difficulty}/${invulnerable}`);
        assert.equal(run.shields, 0); assert.equal(run.damageTaken, 100); assert.equal(run.outcome, 'crashed');
        assert.equal(run.combo, 0); assert.equal(run.streak, 0); assert.equal(run.multiplier, 1);
        tickRun(run, 20); assert.equal(run.elapsed, 0); assert.equal(run.shields, 0);
        assert.equal(damageRun(run, 1, true), false); assert.equal(gateReward(run), 0); assert.equal(killReward(run, 100).points, 0);
    }
});
test('lethal damage is clamped and freezes further score and damage', () => {
    const run = createRun('mission', 'arcade', 2); tickRun(run, 3);
    assert.equal(damageRun(run, 1000), true); assert.equal(run.shields, 0); assert.equal(run.damageTaken, 100); assert.equal(run.outcome, 'crashed');
    assert.equal(damageRun(run, 12), false); assert.equal(gateReward(run), 0); assert.equal(nearMissReward(run, true), 0);
});
test('shield recovery and countdown stay consistent at 30, 60, and 144 Hz', () => {
    function flight(hz: number) {
        const run = createRun('mission', 'arcade', 5); run.shields = 30;
        for (let i = 0; i < hz * 12; i++) tickRun(run, 1 / hz);
        return run;
    }
    const reference = flight(120);
    for (const hz of [30, 60, 144]) { const run = flight(hz); near(run.shields, reference.shields); near(run.remaining, reference.remaining); near(run.elapsed, reference.elapsed); }
});
test('boost drains a shared pool, latches on empty, and rearms after release', () => {
    const energy = createEnergy(); tickEnergy(energy, 2, true); near(energy.amount, 46);
    assert.equal(usePulse(energy), true); near(energy.amount, 1);
    tickEnergy(energy, 1, true); assert.equal(energy.locked, true); near(energy.amount, 0);
    tickEnergy(energy, 5, true); assert.ok(energy.amount > 12); assert.equal(energy.locked, true);
    tickEnergy(energy, 0.1, false); assert.equal(energy.locked, false);
    assert.equal(tickEnergy(energy, 0.1, true), true); assert.ok(energy.amount < 100);
});
test('EMP rejects low energy and cooldown without spending resources', () => {
    const energy = createEnergy(); assert.equal(usePulse(energy), true); near(energy.amount, 55);
    assert.equal(usePulse(energy), false); near(energy.amount, 55);
    tickEnergy(energy, ENERGY.pulseCooldown + 1, false); assert.equal(usePulse(energy), true);
    energy.pulseCooldown = 0; energy.amount = ENERGY.pulseCost - 0.01;
    assert.equal(usePulse(energy), false); near(energy.amount, ENERGY.pulseCost - 0.01);
});
test('energy recharge respects its delay and is stable across refresh rates', () => {
    function run(hz: number) {
        const energy = createEnergy();
        for (let i = 0; i < hz * 2; i++) tickEnergy(energy, 1 / hz, true);
        for (let i = 0; i < hz * 2; i++) tickEnergy(energy, 1 / hz, false);
        return energy.amount;
    }
    for (const hz of [30, 60, 144]) near(run(hz), run(120));
});
test('gates restore resources, support a streak, and cap extra contract time at thirty seconds', () => {
    const run = createRun('mission', 'arcade', 5); run.shields = 15; run.energy.amount = 5; run.multiplier = 3;
    assert.equal(gateReward(run), 450); assert.equal(run.shields, 33); assert.equal(run.energy.amount, 60); assert.equal(run.combo, 4);
    for (let i = 0; i < 20; i++) gateReward(run);
    assert.equal(run.extraTime, 30); assert.equal(run.remaining, 220); assert.equal(run.shields, 100); assert.equal(run.energy.amount, 100);
    const practice = createRun('practice', 'arcade', 5); gateReward(practice); assert.equal(practice.extraTime, 0);
});
test('a fast crossing collects the gate; grazing outside or travelling parallel does not', () => {
    const center = { x: 0, y: 80, z: -200 }, normal = { x: 0, y: 0, z: -1 };
    assert.equal(crossesGate({ x: 0, y: 80, z: -150 }, { x: 0, y: 80, z: -250 }, center, normal, 25), true);
    assert.equal(crossesGate({ x: 25.1, y: 80, z: -150 }, { x: 25.1, y: 80, z: -250 }, center, normal, 25), false);
    assert.equal(crossesGate({ x: -30, y: 80, z: -200 }, { x: 30, y: 80, z: -200 }, center, normal, 25), false);
    assert.equal(crossesGate({ x: 0, y: 80, z: -250 }, { x: 0, y: 80, z: -150 }, center, normal, 25), true);
});
test('near misses reward speed and scale with the current chain', () => {
    const run = createRun('endless', 'arcade', 2); run.multiplier = 2; run.energy.amount = 40;
    assert.equal(nearMissReward(run, false), 100); assert.equal(nearMissReward(run, true), 200);
    assert.equal(run.score, 300); assert.equal(run.nearMisses, 2); assert.equal(run.energy.amount, 52);
});
test('analog steering has a drift deadzone and fine center control', () => {
    assert.equal(shapeAxis(0.05), 0); assert.equal(shapeAxis(-0.12), 0); assert.equal(shapeAxis(NaN), 0);
    near(shapeAxis(1), 1); near(shapeAxis(-1), -1); near(shapeAxis(2), 1);
    assert.ok(shapeAxis(0.5) < 0.5); near(shapeAxis(-0.5), -shapeAxis(0.5));
});
test('retry seeds reproduce the same stream; different seeds produce different routes', () => {
    const a = randomSource(123), b = randomSource(123), c = randomSource(124);
    const first = Array.from({ length: 100 }, a), repeated = Array.from({ length: 100 }, b), different = Array.from({ length: 100 }, c);
    assert.deepEqual(first, repeated); assert.notDeepEqual(first, different); assert.ok(first.every(v => v >= 0 && v < 1));
});
test('malformed preferences, inherited object keys, and corrupt scores cannot break the flight deck', () => {
    for (const raw of [null, '', '[', 'null', '[]', 'true']) assert.equal(parseSettings(raw).difficulty, 'arcade');
    assert.equal(parseSettings('{"difficulty":"__proto__"}').difficulty, 'arcade');
    const settings = parseSettings('{"mode":"endless","controls":"mouse","sensitivity":9,"stabilized":false,"sound":"no","pilot":"<x1>"}');
    assert.equal(settings.mode, 'endless'); assert.equal(settings.controls, 'mouse'); assert.equal(settings.sensitivity, 1.5);
    assert.equal(settings.stabilized, false); assert.equal(settings.sound, true); assert.equal(settings.pilot, 'X1');
    assert.equal(parseSettings(null, true).reducedMotion, true);
    assert.equal(parseSettings('{"reducedMotion":false}', true).reducedMotion, false, 'an explicit preference overrides the system default');
    assert.equal(parseSettings(null, false, true).autoFire, true, 'touch starts with a two-thumb cannon option');
    assert.equal(parseSettings('{"autoFire":false}', false, true).autoFire, false, 'a saved firing preference overrides the touch default');
    assert.equal(parseSettings('{"autoFire":"yes"}').autoFire, false);
    for (const raw of [null, 'null', '{}', '[', '[null,1,"bad"]']) assert.deepEqual(parseScores(raw), []);
    const scores = parseScores('[{"name":"<img>","score":10,"rank":"S"},{"name":"ACE","score":-1},{"name":"TOP","score":200.8}]');
    assert.equal(scores.length, 2); assert.equal(scores[0].score, 200); assert.equal(scores[1].name, 'IMG');
});
test('a flight school session never gets a competitive grade', () => {
    const run = createRun('practice', 'ace', 5); run.score = 100000;
    assert.equal(rankRun(run), 'FLIGHT SCHOOL');
});
test('afterburner can catch the Sentinel, with an Arcade energy budget for a close-range EMP', () => {
    for (const difficulty of ['relaxed', 'arcade', 'ace'] as const) assert.ok(sentinelCruise(difficulty, -100) < 225, 'the boss cannot match afterburner');
    let distance = 500, speed = 108;
    const dt = 1 / 120, energy = createEnergy();
    for (let i = 0; i < 120 * 8; i++) distance += (sentinelCruise('arcade', distance) - speed) * dt;
    assert.ok(distance > 340 && distance < 390, 'ordinary flight holds a useful engagement distance');
    for (let i = 0; i < 120 * 3 && distance > ENERGY.pulseRadius; i++) {
        const movement = advanceSpeed(speed, 225, dt); speed = movement.speed;
        distance += sentinelCruise('arcade', distance) * dt - movement.distance;
        tickEnergy(energy, dt, true);
    }
    assert.ok(distance <= ENERGY.pulseRadius); assert.ok(energy.amount >= ENERGY.pulseCost); assert.equal(usePulse(energy), true);
    // A short braking correction before the boost must still leave power for the pulse.
    for (const hz of [30, 60, 144]) {
        distance = 450; speed = 60;
        const budget = createEnergy(), step = 1 / hz;
        for (let i = 0; i < hz * 3 && distance > ENERGY.pulseRadius; i++) {
            const movement = advanceSpeed(speed, 225, step); speed = movement.speed;
            distance += sentinelCruise('arcade', distance) * step - movement.distance;
            tickEnergy(budget, step, true);
        }
        assert.ok(distance <= ENERGY.pulseRadius, `${hz}Hz approach reaches EMP range`);
        assert.ok(usePulse(budget), `${hz}Hz approach preserves enough energy after a braking correction`);
    }
});
