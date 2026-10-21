/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import * as THREE from 'three';
import { clamp } from './flight.ts';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
export const GRAVITY = 9.81;
export type Attitude = { pitch: number; bank: number; heading: number };

// +X pitches the -Z-facing nose up; +Y yaws left; +Z lowers the left wing.
// Right multiplication keeps all three axes attached to the craft, through loops and inverted flight.
export function rotateBody(orientation: any, pitch: number, yaw: number, roll: number) {
    const angle = Math.hypot(pitch, yaw, roll);
    if (angle < 1e-12) return orientation.clone();
    const scale = Math.sin(angle / 2) / angle;
    return orientation.clone().multiply(new THREE.Quaternion(pitch * scale, yaw * scale, roll * scale, Math.cos(angle / 2))).normalize();
}

export function readAttitude(orientation: any, previous: Attitude = { pitch: 0, bank: 0, heading: 0 }): Attitude {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(orientation);
    const right = X.clone().applyQuaternion(orientation), up = Y.clone().applyQuaternion(orientation);
    const vertical = Math.hypot(forward.x, forward.z) < .015;
    return { pitch: Math.asin(clamp(forward.y, -1, 1)),
        heading: vertical ? previous.heading : Math.atan2(-forward.x, -forward.z),
        bank: vertical ? previous.bank : Math.atan2(right.y, up.y) };
}

export function autoBankAngle(attitude: Attitude, yawRate: number, dt: number) {
    if (Math.abs(attitude.pitch) > .9 || Math.abs(attitude.bank) > .65) return 0;
    // A left yaw needs a left bank. This is a small local roll, never a replacement orientation.
    const target = clamp(yawRate, -1.4, 1.4) * .24;
    return clamp((target - attitude.bank) * (1 - Math.exp(-4 * dt)), -1.2 * dt, 1.2 * dt);
}

export function recoverBody(orientation: any, heading: number, dt: number) {
    const target = new THREE.Quaternion().setFromAxisAngle(Y, heading);
    const result = orientation.clone().slerp(target, 1 - Math.exp(-5.5 * dt)).normalize();
    const complete = result.angleTo(target) < .008;
    return { orientation: complete ? target : result, complete };
}

export function liftAndGravity(orientation: any, airspeed: number, assisted: boolean, drift: boolean) {
    // Assisted anti-gravity/wing lift supports one g along the craft's UP axis.
    // Banking reduces its vertical component. Manual/drift lift depends on forward airspeed.
    const support = assisted && !drift ? 1 : clamp((Math.max(0, airspeed) / 108) ** 2, 0, 1.8);
    if (support === 0) return { x: 0, y: -GRAVITY, z: 0 };
    const lift = Y.clone().applyQuaternion(orientation).multiplyScalar(GRAVITY * support);
    return { x: lift.x, y: lift.y - GRAVITY, z: lift.z };
}

export function chaseCounterBank(bank: number, reducedMotion: boolean) {
    // Periodic through a full roll: no camera jump at the ±180° reporting boundary.
    return reducedMotion ? -bank : -Math.sin(bank) * .55;
}
