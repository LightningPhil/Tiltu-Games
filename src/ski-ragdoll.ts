export const CRASH_DURATION = 2.35;
export const JOINT = { hip: 0, chest: 1, head: 2, leftShoulder: 3, rightShoulder: 4, leftElbow: 5, rightElbow: 6, leftHand: 7, rightHand: 8, leftKnee: 9, rightKnee: 10, leftBoot: 11, rightBoot: 12 } as const;
export interface SkiJoint { x: number; y: number; z: number; px: number; py: number; pz: number }
export interface SkiCrash { age: number; step: number; remainder?: number; direction: number; impact: number; nodes: SkiJoint[]; loose: SkiJoint[]; angle: number }
const standing = [[0, 0, 23], [0, -2, 40], [0, -2, 55], [-7, -2, 39], [7, -2, 39], [-13, 1, 28], [13, 1, 28], [-19, 9, 18], [19, 9, 18], [-5, 5, 12], [5, 5, 12], [-8, 11, 2], [8, 11, 2]];
const pairs = [[0, 1], [1, 2], [1, 3], [1, 4], [3, 4], [3, 5], [5, 7], [4, 6], [6, 8], [0, 9], [9, 11], [0, 10], [10, 12], [9, 10], [0, 3], [0, 4]];
const lengths = pairs.map(([a, b]) => Math.hypot(...standing[a].map((n, i) => n - standing[b][i])));
const H = 1 / 120;
export function newSkiCrash(x: number, y: number, speed: number, sideways: number, direction: number): SkiCrash {
  const sign = direction >= 0 ? 1 : -1;
  const node = (dx: number, dy: number, z: number, vx: number, vy: number, vz: number): SkiJoint => ({ x: x + dx, y: y + dy, z, px: x + dx - vx * H, py: y + dy - vy * H, pz: z - vz * H });
  return { age: 0, step: H, remainder: 0, direction: sign, impact: speed, angle: sign * .4,
    nodes: standing.map(([dx, dy, z], i) => node(dx, dy, z, sideways * .5 + sign * (i <= 4 ? 105 : 25), speed * (i <= 4 ? .7 : .28) + 25, i === 0 ? 130 : i >= 9 ? 45 : -60)),
    loose: [node(-17, 8, 14, sideways - sign * 130, speed * .6, 150), node(8, 11, 3, sideways + sign * 90, speed * .5, 80)] };
}
function integrate(n: SkiJoint, h: number, previous: number): void {
  const factor = h / previous, drag = Math.exp(-1.1 * h), vx = (n.x - n.px) * factor * drag, vy = (n.y - n.py) * factor * drag, vz = (n.z - n.pz) * factor * drag;
  n.px = n.x; n.py = n.y; n.pz = n.z;
  n.x += vx; n.y += vy; n.z += vz - 880 * h * h;
}
function ground(n: SkiJoint, radius: number): void {
  if (n.z < radius) {
    const vz = n.z - n.pz; n.z = radius; n.pz = n.z + Math.min(0, vz) * .13;
    n.px = n.x - (n.x - n.px) * .83; n.py = n.y - (n.y - n.py) * .83;
  }
  if (n.x < 8 || n.x > 592) { n.x = Math.max(8, Math.min(592, n.x)); n.px = n.x; }
}
export function stepSkiCrash(crash: SkiCrash, dt: number): void {
  // Constraint corrections are positional. A tiny fractional step followed by a
  // full step can multiply those corrections into enormous Verlet velocities.
  // Accumulate fractional time and solve at a fixed 120 Hz instead.
  let remaining = (crash.remainder ?? 0) + Math.max(0, Math.min(.25, dt));
  while (remaining + 1e-9 >= H) {
    const h = H; remaining = Math.max(0, remaining - h); crash.age += h;
    crash.nodes.forEach(n => integrate(n, h, crash.step)); crash.loose.forEach(n => integrate(n, h, crash.step));
    for (let iteration = 0; iteration < 7; iteration++) {
      pairs.forEach(([ai, bi], index) => {
        const a = crash.nodes[ai], b = crash.nodes[bi], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, distance = Math.hypot(dx, dy, dz) || .001;
        const amount = (distance - lengths[index]) / distance * .48;
        a.x += dx * amount; a.y += dy * amount; a.z += dz * amount; b.x -= dx * amount; b.y -= dy * amount; b.z -= dz * amount;
      });
      crash.nodes.forEach((n, i) => ground(n, i === JOINT.head ? 5 : i <= 4 ? 3 : 1));
    }
    crash.loose.forEach(n => ground(n, 1)); crash.angle += crash.direction * h * Math.max(0, 1 - crash.age / 1.2) * 3.5; crash.step = h;
  }
  crash.remainder = remaining;
}
/** Getting up uses braced hands, then bent knees, then an upright torso. */
export function skiCrashPose(crash: SkiCrash): { x: number; y: number; z: number }[] {
  const start = 1.35, t = Math.max(0, Math.min(1, (crash.age - start) / (CRASH_DURATION - start)));
  if (!t) return crash.nodes;
  const hip = crash.nodes[JOINT.hip], smooth = t * t * (3 - 2 * t);
  return crash.nodes.map((n, i) => {
    const [x, y, z] = standing[i], hands = i === JOINT.leftHand || i === JOINT.rightHand, knees = i === JOINT.leftKnee || i === JOINT.rightKnee;
    const lift = hands ? Math.max(0, (t - .5) * 2) : i === JOINT.hip ? Math.max(0, (t - .2) / .8) : smooth;
    const targetZ = knees && t < .7 ? 5 + t * 8 : z;
    return { x: n.x + (hip.x + x - n.x) * smooth, y: n.y + (hip.y + y - n.y) * smooth, z: n.z + (targetZ - n.z) * lift };
  });
}
export function validSkiCrash(value: unknown): value is SkiCrash {
  if (!value || typeof value !== 'object') return false;
  const v = value as SkiCrash, finite = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  const node = (n: SkiJoint) => n && ['x', 'y', 'z', 'px', 'py', 'pz'].every(key => finite(n[key as keyof SkiJoint], key.includes('z') ? -30 : -500, 1e9));
  return finite(v.age, 0, 3) && finite(v.step, .000001, .05) && (v.remainder === undefined || finite(v.remainder, 0, H)) && [-1, 1].includes(v.direction) && finite(v.impact, 0, 1000) && finite(v.angle, -20, 20) && Array.isArray(v.nodes) && v.nodes.length === 13 && v.nodes.every(node) && Array.isArray(v.loose) && v.loose.length === 2 && v.loose.every(node);
}
