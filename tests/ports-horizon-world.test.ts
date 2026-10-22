import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { City } from '../src/arcade-ports/horizon/city.ts';
import { createCraft, animateCraft, disposeObject } from '../src/arcade-ports/horizon/visuals.ts';
import { createRun, damageRun, tickRun, rankRun, parseSettings } from '../src/arcade-ports/horizon/game.ts';

test('district streaming is bounded, deterministic and disposes the complete environment', () => {
    const scene = new THREE.Scene(), city = new City(scene, 78231), origin = new THREE.Vector3(0, 115, 0);
    city.update(origin); assert.equal(city.chunks.size, 49);
    const first = city.query(origin, origin, 400).map(record => [record.id, ...record.box.min.toArray(), ...record.box.max.toArray()]);
    city.update(new THREE.Vector3(4000, 140, -4000), 30); assert.equal(city.chunks.size, 49);
    city.update(origin, 60);
    assert.deepEqual(city.query(origin, origin, 400).map(record => [record.id, ...record.box.min.toArray(), ...record.box.max.toArray()]), first);
    const camera = new THREE.PerspectiveCamera(74, 16 / 9, .1, 4500); camera.position.copy(origin); camera.updateMatrixWorld(); city.cull(camera);
    const visible = [...city.chunks.values()].filter(chunk => chunk.group.visible).length;
    assert.ok(visible > 0 && visible < 49, 'districts outside the view do not add draw calls');
    city.dispose(); assert.equal(scene.children.length, 0); assert.equal(city.chunks.size, 0);
});

test('stepped roofs have exact collision space and AI clearance includes their upper tiers', () => {
    const scene = new THREE.Scene(), city = new City(scene, 78231); city.update(new THREE.Vector3(0, 115, 0));
    const top = [...city.chunks.values()].flatMap(chunk => chunk.buildings).find(building => building.id.endsWith(':2'))!;
    assert.ok(top); const p = top.box.getCenter(new THREE.Vector3());
    assert.ok(city.segmentHit(p.clone().add(new THREE.Vector3(-40, 0, 0)), p.clone().add(new THREE.Vector3(40, 0, 0))));
    const outside = p.clone(); outside.x = top.box.max.x + 2;
    assert.equal(city.segmentHit(outside, outside.clone().add(new THREE.Vector3(0, 1, 0))), null, 'air beside the narrow upper tier is flyable');
    const clearance = city.clearance(p.clone().add(new THREE.Vector3(-40, 0, 0)), p.clone().add(new THREE.Vector3(40, 0, 0)), 0, 17);
    assert.ok(clearance >= top.height + 17, 'flattening a route to the ground must not omit elevated building sections'); city.dispose();
});

test('engine flames and the Sentinel shield cannot inflate solid aircraft hit volumes', () => {
    const scene = new THREE.Scene();
    for (const boss of [false, true]) {
        const craft = createCraft(1, boss); scene.add(craft); craft.position.set(50, 120, -200); craft.rotation.y = .7; craft.updateMatrixWorld(true);
        const before = craft.userData.solidBox.clone().applyMatrix4(craft.matrixWorld);
        animateCraft(craft, .3, true); craft.updateMatrixWorld(true);
        const after = craft.userData.solidBox.clone().applyMatrix4(craft.matrixWorld); assert.ok(before.equals(after));
        assert.ok(craft.userData.solidBox.max.x < (boss ? 46 : 16));
        assert.ok(craft.userData.solidBox.min.z > (boss ? -34 : -11));
        disposeObject(scene, craft);
    }
});

test('Sunset Cruise has no deadline or gunfire damage, but a collision ends the flight', () => {
    const run = createRun('cruise', 'ace', 1); run.invulnerable = 0; tickRun(run, 999);
    assert.equal(run.outcome, 'flying'); assert.equal(damageRun(run, 1000), false); assert.equal(run.shields, 100); assert.equal(rankRun(run), 'FREE FLIGHT');
    assert.equal(damageRun(run, 1, true), true); assert.equal(run.outcome, 'crashed');
    const settings = parseSettings('{"mode":"cruise","quality":"bad","view":"chase","musicVolume":9,"effectsVolume":-1}');
    assert.equal(settings.mode, 'cruise'); assert.equal(settings.quality, 'cinematic'); assert.equal(settings.view, 'chase'); assert.equal(settings.musicVolume, 1); assert.equal(settings.effectsVolume, 0);
    assert.equal(parseSettings(null, false, true).quality, 'performance');
});

test('retro craft use far fewer faces with the same size and solid hit volumes', () => {
    const triangles = (object: any) => { let count = 0; object.traverse(part => { if (part.isMesh) count += (part.geometry.index?.count || part.geometry.attributes.position.count) / 3; }); return count; };
    const scene = new THREE.Scene();
    for (const boss of [false, true]) for (const type of [0, 1, 2]) {
        const neon = createCraft(type, boss, 'neon'), retro = createCraft(type, boss, 'retro');
        assert.ok(retro.userData.solidBox.equals(neon.userData.solidBox)); assert.ok(retro.scale.equals(neon.scale));
        assert.ok(triangles(retro) < triangles(neon) * .3);
        disposeObject(scene, neon); disposeObject(scene, retro);
    }
});

test('visual style changes preserve district collision geometry and remove roof accessories', () => {
    const scene = new THREE.Scene(), city = new City(scene, 78231, 'retro'); city.update(new THREE.Vector3(0, 115, 0));
    const records = [...city.chunks.values()].flatMap(chunk => chunk.buildings).map(b => [b.id, ...b.box.min.toArray(), ...b.box.max.toArray()]);
    assert.ok([...city.chunks.values()].every(chunk => !chunk.details.visible));
    city.setStyle('neon'); assert.ok([...city.chunks.values()].every(chunk => chunk.details.visible));
    assert.deepEqual([...city.chunks.values()].flatMap(chunk => chunk.buildings).map(b => [b.id, ...b.box.min.toArray(), ...b.box.max.toArray()]), records);
    city.setStyle('retro'); assert.equal(city.bodyMaterial.uniforms.retro.value, 1); city.dispose(); assert.equal(scene.children.length, 0);
});
