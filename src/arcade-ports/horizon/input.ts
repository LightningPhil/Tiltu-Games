/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import {VirtualStick} from '../../arcade-controls.ts';
import { clamp, flightStick } from './flight.ts';
import { shapeAxis, type Settings } from './game.ts';

export type FlightInput = { pitch: number; yaw: number; roll: number; fire: boolean; brake: boolean; boost: boolean; pulse: boolean; level: boolean; mouseX: number; mouseY: number; view?: boolean; throttle?: number; throttleAxis?: number; strafeX?: number; strafeY?: number; drift?: boolean };
const CODES = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyZ', 'KeyC', 'KeyT', 'KeyG', 'AltLeft', 'AltRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'Space', 'KeyF']);

export class Input {
    keys = new Set<string>();
    touch = { x: 0, y: 0, fire: false, boost: false, brake: false };
    pointerFire = false;
    pulseQueued = false;
    levelQueued = false;
    mouseX = 0;
    mouseY = 0;
    padPause = false;
    padPulse = false;
    padLevel = false;
    padView = false;
    padThrottle = 0;
    padThrottleDelay = 0;
    controller = false;
    lastUnlockPause = -Infinity;
    captureDenied = false;
    dragPointer: number | null = null;
    dragX = 0;
    dragY = 0;
    stick: VirtualStick | null = null;
    actionPointers = new Map<HTMLElement, Set<number>>();
    actionBindings: { action: string; pointers: Set<number> }[] = [];
    mouseStick = { x: 0, y: 0, active: false };
    mouseRadius = 1;
    canvas: HTMLCanvasElement;
    settings: Settings;
    active: () => boolean;
    pause: () => void;
    constructor(canvas: HTMLCanvasElement, settings: Settings, active: () => boolean, pause: () => void) {
        this.canvas = canvas; this.settings = settings; this.active = active; this.pause = pause;
        document.addEventListener('keydown', event => this.key(event, true));
        document.addEventListener('keyup', event => this.key(event, false));
        canvas.addEventListener('pointerdown', event => {
            if (!this.active()) return;
            if (event.button === 0) {
                if (settings.controls === 'mouse' && document.pointerLockElement !== canvas) {
                    this.capture(); this.dragPointer = event.pointerId; this.dragX = event.clientX; this.dragY = event.clientY;
                    canvas.setPointerCapture(event.pointerId);
                }
                this.pointerFire = true;
            } else if (event.button === 2 && event.pointerType !== 'mouse') this.pulseQueued = true;
            else if (event.button === 1) this.queueLevel();
            // Cancelling a mouse PointerDown suppresses the compatibility MouseDown needed for a second button.
            if (event.pointerType !== 'mouse' || event.button === 1) event.preventDefault();
        });
        canvas.addEventListener('pointermove', event => {
            if (this.active() && this.settings.controls === 'flightstick' && event.pointerType !== 'touch') {
                const rect = canvas.getBoundingClientRect(), radius = Math.min(rect.width, rect.height) * .27;
                this.mouseRadius = radius;
                const x = event.clientX - rect.left - rect.width / 2, y = event.clientY - rect.top - rect.height / 2, limit = Math.max(1, Math.hypot(x, y) / radius);
                if (!this.mouseStick.active && Math.hypot(x, y) > radius * .12) return;
                this.mouseStick = { x: x / limit, y: y / limit, active: true };
            }
            if (!this.active() || this.settings.controls !== 'mouse' || this.dragPointer !== event.pointerId || document.pointerLockElement === canvas) return;
            this.mouseX += event.clientX - this.dragX; this.mouseY += event.clientY - this.dragY;
            this.dragX = event.clientX; this.dragY = event.clientY;
        });
        canvas.addEventListener('pointerleave', () => { this.mouseStick = { x: 0, y: 0, active: false }; });
        // Mouse events also fire for a second held button; PointerDown alone does not.
        canvas.addEventListener('mousedown', event => {
            if (!this.active()) return;
            if (event.button === 2) { this.pulseQueued = true; event.preventDefault(); }
            else if (event.button === 1) { this.queueLevel(); event.preventDefault(); }
        });
        canvas.addEventListener('contextmenu', event => event.preventDefault());
        window.addEventListener('pointerup', event => { if (event.button === 0) { this.pointerFire = false; this.endDrag(); } });
        window.addEventListener('mouseup', event => { if (event.button === 0) { this.pointerFire = false; this.endDrag(); } });
        window.addEventListener('pointercancel', event => { if(event.target===canvas){this.pointerFire=false;this.endDrag();} });
        document.addEventListener('mousemove', event => {
            if (!this.active() || document.pointerLockElement !== canvas) return;
            // Relative mouse aim has no velocity acceleration; smoothing removes event-rate jitter.
            this.mouseX += event.movementX; this.mouseY += event.movementY;
        });
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === canvas) { this.captureDenied = false; this.endDrag(); }
            if (!document.pointerLockElement && this.active() && settings.controls === 'mouse') {
                this.lastUnlockPause = performance.now(); this.pause();
            }
        });
        document.addEventListener('pointerlockerror', () => { this.captureDenied = true; });
        this.bindTouch();
    }
    key(event: KeyboardEvent, pressed: boolean) {
        if (!pressed) this.keys.delete(event.code);
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
        if((event.target as HTMLElement)?.tagName==='BUTTON'&&['Space','Enter'].includes(event.code))return;
        if (pressed && !event.repeat && (event.code === 'KeyP' || event.code === 'Escape')) {
            event.preventDefault();
            if (event.code !== 'Escape' || this.active() || performance.now() - this.lastUnlockPause > 250) this.pause();
            return;
        }
        if (!this.active() || !CODES.has(event.code)) return;
        event.preventDefault();
        if (pressed) this.keys.add(event.code);
        if (event.code === 'KeyF' && pressed && !event.repeat) this.pulseQueued = true;
        if (event.code === 'KeyR' && pressed && !event.repeat) this.queueLevel();
    }
    queueLevel() { this.levelQueued = true; this.mouseX = this.mouseY = 0; this.mouseStick = { x: 0, y: 0, active: false }; }
    capture(force = false) {
        if (force) this.captureDenied = false;
        if (this.captureDenied) return;
        if (this.settings.controls !== 'mouse' || document.pointerLockElement === this.canvas) return;
        try {
            const result = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
            result?.catch(() => { this.captureDenied = true; });
        } catch { this.captureDenied = true; }
    }
    endDrag() {
        if (this.dragPointer !== null && this.canvas.hasPointerCapture(this.dragPointer)) this.canvas.releasePointerCapture(this.dragPointer);
        this.dragPointer = null;
    }
    clear() {
        this.endDrag();
        this.keys.clear(); this.pointerFire = this.pulseQueued = this.levelQueued = false; this.mouseX = this.mouseY = 0;
        this.mouseStick = { x: 0, y: 0, active: false };
        this.touch.x = this.touch.y = 0; this.touch.fire = this.touch.boost = this.touch.brake = false;
        this.stick?.reset();
        for (const [button, pointers] of this.actionPointers) {
            for (const pointer of pointers) if (button.hasPointerCapture(pointer)) button.releasePointerCapture(pointer);
            pointers.clear();button.setAttribute('aria-pressed','false');
        }
        document.querySelectorAll('.touch-action').forEach(button => button.classList.remove('held'));
    }
    release() { this.clear(); if (document.pointerLockElement === this.canvas) document.exitPointerLock(); }
    pollPadPause() {
        let pad: Gamepad | null = null;
        try { pad = Array.from(navigator.getGamepads?.() || []).find(p => p?.connected && p.mapping === 'standard') || null; } catch {}
        this.controller = Boolean(pad) && (this.settings.controls === 'gamepad' || this.settings.controls === 'keyboard');
        const pause = Boolean(pad?.buttons[9]?.pressed);
        if (pause && !this.padPause) this.pause();
        this.padPause = pause;
        return pad;
    }
    sample(dt: number, pad: Gamepad | null): FlightInput {
        const down = (...codes: string[]) => codes.some(code => this.keys.has(code));
        const button = (index: number) => Boolean(pad?.buttons[index]?.pressed);
        const padPulse = button(1);
        const pulse = this.pulseQueued || padPulse && !this.padPulse;
        this.pulseQueued = false; this.padPulse = padPulse;
        const padLevel = button(2), padLevelEdge = padLevel && !this.padLevel, level = this.levelQueued || padLevelEdge;
        if (padLevelEdge) this.mouseX = this.mouseY = 0;
        this.levelQueued = false; this.padLevel = padLevel;
        const view = button(3) && !this.padView; this.padView = button(3);
        const direction = Number(button(12)) - Number(button(13)); this.padThrottleDelay = Math.max(0, this.padThrottleDelay - dt);
        let throttle = 0;
        if (direction && (direction !== this.padThrottle || this.padThrottleDelay === 0)) { throttle = direction; this.padThrottleDelay = .28; }
        this.padThrottle = direction;
        const mousePart = 1 - Math.exp(-32 * dt), mouseX = this.mouseX * mousePart, mouseY = this.mouseY * mousePart;
        this.mouseX -= mouseX; this.mouseY -= mouseY;
        const stickMode = this.settings.controls === 'flightstick';
        const mouse = stickMode && this.mouseStick.active ? flightStick(this.mouseStick.x, this.mouseStick.y, this.mouseRadius) : { x: 0, y: 0 };
        const pitch = Number(down('ArrowUp') || !stickMode && down('KeyW')) - Number(down('ArrowDown') || !stickMode && down('KeyS')) - shapeAxis(pad?.axes[1] || 0) - this.touch.y - mouse.y;
        const yaw = Number(down('ArrowLeft') || !stickMode && down('KeyA')) - Number(down('ArrowRight') || !stickMode && down('KeyD')) - shapeAxis(pad?.axes[0] || 0) - this.touch.x - mouse.x;
        return { pitch: clamp(pitch, -1, 1), yaw: clamp(yaw, -1, 1),
            roll: clamp(Number(down('KeyQ')) - Number(down('KeyE')) - shapeAxis(pad?.axes[2] || 0), -1, 1),
            fire: down('Space') || this.pointerFire || this.touch.fire || button(7) || button(0),
            brake: down('ControlLeft', 'ControlRight') || this.touch.brake || button(6),
            boost: down('ShiftLeft', 'ShiftRight') || this.touch.boost || button(5), pulse, level, mouseX, mouseY, view, throttle,
            throttleAxis: (stickMode ? Number(down('KeyW')) - Number(down('KeyS')) : 0) - shapeAxis(pad?.axes[3] || 0),
            strafeX: Number(down('KeyC') || stickMode && down('KeyD')) - Number(down('KeyZ') || stickMode && down('KeyA')),
            strafeY: Number(down('KeyT')) - Number(down('KeyG')), drift: down('AltLeft', 'AltRight') || button(4) };
    }
    bindTouch() {
        const stick = document.getElementById('touch-stick')!;
        this.stick = new VirtualStick(stick,()=>{this.touch.x=this.stick?.x??0;this.touch.y=this.stick?.y??0;},this.active);
        for (const [id, action] of [['touch-fire', 'fire'], ['touch-boost', 'boost'], ['afterburner-button', 'boost'], ['touch-brake', 'brake'], ['touch-pulse', 'pulse']] as const) {
            const button = document.getElementById(id); if (!button) continue;
            const pointers = new Set<number>();
            this.actionPointers.set(button, pointers);
            this.actionBindings.push({ action, pointers });
            button.addEventListener('pointerdown', event => {
                if (!this.active() || event.button>0) return;
                pointers.add(event.pointerId); button.setPointerCapture(event.pointerId); button.classList.add('held');button.setAttribute('aria-pressed','true'); event.preventDefault();
                if (action === 'pulse') this.pulseQueued = true; else this.touch[action] = true;
            });
            const releaseAction = (event: PointerEvent) => {
                pointers.delete(event.pointerId);
                if (!pointers.size) { if (action !== 'pulse') this.touch[action] = this.actionBindings.some(binding => binding.action === action && binding.pointers.size > 0); button.classList.remove('held');button.setAttribute('aria-pressed','false'); }
            };
            button.addEventListener('pointerup', releaseAction); button.addEventListener('pointercancel', releaseAction); button.addEventListener('lostpointercapture', releaseAction);
        }
    }
}
