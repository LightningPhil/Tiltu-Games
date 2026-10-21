import type { LifeSession } from './life.ts';

export interface LifePalette { background: string; grid: string; accent: string; first: string; second: string; light: boolean }
const backgrounds = new WeakMap<HTMLCanvasElement, { key: string; image: HTMLCanvasElement }>();
const lifetimes = new WeakMap<HTMLCanvasElement, { generation: number; width: number; alive: Uint8Array; ages: Uint16Array }>();
/** Rendering stays independent of the simulation, including at the fastest speed. */
export function drawLifeField(ctx: CanvasRenderingContext2D, s: LifeSession, palette: LifePalette, before: number[], pulse: number, trails: number[]): void {
  const { width, height } = ctx.canvas, cw = width / s.width, ch = height / s.height;
  const key = `${width}:${height}:${s.width}:${s.height}:${palette.background}:${palette.grid}:${palette.light}`;
  let background = backgrounds.get(ctx.canvas);
  if (background?.key !== key) {
    const image = document.createElement('canvas'); image.width = width; image.height = height; const paint = image.getContext('2d')!;
    paint.fillStyle = palette.background; paint.fillRect(0, 0, width, height);
    const wash = paint.createRadialGradient(width * .4, height * .3, 0, width * .4, height * .3, width * .8);
    wash.addColorStop(0, palette.light ? '#ffffff18' : '#ffffff04'); wash.addColorStop(1, '#00000008');
    paint.fillStyle = wash; paint.fillRect(0, 0, width, height); paint.strokeStyle = palette.grid;
    for (let x = 0; x <= s.width; x++) { paint.globalAlpha = x % 5 ? .3 : .65; paint.lineWidth = x % 5 ? .5 : .75; paint.beginPath(); paint.moveTo(x * cw, 0); paint.lineTo(x * cw, height); paint.stroke(); }
    for (let y = 0; y <= s.height; y++) { paint.globalAlpha = y % 5 ? .3 : .65; paint.lineWidth = y % 5 ? .5 : .75; paint.beginPath(); paint.moveTo(0, y * ch); paint.lineTo(width, y * ch); paint.stroke(); }
    background = { key, image }; backgrounds.set(ctx.canvas, background);
  }
  ctx.globalAlpha = 1; ctx.drawImage(background.image, 0, 0);
  let lifetime = lifetimes.get(ctx.canvas);
  if (!lifetime || lifetime.width !== s.width || lifetime.alive.length !== s.cells.length || s.generation < lifetime.generation) {
    lifetime = { generation: s.generation, width: s.width, alive: new Uint8Array(s.cells.length), ages: new Uint16Array(s.cells.length) }; lifetimes.set(ctx.canvas, lifetime);
  }
  const generations = Math.max(0, s.generation - lifetime.generation); lifetime.generation = s.generation;
  const tile = (i: number, inset: number) => { ctx.beginPath(); ctx.roundRect(i % s.width * cw + inset, Math.floor(i / s.width) * ch + inset, cw - inset * 2, ch - inset * 2, Math.max(1, cw * .13)); };
  if (trails.length) {
    ctx.fillStyle = palette.accent;
    trails.forEach((age, i) => { if (age && !s.cells[i]) { ctx.globalAlpha = age / 6 * .19; tile(i, 2); ctx.fill(); } });
  }
  s.cells.forEach((n, i) => {
    lifetime.ages[i] = n ? lifetime.alive[i] ? Math.min(120, lifetime.ages[i] + generations) : 1 : 0;
    lifetime.alive[i] = n ? 1 : 0;
    const old = before[i]; if (!n && (!old || pulse >= 1)) return;
    const colour = s.mode === 'sandbox' ? palette.accent : (n || old) === -1 ? palette.second : palette.first;
    const born = !!n && !old && before.length > 0, alpha = n ? born ? .3 + .7 * pulse : 1 : (1 - pulse) * .45;
    const inset = Math.max(1.2, cw * .12) + (born ? (1 - pulse) * cw * .16 : 0);
    if (born && pulse < 1) { ctx.globalAlpha = (1-pulse) * .17; ctx.fillStyle = colour; tile(i, .2); ctx.fill(); }
    const ageLight = palette.light ? 1 : .8 + .2 / (1 + lifetime.ages[i] / 6);
    ctx.globalAlpha = alpha * ageLight; ctx.fillStyle = colour; tile(i, inset); ctx.fill();
    // The highlight is a tiny surface glint rather than a costly per-cell blur.
    if (n && cw >= 9) {
      const x = i % s.width * cw, y = Math.floor(i / s.width) * ch;
      ctx.fillStyle = palette.light ? '#ffffff65' : '#ffffff80'; ctx.globalAlpha = alpha * .45;
      ctx.fillRect(x + inset + 1.5, y + inset + 1, Math.max(1, cw - inset * 2 - 3), 1);
      ctx.fillStyle = palette.background; ctx.globalAlpha = alpha * .25;
      ctx.fillRect(x + inset + 1, y + ch - inset - 1.5, Math.max(1, cw - inset * 2 - 2), 1);
      if (s.mode !== 'sandbox' && n === -1) { ctx.strokeStyle = palette.background; ctx.lineWidth = 1; ctx.globalAlpha = alpha * .4; ctx.beginPath(); ctx.moveTo(x + cw * .38, y + ch * .62); ctx.lineTo(x + cw * .62, y + ch * .38); ctx.stroke(); }
    }
  });
  ctx.globalAlpha = 1;
}
