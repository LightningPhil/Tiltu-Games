import { MOTION } from './movement.ts';
import type { MotionSpeed } from './movement.ts';
interface CardPosition { bounds: DOMRect; face: string | undefined }
export class CardMotion {
  private animations = new Set<Animation>();
  capture(root: HTMLElement): Map<string, CardPosition> {
    return new Map(Array.from(root.querySelectorAll<HTMLElement>('[data-card-key]'), el => [el.dataset.cardKey!, { bounds: el.getBoundingClientRect(), face: el.dataset.face }]));
  }
  cancel(): void { this.animations.forEach(a => a.cancel()); this.animations.clear(); }
  async play(root: HTMLElement, before: Map<string, CardPosition>, speed: MotionSpeed): Promise<void> {
    this.cancel();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const source = root.querySelector('.card-source')?.getBoundingClientRect();
    const duration = MOTION[speed].travel, tasks: Promise<unknown>[] = [];
    let dealt = 0;
    for (const el of root.querySelectorAll<HTMLElement>('[data-card-key]')) {
      const old = before.get(el.dataset.cardKey!), next = el.getBoundingClientRect(), from = old?.bounds ?? source;
      if (!from) continue;
      const dx = from.left - next.left, dy = from.top - next.top, flip = old && old.face !== el.dataset.face;
      if (old && Math.abs(dx) < 1 && Math.abs(dy) < 1 && !flip) continue;
      const animation = el.animate([
        { transform: `translate(${dx}px,${dy}px) scale(${from.width / next.width || 1},${from.height / next.height || 1})${flip ? ' rotateY(-90deg)' : ''}`, opacity: old ? 1 : .25, zIndex: 100 },
        { transform: 'translate(0,0) scale(1,1) rotateY(0deg)', opacity: 1, zIndex: 100 },
      ], { duration, delay: old ? 0 : Math.min(dealt++ * 95, 380), easing: 'cubic-bezier(.22,.75,.25,1)', fill: 'backwards' });
      this.animations.add(animation);
      tasks.push(animation.finished.catch(() => {}).finally(() => { animation.cancel(); this.animations.delete(animation); }));
    }
    await Promise.all(tasks);
  }
}
