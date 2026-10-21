import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crashSkier, newSki, newSkiYeti, restoreSki, SKI_CAPTURE_DURATION, skiJumpHeight, stepSki } from '../src/ski.ts';
import { CRASH_DURATION, JOINT, newSkiCrash, skiCrashPose, stepSkiCrash, validSkiCrash } from '../src/ski-ragdoll.ts';
import { freshState, parseState } from '../src/state.ts';
const input = { steer: 0, brake: false, jump: false, fast: false };
const clearSlope = () => { const s = newSki(); s.status = 'skiing'; s.speed = 235; s.objects = []; s.generated = 1000000; return s; };
const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('holding brake stops the skier, then releasing accelerates smoothly downhill again', () => {
  const s = clearSlope();
  for (let n = 0; n < 60; n++) stepSki(s, { ...input, brake: true }, 1 / 30);
  assert.equal(s.speed, 0); const stopped = s.y;
  for (let n = 0; n < 30; n++) stepSki(s, { ...input, brake: true }, 1 / 30);
  assert.equal(s.y, stopped);
  stepSki(s, input, 1 / 30); assert(s.speed > 0 && s.speed < 30);
  for (let n = 0; n < 60; n++) stepSki(s, input, 1 / 30);
  assert(s.speed > 230 && s.speed <= 235); assert(s.y > stopped);
});

test('crash limbs articulate independently, keep bones together and settle on the snow', () => {
  const r = newSkiCrash(300, 500, 300, 60, 1), initial = distance(r.nodes[JOINT.leftHand], r.nodes[JOINT.rightHand]);
  for (let i = 0; i < 60; i++) {
    stepSkiCrash(r, 1 / 120); assert(validSkiCrash(r)); assert(r.nodes.every(n => n.z >= 0 && Number.isFinite(n.x + n.y + n.z)));
    assert(distance(r.nodes[JOINT.head], r.nodes[JOINT.chest]) > 13); assert(distance(r.nodes[JOINT.head], r.nodes[JOINT.chest]) < 18);
  }
  assert(initial - distance(r.nodes[JOINT.leftHand], r.nodes[JOINT.rightHand]) > 10, 'the arms must fold independently; rigid body rotation preserves hand separation');
  assert(r.nodes[JOINT.head].z < 8); assert(r.nodes[JOINT.hip].z < 6); assert(r.loose[1].y > 500);
});
test('ragdoll stepping is stable across frame rates and recovery lifts hands, knees and torso', () => {
  const a = newSkiCrash(300, 500, 280, -120, -1), b = structuredClone(a);
  for (let i = 0; i < 120; i++) stepSkiCrash(a, 1 / 120);
  for (let i = 0; i < 60; i++) stepSkiCrash(b, 1 / 60);
  a.nodes.forEach((n, i) => assert(distance(n, b.nodes[i]) < .005));
  for (let i = 0; i < 162; i++) stepSkiCrash(a, 1 / 120);
  const pose = skiCrashPose(a); assert(pose[JOINT.head].z > 54); assert(pose[JOINT.hip].z > 22); assert(pose[JOINT.leftBoot].z < 3);
});
test('uneven browser frames never turn fractional constraint corrections into explosive crash velocity', () => {
  const frames = [.01668, .0162, .034, .01667, .017, .006], r = newSkiCrash(300, 500, 235, 0, 1);
  let elapsed = 0;
  for (let i = 0; elapsed < 2.4; i++) {
    const dt = frames[i % frames.length]; elapsed += dt; stepSkiCrash(r, dt);
    assert(validSkiCrash(r)); assert(r.nodes.every(n => Math.abs(n.y - 500) < 180 && n.z < 100));
  }
  const stable = newSkiCrash(300, 500, 235, 0, 1);
  for (let i = 0; i < Math.floor((elapsed + 1e-9) * 120); i++) stepSkiCrash(stable, 1 / 120);
  r.nodes.forEach((n, i) => assert(distance(n, stable.nodes[i]) < .005));
});
test('an obstacle starts one crash, spends time getting up and grants a brief recovery grace period', () => {
  const s = clearSlope(); s.score = 500; s.objects = [{ kind: 'rock', x: 300, y: 10, passed: false }]; stepSki(s, input, .05);
  assert(s.crash); assert.equal(s.score, 450); assert.equal(s.tumble, CRASH_DURATION); assert(s.objects[0].passed);
  let frames = 0; while (s.crash && frames++ < 70) stepSki(s, input, .05);
  assert(frames >= 47); assert.equal(s.crash, null); assert.equal(s.tumble, 0); assert.equal(s.score, 450); assert(s.grace > .5);
});
test('ramps launch at the downhill lip, and side or downhill entry cannot trigger them', () => {
  const s = clearSlope(); s.y = 100; s.objects = [{ kind: 'ramp', x: 300, y: 130, passed: false }];
  stepSki(s, input, .05); assert.equal(s.jump, 0); stepSki(s, input, .05); assert.equal(s.jump, 0); stepSki(s, input, .05);
  assert.equal(s.jumpDuration, 1.6); assert.equal(s.jumpPeak, 78); assert(s.jump > 1.5); assert(s.objects[0].passed);
  for (let i = 0; i < 14; i++) stepSki(s, input, .05); assert(skiJumpHeight(s) > 70);
  const below = clearSlope(); below.y = 150; below.objects = [{ kind: 'ramp', x: 300, y: 130, passed: false }]; stepSki(below, input, .05); assert.equal(below.jump, 0);
  const side = clearSlope(); side.objects = [{ kind: 'ramp', x: 350, y: 10, passed: false }]; stepSki(side, input, .05); assert.equal(side.jump, 0);
});
test('collision clearance follows actual jump height; a failed landing earns no trick points', () => {
  const rock = clearSlope(); rock.jump = .6; rock.jumpDuration = 1.1; rock.jumpPeak = 36; rock.objects = [{ kind: 'rock', x: 300, y: 10, passed: false }]; stepSki(rock, input, .05); assert.equal(rock.crash, null);
  const tree = clearSlope(); tree.jump = .6; tree.jumpDuration = 1.1; tree.jumpPeak = 36; tree.objects = [{ kind: 'tree', x: 300, y: 10, passed: false }]; stepSki(tree, input, .05); assert(tree.crash);
  const landing = clearSlope(); landing.score = 500; landing.jump = .02; landing.objects = [{ kind: 'rock', x: 300, y: 10, passed: false }]; stepSki(landing, input, .05); assert(landing.crash); assert.equal(landing.score, 450);
});
test('the yeti telegraphs a leap before catching a skier who holds the same line', () => {
  const s = clearSlope(); s.y = 6000; const phases = new Set<string>();
  for (let i = 0; i < 240 && s.status === 'skiing'; i++) { stepSki(s, input, .05); if (s.yeti) phases.add(s.yeti.phase); }
  for (const phase of ['announce', 'chase', 'windup', 'pounce', 'feast']) assert(phases.has(phase), phase);
  assert.equal(s.status, 'caught'); assert.equal(s.captureAge, 0);
  const elapsed = s.elapsed, y = s.y;
  for (let i = 0; i < 80; i++) stepSki(s, input, .05);
  assert.equal(s.captureAge, SKI_CAPTURE_DURATION); assert.equal(s.elapsed, elapsed); assert.equal(s.y, y); assert(restoreSki(s));
});
test('changing line after takeoff dodges the yeti; its leap target stays fixed', () => {
  const s = clearSlope(); s.y = 6000; s.yeti = newSkiYeti(s); s.yeti.phase = 'windup'; s.yeti.y = s.y - 70;
  for (let i = 0; i < 20 && s.yeti.phase === 'windup'; i++) stepSki(s, input, .05);
  assert.equal(s.yeti.phase, 'pounce'); const target = s.yeti.targetX;
  for (let i = 0; i < 20 && s.yeti.phase === 'pounce'; i++) { stepSki(s, { ...input, steer: 1 }, .05); assert.equal(s.yeti.targetX, target); }
  assert.equal(s.status, 'skiing'); assert.equal(s.yeti.phase, 'recover'); assert(Math.abs(s.x - target) > 38);
});
test('fast skiing outruns the yeti and a high ramp jump can evade a pounce', () => {
  const fast = clearSlope(); fast.y = 6000;
  for (let i = 0; i < 200; i++) stepSki(fast, { ...input, fast: true }, .05);
  assert.equal(fast.status, 'skiing'); assert(fast.y - fast.yeti!.y > 600);
  const air = clearSlope(); air.y = 6000; air.yeti = newSkiYeti(air); Object.assign(air.yeti, { phase: 'pounce', fromX: 300, fromY: air.y - 80, targetX: 300, targetY: air.y + 235 * .65 }); air.jump = air.jumpDuration = 1.6; air.jumpPeak = 78;
  for (let i = 0; i < 14; i++) stepSki(air, input, .05);
  assert.equal(air.status, 'skiing'); assert.equal(air.yeti.phase, 'recover');
});
test('mid-crash and mid-pounce saves round trip, while malformed joints and jump timing recover safely', () => {
  const s = clearSlope(); crashSkier(s, -1); for (let i = 0; i < 9; i++) stepSki(s, input, .05);
  const state = freshState(); state.ski = s; assert.deepEqual(parseState(JSON.stringify({ version: 1, ...state })).ski, s);
  const bad = structuredClone(s); bad.crash!.nodes[0].z = NaN; assert.equal(restoreSki(bad), null);
  const pounce = clearSlope(); pounce.y = 6000; pounce.yeti = newSkiYeti(pounce); pounce.yeti.phase = 'pounce'; pounce.yeti.targetX = 410; pounce.yeti.targetY = 6180; assert.deepEqual(restoreSki(structuredClone(pounce)), pounce);
  pounce.jump = 1.6; pounce.jumpDuration = .5; assert.equal(restoreSki(pounce), null);
});
test('older SkiFree saves migrate without discarding records or trapping a completed capture', () => {
  const s = clearSlope(); s.y = 6200; s.best.distance = 2066;
  const old = structuredClone(s) as Record<string, unknown>; for (const key of ['crash', 'grace', 'jumpDuration', 'jumpPeak', 'captureAge']) delete old[key]; old.yeti = { x: 300, y: 6160 }; old.status = 'caught';
  const loaded = restoreSki(old)!; assert(loaded); assert.equal(loaded.captureAge, SKI_CAPTURE_DURATION); assert.equal(loaded.yeti?.phase, 'feast'); assert.equal(loaded.best.distance, 2066);
});
