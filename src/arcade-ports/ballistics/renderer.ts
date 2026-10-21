/** Ported from neon-synth-ballistics; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { Battle, COLORS, GRAVITY, HEIGHT, MAX_POWER, WIDTH } from './game.ts';
import type { GameEvent, Unit } from './game.ts';
import { Camera } from './camera.ts';
import { createSeededRandom } from './maps.ts';
import type { Preferences } from './settings.ts';

type Theme = { name: string; top: string; bottom: string; rock: number[]; edge: number[]; vein: number[]; sun: string; mountains: string; city: string };
const THEMES: Theme[] = [
    { name: 'AFTERGLOW', top: '#080b24', bottom: '#38233f', rock: [24, 31, 53], edge: [81, 231, 215], vein: [92, 71, 148], sun: '#ff668e', mountains: '#25203e', city: '#121a31' },
    { name: 'COPPER SUNSET', top: '#120e26', bottom: '#4a2540', rock: [46, 29, 49], edge: [246, 177, 110], vein: [111, 55, 94], sun: '#ff9d68', mountains: '#352137', city: '#1d172d' },
    { name: 'ION COAST', top: '#06132b', bottom: '#153b4c', rock: [17, 35, 48], edge: [100, 234, 244], vein: [55, 105, 118], sun: '#9e98ff', mountains: '#153445', city: '#0b2436' },
    { name: 'AMETHYST VAULT', top: '#100c29', bottom: '#392a56', rock: [35, 27, 54], edge: [161, 139, 242], vein: [103, 65, 151], sun: '#e58adc', mountains: '#302248', city: '#1b1731' },
];
type Effect = { kind: 'spark' | 'debris' | 'smoke' | 'ring' | 'flash' | 'text' | 'beam' | 'bubble'; x: number; y: number; vx: number; vy: number; life: number; total: number; color: string; radius?: number; text?: string; x2?: number; y2?: number; value?: number; unit?: number };
type Scar = { x: number; y: number; radius: number };
const hash = (x: number, y: number) => ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0);
const themeFor = (kind: string) => THEMES[['ROLLING RIDGE', 'NEON MESAS', 'BROKEN ISLES', 'HOLLOW GROUND'].indexOf(kind)] || THEMES[0];

function rasterTerrain(pixels: Uint8Array, data: Uint8ClampedArray, theme: Theme, scars: Scar[], left: number, top: number, right: number, bottom: number) {
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        const index = y * WIDTH + x, d = index * 4;
        if (!pixels[index]) { data[d + 3] = 0; continue; }
        const edge = y === 0 || !pixels[index - WIDTH] || x === 0 || !pixels[index - 1] || x === WIDTH - 1 || !pixels[index + 1] || (y + 1 < HEIGHT && !pixels[index + WIDTH]);
        const bevel = !edge && (y < 3 || !pixels[index - WIDTH * 3] || !pixels[index - 3] || !pixels[index + 3]);
        const grain = hash(Math.floor(x / 2), Math.floor(y / 2));
        const band = (Math.floor((y + Math.floor(x / 90) % 3 * 3) / 19) % 4) * 2;
        const speck = grain % 11 === 0 ? 12 : grain % 5 === 0 ? -8 : 0;
        const vein = ((x * 7 + y * 3) % 113 < 2) && grain % 7 < 3;
        const color = edge ? theme.edge : vein ? theme.vein : theme.rock;
        const warm = (edge || bevel) && scars.some(scar => Math.abs(Math.hypot(x - scar.x, y - scar.y) - scar.radius) < 7);
        data[d] = warm ? edge ? 255 : 88 : Math.max(0, color[0] + (edge ? 0 : bevel ? 17 : speck + band));
        data[d + 1] = warm ? edge ? 157 : 58 : Math.max(0, color[1] + (edge ? 0 : bevel ? 20 : speck + band));
        data[d + 2] = warm ? edge ? 101 : 55 : Math.max(0, color[2] + (edge ? 0 : bevel ? 28 : speck + band));
        data[d + 3] = 255;
    }
}

export class Renderer {
    readonly camera = new Camera();
    private ctx: CanvasRenderingContext2D;
    private terrainCanvas = document.createElement('canvas');
    private terrainCtx: CanvasRenderingContext2D;
    private terrainImage: ImageData;
    private miniCtx: CanvasRenderingContext2D;
    private paintedRevision = -1;
    private currentBattle: Battle | null = null;
    private theme = THEMES[0];
    private stars: { x: number; y: number; size: number; phase: number }[] = [];
    private buildings: { x: number; width: number; height: number; windows: number }[] = [];
    private ridges: number[] = [];
    private effects: Effect[] = [];
    private scars: Scar[] = [];
    private recoil = new Map<number, number>();
    private shake = 0;
    private dpr = 1;
    private tickCount = 0;
    private lastMiniPaint = -1;

    constructor(private canvas: HTMLCanvasElement, private minimap: HTMLCanvasElement) {
        this.ctx = canvas.getContext('2d')!;
        this.terrainCanvas.width = WIDTH; this.terrainCanvas.height = HEIGHT;
        this.terrainCtx = this.terrainCanvas.getContext('2d')!;
        this.terrainImage = this.terrainCtx.createImageData(WIDTH, HEIGHT);
        this.miniCtx = minimap.getContext('2d')!;
    }

    resize(width: number, height: number) {
        this.camera.resize(width, height);
        this.dpr = Math.min(2, window.devicePixelRatio || 1);
        this.canvas.width = Math.round(width * this.dpr); this.canvas.height = Math.round(height * this.dpr);
        this.ctx.imageSmoothingEnabled = false;
    }
    reset(battle: Battle) {
        this.currentBattle = battle; this.paintedRevision = -1; this.lastMiniPaint = -1;
        this.effects = []; this.scars = []; this.recoil.clear(); this.shake = 0; this.tickCount = 0;
        this.camera.overview(); this.camera.update(true); this.camera.manualUntil = 0;
        this.theme = themeFor(battle.mapKind);
        const random = createSeededRandom(battle.mapCode, 'atmosphere-v2');
        this.stars = Array.from({ length: 180 }, () => ({ x: random() * WIDTH, y: random() * 1250 - 800, size: random() > 0.9 ? 2 : 1, phase: random() * 6.28 }));
        this.buildings = Array.from({ length: 52 }, (_, i) => ({ x: i * 40 - 30, width: 18 + random() * 28, height: 12 + random() * 100, windows: Math.floor(random() * 99999) }));
        this.ridges = Array.from({ length: 34 }, () => 245 + random() * 125);
    }
    get paletteName() { return this.theme.name; }

    private effect(kind: Effect['kind'], x: number, y: number, color: string, life: number, extra: Partial<Effect> = {}) {
        this.effects.push({ kind, x, y, color, life, total: life, vx: 0, vy: 0, ...extra });
        if (this.effects.length > 650) this.effects.splice(0, this.effects.length - 650);
    }

    events(events: GameEvent[], battle: Battle, reducedMotion: boolean) {
        for (const e of events) {
            const color = e.team === undefined ? '#ffbe72' : COLORS[e.team];
            if (e.type === 'blast') {
                const radius = e.value || 55;
                this.scars.push({ x: e.x, y: e.y, radius });
                if (this.scars.length > 100) this.scars.shift();
                this.effect('ring', e.x, e.y, '#ffc37c', reducedMotion ? 10 : 28, { radius });
                if (!reducedMotion) {
                    this.shake = Math.min(6, this.shake + radius / 22);
                    this.effect('flash', e.x, e.y, '#ff9d4d', 18, { radius: radius * 2.4 });
                }
                for (let i = 0; i < (reducedMotion ? 8 : 42); i++) {
                    const angle = Math.random() * Math.PI * 2, speed = 1 + Math.random() * 5;
                    this.effect(i % 3 === 0 ? 'smoke' : i % 3 === 1 ? 'debris' : 'spark', e.x, e.y, i % 4 === 0 ? '#fff1c8' : i % 3 === 0 ? '#493452' : '#ff9d65', 25 + Math.random() * 35, { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1, radius: 2 + Math.random() * 3 });
                }
            }
            if (e.type === 'damage') {
                const existing = this.effects.find(effect => effect.kind === 'text' && effect.unit === e.unit && effect.life > 55);
                if (existing) { existing.value = (existing.value??0) + (e.value??0); existing.text = `−${existing.value}`; existing.life = 85; }
                else this.effect('text', e.x, e.y, '#fff4dd', 90, { vy: -0.3, text: `−${e.value}`, value: e.value, unit: e.unit });
                if (e.unit !== undefined) this.recoil.set(e.unit, 10);
            }
            if (e.type === 'death') {
                for (let i = 0; i < (reducedMotion ? 5 : 22); i++) this.effect('spark', e.x, e.y, color, 25 + Math.random() * 25, { vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4, radius: 2 });
                this.effect('bubble', e.x, e.y - 38, color, 150, { text: 'SIGNAL LOST' });
            }
            if (e.type === 'beam') this.effect('beam', e.x, e.y, e.value === 8 ? '#ffde9e' : '#8bffcc', e.value === 8 ? 9 : 17, { x2: e.x2, y2: e.y2, radius: e.value === 8 ? 1 : 3 });
            if (e.type === 'shot') {
                const u = battle.active;
                this.recoil.set(u.id, 8);
                if (!reducedMotion && [0, 1, 2, 3, 8].includes(e.value??-1)) this.effect('flash', u.x + Math.cos(battle.angle) * 20, u.y - 3 + Math.sin(battle.angle) * 20, '#ffe3a6', 7, { radius: 18 });
                if (Math.random() < 0.35 && e.value !== 9) this.effect('bubble', u.x, u.y - 38, COLORS[u.team], 130, { text: ['CHECK MY MATH.', 'CALCULATED. MOSTLY.', 'SPECIAL DELIVERY.'][Math.floor(Math.random() * 3)] });
            }
            if (e.type === 'pickup') this.effect('text', e.x, e.y - 24, '#a4ffb8', 100, { vy: -0.35, text: e.value === 6 ? 'PHASE SHIFT' : 'SUPPLY +' });
            if (e.type === 'jump' || e.type === 'bounce') for (let i = 0; i < 5; i++) this.effect('smoke', e.x, e.y + 6, '#667c91', 15 + Math.random() * 10, { vx: (Math.random() - 0.5) * 2, vy: -Math.random(), radius: 1.5 });
            if (e.type === 'splash') for (let i = 0; i < (reducedMotion ? 5 : 24) * (e.value ?? 1); i++) this.effect('spark', e.x, e.y, '#ffb26a', 25 + Math.random() * 20, { vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 6, radius: 2 });
        }
    }

    tick(battle: Battle, p: Preferences) {
        this.tickCount++;
        this.shake *= 0.86;
        for (const e of this.effects) {
            e.x += e.vx; e.y += e.vy; e.life--;
            if (e.kind === 'spark' || e.kind === 'debris') e.vy += 0.13;
            if (e.kind === 'smoke') { e.vx *= 0.98; e.vy -= 0.015; }
        }
        this.effects = this.effects.filter(e => e.life > 0);
        for (const [id, value] of this.recoil) { if (value <= 1) this.recoil.delete(id); else this.recoil.set(id, value - 1); }
        if (p.autoCamera && performance.now() > this.camera.manualUntil) {
            const projectile = battle.projectiles.find(projectile => projectile.delay <= 0 && projectile.kind !== 'bomblet');
            if (projectile) this.camera.focus(projectile.x, Math.min(400, projectile.y), this.camera.targetZoom);
            else if (battle.phase === 'aim' || battle.phase === 'retreat') {
                this.camera.focus(this.camera.targetZoom <= 1.03 ? WIDTH / 2 : battle.active.x, this.camera.targetZoom <= 1.03 ? HEIGHT / 2 : battle.active.y - 90);
            }
        }
        this.camera.update(p.reducedMotion);
    }

    private paintTerrain(battle: Battle) {
        if (this.paintedRevision === battle.terrain.revision) return;
        const pixels = battle.terrain.pixels, data = this.terrainImage.data;
        let left = 0, top = 0, right = WIDTH, bottom = HEIGHT;
        if (this.paintedRevision >= 0 && battle.terrain.revision - this.paintedRevision <= 128) {
            const changes = battle.terrain.changes.filter(change => change.revision > this.paintedRevision);
            if (changes.length) {
                left = Math.min(...changes.map(c => c.x)); top = Math.min(...changes.map(c => c.y));
                right = Math.min(WIDTH, Math.max(...changes.map(c => c.x + c.width)));
                bottom = Math.min(HEIGHT, Math.max(...changes.map(c => c.y + c.height)));
            }
        }
        rasterTerrain(pixels, data, this.theme, this.scars, left, top, right, bottom);
        this.terrainCtx.putImageData(this.terrainImage, 0, 0, left, top, right - left, bottom - top);
        this.paintedRevision = battle.terrain.revision;
    }

    draw(battle: Battle, p: Preferences, pointer: { x: number; y: number } | null, interactive: boolean, now: number) {
        if (this.currentBattle !== battle) this.reset(battle);
        this.paintTerrain(battle);
        const ctx = this.ctx, cam = this.camera, dpr = this.dpr;
        const time = p.reducedMotion ? 0 : now;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const sky = ctx.createLinearGradient(0, 0, 0, cam.height);
        sky.addColorStop(0, this.theme.top); sky.addColorStop(1, this.theme.bottom);
        ctx.fillStyle = sky; ctx.fillRect(0, 0, cam.width, cam.height);
        this.drawBackdrop(time);
        const shakeX = p.reducedMotion ? 0 : Math.sin(this.tickCount * 3.7) * this.shake;
        const shakeY = p.reducedMotion ? 0 : Math.cos(this.tickCount * 4.3) * this.shake * 0.6;
        ctx.setTransform(dpr * cam.scale, 0, 0, dpr * cam.scale, dpr * (cam.width / 2 - cam.x * cam.scale + shakeX), dpr * (cam.height / 2 - cam.y * cam.scale + shakeY));
        ctx.drawImage(this.terrainCanvas, 0, 0);
        this.drawLava(battle, time);
        for (const u of battle.units) this.drawUnit(battle, u, time);
        for (const crate of battle.crates) {
            const color = crate.kind === 'health' ? '#9dffc2' : '#ffd790';
            ctx.fillStyle = '#182738'; ctx.fillRect(crate.x - 10, crate.y - 9, 20, 18);
            ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.strokeRect(crate.x - 10, crate.y - 9, 20, 18);
            ctx.fillStyle = '#4c5360'; ctx.fillRect(crate.x - 9, crate.y - 8, 18, 3);
            ctx.fillStyle = color; ctx.fillRect(crate.x - 2, crate.y - 5, 4, 10); if (crate.kind === 'health') ctx.fillRect(crate.x - 5, crate.y - 2, 10, 4);
            if (crate.vy > 0.5) {
                ctx.strokeStyle = '#ab9bb4'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(crate.x - 18, crate.y - 28); ctx.lineTo(crate.x - 7, crate.y - 9); ctx.moveTo(crate.x + 18, crate.y - 28); ctx.lineTo(crate.x + 7, crate.y - 9); ctx.stroke();
                ctx.fillStyle = '#63506d'; ctx.fillRect(crate.x - 18, crate.y - 34, 36, 7); ctx.fillStyle = '#b59aab'; ctx.fillRect(crate.x - 18, crate.y - 35, 36, 2);
            }
        }
        if (battle.rope) {
            const rope = battle.rope, u = battle.units[rope.unit];
            ctx.strokeStyle = '#ffdf9a'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(u.x, u.y - 3); ctx.lineTo(rope.x, rope.y); ctx.stroke();
            ctx.fillStyle = '#fff2c9'; ctx.fillRect(rope.x - 3, rope.y - 3, 6, 6);
        }
        for (const projectile of battle.projectiles) {
            if (projectile.delay > 0) continue;
            const grenade = ['grenade', 'cluster', 'bomblet', 'dynamite'].includes(projectile.kind);
            const color = grenade ? '#b4e99a' : projectile.kind === 'air' ? '#9cf2ff' : '#ffd8a3';
            ctx.lineWidth = 1.5;
            for (let i = 1; i < projectile.trail.length; i++) {
                ctx.globalAlpha = i / projectile.trail.length * 0.6; ctx.strokeStyle = color;
                ctx.beginPath(); ctx.moveTo(projectile.trail[i - 1].x, projectile.trail[i - 1].y); ctx.lineTo(projectile.trail[i].x, projectile.trail[i].y); ctx.stroke();
            }
            ctx.globalAlpha = 1; ctx.save(); ctx.translate(projectile.x, projectile.y);
            if (projectile.kind === 'dynamite') {
                ctx.fillStyle = '#ed6979'; ctx.fillRect(-5, -5, 3, 9); ctx.fillRect(-1, -6, 3, 10); ctx.fillRect(3, -5, 3, 9);
                ctx.fillStyle = '#533848'; ctx.fillRect(-5, -1, 11, 2); ctx.fillStyle = '#fff4ba'; ctx.fillRect(0, -9, 2, 2);
            } else if (grenade) {
                ctx.rotate(projectile.age * 0.08); ctx.fillStyle = '#222f38'; ctx.fillRect(-4, -4, 8, 8);
                ctx.fillStyle = color; ctx.fillRect(-3, -3, 6, 6); ctx.fillStyle = '#617653'; ctx.fillRect(-3, 0, 6, 2);
                ctx.fillStyle = '#ffe3a3'; ctx.fillRect(-1, -6, 3, 2);
                if (projectile.kind === 'cluster') { ctx.fillStyle = '#6b8758'; ctx.fillRect(-1, -3, 2, 6); }
            } else {
                ctx.rotate(Math.atan2(projectile.vy, projectile.vx)); ctx.fillStyle = '#a9bdce'; ctx.fillRect(-6, -3, 10, 6);
                ctx.fillStyle = color; ctx.fillRect(4, -2, 3, 4); ctx.fillStyle = '#445568'; ctx.fillRect(-6, -5, 3, 10);
                ctx.fillStyle = '#ffb369'; ctx.fillRect(-10, -2, 4, 4); ctx.fillStyle = '#fff1a3'; ctx.fillRect(-8, -1, 2, 2);
            }
            ctx.restore();
            if (grenade && projectile.kind !== 'bomblet') {
                ctx.fillStyle = '#fff1c3'; ctx.font = 'bold 13px "Courier New"'; ctx.textAlign = 'center';
                ctx.fillText(String(Math.max(1, Math.ceil((projectile.fuse - projectile.age) / 60))), projectile.x, projectile.y - 15);
            }
        }
        if (interactive && battle.canAct) this.drawAim(battle, pointer, p.trajectoryGuide || battle.options.practice);
        this.drawEffects(false);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.drawLabels(battle);
        this.drawEffects(true);
        this.drawMinimap(battle);
    }

    private drawBackdrop(time: number) {
        const ctx = this.ctx, cam = this.camera, scale = cam.fitScale;
        ctx.save();
        ctx.translate(cam.width / 2 - WIDTH * scale / 2 - (cam.x - WIDTH / 2) * scale * 0.12, cam.height / 2 - HEIGHT * scale / 2 - (cam.y - HEIGHT / 2) * scale * 0.08);
        ctx.scale(scale, scale);
        for (const star of this.stars) {
            ctx.globalAlpha = 0.3 + (Math.sin(time / 1800 + star.phase) + 1) * 0.25;
            ctx.fillStyle = star.size > 1 ? '#e9b8f2' : '#85b8d4'; ctx.fillRect(star.x, star.y, star.size, star.size);
            if (star.size > 1) ctx.fillRect(star.x - 2, star.y + 1, 6, 1);
        }
        ctx.globalAlpha = 1;
        const sunX = WIDTH * 0.73, sunY = 110;
        const glow = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 160); glow.addColorStop(0, this.theme.sun + '27'); glow.addColorStop(1, this.theme.sun + '00');
        ctx.fillStyle = glow; ctx.fillRect(sunX - 160, sunY - 160, 320, 320);
        ctx.fillStyle = this.theme.sun;
        for (let y = -56; y <= 56; y += 3) {
            const half = Math.sqrt(Math.max(0, 56 * 56 - y * y));
            if (y > 0 && Math.floor(y / 3) % 3 === 0) continue;
            ctx.globalAlpha = y < 0 ? 0.7 : 0.55; ctx.fillRect(sunX - half, sunY + y, half * 2, 2);
        }
        ctx.globalAlpha = 0.35; ctx.strokeStyle = '#b9a0da'; ctx.lineWidth = 1;
        ctx.save(); ctx.translate(sunX, sunY); ctx.rotate(-0.25); ctx.scale(1, 0.24); ctx.beginPath(); ctx.ellipse(0, 0, 100, 56, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        ctx.globalAlpha = 1; ctx.fillStyle = this.theme.mountains;
        ctx.beginPath(); ctx.moveTo(-200, 720);
        this.ridges.forEach((y, i) => ctx.lineTo(i * 64 - 80, y)); ctx.lineTo(WIDTH + 200, 720); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#af8ca416'; ctx.lineWidth = 1; ctx.beginPath(); this.ridges.forEach((y, i) => i ? ctx.lineTo(i * 64 - 80, y) : ctx.moveTo(i * 64 - 80, y)); ctx.stroke();
        for (const b of this.buildings) {
            ctx.fillStyle = this.theme.city; ctx.fillRect(b.x, 405 - b.height, b.width, b.height + 120);
            ctx.fillStyle = '#597789'; ctx.globalAlpha = 0.28; ctx.fillRect(b.x, 405 - b.height, b.width, 1); ctx.globalAlpha = 1;
            for (let y = 410 - b.height; y < 400; y += 10) for (let x = b.x + 4; x < b.x + b.width - 3; x += 7) {
                if (hash(Math.floor(x), Math.floor(y) + b.windows) % 7 < 2) { ctx.fillStyle = (Math.floor(x + y) % 2) ? '#a979a655' : '#60baca55'; ctx.fillRect(x, y, 2, 3); }
            }
            if (b.height > 85) { ctx.fillStyle = '#5e4b78'; ctx.fillRect(b.x + b.width / 2, 395 - b.height, 1, 10); ctx.fillStyle = '#e979a0'; ctx.fillRect(b.x + b.width / 2, 393 - b.height, 2, 2); }
        }
        ctx.restore();
    }

    private drawLava(battle: Battle, time: number) {
        const ctx = this.ctx, y = battle.lava;
        const viewLeft = Math.min(0, this.camera.screenToWorld(0, 0).x);
        const viewRight = Math.max(WIDTH, this.camera.screenToWorld(this.camera.width, 0).x);
        const viewBottom = Math.max(HEIGHT, this.camera.screenToWorld(0, this.camera.height).y);
        const glow = ctx.createLinearGradient(0, y - 32, 0, y + 70); glow.addColorStop(0, '#ff7a3500'); glow.addColorStop(0.33, '#ff9f5560'); glow.addColorStop(1, '#ff4d0000');
        ctx.fillStyle = glow; ctx.fillRect(0, y - 32, WIDTH, 102);
        const lava = ctx.createLinearGradient(0, y, 0, HEIGHT); lava.addColorStop(0, '#ff9d53'); lava.addColorStop(0.07, '#f86d56'); lava.addColorStop(0.45, '#a7375c'); lava.addColorStop(1, '#421c49');
        ctx.fillStyle = lava; ctx.fillRect(viewLeft, y, viewRight - viewLeft, viewBottom - y);
        for (let row = 0; row < 8; row++) {
            ctx.fillStyle = row % 2 === 0 ? '#ffc77b40' : '#e8827130';
            for (let x = 0; x < WIDTH; x += 58) {
                const drift = (time / (80 + row * 13) + row * 25) % 58;
                ctx.fillRect(x + drift - 58, y + 4 + row * 8 + Math.sin(x * 0.015 + time / 900) * 2, 12 + (hash(x, row) % 25), row === 0 ? 2 : 1);
            }
        }
        ctx.fillStyle = '#ffe5a0';
        for (let x = 0; x < WIDTH; x += 10) ctx.fillRect(x, y + Math.sin(x * 0.04 + time / 600) * 1.4, 10, 2);
    }

    private drawUnit(battle: Battle, u: Unit, time: number) {
        const ctx = this.ctx, color = COLORS[u.team];
        if (u.dead) {
            const y = battle.terrain.surface(u.x, u.y + 8) - 10;
            if (y + 9 < battle.lava) {
                ctx.fillStyle = '#202534'; ctx.fillRect(u.x - 10, y - 2, 20, 10); ctx.fillRect(u.x - 6, y - 12, 12, 15);
                ctx.strokeStyle = '#657385'; ctx.lineWidth = 1; ctx.strokeRect(u.x - 6, y - 12, 12, 15);
                ctx.fillStyle = color + '80'; ctx.fillRect(u.x - 3, y - 8, 6, 2); ctx.fillRect(u.x - 1, y - 10, 2, 6);
            }
            return;
        }
        ctx.save(); ctx.translate(Math.round(u.x), Math.round(u.y));
        if (u.chute) {
            ctx.strokeStyle = '#c1bacf'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-17, -30); ctx.lineTo(-5, -7); ctx.moveTo(17, -30); ctx.lineTo(5, -7); ctx.stroke();
            ctx.fillStyle = '#e8d4cb'; ctx.fillRect(-17, -39, 34, 9); ctx.fillStyle = color; ctx.fillRect(-8, -39, 8, 9); ctx.fillRect(8, -39, 8, 9); ctx.fillStyle = '#e8d4cb'; ctx.fillRect(-11, -43, 22, 4);
        }
        if (u.id === battle.activeId && battle.phase !== 'over') {
            ctx.globalAlpha = 0.2; ctx.fillStyle = color; ctx.fillRect(-18, 12, 36, 2); ctx.globalAlpha = 1;
        }
        const bob = u.grounded && Math.abs(u.vx) > 0.2 ? Math.floor(Math.sin(u.anim * 0.5)) : 0;
        ctx.translate(0, bob);
        ctx.fillStyle = '#070d1a'; ctx.fillRect(-15, 3, 30, 9); ctx.fillStyle = '#445069'; ctx.fillRect(-14, 4, 28, 7);
        ctx.fillStyle = '#0d1626';
        for (let x = -11; x <= 11; x += 7) { ctx.fillRect(x - 2, 5, 5, 5); ctx.fillStyle = '#758299'; ctx.fillRect(x, 6, 2, 2); ctx.fillStyle = '#0d1626'; }
        ctx.fillStyle = color; const tread = Math.floor(u.anim / 2) % 5;
        for (let x = -13 + tread; x < 13; x += 5) ctx.fillRect(x, 11, 3, 1);
        ctx.fillStyle = '#263650'; ctx.fillRect(-13, -3, 26, 8); ctx.fillRect(-10, -6, 20, 4);
        ctx.fillStyle = '#57637d'; ctx.fillRect(-11, -5, 22, 2); ctx.fillStyle = color; ctx.fillRect(-13, 1, 26, 2); ctx.fillRect(-14, -1, 3, 5); ctx.fillRect(11, -1, 3, 5);
        ctx.fillStyle = '#13243a'; ctx.fillRect(-6, -13, 13, 9); ctx.fillStyle = '#60718a'; ctx.fillRect(-5, -14, 11, 2);
        ctx.fillStyle = '#e5f9ff'; ctx.fillRect(u.facing > 0 ? 1 : -4, -11, 4, 3); ctx.fillStyle = color; ctx.fillRect(-5, -7, 11, 2);
        ctx.fillStyle = '#42526c'; ctx.fillRect(-7, -18, 1, 6); ctx.fillStyle = color; ctx.fillRect(-8, -20, 3, 3);
        ctx.save(); ctx.translate(1, -5); ctx.rotate(u.facing === 1 ? -u.elevation : Math.PI + u.elevation);
        const recoil = this.recoil.get(u.id) || 0;
        ctx.translate(recoil ? -2 : 0, 0); ctx.fillStyle = '#142137'; ctx.fillRect(0, -3, 18, 6); ctx.fillStyle = '#8290a4'; ctx.fillRect(3, -3, 13, 2); ctx.fillStyle = color; ctx.fillRect(15, -3, 3, 6); ctx.restore();
        if (u.hp < 35 && Math.floor(time / 500) % 2 === 0) { ctx.fillStyle = '#ffd390'; ctx.fillRect(-4, -9, 2, 2); }
        if (u === battle.active && battle.jetUsed && !u.grounded && u.vy < -1 && battle.weapon === 5) {
            ctx.fillStyle = '#ffad78'; ctx.fillRect(-8, 12, 5, 7 + (Math.floor(time / 60) % 4)); ctx.fillRect(4, 12, 5, 7 + (Math.floor(time / 80) % 4));
            ctx.fillStyle = '#c4f5ff'; ctx.fillRect(-7, 12, 3, 4); ctx.fillRect(5, 12, 3, 4);
        }
        ctx.restore();
    }

    private drawAim(battle: Battle, pointer: { x: number; y: number } | null, guide: boolean) {
        const ctx = this.ctx, u = battle.active, angle = battle.angle;
        ctx.strokeStyle = COLORS[battle.team]; ctx.lineWidth = 1;
        if ([4, 6].includes(battle.weapon)) {
            if (!pointer) return;
            const x = Math.max(30, Math.min(WIDTH - 30, pointer.x));
            const y = battle.weapon === 6 ? battle.terrain.surface(x, pointer.y) - 10 : pointer.y;
            const valid = battle.weapon !== 6 || (y < battle.lava - 10 && !battle.bodyBlocked(x, y) && !battle.units.some(other => other !== u && !other.dead && Math.hypot(other.x - x, other.y - y) < 24));
            ctx.strokeStyle = valid ? '#b0ffdb' : '#ff8f9e'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(x, -700); ctx.lineTo(x, battle.lava); ctx.stroke(); ctx.setLineDash([]);
            ctx.strokeRect(x - 13, y - 13, 26, 26); ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x + 20, y); ctx.moveTo(x, y - 20); ctx.lineTo(x, y + 20); ctx.stroke();
            return;
        }
        if ([5, 9].includes(battle.weapon) || battle.rope) return;
        const length = battle.weapon === 7 ? 130 : 68;
        ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(u.x + Math.cos(angle) * 24, u.y - 3 + Math.sin(angle) * 24); ctx.lineTo(u.x + Math.cos(angle) * length, u.y - 3 + Math.sin(angle) * length); ctx.stroke(); ctx.setLineDash([]);
        const ax = u.x + Math.cos(angle) * length, ay = u.y - 3 + Math.sin(angle) * length;
        ctx.strokeRect(ax - 4, ay - 4, 8, 8);
        if (guide && battle.weapon < 3) {
            const power = battle.charging ? battle.power : MAX_POWER * 0.55;
            let x = u.x + Math.cos(angle) * 19, y = u.y - 3 + Math.sin(angle) * 19;
            let vx = Math.cos(angle) * power, vy = Math.sin(angle) * power;
            ctx.fillStyle = '#d7e6e8';
            for (let tick = 0; tick < 100; tick++) {
                if (battle.weapon === 0) vx += battle.wind; vy += GRAVITY; x += vx; y += vy;
                if (battle.terrain.solid(x, y) || y > battle.lava) break;
                if (tick % 5 === 0) { ctx.globalAlpha = 0.65 * (1 - tick / 110); ctx.fillRect(x - 1, y - 1, 2, 2); }
            }
            ctx.globalAlpha = 1;
        }
    }

    private drawEffects(screenSpace: boolean) {
        const ctx = this.ctx;
        for (const e of this.effects) {
            const isLabel = e.kind === 'text' || e.kind === 'bubble';
            if (screenSpace !== isLabel) continue;
            ctx.save(); ctx.globalAlpha = Math.min(1, e.life / (e.total * 0.4)); ctx.fillStyle = e.color; ctx.strokeStyle = e.color;
            const progress = 1 - e.life / e.total;
            if (e.kind === 'spark' || e.kind === 'debris') { const size = e.radius || 2; ctx.fillRect(Math.round(e.x), Math.round(e.y), size, size); }
            if (e.kind === 'smoke') { ctx.globalAlpha *= 0.5; const radius = (e.radius || 3) * (1 + progress * 1.5); ctx.fillRect(e.x - radius, e.y - radius, radius * 2, radius * 2); }
            if (e.kind === 'ring') { ctx.lineWidth = 3 * (1 - progress); ctx.beginPath(); ctx.arc(e.x, e.y, 4 + (e.radius??0) * progress, 0, Math.PI * 2); ctx.stroke(); }
            if (e.kind === 'flash') {
                const radius = (e.radius??0) * (0.6 + progress * 0.4), glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, radius);
                glow.addColorStop(0, e.color + 'a0'); glow.addColorStop(0.4, e.color + '50'); glow.addColorStop(1, e.color + '00');
                ctx.fillStyle = glow; ctx.globalCompositeOperation = 'screen'; ctx.fillRect(e.x - radius, e.y - radius, radius * 2, radius * 2);
            }
            if (e.kind === 'beam') { ctx.lineWidth = e.radius??1; ctx.shadowBlur = 6; ctx.shadowColor = e.color; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x2??e.x, e.y2??e.y); ctx.stroke(); }
            if (isLabel) {
                const point = this.camera.worldToScreen(e.x, e.y);
                if (e.kind === 'text') { ctx.font = 'bold 16px "Courier New"'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#0b1326'; ctx.strokeText(e.text??'', point.x, point.y); ctx.fillText(e.text??'', point.x, point.y); }
                else {
                    ctx.font = 'bold 10px "Courier New"'; const width = ctx.measureText(e.text??'').width + 16;
                    ctx.fillStyle = '#101b2be8'; ctx.fillRect(point.x - width / 2, point.y - 12, width, 20); ctx.strokeStyle = e.color + '80'; ctx.lineWidth = 1; ctx.strokeRect(point.x - width / 2, point.y - 12, width, 20);
                    ctx.fillStyle = e.color; ctx.textAlign = 'center'; ctx.fillText(e.text??'', point.x, point.y + 1);
                }
            }
            ctx.restore();
        }
    }

    private drawLabels(battle: Battle) {
        const ctx = this.ctx, cam = this.camera;
        for (const u of battle.units) {
            if (u.dead) continue;
            const p = cam.worldToScreen(u.x, u.y), active = u.id === battle.activeId && battle.phase !== 'over';
            if (p.x < -35 || p.x > cam.width + 35 || p.y < 0 || p.y > cam.height + 20) continue;
            const y = p.y - Math.max(26, cam.scale * 24);
            ctx.font = `${active ? 'bold ' : ''}11px "Courier New"`; ctx.textAlign = 'center';
            const width = Math.max(40, ctx.measureText(u.name).width + 12);
            ctx.fillStyle = '#0a1221cf'; ctx.fillRect(p.x - width / 2, y - 17, width, 32);
            ctx.fillStyle = COLORS[u.team]; ctx.fillText(u.name, p.x, y - 5);
            ctx.fillStyle = '#344253'; ctx.fillRect(p.x - 17, y, 34, 3); ctx.fillStyle = COLORS[u.team]; ctx.fillRect(p.x - 17, y, 34 * u.hp / 100, 3);
            ctx.font = '9px "Courier New"'; ctx.fillStyle = '#e0ebf4'; ctx.fillText(`${u.hp}`, p.x, y + 12);
            if (active) { ctx.fillStyle = COLORS[u.team]; ctx.beginPath(); ctx.moveTo(p.x, y - 21); ctx.lineTo(p.x - 4, y - 27); ctx.lineTo(p.x + 4, y - 27); ctx.fill(); }
        }
    }

    private drawMinimap(battle: Battle) {
        if (this.lastMiniPaint === this.tickCount && this.paintedRevision >= 0) return;
        const ctx = this.miniCtx, w = this.minimap.width, h = this.minimap.height;
        ctx.fillStyle = '#091323'; ctx.fillRect(0, 0, w, h); ctx.drawImage(this.terrainCanvas, 0, 0, w, h);
        ctx.fillStyle = '#c36d65'; ctx.fillRect(0, battle.lava / HEIGHT * h, w, h - battle.lava / HEIGHT * h);
        for (const u of battle.units) if (!u.dead) { ctx.fillStyle = COLORS[u.team]; ctx.fillRect(u.x / WIDTH * w - 2, u.y / HEIGHT * h - 3, 4, 4); }
        for (const projectile of battle.projectiles) if (projectile.delay <= 0) { ctx.fillStyle = '#fff2b2'; ctx.fillRect(projectile.x / WIDTH * w - 1, Math.max(1, projectile.y / HEIGHT * h), 2, 2); }
        const topLeft = this.camera.screenToWorld(0, 0), bottomRight = this.camera.screenToWorld(this.camera.width, this.camera.height);
        ctx.strokeStyle = '#edf5fcaa'; ctx.lineWidth = 1; ctx.strokeRect(Math.max(0, topLeft.x) / WIDTH * w + 0.5, Math.max(0, topLeft.y) / HEIGHT * h + 0.5, (Math.min(WIDTH, bottomRight.x) - Math.max(0, topLeft.x)) / WIDTH * w - 1, (Math.min(HEIGHT, bottomRight.y) - Math.max(0, topLeft.y)) / HEIGHT * h - 1);
        this.lastMiniPaint = this.tickCount;
    }

    drawPreview(map: ReturnType<typeof import('./maps').generateMap>, canvas: HTMLCanvasElement) {
        // A workshop preview never resets the live battle's camera, craters,
        // particles, or render cache. Resume returns to the same tactical view.
        const terrain = document.createElement('canvas'); terrain.width = WIDTH; terrain.height = HEIGHT;
        const terrainCtx = terrain.getContext('2d')!, image = terrainCtx.createImageData(WIDTH, HEIGHT);
        const theme = themeFor(map.kind);
        rasterTerrain(map.pixels, image.data, theme, [], 0, 0, WIDTH, HEIGHT); terrainCtx.putImageData(image, 0, 0);
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        const sky = ctx.createLinearGradient(0, 0, 0, canvas.height); sky.addColorStop(0, theme.top); sky.addColorStop(1, theme.bottom);
        ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(terrain, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ec8a65'; ctx.fillRect(0, 642 / HEIGHT * canvas.height, canvas.width, (HEIGHT - 642) / HEIGHT * canvas.height);
        for (const spawn of map.spawns) { ctx.fillStyle = COLORS[spawn.team]; ctx.fillRect(spawn.x / WIDTH * canvas.width - 3, spawn.y / HEIGHT * canvas.height - 4, 6, 4); ctx.fillRect(spawn.x / WIDTH * canvas.width, spawn.y / HEIGHT * canvas.height - 11, 1, 5); }
    }
}
