import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Effects } from '../src/arcade-ports/horizon/visuals.ts';

test('large explosions share one bounded particle draw and preserve per-particle colors', () => {
    const scene = new THREE.Scene(), effects = new Effects(scene), origin = new THREE.Vector3(1, 2, 3);
    effects.burst(origin, 0xff0000, 200); effects.burst(origin, 0x00ffff, 500); effects.render();
    assert.equal(effects.particles.length, 420); assert.equal(effects.batch.count, 420);
    assert.equal(scene.children.length, 1, 'the explosion does not create a mesh per particle');
    const color = new THREE.Color(); effects.batch.getColorAt(0, color); assert.equal(color.getHex(), 0xff0000);
    effects.batch.getColorAt(419, color); assert.equal(color.getHex(), 0x00ffff);
    effects.update(0.7); effects.render(); assert.equal(effects.batch.count, 0);
    effects.burst(origin, 0xffffff, 10, true); effects.render(); assert.equal(effects.batch.count, 10);
    effects.clear(); effects.render(); assert.equal(effects.batch.count, 0); assert.equal(scene.children.length, 1);
});
