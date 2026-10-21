/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { FLIGHT, type Difficulty, type Point } from './flight.ts';
import type { Mode } from './game.ts';

export function patrolPlan(options: { mode: Mode; sector: number; difficulty: Difficulty; slots: number; boss: boolean }, random: () => number) {
    const { mode, sector, difficulty, slots, boss } = options;
    const desired = mode === 'practice' || sector === 0 || difficulty === 'relaxed' || boss ? 1 : difficulty === 'ace' || sector >= 4 ? 3 : 2;
    const count = Math.max(0, Math.min(desired, Math.floor(slots))), mirror = random() < 0.5 ? -1 : 1;
    return Array.from({ length: count }, (_, i) => {
        const roll = random();
        const type = mode === 'practice' || sector === 0 ? 0 : count === 1 ? roll < 0.55 ? 1 : roll < 0.75 ? 0 : 2
            : i === 0 ? roll < 0.45 ? 2 : 1 : roll < 0.18 ? 0 : 1;
        return { type, range: 540 + random() * 180 + (i % 2) * 30,
            lateral: count === 1 ? (random() - 0.5) * 230 : ((i - (count - 1) / 2) * 125 + (random() - 0.5) * 18) * mirror };
    });
}

export type Attack = { name: string; charge: number; cooldown: number; speed: number; shots: { yaw: number; delay: number }[] };
export function cannonStep(cooldown: number, dt: number, trigger: boolean) {
    const remaining = cooldown - dt;
    if (trigger && remaining <= 0) return { fire: true, cooldown: (cooldown > 0 ? remaining : 0) + FLIGHT.fireInterval };
    return { fire: false, cooldown: Math.max(0, remaining) };
}
// Attacks commit to a direction at the warning. Bursts never track the pilot between shots.
export function attackPlan(type: number, boss: boolean, health: number, cycle: number, difficulty: Difficulty): Attack {
    const warning = difficulty === 'relaxed' ? 1.2 : difficulty === 'ace' ? 0.9 : 1;
    if (boss) {
        const furious = health <= 0.5, burst = cycle % 2 === 1;
        return { name: burst ? 'RAPID BURST' : furious ? 'WIDE FAN' : 'FAN VOLLEY', charge: (furious ? 1.15 : 1.3) * warning,
            cooldown: furious ? 2.5 : 3.2, speed: 205,
            shots: burst ? Array.from({ length: furious ? 4 : 3 }, (_, i) => ({ yaw: 0, delay: i * 0.19 }))
                : (furious ? [-0.24, -0.12, 0, 0.12, 0.24] : [-0.14, 0, 0.14]).map(yaw => ({ yaw, delay: 0 })) };
    }
    return type === 2
        ? { name: 'FAN VOLLEY', charge: 1.15 * warning, cooldown: 5, speed: 180, shots: [-0.11, 0, 0.11].map(yaw => ({ yaw, delay: 0 })) }
        : { name: 'DOUBLE TAP', charge: warning, cooldown: 5.5, speed: 190, shots: [{ yaw: 0, delay: 0 }, { yaw: 0, delay: 0.25 }] };
}

export function closestApproach(start: Point, end: Point) {
    const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
    const lengthSq = dx * dx + dy * dy + dz * dz;
    const fraction = lengthSq ? Math.max(0, Math.min(1, -(start.x * dx + start.y * dy + start.z * dz) / lengthSq)) : 0;
    return { fraction, distance: Math.hypot(start.x + dx * fraction, start.y + dy * fraction, start.z + dz * fraction) };
}

