/** Ported from neon-synth-ballistics; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { generateMap, HEIGHT, randomMapCode, WIDTH } from './maps.ts';
import type { GeneratedMap } from './maps.ts';
import { normalizePreferences } from './settings.ts';
import type { Preferences } from './settings.ts';
export { WIDTH, HEIGHT } from './maps.ts';
export const TURN_TICKS = 35 * 60;
export const RETREAT_TICKS = 4 * 60;
export const GRAVITY = 0.22;
export const MAX_POWER = 20;
export const MIN_ELEVATION = -Math.PI / 2;
export const MAX_ELEVATION = Math.PI / 2;
export const COLORS = ['#00f3ff', '#ff0055'];
export const TEAM_NAMES = ['VANGUARD', 'SYNDICATE'];

export const WEAPONS = [
    { name: 'BAZOOKA', icon: '●', ammo: -1, hint: 'Wind bends the flight. Hold fire to charge; release to launch.' },
    { name: 'GRENADE', icon: '◈', ammo: -1, hint: 'Bounces before exploding. F changes the fuse from 1–5 seconds.' },
    { name: 'CLUSTER', icon: '∴', ammo: 3, hint: 'A bouncing grenade that bursts into five smaller bombs.' },
    { name: 'LASER', icon: 'ϟ', ammo: 4, hint: 'Tap Space for an instant, precise beam. Terrain blocks it; wind does not.' },
    { name: 'AIR STRIKE', icon: '▼', ammo: 1, hint: 'Click the battlefield to mark a column for five falling bombs.' },
    { name: 'JETPACK', icon: '↑', ammo: 2, hint: 'Hold Shift to fly, arrows to steer. Uses one pack per turn.' },
    { name: 'TELEPORT', icon: '⌖', ammo: 2, hint: 'Click a clear landing spot. Teleporting ends your attack.' },
    { name: 'GRAPPLE', icon: '⌁', ammo: 5, hint: 'Aim at terrain and tap Space to attach. Left/right swing; up/down reel. Enter releases. You can still attack.' },
    { name: 'SHOTGUN', icon: '═', ammo: 3, hint: 'Two close-range shots. Tap Space for each shot; you can aim and move between them.' },
    { name: 'DYNAMITE', icon: '▥', ammo: 3, hint: 'Tap Space to place a powerful five-second charge beside you, then run!' },
] as const;
export const WEAPON_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
export type BattleOptions = Partial<Preferences> & { practice?: boolean };
export type TeamStats = { shots: number; damage: number; friendlyDamage: number; kills: number; crates: number };
export type Rope = { x: number; y: number; length: number; unit: number };

export type Phase = 'aim' | 'retreat' | 'resolving' | 'over';
export type Controls = { left?: boolean; right?: boolean; up?: boolean; down?: boolean; jet?: boolean };
export type Unit = {
    id: number; team: number; name: string; x: number; y: number; vx: number; vy: number;
    hp: number; dead: boolean; grounded: boolean; facing: number; elevation: number;
    fuel: number; fallSpeed: number; anim: number;
    chute: boolean; lastAttacker: number | null; lastHitTick: number;
};
export type Projectile = {
    kind: 'rocket' | 'grenade' | 'cluster' | 'bomblet' | 'air' | 'dynamite';
    x: number; y: number; vx: number; vy: number; age: number; fuse: number; owner: number;
    active: boolean; delay: number; trail: { x: number; y: number }[];
};
export type GameEvent = { type: 'blast' | 'damage' | 'death' | 'shot' | 'jump' | 'turn' | 'pickup' | 'beam' | 'bounce' | 'grapple' | 'chute' | 'splash' | 'warning'; x: number; y: number; value?: number; x2?: number; y2?: number; team?: number; owner?: number; unit?: number; text?: string };
export type Crate = { x: number; y: number; vy: number; kind: 'health' | 'ammo' };

export class Terrain {
    pixels = new Uint8Array(WIDTH * HEIGHT);
    revision = 0;
    changes: { revision: number; x: number; y: number; width: number; height: number }[] = [];

    constructor(map: GeneratedMap) { this.pixels = map.pixels.slice(); }

    solid(x: number, y: number) {
        return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && this.pixels[Math.floor(y) * WIDTH + Math.floor(x)] === 1;
    }

    surface(x: number, from = 0) {
        for (let y = Math.max(0, Math.floor(from)); y < HEIGHT; y++) if (this.solid(x, y)) return y;
        return HEIGHT;
    }

    carve(cx: number, cy: number, radius: number) {
        for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(HEIGHT - 1, Math.ceil(cy + radius)); y++) {
            for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(WIDTH - 1, Math.ceil(cx + radius)); x++) {
                if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) this.pixels[y * WIDTH + x] = 0;
            }
        }
        this.revision++;
        this.changes.push({ revision: this.revision, x: Math.max(0, Math.floor(cx - radius - 5)), y: Math.max(0, Math.floor(cy - radius - 5)), width: Math.ceil(radius * 2 + 12), height: Math.ceil(radius * 2 + 12) });
        if (this.changes.length > 128) this.changes.shift();
    }
}

export class Battle {
    terrain: Terrain;
    units: Unit[] = [];
    inventories: number[][] = [WEAPONS.map(w => w.ammo), WEAPONS.map(w => w.ammo)];
    projectiles: Projectile[] = [];
    crates: Crate[] = [];
    events: GameEvent[] = [];
    phase: Phase = 'aim';
    team = 0;
    activeId = 0;
    cursors = [0, 0];
    turn = 0;
    time = TURN_TICKS;
    retreat = 0;
    settled = 0;
    resolvingAge = 0;
    wind = 0;
    weapon = 0;
    fuse = 3;
    power = 0;
    charging = false;
    committed = false;
    jetUsed = false;
    lava = 642;
    winner: number | null = null;
    message = '';
    ticks = 0;
    rope: Rope | null = null;
    shotgunShots = 0;
    stats: TeamStats[] = Array.from({ length: 2 }, () => ({ shots: 0, damage: 0, friendlyDamage: 0, kills: 0, crates: 0 }));
    log: string[] = [];
    options: Preferences & { practice: boolean };

    random: () => number;
    readonly mapCode: string;
    readonly mapKind: string;

    constructor(mapCode = randomMapCode(), random = Math.random, options: BattleOptions = {}) {
        this.random = random;
        this.options = { ...normalizePreferences(options), practice: options.practice === true };
        const map = generateMap(mapCode);
        this.mapCode = map.code;
        this.mapKind = map.kind;
        this.terrain = new Terrain(map);
        const names = this.options.unitNames;
        for (const spawn of map.spawns) {
            const { id: i, team, x, y } = spawn;
            this.units.push({ id: i, team, name: names[team][Math.floor(i / 2)], x, y,
                vx: 0, vy: 0, hp: 100, dead: false, grounded: true, facing: team === 0 ? 1 : -1,
                elevation: Math.PI / 4, fuel: 100, fallSpeed: 0, anim: 0,
                chute: false, lastAttacker: null, lastHitTick: -1000 });
        }
        for (const u of this.units) {
            const nearest = this.units.filter(other => other.team !== u.team).sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
            u.facing = nearest.x > u.x ? 1 : -1;
        }
        this.startTurn(0);
    }

    get active() { return this.units[this.activeId]; }
    get round() { return Math.ceil(this.turn / 2); }
    get angle() { return this.active.facing === 1 ? -this.active.elevation : Math.PI + this.active.elevation; }
    get canAct() { return this.phase === 'aim' && !this.active.dead; }
    teamHealth(team: number) { return this.units.filter(u => u.team === team).reduce((sum, u) => sum + u.hp, 0); }
    teamName(team: number) { return this.options.teamNames[team]; }
    addLog(text: string) { this.log.unshift(text); this.log = this.log.slice(0, 8); }
    hasAmmo(id: number) { return this.options.practice || this.inventories[this.team][id] !== 0 || (id === 5 && this.jetUsed) || (id === 7 && !!this.rope) || (id === 8 && this.shotgunShots > 0); }
    useAmmo(id: number) { if (!this.options.practice && this.inventories[this.team][id] > 0) this.inventories[this.team][id]--; }

    startTurn(team: number) {
        this.team = team;
        const squad = this.units.filter(u => u.team === team);
        let slot = this.cursors[team] % squad.length;
        for (let i = 0; i < squad.length && squad[slot].dead; i++) slot = (slot + 1) % squad.length;
        this.activeId = squad[slot].id;
        this.cursors[team] = (slot + 1) % squad.length;
        this.turn++;
        this.phase = 'aim';
        this.time = this.options.turnSeconds * 60;
        this.retreat = 0;
        this.settled = 0;
        this.resolvingAge = 0;
        this.charging = false;
        this.power = 0;
        this.committed = false;
        this.jetUsed = false;
        this.rope = null;
        this.shotgunShots = 0;
        this.weapon = 0;
        this.active.fuel = 100;
        this.wind = (this.random() - 0.5) * 0.048;
        if (team === 0 && this.round >= this.options.suddenDeathRound && !this.options.practice) {
            this.lava -= 18;
            this.message = 'SUDDEN DEATH — LAVA RISING';
        } else this.message = `${this.teamName(team)} // ${this.active.name} READY`;
        if (team === 0 && this.round > 1 && this.round % 2 === 0) {
            const x = 120 + this.random() * (WIDTH - 240);
            this.crates.push({ x, y: 100, vy: 0, kind: this.random() < 0.5 ? 'health' : 'ammo' });
        }
        this.events.push({ type: 'turn', x: this.active.x, y: this.active.y, team });
    }

    switchUnit() {
        if (!this.canAct || this.committed || this.charging || this.rope) return false;
        const squad = this.units.filter(u => u.team === this.team && !u.dead);
        const next = squad[(squad.indexOf(this.active) + 1) % squad.length];
        return this.selectUnit(next.id);
    }

    selectUnit(id: number) {
        const next = this.units[id];
        if (!this.canAct || this.committed || this.charging || this.rope || !next || next.dead || next.team !== this.team) return false;
        this.activeId = next.id;
        this.cursors[this.team] = (this.units.filter(u => u.team === this.team).indexOf(next) + 1) % 3;
        next.fuel = 100;
        return true;
    }

    equip(id: number) {
        if (!this.canAct || this.charging || !WEAPONS[id] || !this.hasAmmo(id) || (this.shotgunShots > 0 && id !== 8)) return false;
        this.weapon = id;
        return true;
    }

    jump(backflip = false) {
        if (this.rope && this.rope.unit === this.activeId && this.canAct) { this.rope = null; this.active.vy -= 1; return; }
        if (!(this.canAct || this.phase === 'retreat') || !this.active.grounded || this.charging || this.active.dead) return;
        const u = this.active;
        u.vy = backflip ? -7 : -5.4;
        u.vx = u.facing * (backflip ? -1.8 : 2.5);
        u.y -= 1;
        u.grounded = false;
        this.committed = true;
        this.events.push({ type: 'jump', x: u.x, y: u.y });
    }

    startCharge() {
        if (!this.canAct || this.weapon >= 3 || !this.hasAmmo(this.weapon)) return;
        this.charging = true;
        this.power = 2;
    }

    fire(power = this.power, target?: { x: number; y: number }) {
        if (!this.canAct || !this.hasAmmo(this.weapon) || this.weapon === 5) return false;
        if (this.weapon === 7) return this.toggleRope();
        const u = this.active;
        const angle = this.angle;
        if ((this.weapon === 4 || this.weapon === 6) && !target) return false;
        if (this.weapon === 6) {
            const x = Math.max(36, Math.min(WIDTH - 36, target!.x));
            const y = this.terrain.surface(x, target!.y) - 10;
            if (y + 10 >= this.lava || this.bodyBlocked(x, y) || this.units.some(other => !other.dead && other !== u && Math.hypot(other.x - x, other.y - y) < 24)) {
                this.message = 'TELEPORT NEEDS A CLEAR LANDING SPOT';
                return false;
            }
            u.x = x; u.y = y; u.vx = 0; u.vy = 0; u.grounded = true;
            this.events.push({ type: 'pickup', x, y, team: u.team, value: 6 });
        } else if (this.weapon === 4) {
            const x = Math.max(30, Math.min(WIDTH - 30, target!.x));
            for (let i = 0; i < 5; i++) this.projectiles.push(this.projectile('air', x + (i - 2) * 28, -20, 0, 4, 0, i * 12));
        } else if (this.weapon === 3) {
            this.fireLaser();
        } else if (this.weapon === 8) {
            if (this.shotgunShots === 0) { this.shotgunShots = 2; this.useAmmo(8); this.stats[this.team].shots++; }
            this.fireShotgun();
            this.shotgunShots--;
            this.committed = true;
            this.rope = null;
            this.events.push({ type: 'shot', x: u.x, y: u.y, value: 8, team: u.team });
            if (this.shotgunShots > 0) { this.message = 'SHOTGUN — ONE SHOT LEFT. AIM, THEN TAP SPACE.'; return true; }
        } else if (this.weapon === 9) {
            this.projectiles.push(this.projectile('dynamite', u.x + u.facing * 14, u.y - 2, u.facing * 0.6, -0.6, 300));
        } else {
            const speed = Math.max(2, Math.min(MAX_POWER, power));
            const kind = (['rocket', 'grenade', 'cluster'] as const)[this.weapon];
            this.projectiles.push(this.projectile(kind, u.x + Math.cos(angle) * 19, u.y - 3 + Math.sin(angle) * 19,
                Math.cos(angle) * speed, Math.sin(angle) * speed, this.fuse * 60));
        }
        if (this.weapon !== 8) { this.useAmmo(this.weapon); this.stats[this.team].shots++; }
        this.charging = false;
        this.power = 0;
        this.committed = true;
        this.rope = null;
        this.phase = 'retreat';
        this.retreat = RETREAT_TICKS;
        this.message = this.weapon === 6 ? 'TELEPORT COMPLETE' : 'SHOT AWAY — 4 SECONDS TO RETREAT';
        if (this.weapon !== 8) this.events.push({ type: 'shot', x: u.x, y: u.y, value: this.weapon, team: u.team });
        return true;
    }

    projectile(kind: Projectile['kind'], x: number, y: number, vx: number, vy: number, fuse: number, delay = 0): Projectile {
        return { kind, x, y, vx, vy, fuse, age: 0, owner: this.activeId, active: true, delay, trail: [] };
    }

    skip() {
        if (!this.canAct) return;
        this.charging = false;
        this.power = 0;
        this.rope = null;
        this.shotgunShots = 0;
        this.phase = 'resolving';
        this.message = 'TURN PASSED';
    }

    bodyBlocked(x: number, y: number) {
        return [-6, 0, 6].some(dx => this.terrain.solid(x + dx, y - 7) || this.terrain.solid(x + dx, y + 6));
    }

    deployChute() {
        const u = this.active;
        if (!(this.canAct || this.phase === 'retreat') || u.dead || u.grounded || u.vy <= 0 || this.rope) return false;
        if (u.chute) return false;
        u.chute = true; u.fallSpeed = 0;
        this.events.push({ type: 'chute', x: u.x, y: u.y, team: u.team });
        this.message = 'PARACHUTE DEPLOYED — LEFT / RIGHT TO DRIFT';
        return true;
    }

    toggleRope() {
        if (!this.canAct) return false;
        if (this.rope) { this.rope = null; this.message = 'GRAPPLE RELEASED'; return true; }
        if (!this.hasAmmo(7)) return false;
        const u = this.active;
        const dx = Math.cos(this.angle), dy = Math.sin(this.angle);
        for (let distance = 20; distance <= 600; distance++) {
            const x = u.x + dx * distance, y = u.y - 3 + dy * distance;
            if (this.terrain.solid(x, y) && y < this.lava - 20) {
                this.rope = { x, y, length: Math.hypot(x - u.x, y - u.y), unit: u.id };
                this.useAmmo(7); this.committed = true; u.chute = false;
                this.message = 'GRAPPLE ATTACHED — ARROWS SWING / REEL. ENTER RELEASES.';
                this.events.push({ type: 'grapple', x: u.x, y: u.y, x2: x, y2: y, team: u.team });
                return true;
            }
            if (x < 0 || x >= WIDTH || y > this.lava) break;
        }
        this.message = 'NO ANCHOR — AIM AT TERRAIN WITHIN 600m';
        return false;
    }

    updateRope() {
        if (!this.rope) return;
        const rope = this.rope;
        const u = this.units[rope.unit];
        if (u.dead || !this.canAct || !this.terrain.solid(rope.x, rope.y)) { this.rope = null; return; }
        const dx = u.x - rope.x, dy = u.y - rope.y, distance = Math.hypot(dx, dy);
        if (distance <= rope.length) return;
        const nx = dx / distance, ny = dy / distance;
        const x = rope.x + nx * rope.length, y = rope.y + ny * rope.length;
        const steps = Math.max(1, Math.ceil(Math.hypot(x - u.x, y - u.y)));
        for (let i = 1; i <= steps; i++) if (this.bodyBlocked(u.x + (x - u.x) * i / steps, u.y + (y - u.y) * i / steps)) {
            // The cable can winch a rover upward along a cliff instead of
            // repeatedly cancelling every reel input against its side wall.
            const verticalSteps = Math.max(1, Math.ceil(Math.abs(y - u.y)));
            let safeY = u.y;
            if (y < u.y) for (let step = 1; step <= verticalSteps; step++) {
                const testY = u.y + (y - u.y) * step / verticalSteps;
                if (this.bodyBlocked(u.x, testY)) break;
                safeY = testY;
            }
            if (safeY < u.y) { u.y = safeY; u.vy = Math.min(0, u.vy); u.grounded = false; u.fallSpeed = 0; }
            rope.length = Math.hypot(u.x - rope.x, u.y - rope.y);
            return;
        }
        u.x = Math.max(8, Math.min(WIDTH - 8, x)); u.y = y;
        const outward = u.vx * nx + u.vy * ny;
        if (outward > 0) { u.vx -= nx * outward; u.vy -= ny * outward; }
        u.grounded = false; u.fallSpeed = 0;
    }

    fireShotgun() {
        const u = this.active;
        const hits = new Map<number, number>();
        for (let pellet = -2; pellet <= 2; pellet++) {
            const angle = this.angle + pellet * 0.018;
            const dx = Math.cos(angle), dy = Math.sin(angle);
            let x = u.x, y = u.y - 3;
            for (let distance = 19; distance <= 650; distance++) {
                x = u.x + dx * distance; y = u.y - 3 + dy * distance;
                const hit = this.units.find(other => other !== u && !other.dead && Math.hypot(other.x - x, other.y - y) < 11);
                if (hit) { hits.set(hit.id, (hits.get(hit.id) || 0) + Math.max(1, Math.round(6 * (1 - distance / 800)))); break; }
                if (this.terrain.solid(x, y)) { this.terrain.carve(x, y, 5); break; }
                if (x < 0 || x > WIDTH || y < -800 || y > this.lava) break;
            }
            this.events.push({ type: 'beam', x: u.x, y: u.y - 3, x2: x, y2: y, value: 8, team: u.team });
        }
        for (const [id, damage] of hits) {
            const hit = this.units[id];
            this.damage(hit, damage, u.id);
            hit.vx += u.facing * 2.2; hit.vy = Math.min(hit.vy, -1.5); hit.grounded = false;
        }
    }

    step(input: Controls = {}) {
        if (this.phase === 'over') return;
        this.ticks++;
        const u = this.active;
        if ((this.canAct || this.phase === 'retreat') && !u.dead && !this.charging) {
            const move = Number(!!input.right) - Number(!!input.left);
            if (move) {
                u.facing = move;
                u.vx = u.grounded ? move * 1.5 : Math.max(-3, Math.min(3, u.vx + move * 0.045));
                this.committed = true;
            }
            if (this.canAct) {
                if (this.rope) this.rope.length = Math.max(28, Math.min(600, this.rope.length + (Number(!!input.down) - Number(!!input.up)) * 1.8));
                else u.elevation = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, u.elevation + (Number(!!input.up) - Number(!!input.down)) * 0.017));
                if (input.jet && this.weapon === 5 && u.fuel > 0 && (this.jetUsed || this.hasAmmo(5))) {
                    if (!this.jetUsed) { this.useAmmo(5); this.jetUsed = true; }
                    this.rope = null; u.chute = false;
                    u.vy = Math.max(-4, u.vy - 0.4);
                    u.fuel -= 0.7;
                    u.grounded = false;
                    this.committed = true;
                }
            }
        }
        if (this.canAct) {
            if (!this.options.practice) this.time--;
            if (this.charging) this.power = Math.min(MAX_POWER, this.power + 0.18);
            if (this.time <= 0) { this.skip(); this.message = 'TIME UP'; }
        } else if (this.phase === 'retreat') {
            if (--this.retreat <= 0) this.phase = 'resolving';
        }
        for (const unit of this.units) this.updateUnit(unit);
        this.updateRope();
        // New cluster fragments start on the next tick, avoiding array-mutation order effects.
        for (const p of [...this.projectiles]) if (p.active) this.updateProjectile(p);
        this.projectiles = this.projectiles.filter(p => p.active);
        this.updateCrates();
        if (this.active.dead && this.phase === 'aim') { this.skipDeadTurn(); }
        if (this.phase === 'resolving') {
            this.rope = null;
            this.resolvingAge++;
            const still = this.projectiles.length === 0 && this.units.every(unit => unit.dead || (unit.grounded && Math.abs(unit.vx) < 0.12));
            this.settled = still ? this.settled + 1 : 0;
            if (this.settled >= 45) {
                const alive = [0, 1].map(team => this.units.some(unit => unit.team === team && !unit.dead));
                if (!alive[0] || !alive[1]) {
                    this.phase = 'over';
                    this.winner = alive[0] ? 0 : alive[1] ? 1 : -1;
                    this.message = this.winner === -1 ? 'MUTUAL DESTRUCTION' : this.options.practice && this.winner === 0 ? 'RANGE CLEARED' : `${this.teamName(this.winner)} WINS`;
                } else this.startTurn(this.options.practice ? 0 : 1 - this.team);
            }
        }
    }

    skipDeadTurn() {
        this.charging = false; this.power = 0; this.phase = 'resolving';
        this.message = 'UNIT LOST — SETTLING BATTLEFIELD';
    }

    updateUnit(u: Unit) {
        if (u.dead) return;
        u.vy = Math.min(16, u.vy + GRAVITY);
        if (u.chute && u.vy > 0) { u.vy = Math.min(1.7, u.vy); u.fallSpeed = 0; }
        let nextX = u.x;
        const startY = u.y;
        const targetX = Math.max(8, Math.min(WIDTH - 8, u.x + u.vx));
        const horizontalSteps = Math.max(1, Math.ceil(Math.abs(targetX - u.x)));
        for (let step = 1; Math.abs(targetX - u.x) > 0.01 && step <= horizontalSteps; step++) {
            const x = u.x + (targetX - u.x) * step / horizontalSteps;
            if (this.bodyBlocked(x, u.y)) {
                let climbed = false;
                if (u.grounded) for (let rise = 1; rise <= 9 - (startY - u.y); rise++) {
                    if (!this.bodyBlocked(x, u.y - rise)) { u.y -= rise; climbed = true; break; }
                }
                if (!climbed) { u.vx = 0; break; }
            }
            nextX = x;
        }
        u.anim += Math.abs(nextX - u.x);
        u.x = nextX;
        const verticalSteps = Math.max(1, Math.ceil(Math.abs(u.vy)));
        const dy = u.vy / verticalSteps;
        u.grounded = false;
        for (let i = 0; i < verticalSteps; i++) {
            const y = u.y + dy;
            const contactY = y + (dy >= 0 ? 9 : -9);
            if ([-5, 0, 5].some(dx => this.terrain.solid(u.x + dx, contactY))) {
                if (dy > 0) {
                    u.grounded = true;
                    if (u.fallSpeed > 9) {
                        this.damage(u, Math.min(40, Math.floor((u.fallSpeed - 9) * 5)));
                        if (u === this.active && this.canAct) { this.skip(); this.message = 'HARD LANDING — TURN ENDED'; }
                    }
                    u.fallSpeed = 0;
                    u.chute = false;
                }
                u.vy = 0;
                break;
            }
            u.y = y;
        }
        if (!u.grounded) u.fallSpeed = Math.max(u.fallSpeed, u.vy);
        u.vx *= u.grounded ? 0.75 : 0.985;
        if (u.y + 9 >= this.lava) { this.events.push({ type: 'splash', x: u.x, y: this.lava, team: u.team }); this.damage(u, u.hp); }
    }

    damage(u: Unit, amount: number, attacker?: number) {
        if (u.dead || amount <= 0) return;
        const actual = Math.min(u.hp, Math.round(amount));
        if (actual <= 0) return;
        if (attacker !== undefined) { u.lastAttacker = attacker; u.lastHitTick = this.ticks; }
        const owner = attacker ?? (this.ticks - u.lastHitTick < 300 ? u.lastAttacker : null);
        if (owner !== null && owner !== undefined && this.units[owner]) {
            const team = this.units[owner].team;
            if (u.team === team) this.stats[team].friendlyDamage += actual;
            else this.stats[team].damage += actual;
        }
        u.hp -= actual;
        this.addLog(`${owner !== null && owner !== undefined && this.units[owner] ? this.units[owner].name : 'TERRAIN'} → ${u.name} −${actual} HP`);
        this.events.push({ type: 'damage', x: u.x, y: u.y - 24, value: actual, team: u.team, owner:owner??undefined, unit: u.id });
        if (u.hp <= 0) {
            u.dead = true;
            if (owner !== null && owner !== undefined && this.units[owner] && this.units[owner].team !== u.team) this.stats[this.units[owner].team].kills++;
            this.addLog(`${u.name} went offline.`);
            this.events.push({ type: 'death', x: u.x, y: u.y, team: u.team, unit: u.id });
        }
    }

    updateProjectile(p: Projectile) {
        if (p.delay-- > 0) return;
        p.age++;
        const timed = p.kind === 'grenade' || p.kind === 'cluster' || p.kind === 'bomblet' || p.kind === 'dynamite';
        if (timed && p.age >= p.fuse) { this.detonate(p); return; }
        if (!timed) p.vx += this.wind;
        p.vy += GRAVITY;
        const steps = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy)));
        for (let i = 0; i < steps; i++) {
            const dx = p.vx / steps;
            const dy = p.vy / steps;
            const nx = p.x + dx;
            const ny = p.y + dy;
            const terrainHit = this.terrain.solid(nx, ny);
            const unitHit = !timed && this.units.some(u => !u.dead && (u.id !== p.owner || p.age > 8) && Math.hypot(u.x - nx, u.y - ny) < 11);
            if (terrainHit || unitHit) {
                if (!timed) { p.x = nx; p.y = ny; this.detonate(p); return; }
                // Reflect against the local surface normal, including sloped terrain.
                let normalX = 0, normalY = 0;
                for (let sy = -4; sy <= 4; sy++) for (let sx = -4; sx <= 4; sx++) {
                    if (this.terrain.solid(nx + sx, ny + sy)) { normalX -= sx; normalY -= sy; }
                }
                const length = Math.hypot(normalX, normalY);
                if (length > 0) { normalX /= length; normalY /= length; }
                else { normalX = -Math.sign(dx); normalY = -Math.sign(dy); }
                const dot = p.vx * normalX + p.vy * normalY;
                const restitution = p.kind === 'dynamite' ? 0.16 : 0.58;
                const impact = Math.hypot(p.vx, p.vy);
                p.vx = (p.vx - 2 * dot * normalX) * restitution;
                p.vy = (p.vy - 2 * dot * normalY) * restitution;
                if (impact > 1.4) this.events.push({ type: 'bounce', x: p.x, y: p.y, value: impact });
                if (Math.hypot(p.vx, p.vy) < 0.65) { p.vx = 0; p.vy = 0; }
                break;
            }
            p.x = nx; p.y = ny;
            if (p.y >= this.lava) {
                p.active = false;
                this.events.push({ type: 'splash', x: Math.max(0, Math.min(WIDTH, p.x)), y: this.lava, value: p.kind === 'bomblet' ? 0.25 : 0.5 });
                return;
            }
            if (p.x < -30 || p.x > WIDTH + 30 || p.y > HEIGHT || p.y < -800 || p.age > 900) { p.active = false; return; }
        }
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 12) p.trail.shift();
    }

    detonate(p: Projectile) {
        if (!p.active) return;
        p.active = false;
        const radius = p.kind === 'dynamite' ? 90 : p.kind === 'bomblet' ? 30 : p.kind === 'air' ? 42 : p.kind === 'cluster' ? 38 : 55;
        const maxDamage = p.kind === 'dynamite' ? 80 : p.kind === 'bomblet' ? 23 : p.kind === 'air' ? 32 : p.kind === 'cluster' ? 25 : 48;
        this.explode(p.x, p.y, radius, maxDamage, p.owner);
        if (p.kind === 'cluster') for (let i = 0; i < 5; i++) {
            const angle = -Math.PI + 0.28 + i * (Math.PI - 0.56) / 4;
            const child = this.projectile('bomblet', p.x, p.y - 3, Math.cos(angle) * 4.5, Math.sin(angle) * 5.5, 55 + i * 7);
            child.owner = p.owner;
            this.projectiles.push(child);
        }
    }

    explode(x: number, y: number, radius: number, maxDamage: number, owner = this.activeId) {
        this.terrain.carve(x, y, radius);
        for (const u of this.units) {
            if (u.dead) continue;
            const dist = Math.hypot(u.x - x, u.y - y);
            const reach = radius + 18;
            if (dist >= reach) continue;
            this.damage(u, Math.max(1, Math.round(maxDamage * (1 - dist / reach))), owner);
            const force = (1 - dist / reach) * 6.5;
            u.vx += ((u.x - x) / Math.max(1, dist)) * force;
            u.vy = Math.min(u.vy, -2.5 - force * 0.65);
            u.y -= 2;
            u.grounded = false;
            u.chute = false;
        }
        this.crates = this.crates.filter(c => Math.hypot(c.x - x, c.y - y) > radius);
        this.events.push({ type: 'blast', x, y, value: radius });
    }

    fireLaser() {
        const u = this.active;
        const dx = Math.cos(this.angle), dy = Math.sin(this.angle);
        let x = u.x, y = u.y - 3;
        for (let distance = 19; distance < WIDTH * 1.5; distance++) {
            x = u.x + dx * distance; y = u.y - 3 + dy * distance;
            const hit = this.units.find(other => other !== u && !other.dead && Math.hypot(other.x - x, other.y - y) < 12);
            if (hit) { this.damage(hit, 30, this.activeId); hit.vx += dx * 3; hit.vy = -2; break; }
            if (this.terrain.solid(x, y)) { this.terrain.carve(x, y, 9); break; }
            if (x < 0 || x > WIDTH || y < 0 || y > this.lava) break;
        }
        this.events.push({ type: 'beam', x: u.x, y: u.y - 3, x2: x, y2: y });
    }

    updateCrates() {
        for (const c of [...this.crates]) {
            c.vy = Math.min(4, c.vy + 0.1);
            if (this.terrain.solid(c.x, c.y + 9)) c.vy = 0;
            c.y += c.vy;
            if (c.y + 8 >= this.lava) { this.crates.splice(this.crates.indexOf(c), 1); continue; }
            const u = this.units.find(unit => !unit.dead && Math.hypot(unit.x - c.x, unit.y - c.y) < 22);
            if (!u) continue;
            this.stats[u.team].crates++;
            if (c.kind === 'health') u.hp = Math.min(100, u.hp + 25);
            else { this.inventories[u.team][2]++; this.inventories[u.team][3] += 2; }
            this.message = `${u.name} COLLECTED ${c.kind === 'health' ? '+25 HEALTH' : 'CLUSTER + LASER AMMO'}`;
            this.events.push({ type: 'pickup', x: c.x, y: c.y, team: u.team });
            this.crates.splice(this.crates.indexOf(c), 1);
        }
    }

    *searchCPUShot() {
        const u = this.active;
        let best = { facing: u.facing, elevation: Math.PI / 4, power: 10, score: -Infinity };
        const enemies = this.units.filter(other => !other.dead && other.team !== this.team);
        for (const target of enemies) {
            const facing = target.x > u.x ? 1 : -1;
            for (let degrees = 20; degrees <= 80; degrees += 5) for (let power = 4; power <= MAX_POWER; power += 0.5) {
                const elevation = degrees * Math.PI / 180;
                const angle = facing === 1 ? -elevation : Math.PI + elevation;
                let x = u.x + Math.cos(angle) * 19, y = u.y - 3 + Math.sin(angle) * 19;
                let vx = Math.cos(angle) * power, vy = Math.sin(angle) * power;
                for (let tick = 0; tick < 300; tick++) {
                    vx += this.wind; vy += GRAVITY;
                    const steps = Math.max(1, Math.ceil(Math.hypot(vx, vy)));
                    let hit = false;
                    for (let s = 0; s < steps; s++) {
                        x += vx / steps; y += vy / steps;
                        hit = this.terrain.solid(x, y) || this.units.some(other => !other.dead && (other !== u || tick > 8) && Math.hypot(other.x - x, other.y - y) < 11);
                        if (hit) break;
                    }
                    if (hit || y >= this.lava || x < 0 || x > WIDTH) break;
                }
                let score = 0;
                for (const other of this.units) if (!other.dead) {
                    const damage = Math.max(0, 1 - Math.hypot(other.x - x, other.y - y) / 73) * 48;
                    score += damage * (other.team === this.team ? -1.8 : 1);
                }
                score -= Math.hypot(target.x - x, target.y - y) * 0.008;
                if (score > best.score) best = { facing, elevation, power, score };
                yield best;
            }
        }
        return best;
    }

    planCPUShot() {
        const search = this.searchCPUShot();
        let result = search.next();
        while (!result.done) result = search.next();
        return result.value;
    }
}
