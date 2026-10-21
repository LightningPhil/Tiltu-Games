/** Original, code-drawn pixel sprites. No downloaded artwork or per-frame vector rotation. */
export interface SkiColors { snow: string; shade: string; deep: string; outline: string; jacket: string; light: boolean }
export interface SkiSprite { canvas: HTMLCanvasElement; x: number; y: number; scale: number }
type Point = [number, number];
export class PixelBrush {
  constructor(public c: CanvasRenderingContext2D) {}
  box(x: number, y: number, w: number, h: number, color: string): void { this.c.fillStyle = color; this.c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }
  line(a: Point, b: Point, color: string, width = 1): void {
    let x = Math.round(a[0]), y = Math.round(a[1]); const ex = Math.round(b[0]), ey = Math.round(b[1]), dx = Math.abs(ex - x), dy = -Math.abs(ey - y), sx = x < ex ? 1 : -1, sy = y < ey ? 1 : -1; let error = dx + dy;
    for (let n = 0; n < 1500; n++) { this.box(x - width / 2, y - width / 2, width, width, color); if (x === ex && y === ey) break; const e = error * 2; if (e >= dy) { error += dy; x += sx; } if (e <= dx) { error += dx; y += sy; } }
  }
  poly(points: Point[], fill: string, edge?: string): void {
    const min = Math.max(0, Math.floor(Math.min(...points.map(p => p[1])))), max = Math.min(this.c.canvas.height - 1, Math.ceil(Math.max(...points.map(p => p[1]))));
    for (let y = min; y <= max; y++) {
      const hits: number[] = [];
      points.forEach((a, i) => { const b = points[(i + 1) % points.length]; if ((a[1] <= y + .5 && b[1] > y + .5) || (b[1] <= y + .5 && a[1] > y + .5)) hits.push(a[0] + (y + .5 - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); });
      hits.sort((a, b) => a - b); for (let i = 0; i + 1 < hits.length; i += 2) this.box(Math.ceil(hits[i]), y, Math.floor(hits[i + 1]) - Math.ceil(hits[i]) + 1, 1, fill);
    }
    if (edge) points.forEach((p, i) => this.line(p, points[(i + 1) % points.length], edge));
  }
  oval(x: number, y: number, rx: number, ry: number, color: string): void {
    for (let dy = -Math.ceil(ry); dy <= ry; dy++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - dy * dy / (ry * ry)))); this.box(x - w, y + dy, w * 2 + 1, 1, color); }
  }
}
export class SkiSprites {
  private cache = new Map<string, SkiSprite>();
  constructor(public colors: SkiColors) {}
  private sprite(key: string, w: number, h: number, x: number, y: number, paint: (p: PixelBrush) => void, scale = 1): SkiSprite {
    const old = this.cache.get(key); if (old) return old;
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false; paint(new PixelBrush(ctx));
    const result = { canvas, x, y, scale }; this.cache.set(key, result); return result;
  }
  tree(variant: number): SkiSprite {
    const c = this.colors;
    return this.sprite(`tree${variant}`, 90, 118, 45, 106, p => {
      p.oval(49, 108, 34, 7, c.shade); p.oval(46, 106, 24, 4, c.deep);
      p.box(40, 83, 10, 24, '#293e39'); p.box(43, 85, 5, 21, '#977154'); p.box(44, 88, 2, 15, '#c59a72'); p.box(40, 104, 12, 3, c.snow);
      const levels = variant === 3 ? 5 : 7, green = c.light ? '#315d49' : '#3a7961', highlight = c.light ? '#62856a' : '#71a58a';
      for (let layer = 0; layer < levels; layer++) {
        const top = 5 + (7 - levels + layer) * 11, width = 7 + layer * (variant === 1 ? 3.8 : 4.8), center = 45 + (layer % 3 - 1);
        p.poly([[center, top], [center - width * .45, top + 9], [center - width * .8, top + 12], [center - width * .6, top + 13], [center - width, top + 20], [center - width * .5, top + 18], [center - width * .7, top + 23], [center - 1, top + 20], [center + width * .55, top + 23], [center + width * .45, top + 19], [center + width, top + 20], [center + width * .7, top + 13], [center + width * .5, top + 13]], '#183d37', '#172d30');
        p.poly([[center, top + 2], [center + width * .45, top + 10], [center + width * .8, top + 16], [center + 1, top + 14], [center - width * .75, top + 19], [center - width * .35, top + 10]], green);
        p.line([center + 1, top + 7], [center + width * .56, top + 16], highlight, 2);
        p.line([center - width * .25, top + 14], [center - width * .65, top + 18], '#47785a');
        if (variant !== 1 || layer % 2 === 0) {
          p.poly([[center, top + 1], [center - width * .35, top + 7], [center - width * .65, top + 10], [center - width * .32, top + 12], [center - width * .05, top + 10], [center + width * .33, top + 13], [center + width * .3, top + 9], [center + width * .57, top + 11], [center + width * .3, top + 6]], '#b1cbd3');
          p.poly([[center, top], [center - width * .34, top + 6], [center - width * .57, top + 8], [center - width * .2, top + 9], [center + 2, top + 7], [center + width * .36, top + 10], [center + width * .22, top + 5]], '#f4fbf6');
        }
        p.box(center - width * .7, top + 21, 2, 3, '#193e33'); p.box(center + width * .7, top + 20, 2, 3, '#244d3d');
      }
      if (variant === 3) { p.box(44, 81, 3, 22, '#b18b67'); p.box(39, 98, 13, 5, c.snow); }
    }, [ .86, 1, .76, .68 ][variant]);
  }
  rock(variant: number): SkiSprite {
    const c = this.colors;
    return this.sprite(`rock${variant}`, 64, 49, 32, 39, p => {
      const shapes: Point[][] = [[[10, 26], [15, 15], [28, 8], [43, 12], [54, 26], [47, 37], [23, 40], [11, 35]], [[9, 31], [14, 12], [24, 5], [44, 9], [50, 20], [56, 33], [40, 41], [19, 40]], [[6, 27], [17, 19], [26, 9], [38, 13], [43, 23], [56, 26], [53, 36], [35, 40], [14, 36]], [[9, 28], [17, 16], [33, 12], [42, 6], [51, 19], [55, 32], [43, 40], [21, 40]]];
      p.oval(35, 41, 26, 5, c.shade); p.poly(shapes[variant], '#778c9c', '#354e63');
      p.poly([[12, 29], [28, 19], [43, 17], [49, 32], [38, 38], [22, 37]], '#526e83');
      p.poly([[28, 19], [34, 13], [45, 17], [48, 28], [40, 29]], '#9eafba'); p.line([27, 22], [23, 33], '#3c576b'); p.line([44, 30], [39, 36], '#c4d4da');
      p.poly([[12, 22], [18, 14], [28, 9], [41, 11], [48, 18], [43, 23], [37, 21], [32, 25], [25, 21], [19, 25]], '#bad2dc');
      p.poly([[14, 20], [20, 13], [29, 9], [40, 12], [45, 17], [39, 19], [32, 17], [27, 21], [22, 19]], '#f5fbf7'); p.box(18, 26, 3, 2, '#e0edf0');
    }, .85);
  }
  ramp(): SkiSprite {
    const c = this.colors;
    return this.sprite('ramp', 70, 66, 35, 49, p => {
      p.oval(38, 53, 29, 7, c.shade);
      // Low entry is uphill (top); the wide raised launch lip faces downhill (bottom).
      p.poly([[17, 10], [53, 10], [62, 36], [8, 36]], '#8ca9b5', '#3b5b71');
      p.poly([[8, 36], [62, 36], [62, 49], [8, 49]], '#375a70', '#233e53');
      p.poly([[17, 10], [10, 34], [13, 34], [21, 10]], '#d4e8e9'); p.poly([[50, 10], [58, 34], [61, 34], [53, 10]], '#b0cbd4');
      p.poly([[21, 9], [49, 9], [56, 32], [14, 32]], '#d9edf0');
      for (let y = 13; y < 32; y += 5) p.line([20 - (y - 13) * .23, y], [50 + (y - 13) * .23, y], '#a6c5cf');
      p.poly([[32, 16], [38, 16], [38, 23], [44, 23], [35, 30], [26, 23], [32, 23]], '#e75455', '#a43143');
      p.box(9, 33, 53, 4, '#edf8f1'); for (let x = 11; x < 61; x += 8) p.box(x, 33, 4, 3, '#df4a53');
      p.box(14, 40, 42, 2, '#668498'); p.box(11, 48, 49, 3, c.snow);
    });
  }
  gate(state: 'next' | 'clear' | 'miss'): SkiSprite {
    return this.sprite(`gate${state}`, 164, 62, 82, 49, p => {
      const color = state === 'clear' ? '#3ebd8e' : state === 'miss' ? '#e95364' : '#4c8feb';
      for (const x of [10, 154]) { p.oval(x + 3, 51, 7, 2, this.colors.shade); p.line([x, 10], [x, 50], '#334d67', 3); p.line([x - 1, 10], [x - 1, 48], '#e4f1ed'); p.poly([[x + (x < 80 ? 2 : -2), 11], [x + (x < 80 ? 22 : -22), 13], [x + (x < 80 ? 19 : -19), 24], [x + (x < 80 ? 2 : -2), 22]], color, '#234967'); p.box(x + (x < 80 ? 5 : -14), 14, 7, 3, '#deedf6'); }
      if (state === 'next') for (let x = 28; x < 144; x += 10) p.box(x, 49, 5, 1, '#b2cddd');
    });
  }
  skier(heading: number, action: 'ski' | 'tuck' | 'brake' | 'air' | 'land', frame: number): SkiSprite {
    const d = Math.max(-3, Math.min(3, Math.round(heading))), f = frame % 4, c = this.colors;
    return this.sprite(`skier${d}${action}${f}`, 88, 96, 44, 78, p => {
      const crouch = action === 'tuck' ? 10 : action === 'land' ? 8 : action === 'brake' ? 5 : 0, lean = d * 1.8, hip: Point = [44 + lean, 49 + crouch * .45], head: Point = [44 + lean * 1.8, 21 + crouch];
      const bootL: Point = [37 + d * 2, 73], bootR: Point = [51 + d * 2, 73];
      for (const [boot, side] of [[bootL, -1], [bootR, 1]] as [Point, number][]) {
        const angle = action === 'brake' ? -side * .48 : d * .28, sx = Math.sin(angle) * 20, sy = Math.cos(angle) * 20;
        p.line([boot[0] - sx, boot[1] - sy], [boot[0] + sx, boot[1] + sy], '#283e54', 5); p.line([boot[0] - sx, boot[1] - sy], [boot[0] + sx, boot[1] + sy], '#ef5e62', 3); p.line([boot[0] - sx - 1, boot[1] - sy + 3], [boot[0] + sx - 1, boot[1] + sy - 2], '#ffe6bf');
      }
      const kneeL: Point = [hip[0] - 7 + d, 61], kneeR: Point = [hip[0] + 7 + d, 61];
      for (const [knee, boot, side] of [[kneeL, bootL, -1], [kneeR, bootR, 1]] as [Point, Point, number][]) { p.line([hip[0] + side * 4, hip[1]], knee, '#1e2f49', 7); p.line(knee, boot, '#243a54', 6); p.line([knee[0] - 1, knee[1]], [boot[0] - 1, boot[1] - 4], '#58788c', 2); p.box(boot[0] - 3, boot[1] - 4, 7, 7, '#23334a'); p.box(boot[0] - 2, boot[1] - 3, 4, 2, '#d8e8e3'); }
      const shoulders: Point[] = [[head[0] - 10, head[1] + 13], [head[0] + 10, head[1] + 13]], wave = f % 2 ? 2 : 0;
      const hands: Point[] = action === 'air' ? [[head[0] - 24, head[1] + 7], [head[0] + 24, head[1] + 5]] : action === 'tuck' ? [[head[0] - 9, head[1] + 22], [head[0] + 9, head[1] + 22]] : [[hip[0] - 19, 52 + wave], [hip[0] + 19, 51 - wave]];
      shoulders.forEach((a, i) => { const hand = hands[i], elbow: Point = [a[0] + (i ? 7 : -7), (a[1] + hand[1]) / 2 - 1]; p.line(a, elbow, '#233a4e', 8); p.line(elbow, hand, '#243a4f', 7); p.line(a, elbow, c.jacket, 5); p.line(elbow, hand, c.jacket, 4); p.box(hand[0] - 2, hand[1] - 1, 5, 6, '#293543'); p.line([hand[0] + (i ? 2 : -2), hand[1] + 3], [hand[0] + (i ? 9 : -9), 81 - wave], '#6d8391', 2); p.line([hand[0] + (i ? 8 : -10), 79 - wave], [hand[0] + (i ? 12 : -6), 79 - wave], '#344b60'); });
      p.poly([[shoulders[0][0], shoulders[0][1]], [head[0] - 5, head[1] + 8], [head[0] + 5, head[1] + 8], [shoulders[1][0], shoulders[1][1]], [hip[0] + 8, hip[1] + 4], [hip[0] - 8, hip[1] + 4]], c.jacket, '#243a50');
      p.poly([[head[0] + 4, head[1] + 12], [head[0] + 9, head[1] + 15], [hip[0] + 7, hip[1] + 3], [hip[0] + 3, hip[1] + 1]], '#255163');
      p.line([head[0] - 6, head[1] + 14], [hip[0] - 5, hip[1] - 2], '#d6f1dc'); p.box(hip[0] - 7, hip[1], 14, 3, '#263b4f'); p.box(head[0] - 3, head[1] + 13, 6, 10, '#c4d5b1'); p.box(head[0] - 1, head[1] + 14, 3, 7, '#f1dba4');
      p.poly([[head[0] - 1, head[1] + 10], [head[0] - 13 - d * 2, head[1] + 4 + f], [head[0] - 11 - d * 2, head[1] + 9 + f], [head[0] + 3, head[1] + 13]], '#dc4e5f', '#92374c');
      skierHead(p, head[0], head[1], d, false);
    });
  }
  yeti(phase: 'run' | 'roar' | 'leap' | 'bonk' | 'eat' | 'grin', frame: number): SkiSprite {
    const f = frame % 6;
    return this.sprite(`yeti${phase}${f}`, 132, 124, 66, 113, p => {
      const bob = phase === 'run' ? [0, -2, -3, 0, -2, -3][f] : phase === 'roar' ? -4 : phase === 'leap' ? -5 : 0, stride = phase === 'run' ? [-9, -4, 5, 9, 4, -5][f] : 0;
      const fur = '#e9f1ef', edge = '#30465d', shadow = '#9cb5c6', lit = '#fbfff6';
      // Oversized, separately posed feet and knuckles give the run real weight.
      for (const side of [-1, 1]) {
        const x = 66 + side * 18, y = 103 + side * stride;
        p.poly([[x - 8, 77 + bob], [x + 8, 77 + bob], [x + 10, y - 3], [x + 14, y + 1], [x + 13, y + 9], [x - 13, y + 9], [x - 12, y + 3]], shadow, edge);
        p.poly([[x - 6, 80 + bob], [x + 6, 80 + bob], [x + 7, y + 2], [x - 9, y + 2]], fur); p.box(x - 9, y + 3, 19, 4, lit);
        for (let toe = -6; toe <= 6; toe += 6) { p.box(x + toe, y + 6, 3, 4, '#708b9f'); p.box(x + toe, y + 6, 2, 2, '#f4fff6'); }
      }
      const armLift = phase === 'leap' ? -31 : phase === 'roar' ? -20 : phase === 'eat' ? -14 : 0;
      for (const side of [-1, 1]) {
        const swing = phase === 'run' ? stride * side * .6 : 0, elbow: Point = [66 + side * (phase === 'leap' ? 47 : 39), 59 + armLift + swing], hand: Point = [66 + side * (phase === 'eat' ? 19 : phase === 'leap' ? 51 : 43), 83 + armLift + swing];
        p.line([66 + side * 25, 41 + bob], elbow, edge, 21); p.line(elbow, hand, edge, 20); p.line([66 + side * 25, 41 + bob], elbow, shadow, 17); p.line(elbow, hand, fur, 16); p.line([66 + side * 24, 38 + bob], [elbow[0] - side * 2, elbow[1] - 4], lit, 11);
        p.oval(elbow[0], elbow[1], 11, 12, edge); p.oval(elbow[0] - 1, elbow[1] - 2, 9, 10, fur); p.oval(elbow[0] - side * 3, elbow[1] - 5, 5, 6, lit);
        p.oval(hand[0], hand[1], 11, 10, edge); p.oval(hand[0] - 1, hand[1] - 2, 9, 8, fur);
        for (let claw = -6; claw <= 6; claw += 6) p.poly([[hand[0] + claw - 1, hand[1] + 4], [hand[0] + claw + 2, hand[1] + 4], [hand[0] + claw, hand[1] + 9]], '#6d8190');
        for (let tuft = 0; tuft < 3; tuft++) p.poly([[elbow[0] + side * 5, elbow[1] - 9 + tuft * 7], [elbow[0] + side * 13, elbow[1] - 4 + tuft * 7], [elbow[0] + side * 5, elbow[1] - 1 + tuft * 7]], fur, edge);
      }
      p.poly([[45, 24 + bob], [57, 19 + bob], [78, 22 + bob], [91, 36 + bob], [97, 67 + bob], [88, 88 + bob], [78, 94 + bob], [69, 91 + bob], [59, 95 + bob], [42, 87 + bob], [35, 66 + bob], [37, 39 + bob]], shadow, edge);
      p.poly([[46, 30 + bob], [61, 25 + bob], [78, 29 + bob], [85, 43 + bob], [85, 75 + bob], [77, 86 + bob], [68, 83 + bob], [59, 88 + bob], [45, 80 + bob], [40, 58 + bob]], fur);
      for (const [x, y] of [[48, 44], [77, 48], [55, 61], [75, 70], [48, 76]]) p.poly([[x, y + bob], [x + 4, y + 7 + bob], [x + 8, y + 2 + bob], [x + 5, y + 12 + bob], [x + 1, y + 8 + bob]], '#bed0d8');
      p.poly([[46, 21 + bob], [43, 9 + bob], [52, 12 + bob], [58, 4 + bob], [65, 9 + bob], [73, 3 + bob], [79, 11 + bob], [88, 8 + bob], [85, 25 + bob]], fur, edge);
      p.poly([[49, 19 + bob], [58, 12 + bob], [76, 13 + bob], [84, 22 + bob], [86, 40 + bob], [78, 54 + bob], [56, 55 + bob], [46, 42 + bob]], '#eaf2ed', edge);
      p.poly([[51, 27 + bob], [60, 23 + bob], [76, 23 + bob], [82, 30 + bob], [80, 45 + bob], [74, 50 + bob], [58, 49 + bob], [49, 40 + bob]], '#637f98');
      p.box(53, 29 + bob, 9, 6, '#182e49'); p.box(71, 29 + bob, 9, 6, '#182e49'); p.box(56, 30 + bob, 4, 3, '#f4cf6a'); p.box(72, 30 + bob, 4, 3, '#f4cf6a'); p.box(58, 30 + bob, 2, 3, '#18283e'); p.box(72, 30 + bob, 2, 3, '#18283e');
      p.line([51, 26 + bob], [62, 28 + bob], '#e9f8f1', 3); p.line([70, 28 + bob], [81, 25 + bob], '#e9f8f1', 3); p.box(63, 35 + bob, 8, 5, '#243e57'); p.box(64, 35 + bob, 3, 1, '#a2c0ce');
      const mouthH = phase === 'roar' || phase === 'leap' ? 16 : phase === 'eat' ? 7 + f % 3 * 3 : 9;
      p.oval(67, 46 + bob, 13, mouthH / 2 + 2, '#263851'); p.oval(67, 49 + bob, 8, mouthH / 3, '#ac607a');
      for (const x of [57, 63, 71, 77]) p.poly([[x - 2, 40 + bob], [x + 2, 40 + bob], [x, 47 + bob]], '#fff9d9');
      if (phase === 'grin') { p.box(57, 42 + bob, 21, 6, '#fff4d5'); for (let x = 61; x < 78; x += 5) p.box(x, 43 + bob, 1, 4, '#7d8b95'); p.box(54, 44 + bob, 3, 4, '#d8e8e5'); }
      if (phase === 'eat') { p.line([48, 65], [76, 41], '#1f344b', 5); p.line([48, 65], [76, 41], '#f16a66', 3); p.box(44, 64, 10, 7, '#293a50'); }
      if (phase === 'bonk') { p.box(52, 29, 10, 2, '#273d52'); p.box(71, 29, 10, 2, '#273d52'); p.line([55, 26], [59, 33], '#253c51', 2); p.line([74, 26], [78, 33], '#253c51', 2); }
      if (phase === 'grin') { p.box(81, 7, 10, 7, '#e85462'); p.oval(86, 5, 4, 3, '#f8f3e8'); }
    });
  }
}
export function skierHead(p: PixelBrush, x: number, y: number, direction: number, fallen: boolean): void {
  p.oval(x, y, 8, 9, '#24384e'); p.oval(x, y + 2, 6, 6, '#e1ae82'); p.box(x - 6, y - 3, 13, 4, '#5a493f');
  p.poly([[x - 7, y - 4], [x - 5, y - 10], [x + 3, y - 11], [x + 7, y - 5]], '#de4b60', '#853749'); p.box(x - 7, y - 5, 14, 3, '#f1837c'); p.box(x - 5, y - 8, 7, 2, '#f9b4a1'); p.oval(x - 1, y - 12, 3, 3, '#fff4dc');
  if (fallen || direction) { const side = direction < 0 ? -5 : 2; p.box(x + side, y, 6, 3, '#f7d38a'); p.box(x + side + 1, y, 4, 1, '#fff8ce'); if (fallen) p.box(x - 2, y + 6, 5, 1, '#925c54'); }
  else { p.box(x - 6, y + 1, 13, 3, '#384550'); p.box(x - 4, y + 5, 9, 2, '#f1c39a'); }
}
export function blitSprite(c: CanvasRenderingContext2D, sprite: SkiSprite, x: number, y: number, scale = 1): void { const s = sprite.scale * scale; c.drawImage(sprite.canvas, Math.round(x - sprite.x * s), Math.round(y - sprite.y * s), Math.round(sprite.canvas.width * s), Math.round(sprite.canvas.height * s)); }
