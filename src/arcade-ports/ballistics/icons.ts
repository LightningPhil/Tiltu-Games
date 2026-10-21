/** Ported from neon-synth-ballistics; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
const drawings = [
    '<path d="M4 15L20 5l4 6L8 21z" fill="#8297aa"/><path d="M20 5l5-2 3 5-4 3" fill="#ffd69a"/><path d="M3 16l-2 4 6 1" stroke="#f2a681"/>',
    '<path d="M12 6h8v4h-8z" fill="#b9cba7"/><path d="M11 10h11l3 4v8H8v-8z" fill="#9fcb8f"/><path d="M8 15h17M16 10v12" stroke="#527459"/>',
    '<path d="M7 13h8v9H7zM14 6h8v10h-8zM20 15h7v8h-7z" fill="#b8ce8c"/><path d="M9 10l-2-4M18 3V0M26 12l3-4" stroke="#ffd9a2"/>',
    '<path d="M4 11h15v8H4z" fill="#718da4"/><path d="M19 13h7v4h-7zM6 19v4" fill="#a2f2c1"/><path d="M22 4l-4 6h5l-5 9" stroke="#9effc3"/>',
    '<path d="M17 2v8L3 15v3l14-2v5l-4 3v2l6-2 6 2v-2l-4-3v-5l12 2v-3l-12-5V2z" fill="#8bbed1"/>',
    '<path d="M7 5h7v14H7zM19 5h7v14h-7zM13 8h7v8h-7z" fill="#8ba4ba"/><path d="M8 20l2 5 3-5M20 20l3 5 2-5" fill="#ffb68a"/><path d="M9 2h3v3M21 2h3v3" stroke="#bdf8eb"/>',
    '<path d="M7 7h7M7 7v6M25 7h-7M25 7v6M7 24h7M7 24v-6M25 24h-7M25 24v-6" stroke="#95e9df"/><path d="M17 8l-5 9h6l-3 7 9-12h-7z" fill="#baacf5"/>',
    '<path d="M4 23l13-10 8-5M22 3l6 5-4 8-8-1 1-6" stroke="#f6d49e" fill="none"/><path d="M1 25h5" stroke="#95afbd"/>',
    '<path d="M3 11h25v5H11l-4 7H3l2-9" fill="#aa9b8d"/><path d="M8 11h19M8 16h17" stroke="#dfceaa"/><path d="M27 7l4-3M28 19l4 3" stroke="#ffd595"/>',
    '<path d="M6 8h6v15H6zM13 5h6v18h-6zM20 8h6v15h-6z" fill="#ef8b93"/><path d="M6 14h20v4H6z" fill="#55647b"/><path d="M16 5V2l4-1" stroke="#ffe7ad"/>',
];
export function weaponIcon(id: number) {
    return `<svg viewBox="0 0 34 28" aria-hidden="true" stroke-width="1.5" stroke-linecap="square">${drawings[id] || ''}</svg>`;
}
