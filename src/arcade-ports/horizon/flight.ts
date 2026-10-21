/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
// Units are seconds, world units, and radians. These routines are independent of rendering.
export const FLIGHT = {
    pitchRate: 0.9, yawRate: 1.05, rollRate: 1.65,
    acceleration: 3.8, braking: 12, rollAcceleration: 6, rollBraking: 18,
    laserSpeed: 1450, laserRange: 1250, fireInterval: 0.16,
    assistAngle: Math.PI / 60, // A three-degree cone; never turns the ship for the player.
    comboWindow: 7,
} as const;

export const DIFFICULTIES = {
    relaxed: { label: 'RELAXED', speed: 88, spawnInterval: 3.0, damage: 22, trafficSpeed: 0.8, projectileDamage: 8, missionTime: 240, bossHealth: 26 },
    arcade: { label: 'ARCADE', speed: 108, spawnInterval: 2.5, damage: 28, trafficSpeed: 1, projectileDamage: 12, missionTime: 190, bossHealth: 34 },
    ace: { label: 'ACE', speed: 126, spawnInterval: 2.0, damage: 38, trafficSpeed: 1.2, projectileDamage: 17, missionTime: 150, bossHealth: 42 },
} as const;
export type Difficulty = keyof typeof DIFFICULTIES;

export function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export function axisInput(positive: boolean, negative: boolean) {
    return Number(positive) - Number(negative);
}

// Integrate the ramp exactly, including the part of a step after reaching its target.
// A tap makes a small correction; holding builds speed; releasing/opposing brakes quickly.
export function advanceAxis(rate: number, target: number, dt: number, acceleration = FLIGHT.acceleration as number, braking = FLIGHT.braking as number):{rate:number;angle:number} {
    if (rate * target < 0) {
        const stopTime = Math.abs(rate) / braking;
        if (dt > stopTime) {
            const reversed = advanceAxis(0, target, dt - stopTime, acceleration, braking);
            return { rate: reversed.rate, angle: rate * stopTime * 0.5 + reversed.angle };
        }
        const next = rate - Math.sign(rate) * braking * dt;
        return { rate: next, angle: (rate + next) * 0.5 * dt };
    }
    const slowing = target === 0 || rate * target < 0 || Math.abs(target) < Math.abs(rate);
    const change = slowing ? braking : acceleration;
    const difference = target - rate;
    const rampTime = Math.min(dt, Math.abs(difference) / change);
    const next = rate + Math.sign(difference) * change * rampTime;
    return { rate: next, angle: (rate + next) * 0.5 * rampTime + target * (dt - rampTime) };
}

export function advanceSpeed(speed: number, target: number, dt: number) {
    const response = target < speed ? 6 : 2.8;
    const decay = Math.exp(-response * dt);
    return { speed: target + (speed - target) * decay, distance: target * dt + (speed - target) * (1 - decay) / response };
}

// Fly-by-wire counter-thrust removes the long rotation tail after releasing a key or stick.
export function pilotAxis(rate: number, demand: number, maximum: number, dt: number) {
    return advanceAxis(rate, clamp(demand, -1, 1) * maximum, dt, 4.2, 32);
}

// A mouse flight stick commands a turn rate. Near the centre it has very fine authority.
export function flightStick(x: number, y: number, radius: number) {
    const length = Math.hypot(x, y), amount = clamp(length / Math.max(1, radius), 0, 1);
    const strength = amount <= .045 ? 0 : ((amount - .045) / .955) ** 1.65;
    if (strength === 0) return { x: 0, y: 0 };
    return { x: length ? x / length * strength : 0, y: length ? y / length * strength : 0 };
}

export function flightVelocity(current: Point, desired: Point, dt: number, brake = false, drift = false, acceleration: Point = { x: 0, y: 0, z: 0 }) {
    const response = brake ? 11 : 7;
    const decay = drift && !brake ? 1 : Math.exp(-response * dt);
    const step = (axis: 'x' | 'y' | 'z') => {
        if (drift && !brake) return { velocity: current[axis] + acceleration[axis] * dt, distance: current[axis] * dt + acceleration[axis] * dt * dt / 2 };
        const equilibrium = (brake ? 0 : desired[axis]) + acceleration[axis] / response;
        return { velocity: equilibrium + (current[axis] - equilibrium) * decay,
            distance: equilibrium * dt + (current[axis] - equilibrium) * (1 - decay) / response };
    };
    const x = step('x'), y = step('y'), z = step('z');
    return { velocity: { x: x.velocity, y: y.velocity, z: z.velocity }, displacement: { x: x.distance, y: y.distance, z: z.distance } };
}

// Recover pitch and bank without changing heading, position, or the selected control style.
export function levelAttitude(pitch: number, bank: number, dt: number) {
    const decay = Math.exp(-5.5 * dt);
    return { pitch: pitch * decay, bank: bank * decay, complete: Math.abs(pitch * decay) < 0.008 && Math.abs(bank * decay) < 0.008 };
}

export type Point = { x: number; y: number; z: number };
export type Bounds = { min: Point; max: Point };

// First contact along a swept segment. Used for scenery, ships, and fast projectiles.
export function segmentBoxFraction(start: Point, end: Point, box: Bounds, padding = 0): number | null {
    let enter = 0, exit = 1;
    for (const axis of ['x', 'y', 'z'] as const) {
        const delta = end[axis] - start[axis];
        const min = box.min[axis] - padding, max = box.max[axis] + padding;
        if (Math.abs(delta) < 1e-9) {
            if (start[axis] < min || start[axis] > max) return null;
        } else {
            const a = (min - start[axis]) / delta, b = (max - start[axis]) / delta;
            enter = Math.max(enter, Math.min(a, b));
            exit = Math.min(exit, Math.max(a, b));
            if (enter > exit) return null;
        }
    }
    return enter;
}

// Solve |relativePosition + velocity * t| = projectileSpeed * t.
export function interceptTime(relative: Point, velocity: Point, speed: number) {
    const a = velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2 - speed ** 2;
    const b = 2 * (relative.x * velocity.x + relative.y * velocity.y + relative.z * velocity.z);
    const c = relative.x ** 2 + relative.y ** 2 + relative.z ** 2;
    if (c === 0) return 0;
    if (Math.abs(a) < 1e-9) return b < 0 ? -c / b : 0;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return 0;
    const roots = [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)].filter(t => t >= 0);
    return roots.length ? Math.min(...roots) : 0;
}

export function awardKill(baseScore: number, previousStreak: number, remainingCombo: number) {
    const streak = remainingCombo > 0 ? previousStreak + 1 : 1;
    const multiplier = Math.min(4, 1 + Math.floor((streak - 1) / 3));
    return { streak, multiplier, points: baseScore * multiplier };
}
