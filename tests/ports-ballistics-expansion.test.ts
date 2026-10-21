import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle, WIDTH, HEIGHT, WEAPONS } from '../src/arcade-ports/ballistics/game.ts';
import { CPUController } from '../src/arcade-ports/ballistics/ai.ts';
import { Camera } from '../src/arcade-ports/ballistics/camera.ts';
import { DEFAULTS, normalizePreferences, PREFERENCES_KEY, readPreferences, savePreferences } from '../src/arcade-ports/ballistics/settings.ts';

function flat(options = {}) {
    const b = new Battle('500000', () => 0.5, options);
    b.terrain.pixels.fill(0); b.terrain.pixels.fill(1, 500 * WIDTH);
    for (const u of b.units) { u.x = 100 + u.id * 180; u.y = 490; u.vx = 0; u.vy = 0; u.grounded = true; u.facing = u.team === 0 ? 1 : -1; }
    advance(b, 10); b.events = []; return b;
}
function advance(b: Battle, ticks: number) { for (let i = 0; i < ticks; i++) b.step(); }
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; }
function addCeiling(b: Battle) { for (let y = 230; y < 245; y++) b.terrain.pixels.fill(1, y * WIDTH + 20, y * WIDTH + 600); }

test('grapple attaches only to valid terrain and leaves the attack available', () => {
    const b = flat(); addCeiling(b); b.equip(7); b.active.elevation = Math.PI / 2;
    assert.equal(b.fire(), true); assert.ok(b.rope);
    assert.equal(b.phase, 'aim'); assert.equal(b.inventories[0][7], WEAPONS[7].ammo - 1);
    assert.equal(b.switchUnit(), false);
    b.equip(0); assert.equal(b.fire(8), true); assert.equal(b.rope, null);
});

test('missing grapple anchors consume no ammo and a final rope can still be released', () => {
    const b = flat(); b.equip(7); b.active.elevation = Math.PI / 2;
    assert.equal(b.fire(), false); assert.equal(b.inventories[0][7], 5);
    addCeiling(b); b.inventories[0][7] = 1;
    assert.equal(b.fire(), true); assert.equal(b.inventories[0][7], 0);
    assert.equal(b.fire(), true); assert.equal(b.rope, null); assert.equal(b.phase, 'aim');
});

test('grapple reels and swings without non-finite positions or turn locks', () => {
    const b = flat(); addCeiling(b); b.equip(7); b.active.elevation = Math.PI / 2; b.fire();
    const length = b.rope!.length;
    for (let i = 0; i < 70; i++) b.step({ up: true, right: true });
    assert.ok(b.rope && b.rope.length < length - 30);
    assert.ok(b.active.y < 460);
    assert.ok(Number.isFinite(b.active.x) && Number.isFinite(b.active.y));
    b.jump(); assert.equal(b.rope, null);
    b.skip(); advance(b, 600); assert.equal(b.turn, 2);
});

test('removing a grapple anchor releases it safely, and turn expiry cannot leave it hanging', () => {
    const b = flat(); addCeiling(b); b.equip(7); b.active.elevation = Math.PI / 2; b.fire();
    b.terrain.carve(b.rope!.x, b.rope!.y, 20); b.step(); assert.equal(b.rope, null);
    const c = flat(); addCeiling(c); c.equip(7); c.active.elevation = Math.PI / 2; c.fire();
    for (let i = 0; i < 60; i++) c.step({ up: true });
    c.time = 1; c.step(); assert.equal(c.rope, null);
    advance(c, 500); assert.equal(c.turn, 2);
});

test('reeling along a cliff lifts the rover without pulling it through the wall', () => {
    const b = flat();
    for (let y = 330; y < 500; y++) b.terrain.pixels.fill(1, y * WIDTH + 200, y * WIDTH + 300);
    b.active.elevation = Math.atan2(140, 110); b.equip(7);
    assert.equal(b.fire(), true);
    for (let i = 0; i < 220; i++) {
        b.step({ up: true, right: true });
        assert.equal(b.bodyBlocked(b.active.x, b.active.y), false);
    }
    assert.ok(b.active.y < 400, 'The winch should climb instead of locking against the cliff');
    assert.equal(b.active.hp, 100); assert.ok(b.rope);
    b.jump(); assert.equal(b.rope, null);
});

test('parachutes soften a fall and can be deployed during retreat without spending an attack', () => {
    const b = flat(); b.active.y = 250; b.active.vy = 12; b.active.grounded = false;
    assert.equal(b.deployChute(), true); advance(b, 180);
    assert.equal(b.active.hp, 100); assert.equal(b.active.grounded, true); assert.equal(b.active.chute, false);
    assert.equal(b.phase, 'aim');
    const c = flat(); c.equip(3); c.fire(); c.active.y = 250; c.active.vy = 10; c.active.grounded = false;
    assert.equal(c.deployChute(), true); c.step(); assert.ok(c.active.vy <= 1.7);
});

test('parachutes cannot be deployed on the ground, rising, on another turn, or on a rope', () => {
    const b = flat(); assert.equal(b.deployChute(), false);
    b.jump(); assert.equal(b.deployChute(), false);
    b.phase = 'resolving'; b.active.vy = 5; assert.equal(b.deployChute(), false);
});

test('hard landing ends an active turn but does not consume the next squad turn', () => {
    const b = flat(); b.active.y = 250; b.active.vy = 12; b.active.grounded = false;
    for (let i = 0; i < 50 && b.phase === 'aim'; i++) b.step();
    assert.equal(b.phase, 'resolving'); assert.ok(b.active.hp < 100);
    advance(b, 70); assert.equal(b.team, 1); assert.equal(b.phase, 'aim');
});

test('blast-speed horizontal movement cannot tunnel through thin walls', () => {
    const b = flat();
    for (let y = 300; y < 500; y++) b.terrain.pixels[y * WIDTH + 130] = 1;
    b.active.vx = 65; b.active.grounded = false; b.active.y = 450;
    b.step();
    assert.ok(b.active.x < 125); assert.equal(b.active.vx, 0);
    assert.equal(b.bodyBlocked(b.active.x, b.active.y), false);
});

test('aim covers straight down and up, including a clear shot at an enemy below a cliff', () => {
    const b = flat(); b.active.elevation = 0;
    for (let tick = 0; tick < 120; tick++) b.step({ down: true });
    assert.equal(b.active.elevation, -Math.PI / 2);
    for (let tick = 0; tick < 220; tick++) b.step({ up: true });
    assert.equal(b.active.elevation, Math.PI / 2);
    b.active.y = 250; b.active.elevation = -Math.PI / 2;
    b.units[1].x = b.active.x; b.equip(3); b.fire();
    assert.equal(b.units[1].hp, 70);
});

test('shotgun gives exactly two shots, charges ammo once, and locks weapon changes until done', () => {
    const b = flat(); b.equip(8); b.active.elevation = 0;
    assert.equal(b.fire(), true); assert.equal(b.shotgunShots, 1); assert.equal(b.phase, 'aim');
    assert.equal(b.inventories[0][8], 2); assert.equal(b.stats[0].shots, 1);
    assert.equal(b.equip(0), false); assert.ok(b.units[1].hp < 100);
    assert.equal(b.fire(), true); assert.equal(b.phase, 'retreat'); assert.equal(b.shotgunShots, 0);
    assert.equal(b.inventories[0][8], 2); assert.equal(b.stats[0].shots, 1); assert.equal(b.fire(), false);
});

test('shotgun last ammunition still permits its second shot, and passing forfeits it', () => {
    const b = flat(); b.inventories[0][8] = 1; b.equip(8); b.fire();
    assert.equal(b.inventories[0][8], 0); assert.equal(b.hasAmmo(8), true); assert.equal(b.fire(), true);
    const c = flat(); c.equip(8); c.fire(); c.skip(); assert.equal(c.shotgunShots, 0); assert.equal(c.phase, 'resolving');
});

test('dynamite is placed nearby, uses a five-second fuse, and produces a large crater', () => {
    const b = flat(); b.equip(9); const x = b.active.x;
    assert.equal(b.fire(), true); assert.equal(b.projectiles[0].kind, 'dynamite');
    assert.ok(Math.abs(b.projectiles[0].x - x) < 20); assert.equal(b.projectiles[0].fuse, 300);
    assert.equal(b.inventories[0][9], 2); advance(b, 299); assert.equal(b.terrain.revision, 0);
    b.step(); assert.equal(b.terrain.revision, 1); assert.equal(b.projectiles.length, 0);
    assert.equal(b.terrain.solid(x + 50, 510), false);
});

test('missed projectiles make a lava splash and are removed without exploding', () => {
    const b = flat(); b.terrain.pixels.fill(0);
    const p = b.projectile('grenade', 900, b.lava - 1, 0, 4, 300); b.projectiles.push(p);
    b.step();
    assert.equal(b.projectiles.length, 0); assert.equal(b.terrain.revision, 0);
    assert.ok(b.events.some(event => event.type === 'splash' && event.value === 0.5));
    assert.equal(b.events.some(event => event.type === 'blast'), false);
});

test('enemy damage, delayed lava kills, and friendly fire are attributed without exceeding remaining health', () => {
    const b = flat();
    b.damage(b.units[1], 30, 0); assert.equal(b.stats[0].damage, 30);
    b.units[1].y = b.lava; b.step();
    assert.equal(b.stats[0].damage, 100); assert.equal(b.stats[0].kills, 1);
    b.damage(b.units[2], 40, 0); assert.equal(b.stats[0].friendlyDamage, 40);
    b.damage(b.units[2], 1000, 0); assert.equal(b.stats[0].friendlyDamage, 100);
    assert.equal(b.stats[0].kills, 1);
    assert.ok(b.log.some(line => line.includes('offline')));
});

test('custom turn length, sudden death, squad names and names do not change the seeded terrain', () => {
    const a = new Battle('123456', () => 0.5);
    const b = new Battle('123456', () => 0.5, { turnSeconds: 60, suddenDeathRound: 8, teamNames: ['NEON GEESE', 'LASER DUCKS'], unitNames: [['PIP', 'POP', 'PEP'], ['ZIP', 'ZAP', 'ZEP']] });
    assert.deepEqual(a.terrain.pixels, b.terrain.pixels); assert.equal(b.time, 3600);
    assert.equal(b.active.name, 'PIP'); assert.equal(b.teamName(1), 'LASER DUCKS');
    b.turn = 14; b.startTurn(0); assert.equal(b.lava, 624);
});

test('firing range has unlimited ammunition and time and returns directly to the human squad', () => {
    const b = flat({ practice: true }); const time = b.time;
    advance(b, 2500); assert.equal(b.time, time); assert.equal(b.turn, 1);
    b.inventories[0][3] = 0; assert.equal(b.equip(3), true); assert.equal(b.fire(), true);
    advance(b, 600); assert.equal(b.team, 0); assert.equal(b.turn, 2);
    assert.equal(b.inventories[0][3], 0);
});

test('unit selection prevents selecting enemies, dead units, or free fuel after committing movement', () => {
    const b = flat(); assert.equal(b.selectUnit(1), false); assert.equal(b.selectUnit(2), true);
    b.damage(b.units[4], 100); assert.equal(b.selectUnit(4), false);
    b.step({ right: true }); assert.equal(b.selectUnit(0), false);
});

test('terrain revision records bound dirty regions without changing collision results', () => {
    const b = flat(); b.terrain.carve(200, 500, 30);
    const change = b.terrain.changes[0]; assert.ok(change.x <= 170 && change.y <= 470);
    assert.ok(change.x + change.width >= 230); assert.equal(b.terrain.solid(200, 500), false);
    for (let i = 0; i < 140; i++) b.terrain.carve(300 + i, 550, 3);
    assert.equal(b.terrain.changes.length, 128);
});

test('camera screen/world conversion stays exact at different display sizes and zoom levels', () => {
    for (const [width, height] of [[1366, 520], [2560, 950], [390, 470]]) {
        const c = new Camera(); c.resize(width, height); c.focus(800, 300, 2.1); c.update(true);
        for (const [x, y] of [[0, 0], [120, 300], [WIDTH, HEIGHT], [900, -500]]) {
            const screen = c.worldToScreen(x, y), world = c.screenToWorld(screen.x, screen.y);
            assert.ok(Math.abs(world.x - x) < 0.000001 && Math.abs(world.y - y) < 0.000001);
        }
    }
});

test('camera zoom anchors the pointer and is bounded; overview restores the full map', () => {
    const c = new Camera(); c.resize(1600, 600); const before = c.screenToWorld(800, 300);
    c.zoomAt(800, 300, 1.8, 100); const after = c.screenToWorld(800, 300);
    assert.deepEqual(before, after); assert.equal(c.manualUntil, 4100);
    c.zoomAt(800, 300, 100, 200); assert.equal(c.zoom, 3.5);
    c.pan(10000, -10000, 300); assert.ok(c.x >= 0 && c.x <= WIDTH && c.y <= HEIGHT);
    c.overview(); c.update(true); assert.equal(c.zoom, 1); assert.equal(c.x, WIDTH / 2); assert.equal(c.y, HEIGHT / 2);
    c.focus(500, -500, 2); c.update(true); assert.ok(c.y < 0, 'High projectiles must remain visible');
});

test('settings validate corrupt data, limit names, and keep old volume preferences', () => {
    const p = normalizePreferences({ difficulty: 'godmode', turnSeconds: -5, music: Infinity, sfx: -5, teamNames: ['', 'X'.repeat(80)], muted: 'false', track: 88 });
    assert.equal(p.difficulty, 'regular'); assert.equal(p.turnSeconds, 35); assert.equal(p.music, DEFAULTS.music);
    assert.equal(p.sfx, 0); assert.equal(p.teamNames[0], 'VANGUARD'); assert.equal(p.teamNames[1].length, 16);
    assert.equal(p.muted, false); assert.equal(p.track, 0);
    assert.deepEqual(normalizePreferences({ teamNames: 'oops', unitNames: ['oops'] }).unitNames, DEFAULTS.unitNames);
    assert.deepEqual(normalizePreferences({ teamNames: 'oops' }).teamNames, DEFAULTS.teamNames);
    const old = readPreferences({ getItem: key => key === 'neon_synth_ballistics_settings' ? '{"music":0.4,"sfx":0.7}' : null });
    assert.equal(old.music, 0.4); assert.equal(old.sfx, 0.7);
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const saved = savePreferences(storage, { ...DEFAULTS, reducedMotion: true, muted: true, track: 2 });
    assert.deepEqual(readPreferences(storage), saved); assert.ok(values.has(PREFERENCES_KEY));
    assert.deepEqual(readPreferences({ getItem: () => '{bad' }), normalizePreferences(DEFAULTS));
    assert.doesNotThrow(() => savePreferences({ setItem: () => { throw new Error('Full'); } }, saved));
    assert.equal(readPreferences(undefined, true).reducedMotion, true);
    savePreferences(storage, { ...DEFAULTS, reducedMotion: false });
    assert.equal(readPreferences(storage, true).reducedMotion, false, 'An explicit preference overrides the system default');
});

test('all CPU skills take legal turns, use their arsenal, and finish varied generated matches', () => {
    for (const [index, difficulty] of ['rookie', 'regular', 'veteran'].entries()) {
        const b = new Battle(String(320001 + index * 7919), seeded(index + 4), { difficulty: difficulty as 'rookie' | 'regular' | 'veteran', turnSeconds: 25, suddenDeathRound: 8 });
        const controllers = [new CPUController(), new CPUController()]; let previousTurn = b.turn, turnTicks = 0;
        const used = new Set<number>();
        for (let tick = 0; tick < 120000 && b.phase !== 'over'; tick++) {
            const controls = controllers[b.team].update(b, difficulty as 'rookie' | 'regular' | 'veteran');
            b.step(controls);
            for (const event of b.events.splice(0)) if (event.type === 'shot') used.add(event.value);
            assert.ok(b.units.every(u => Number.isFinite(u.x) && Number.isFinite(u.y) && u.hp >= 0 && u.hp <= 100));
            if (b.turn === previousTurn) turnTicks++; else { previousTurn = b.turn; turnTicks = 0; }
            assert.ok(turnTicks < 3200, `${difficulty} stalled on turn ${b.turn}`);
        }
        assert.equal(b.phase, 'over', `${difficulty} match failed to finish`);
        assert.ok(used.size >= 2, `${difficulty} used only one weapon`);
    }
});

test('mixed weapons, mobility and terrain damage stay finite and resolve across 24 seeded maps', () => {
    for (let scenario = 1; scenario <= 24; scenario++) {
        const random = seeded(scenario * 7919);
        const code = String(scenario * 161803 % 1000000).padStart(6, '0');
        const b = new Battle(code, random, { turnSeconds: 25, suddenDeathRound: 8 });
        let turn = -1, age = 0, weapon = 0, direction = 0;
        for (let tick = 0; tick < 100000 && b.phase !== 'over'; tick++) {
            if (turn !== b.turn) {
                turn = b.turn; age = 0; weapon = Math.floor(random() * 10); direction = random() < 0.5 ? -1 : 1;
                if (!b.equip(weapon)) { weapon = 0; b.equip(0); }
                b.active.elevation = (random() - 0.5) * Math.PI; b.active.facing = random() < 0.5 ? -1 : 1;
            }
            age++;
            if (b.canAct) {
                if (age === 20 && random() < 0.3) b.jump(random() < 0.5);
                if ((weapon === 5 && age === 120) || (weapon === 7 && age === 110)) { b.equip(0); b.fire(3 + random() * 17); }
                else if (age === 45 && weapon !== 5) b.fire(3 + random() * 17, { x: 40 + random() * (WIDTH - 80), y: 150 + random() * 360 });
                else if (b.shotgunShots > 0 && age === 75) b.fire();
            }
            b.step({ left: age < 40 && direction < 0, right: age < 40 && direction > 0, jet: weapon === 5 && age < 90, up: weapon === 7 && age < 100 });
            b.events = [];
            assert.ok(b.units.every(u => Number.isFinite(u.x) && Number.isFinite(u.y) && u.hp >= 0 && u.hp <= 100), `${code}: invalid unit`);
            assert.ok(age < 4000, `${code}: turn ${turn} stalled in ${b.phase}`);
        }
        assert.equal(b.phase, 'over', `${code}: match did not finish`);
    }
});
