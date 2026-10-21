import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle, WIDTH, HEIGHT, TURN_TICKS, RETREAT_TICKS } from '../src/arcade-ports/ballistics/game.ts';

function advance(b: Battle, ticks: number) { for (let i = 0; i < ticks; i++) b.step(); }
function flatBattle() {
    const b = new Battle('500000', () => 0.5);
    b.terrain.pixels.fill(0);
    b.terrain.pixels.fill(1, 500 * WIDTH);
    for (const u of b.units) { u.x = 100 + u.id * 180; u.y = 490; u.vx = 0; u.vy = 0; u.grounded = true; }
    advance(b, 10);
    b.time = TURN_TICKS;
    b.events = [];
    return b;
}
function seeded(seed: number) { return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; }; }

test('random landscapes give all six units safe, distinct spawn shelves', () => {
    for (let seed = 1; seed <= 20; seed++) {
        const b = new Battle(String(seed).padStart(6, '0'), seeded(seed));
        advance(b, 90);
        assert.ok(b.units.every(u => u.grounded && u.hp === 100 && !u.dead));
        assert.equal(new Set(b.units.map(u => u.x)).size, 6);
    }
});

test('35-second turns alternate teams and rotate through the living squad', () => {
    const b = flatBattle();
    const order = [b.activeId];
    for (let i = 0; i < 5; i++) {
        advance(b, TURN_TICKS + 50);
        order.push(b.activeId);
        assert.equal(b.team, (i + 1) % 2);
    }
    assert.deepEqual(order, [0, 1, 2, 3, 4, 5]);
});

test('squad rotation skips casualties and allows selection only before moving', () => {
    const b = flatBattle();
    assert.equal(b.switchUnit(), true);
    assert.equal(b.activeId, 2);
    b.step({ right: true });
    assert.equal(b.switchUnit(), false);
    b.damage(b.units[4], 100);
    b.skip(); advance(b, 60); b.skip(); advance(b, 60);
    assert.equal(b.activeId, 0);
});

test('one shot starts a four-second retreat with movement but no second attack', () => {
    const b = flatBattle();
    b.equip(3); b.active.elevation = 0;
    const x = b.active.x;
    assert.equal(b.fire(), true);
    assert.equal(b.fire(), false);
    assert.equal(b.equip(2), false);
    for (let i = 0; i < 60; i++) b.step({ right: true });
    assert.ok(b.active.x > x + 40);
    assert.equal(b.phase, 'retreat');
    assert.equal(b.retreat, RETREAT_TICKS - 60);
    advance(b, 500);
    assert.equal(b.turn, 2);
});

test('limited ammunition belongs to the team across unit changes', () => {
    const b = flatBattle();
    b.equip(3); b.fire(); advance(b, 350);
    b.skip(); advance(b, 60);
    assert.equal(b.activeId, 2);
    assert.equal(b.inventories[0][3], 3);
    b.inventories[0][2] = 0;
    assert.equal(b.equip(2), false);
});

test('grenades bounce without carving terrain until their chosen fuse expires', () => {
    const b = flatBattle();
    const p = b.projectile('grenade', 450, 475, 0, 4, 120);
    b.projectiles.push(p);
    let bounced = false;
    for (let i = 0; i < 119; i++) { b.step(); if (p.vy < 0) bounced = true; }
    assert.ok(bounced);
    assert.equal(b.terrain.revision, 0);
    assert.equal(p.active, true);
    b.step();
    assert.equal(p.active, false);
    assert.equal(b.terrain.revision, 1);
});

test('cluster grenades create five timed fragments and resolve all explosions', () => {
    const b = flatBattle();
    b.projectiles.push(b.projectile('cluster', 450, 470, 0, 0, 1));
    b.step();
    assert.equal(b.projectiles.length, 5);
    assert.ok(b.projectiles.every(p => p.kind === 'bomblet'));
    advance(b, 100);
    assert.equal(b.projectiles.length, 0);
    assert.equal(b.terrain.revision, 6);
});

test('long fuses keep the current turn resolving after the retreat ends', () => {
    const b = flatBattle();
    b.equip(1); b.fuse = 5; b.active.elevation = Math.PI / 2; b.fire(2);
    advance(b, RETREAT_TICKS + 1);
    assert.equal(b.turn, 1);
    assert.equal(b.phase, 'resolving');
    assert.equal(b.projectiles.length, 1);
    advance(b, 250);
    assert.equal(b.turn, 2);
});

test('swept projectile collision catches thin walls at high speeds', () => {
    const b = flatBattle();
    for (let y = 0; y < HEIGHT; y++) b.terrain.pixels[y * WIDTH + 200] = 1;
    const p = b.projectile('rocket', 170, 200, 50, 0, 0);
    b.projectiles.push(p); b.step();
    assert.equal(p.active, false);
    assert.ok(Math.abs(p.x - 200) < 2);
    assert.equal(b.terrain.revision, 1);
});

test('wind affects rockets but leaves grenade throws unchanged', () => {
    const b = flatBattle();
    b.wind = 0.02;
    const rocket = b.projectile('rocket', 500, 150, 3, -3, 0);
    const grenade = b.projectile('grenade', 500, 150, 3, -3, 180);
    b.projectiles.push(rocket, grenade); advance(b, 20);
    assert.ok(rocket.x > grenade.x + 3);
});

test('blast damage affects allies, carves ground, and knocks units into the air', () => {
    const b = flatBattle();
    const u = b.active;
    b.explode(u.x + 15, u.y + 4, 55, 48);
    assert.ok(u.hp < 100);
    assert.ok(u.vx < 0 && u.vy < 0 && !u.grounded);
    assert.equal(b.terrain.solid(u.x + 15, 501), false);
    assert.ok(b.events.some(e => e.type === 'damage'));
});

test('jumping and backflipping leave the ground in opposite directions', () => {
    const b = flatBattle();
    const y = b.active.y;
    b.jump(); b.step();
    assert.ok(b.active.y < y && b.active.vx > 0);
    const c = flatBattle(); c.jump(true); c.step();
    assert.ok(c.active.y < y && c.active.vx < 0);
    assert.equal(c.switchUnit(), false);
});

test('hard landings deal fall damage; lava kills immediately', () => {
    const b = flatBattle();
    const u = b.units[2]; u.y = 200; u.vy = 12; u.grounded = false;
    advance(b, 80);
    assert.ok(u.hp < 100 && u.hp >= 60 && u.grounded);
    u.y = b.lava - 8; b.step();
    assert.equal(u.hp, 0); assert.equal(u.dead, true);
});

test('jetpack use consumes one pack per turn, preserves an attack, and cannot refill fuel by switching', () => {
    const b = flatBattle();
    b.equip(5);
    for (let i = 0; i < 20; i++) b.step({ jet: true });
    assert.equal(b.inventories[0][5], 1);
    assert.ok(b.active.fuel < 90);
    assert.equal(b.switchUnit(), false);
    b.equip(0); b.equip(5); b.step({ jet: true });
    assert.equal(b.inventories[0][5], 1);
    b.equip(0); assert.equal(b.fire(6), true);
});

test('teleport rejects lava or occupied landing spots without consuming a turn', () => {
    const b = flatBattle(); b.equip(6);
    assert.equal(b.fire(0, { x: 400, y: b.lava }), false);
    assert.equal(b.fire(0, { x: b.units[1].x, y: 300 }), false);
    assert.equal(b.inventories[0][6], 2);
    assert.equal(b.phase, 'aim');
    assert.equal(b.fire(0, { x: 400, y: 300 }), true);
    assert.equal(b.active.x, 400);
    assert.equal(b.inventories[0][6], 1);
    assert.equal(b.phase, 'retreat');
});

test('air strike creates five delayed bombs and consumes shared ammunition', () => {
    const b = flatBattle(); b.equip(4);
    assert.equal(b.fire(), false);
    assert.equal(b.fire(0, { x: 450, y: 400 }), true);
    assert.equal(b.projectiles.length, 5);
    assert.deepEqual(b.projectiles.map(p => p.delay), [0, 12, 24, 36, 48]);
    assert.equal(b.inventories[0][4], 0);
    advance(b, 600);
    assert.equal(b.projectiles.length, 0);
    assert.equal(b.turn, 2);
});

test('instant laser beams need no charge and hit the first unit or terrain', () => {
    const b = flatBattle(); b.equip(3); b.active.elevation = 0;
    b.startCharge(); assert.equal(b.charging, false);
    b.fire();
    assert.equal(b.units[1].hp, 70);
    assert.equal(b.units[2].hp, 100);
    const c = flatBattle(); c.equip(3); c.active.elevation = 0;
    for (let y = 450; y < 500; y++) c.terrain.pixels[y * WIDTH + 200] = 1;
    c.fire(); assert.equal(c.units[1].hp, 100); assert.equal(c.terrain.revision, 1);
});

test('supply crates heal and replenish only the collecting team', () => {
    const b = flatBattle(); b.active.hp = 50;
    b.crates.push({ x: b.active.x, y: b.active.y, vy: 0, kind: 'health' }); b.step();
    assert.equal(b.active.hp, 75);
    b.crates.push({ x: b.active.x, y: b.active.y, vy: 0, kind: 'ammo' }); b.step();
    assert.equal(b.inventories[0][2], 4); assert.equal(b.inventories[0][3], 6);
    assert.equal(b.inventories[1][2], 3); assert.equal(b.crates.length, 0);
});

test('sudden death raises lava once per round from round 12', () => {
    const b = flatBattle();
    b.turn = 22; b.startTurn(0); assert.equal(b.round, 12); assert.equal(b.lava, 624);
    b.startTurn(1); assert.equal(b.lava, 624);
    b.startTurn(0); assert.equal(b.lava, 606);
});

test('simultaneous elimination produces a draw after the battlefield settles', () => {
    const b = flatBattle();
    for (const u of b.units) { u.x = 500; u.y = 490; }
    b.explode(500, 490, 70, 200); advance(b, 100);
    assert.equal(b.phase, 'over'); assert.equal(b.winner, -1);
});

test('CPU chooses a shot that damages enemies and actually completes its turn', () => {
    const b = flatBattle(); b.startTurn(1);
    const plan = b.planCPUShot();
    assert.ok(plan.score > 20);
    b.active.facing = plan.facing; b.active.elevation = plan.elevation;
    assert.equal(b.fire(plan.power), true);
    advance(b, 500);
    assert.ok(b.teamHealth(0) < 300);
    assert.equal(b.turn, 3);
});

test('seeded CPU matches finish without stuck projectiles or turn races', () => {
    for (let seed = 1; seed <= 3; seed++) {
        const b = new Battle(String(seed).padStart(6, '0'), seeded(seed));
        for (let turn = 0; turn < 90 && b.phase !== 'over'; turn++) {
            const plan = b.planCPUShot();
            b.active.facing = plan.facing; b.active.elevation = plan.elevation;
            b.fire(plan.power);
            const oldTurn = b.turn;
            for (let tick = 0; tick < 1800 && b.turn === oldTurn && b.phase !== 'over'; tick++) b.step();
            assert.ok(b.phase === 'over' || b.turn === oldTurn + 1, `Seed ${seed}, turn ${oldTurn} stalled`);
            assert.ok(b.units.every(u => Number.isFinite(u.x) && Number.isFinite(u.y) && u.hp >= 0));
        }
        assert.equal(b.phase, 'over', `Seed ${seed} failed to finish`);
    }
});

