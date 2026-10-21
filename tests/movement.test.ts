import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draughtsMotion, MOTION } from '../src/movement.ts';
test('multi-jump animation visits every landing and removes each capture after its own jump', () => {
  const m = { from: 40, path: [26,12,30], captures: [33,19,21] };
  assert.deepEqual(draughtsMotion(m), [{from:40,to:26,captures:[33]},{from:26,to:12,captures:[19]},{from:12,to:30,captures:[21]}]);
  assert.deepEqual(draughtsMotion(m, 2), [{from:12,to:30,captures:[21]}]);
});
test('a quiet move has no capture and all animation speeds include a visible landing and reply pause', () => {
  assert.deepEqual(draughtsMotion({from:40,path:[33],captures:[]}), [{from:40,to:33,captures:[]}]);
  assert(MOTION.steady.travel >= 600); assert(MOTION.steady.reply >= 700);
  assert(MOTION.relaxed.travel > MOTION.steady.travel && MOTION.steady.travel > MOTION.quick.travel);
  assert(Object.values(MOTION).every(t=>t.landing>0));
});
