/** Ported from neon-horozon; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
// Route codes preserve all 32 seed bits, including routes saved by earlier versions.
export function routeCode(seed: number) { return 'NH-' + (seed >>> 0).toString(36).toUpperCase().padStart(7, '0'); }
export function parseRoute(value: string): number | null {
    const code = value.trim().toUpperCase().replace(/^NH-/, '');
    if (!/^[0-9A-Z]{7}$/.test(code)) return null;
    const seed = Number.parseInt(code, 36);
    return seed <= 0xffffffff ? seed : null;
}

