import { isRecord, whole } from './cards.ts';
import { CRASH_DURATION, JOINT, newSkiCrash, stepSkiCrash, validSkiCrash } from './ski-ragdoll.ts';
import type { SkiCrash } from './ski-ragdoll.ts';
export type SkiMode = 'free' | 'slalom' | 'freestyle';
export interface SkiObject { x: number; y: number; kind: 'tree' | 'rock' | 'ramp' | 'gate'; passed: boolean; cleared?: boolean }
export type YetiPhase = 'announce' | 'chase' | 'windup' | 'pounce' | 'recover' | 'feast';
export interface SkiYeti { x: number; y: number; phase: YetiPhase; time: number; fromX: number; fromY: number; targetX: number; targetY: number }
export interface SkiSession {
  mode: SkiMode; x: number; y: number; speed: number; elapsed: number; score: number; misses: number; gates: number;
  jump: number; spins: number; tumble: number; velocity: number; cooldown: number; status: 'ready' | 'skiing' | 'caught' | 'finished';
  objects: SkiObject[]; generated: number; yeti: SkiYeti | null; crash: SkiCrash | null; grace: number; jumpDuration: number; jumpPeak: number; captureAge: number;
  best: { distance: number; freestyle: number; slalom: number | null };
}
export interface SkiInput { steer: number; brake: boolean; jump: boolean; fast: boolean }
export function newSki(mode: SkiMode = 'free', best: SkiSession['best'] = { distance: 0, freestyle: 0, slalom: null }): SkiSession {
  const objects: SkiObject[] = [{ kind: 'tree', x: 80, y: 120, passed: false }, { kind: 'tree', x: 510, y: 230, passed: false }, { kind: 'rock', x: 135, y: 290, passed: false }, { kind: mode === 'slalom' ? 'gate' : 'ramp', x: mode === 'slalom' ? 300 : 350, y: 355, passed: false }, { kind: 'tree', x: 65, y: 435, passed: false }];
  return { mode, x: 300, y: 0, speed: 0, elapsed: 0, score: 0, misses: 0, gates: 0, jump: 0, spins: 0, tumble: 0, velocity: 0, cooldown: 0, status: 'ready', objects, generated: 440, yeti: null, crash: null, grace: 0, jumpDuration: 1.1, jumpPeak: 36, captureAge: 0, best: { ...best } };
}
export const skiDistance = (s: SkiSession): number => Math.floor(s.y / 3);
export const skiVariant = (o: Pick<SkiObject, 'x' | 'y'>): number => Math.abs(Math.imul(Math.floor(o.x * 7), 73856093) ^ Math.imul(Math.floor(o.y), 19349663)) % 4;
export function skiJumpHeight(s: SkiSession): number { const t = s.jump ? 1 - s.jump / s.jumpDuration : 0; return s.jump ? Math.sin(Math.max(0, t) * Math.PI) * s.jumpPeak + (s.jumpPeak > 50 ? Math.max(0, 1 - t * 3) * 12 : 0) : 0; }
export function crashSkier(s: SkiSession, direction: number): void { s.crash = newSkiCrash(s.x, s.y, s.speed, s.velocity, direction); s.tumble = CRASH_DURATION; s.jump = 0; s.score = Math.max(0, s.score - 50); }
export function newSkiYeti(s: SkiSession): SkiYeti { return { x: 300, y: s.y - 155, phase: 'announce', time: 0, fromX: 300, fromY: s.y - 155, targetX: s.x, targetY: s.y }; }
export const SKI_CAPTURE_DURATION = 3.2;
export function stepSki(s: SkiSession, input: SkiInput, dt: number, random = Math.random): void {
  if (dt <= 0 || !['skiing', 'caught'].includes(s.status)) return;
  if (s.status === 'caught') { const amount = Math.min(.25, dt); s.captureAge = Math.min(SKI_CAPTURE_DURATION, s.captureAge + amount); if (s.yeti) s.yeti.time += amount; return; }
  let remaining = Math.min(.25, dt), first = true;
  while (remaining > .000001 && s.status === 'skiing') { const slice = Math.min(.05, remaining); skiFrame(s, { ...input, jump: first && input.jump }, slice, random); remaining -= slice; first = false; }
}
function skiFrame(s: SkiSession, input: SkiInput, dt: number, random: () => number): void {
  s.elapsed += dt;
  const steer = Math.max(-1, Math.min(1, input.steer));
  const braking = input.brake && !s.jump && !s.crash;
  const target = s.tumble > 0 ? 35 : braking ? 0 : input.fast ? 430 : 235 - Math.abs(steer) * 40;
  s.speed += (target - s.speed) * Math.min(1, dt * (braking ? 5 : 3));
  if (braking && s.speed < 1) s.speed = 0;
  const oldX = s.x;
  s.velocity += (steer * (s.tumble > 0 ? 30 : input.brake ? 155 : 255) - s.velocity) * Math.min(1, dt * (s.jump ? 4 : 10));
  const oldY = s.y;
  if (s.crash) {
    stepSkiCrash(s.crash, dt); const root = s.crash.nodes[JOINT.hip]; s.x = root.x; s.y = Math.max(s.y, root.y); s.speed = Math.max(0, (s.y - oldY) / dt); s.tumble = Math.max(0, CRASH_DURATION - s.crash.age);
    if (s.crash.age >= CRASH_DURATION) { s.crash = null; s.tumble = 0; s.speed = 35; s.velocity = 0; s.grace = .65; }
  } else { s.x = Math.max(18, Math.min(582, s.x + s.velocity * dt)); s.y += s.speed * dt; s.tumble = 0; }
  s.grace = Math.max(0, s.grace - dt);
  s.cooldown = Math.max(0, s.cooldown - dt);
  let landing = 0;
  if (input.jump && s.jump === 0 && s.tumble === 0 && !s.cooldown) { s.jump = s.jumpDuration = 1.1; s.jumpPeak = 36; s.spins = 0; }
  if (s.jump > 0) {
    s.spins += Math.abs(s.x - oldX) / 255; s.jump = Math.max(0, s.jump - dt);
    if (!s.jump) { landing = 100 + Math.floor(s.spins * 2) * 100; s.cooldown = .35; }
  }
  while (s.generated < s.y + 950) {
    s.generated += 110;
    const row = Math.floor(s.generated / 110);
    if (s.mode === 'slalom' && row % 3 === 0) {
      const previous = s.objects.slice().reverse().find(o => o.kind === 'gate')?.x ?? 300;
      s.objects.push({ kind: 'gate', x: Math.max(100, Math.min(500, previous + (random() - .5) * 300)), y: s.generated, passed: false });
    }
    else {
      for (let i = 0; i < (s.mode === 'slalom' ? 1 : 2); i++) {
        let x = 25 + random() * 550;
        if (row <= 3 && Math.abs(x - 300) < 65) x += x < 300 ? -80 : 80;
        s.objects.push({ kind: s.mode !== 'slalom' && row % 9 === 4 && i === 0 ? 'ramp' : random() < .1 ? 'ramp' : random() < .67 ? 'tree' : 'rock', x, y: s.generated + random() * 50, passed: false });
      }
    }
  }
  for (const object of s.objects) {
    if (object.passed) continue;
    if (object.kind === 'gate') {
      if (oldY < object.y && s.y >= object.y) { object.passed = true; const crossingX = oldX + (s.x - oldX) * (object.y - oldY) / (s.y - oldY); object.cleared = Math.abs(crossingX - object.x) <= 72; if (object.cleared) { s.gates++; s.score += 50; } else s.misses++; }
    } else if (!s.crash && !s.grace && oldY <= object.y + 10 && s.y >= object.y - 10) {
      const crossing = Math.max(0, Math.min(1, (object.y - oldY) / (s.y - oldY || 1))), x = oldX + (s.x - oldX) * crossing;
      if (Math.abs(x - object.x) >= (object.kind === 'ramp' ? 24 : object.kind === 'tree' ? 19 : 20)) continue;
      if (object.kind === 'ramp' && oldY <= object.y && s.y >= object.y && !s.jump) { s.jump = s.jumpDuration = 1.6; s.jumpPeak = 78; s.spins = 1; object.passed = true; }
      else if (object.kind !== 'ramp' && skiJumpHeight(s) < (object.kind === 'tree' ? [58, 70, 49, 37][skiVariant(object)] : [14, 20, 16, 18][skiVariant(object)])) { crashSkier(s, x >= object.x ? 1 : -1); object.passed = true; }
    }
  }
  if (landing && !s.crash) s.score += landing;
  s.objects = s.objects.filter(o => o.y > s.y - 300);
  const distance = skiDistance(s);
  s.best.distance = Math.max(s.best.distance, distance);
  if (s.mode !== 'free' && distance >= 1000) {
    s.status = 'finished';
    if (s.mode === 'slalom') s.best.slalom = Math.min(s.best.slalom ?? Infinity, s.elapsed + s.misses * 3);
    else s.best.freestyle = Math.max(s.best.freestyle, s.score);
  }
  if (s.mode === 'free' && distance >= 2000) {
    s.yeti ??= newSkiYeti(s); stepYeti(s, dt);
  }
}
function stepYeti(s: SkiSession, dt: number): void {
  const y = s.yeti!; y.time += dt;
  if (y.phase === 'announce') { y.y = s.y - 135; y.x += Math.max(-160 * dt, Math.min(160 * dt, s.x - y.x)); if (y.time >= 1.15) { y.phase = 'chase'; y.time = 0; } }
  else if (y.phase === 'chase') {
    y.y += 360 * dt; y.x += Math.max(-285 * dt, Math.min(285 * dt, (s.x - y.x) * dt * 2.8));
    if (s.y - y.y < 78 && Math.abs(s.x - y.x) < 85) { y.phase = 'windup'; y.time = 0; }
  } else if (y.phase === 'windup') {
    y.y += Math.min(180, s.speed * .7) * dt;
    if (y.time >= .6) { y.phase = 'pounce'; y.time = 0; y.fromX = y.x; y.fromY = y.y; y.targetX = Math.max(20, Math.min(580, s.x + s.velocity * .55)); y.targetY = s.y + s.speed * .65; }
  } else if (y.phase === 'pounce') {
    const t = Math.min(1, y.time / .65); y.x = y.fromX + (y.targetX - y.fromX) * t; y.y = y.fromY + (y.targetY - y.fromY) * t;
    if (t >= 1) {
      if (Math.abs(y.x - s.x) < 38 && Math.abs(y.y - s.y) < 65 && skiJumpHeight(s) < 55) { s.status = 'caught'; s.captureAge = 0; s.speed = 0; s.crash = null; s.tumble = 0; y.phase = 'feast'; y.time = 0; }
      else { y.phase = 'recover'; y.time = 0; }
    }
  } else if (y.phase === 'recover') { y.y += 80 * dt; if (y.time >= 1) { y.phase = 'chase'; y.time = 0; } }
}
export function restoreSki(value: unknown): SkiSession | null {
  if (!isRecord(value) || !['free', 'slalom', 'freestyle'].includes(value.mode as string) || !['ready', 'skiing', 'caught', 'finished'].includes(value.status as string)) return null;
  const finite = (n: unknown, min: number, max: number): boolean => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (!finite(value.x, 0, 600) || !finite(value.y, 0, 1000000000) || !finite(value.speed, 0, 1000) || !finite(value.elapsed, 0, 10000000) || !whole(value.score, 0, 100000000) || !whole(value.misses, 0, 10000000) || !whole(value.gates, 0, 10000000) || !finite(value.jump, 0, 2) || !finite(value.spins, 0, 10) || !finite(value.tumble, 0, 3) || !finite(value.generated, 0, 1000000000)
    || !Array.isArray(value.objects) || value.objects.length > 100 || !value.objects.every(o => isRecord(o) && finite(o.x, 0, 600) && finite(o.y, 0, 1000000000) && ['tree', 'rock', 'ramp', 'gate'].includes(o.kind as string) && typeof o.passed === 'boolean')
    || (value.yeti !== null && (!isRecord(value.yeti) || !finite(value.yeti.x, 0, 600) || !finite(value.yeti.y, 0, 1000000000))) || !isRecord(value.best) || !finite(value.best.distance, 0, 1000000000) || !finite(value.best.freestyle, 0, 100000000) || (value.best.slalom !== null && !finite(value.best.slalom, 0, 10000000))) return null;
  if ((value.velocity !== undefined && !finite(value.velocity, -300, 300)) || (value.cooldown !== undefined && !finite(value.cooldown, 0, 1))) return null;
  if ((value.crash !== undefined && value.crash !== null && !validSkiCrash(value.crash)) || (value.grace !== undefined && !finite(value.grace, 0, 1)) || (value.jumpDuration !== undefined && !finite(value.jumpDuration, .5, 2)) || (value.jumpPeak !== undefined && !finite(value.jumpPeak, 0, 100)) || (value.captureAge !== undefined && !finite(value.captureAge, 0, SKI_CAPTURE_DURATION))) return null;
  let yeti: SkiYeti | null = null;
  if (isRecord(value.yeti)) {
    const y = value.yeti;
    if (y.phase !== undefined && (!['announce', 'chase', 'windup', 'pounce', 'recover', 'feast'].includes(y.phase as string) || !finite(y.time, 0, 10000000) || !['fromX', 'fromY', 'targetX', 'targetY'].every(k => finite(y[k], -1000, 1e9)))) return null;
    yeti = y.phase === undefined ? { x: y.x as number, y: y.y as number, phase: value.status === 'caught' ? 'feast' : 'chase', time: 0, fromX: y.x as number, fromY: y.y as number, targetX: value.x as number, targetY: value.y as number } : y as unknown as SkiYeti;
  }
  const s = { ...value, velocity: value.velocity ?? 0, cooldown: value.cooldown ?? 0, crash: value.crash ?? null, grace: value.grace ?? 0, jumpDuration: value.jumpDuration ?? Math.max(1.1, value.jump as number), jumpPeak: value.jumpPeak ?? 36, captureAge: value.captureAge ?? (value.status === 'caught' ? SKI_CAPTURE_DURATION : 0), yeti } as unknown as SkiSession;
  if (s.jump > s.jumpDuration) return null;
  if (!s.crash && s.tumble > 0 && s.status === 'skiing') { s.crash = newSkiCrash(s.x, s.y, s.speed, s.velocity, 1); s.tumble = CRASH_DURATION; }
  return s;
}
