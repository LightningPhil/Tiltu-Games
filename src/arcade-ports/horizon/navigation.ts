/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { clamp, type Point } from './flight.ts';

export function clearApproach(origin: Point, candidate: Point, clear: (start: Point, end: Point, padding: number) => boolean) {
    const distance = Math.hypot(candidate.x - origin.x, candidate.y - origin.y, candidate.z - origin.z);
    const fraction = Math.min(1, 25 / Math.max(1, distance));
    const departure = { x: origin.x + (candidate.x - origin.x) * fraction, y: origin.y + (candidate.y - origin.y) * fraction, z: origin.z + (candidate.z - origin.z) * fraction };
    // A pilot beside a wall can depart safely; the rest of the route has room for small corrections.
    return clear(origin, departure, 2.5) && clear(departure, candidate, 10);
}

// Prefer a short turn and a modest climb. Never offer a ring behind an obstructed approach.
export function gateApproach(origin: Point, forward: Point, preferredAltitude: number, practice: boolean, clear: (point: Point) => boolean): Point | null {
    const length = Math.hypot(forward.x, forward.z), fx = length > 0.001 ? forward.x / length : 0, fz = length > 0.001 ? forward.z / length : -1;
    const altitudes = [...new Set([clamp(preferredAltitude, 60, 330), clamp(origin.y + 55, 65, 330), 305, 330])];
    const ranges = practice ? [440, 340, 250] : [560, 440, 320];
    let best: Point | null = null, cost = Infinity;
    for (const range of ranges) for (const angle of [0, -0.18, 0.18, -0.4, 0.4, -0.7, 0.7, -1.05, 1.05, -1.5, 1.5, -2.1, 2.1, Math.PI]) {
        const x = fx * Math.cos(angle) + fz * Math.sin(angle), z = fz * Math.cos(angle) - fx * Math.sin(angle);
        for (const y of altitudes) {
            const candidate = { x: Math.round((origin.x + x * range) / 100) * 100, y, z: Math.round((origin.z + z * range) / 100) * 100 };
            const candidateCost = Math.abs(angle) * 100 + Math.abs(y - origin.y) * 0.55 + Math.abs(range - ranges[0]) * 0.15;
            if (candidateCost < cost && clear(candidate)) { best = candidate; cost = candidateCost; }
        }
    }
    return best;
}
