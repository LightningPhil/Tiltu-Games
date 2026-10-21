// @ts-nocheck
/** Ported from neon-void; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
// Cosmetics must never consume the random sequence used by enemies and loot.
let seed=0x4e564658;
export function effectsRandom() {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/2**32;
}
