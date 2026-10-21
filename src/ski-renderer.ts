import { blitSprite, PixelBrush, skierHead, SkiSprites } from './ski-art.ts';
import type { SkiColors } from './ski-art.ts';
import { skiCrashPose, JOINT } from './ski-ragdoll.ts';
import { skiDistance, skiJumpHeight, skiVariant } from './ski.ts';
import type { SkiSession } from './ski.ts';
// Leave room uphill for the yeti's full silhouette, including its airborne leap.
const ANCHOR = 260;
export class SkiRenderer {
  private sprites: SkiSprites | null = null;
  private snow: HTMLCanvasElement | null = null;
  private palette = '';
  private session: SkiSession | null = null;
  private tracks: { x: number; y: number; direction: number; skid: boolean }[] = [];
  private footprints: { x: number; y: number }[] = []; private lastFootY = -Infinity; private nextFoot = -1;
  private lastCrash: SkiSession['crash'] = null; private crashOrigin = { x: 0, y: 0 };
  private lastTime = -1;
  private previousAir = 0;
  private landing: { x: number; y: number; time: number } | null = null;
  draw(canvas: HTMLCanvasElement, s: SkiSession, accent: string, theme: string, braking = false, snow?: Pick<SkiColors, 'snow' | 'shade' | 'deep'>): void {
    const c = canvas.getContext('2d')!; c.imageSmoothingEnabled = false;
    const light = theme === 'classic' || theme === 'woodland', key = `${theme}:${accent}:${snow?.snow}:${snow?.shade}:${snow?.deep}`;
    if (key !== this.palette) { this.palette = key; const colors: SkiColors = { light, jacket: accent, snow: light ? '#f5f8f4' : '#192d42', shade: light ? '#c9dce1' : '#102338', deep: light ? '#adc5d1' : '#36566d', outline: '#23394e', ...snow }; this.sprites = new SkiSprites(colors); this.snow = this.makeSnow(colors); }
    const sprites = this.sprites!, p = new PixelBrush(c), colors = sprites.colors, offset = Math.floor(s.y) % 512;
    c.clearRect(0, 0, 600, 500); c.drawImage(this.snow!, 0, -offset); c.drawImage(this.snow!, 0, 512 - offset);
    if (this.session !== s || s.elapsed < this.lastTime) { this.session = s; this.tracks = []; this.footprints = []; this.lastFootY = -Infinity; this.lastCrash = null; this.lastTime = -1; this.previousAir = 0; this.landing = null; }
    if (s.elapsed !== this.lastTime) { if (this.previousAir > 0 && !s.jump && !s.crash && s.status === 'skiing') this.landing = { x:s.x, y:s.y, time:s.elapsed }; this.previousAir = s.jump; }
    if (s.crash && s.crash !== this.lastCrash) this.crashOrigin = { x: s.x, y: s.y }; this.lastCrash = s.crash;
    if (s.yeti?.phase === 'chase' && s.yeti.y - this.lastFootY > 31) { this.footprints.push({ x: s.yeti.x + this.nextFoot * 17, y: s.yeti.y }); this.lastFootY = s.yeti.y; this.nextFoot *= -1; this.footprints = this.footprints.filter(f => f.y > s.y - 310).slice(-20); }
    if (s.elapsed !== this.lastTime && !s.jump && !s.crash && s.status === 'skiing' && (!this.tracks.length || s.y - this.tracks.at(-1)!.y > 5)) { this.tracks.push({ x: s.x, y: s.y, direction: s.velocity / 255, skid: braking }); this.tracks = this.tracks.filter(t => t.y > s.y - 270).slice(-160); }
    this.lastTime = s.elapsed;
    for (const t of this.tracks) {
      const y = t.y - s.y + ANCHOR;
      for (const side of [-1, 1]) p.line([t.x + side * 7 - t.direction * 2, y - 3], [t.x + side * 7 + t.direction * 2, y + 4], colors.deep, t.skid ? 2 : 1);
      if (t.skid) p.box(t.x + 14 * Math.sign(t.direction || 1), y - 1, 3, 2, light ? '#ffffff' : '#a3cbdc');
    }
    if (s.yeti) this.yetiTracks(p, s);
    if (s.mode === 'slalom') {
      const gate = s.objects.find(o => o.kind === 'gate' && !o.passed && o.y > s.y);
      if (gate) { const y = gate.y - s.y + ANCHOR; if (y < 570) { c.fillStyle = light ? '#236a64' : accent; c.textAlign = 'center'; c.font = 'bold 10px Consolas, monospace'; c.fillText('NEXT GATE', gate.x, Math.min(465, y - 76)); p.poly([[gate.x - 5, Math.min(470, y - 70)], [gate.x + 5, Math.min(470, y - 70)], [gate.x, Math.min(480, y - 61)]], light ? '#236a64' : accent); } }
    }
    const visible = s.objects.filter(o => o.y - s.y + ANCHOR > -30 && o.y - s.y + ANCHOR < 630);
    // Cast shadows sit beneath every sprite, including objects crossing in front.
    c.globalAlpha = light ? .35 : .45;
    for (const o of visible) { const y = o.y - s.y + ANCHOR; if (o.kind === 'tree') p.poly([[o.x-10,y-5],[o.x+54,y+20],[o.x+39,y+25],[o.x-13,y+3]],colors.shade); else if(o.kind==='rock') p.oval(o.x+15,y+5,24,5,colors.shade); }
    c.globalAlpha = .7; c.fillStyle = colors.deep; c.textAlign = 'left'; c.font = '9px Consolas, monospace';
    for (let y = Math.max(0, Math.ceil((s.y-ANCHOR)/300)*300); y < s.y+500-ANCHOR; y += 300) { const sy=y-s.y+ANCHOR; c.fillText(`${Math.round(y/3)}m`,8,sy-5); p.box(8,sy,21,1,colors.deep); p.box(8,sy-2,1,5,colors.deep); }
    c.globalAlpha = 1;
    const things = visible.map(o => ({ y: o.y, draw: () => blitSprite(c, o.kind === 'tree' ? sprites.tree(skiVariant(o)) : o.kind === 'rock' ? sprites.rock(skiVariant(o)) : o.kind === 'ramp' ? sprites.ramp() : sprites.gate(o.passed ? o.cleared ? 'clear' : 'miss' : 'next'), o.x, o.y - s.y + ANCHOR) }));
    things.push({ y: s.y, draw: () => this.skier(c, p, s, braking) });
    if (s.yeti) things.push({ y: s.yeti.y + (s.yeti.phase === 'pounce' ? 8 : 0), draw: () => this.yeti(c, p, s) });
    things.sort((a, b) => a.y - b.y).forEach(t => t.draw());
    this.spray(p, s, braking);
    if (this.landing) { const t = s.elapsed - this.landing.time, y = this.landing.y-s.y+ANCHOR; if(t>.6)this.landing=null;else{c.globalAlpha=Math.max(0,1-t/.6);for(let i=0;i<18;i++){const a=i*2.399, r=(15+i%5*8)*t; p.box(this.landing.x+Math.cos(a)*r,y+Math.sin(a)*r*.4-25*t, i%3===0?3:2,2,light?'#ffffff':'#c3dfe9');}c.globalAlpha=1;} }
    if (s.mode !== 'free' && skiDistance(s) > 890) { const y = 3000 - s.y + ANCHOR; p.box(18, y, 564, 7, '#d7e8ee'); for (let x = 18; x < 580; x += 12) p.box(x, y, 6, 6, '#334e65'); if (y < 500) { c.fillStyle = colors.light ? '#38546a' : '#e0f2f5'; c.font = 'bold 12px Consolas,monospace'; c.textAlign = 'center'; c.fillText('F I N I S H', 300, y - 10); } }
  }
  private makeSnow(colors: SkiColors): HTMLCanvasElement {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 512; const ctx = canvas.getContext('2d')!, p = new PixelBrush(ctx); p.box(0, 0, 600, 512, colors.snow);
    // Broad, shallow wind ridges add terrain without hiding obstacles or gates.
    ctx.globalAlpha = .16;
    for (let i = 0; i < 5; i++) { const y = i * 113 - 28; p.poly([[0, y + 22], [180, y], [410, y + 34], [600, y + 16], [600, y + 25], [410, y + 42], [180, y + 5], [0, y + 30]], colors.deep); }
    ctx.globalAlpha = .45;
    for (let i = 0; i < 115; i++) { const x = (i * 139 + 71) % 600, y = (i * 197 + 43) % 512; p.box(x, y, i % 5 ? 1 : 3, 1, colors.deep); if (i % 4 === 0) p.box(x + 2, y - 1, 3, 1, colors.light ? '#ffffff' : colors.deep); }
    for (let i = 0; i < 7; i++) { const x = (i * 193 + 22) % 600, y = (i * 149 + 75) % 512; p.line([x - 9, y + 1], [x + 14, y], colors.shade); p.line([x - 4, y - 1], [x + 8, y - 2], colors.light ? '#ffffff' : colors.deep); }
    ctx.globalAlpha = 1;
    return canvas;
  }
  private skier(c: CanvasRenderingContext2D, p: PixelBrush, s: SkiSession, braking: boolean): void {
    if (s.status === 'caught') {
      if (s.captureAge < .55) { const t = s.captureAge / .55, y = ANCHOR - t * 20; blitSprite(c, this.sprites!.skier(2, 'air', 0), s.x + t * 13, y, 1 - t * .5); }
      return;
    }
    if (s.crash) { this.ragdoll(p, s); return; }
    const height = skiJumpHeight(s), heading = Math.round(Math.atan2(s.velocity, Math.max(65, s.speed)) / .91 * 3), air = s.jump > 0, landing = !air && s.cooldown > .15;
    p.oval(s.x + 4, ANCHOR + 3, air ? 13 : 17, air ? 3 : 4, this.sprites!.colors.shade);
    const frame = Math.floor(s.elapsed * (s.speed > 300 ? 10 : 6)) % 4;
    blitSprite(c, this.sprites!.skier(heading, air ? 'air' : landing ? 'land' : braking ? 'brake' : s.speed > 310 ? 'tuck' : 'ski', frame), s.x, ANCHOR - height);
    if (air) { p.box(s.x - 6, ANCHOR + 5, 2, 1, this.sprites!.colors.deep); p.box(s.x + 8, ANCHOR + 4, 2, 1, this.sprites!.colors.deep); }
  }
  private ragdoll(p: PixelBrush, s: SkiSession): void {
    const r = s.crash!, nodes = skiCrashPose(r), project = (index: number): [number, number] => [nodes[index].x, nodes[index].y - s.y + ANCHOR - nodes[index].z], n = JOINT;
    const hip = project(n.hip), chest = project(n.chest), head = project(n.head), c = this.sprites!.colors;
    for (const node of nodes) p.oval(node.x + 3, node.y - s.y + ANCHOR + 1, 5, 2, c.shade);
    for (const [a, b] of [[n.hip, n.leftKnee], [n.leftKnee, n.leftBoot], [n.hip, n.rightKnee], [n.rightKnee, n.rightBoot]]) { p.line(project(a), project(b), '#23374f', 7); p.line(project(a), project(b), '#4c6a82', 4); }
    const recovery = Math.max(0, Math.min(1, (r.age - 1.5) / .85)), loose = r.loose[1], boot = nodes[n.rightBoot];
    for (const side of [-1, 1]) {
      const b = side === -1 ? nodes[n.leftBoot] : { x: loose.x + (boot.x - loose.x) * recovery, y: loose.y + (boot.y - loose.y) * recovery, z: loose.z + (boot.z - loose.z) * recovery }, knee = nodes[side === -1 ? n.leftKnee : n.rightKnee];
      const angle = side === 1 ? r.angle * (1 - recovery) : Math.atan2(b.x - knee.x, b.y - knee.y + 12) * .6, x = b.x, y = b.y - s.y + ANCHOR - b.z;
      p.line([x - Math.sin(angle) * 19, y - Math.cos(angle) * 19], [x + Math.sin(angle) * 19, y + Math.cos(angle) * 19], '#273e54', 5); p.line([x - Math.sin(angle) * 18, y - Math.cos(angle) * 18], [x + Math.sin(angle) * 18, y + Math.cos(angle) * 18], '#ee6b69', 3); p.box(x - 2, y - 3, 5, 6, '#d0dddb');
    }
    for (const [a, b, hand] of [[n.leftShoulder, n.leftElbow, n.leftHand], [n.rightShoulder, n.rightElbow, n.rightHand]]) { p.line(project(a), project(b), '#253d52', 8); p.line(project(b), project(hand), '#253d52', 7); p.line(project(a), project(b), c.jacket, 5); p.line(project(b), project(hand), c.jacket, 4); const h = project(hand); p.box(h[0] - 3, h[1] - 2, 6, 6, '#2d3d50'); }
    const ls = project(n.leftShoulder), rs = project(n.rightShoulder);
    p.poly([[ls[0] - 2, ls[1]], [rs[0] + 2, rs[1]], [hip[0] + 7, hip[1] + 3], [hip[0] - 7, hip[1] + 3]], c.jacket, '#2c4356'); p.line(chest, hip, '#e0e1b7', 3); p.line(chest, head, '#d34d5f', 5); skierHead(p, head[0], head[1], r.direction, r.age < 1.65);
    const pole = r.loose[0], x = pole.x, y = pole.y - s.y + ANCHOR - pole.z, angle = r.angle * .7; p.line([x - Math.cos(angle) * 14, y - Math.sin(angle) * 14], [x + Math.cos(angle) * 14, y + Math.sin(angle) * 14], '#657f91', 2); p.box(x + Math.cos(angle) * 13, y + Math.sin(angle) * 13, 4, 3, '#314c63');
  }
  private yeti(c: CanvasRenderingContext2D, p: PixelBrush, s: SkiSession): void {
    const y = s.yeti!, age = s.captureAge, phase = y.phase === 'announce' || y.phase === 'windup' ? 'roar' : y.phase === 'pounce' ? 'leap' : y.phase === 'recover' ? 'bonk' : y.phase === 'feast' ? age < 2.1 ? 'eat' : 'grin' : 'run';
    const frame = Math.floor((y.phase === 'feast' ? age : y.time) * 10) % 6;
    const groundY = y.phase === 'feast' ? ANCHOR - 1 : y.y - s.y + ANCHOR, lift = y.phase === 'pounce' ? Math.sin(Math.min(1, y.time / .65) * Math.PI) * 43 : 0;
    p.oval(y.x + 7, groundY + 4, phase === 'leap' ? 24 : 35, 6, this.sprites!.colors.shade);
    blitSprite(c, this.sprites!.yeti(phase, frame), y.x, groundY - lift);
    if (phase === 'roar') for (let i = 0; i < 4; i++) { const drift = (y.time * 22 + i * 5) % 20; p.oval(y.x + 16 + drift, groundY - 66 - drift * .22 + i % 2 * 3, 3 - i % 2, 2, this.sprites!.colors.light ? '#dde9ea' : '#6a91a6'); }
    if (y.phase === 'windup') { c.fillStyle = '#d65761'; c.font = 'bold 15px Consolas,monospace'; c.textAlign = 'center'; c.fillText('!', y.x, groundY - 111); }
    if (y.phase === 'feast' && age > 1.55 && age < 2.4) { c.fillStyle = this.sprites!.colors.light ? '#3e586c' : '#e1f0f4'; c.font = 'bold 11px Consolas,monospace'; c.textAlign = 'left'; c.fillText('BURP!', y.x + 44, groundY - 80 - (age - 1.55) * 8); }
  }
  private yetiTracks(p: PixelBrush, s: SkiSession): void {
    const color = this.sprites!.colors.deep;
    for (const foot of this.footprints) { const py = foot.y - s.y + ANCHOR; p.oval(foot.x, py, 7, 4, color); for (let toe = -4; toe <= 4; toe += 4) p.box(foot.x + toe, py + 4, 2, 2, color); }
  }
  private spray(p: PixelBrush, s: SkiSession, braking: boolean): void {
    const color = this.sprites!.colors.light ? '#ffffff' : '#b3d6e0', r = s.crash;
    const burst = r && r.age < .85 ? { x: this.crashOrigin.x, y: this.crashOrigin.y - s.y + ANCHOR + 5, t: r.age, power: Math.min(1.5, r.impact / 220) } : s.status === 'caught' && s.captureAge < .7 ? { x: s.x, y: ANCHOR + 2, t: s.captureAge, power: 1.4 } : s.yeti?.phase === 'recover' && s.yeti.time < .7 ? { x: s.yeti.x, y: s.yeti.y - s.y + ANCHOR, t: s.yeti.time, power: 1.6 } : null;
    if (burst) for (let i = 0; i < 24; i++) { const angle = i * 2.399, speed = (25 + i % 7 * 12) * burst.power, x = burst.x + Math.cos(angle) * speed * burst.t, y = burst.y + Math.sin(angle) * speed * burst.t * .45 - 95 * burst.t + 140 * burst.t * burst.t; p.box(x, y, i % 3 + 1, i % 3 + 1, i % 4 ? color : this.sprites!.colors.deep); }
    if (!s.jump && !r && s.status === 'skiing' && (braking || Math.abs(s.velocity) > 100)) for (let i = 0; i < 10; i++) { const t = ((s.elapsed * 1.7 + i * .13) % 1), side = braking ? i % 2 ? -1 : 1 : -Math.sign(s.velocity), x = s.x + side * (12 + t * 23), y = ANCHOR - t * 19 + i % 3 * 2; p.box(x, y, t < .5 ? 2 : 1, 1 + i % 2, color); }
  }
}
