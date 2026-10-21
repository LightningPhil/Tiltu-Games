/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import type { Run } from './game.ts';

export const LESSONS = [
    { title: 'SMALL CORRECTIONS', detail: 'Nudge left, then right. Tap A / D, use the left stick, or move the mouse.', goal: 'Turn a little in both directions' },
    { title: 'FIND THE HORIZON', detail: 'Nudge the nose up, then down. W / S, arrows, stick, or mouse all work.', goal: 'Pitch up, then down' },
    { title: 'LEVEL THE WINGS', detail: 'Press R, gamepad X, middle mouse, or LEVEL. Recover pitch and bank while keeping your heading. Pitch or bank input overrides recovery.', goal: 'Use level recovery and let the wings settle' },
    { title: 'SLOW THE HUNT', detail: 'Hold Ctrl, LT, or BRAKE. Braking also makes steering more precise.', goal: 'Brake below 200 km/h for a moment' },
    { title: 'LINE UP THE SHOT', detail: 'Aim at the white lead diamond. Hold Space, left mouse, RT, or FIRE to clear two scouts.', goal: 'Destroy two targets' },
    { title: 'LIGHT THE AFTERBURNER', detail: 'Hold Shift, RB, or BOOST. Watch the energy meter, then release to recharge.', goal: 'Boost for one second' },
    { title: 'THREAD THE GATE', detail: 'Fly through the cyan ring. Use gentle turns and braking to line up your approach.', goal: 'Collect one recharge gate' },
    { title: 'KEEP AN EXIT', detail: 'With 45 energy ready, press F, right mouse, B, or EMP. The pulse clears nearby shots and disrupts hostiles.', goal: 'Release an EMP pulse' },
] as const;
export type Lesson = { step: number; left: number; right: number; up: number; down: number; held: number; baseline: number; levelRequested: boolean };
export function createLesson(): Lesson { return { step: 0, left: 0, right: 0, up: 0, down: 0, held: 0, baseline: 0, levelRequested: false }; }
export type LessonInput = { yaw: number; pitch: number; brake: boolean; boost: boolean; speed: number; level?: boolean; levelled?: boolean };
export function tickLesson(lesson: Lesson, run: Run, input: LessonInput, dt: number) {
    if (run.mode !== 'practice' || lesson.step >= LESSONS.length) return false;
    let complete = false;
    switch (lesson.step) {
        case 0:
            lesson.left += Math.max(0, input.yaw); lesson.right += Math.max(0, -input.yaw);
            complete = lesson.left >= 0.04 && lesson.right >= 0.04; break;
        case 1:
            lesson.up += Math.max(0, input.pitch); lesson.down += Math.max(0, -input.pitch);
            complete = lesson.up >= 0.04 && lesson.down >= 0.04; break;
        case 2:
            if (input.level) lesson.levelRequested = true;
            if (lesson.levelRequested && input.levelled) lesson.held += dt; else lesson.held = 0;
            complete = lesson.held >= 0.35; break;
        case 3:
            if (input.brake && input.speed < 55) lesson.held += dt;
            complete = lesson.held >= 0.6; break;
        case 4: complete = run.kills >= lesson.baseline + 2; break;
        case 5:
            if (input.boost) lesson.held += dt;
            complete = lesson.held >= 1; break;
        case 6: complete = run.gates > lesson.baseline; break;
        case 7: complete = run.pulses > lesson.baseline; break;
    }
    if (!complete) return false;
    lesson.step++; lesson.held = 0;
    lesson.baseline = lesson.step === 4 ? run.kills : lesson.step === 6 ? run.gates : lesson.step === 7 ? run.pulses : 0;
    return true;
}
export function lessonProgress(lesson: Lesson, run: Run) {
    switch (lesson.step) {
        case 0: return (Math.min(1, lesson.left / 0.04) + Math.min(1, lesson.right / 0.04)) / 2;
        case 1: return (Math.min(1, lesson.up / 0.04) + Math.min(1, lesson.down / 0.04)) / 2;
        case 2: return Math.min(1, lesson.held / 0.35);
        case 3: return Math.min(1, lesson.held / 0.6);
        case 4: return Math.min(1, (run.kills - lesson.baseline) / 2);
        case 5: return Math.min(1, lesson.held);
        case 6: return run.gates > lesson.baseline ? 1 : 0;
        case 7: return run.pulses > lesson.baseline ? 1 : 0;
        default: return 1;
    }
}
