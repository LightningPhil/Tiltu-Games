import type { DraughtsMove } from './rules.ts';
export type MotionSpeed = 'relaxed' | 'steady' | 'quick';
export const MOTION = {
  relaxed: { travel: 1050, landing: 280, reply: 1000 },
  steady: { travel: 720, landing: 220, reply: 800 },
  quick: { travel: 390, landing: 120, reply: 500 },
} as const;
export interface MotionStep { from: number | null; to: number; captures: number[]; second?: { from: number; to: number } }
export function draughtsMotion(move: DraughtsMove, completedJumps = 0): MotionStep[] {
  return move.path.slice(completedJumps).map((to, offset) => {
    const i = completedJumps + offset;
    return { from: i === 0 ? move.from : move.path[i - 1], to, captures: move.captures[i] === undefined ? [] : [move.captures[i]] };
  });
}

// The model can commit immediately. This controller animates the old DOM until
// the final landing, then the interface renders the new position. Cancellation
// removes every overlay and restores source pieces before navigation or undo.
export class BoardMotion {
  private revision = 0;
  private animations = new Set<Animation>();
  private cleanup: (() => void)[] = [];
  cancel(): void {
    this.revision++;
    this.animations.forEach(a => a.cancel()); this.animations.clear();
    this.cleanup.forEach(fn => fn()); this.cleanup = [];
  }
  async play(board: HTMLElement, steps: MotionStep[], speed: MotionSpeed, selector: (index: number) => string, newPiece?: string): Promise<boolean> {
    this.cancel();
    const revision = this.revision, timings = MOTION[speed], reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const travel = reduced ? 0 : timings.travel, landing = reduced ? 0 : timings.landing;
    board.classList.add('in-motion'); board.setAttribute('aria-busy', 'true');
    this.cleanup.push(() => { board.classList.remove('in-motion'); board.removeAttribute('aria-busy'); });
    const cell = (i: number) => board.querySelector<HTMLElement>(selector(i));
    const piece = (i: number) => cell(i)?.querySelector<HTMLElement>('.disc, .chess-piece, .go-stone');
    async function pause(ms: number) { if (ms) await new Promise(resolve => setTimeout(resolve, ms)); }
    const animate = async (element: HTMLElement, frames: Keyframe[], duration: number, easing = 'cubic-bezier(.25,.8,.25,1)') => {
      const animation = element.animate(frames, { duration, easing, fill: 'forwards' });
      this.animations.add(animation);
      try { await animation.finished; } catch { /* Cancellation is expected on undo and navigation. */ }
    };
    const original = steps[0]?.from === null ? null : piece(steps[0]?.from ?? -1);
    const floating = original?.cloneNode(true) as HTMLElement | undefined;
    if (original) { original.style.visibility = 'hidden'; this.cleanup.push(() => { original.style.visibility = ''; }); }
    if (floating) { floating.classList.remove('can-move', 'last-piece', 'winning'); floating.classList.add('motion-piece'); board.append(floating); this.cleanup.push(() => floating.remove()); }
    for (const step of steps) {
      if (revision !== this.revision || !board.isConnected) return false;
      board.dispatchEvent(new CustomEvent('motionstep', { detail: { index: steps.indexOf(step) + 1, total: steps.length } }));
      const toCell = cell(step.to), fromCell = step.from === null ? null : cell(step.from);
      if (!toCell) continue;
      const target = toCell.getBoundingClientRect(), bounds = board.getBoundingClientRect();
      const root = { left: bounds.left + board.clientLeft, top: bounds.top + board.clientTop };
      const factor = board.classList.contains('four-board') ? .86 : board.classList.contains('chess-board') ? .9 : board.classList.contains('go-board') ? .88 : .72;
      const size = Math.min(target.width, target.height) * factor;
      const endX = target.left - root.left + (target.width - size) / 2, endY = target.top - root.top + (target.height - size) / 2;
      let moving = floating;
      if (!moving && newPiece) {
        moving = document.createElement('span'); moving.innerHTML = newPiece;
        moving = moving.firstElementChild as HTMLElement;
        moving.classList.add('motion-piece'); board.append(moving); this.cleanup.push(() => moving?.remove());
      }
      if (moving) {
        moving.style.width = `${size}px`; moving.style.height = `${size}px`;
        const from = fromCell?.getBoundingClientRect();
        const startX = from ? from.left - root.left + (from.width - size) / 2 : endX;
        const startY = from ? from.top - root.top + (from.height - size) / 2 : board.classList.contains('four-board') ? -size : endY;
        const frames = step.from === null && board.classList.contains('four-board')
          ? [{ transform: `translate(${startX}px,${startY}px)`, offset: 0, easing: 'cubic-bezier(.4,0,.9,.65)' }, { transform: `translate(${endX}px,${endY}px) scale(1.04,.96)`, offset: .78 }, { transform: `translate(${endX}px,${endY-size*.1}px) scale(.99,1.01)`, offset: .9 }, { transform: `translate(${endX}px,${endY}px) scale(1)`, offset: 1 }]
          : step.from === null && !board.classList.contains('four-board')
          ? [{ transform: `translate(${endX}px,${endY}px) scale(.35)`, opacity: 0 }, { transform: `translate(${endX}px,${endY}px) scale(1)`, opacity: 1 }]
          : board.classList.contains('draughts-board') && step.captures.length
            ? [{ transform: `translate(${startX}px,${startY}px) scale(1)` }, { transform: `translate(${(startX + endX) / 2}px,${(startY + endY) / 2 - size * .28}px) scale(1.12)`, offset: .5 }, { transform: `translate(${endX}px,${endY}px) scale(1)` }]
            : [{ transform: `translate(${startX}px,${startY}px)` }, { transform: `translate(${endX}px,${endY}px)` }];
        toCell.classList.add('motion-destination');
        toCell.style.setProperty('--landing-time', `${landing}ms`);
        fromCell?.classList.add('motion-origin');
        this.cleanup.push(() => { toCell.classList.remove('motion-destination', 'motion-landing'); toCell.style.removeProperty('--landing-time'); fromCell?.classList.remove('motion-origin'); });
        const motions = [animate(moving, frames, travel, board.classList.contains('four-board') ? 'linear' : undefined)];
        if (step.second) {
          const second = piece(step.second.from), destination = cell(step.second.to);
          if (second && destination) {
            const clone = second.cloneNode(true) as HTMLElement, fromRect = second.getBoundingClientRect(), toRect = destination.getBoundingClientRect();
            second.style.visibility = 'hidden'; clone.classList.add('motion-piece'); board.append(clone);
            this.cleanup.push(() => { clone.remove(); second.style.visibility = ''; });
            clone.style.width = `${fromRect.width}px`; clone.style.height = `${fromRect.height}px`;
            motions.push(animate(clone, [{ transform: `translate(${fromRect.left - root.left}px,${fromRect.top - root.top}px)` }, { transform: `translate(${toRect.left - root.left + (toRect.width - fromRect.width) / 2}px,${toRect.top - root.top + (toRect.height - fromRect.height) / 2}px)` }], travel));
          }
        }
        await Promise.all(motions);
        if (revision === this.revision) toCell.classList.add('motion-landing');
      }
      if (revision !== this.revision) return false;
      const capturedPieces = step.captures.map(i => piece(i)).filter((p): p is HTMLElement => !!p);
      await Promise.all(capturedPieces.map(p => animate(p, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.6)' }], reduced ? 0 : 240)));
      if (revision !== this.revision) return false;
      capturedPieces.forEach(p => { p.style.visibility = 'hidden'; this.cleanup.push(() => { p.style.visibility = ''; }); });
      await pause(landing);
    }
    if (revision !== this.revision) return false;
    this.animations.forEach(a => a.cancel()); this.animations.clear();
    this.cleanup.forEach(fn => fn()); this.cleanup = [];
    return true;
  }
}
