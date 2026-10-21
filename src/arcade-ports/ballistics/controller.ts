/** Full gameplay port from neon-synth-ballistics, hosted by Tiltu's Games. */
import type {PortScope,PortHooks} from '../scope.ts';
import {bindScope} from './environment.ts';
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { AudioEngine, TRACKS } from './audio.ts';
import { Battle, COLORS, HEIGHT, MAX_ELEVATION, MAX_POWER, MIN_ELEVATION, WEAPONS, WEAPON_KEYS, WIDTH } from './game.ts';
import type { BattleOptions } from './game.ts';
import { generateMap, parseMapCode, randomMapCode, readMapPreferences, rememberMap } from './maps.ts';
import { normalizePreferences, readPreferences, savePreferences } from './settings.ts';
import type { MatchMode } from './settings.ts';
import { Renderer } from './renderer.ts';
import { CPUController } from './ai.ts';
import { weaponIcon } from './icons.ts';
import {holdControl} from '../../arcade-controls.ts';
export function createGame(scope:PortScope):PortHooks {
bindScope(scope);
// BEGIN GAME RUNTIME
const el = (id: string) => document.getElementById(id)!;
const input = (id: string) => el(id) as HTMLInputElement;
const button = (id: string) => el(id) as HTMLButtonElement;
const text = (id: string, value: string) => { if (el(id).textContent !== value) el(id).textContent = value; };
function storage() { try { return window.localStorage; } catch { return undefined; } }
let preferences = readPreferences(storage(), window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const savedMaps = readMapPreferences(storage());
const initialCode = parseMapCode(new URLSearchParams(window.location.search).get('map') || '') || savedMaps?.selected || randomMapCode();
let previewMap = generateMap(initialCode);
let recentMaps = savedMaps?.recent || [];
let battle = new Battle(initialCode, Math.random, preferences);
let mode: MatchMode = 'solo';
let started = false;
let inMenu = true;
let paused = false;
let awaitingReady = false;
let titleSettings = false;
let accumulator = 0;
let lastFrame = 0;
let hudAt = 0;
let bannerTicks = 0;
let lastAnnounced = '';
let controlTap = false;
let pointer: { x: number; y: number } | null = null;
let logOpen = false;
let paintedLog = '';
let jetting = false;
let mixPreviewTimer = 0;
let cpu = new CPUController();
const keys = new Set<string>();
const touchKeys=new Set<string>(),heldControls:{reset:()=>void}[]=[];
const keyDown=(key:string)=>keys.has(key)||touchKeys.has(key);
const stage = el('stage');
const renderer = new Renderer(el('game-layer') as HTMLCanvasElement, el('minimap') as HTMLCanvasElement);

const cards = WEAPONS.map((weapon, id) => {
    const card = document.createElement('button');
    card.className = 'weapon-card'; card.id = `w-${id}`;
    card.title = `${WEAPON_KEYS[id]}: ${weapon.hint}`;
    card.setAttribute('aria-label', `${WEAPON_KEYS[id]}: ${weapon.name}. ${weapon.hint}`);
    card.innerHTML = `<span class="key-hint">${WEAPON_KEYS[id]}</span><span class="weapon-icon">${weaponIcon(id)}</span><span>${weapon.name}</span><span class="weapon-ammo"></span>`;
    card.addEventListener('click', () => { if (humanCanPlay() && battle.equip(id)) { AudioEngine.ui(); card.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } card.blur(); updateHUD(); });
    el('weapon-panel').append(card); return card;
});
const weaponSelect=document.createElement('select');weaponSelect.id='weapon-select';weaponSelect.setAttribute('aria-label','Arsenal');
weaponSelect.innerHTML=WEAPONS.map((weapon,id)=>`<option value="${id}">${weapon.name}</option>`).join('');
const arsenal=document.createElement('label');arsenal.className='mobile-arsenal';arsenal.append('Arsenal',weaponSelect);el('weapon-panel').before(arsenal);
weaponSelect.addEventListener('change',()=>{if(humanCanPlay()&&battle.equip(Number(weaponSelect.value)))AudioEngine.ui();updateHUD();});
const rosterButtons = battle.units.map(unit => {
    const card = document.createElement('button');
    const name = document.createElement('span'), hp = document.createElement('span'); hp.className = 'roster-hp';
    card.append(name, hp);
    card.addEventListener('click', () => { if (humanCanPlay() && battle.selectUnit(unit.id)) { selectedUnitChanged(); } });
    el(`p${unit.team + 1}-roster`).append(card); return card;
});

function humanCanPlay() { return started && !inMenu && !paused && !awaitingReady && battle.phase !== 'over' && !(mode === 'solo' && battle.team === 1); }
function clearInput() {
    for(const control of heldControls)control.reset();touchKeys.clear();
    keys.clear(); battle.charging = false; battle.power = 0; controlTap = false; jetting = false; AudioEngine.charge(0);
    for (const id of pointers.keys()) if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
    pointers.clear(); gestureStart = null; gesturePan = false; pinchDistance = 0; stage.classList.remove('panning');
}
function stopMixPreview(suspend = false) {
    if (!mixPreviewTimer) return;
    window.clearTimeout(mixPreviewTimer); mixPreviewTimer = 0;
    text('test-sound-button', 'PREVIEW MIX'); button('test-sound-button').setAttribute('aria-pressed', 'false');
    if (suspend) AudioEngine.pause();
}
function touchLayout() { return window.matchMedia('(pointer: coarse), (max-width: 760px)').matches; }
function initAudio() { try { AudioEngine.init(); AudioEngine.configure(preferences); } catch { /* The game remains playable without audio hardware. */ } }
function applyPreferences(save = false) {
    if (save) preferences = savePreferences(storage(), preferences);
    AudioEngine.configure(preferences);
    document.body.classList.toggle('reduced-motion', preferences.reducedMotion);
    input('mute-setting').checked = preferences.muted;
    input('motion-setting').checked = preferences.reducedMotion;
    input('guide-setting').checked = preferences.trajectoryGuide;
    input('camera-setting').checked = preferences.autoCamera;
    input('vol-music').value = String(Math.round(preferences.music * 100));
    input('vol-sfx').value = String(Math.round(preferences.sfx * 100));
    text('track-btn', TRACKS[preferences.track]);
    text('mute-button', preferences.muted ? 'SOUND OFF' : 'SOUND ON');
    button('mute-button').setAttribute('aria-label', preferences.muted ? 'Unmute audio' : 'Mute audio');
    button('follow-button').setAttribute('aria-pressed', String(preferences.autoCamera));
}
function hydrateSetup() {
    (el('difficulty-select') as HTMLSelectElement).value = preferences.difficulty;
    (el('turn-time-select') as HTMLSelectElement).value = String(preferences.turnSeconds);
    (el('sudden-death-select') as HTMLSelectElement).value = String(preferences.suddenDeathRound);
    for (let team = 0; team < 2; team++) {
        input(`team-${team}-name`).value = preferences.teamNames[team];
        for (let i = 0; i < 3; i++) input(`unit-${team}-${i}`).value = preferences.unitNames[team][i];
    }
    text('brief-number', String(preferences.turnSeconds));
}
function readSetup() {
    preferences = normalizePreferences({ ...preferences,
        difficulty: (el('difficulty-select') as HTMLSelectElement).value,
        turnSeconds: Number((el('turn-time-select') as HTMLSelectElement).value),
        suddenDeathRound: Number((el('sudden-death-select') as HTMLSelectElement).value),
        teamNames: [input('team-0-name').value, input('team-1-name').value],
        unitNames: [0, 1].map(team => [0, 1, 2].map(i => input(`unit-${team}-${i}`).value)),
    });
    applyPreferences(true); return preferences;
}

function syncModal() {
    el('start-overlay').hidden = !inMenu || titleSettings;
    el('settings-menu').hidden = !(paused || titleSettings);
    el('handoff-overlay').hidden = !awaitingReady || paused || inMenu;
    const blocked = inMenu || paused || titleSettings || awaitingReady || battle.phase === 'over';
    for (const id of ['hud', 'battlefield', 'dashboard']) (el(id) as HTMLElement & { inert: boolean }).inert = blocked;
    button('return-button').hidden = !started || battle.phase === 'over';
    button('restart-button').hidden = !started || titleSettings;
    button('map-menu-button').hidden = titleSettings;
    button('settings-resume-button').textContent = titleSettings ? 'BACK TO WORKSHOP' : 'RESUME OPERATION';
    text('settings-eyebrow', titleSettings ? 'SYSTEM CONFIGURATION' : 'BATTLEFIELD PAUSED');
}
function newMatch(nextMode: MatchMode, code: string, options: BattleOptions) {
    stopMixPreview(); clearInput(); mode = nextMode;
    battle = new Battle(code, Math.random, { ...options, practice: nextMode === 'practice' });
    recentMaps = rememberMap(storage(), code, recentMaps).recent;
    started = true; inMenu = false; paused = false; awaitingReady = false; titleSettings = false;
    accumulator = 0; lastFrame = 0; cpu = new CPUController(); pointer = null; logOpen = false;
    el('battle-log').hidden = true; button('log-button').setAttribute('aria-expanded', 'false');
    el('game-over').hidden = true; initAudio(); AudioEngine.resume();
    renderer.reset(battle);
    const field = el('battlefield');
    if (field.clientWidth < 760) renderer.camera.focus(battle.active.x, battle.active.y - 80, 3.2);
    else if (field.clientWidth / field.clientHeight > WIDTH / HEIGHT * 1.3) {
        renderer.camera.focus(battle.active.x, battle.active.y - 60, Math.min(3.5, field.clientWidth / WIDTH / renderer.camera.fitScale));
    }
    processEvents(); syncModal(); updateHUD();
    if (!awaitingReady) (document.activeElement as HTMLElement)?.blur();
}
function setPause(value: boolean) {
    stopMixPreview(titleSettings);
    if (titleSettings) { if (!value) { titleSettings = false; syncModal(); input('map-code-input').focus(); } return; }
    if (!started || inMenu || battle.phase === 'over' || awaitingReady) return;
    paused = value; clearInput(); accumulator = 0; lastFrame = 0;
    if (value) AudioEngine.pause(); else AudioEngine.resume();
    syncModal(); updateHUD();
    if (value) button('settings-resume-button').focus(); else button('pause-button').focus();
}
function showMapMenu() {
    stopMixPreview();
    inMenu = true; paused = false; titleSettings = false; awaitingReady = false;
    clearInput(); AudioEngine.pause(); el('game-over').hidden = true;
    showMap(battle.mapCode); syncModal(); updateHUD(); input('map-code-input').focus();
}
function ready() {
    if (!awaitingReady) return;
    awaitingReady = false; clearInput(); accumulator = 0; lastFrame = 0;
    initAudio(); AudioEngine.resume(); AudioEngine.turn(battle.team); syncModal(); updateHUD();
    (document.activeElement as HTMLElement)?.blur();
}
function selectedUnitChanged() {
    text('turn-banner-unit', battle.active.name);
    battle.message = `${battle.active.name} SELECTED — MOVE, AIM, ATTACK`;
    renderer.camera.focus(battle.active.x, battle.active.y - 80);
    AudioEngine.ui(); updateHUD();
}
function resize() { const field = el('battlefield'); renderer.resize(field.clientWidth, field.clientHeight); }
new ResizeObserver(resize).observe(el('battlefield')); resize();

function mapFeedback(message: string, error = false) {
    text('map-feedback', message); el('map-feedback').classList.toggle('error', error);
    input('map-code-input').setAttribute('aria-invalid', String(error));
}
function showMap(code: string) {
    if (code !== previewMap.code) previewMap = generateMap(code);
    input('map-code-input').value = previewMap.code;
    mapFeedback(`MAP ${previewMap.code} / READY TO DEPLOY`);
    text('map-kind', previewMap.kind);
    renderer.drawPreview(previewMap, el('map-preview') as HTMLCanvasElement);
    el('recent-maps').replaceChildren();
    if (!recentMaps.length) { const empty = document.createElement('span'); empty.textContent = 'Your played maps will appear here.'; el('recent-maps').append(empty); }
    for (const code of recentMaps) {
        const recent = document.createElement('button'); recent.textContent = code;
        recent.classList.toggle('selected', code === previewMap.code); recent.setAttribute('aria-label', `Recall map ${code}`);
        recent.addEventListener('click', () => { showMap(code); AudioEngine.ui(); }); el('recent-maps').append(recent);
    }
    for (const id of ['solo-button', 'local-button', 'practice-button', 'copy-preview-code']) button(id).disabled = false;
}
function validateMap() {
    const code = parseMapCode(input('map-code-input').value);
    if (code) { showMap(code); return code; }
    mapFeedback('Use exactly six digits, including any leading zeros.', true);
    for (const id of ['solo-button', 'local-button', 'practice-button', 'copy-preview-code']) button(id).disabled = true;
    return null;
}
function startSelected(nextMode: MatchMode) { const code = validateMap(); if (code) newMatch(nextMode, code, readSetup()); }
input('map-code-input').addEventListener('input', validateMap);
input('map-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); validateMap(); } });
button('random-map-button').addEventListener('click', () => { let code = randomMapCode(); if (code === previewMap.code) code = String((Number(code) + 1) % 1000000).padStart(6, '0'); showMap(code); AudioEngine.ui(); });
async function copyCode(code: string, menu: boolean) {
    try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard not available');
        await navigator.clipboard.writeText(code);
        if (menu) mapFeedback(`COPIED / ${code}`); else battle.message = `COPIED MAP CODE ${code}`;
    } catch {
        if (menu) { input('map-code-input').focus(); input('map-code-input').select(); mapFeedback('Code selected — press Ctrl+C to copy.'); }
        else battle.message = `MAP CODE ${code} — SELECT AND COPY IT IN THE WORKSHOP`;
    }
    updateHUD();
}
button('copy-preview-code').addEventListener('click', () => { const code = parseMapCode(input('map-code-input').value); if (code) void copyCode(code, true); });
button('map-code-display').addEventListener('click', () => { void copyCode(battle.mapCode, false); });
button('solo-button').addEventListener('click', () => startSelected('solo'));
button('local-button').addEventListener('click', () => startSelected('local'));
button('practice-button').addEventListener('click', () => startSelected('practice'));
button('ready-button').addEventListener('click', ready);
button('rematch-button').addEventListener('click', () => newMatch(mode, battle.mapCode, battle.options));
button('restart-button').addEventListener('click', () => newMatch(mode, battle.mapCode, battle.options));
button('title-button').addEventListener('click', showMapMenu);
button('map-menu-button').addEventListener('click', showMapMenu);
button('return-button').addEventListener('click', () => { stopMixPreview(); inMenu = false; clearInput(); accumulator = 0; lastFrame = 0; AudioEngine.resume(); syncModal(); updateHUD(); });
button('pause-button').addEventListener('click', () => setPause(true));
button('resume-button').addEventListener('click', () => setPause(false));
button('settings-resume-button').addEventListener('click', () => setPause(false));
button('title-help-button').addEventListener('click', () => { titleSettings = true; applyPreferences(); syncModal(); button('resume-button').focus(); });
button('skip-button').addEventListener('click', () => { if (humanCanPlay()) { battle.skip(); clearInput(); } });
button('chute-button').addEventListener('click', () => { if (humanCanPlay()) battle.deployChute(); });
function cycleFuse() { if (humanCanPlay() && battle.canAct && !battle.charging) { battle.fuse = battle.fuse % 5 + 1; AudioEngine.ui(); updateHUD(); } }
button('fuse-button').addEventListener('click', cycleFuse);
for (const id of ['difficulty-select', 'turn-time-select', 'sudden-death-select', 'team-0-name', 'team-1-name', ...[0, 1].flatMap(team => [0, 1, 2].map(i => `unit-${team}-${i}`))]) {
    el(id).addEventListener('change', () => { readSetup(); text('brief-number', String(preferences.turnSeconds)); });
}
for (const [id, key] of [['vol-music', 'music'], ['vol-sfx', 'sfx']] as const) input(id).addEventListener('input', () => { preferences[key] = Number(input(id).value) / 100; applyPreferences(true); });
for (const [id, key] of [['mute-setting', 'muted'], ['motion-setting', 'reducedMotion'], ['guide-setting', 'trajectoryGuide'], ['camera-setting', 'autoCamera']] as const) input(id).addEventListener('change', () => { preferences[key] = input(id).checked; applyPreferences(true); });
button('track-btn').addEventListener('click', () => { preferences.track = (preferences.track + 1) % TRACKS.length; applyPreferences(true); });
button('test-sound-button').addEventListener('click', () => {
    if (mixPreviewTimer) { stopMixPreview(true); return; }
    initAudio(); AudioEngine.resume(); AudioEngine.launch(8);
    text('test-sound-button', 'STOP PREVIEW'); button('test-sound-button').setAttribute('aria-pressed', 'true');
    mixPreviewTimer = window.setTimeout(() => { stopMixPreview(paused || inMenu); }, 10000);
});
function toggleMute() { preferences.muted = !preferences.muted; applyPreferences(true); }
button('mute-button').addEventListener('click', toggleMute);
button('follow-button').addEventListener('click', () => { preferences.autoCamera = !preferences.autoCamera; applyPreferences(true); });
button('log-button').addEventListener('click', () => { logOpen = !logOpen; el('battle-log').hidden = !logOpen; button('log-button').setAttribute('aria-expanded', String(logOpen)); updateLog(); });

function zoom(factor: number) { renderer.camera.zoomAt(renderer.camera.width / 2, renderer.camera.height / 2, factor, performance.now()); }
button('zoom-in').addEventListener('click', () => zoom(1.3));
button('zoom-out').addEventListener('click', () => zoom(1 / 1.3));
function overview() { renderer.camera.overview(); renderer.camera.manualUntil = performance.now() + 4000; }
function focus() { renderer.camera.focus(battle.active.x, battle.active.y - 80, 2); renderer.camera.manualUntil = 0; }
button('overview-button').addEventListener('click', overview);
button('focus-button').addEventListener('click', focus);
el('minimap').addEventListener('pointerdown', e => {
    const rect = el('minimap').getBoundingClientRect();
    renderer.camera.focus((e.clientX - rect.left) / rect.width * WIDTH, (e.clientY - rect.top) / rect.height * HEIGHT, Math.max(1.5, renderer.camera.zoom));
    renderer.camera.manualUntil = performance.now() + 5000;
});

const aliases: Record<string, string> = { KeyA: 'ArrowLeft', KeyD: 'ArrowRight', KeyW: 'ArrowUp', KeyS: 'ArrowDown' };
const captured = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'Backspace', 'Tab', 'ShiftLeft', 'ShiftRight', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyF', 'KeyP', 'KeyC', 'KeyZ', 'F2', 'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', ...WEAPON_KEYS.map(key => `Digit${key}`)]);
function modalElement() { return document.querySelector<HTMLElement>('.overlay-screen:not([hidden])'); }
function trapFocus(e: KeyboardEvent) {
    const modal = modalElement(); if (!modal || e.code !== 'Tab') return;
    const focusable = [...modal.querySelectorAll<HTMLElement>('button:not(:disabled):not([hidden]), input:not(:disabled), select:not(:disabled), summary')].filter(node => node.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
}
function pressFire(touch=false) {
    if (!humanCanPlay()) return;
    if ([3, 7, 8, 9].includes(battle.weapon)) battle.fire();
    else if (battle.weapon === 5) (touch?touchKeys:keys).add('Space');
    else if ([4, 6].includes(battle.weapon)) battle.message = 'CLICK THE BATTLEFIELD TO CHOOSE A TARGET';
    else battle.startCharge();
}
function releaseFire(touch=false) { (touch?touchKeys:keys).delete('Space'); if (humanCanPlay() && battle.charging) battle.fire(); }
window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && !e.repeat) {
        e.preventDefault();
        if (titleSettings) setPause(false);
        else if (humanCanPlay() && battle.canAct && [4, 6].includes(battle.weapon)) { battle.equip(0); battle.message = 'TARGETING CANCELLED'; updateHUD(); }
        else setPause(!paused);
        return;
    }
    const editing = (e.target as HTMLElement).matches('input, select, textarea');
    if (awaitingReady && e.code === 'Enter' && !e.repeat) { e.preventDefault(); ready(); return; }
    if (modalElement()) { trapFocus(e); return; }
    if (editing) return;
    if((e.target as HTMLElement).tagName==='BUTTON'&&['Space','Enter'].includes(e.code))return;
    if (e.code === 'KeyM' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); toggleMute(); return; }
    if (started && !paused && !inMenu && !awaitingReady && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.code === 'KeyZ') { e.preventDefault(); overview(); return; }
        if (e.code === 'F2') { e.preventDefault(); focus(); return; }
        if (e.code === 'Equal' || e.code === 'NumpadAdd') { e.preventDefault(); zoom(1.25); return; }
        if (e.code === 'Minus' || e.code === 'NumpadSubtract') { e.preventDefault(); zoom(0.8); return; }
    }
    if (!humanCanPlay()) return;
    if (e.code.startsWith('Control')) { controlTap = true; return; }
    if (e.ctrlKey || e.metaKey || e.altKey) { controlTap = false; return; }
    if (captured.has(e.code)) e.preventDefault();
    keys.add(aliases[e.code] || e.code);
    if (e.repeat) return;
    if (e.code === 'Enter') battle.jump();
    if (e.code === 'Backspace') battle.jump(true);
    if (e.code === 'Tab' && battle.switchUnit()) selectedUnitChanged();
    if (e.code === 'Space') pressFire();
    if (e.code === 'KeyF') cycleFuse();
    if (e.code === 'KeyC') battle.deployChute();
    if (e.code === 'KeyP') { battle.skip(); clearInput(); }
    const id = WEAPON_KEYS.findIndex(key => e.code === `Digit${key}`);
    if (id >= 0 && battle.equip(id)) { AudioEngine.ui(); cards[id].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    updateHUD();
});
window.addEventListener('keyup', e => {
    keys.delete(aliases[e.code] || e.code);
    if (e.code.startsWith('Control') && controlTap && humanCanPlay()) { controlTap = false; if (battle.switchUnit()) selectedUnitChanged(); }
    if (e.code === 'Space') releaseFire();
});
function pauseOnLeave() { stopMixPreview(true); if (started && !inMenu && !paused && !awaitingReady && battle.phase !== 'over') setPause(true); else clearInput(); }
window.addEventListener('blur', pauseOnLeave);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnLeave(); });

function screenPoint(e: PointerEvent) { const box = stage.getBoundingClientRect(); return { x: e.clientX - box.left, y: e.clientY - box.top }; }
function worldPoint(e: PointerEvent) { const p = screenPoint(e); return renderer.camera.screenToWorld(p.x, p.y); }
function aimAtPointer(e: PointerEvent) {
    if (!humanCanPlay() || !battle.canAct || battle.charging || ![0, 1, 2, 3, 7, 8].includes(battle.weapon) || battle.rope) return;
    const p = worldPoint(e), u = battle.active;
    u.facing = p.x >= u.x ? 1 : -1;
    u.elevation = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, Math.atan2(u.y - 3 - p.y, Math.abs(p.x - u.x))));
}
const pointers = new Map<number, { x: number; y: number }>();
let gestureStart: { x: number; y: number } | null = null;
let gesturePan = false;
let pinchDistance = 0;
stage.addEventListener('pointerdown', e => {
    if (!started || inMenu || paused || awaitingReady || battle.phase === 'over' || e.button === 2) return;
    e.preventDefault();
    const p = screenPoint(e); pointers.set(e.pointerId, p); stage.setPointerCapture(e.pointerId);
    if (pointers.size === 1) { gestureStart = p; gesturePan = e.button === 1 || e.altKey; pointer = worldPoint(e); if (!gesturePan && e.pointerType !== 'touch') aimAtPointer(e); }
    else { gesturePan = true; const points = [...pointers.values()]; pinchDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); }
    stage.classList.toggle('panning', gesturePan);
});
stage.addEventListener('pointermove', e => {
    pointer = worldPoint(e);
    if (!pointers.has(e.pointerId)) return;
    const previous = pointers.get(e.pointerId), p = screenPoint(e); pointers.set(e.pointerId, p);
    if (pointers.size >= 2) {
        const points = [...pointers.values()], distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        const center = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
        if (pinchDistance > 0) renderer.camera.zoomAt(center.x, center.y, distance / pinchDistance, performance.now());
        pinchDistance = distance; gesturePan = true;
    } else {
        if (e.pointerType === 'touch' && gestureStart && Math.hypot(p.x - gestureStart.x, p.y - gestureStart.y) > 7) gesturePan = true;
        if (gesturePan) renderer.camera.pan(p.x - previous!.x, p.y - previous!.y, performance.now());
        else aimAtPointer(e);
    }
    stage.classList.toggle('panning', gesturePan);
});
stage.addEventListener('pointerup', e => {
    const wasPan = gesturePan; pointers.delete(e.pointerId);
    if (pointers.size === 0) {
        if (!wasPan && humanCanPlay() && battle.canAct) {
            pointer = worldPoint(e);
            if ([4, 6].includes(battle.weapon)) battle.fire(0, pointer);
            else if (e.pointerType === 'touch') aimAtPointer(e);
        }
        gestureStart = null; gesturePan = false; pinchDistance = 0; stage.classList.remove('panning');
    }
});
stage.addEventListener('pointercancel', () => { pointers.clear(); gestureStart = null; gesturePan = false; pinchDistance = 0; stage.classList.remove('panning'); });
stage.addEventListener('pointerleave', () => { if (!pointers.size) pointer = null; });
stage.addEventListener('wheel', e => { if (!e.ctrlKey && started && !inMenu && !paused && !awaitingReady) { e.preventDefault(); const box = stage.getBoundingClientRect(); renderer.camera.zoomAt(e.clientX - box.left, e.clientY - box.top, Math.exp(-e.deltaY * 0.0015), performance.now()); } }, { passive: false });
stage.addEventListener('contextmenu', e => e.preventDefault());
for (const control of document.querySelectorAll<HTMLButtonElement>('#touch-controls button')) {
    control.dataset.holdControl='';let previous=false;
    heldControls.push(holdControl(control,(held,cancelled)=>{
      if(held&&!humanCanPlay())return;
      if(control.dataset.hold){if(held)touchKeys.add(control.dataset.hold);else touchKeys.delete(control.dataset.hold);}
      if(held&&!previous){if(control.dataset.action==='jump')battle.jump();if(control.dataset.action==='fire')pressFire(true);}
      if(!held&&previous&&control.dataset.action==='fire'){
        if(cancelled){touchKeys.delete('Space');battle.charging=false;battle.power=0;AudioEngine.charge(0);}else releaseFire(true);
      }
      previous=held;
    }));
}

function processEvents() {
    const events = battle.events.splice(0);
    renderer.events(events, battle, preferences.reducedMotion);
    for (const event of events) {
        const point = renderer.camera.worldToScreen(event.x, event.y), pan = (point.x / renderer.camera.width - 0.5) * 1.4;
        if (event.type === 'blast') AudioEngine.explosion(event.value??0, pan);
        if (event.type === 'damage') AudioEngine.impact(pan);
        if (event.type === 'shot') AudioEngine.launch(event.value??0, pan);
        if (event.type === 'jump') AudioEngine.jump(pan);
        if (event.type === 'pickup') AudioEngine.pickup(pan);
        if (event.type === 'bounce') AudioEngine.bounce(pan);
        if (event.type === 'grapple') AudioEngine.grapple(pan);
        if (event.type === 'chute') AudioEngine.parachute(pan);
        if (event.type === 'splash') AudioEngine.splash(pan, event.value ?? 1);
        if (event.type === 'turn') {
            clearInput(); bannerTicks = 110;
            text('turn-banner-team', mode === 'practice' ? 'FIRING RANGE' : battle.teamName(battle.team));
            text('turn-banner-unit', battle.active.name);
            renderer.camera.focus(renderer.camera.targetZoom > 1.05 ? battle.active.x : WIDTH / 2, renderer.camera.targetZoom > 1.05 ? battle.active.y - 80 : HEIGHT / 2);
            if (mode === 'local') {
                awaitingReady = true; AudioEngine.pause();
                text('handoff-title', battle.teamName(battle.team)); text('handoff-mark', battle.team === 0 ? 'A' : 'B');
                text('ready-unit', `${battle.active.name} / ${battle.active.hp} HP`);
                syncModal(); button('ready-button').focus();
            } else AudioEngine.turn(battle.team);
        }
    }
}
function updateLog() {
    if (!logOpen) return;
    const snapshot = battle.log.join('\n');
    if (paintedLog === snapshot && el('log-entries').childElementCount > 0) return;
    paintedLog = snapshot;
    el('log-entries').replaceChildren();
    for (const line of battle.log.length ? battle.log : ['No impacts yet. Your move.']) { const entry = document.createElement('li'); entry.textContent = line; el('log-entries').append(entry); }
}
function showResults() {
    clearInput(); AudioEngine.victory(battle.winner === -1);
    el('game-over').style.setProperty('--team', battle.winner === -1 ? '#ffcc91' : COLORS[battle.winner ?? battle.team]);
    text('winner-text', battle.message); text('result-detail', `MAP ${battle.mapCode} / ${battle.round} ROUNDS / ${mode === 'solo' ? 'SKIRMISH' : mode === 'local' ? 'LOCAL VERSUS' : 'FIRING RANGE'}`);
    el('result-stats').replaceChildren();
    for (let team = 0; team < 2; team++) {
        const box = document.createElement('section'); box.className = 'result-team';
        const title = document.createElement('h3'); title.textContent = battle.teamName(team); box.append(title);
        const list = document.createElement('dl');
        const stats = battle.stats[team];
        for (const [label, value] of [['Enemy damage', stats.damage], ['Rovers eliminated', stats.kills], ['Attacks used', stats.shots], ['Friendly damage', stats.friendlyDamage], ['Supplies collected', stats.crates]]) {
            const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = String(label); dd.textContent = String(value); list.append(dt, dd);
        }
        box.append(list); el('result-stats').append(box);
    }
    const survivor = battle.units.filter(unit => !unit.dead).sort((a, b) => b.hp - a.hp)[0];
    text('result-highlight', survivor ? `${survivor.name} stays online with ${survivor.hp} HP.` : 'Nobody survived the transmission.');
    el('game-over').hidden = false; syncModal(); button('rematch-button').focus();
}
function step() {
    const controls = mode === 'solo' && battle.team === 1 ? cpu.update(battle, battle.options.difficulty) : {
        left: keyDown('ArrowLeft'), right: keyDown('ArrowRight'), up: keyDown('ArrowUp'), down: keyDown('ArrowDown'), jet: keyDown('ShiftLeft') || keyDown('ShiftRight') || (battle.weapon === 5 && keyDown('Space')),
    };
    battle.step(controls); jetting = !!controls.jet && battle.canAct && battle.weapon === 5 && battle.active.fuel > 0;
    processEvents(); renderer.tick(battle, preferences); bannerTicks = Math.max(0, bannerTicks - 1);
    if (battle.phase === 'over' && el('game-over').hidden) showResults();
}

function updateHUD() {
    const color = COLORS[battle.team]; document.documentElement.style.setProperty('--team', color);
    for (let team = 0; team < 2; team++) {
        text(`p${team + 1}-score`, battle.teamName(team));
        el(`p${team + 1}-score`).closest('section')!.setAttribute('aria-label', `${battle.teamName(team)} squad`);
        const alive = battle.units.filter(u => u.team === team && !u.dead).length;
        text(`p${team + 1}-units`, `${alive}/3 · ${battle.teamHealth(team)} HP${team === 1 && mode === 'solo' ? ' · CPU' : ''}`);
        el(`p${team + 1}-health`).style.width = `${battle.teamHealth(team) / 3}%`;
    }
    battle.units.forEach((u, id) => {
        const card = rosterButtons[id];
        if (card.firstElementChild!.textContent !== u.name) card.firstElementChild!.textContent = u.name;
        const hp = u.dead ? 'OFF' : String(u.hp); if (card.lastElementChild!.textContent !== hp) card.lastElementChild!.textContent = hp;
        card.classList.toggle('active', id === battle.activeId && !u.dead); card.classList.toggle('dead', u.dead);
        card.disabled = !humanCanPlay() || !battle.canAct || battle.committed || battle.charging || !!battle.rope || u.team !== battle.team || u.dead;
        card.setAttribute('aria-label', `${u.name}, ${u.hp} health${u.dead ? ', eliminated' : u.team === battle.team && !battle.committed ? ', select rover' : ''}`);
    });
    text('round-display', mode === 'practice' ? 'FIRING RANGE' : `${battle.round >= battle.options.suddenDeathRound ? 'SUDDEN DEATH / ' : 'ROUND '}${String(battle.round).padStart(2, '0')}`);
    const clock = battle.phase === 'aim' ? mode === 'practice' ? '∞' : String(Math.ceil(battle.time / 60)) : battle.phase === 'retreat' ? String(Math.ceil(battle.retreat / 60)) : '—';
    const suffix = battle.phase === 'retreat' ? 'RUN' : 'SEC';
    const clockHtml = `${clock}<span>${suffix}</span>`;
    if (el('turn-clock').innerHTML !== clockHtml) el('turn-clock').innerHTML = clockHtml;
    el('turn-clock').classList.toggle('urgent', battle.phase === 'retreat' || (mode !== 'practice' && battle.phase === 'aim' && battle.time <= 600));
    el('clock-fill').style.width = `${battle.phase === 'retreat' ? battle.retreat / 240 * 100 : mode === 'practice' ? 100 : battle.time / (battle.options.turnSeconds * 60) * 100}%`;
    const wind = Math.round(Math.abs(battle.wind) / 0.024 * 100);
    text('wind-display', wind < 4 ? 'WIND / CALM' : `WIND ${battle.wind > 0 ? '›››' : '‹‹‹'} ${wind}%`);
    if (started && !paused && !inMenu && !awaitingReady && mode !== 'practice' && battle.phase === 'aim') AudioEngine.warning(Math.ceil(battle.time / 60));
    const activeHTML = `${escapeHTML(battle.active.name)} <small>${battle.active.hp} HP</small>`;
    if (el('active-unit').innerHTML !== activeHTML) el('active-unit').innerHTML = activeHTML;
    const cpuTurn = mode === 'solo' && battle.team === 1;
    text('phase-label', battle.phase === 'retreat' ? cpuTurn ? 'CPU RETREAT' : 'RETREAT / MOVE TO SAFETY' : battle.phase === 'resolving' ? 'IMPACTS / SETTLING' : battle.phase === 'over' ? 'OPERATION COMPLETE' : cpuTurn ? battle.charging ? 'CPU TURN / CHARGING SHOT' : 'CPU TURN / PLANNING' : battle.shotgunShots > 0 ? 'SHOTGUN / ONE SHOT REMAINS' : battle.rope ? 'GRAPPLE / SWING & REEL' : battle.committed ? 'YOUR TURN / ONE ATTACK' : touchLayout() ? 'YOUR TURN / SELECT A ROVER' : 'YOUR TURN / TAB TO SWITCH');
    if (battle.message !== lastAnnounced) { text('message', battle.message); lastAnnounced = battle.message; }
    text('map-code-display', `MAP ${battle.mapCode}`); text('palette-label', renderer.paletteName);
    cards.forEach((card, id) => {
        card.classList.toggle('active', battle.weapon === id); card.setAttribute('aria-pressed', String(battle.weapon === id));
        card.disabled = !humanCanPlay() || !battle.canAct || battle.charging || !battle.hasAmmo(id) || (battle.shotgunShots > 0 && id !== 8);
        const ammo = mode === 'practice' || battle.inventories[battle.team][id] === -1 ? '∞' : id === 5 && battle.jetUsed ? 'ON' : id === 8 && battle.shotgunShots > 0 ? '1 LEFT' : `×${battle.inventories[battle.team][id]}`;
        if (card.querySelector('.weapon-ammo')!.textContent !== ammo) card.querySelector('.weapon-ammo')!.textContent = ammo;
        const option=weaponSelect.options[id];option.disabled=card.disabled;
        const label=`${WEAPONS[id].name} · ${ammo}`;if(option.text!==label)option.text=label;
    });
    weaponSelect.value=String(battle.weapon);weaponSelect.disabled=!humanCanPlay()||!battle.canAct||battle.charging;
    const touch = touchLayout(), fire = touch ? 'FIRE' : 'SPACE';
    const powerLabel = [3, 7, 8, 9].includes(battle.weapon) ? `TAP ${fire} TO USE` : [4, 6].includes(battle.weapon) ? `${touch ? 'TAP' : 'CLICK'} TO TARGET` : battle.weapon === 5 ? `HOLD ${touch ? 'JET' : 'SHIFT'} TO FLY` : battle.charging ? `POWER / ${Math.round(battle.power / MAX_POWER * 100)}%` : `HOLD ${fire} TO CHARGE`;
    text('power-label', powerLabel); el('power-fill').style.width = `${battle.power / MAX_POWER * 100}%`;
    text('angle-display', `${Math.round(battle.active.elevation * 180 / Math.PI)}°`);
    text('fuel-label', battle.rope ? `CABLE / ${Math.round(battle.rope.length)}m` : `JET / ${Math.max(0, Math.ceil(battle.active.fuel))}%`);
    el('fuel-fill').style.width = `${battle.rope ? battle.rope.length / 600 * 100 : Math.max(0, battle.active.fuel)}%`;
    const fuseHTML = `FUSE ${battle.fuse}s <kbd>F</kbd>`; if (el('fuse-button').innerHTML !== fuseHTML) el('fuse-button').innerHTML = fuseHTML;
    button('fuse-button').disabled = !humanCanPlay() || !battle.canAct || battle.charging || ![1, 2].includes(battle.weapon);
    button('skip-button').disabled = !humanCanPlay() || !battle.canAct;
    button('chute-button').disabled = !humanCanPlay() || (!battle.canAct && battle.phase !== 'retreat') || battle.active.dead || battle.active.grounded || battle.active.vy <= 0 || !!battle.rope || battle.active.chute;
    for (const control of document.querySelectorAll<HTMLButtonElement>('#touch-controls button')) {
        control.disabled = !humanCanPlay() || (!battle.canAct && battle.phase !== 'retreat') || (battle.phase === 'retreat' && (control.dataset.action === 'fire' || control.dataset.hold === 'ShiftLeft'));
    }
    const guidance = touch ? WEAPONS[battle.weapon].hint.replaceAll('Space', 'FIRE').replace('Hold Shift', 'Hold JET').replace(' F changes', ' Tap FUSE to change').replace('Enter releases.', 'JUMP releases.').replace('Left/right swing; up/down reel.', 'Move to swing; AIM to reel.').replace('Click ', 'Tap ') : WEAPONS[battle.weapon].hint;
    text('weapon-name', WEAPONS[battle.weapon].name); text('weapon-description', guidance);
    el('target-hint').hidden = !humanCanPlay() || !battle.canAct || ![4, 6].includes(battle.weapon);
    el('turn-indicator').style.opacity = bannerTicks > 0 && started && !inMenu && !paused && !awaitingReady ? '1' : '0';
    AudioEngine.charge(humanCanPlay() && battle.charging ? battle.power / MAX_POWER : 0);
    if (!paused && !inMenu && !awaitingReady) {
        const point = renderer.camera.worldToScreen(battle.active.x, battle.active.y);
        AudioEngine.environment(battle.wind, jetting, battle.active.grounded && Math.abs(battle.active.vx) > 0.2, point.x / renderer.camera.width - 0.5);
    }
    if (!paused && !inMenu && !awaitingReady) {
        const timed = battle.projectiles.find(projectile => ['grenade', 'cluster', 'dynamite'].includes(projectile.kind) && projectile.active);
        if (timed) AudioEngine.fuse(timed.fuse - timed.age);
    }
    updateLog();
}
function escapeHTML(value: string) { return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character); }
function frame(now: number) {
    if (!lastFrame) lastFrame = now;
    const elapsed = Math.min(100, now - lastFrame); lastFrame = now;
    if (started && !paused && !inMenu && !awaitingReady && battle.phase !== 'over') {
        accumulator += elapsed;
        while (accumulator >= 1000 / 60 && !awaitingReady && battle.winner === null) { step(); accumulator -= 1000 / 60; }
    }
    renderer.draw(battle, preferences, pointer, humanCanPlay(), now);
    if (now - hudAt >= 80) { updateHUD(); hudAt = now; }
    requestAnimationFrame(frame);
}

hydrateSetup(); applyPreferences(); showMap(initialCode); syncModal(); updateHUD(); requestAnimationFrame(frame);

// END GAME RUNTIME

return {pause:()=>pauseOnLeave(),running:()=>started&&!paused&&!inMenu&&!awaitingReady&&battle.phase!=='over',resize:()=>resize(),resetClock:()=>{lastFrame=0;accumulator=0;}};
}
