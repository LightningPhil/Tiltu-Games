/** Ported from neon-synth-ballistics; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { HEIGHT, WIDTH } from './maps.ts';

export class Camera {
    width = WIDTH;
    height = HEIGHT;
    x = WIDTH / 2;
    y = HEIGHT / 2;
    zoom = 1;
    targetX = this.x;
    targetY = this.y;
    targetZoom = 1;
    manualUntil = 0;

    get fitScale() { return Math.min(this.width / WIDTH, this.height / HEIGHT); }
    get scale() { return this.fitScale * this.zoom; }
    resize(width: number, height: number) { this.width = Math.max(1, width); this.height = Math.max(1, height); this.clamp(); }
    worldToScreen(x: number, y: number) { return { x: (x - this.x) * this.scale + this.width / 2, y: (y - this.y) * this.scale + this.height / 2 }; }
    screenToWorld(x: number, y: number) { return { x: (x - this.width / 2) / this.scale + this.x, y: (y - this.height / 2) / this.scale + this.y }; }
    clamp() {
        const halfW = Math.min(WIDTH / 2, this.width / (2 * this.scale));
        const halfH = Math.min(HEIGHT / 2, this.height / (2 * this.scale));
        this.x = Math.max(halfW, Math.min(WIDTH - halfW, this.x));
        this.y = Math.max(-800 + halfH, Math.min(HEIGHT - halfH, this.y));
        this.targetX = Math.max(halfW, Math.min(WIDTH - halfW, this.targetX));
        this.targetY = Math.max(-800 + halfH, Math.min(HEIGHT - halfH, this.targetY));
    }
    overview() { this.targetZoom = 1; this.targetX = WIDTH / 2; this.targetY = HEIGHT / 2; }
    focus(x: number, y: number, zoom = this.targetZoom) { this.targetX = x; this.targetY = y; this.targetZoom = Math.max(1, Math.min(3.5, zoom)); }
    update(snap = false) {
        const amount = snap ? 1 : 0.12;
        this.zoom += (this.targetZoom - this.zoom) * amount;
        this.x += (this.targetX - this.x) * amount;
        this.y += (this.targetY - this.y) * amount;
        this.clamp();
    }
    zoomAt(screenX: number, screenY: number, factor: number, now: number) {
        const before = this.screenToWorld(screenX, screenY);
        this.zoom = this.targetZoom = Math.max(1, Math.min(3.5, this.zoom * factor));
        const after = this.screenToWorld(screenX, screenY);
        this.x += before.x - after.x; this.y += before.y - after.y;
        this.targetX = this.x; this.targetY = this.y;
        this.manualUntil = now + 4000;
        this.clamp();
    }
    pan(dx: number, dy: number, now: number) {
        this.x -= dx / this.scale; this.y -= dy / this.scale;
        this.targetX = this.x; this.targetY = this.y; this.manualUntil = now + 4000; this.clamp();
    }
}
