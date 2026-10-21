import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/arcade-ports/horizon/game.ts';
import { LESSONS, createLesson, tickLesson, lessonProgress } from '../src/arcade-ports/horizon/training.ts';

const idle = { yaw: 0, pitch: 0, brake: false, boost: false, speed: 108 };
test('Flight School teaches one action at a time and requires fresh kills, gates, and pulses', () => {
    const run = createRun('practice', 'arcade', 8), lesson = createLesson();
    run.kills = 8; run.gates = 3; run.pulses = 1;
    assert.equal(tickLesson(lesson, run, idle, 1), false);
    tickLesson(lesson, run, { ...idle, yaw: 0.04 }, 0.2); assert.equal(lessonProgress(lesson, run), 0.5);
    assert.equal(tickLesson(lesson, run, { ...idle, yaw: -0.04 }, 0.2), true); assert.equal(lesson.step, 1);
    tickLesson(lesson, run, { ...idle, pitch: 0.05 }, 0.2); tickLesson(lesson, run, { ...idle, pitch: -0.05 }, 0.2);
    assert.equal(lesson.step, 2);
    assert.equal(tickLesson(lesson, run, { ...idle, levelled: true }, 1), false, 'recovery must be deliberately requested');
    tickLesson(lesson, run, { ...idle, level: true, levelled: false }, 0.5);
    tickLesson(lesson, run, { ...idle, levelled: true }, 0.35); assert.equal(lesson.step, 3);
    assert.equal(tickLesson(lesson, run, { ...idle, brake: true, speed: 90 }, 1), false, 'the ship must actually slow down');
    tickLesson(lesson, run, { ...idle, brake: true, speed: 43 }, 0.6); assert.equal(lesson.step, 4);
    assert.equal(tickLesson(lesson, run, idle, 1), false, 'kills before the lesson cannot skip shooting practice');
    run.kills++; tickLesson(lesson, run, idle, 1); assert.equal(lessonProgress(lesson, run), 0.5);
    run.kills++; tickLesson(lesson, run, idle, 1); assert.equal(lesson.step, 5);
    tickLesson(lesson, run, { ...idle, boost: true }, 1); assert.equal(lesson.step, 6);
    assert.equal(tickLesson(lesson, run, idle, 1), false, 'a previously collected gate is not the new exercise');
    run.gates++; tickLesson(lesson, run, idle, 1); assert.equal(lesson.step, 7);
    assert.equal(tickLesson(lesson, run, idle, 1), false, 'a rejected or old EMP does not complete the lesson');
    run.pulses++; tickLesson(lesson, run, idle, 1); assert.equal(lesson.step, LESSONS.length);
    assert.equal(lessonProgress(lesson, run), 1); assert.equal(tickLesson(lesson, run, idle, 100), false);
});
test('mission and endless inputs cannot advance the practice coach', () => {
    for (const mode of ['mission', 'endless'] as const) {
        const run = createRun(mode, 'arcade', 8), lesson = createLesson();
        for (const yaw of [0.1, -0.1]) assert.equal(tickLesson(lesson, run, { ...idle, yaw }, 1), false);
        assert.equal(lesson.step, 0);
    }
});
