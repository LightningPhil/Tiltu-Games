import test from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../src/arcade-ports/horizon/input.ts';
import { parseSettings } from '../src/arcade-ports/horizon/game.ts';

// Minimal event targets keep input regressions independent of WebGL and a browser install.
class Element extends EventTarget {
    style: Record<string, string> = {};
    captures = new Set<number>();
    classList = { add() {}, remove() {} };
    setPointerCapture(id: number) { this.captures.add(id); }
    releasePointerCapture(id: number) { this.captures.delete(id); }
    hasPointerCapture(id: number) { return this.captures.has(id); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
}
class InputElement extends Element {}
class SelectElement extends Element {}
class TextareaElement extends Element {}
function send(target: EventTarget, type: string, data: Record<string, unknown> = {}) {
    const event = new Event(type, { cancelable: true }); Object.assign(event, data); target.dispatchEvent(event); return event;
}

test('gamepad camera is an edge action and cruise pace repeats at a bounded rate', async () => {
    await withDom(({ input }) => {
        const pad: any = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
        pad.buttons[3].pressed = true; pad.buttons[12].pressed = true;
        const first = input.sample(1 / 120, pad); assert.equal(first.view, true); assert.equal(first.throttle, 1);
        let steps = 1;
        for (let i = 0; i < 120; i++) { const sample = input.sample(1 / 120, pad); assert.equal(sample.view, false); steps += sample.throttle || 0; }
        assert.equal(steps, 4);
        pad.buttons[12].pressed = false; pad.buttons[13].pressed = true; assert.equal(input.sample(1 / 120, pad).throttle, -1);
        pad.buttons[3].pressed = false; input.sample(.01, pad); pad.buttons[3].pressed = true; assert.equal(input.sample(.01, pad).view, true);
    });
});
async function withDom(action: (env: any) => void | Promise<void>) {
    const elements = new Map<string, Element>();
    for (const id of ['touch-stick', 'stick-knob', 'touch-fire', 'touch-brake', 'touch-boost', 'touch-pulse', 'afterburner-button']) elements.set(id, new Element());
    const document = Object.assign(new EventTarget(), {
        pointerLockElement: null as unknown,
        getElementById: (id: string) => elements.get(id),
        querySelectorAll: () => [...elements.values()],
        exitPointerLock() { document.pointerLockElement = null; send(document, 'pointerlockchange'); },
    });
    const window = new EventTarget(), canvas = Object.assign(new Element(), { requestPointerLock: () => Promise.reject(new Error('Capture unavailable')) });
    let gamepad: any = null;
    const replacements = { document, window, HTMLInputElement: InputElement, HTMLSelectElement: SelectElement, HTMLTextAreaElement: TextareaElement,
        navigator: { getGamepads: () => gamepad ? [gamepad] : [] } };
    const previous = new Map<string, PropertyDescriptor | undefined>();
    for (const [name, value] of Object.entries(replacements)) { previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, value }); }
    let active = true, toggles = 0;
    const settings = parseSettings('{"controls":"mouse"}');
    try {
        const input = new Input(canvas as any, settings, () => active, () => { active = !active; toggles++; });
        await action({ input, canvas, document, window, elements, settings, setActive: (value: boolean) => active = value, toggles: () => toggles, setPad: (value: any) => gamepad = value });
    } finally {
        for (const [name, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
    }
}

test('mouse flight stick arms at neutral, has independent throttle and strafe, and clears on leave and pause', async () => {
    await withDom(({ input, canvas, document, settings }) => {
        settings.controls = 'flightstick';
        send(canvas, 'pointermove', { pointerType: 'mouse', clientX: 95, clientY: 50 }); assert.equal(input.sample(.01, null).yaw, 0, 'launching from a menu button cannot start a hard turn');
        send(canvas, 'pointermove', { pointerType: 'mouse', clientX: 50, clientY: 50 }); assert.equal(input.mouseStick.active, true);
        send(canvas, 'pointermove', { pointerType: 'mouse', clientX: 65, clientY: 40 });
        send(document, 'keydown', { code: 'KeyW' }); send(document, 'keydown', { code: 'KeyD' });
        const flight = input.sample(.01, null); assert.ok(flight.yaw < 0 && flight.pitch > 0); assert.equal(flight.throttleAxis, 1); assert.equal(flight.strafeX, 1);
        send(canvas, 'pointerleave'); assert.equal(input.sample(.01, null).yaw, 0);
        input.clear(); const clear = input.sample(.01, null); assert.equal(clear.throttleAxis, 0); assert.equal(clear.strafeX, 0); assert.equal(input.mouseStick.active, false);
    });
});

test('the visible afterburner and touch boost share hold state without releasing each other', async () => {
    await withDom(({ input, elements }) => {
        const desktop = elements.get('afterburner-button'), touch = elements.get('touch-boost');
        send(desktop, 'pointerdown', { pointerId: 10 }); assert.equal(input.sample(.01, null).boost, true);
        send(touch, 'pointerdown', { pointerId: 11 }); send(desktop, 'pointerup', { pointerId: 10 }); assert.equal(input.sample(.01, null).boost, true);
        send(touch, 'pointerup', { pointerId: 11 }); assert.equal(input.sample(.01, null).boost, false);
        send(desktop, 'pointerdown', { pointerId: 12 }); input.release(); assert.equal(input.sample(.01, null).boost, false);
    });
});

test('denied mouse capture keeps drag aiming and firing available', async () => {
    await withDom(async ({ input, canvas, window }) => {
        input.capture(); await Promise.resolve(); assert.equal(input.captureDenied, true);
        send(canvas, 'pointerdown', { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
        send(canvas, 'pointermove', { pointerId: 1, clientX: 160, clientY: 75 });
        const sampled = input.sample(0.5, null);
        assert.equal(sampled.fire, true); assert.ok(sampled.mouseX > 59); assert.ok(sampled.mouseY < -24);
        send(window, 'mouseup', { button: 0 });
        assert.equal(input.sample(0.01, null).fire, false); assert.equal(input.dragPointer, null); assert.equal(canvas.hasPointerCapture(1), false);
    });
});
test('right mouse EMP works during held cannon fire and releasing left stops fire immediately', async () => {
    await withDom(({ input, canvas, window, settings }) => {
        settings.controls = 'keyboard';
        const down = send(canvas, 'pointerdown', { button: 0, pointerId: 1, pointerType: 'mouse', clientX: 50, clientY: 50 });
        assert.equal(down.defaultPrevented, false, 'cancelling PointerDown would suppress the browser compatibility MouseDown');
        send(canvas, 'mousedown', { button: 2 });
        const sampled = input.sample(0.01, null); assert.equal(sampled.fire, true); assert.equal(sampled.pulse, true);
        assert.equal(input.sample(0.01, null).pulse, false);
        send(canvas, 'mousedown', { button: 1 }); const recovery = input.sample(0.01, null);
        assert.equal(recovery.level, true); assert.equal(recovery.fire, true, 'middle mouse can recover the attitude without releasing cannon fire');
        send(window, 'mouseup', { button: 0 }); assert.equal(input.sample(0.01, null).fire, false);
    });
});
test('pause clears every touch pointer and the stick can be used again', async () => {
    await withDom(({ input, elements }) => {
        const stick = elements.get('touch-stick'), fire = elements.get('touch-fire'), brake = elements.get('touch-brake');
        send(stick, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 50 });
        send(fire, 'pointerdown', { pointerId: 2 }); send(brake, 'pointerdown', { pointerId: 3 });
        const held = input.sample(0.1, null); assert.equal(held.yaw, -1); assert.equal(held.fire, true); assert.equal(held.brake, true);
        input.release(); const cleared = input.sample(0.1, null);
        assert.equal(cleared.yaw, 0); assert.equal(cleared.fire, false); assert.equal(cleared.brake, false);
        assert.equal(stick.captures.size, 0); assert.equal(fire.captures.size, 0); assert.equal(brake.captures.size, 0);
        send(stick, 'pointerdown', { pointerId: 4, clientX: 0, clientY: 50 }); assert.equal(input.sample(0.1, null).yaw, 1);
        send(stick, 'pointercancel', { pointerId: 4 }); assert.equal(input.sample(0.1, null).yaw, 0);
    });
});
test('several fingers on a fire button do not leave it stuck or release each other', async () => {
    await withDom(({ input, elements }) => {
        const fire = elements.get('touch-fire');
        send(fire, 'pointerdown', { pointerId: 2 }); send(fire, 'pointerdown', { pointerId: 3 });
        send(fire, 'pointerup', { pointerId: 2 }); assert.equal(input.sample(0.01, null).fire, true);
        send(fire, 'lostpointercapture', { pointerId: 3 }); assert.equal(input.sample(0.01, null).fire, false);
    });
});

test('cancelling an action finger leaves an independent steering finger active',async()=>{
    await withDom(({input,elements,window})=>{
        const stick=elements.get('touch-stick'),fire=elements.get('touch-fire');
        send(stick,'pointerdown',{pointerId:1,clientX:100,clientY:50});
        send(fire,'pointerdown',{pointerId:2});
        send(fire,'pointercancel',{pointerId:2});send(window,'pointercancel',{pointerId:2});
        const current=input.sample(.01,null);assert.equal(current.fire,false);assert.equal(current.yaw,-1);
    });
});
test('a browser unlock followed by the same Escape key cannot instantly resume flight', async () => {
    await withDom(({ document, toggles }) => {
        send(document, 'pointerlockchange'); assert.equal(toggles(), 1);
        send(document, 'keydown', { code: 'Escape', repeat: false }); assert.equal(toggles(), 1);
        send(document, 'keydown', { code: 'KeyP', repeat: false }); assert.equal(toggles(), 2);
    });
});
test('standard controller buttons and pause edges have consistent mappings', async () => {
    await withDom(({ input, setPad, toggles }) => {
        const pad = { connected: true, mapping: 'standard', axes: [0.6, -0.6, 0.4, 0], buttons: Array.from({ length: 10 }, () => ({ pressed: false })) };
        for (const index of [1, 5, 6, 7]) pad.buttons[index].pressed = true;
        setPad(pad); const current = input.pollPadPause(), sampled = input.sample(0.01, current);
        assert.ok(sampled.yaw < 0); assert.ok(sampled.pitch > 0); assert.ok(sampled.roll < 0);
        assert.equal(sampled.fire, true); assert.equal(sampled.brake, true); assert.equal(sampled.boost, true); assert.equal(sampled.pulse, true);
        assert.equal(input.sample(0.01, current).pulse, false);
        pad.buttons[9].pressed = true; input.pollPadPause(); input.pollPadPause(); assert.equal(toggles(), 1);
        pad.buttons[9].pressed = false; input.pollPadPause(); pad.buttons[9].pressed = true; input.pollPadPause(); assert.equal(toggles(), 2);
    });
});

test('a connected controller does not replace mouse or touch control cues, and all menu styles restore safely', async () => {
    await withDom(({ input, settings, setPad }) => {
        const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: [] };
        setPad(pad);
        for (const style of ['flightstick', 'mouse', 'touch', 'keyboard', 'gamepad'] as const) {
            settings.controls = style;
            assert.equal(parseSettings(JSON.stringify(settings)).controls, style);
            input.pollPadPause();
            assert.equal(input.controller, style === 'keyboard' || style === 'gamepad');
        }
        assert.equal(parseSettings(null, false, true).controls, 'touch');
    });
});
test('level recovery is an edge action on keyboard, middle mouse and gamepad X, and is cleared by pause', async () => {
    await withDom(({ input, document, canvas }) => {
        input.mouseX = 20; input.mouseY = -80;
        send(document, 'keydown', { code: 'KeyR', repeat: false }); const recovered = input.sample(0.01, null);
        assert.equal(recovered.level, true); assert.equal(recovered.mouseX, 0); assert.equal(recovered.mouseY, 0);
        send(document, 'keydown', { code: 'KeyR', repeat: true }); assert.equal(input.sample(0.01, null).level, false);
        send(canvas, 'pointerdown', { button: 1, pointerType: 'mouse' }); assert.equal(input.sample(0.01, null).level, true);
        const pad = { axes: [], buttons: [{ pressed: false }, { pressed: false }, { pressed: true }] };
        input.mouseY = 80; const padRecovery = input.sample(0.01, pad);
        assert.equal(padRecovery.level, true); assert.equal(padRecovery.mouseY, 0); assert.equal(input.sample(0.01, pad).level, false);
        send(document, 'keydown', { code: 'KeyR', repeat: false }); input.release(); assert.equal(input.sample(0.01, null).level, false);
    });
});
