/** Ported from neon-synth-ballistics; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { Battle, MAX_ELEVATION, MAX_POWER, MIN_ELEVATION, WIDTH } from './game.ts';
import type { Controls, Unit } from './game.ts';
import type { Difficulty } from './settings.ts';

type Plan = { weapon: number; facing: number; elevation: number; power: number; target: number; score: number };
type RocketPlan = ReturnType<Battle['planCPUShot']>;
function aimAt(source: Unit, target: Unit) {
    return { facing: target.x >= source.x ? 1 : -1, elevation: Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, Math.atan2(source.y - target.y, Math.abs(target.x - source.x)))) };
}
function clearLine(b: Battle, source: Unit, target: Unit) {
    const distance = Math.hypot(target.x - source.x, target.y - source.y);
    for (let d = 20; d < distance - 12; d += 2) {
        const x = source.x + (target.x - source.x) * d / distance;
        const y = source.y - 3 + (target.y - source.y) * d / distance;
        if (b.terrain.solid(x, y) || b.units.some(u => !u.dead && u !== source && u.team === source.team && Math.hypot(u.x - x, u.y - y) < 14)) return false;
    }
    return true;
}

export class CPUController {
    private turn = -1;
    private ticks = 0;
    private plan: Plan | null = null;
    private actionTick = 90;
    private secondShotTick = 0;
    private relocating = false;
    private relocateUntil = 0;
    private search: ReturnType<Battle['searchCPUShot']> | null = null;
    private searchingAfterFlight = false;
    private retreatDirection = 0;

    update(b: Battle, difficulty: Difficulty): Controls {
        if (this.turn !== b.turn) {
            this.turn = b.turn; this.ticks = 0; this.plan = null; this.actionTick = 90;
            this.secondShotTick = 0; this.relocating = false; this.retreatDirection = 0;
            this.search = b.searchCPUShot(); this.searchingAfterFlight = false; this.relocateUntil = 0;
        }
        this.ticks++;
        if (b.active.dead || b.phase === 'over') return {};
        if (b.active.vy > 7 && !b.active.grounded) b.deployChute();
        if (b.phase === 'retreat') return this.retreat(b);
        if (!b.canAct) return {};
        // Spread trajectory searches over frames so CPU thinking cannot stall
        // rendering, camera controls, or the Web Audio scheduling lookahead.
        if (this.search && this.ticks >= 12) {
            for (let candidate = 0; candidate < 32; candidate++) {
                const result = this.search.next();
                if (result.done) {
                    this.search = null; this.plan = this.choose(b, difficulty, result.value);
                    this.actionTick = Math.max(90, this.ticks + 35);
                    if (!this.searchingAfterFlight && this.plan.score < 2 && b.hasAmmo(5) && b.active.grounded && !b.jetUsed) {
                        this.relocating = true; this.relocateUntil = this.ticks + 60; b.equip(5);
                    }
                    break;
                }
            }
        }
        if (this.relocating && this.ticks < this.relocateUntil) {
            const target = b.units.find(u => u.id === this.plan?.target);
            const direction = target && target.x < b.active.x ? -1 : 1;
            return { jet: true, left: direction < 0, right: direction > 0 };
        }
        if (this.relocating && this.ticks >= this.relocateUntil + 30) {
            this.relocating = false; this.plan = null; this.searchingAfterFlight = true; this.search = b.searchCPUShot();
        }
        if (this.plan && !this.relocating && !this.search) {
            b.active.facing = this.plan.facing;
            b.active.elevation += (this.plan.elevation - b.active.elevation) * 0.15;
        }
        if (this.plan && !this.relocating && !this.search && this.ticks === this.actionTick) {
            b.equip(this.plan.weapon);
            b.active.facing = this.plan.facing; b.active.elevation = this.plan.elevation;
            if (this.plan.weapon === 0) b.startCharge();
            else {
                const target = b.units[this.plan.target];
                b.fire(this.plan.power, target ? { x: target.x, y: target.y } : undefined);
                if (b.shotgunShots > 0) this.secondShotTick = this.ticks + 50;
            }
        }
        if (this.plan && b.charging && b.power >= this.plan.power) b.fire(this.plan.power);
        if (b.shotgunShots > 0 && this.ticks >= this.secondShotTick) {
            const target = b.units.filter(u => !u.dead && u.team !== b.team).sort((a, c) => Math.abs(a.x - b.active.x) - Math.abs(c.x - b.active.x))[0];
            if (target) { const aim = aimAt(b.active, target); b.active.facing = aim.facing; b.active.elevation = aim.elevation; }
            b.fire(); this.secondShotTick = Infinity;
        }
        return {};
    }

    private choose(b: Battle, difficulty: Difficulty, rocket: RocketPlan): Plan {
        const u = b.active;
        const enemies = b.units.filter(other => !other.dead && other.team !== b.team).sort((a, c) => Math.abs(a.x - u.x) - Math.abs(c.x - u.x));
        const nearest = enemies[0];
        let plan: Plan = { weapon: 0, ...rocket, target: nearest?.id ?? 0 };
        const distance = nearest ? Math.hypot(nearest.x - u.x, nearest.y - u.y) : Infinity;
        if (nearest && distance < 55 && b.hasAmmo(9) && !b.units.some(other => !other.dead && other !== u && other.team === u.team && Math.hypot(other.x - u.x, other.y - u.y) < 100)) {
            plan = { weapon: 9, ...aimAt(u, nearest), power: 0, target: nearest.id, score: 45 };
        } else if (nearest && distance < 260 && b.hasAmmo(8) && clearLine(b, u, nearest)) {
            plan = { weapon: 8, ...aimAt(u, nearest), power: 0, target: nearest.id, score: 42 };
        } else if (nearest && distance < 600 && rocket.score < 29 && b.hasAmmo(3) && clearLine(b, u, nearest)) {
            plan = { weapon: 3, ...aimAt(u, nearest), power: 0, target: nearest.id, score: 30 };
        } else if (nearest && rocket.score < 10 && b.hasAmmo(4)) {
            plan = { weapon: 4, facing: u.facing, elevation: u.elevation, power: 0, target: nearest.id, score: 28 };
        }
        const spread = difficulty === 'rookie' ? 1 : difficulty === 'regular' ? 0.3 : 0.035;
        if (plan.weapon === 0) {
            plan.elevation = Math.max(0.15, Math.min(Math.PI / 2, plan.elevation + (b.random() - 0.5) * 0.12 * spread));
            plan.power = Math.max(3, Math.min(MAX_POWER, plan.power + (b.random() - 0.5) * 2 * spread));
        }
        return plan;
    }

    private retreat(b: Battle): Controls {
        const u = b.active;
        if (!this.retreatDirection) {
            const danger = b.projectiles.find(p => p.kind === 'dynamite' || p.kind === 'grenade' || p.kind === 'cluster');
            const enemy = b.units.filter(other => !other.dead && other.team !== b.team).sort((a, c) => Math.abs(a.x - u.x) - Math.abs(c.x - u.x))[0];
            this.retreatDirection = (danger?.x ?? enemy?.x ?? u.x + 1) > u.x ? -1 : 1;
        }
        const dir = this.retreatDirection;
        if (u.x < 45 || u.x > WIDTH - 45) return {};
        const ahead = u.x + dir * 25;
        const ground = b.terrain.surface(ahead, Math.max(0, u.y - 55));
        if (ground >= b.lava - 10 && u.grounded) return {};
        if (u.grounded && this.ticks % 25 === 0 && (ground < u.y - 5 || Math.abs(u.vx) < 0.15)) { u.facing = dir; b.jump(); }
        return { left: dir < 0, right: dir > 0 };
    }
}
