/** Full gameplay port from neon-horozon, hosted by Tiltu's Games. */
import type {PortScope,PortHooks} from '../scope.ts';
import {bindScope} from './environment.ts';
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import * as THREE from 'three';
import { AudioEngine } from './audio.ts';
import { MUSIC_TRACKS, isMusicTrack } from './soundtrack.ts';
import { FLIGHT, DIFFICULTIES, clamp, pilotAxis, flightVelocity, advanceSpeed, interceptTime, segmentBoxFraction } from './flight.ts';
import { rotateBody, readAttitude, autoBankAngle, recoverBody, liftAndGravity, chaseCounterBank } from './flight-body.ts';
import { SECTORS, ENEMIES, ENERGY, createRun, tickRun, damageRun, killReward, gateReward, nearMissReward, rankRun,
    tickEnergy, usePulse, crossesGate, randomSource, parseSettings, parseScores, sentinelCruise, dodgeReward, type Score } from './game.ts';
import { attackPlan, closestApproach, patrolPlan, cannonStep } from './combat.ts';
import { routeCode, parseRoute } from './routes.ts';
import { gateApproach, clearApproach } from './navigation.ts';
import { City } from './city.ts';
import { FlightRenderer } from './rendering.ts';
import { Input, type FlightInput } from './input.ts';
import { createCraft, createCockpit, animateCraft, disposeObject, Effects, Airflow } from './visuals.ts';
import { LESSONS, createLesson, tickLesson, lessonProgress } from './training.ts';
export function createGame(scope:PortScope):PortHooks {
bindScope(scope);
// BEGIN GAME RUNTIME
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const coarsePointer = matchMedia('(pointer:coarse)');
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let settings = parseSettings(null, prefersReducedMotion, coarsePointer.matches);
try { settings = parseSettings(localStorage.getItem('neon_horizon_settings_v3') || localStorage.getItem('neon_horizon_settings_v2'), prefersReducedMotion, coarsePointer.matches); } catch {}
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x252940); scene.fog = new THREE.FogExp2(0x252940, 0.00072);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 4500);
const player = new THREE.Group(); player.position.set(0, 115, 0); scene.add(player); player.add(camera);
scene.add(new THREE.HemisphereLight(0xa6d8ff, 0x38233f, 1.1));
const sunlight = new THREE.DirectionalLight(0xffcda1, .9); sunlight.position.set(-500, 700, -1500); scene.add(sunlight);
let cockpit = createCockpit(player, settings.visualStyle);
const effects = new Effects(scene);
let airframe = createCraft(1, false, settings.visualStyle); airframe.scale.multiplyScalar(.26); airframe.rotation.y = Math.PI; airframe.position.y = -1; player.add(airframe); airframe.visible = false;
const airflow = new Airflow(player);
let renderer: any, presentation: FlightRenderer, city: City, controls: Input;
let state: 'menu' | 'playing' | 'paused' | 'results' = 'menu';
let run = createRun(settings.mode, settings.difficulty, 1), rng = randomSource(1);
let enemies: any[] = [], lasers: any[] = [], projectiles: any[] = [];
let gate: any = null, gateTimer = 6, boss: any = null, nextEnemyId = 0;
let speed = 0, pitchRate = 0, yawRate = 0, rollRate = 0, shotCooldown = 0, spawnTimer = 0;
let driveSpeed = 0, throttleSetting = DIFFICULTIES[settings.difficulty].speed as number;
const velocity = new THREE.Vector3();
let hitTime = 0, killTime = 0, blockedTime = 0, flashTime = 0, pulseFlash = 0, messageTime = 0, messagePriority = 0, nearMissCooldown = 0;
let target: any = null, targetAim: any = null, canAssist = false, shotPathClear = false, boostActive = false;
let lastFrame = 0, hudTimer = 0, lastClockWarning = false, runId = '', storageAvailable = true;
let needsRender = true;
let musicPreview = false;
let flightDistance = 0, peakSpeed = 0;
let wheelTravel = 0;
const diagnostics = import.meta.env.DEV && new URLSearchParams(location.search).has('stats');
let measuredTime = 0, measuredFrames = 0, renderTime = 0;
let currentInput: FlightInput = { pitch: 0, yaw: 0, roll: 0, brake: false, boost: false, fire: false, pulse: false, level: false, mouseX: 0, mouseY: 0 };
let leveling = false, dodgeCooldown = 0, damageDirectionTime = 0, threatToneCooldown = 0;
let manualBanking = false, recoveryHeading = 0;
let flightAttitude = { pitch: 0, bank: 0, heading: 0 };
let selectedSeed = parseRoute(new URLSearchParams(location.search).get('route') || '') ?? crypto.getRandomValues(new Uint32Array(1))[0];
let pad: Gamepad | null = null;
let lesson = createLesson(), flightDelta = { yaw: 0, pitch: 0 };
const grazedBuildings = new Set<string>();
const forward = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const laserGeometry = new THREE.BoxGeometry(0.35, 0.35, 14), laserMaterial = new THREE.MeshBasicMaterial({ color: 0xc6fff0 });
const bulletGeometry = new THREE.BoxGeometry(1.1, 1.1, 12), bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffbdce });
const boltGlowGeometry = new THREE.BoxGeometry(1, 1, 1), boltGlowMaterial = new THREE.MeshBasicMaterial({ color: 0x45ffc2, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false });
const hostileGlowMaterial = new THREE.MeshBasicMaterial({ color: 0xff316d, transparent: true, opacity: .30, blending: THREE.AdditiveBlending, depthWrite: false });
const gateGeometry = new THREE.TorusGeometry(27, 0.9, 6, 48);
const bossShieldBounds = new THREE.Box3(new THREE.Vector3(-48, -20, -35), new THREE.Vector3(48, 20, 35));
const pooled = new Set([laserGeometry, laserMaterial, bulletGeometry, bulletMaterial, gateGeometry, boltGlowGeometry, boltGlowMaterial, hostileGlowMaterial]);

function init() {
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch {
        el('launch-note').textContent = 'WebGL could not start. Try enabling hardware acceleration or using another browser.';
        el<HTMLButtonElement>('start').disabled = true; return;
    }
    renderer.setSize(window.innerWidth, window.innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    presentation = new FlightRenderer(renderer); presentation.resize(window.innerWidth, window.innerHeight, settings.quality);
    renderer.domElement.setAttribute('aria-label', 'Neon Horizon flight view'); renderer.domElement.id = 'flight-view';
    renderer.domElement.tabIndex=0;
    document.body.appendChild(renderer.domElement);
    if (diagnostics) {
        const output = document.createElement('output'); output.id = 'render-stats'; output.style.cssText = 'position:fixed;bottom:0;left:0;z-index:200;background:#020a12dd;color:#b4f7db;padding:5px;font:11px monospace;pointer-events:none'; document.body.append(output);
    }
    city = new City(scene, 78231, settings.visualStyle); city.update(player.position);
    controls = new Input(renderer.domElement, settings, () => state === 'playing', togglePause);
    bindSettings(); updateLeaderboard();
    bindRoutes();
    el('start').addEventListener('click', () => startGame());
    el('cruise-button').addEventListener('click', () => {
        settings.mode = 'cruise'; el<HTMLSelectElement>('mode').value = 'cruise'; persistSettings(); updateSetup(); startGame();
    });
    el('retry').addEventListener('click', () => startGame(run.seed));
    el('resume').addEventListener('click', resumeGame);
    el('pause-button').addEventListener('click', pauseGame);
    el('level-button').addEventListener('click', () => { if (state === 'playing') controls.queueLevel(); });
    el('view-button').addEventListener('click', cycleView);
    el('throttle-down').addEventListener('click', () => setThrottle(throttleSetting - 5));
    el('throttle-up').addEventListener('click', () => setThrottle(throttleSetting + 5));
    renderer.domElement.addEventListener('wheel', (event:WheelEvent) => {
        if (state !== 'playing') return;
        event.preventDefault(); wheelTravel += event.deltaY;
        if (Math.abs(wheelTravel) >= 30) { setThrottle(throttleSetting - Math.sign(wheelTravel) * 5); wheelTravel = 0; }
    }, { passive: false });
    el('mute-button').addEventListener('click', () => { settings.sound = !settings.sound; applyAudio(); persistSettings(); });
    el('fullscreen-button').addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    el('finish-flight').addEventListener('click', () => { if (state === 'paused') { state = 'playing'; run.outcome = 'retired'; finishRun(); } });
    el('menu-button').addEventListener('click', returnToMenu);
    el('crash-menu').addEventListener('click', returnToMenu);
    el('save-score').addEventListener('click', saveCallsign);
    el('player-name').addEventListener('keydown', event => { if (event.key === 'Enter') saveCallsign(); });
    window.addEventListener('blur', () => { if (state === 'playing') pauseGame(); else { controls.clear(); if (musicPreview) { musicPreview = false; applyAudio(); } } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'playing') pauseGame(); if (musicPreview) { musicPreview = false; applyAudio(); } } });
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); presentation.resize(window.innerWidth, window.innerHeight, settings.quality);
        needsRender = true;
    });
    document.addEventListener('keydown', event => {
        if (event.code === 'KeyM' && !event.repeat && state === 'playing') { event.preventDefault(); settings.sound = !settings.sound; applyAudio(); persistSettings(); }
        if (event.code === 'KeyV' && !event.repeat && state === 'playing') { event.preventDefault(); cycleView(); }
        if (state === 'playing' && ['Minus', 'Equal', 'BracketLeft', 'BracketRight'].includes(event.code)) {
            event.preventDefault(); setThrottle(throttleSetting + (event.code === 'Minus' || event.code === 'BracketLeft' ? -5 : 5));
        }
    });
    applyView();
    applyVisualStyle();
    requestAnimationFrame(animate);
}
function bindSettings() {
    for (const key of ['difficulty', 'mode', 'controls'] as const) {
        el<HTMLSelectElement>(key).value = settings[key];
        el(key).addEventListener('change', () => {
            Object.assign(settings, { [key]: el<HTMLSelectElement>(key).value }); persistSettings(); updateSetup(); updateLeaderboard();
            if (key === 'controls') { controls.clear(); pitchRate = yawRate = rollRate = 0; el<HTMLSelectElement>('pause-controls').value = settings.controls; }
        });
    }
    el<HTMLInputElement>('sensitivity').value = String(settings.sensitivity);
    el('sensitivity-value').textContent = settings.sensitivity.toFixed(2) + '×';
    el('sensitivity').addEventListener('input', () => {
        settings.sensitivity = Number(el<HTMLInputElement>('sensitivity').value);
        el('sensitivity-value').textContent = settings.sensitivity.toFixed(2) + '×'; persistSettings();
    });
    for (const [id, key] of [['stabilized', 'stabilized'], ['aim-assist', 'aimAssist'], ['auto-fire', 'autoFire'], ['sound', 'sound'], ['music', 'music'], ['reduced-motion', 'reducedMotion'], ['invert-y', 'invertY']] as const) {
        el<HTMLInputElement>(id).checked = settings[key];
        el(id).addEventListener('change', () => {
            settings[key] = el<HTMLInputElement>(id).checked;
            if (key === 'stabilized' || key === 'invertY' || key === 'sound' || key === 'music') el<HTMLInputElement>('pause-' + id).checked = settings[key];
            persistSettings(); applyAudio(); updateSetup();
        });
    }
    for (const [id, key] of [['stabilized', 'stabilized'], ['invert-y', 'invertY'], ['sound', 'sound'], ['music', 'music']] as const) {
        el<HTMLInputElement>('pause-' + id).checked = settings[key];
        el('pause-' + id).addEventListener('change', () => {
            settings[key] = el<HTMLInputElement>('pause-' + id).checked; el<HTMLInputElement>(id).checked = settings[key];
            controls.clear(); pitchRate = yawRate = rollRate = 0; persistSettings(); applyAudio();
        });
    }
    el('pause-sensitivity').addEventListener('input', () => {
        settings.sensitivity = Number(el<HTMLInputElement>('pause-sensitivity').value);
        el<HTMLInputElement>('sensitivity').value = String(settings.sensitivity);
        el('sensitivity-value').textContent = el('pause-sensitivity-value').textContent = settings.sensitivity.toFixed(2) + '×'; persistSettings();
    });
    el('pause-assist').addEventListener('change', () => {
        settings.aimAssist = el<HTMLInputElement>('pause-assist').checked; el<HTMLInputElement>('aim-assist').checked = settings.aimAssist; persistSettings();
    });
    el('pause-auto-fire').addEventListener('change', () => {
        settings.autoFire = el<HTMLInputElement>('pause-auto-fire').checked; el<HTMLInputElement>('auto-fire').checked = settings.autoFire; persistSettings(); updateSetup();
    });
    for (const id of ['quality', 'pause-quality']) {
        el<HTMLSelectElement>(id).value = settings.quality;
        el(id).addEventListener('change', () => {
            settings.quality = el<HTMLSelectElement>(id).value as typeof settings.quality;
            for (const control of ['quality', 'pause-quality']) el<HTMLSelectElement>(control).value = settings.quality;
            presentation.resize(window.innerWidth, window.innerHeight, settings.quality); needsRender = true; persistSettings();
        });
    }
    for (const id of ['view', 'pause-view']) {
        el<HTMLSelectElement>(id).value = settings.view;
        el(id).addEventListener('change', () => { settings.view = el<HTMLSelectElement>(id).value as typeof settings.view; applyView(); persistSettings(); });
    }
    for (const id of ['visual-style', 'pause-visual-style']) {
        el<HTMLSelectElement>(id).value = settings.visualStyle;
        el(id).addEventListener('change', () => { settings.visualStyle = el<HTMLSelectElement>(id).value as typeof settings.visualStyle; applyVisualStyle(); persistSettings(); });
    }
    el<HTMLSelectElement>('pause-controls').value = settings.controls;
    el('pause-controls').addEventListener('change', () => {
        settings.controls = el<HTMLSelectElement>('pause-controls').value as typeof settings.controls; el<HTMLSelectElement>('controls').value = settings.controls;
        controls.clear(); pitchRate = yawRate = rollRate = 0; updateSetup(); persistSettings();
    });
    for (const key of ['musicVolume', 'effectsVolume'] as const) {
        const id = key === 'musicVolume' ? 'music-volume' : 'effects-volume';
        for (const control of [id, 'pause-' + id]) {
            el<HTMLInputElement>(control).value = String(settings[key] * 100);
            el(control).addEventListener('input', () => {
                settings[key] = Number(el<HTMLInputElement>(control).value) / 100;
                for (const sibling of [id, 'pause-' + id]) el<HTMLInputElement>(sibling).value = String(settings[key] * 100);
                applyAudio(); persistSettings();
            });
        }
    }
    for (const prefix of ['', 'pause-']) {
        const select = el<HTMLSelectElement>(prefix + 'music-track');
        for (const [id, track] of Object.entries(MUSIC_TRACKS)) { const option = document.createElement('option'); option.value = id; option.textContent = `${track.name} · ${track.bpm} BPM`; select.append(option); }
        select.addEventListener('change', () => {
            if (!isMusicTrack(select.value)) return; settings.musicTrack = select.value;
            updateMusicChoice(); AudioEngine.selectMusic(settings.musicTrack); applyAudio(); persistSettings();
        });
        el(prefix + 'preview-music').addEventListener('click', () => { musicPreview = !musicPreview; applyAudio(); });
    }
    updateMusicChoice();
    for (const id of ['cruise-speed', 'pause-cruise-speed']) el(id).addEventListener('input', () => setCruiseSpeed(Number(el<HTMLInputElement>(id).value)));
    setCruiseSpeed(settings.cruiseSpeed, false);
    updateSetup(); applyAudio();
}
function setCruiseSpeed(value: number, save = true) {
    settings.cruiseSpeed = clamp(value, 60, 150);
    for (const id of ['cruise-speed', 'pause-cruise-speed']) {
        el<HTMLInputElement>(id).value = String(settings.cruiseSpeed); el(id + '-value').textContent = `${Math.round(settings.cruiseSpeed * 3.6)}km/h`;
    }
    el('cruise-pace').textContent = `${Math.round(settings.cruiseSpeed * 3.6)}km/h`;
    if (run.mode === 'cruise' && state !== 'menu') setThrottle(settings.cruiseSpeed);
    if (save) persistSettings();
}
function setThrottle(value: number) { throttleSetting = clamp(value, 0, 180); }
function applyVisualStyle() {
    const retro = settings.visualStyle === 'retro'; presentation.retro = retro;
    scene.fog.color.setHex(retro ? 0x080d22 : 0x252940); scene.background.copy(scene.fog.color); city.setStyle(settings.visualStyle);
    for (const id of ['visual-style', 'pause-visual-style']) el<HTMLSelectElement>(id).value = settings.visualStyle;
    disposeObject(player, cockpit); cockpit = createCockpit(player, settings.visualStyle);
    disposeObject(player, airframe); airframe = createCraft(1, false, settings.visualStyle); airframe.scale.multiplyScalar(.26); airframe.rotation.y = Math.PI; airframe.position.y = -1; player.add(airframe);
    enemies = enemies.map(old => {
        const data = old.userData, ship = createCraft(data.type, data.boss, settings.visualStyle), visual = ship.userData;
        ship.position.copy(old.position); ship.quaternion.copy(old.quaternion);
        ship.userData = { ...data, ...visual }; if (data.boss) { boss = ship; ship.userData.shield.visible = !data.exposed; }
        if (target === old) target = ship; disposeObject(scene, old); scene.add(ship); updateEnemyBox(ship); return ship;
    });
    document.body.classList.toggle('retro-style', retro); applyView(); needsRender = true;
}
function applyView() {
    cockpit.visible = settings.view === 'cockpit'; airframe.visible = settings.view === 'chase';
    camera.position.set(0, settings.view === 'chase' ? 3.5 : 0, settings.view === 'chase' ? 16 : 0);
    camera.rotation.set(settings.view === 'chase' ? -.005 : 0, 0, 0);
    el('view-button').textContent = settings.view === 'cockpit' ? '◈' : settings.view === 'chase' ? '✈' : '◇';
    el('view-button').setAttribute('aria-label', `Change camera (V). Current view: ${settings.view}`);
    el('camera-name').textContent = `${settings.view.toUpperCase()} / V`;
    for (const id of ['view', 'pause-view']) el<HTMLSelectElement>(id).value = settings.view;
    needsRender = true;
}
function cycleView() {
    settings.view = settings.view === 'cockpit' ? 'clear' : settings.view === 'clear' ? 'chase' : 'cockpit';
    applyView(); persistSettings();
}
function updateSetup() {
    const descriptions = {
        mission: 'Clear Neon Mile, survive Crossfire, then defeat the Sentinel. Fly recharge gates to recover and extend your contract.',
        endless: 'An open-ended city hunt. Build your score against increasingly dangerous patrols. How long can you hold the skyline?',
        practice: 'Eight short flying lessons, then free practice. No clock, hostile fire, or shield loss. Learn the controls at your pace. Scores are not recorded.',
        cruise: 'The city is yours. No hostiles, deadline or damage. Follow the recharge gates, skim the avenues or climb into the sunset. Switch views with V.',
    };
    el('mode-description').textContent = descriptions[settings.mode];
    el('briefing-title').textContent = settings.mode === 'cruise' ? 'Lose yourself in the skyline.' : settings.mode === 'practice' ? 'Learn the controls. Find your line.' : settings.mode === 'endless' ? 'Keep the city clear. Hold the skyline.' : 'Clear the patrol. Break the Sentinel.';
    el('mission-route').hidden = settings.mode !== 'mission';
    el('cruise-setup').hidden = settings.mode !== 'cruise';
    el<HTMLSelectElement>('difficulty').disabled = settings.mode === 'cruise';
    const controlNotes = {
        flightstick: 'Centre the cursor to engage. Move it gently to pitch/yaw; return to centre to stop turning. W/S changes throttle, A/D strafes, Q/E rolls. Shift ignites the afterburner; Ctrl brakes.',
        keyboard: 'W/S pitches, A/D turns, Q/E rolls. Tap for fine corrections; release to stop turning. −/+ or wheel changes throttle. Shift ignites the afterburner; Ctrl brakes. Z/C strafes.',
        mouse: 'Move or drag the mouse to aim; click fires, right-click releases EMP. WASD also steers. −/+ or wheel changes throttle. Shift ignites the afterburner; Ctrl brakes.',
        gamepad: 'Connect a standard controller and press a button. Left stick pitches/turns; right stick rolls/changes throttle. RT fires, LT brakes, RB boosts, LB drifts, B releases EMP. X levels, Y changes view. Keyboard remains available.',
        touch: 'Drag the left stick to steer. Hold FIRE, BRAKE or BOOST with your other thumb. EMP clears nearby shots; LEVEL recovers your attitude. The −/+ buttons adjust throttle. Enable Automatic cannons to free your right thumb.',
    };
    const controlNote = `${controlNotes[settings.controls]} Steering follows the craft’s axes. Manual bank holds; R / LEVEL / gamepad X recovers level flight.`;
    el('control-description').textContent = controlNote; el('control-summary').textContent = controlNote;
    el('pause-control-summary').textContent = controlNote;
    document.body.classList.toggle('using-flightstick', settings.controls === 'flightstick');
    document.body.classList.toggle('using-touch', settings.controls === 'touch');
    if (settings.autoFire) el('control-description').textContent += ' Automatic cannons are armed: line up a clear target to fire. Space, RT, or FIRE also gives manual control.';
    el('start').textContent = settings.mode === 'cruise' ? 'FLY THE SUNSET →' : settings.mode === 'practice' ? 'TAKE A PRACTICE FLIGHT →' : settings.mode === 'mission' ? 'LAUNCH INTERCEPT →' : 'ENTER THE HUNT →';
}
function bindRoutes() {
    const field = el<HTMLInputElement>('route-code');
    field.value = routeCode(selectedSeed);
    field.addEventListener('input', () => {
        const parsed = parseRoute(field.value);
        field.setAttribute('aria-invalid', String(parsed === null));
        el<HTMLButtonElement>('start').disabled = parsed === null;
        el<HTMLButtonElement>('cruise-button').disabled = parsed === null;
        el<HTMLButtonElement>('copy-route').disabled = parsed === null; el('copy-route').textContent = 'COPY';
        el('route-hint').textContent = parsed === null ? 'Use NH- followed by seven letters or numbers, or choose NEW.' : 'Same route, same city. Match the challenge setting to compare scores.';
        if (parsed !== null) selectedSeed = parsed;
    });
    field.addEventListener('blur', () => { if (parseRoute(field.value) !== null) field.value = routeCode(selectedSeed); });
    el('new-route').addEventListener('click', () => {
        selectedSeed = crypto.getRandomValues(new Uint32Array(1))[0]; field.value = routeCode(selectedSeed);
        field.setAttribute('aria-invalid', 'false'); el<HTMLButtonElement>('start').disabled = false;
        el<HTMLButtonElement>('cruise-button').disabled = false;
        el<HTMLButtonElement>('copy-route').disabled = false; el('copy-route').textContent = 'COPY';
        el('route-hint').textContent = 'New route ready. The same code always generates the same city.';
    });
    el('copy-route').addEventListener('click', () => copyRoute(selectedSeed, 'copy-route'));
    el('copy-result-route').addEventListener('click', () => copyRoute(run.seed, 'copy-result-route'));
}
async function copyRoute(seed: number, button: string) {
    try {
        await navigator.clipboard.writeText(routeCode(seed)); el(button).textContent = 'COPIED';
    } catch {
        el('route-hint').textContent = `Select and copy ${routeCode(seed)} to share this flight route.`;
        if (state === 'menu') { el<HTMLInputElement>('route-code').focus(); el<HTMLInputElement>('route-code').select(); }
        else el(button).textContent = routeCode(seed);
    }
}
function persistSettings() { try { localStorage.setItem('neon_horizon_settings_v3', JSON.stringify(settings)); } catch { storageAvailable = false; } }
function updateMusicChoice() {
    const track = MUSIC_TRACKS[settings.musicTrack];
    for (const prefix of ['', 'pause-']) {
        el<HTMLSelectElement>(prefix + 'music-track').value = settings.musicTrack;
        el(prefix + 'track-detail').textContent = `${track.style} · ${track.key}. ${track.detail}`;
    }
}
function applyAudio() {
    el<HTMLInputElement>('sound').checked = settings.sound;
    el('mute-button').textContent = settings.sound ? '♪' : '♪̸';
    el('mute-button').setAttribute('aria-label', settings.sound ? 'Mute audio' : 'Unmute audio');
    if (!settings.sound || !settings.music) musicPreview = false;
    AudioEngine.selectMusic(settings.musicTrack);
    AudioEngine.configure(settings.sound, settings.musicVolume, settings.effectsVolume, state === 'playing', musicPreview);
    if (settings.sound && settings.music && (state === 'playing' || musicPreview)) AudioEngine.startMusic(musicPreview); else AudioEngine.stopMusic();
    for (const prefix of ['', 'pause-']) {
        const button = el<HTMLButtonElement>(prefix + 'preview-music'); button.disabled = !settings.sound || !settings.music;
        button.title = button.disabled ? 'Enable Game audio and Music to preview' : 'Listen to the main groove before flying';
        button.textContent = musicPreview ? '■ STOP PREVIEW' : '▶ PREVIEW'; button.setAttribute('aria-pressed', String(musicPreview));
    }
}
function soundPan(position?: any) {
    if (!position) return 0;
    const local = player.worldToLocal(position.clone()); return clamp(local.x / Math.max(80, Math.hypot(local.x, local.z)), -.85, .85);
}
function sfx(kind: 'sfxLaser' | 'sfxExplosion' | 'sfxCrash', position?: any, large = false) {
    if (!settings.sound) return;
    if (kind === 'sfxExplosion') AudioEngine.sfxExplosion(soundPan(position), position?.distanceTo(player.position) ?? 0, large);
    else AudioEngine[kind]();
}
function tone(kind: 'hit' | 'gate' | 'pulse' | 'warning' | 'victory' | 'threat' | 'evade', position?: any) { if (settings.sound) AudioEngine.cue(kind, soundPan(position)); }

function clearFlight() {
    for (const object of [...enemies, ...lasers, ...projectiles]) disposeObject(scene, object, pooled);
    enemies = []; lasers = []; projectiles = []; effects.clear();
    if (gate) disposeObject(scene, gate, pooled); gate = boss = null;
    target = targetAim = null; canAssist = false;
}
function startGame(seed?: number) {
    musicPreview = false; AudioEngine.stopMusic(); AudioEngine.resetMusic();
    const newSeed = seed ?? selectedSeed;
    controls.release(); clearFlight(); city.dispose(); city = new City(scene, newSeed, settings.visualStyle);
    run = createRun(settings.mode, settings.difficulty, newSeed); rng = randomSource(newSeed);
    lesson = createLesson(); flightDelta = { yaw: 0, pitch: 0 };
    flightDistance = peakSpeed = 0;
    runId = `${newSeed.toString(36)}-${Date.now().toString(36)}`; nextEnemyId = 0;
    player.position.set(0, 115, 0); player.quaternion.identity(); cockpit.rotation.set(0, 0, 0);
    manualBanking = false; flightAttitude = { pitch: 0, bank: 0, heading: 0 };
    speed = pitchRate = yawRate = rollRate = shotCooldown = hitTime = killTime = blockedTime = flashTime = pulseFlash = nearMissCooldown = 0;
    driveSpeed = 0; velocity.set(0, 0, 0); throttleSetting = run.mode === 'cruise' ? settings.cruiseSpeed : DIFFICULTIES[run.difficulty].speed;
    leveling = false; dodgeCooldown = damageDirectionTime = threatToneCooldown = 0; el('damage-direction').hidden = true;
    gateTimer = 3; spawnTimer = 2; hudTimer = 0; lastClockWarning = false; grazedBuildings.clear();
    camera.fov = 74; camera.updateProjectionMatrix(); city.update(player.position); player.updateMatrixWorld(true);
    state = 'playing'; el('load-screen').hidden = el('pause-screen').hidden = el('crash-screen').hidden = true; el('ui-layer').hidden = false;
    needsRender = true;
    document.body.classList.remove('damaged', 'boosting', 'emp-active');
    document.body.classList.toggle('training', run.mode === 'practice');
    document.body.classList.toggle('cruising', run.mode === 'cruise');
    el('start').blur(); el('retry').blur();renderer.domElement.focus({preventScroll:true});
    el('save-score').textContent = 'SAVE CALLSIGN';
    if (run.mode !== 'cruise') { spawnEnemy(0, 420, 0, true); spawnEnemy(0, 650, 28, true); spawnEnemy(0, 850, -35, true); }
    const intro = settings.autoFire ? 'Auto cannons armed · line up the diamond · brake for precision'
        : settings.controls === 'touch' || coarsePointer.matches || window.innerWidth <= 700 ? 'Drag to steer · hold FIRE · tap LEVEL to recover'
        : settings.controls === 'flightstick' ? 'Centre cursor to engage · move gently to turn · W/S throttle · Shift afterburner'
        : settings.controls === 'mouse' ? 'Move or drag to aim · Shift afterburner · R level' : controls.controller ? 'Left stick steers · RT fires · LT brakes · RB afterburner'
        : 'Tap to steer · Space fire · Ctrl precision · R level';
    showMessage(run.mode === 'cruise' ? 'SUNSET CRUISE' : run.mode === 'practice' ? 'FLIGHT SCHOOL' : run.mode === 'endless' ? 'ENDLESS HUNT' : 'NEON MILE', run.mode === 'cruise' ? 'Follow your own line · V changes view · R levels your wings' : intro, 4.5, 2);
    updateHud(); applyAudio(); controls.capture(true); lastFrame = performance.now();
}
function togglePause() { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); }
function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused'; controls.release(); applyAudio(); el('pause-screen').hidden = false;
    el('pause-summary').textContent = `${run.mode === 'mission' ? SECTORS[run.sector].name : run.mode === 'cruise' ? 'SUNSET CRUISE' : run.mode === 'practice' ? 'FLIGHT SCHOOL' : 'CITY HUNT'} · ${(flightDistance / 1000).toFixed(1)}km · ${formatTime(run.elapsed)} airborne`;
    el<HTMLInputElement>('pause-sensitivity').value = String(settings.sensitivity);
    el('pause-sensitivity-value').textContent = settings.sensitivity.toFixed(2) + '×'; el<HTMLInputElement>('pause-assist').checked = settings.aimAssist;
    el<HTMLInputElement>('pause-auto-fire').checked = settings.autoFire;
    el('finish-flight').hidden = run.mode === 'mission'; el('finish-flight').textContent = run.mode === 'cruise' ? 'FINISH CRUISE' : run.mode === 'practice' ? 'FINISH PRACTICE' : 'END AND LOG FLIGHT';
    el('pause-cruise-setup').hidden = run.mode !== 'cruise';
    el('pause-title').focus({ preventScroll: true });
}
function resumeGame() {
    if (state !== 'paused') return;
    musicPreview = false; state = 'playing'; controls.clear(); el('pause-screen').hidden = true; el('resume').blur();
    lastFrame = performance.now(); applyAudio(); controls.capture();
}
function returnToMenu() {
    state = 'menu'; controls.release(); applyAudio();
    el('pause-screen').hidden = el('crash-screen').hidden = el('ui-layer').hidden = true; el('load-screen').hidden = false;
    document.body.classList.remove('damaged', 'boosting', 'emp-active');
    selectedSeed = run.seed; el<HTMLInputElement>('route-code').value = routeCode(selectedSeed);
    el('route-code').setAttribute('aria-invalid', 'false'); el<HTMLButtonElement>('start').disabled = false;
    el<HTMLButtonElement>('cruise-button').disabled = false;
    el('copy-route').textContent = 'COPY';
    updateSetup(); updateLeaderboard();
}
function finishRun() {
    if (state !== 'playing') return;
    state = 'results'; controls.release(); applyAudio(); el('pause-screen').hidden = true; el('load-screen').hidden = true;
    el('crash-screen').hidden = false; el('ui-layer').hidden = true;
    const won = run.outcome === 'victory';
    if (won) { tone('victory'); effects.ring(player.position.clone().add(new THREE.Vector3(0, 0, -100).applyQuaternion(player.quaternion)), 0x69ffb5, 180, 1.8, player.quaternion); }
    else if (run.outcome === 'crashed') { sfx('sfxCrash'); effects.burst(player.position, 0xff628a, 65, true); }
    else if (run.mode === 'cruise') tone('gate');
    el('result-eyebrow').textContent = run.mode === 'cruise' ? 'FLIGHT COMPLETE // UNTIL THE NEXT SUNSET' : won ? 'CONTRACT FULFILLED // SKYLINE SECURED' : run.outcome === 'timeout' ? 'CONTRACT WINDOW CLOSED' : 'FLIGHT RECORDER RECOVERED';
    el('result-title').textContent = run.mode === 'cruise' ? 'A SKYLINE WELL FLOWN' : run.mode === 'practice' ? 'FLIGHT COMPLETE' : run.outcome === 'retired' ? 'PATROL LOGGED' : won ? 'MISSION COMPLETE' : run.outcome === 'timeout' ? 'TIME EXPIRED' : 'SIGNAL LOST';
    el('result-title').classList.toggle('victory', won || run.mode === 'practice' || run.mode === 'cruise');
    el('result-rank').textContent = run.mode === 'practice' ? lesson.step === LESSONS.length ? '✓' : '↗' : run.mode === 'mission' && !won ? '—' : rankRun(run);
    el('final-score').textContent = String(run.score).padStart(6, '0');
    el('result-score-label').textContent = run.mode === 'cruise' ? 'DISTANCE FLOWN' : 'FLIGHT SCORE';
    if (run.mode === 'cruise') { el('final-score').textContent = `${(flightDistance / 1000).toFixed(1)}km`; el('result-rank').textContent = '↗'; }
    el('final-stats').textContent = run.mode === 'practice' ? `${lesson.step} / ${LESSONS.length} skills practised · ${run.kills} targets · ${formatTime(run.elapsed)}`
        : `${run.kills} targets · ${formatTime(run.elapsed)} · ${run.shots ? Math.round(run.hits / run.shots * 100) : 0}% accuracy`;
    el('result-gates').textContent = String(run.gates); el('result-streak').textContent = String(run.bestStreak); el('result-near').textContent = String(run.nearMisses);
    el('result-dodges').textContent = String(run.dodges);
    el('result-route-code').textContent = `${routeCode(run.seed)} / ${run.mode === 'cruise' ? 'SUNSET CRUISE' : DIFFICULTIES[run.difficulty].label}`;
    el('copy-result-route').textContent = 'COPY ROUTE';
    el('result-bonus').textContent = run.mode === 'practice' ? lesson.step === LESSONS.length ? 'Wings earned. Your first intercept contract is waiting on the flight deck.' : 'Keep practising the remaining skills whenever you like.'
        : won ? `Completion bonus +${run.bonus} · time remaining + shields preserved` : 'Recharge gates restore shields and energy. Use F to clear incoming fire.';
    if (run.mode === 'cruise') { el('final-stats').textContent = `${formatTime(run.elapsed)} airborne · ${Math.round(peakSpeed * 3.6)}km/h peak · ${run.gates} gates`; el('result-bonus').textContent = 'Another avenue. Another sunset. Your city is waiting.'; }
    el('leaderboard').hidden = run.mode === 'practice' || run.mode === 'cruise';
    el<HTMLInputElement>('player-name').value = settings.pilot;
    el('name-input-section').hidden = run.mode === 'practice' || run.mode === 'cruise' || run.score <= 0;
    saveRecord(); updateLeaderboard();
    el('record-status').textContent = run.mode === 'practice' || run.mode === 'cruise' ? 'Fly freely. These flights are not scored.' : storageAvailable ? 'Best five flights saved on this device. Retry flies this route again.' : 'Storage unavailable. This flight could not be saved.';
    // A held fire key must not activate Retry when Space is released on the results screen.
    el('result-title').focus({ preventScroll: true });
}
function scoreKey() { return `neon_horizon_scores_v4_${settings.mode}_${settings.difficulty}`; }
function getScores(): Score[] { try { return parseScores(localStorage.getItem(scoreKey())); } catch { storageAvailable = false; return []; } }
function saveRecord() {
    if (run.mode === 'practice' || run.mode === 'cruise' || run.score <= 0) return;
    const scores = getScores().filter(entry => entry.id !== runId);
    scores.push({ name: settings.pilot, score: run.score, rank: rankRun(run), seed: run.seed, won: run.mode !== 'mission' || run.outcome === 'victory', id: runId });
    try { localStorage.setItem(scoreKey(), JSON.stringify(scores.sort((a, b) => b.score - a.score).slice(0, 5))); }
    catch { storageAvailable = false; }
}
function saveCallsign() {
    settings.pilot = el<HTMLInputElement>('player-name').value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 3) || 'ACE';
    el<HTMLInputElement>('player-name').value = settings.pilot; persistSettings(); saveRecord(); updateLeaderboard();
    el('save-score').textContent = storageAvailable ? 'SAVED' : 'NOT SAVED';
}
function updateLeaderboard() {
    const scores = getScores(), label = `${DIFFICULTIES[settings.difficulty].label} / ${settings.mode === 'mission' ? 'INTERCEPT' : settings.mode === 'practice' ? 'PRACTICE' : 'ENDLESS'}`;
    el('lb-title').textContent = `${label} FLIGHT RECORDER`;
    el('personal-best').textContent = settings.mode === 'practice' || settings.mode === 'cruise' ? 'THE SKYLINE IS YOURS' : scores.length ? `PERSONAL BEST ${String(scores[0].score).padStart(6, '0')}` : 'YOUR FIRST RECORD AWAITS';
    const list = el('lb-list'); list.replaceChildren();
    if (!scores.length) { list.textContent = 'NO FLIGHTS LOGGED YET'; return; }
    scores.forEach((entry, i) => {
        const row = document.createElement('div'); row.className = 'lb-row';
        for (const text of [`0${i + 1}`, entry.name, entry.won ? entry.rank : '—', String(entry.score).padStart(6, '0')]) {
            const span = document.createElement('span'); span.textContent = text; row.append(span);
        }
        const replay = document.createElement('button'); replay.className = 'record-route'; replay.textContent = 'FLY';
        replay.setAttribute('aria-label', `Fly ${entry.name}'s route ${routeCode(entry.seed)}`); replay.title = routeCode(entry.seed);
        replay.addEventListener('click', () => {
            returnToMenu(); selectedSeed = entry.seed; el<HTMLInputElement>('route-code').value = routeCode(selectedSeed);
            el('route-hint').textContent = `Loaded ${entry.name}'s route. Fly it again and chase ${entry.score.toLocaleString()} points.`;
        });
        row.append(replay);
        list.append(row);
    });
}
function formatTime(value: number) { const seconds = Math.max(0, Math.ceil(value)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function showMessage(title: string, detail: string, seconds = 2, priority = 0) {
    if (messageTime > 0 && priority < messagePriority) return;
    el('event-title').textContent = title; el('event-detail').textContent = detail; el('event-message').hidden = false;
    messageTime = seconds; messagePriority = priority;
}

function spawnEnemy(type = 0, range = 520 + rng() * 240, lateral = (rng() - 0.5) * 230, opening = false, sentinel = false) {
    const heading = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion); heading.y = 0;
    if (heading.lengthSq() < 0.01) heading.set(0, 0, -1); heading.normalize();
    const side = new THREE.Vector3().crossVectors(heading, up).normalize();
    const position = player.position.clone().addScaledVector(heading, range).addScaledVector(side, lateral);
    position.y = opening ? 115 : clamp(player.position.y + (rng() - 0.5) * 65 + (sentinel ? 30 : 0), 65, 290);
    for (const building of city.query(position, position, sentinel ? 50 : 20)) {
        if (building.box.clone().expandByScalar(sentinel ? 50 : 20).containsPoint(position)) position.y = Math.max(position.y, building.height + (sentinel ? 35 : 20));
    }
    if (sentinel) {
        // The showdown must begin with a clear approach, not a command ship hidden behind a tower.
        let found = false;
        for (const altitude of [Math.max(260, player.position.y + 35), 305, 335]) {
            for (const angle of [0, -0.16, 0.16, -0.32, 0.32, -0.55, 0.55]) {
                const direction = heading.clone().applyAxisAngle(up, angle);
                const candidate = player.position.clone().addScaledVector(direction, 480); candidate.y = clamp(altitude, 130, 335);
                const occupied = city.query(candidate, candidate, 45).some(building => building.box.clone().expandByScalar(45).containsPoint(candidate));
                if (!occupied && !city.segmentHit(player.position, candidate, 4)) { position.copy(candidate); found = true; break; }
            }
            if (found) break;
        }
        if (!found) position.y = Math.max(305, position.y);
    }
    const ship = createCraft(type, sentinel, settings.visualStyle), tier = ENEMIES[type]; ship.position.copy(position);
    const { core, shield, glow, solidBox, exhausts } = ship.userData;
    ship.userData = { id: nextEnemyId++, type, tier, boss: sentinel, health: sentinel ? DIFFICULTIES[run.difficulty].bossHealth : tier.health,
        maxHealth: sentinel ? DIFFICULTIES[run.difficulty].bossHealth : tier.health, heading, side, altitude: position.y,
        velocity: heading.clone().multiplyScalar(tier.speed), previous: position.clone(), age: 0, phase: rng() * Math.PI * 2,
        amplitude: opening || type === 0 ? 0 : type === 1 ? 14 : 7, avoidAltitude: position.y, fireTimer: sentinel ? 0.8 : 2 + rng() * 2.5,
        charge: 0, stunned: 0, flash: 0, box: new THREE.Box3(), shieldBox: sentinel ? new THREE.Box3() : null, core, shield, glow, exposed: !sentinel,
        attack: null, attackCycle: 0, phaseTwo: false, shotDirection: new THREE.Vector3(), pendingShots: [], solidBox, exhausts };
    ship.lookAt(position.clone().add(heading)); scene.add(ship); enemies.push(ship); updateEnemyBox(ship);
    if (sentinel) {
        boss = ship; effects.ring(position, 0xff526b, 80, 1.4, ship.quaternion);
        showMessage('SENTINEL INBOUND', 'Climb above the roofs · fire between its shielded volleys', 5, 3); tone('warning');
    }
    return ship;
}
function updateEnemyBox(ship: any) {
    ship.updateMatrixWorld(true); ship.userData.box.copy(ship.userData.solidBox).applyMatrix4(ship.matrixWorld).expandByScalar(ship.userData.boss ? 0 : 1.5);
    if (ship.userData.boss) {
        ship.userData.shieldBox.copy(bossShieldBounds).applyMatrix4(ship.matrixWorld);
    }
}
function manageEnemies(dt: number) {
    let charging = enemies.filter(ship => ship.userData.charge > 0).length;
    for (let i = enemies.length - 1; i >= 0; i--) {
        const ship = enemies[i], data = ship.userData; data.age += dt; data.previous.copy(ship.position);
        animateCraft(ship, data.age);
        data.stunned = Math.max(0, data.stunned - dt); data.flash = Math.max(0, data.flash - dt);
        if (data.stunned > 0) data.pendingShots.length = 0;
        for (let shot = data.pendingShots.length - 1; shot >= 0; shot--) {
            data.pendingShots[shot].delay -= dt;
            if (data.pendingShots[shot].delay <= 0) { fireHostileBolt(ship, data.pendingShots[shot]); data.pendingShots.splice(shot, 1); }
        }
        const behind = ship.position.clone().sub(player.position).dot(new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion)) < -240;
        if (!data.boss && (ship.position.distanceToSquared(player.position) > 1600 ** 2 || data.age > 26 || data.age > 6 && behind)) {
            disposeObject(scene, ship); enemies.splice(i, 1); continue;
        }
        if (data.boss) {
            // Fly an independent course. Coupling this to the pilot's look direction makes aiming chase itself.
            const relative = ship.position.clone().sub(player.position), along = relative.dot(data.heading);
            if (relative.length() > 1050) {
                const returnHeading = player.position.clone().sub(ship.position); returnHeading.y = 0; returnHeading.normalize();
                data.heading.lerp(returnHeading, 1 - Math.exp(-0.35 * dt)).normalize();
                data.side.crossVectors(data.heading, up).normalize();
            }
            // Do not match afterburner speed: a pilot spending boost energy must be able to close for EMP.
            const cruise = sentinelCruise(run.difficulty, along);
            data.velocity.copy(data.heading).multiplyScalar(cruise * (data.stunned > 0 ? 0.6 : 1));
            data.velocity.addScaledVector(data.side, Math.cos(data.age * 0.48) * 17);
            const required = terrainClearance(ship.position, data.velocity, 3, 43, 29);
            data.avoidAltitude = Math.max(required, data.avoidAltitude - dt * 9);
            const altitude = Math.max(clamp(player.position.y + 30, 260, 305), data.avoidAltitude);
            data.velocity.y = clamp((altitude - ship.position.y) * 0.8, -25, 60);
            ship.position.addScaledVector(data.velocity, dt); ship.lookAt(ship.position.clone().add(data.heading));
            data.exposed = data.stunned > 0 || data.age % 8 >= 2 && data.age % 8 < 6;
            data.shield.visible = !data.exposed; data.core.rotation.z += dt * 0.8;
            data.core.material.color.setHex(data.exposed ? data.phaseTwo ? 0xfff0af : 0xffd984 : 0x749eff);
            data.shield.material.color.setHex(data.phaseTwo ? 0xff8967 : 0x7fa9ff);
        } else {
            const movement = data.tier.speed * DIFFICULTIES[run.difficulty].trafficSpeed * (1 + Math.min(run.sector, 5) * 0.04) * (data.stunned > 0 ? 0.35 : 1);
            data.velocity.copy(data.heading).multiplyScalar(movement);
            data.velocity.addScaledVector(data.side, Math.cos(data.age * 1.1 + data.phase) * data.amplitude * 1.1);
            const required = terrainClearance(ship.position, data.velocity, 3, 14, 17);
            data.avoidAltitude = Math.max(required, data.avoidAltitude - dt * 9);
            data.velocity.y = clamp((Math.max(data.altitude, data.avoidAltitude) - ship.position.y) * 0.9, -28, 65);
            ship.position.addScaledVector(data.velocity, dt); ship.lookAt(ship.position.clone().add(data.velocity));
        }
        updateEnemyBox(ship);
        const toward = ship.position.clone().sub(player.position), distance = toward.length();
        const inView = toward.normalize().dot(new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion)) > 0.67;
        const eligible = run.mode !== 'practice' && data.stunned === 0 && data.age > 2 && distance > 110 && distance < 850 && inView && city.clear(ship.position, player.position);
        if (data.charge > 0) {
            data.charge -= dt;
            if (data.stunned > 0) data.charge = 0;
            else if (data.charge <= 0) {
                if (eligible) fireHostile(ship);
                data.fireTimer = data.attack.cooldown;
            }
        } else if (data.boss || data.tier.fireInterval > 0) {
            data.fireTimer -= dt;
            if (eligible && data.fireTimer <= 0 && charging < (data.boss ? 3 : 2)) {
                data.attack = attackPlan(data.type, data.boss, data.health / data.maxHealth, data.attackCycle++, run.difficulty);
                data.charge = data.attack.charge;
                data.shotDirection.copy(player.position).addScaledVector(velocity, .5).sub(ship.position).normalize();
                if (threatToneCooldown === 0) { tone('threat', ship.position); threatToneCooldown = 0.6; }
                charging++;
            }
        }
        data.glow.color.setHex(data.flash > 0 ? 0xffffff : data.charge > 0 ? 0xffe4b0 : data.boss ? 0xff526b : data.tier.color);
    }
}
function terrainClearance(position: any, velocity: any, horizon: number, padding: number, clearance: number) {
    return city.clearance(position, position.clone().addScaledVector(velocity, horizon), padding, clearance);
}
function updateDirector(dt: number) {
    if (run.mode === 'cruise') { gateTimer -= dt; if (!gate && gateTimer <= 0) spawnGate(); return; }
    spawnTimer -= dt;
    if (run.mode === 'mission' && run.sector === 2 && !boss) spawnEnemy(2, 620, 0, false, true);
    const limit = boss ? 3 : run.mode === 'practice' ? 4 : 5;
    if (spawnTimer <= 0 && enemies.length < limit) {
        const patrol = patrolPlan({ mode: run.mode, sector: run.sector, difficulty: run.difficulty, slots: limit - enemies.length, boss: Boolean(boss) }, rng);
        for (const ship of patrol) spawnEnemy(ship.type, ship.range, ship.lateral);
        spawnTimer = boss ? 5.5 : Math.max(1.4, DIFFICULTIES[run.difficulty].spawnInterval - run.sector * 0.15) * patrol.length;
    }
    if (spawnTimer <= 0) spawnTimer = 0.4;
    gateTimer -= dt;
    if (!gate && gateTimer <= 0) spawnGate();
}
function spawnGate() {
    const normal = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion); normal.y = 0; normal.normalize();
    const practice = run.mode === 'practice' || run.mode === 'cruise';
    const altitude = practice ? player.position.y : clamp(player.position.y + (rng() - 0.5) * 42, 65, 210);
    const approach = gateApproach(player.position, normal, altitude, practice, point => {
        const candidate = new THREE.Vector3(point.x, point.y, point.z);
        return clearApproach(player.position, candidate, (start, end, padding) => !city.segmentHit(start, end, padding))
            && city.query(candidate, candidate, 31).every(building => building.box.distanceToPoint(candidate) >= 31);
    });
    if (!approach) { gateTimer = 1; return; }
    const center = new THREE.Vector3(approach.x, approach.y, approach.z);
    normal.copy(center).sub(player.position); normal.y = 0; normal.normalize();
    gate = new THREE.Group(); gate.position.copy(center); gate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    if (run.mode === 'practice') gate.scale.setScalar(1.2);
    const ring = new THREE.Mesh(gateGeometry, new THREE.MeshBasicMaterial({ color: 0x57ffdb, transparent: true, opacity: 0.9 })); gate.add(ring);
    const inner = new THREE.Mesh(gateGeometry, new THREE.MeshBasicMaterial({ color: 0x57ffdb, transparent: true, opacity: 0.25 })); inner.scale.setScalar(0.86); gate.add(inner);
    const shell = new THREE.Mesh(new THREE.TorusGeometry(28.2, 1.6, 6, 64), new THREE.MeshPhongMaterial({ color: 0x25364b, shininess: 65 })); gate.add(shell);
    for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2, tab = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 3), new THREE.MeshBasicMaterial({ color: 0xacffe6 }));
        tab.position.set(Math.sin(angle) * 26, Math.cos(angle) * 26, 0); tab.rotation.z = -angle; gate.add(tab);
    }
    gate.userData = { normal, age: 0 }; scene.add(gate);
    if (run.gates === 0) showMessage('RECHARGE GATE AHEAD', 'Fly through the cyan ring · shields +18 · energy +55', 4, 1);
}
function updateGate(dt: number, previous: any) {
    if (!gate) return;
    gate.userData.age += dt; gate.children[1].rotation.z += dt;
    if (crossesGate(previous, player.position, gate.position, gate.userData.normal, run.mode === 'practice' ? 30 : 25)) {
        const position = gate.position.clone(), rotation = gate.quaternion.clone(), previousExtraTime = run.extraTime, points = gateReward(run);
        const extraTime = run.extraTime - previousExtraTime;
        effects.ring(position, 0x57ffdb, 70, 0.7, rotation); effects.burst(position, 0x57ffdb, 12); tone('gate');
        showMessage(run.mode === 'cruise' ? 'PERFECT LINE' : `GATE +${points}`, run.mode === 'cruise' ? 'Energy restored · another gate ahead' : `Shields +18 · energy +55${extraTime > 0 ? ` · +${extraTime}s` : ''}`, 2.5, 1);
        disposeObject(scene, gate, pooled); gate = null; gateTimer = 4.5;
    } else if (gate.userData.age > 23 || player.position.clone().sub(gate.position).dot(gate.userData.normal) > 150 || gate.position.distanceToSquared(player.position) > 1300 ** 2) {
        disposeObject(scene, gate, pooled); gate = null; gateTimer = 2;
    }
}
function updateFlight(dt: number, input: FlightInput) {
    const wasBoosting = boostActive;
    boostActive = tickEnergy(run.energy, dt, input.boost && !input.brake);
    if (boostActive && !wasBoosting) { if (settings.sound) AudioEngine.ignite(); showMessage('AFTERBURNER IGNITED', 'Forward thrust engaged · release SHIFT / BOOST to recharge', 1.3); }
    if (input.pulse) activatePulse();
    if (input.level) {
        leveling = true; recoveryHeading = readAttitude(player.quaternion, flightAttitude).heading;
        if (Math.abs(input.pitch) <= 0.02 && Math.abs(input.roll) <= 0.02 && Math.abs(input.mouseY) <= 0.02) {
            pitchRate = rollRate = 0;
            if (Math.abs(input.yaw) <= 0.02 && Math.abs(input.mouseX) <= 0.02) yawRate = 0;
        }
    }
    if (Math.abs(input.pitch) > 0.02 || Math.abs(input.roll) > 0.02 || Math.abs(input.mouseY) > 0.02) leveling = false;
    if (Math.abs(input.roll) > .02) manualBanking = true;
    const turnScale = settings.sensitivity * (input.brake ? .72 : 1);
    const pitch = pilotAxis(pitchRate, input.pitch * (settings.invertY ? -1 : 1), .95 * turnScale, dt);
    const yaw = pilotAxis(yawRate, input.yaw, .90 * turnScale, dt);
    const roll = pilotAxis(rollRate, input.roll, 1.65 * settings.sensitivity, dt);
    pitchRate = pitch.rate; yawRate = yaw.rate; rollRate = roll.rate;
    const pitchAngle = pitch.angle - input.mouseY * 0.0021 * settings.sensitivity * (settings.invertY ? -1 : 1);
    const yawAngle = yaw.angle - input.mouseX * 0.0021 * settings.sensitivity;
    flightDelta.yaw = yawAngle; flightDelta.pitch = pitchAngle;
    const assistedRoll = settings.stabilized && !manualBanking && !leveling ? autoBankAngle(readAttitude(player.quaternion, flightAttitude), yawAngle / dt, dt) : 0;
    player.quaternion.copy(rotateBody(player.quaternion, pitchAngle, yawAngle, roll.angle + assistedRoll));
    if (leveling) {
        if (Math.abs(yawAngle) > 1e-8) recoveryHeading = readAttitude(player.quaternion, flightAttitude).heading;
        const recovery = recoverBody(player.quaternion, recoveryHeading, dt);
        pitchRate = rollRate = 0; player.quaternion.copy(recovery.orientation);
        if (recovery.complete) { leveling = false; manualBanking = false; }
    }
    const targetSpeed = input.brake ? 0 : boostActive ? 225 : throttleSetting;
    driveSpeed = advanceSpeed(driveSpeed, targetSpeed, dt).speed;
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    const desired = direction.clone().multiplyScalar(driveSpeed);
    desired.add(new THREE.Vector3((input.strafeX || 0) * 48, (input.strafeY || 0) * 40, 0).applyQuaternion(player.quaternion));
    if (desired.length() > 225) desired.setLength(225);
    if (input.drift && boostActive) { velocity.addScaledVector(direction, 90 * dt); if (velocity.length() > 225) velocity.setLength(225); }
    const forces = liftAndGravity(player.quaternion, velocity.dot(direction), settings.stabilized, Boolean(input.drift));
    const movement = flightVelocity(velocity, desired, dt, input.brake, Boolean(input.drift), forces);
    const previous = player.position.clone(); velocity.set(movement.velocity.x, movement.velocity.y, movement.velocity.z);
    player.position.add(new THREE.Vector3(movement.displacement.x, movement.displacement.y, movement.displacement.z)); speed = velocity.length();
    cockpit.rotation.z += (-yawRate * 0.014 - cockpit.rotation.z) * (1 - Math.exp(-10 * dt));
    cockpit.rotation.x += (pitchRate * 0.01 - cockpit.rotation.x) * (1 - Math.exp(-10 * dt));
    animateCraft(airframe, run.elapsed, boostActive);
    if (settings.view === 'chase') {
        flightAttitude = readAttitude(player.quaternion, flightAttitude);
        camera.rotation.z = chaseCounterBank(flightAttitude.bank, settings.reducedMotion);
        camera.rotation.y = 0;
        camera.position.x += ((settings.reducedMotion ? 0 : yawRate * -.6) - camera.position.x) * (1 - Math.exp(-5 * dt));
    }
    const fov = camera.fov + ((boostActive && !settings.reducedMotion ? 82 : 74) - camera.fov) * (1 - Math.exp(-4 * dt));
    if (Math.abs(fov - camera.fov) > 0.001) { camera.fov = fov; camera.updateProjectionMatrix(); }
    city.update(player.position, run.elapsed); checkCollision(previous);
    flightAttitude = readAttitude(player.quaternion, flightAttitude);
    flightDistance += player.position.distanceTo(previous); peakSpeed = Math.max(peakSpeed, speed);
    if (state !== 'playing') return previous;
    updateGate(dt, previous); checkNearMiss(dt);
    player.updateMatrixWorld(true);
    return previous;
}
function checkCollision(previous: any) {
    const contact = city.segmentHit(previous, player.position, 2.3);
    if (contact) {
        player.position.copy(previous.clone().lerp(player.position, Math.max(0, contact.fraction - 0.015)));
        const box = contact.building.box.clone().expandByScalar(3.6), p = player.position;
        const faces = [
            { axis: 'x', value: box.min.x, normal: new THREE.Vector3(-1, 0, 0) }, { axis: 'x', value: box.max.x, normal: new THREE.Vector3(1, 0, 0) },
            { axis: 'y', value: box.max.y, normal: new THREE.Vector3(0, 1, 0) }, { axis: 'z', value: box.min.z, normal: new THREE.Vector3(0, 0, -1) }, { axis: 'z', value: box.max.z, normal: new THREE.Vector3(0, 0, 1) },
        ].sort((a, b) => Math.abs(p[a.axis] - a.value) - Math.abs(p[b.axis] - b.value));
        p[faces[0].axis] = faces[0].value;
        const escape = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion).reflect(faces[0].normal).addScaledVector(faces[0].normal, 0.6).normalize();
        if (Math.abs(escape.y) > 0.9) escape.set(0, 0.7, -0.7).normalize();
        player.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(p, p.clone().add(escape), up));
        manualBanking = false;
        pitchRate = yawRate = rollRate = 0; speed *= .55; driveSpeed = speed; velocity.copy(escape).multiplyScalar(speed); damage('BUILDING IMPACT', true);
    }
    if (player.position.y < 9 || player.position.y > 390) {
        const ground = player.position.y < 9; player.position.y = clamp(player.position.y, 9, 390);
        const level = recoverBody(player.quaternion, readAttitude(player.quaternion, flightAttitude).heading, 10).orientation;
        player.quaternion.copy(rotateBody(level, ground ? .22 : -.22, 0, 0)); pitchRate = 0; manualBanking = false;
        velocity.y = (ground ? 1 : -1) * Math.abs(velocity.y) * .35;
        damage(ground ? 'GROUND IMPACT' : 'FLIGHT CEILING', true);
    }
    if (run.invulnerable <= 0) for (const ship of enemies) {
        const start = previous.clone().add(ship.position).sub(ship.userData.previous);
        if (segmentBoxFraction(start, player.position, ship.userData.box, 2.2) !== null) {
            damage('HOSTILE IMPACT', true);
            if (!ship.userData.boss) { effects.burst(ship.position, ship.userData.tier.color, 15); disposeObject(scene, ship); enemies.splice(enemies.indexOf(ship), 1); }
            break;
        }
    }
}
function checkNearMiss(dt: number) {
    nearMissCooldown = Math.max(0, nearMissCooldown - dt);
    if (nearMissCooldown > 0 || run.invulnerable > 0 || speed < DIFFICULTIES[run.difficulty].speed * 0.95) return;
    for (const building of city.query(player.position, player.position, 10)) {
        if (grazedBuildings.has(building.id)) continue;
        const closest = building.box.clampPoint(player.position, new THREE.Vector3()), gap = closest.distanceTo(player.position);
        if (gap > 3.7 && gap < 10) {
            grazedBuildings.add(building.id); nearMissCooldown = 1.5;
            const points = nearMissReward(run, boostActive); tone('hit'); showMessage(run.mode === 'cruise' ? 'CLEAN PASS' : `NEAR MISS +${points}`, 'Thread the skyline · energy +6', 1.25); break;
        }
    }
}
function damage(reason: string, collision = false, amount: number = DIFFICULTIES[run.difficulty].damage, incoming?: any) {
    if (!damageRun(run, amount, collision)) {
        if (collision && (run.mode === 'cruise' || run.mode === 'practice') && flashTime === 0) {
            if (settings.sound) AudioEngine.impact(true, .3);
            flashTime = .25; showMessage('WINGS RECOVERED', reason === 'FLIGHT CEILING' ? 'Top of the flight envelope · ease the nose down' : 'Your safety systems deflected the impact · R levels the wings', 2, 1);
        }
        return;
    }
    if (incoming) {
        const direction = incoming.clone().negate().applyQuaternion(player.quaternion.clone().invert());
        const angle = Math.hypot(direction.x, direction.y) < 0.1 ? direction.z > 0 ? Math.PI : 0 : Math.atan2(direction.x, direction.y);
        el('damage-direction').style.transform = `translate(-50%,-50%) rotate(${angle}rad)`;
        damageDirectionTime = 0.8; el('damage-direction').hidden = false;
    }
    flashTime = 0.25; document.body.classList.add('damaged');
    if (settings.sound) AudioEngine.impact(collision);
    showMessage(reason, collision ? 'Brake and turn · recharge through cyan gates' : 'Incoming fire · change course or press F for EMP', 2.4, 2);
    tone('warning');
    if (run.outcome !== 'flying') finishRun();
}

function updateTarget(draw = false) {
    const previous = target; target = targetAim = null; canAssist = shotPathClear = false;
    forward.set(0, 0, -1).applyQuaternion(player.quaternion);
    let best = 0.935;
    for (const ship of enemies) {
        const relative = ship.position.clone().sub(player.position), range = relative.length();
        if (range > FLIGHT.laserRange || range < 20) continue;
        const alignment = relative.normalize().dot(forward);
        const priority = alignment + (ship === previous ? 0.006 : 0) + (ship.userData.boss ? 0.003 : 0);
        if (priority < best || !city.clear(player.position, ship.position)) continue;
        best = priority; target = ship;
    }
    if (target) {
        const t = interceptTime(target.position.clone().sub(player.position), target.userData.velocity, FLIGHT.laserSpeed);
        targetAim = target.position.clone().addScaledVector(target.userData.velocity, t);
        shotPathClear = city.clear(player.position, targetAim);
        canAssist = settings.aimAssist && targetAim.clone().sub(player.position).normalize().dot(forward) >= Math.cos(FLIGHT.assistAngle) && shotPathClear;
    }
    if (!draw) return;
    const bore = player.position.clone().addScaledVector(forward, 700).project(camera);
    el('crosshair').style.left = `${(bore.x * .5 + .5) * 100}%`; el('crosshair').style.top = `${(-bore.y * .5 + .5) * 100}%`;
    const cue = el('mouse-flight-cue'), stick = controls.mouseStick;
    cue.hidden = settings.controls !== 'flightstick' || controls.controller || coarsePointer.matches;
    const length = Math.hypot(stick.x, stick.y);
    el('mouse-flight-dot').style.transform = `translate(${stick.x}px,${stick.y}px)`;
    el('mouse-flight-tether').style.width = `${length}px`; el('mouse-flight-tether').style.transform = `rotate(${Math.atan2(stick.y, stick.x)}rad)`;
    cue.classList.toggle('armed', stick.active); (cue.lastElementChild as HTMLElement).textContent = stick.active ? '' : 'CENTRE CURSOR TO ENGAGE';
    let travel: any = null;
    if (speed > 10 && (currentInput.drift || currentInput.strafeX || currentInput.strafeY || velocity.clone().normalize().dot(forward) < .995)) travel = player.position.clone().addScaledVector(velocity.clone().normalize(), 650);
    positionMarker('velocity-marker', travel);
    el('crosshair').classList.toggle('tracking', canAssist); el('crosshair').classList.toggle('hit', hitTime > 0); el('crosshair').classList.toggle('kill', killTime > 0);
    el('crosshair').classList.toggle('blocked', blockedTime > 0);
    positionMarker('target-marker', target?.position); positionMarker('lead-marker', targetAim); positionMarker('gate-marker', gate?.position);
    positionMarker('boss-marker', boss && target !== boss ? boss.position : null);
    if (target) {
        const data = target.userData;
        el('target-label').textContent = `${data.boss ? 'SENTINEL' : data.tier.name} · ${Math.round(target.position.distanceTo(player.position))}m`;
        el('target-marker').style.setProperty('--target-color', data.charge > 0 ? '#ff567e' : data.boss ? '#ffb276' : '#' + data.tier.color.toString(16).padStart(6, '0'));
        el('target-health').style.width = `${data.health / data.maxHealth * 100}%`;
    }
    el('target-status').textContent = target?.userData.boss && !target.userData.exposed ? 'SHIELDED · WAIT FOR THE CORE'
        : target && !shotPathClear ? 'SHOT PATH BLOCKED · CHANGE ANGLE'
        : target?.userData.stunned > 0 ? 'EMP DISRUPTED · OPEN FIRE' : canAssist ? settings.autoFire ? 'AUTO CANNONS · ALIGNED' : 'CANNONS ALIGNED' : target ? 'AIM AT THE LEAD DIAMOND' : run.mode === 'cruise' ? 'YOUR CITY. YOUR LINE.' : 'SCAN THE SKYLINE';
    drawThreatMarkers(); drawGuide(); drawAttitude();
}
function positionMarker(id: string, position: any) {
    const marker = el(id); if (!position) { marker.hidden = true; return; }
    const p = position.clone().project(camera);
    marker.hidden = p.z > 1 || p.z < -1 || Math.abs(p.x) > 0.94 || Math.abs(p.y) > 0.82;
    marker.style.left = `${(p.x * 0.5 + 0.5) * 100}%`; marker.style.top = `${(-p.y * 0.5 + 0.5) * 100}%`;
    if (id === 'gate-marker') el('gate-distance').textContent = `${Math.round(position.distanceTo(player.position))}m`;
}
function drawThreatMarkers() {
    const markers = el('threat-markers').children;
    const charging = enemies.filter(ship => ship.userData.charge > 0 && ship.userData.stunned === 0);
    for (let i = 0; i < markers.length; i++) {
        const marker = markers[i] as HTMLElement, ship = charging[i];
        if (!ship) { marker.hidden = true; continue; }
        const p = ship.position.clone().project(camera);
        marker.hidden = p.z > 1 || Math.abs(p.x) > 0.95 || Math.abs(p.y) > 0.82;
        marker.style.left = `${(p.x * 0.5 + 0.5) * 100}%`; marker.style.top = `${(-p.y * 0.5 + 0.5) * 100}%`;
        marker.style.setProperty('--charge', String(Math.max(0, ship.userData.charge)));
        (marker.firstElementChild as HTMLElement).textContent = ship.userData.attack?.name || 'FIRING';
    }
    const imminent = charging.reduce((best, ship) => !best || ship.userData.charge < best.userData.charge ? ship : best, null);
    el('attack-warning').hidden = !imminent;
    if (imminent) {
        el('attack-name').textContent = `${imminent.userData.boss ? 'SENTINEL' : imminent.userData.tier.name} / ${imminent.userData.attack.name}`;
        el('attack-fill').style.width = `${(1 - imminent.userData.charge / imminent.userData.attack.charge) * 100}%`;
    }
}
function drawAttitude() {
    const ctx = el<HTMLCanvasElement>('attitude').getContext('2d')!;
    flightAttitude = readAttitude(player.quaternion, flightAttitude);
    ctx.clearRect(0, 0, 168, 88); ctx.save(); ctx.beginPath(); ctx.rect(12, 9, 144, 64); ctx.clip();
    ctx.translate(84, 41); ctx.rotate(flightAttitude.bank); ctx.translate(0, clamp(flightAttitude.pitch * 75, -76, 76));
    ctx.fillStyle = '#0a283878'; ctx.fillRect(-200, -260, 400, 260);
    ctx.fillStyle = '#151c3080'; ctx.fillRect(-200, 0, 400, 260);
    ctx.strokeStyle = '#7dc8d9aa'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-130, 0); ctx.lineTo(130, 0); ctx.stroke();
    ctx.strokeStyle = '#77afc155';
    for (const y of [-52, -26, 26, 52]) { ctx.beginPath(); ctx.moveTo(-19, y); ctx.lineTo(19, y); ctx.stroke(); }
    ctx.restore(); ctx.strokeStyle = '#ffc37c'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(51, 41); ctx.lineTo(72, 41); ctx.lineTo(77, 45); ctx.moveTo(91, 45); ctx.lineTo(96, 41); ctx.lineTo(117, 41); ctx.stroke();
    ctx.fillStyle = '#8ac4d2'; ctx.beginPath(); ctx.moveTo(84, 7); ctx.lineTo(80, 2); ctx.lineTo(88, 2); ctx.fill();
    const degrees = Math.round(flightAttitude.pitch * 180 / Math.PI);
    const heading = Math.round((-flightAttitude.heading * 180 / Math.PI + 360) % 360) % 360;
    const compass = el<HTMLCanvasElement>('compass').getContext('2d')!;
    compass.clearRect(0, 0, 216, 30); compass.strokeStyle = '#88cad477'; compass.fillStyle = '#a4ced9'; compass.font = '10px Rajdhani'; compass.textAlign = 'center';
    const cardinal = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (let offset = -45; offset <= 45; offset++) {
        const value = (heading + offset + 360) % 360; if (value % 5) continue;
        const x = 108 + offset * 2.6; compass.beginPath(); compass.moveTo(x, value % 15 ? 20 : 16); compass.lineTo(x, 26); compass.stroke();
        if (value % 15 === 0) compass.fillText(value % 45 === 0 ? cardinal[value / 45] : String(value).padStart(3, '0'), x, 11);
    }
    compass.fillStyle = '#ffc37c'; compass.beginPath(); compass.moveTo(108, 28); compass.lineTo(104, 23); compass.lineTo(112, 23); compass.fill();
    el('compass-heading').textContent = `${String(heading).padStart(3, '0')}° ${cardinal[Math.round(heading / 45) % 8]}`;
    el('pitch-readout').textContent = leveling ? `LEVELING · HDG ${String(heading).padStart(3, '0')}°` : `PITCH ${degrees > 0 ? '+' : ''}${degrees}° · HDG ${String(heading).padStart(3, '0')}°`;
    const bank = Math.round(flightAttitude.bank * 180 / Math.PI);
    el('bank-readout').textContent = `BANK ${Math.abs(bank)}° ${Math.abs(bank) < 1 ? 'LEVEL' : bank > 0 ? 'LEFT' : 'RIGHT'}`;
    el('level-button').classList.toggle('leveling', leveling);
}
function drawGuide() {
    let point: any = null, label = '', color = '#ffb65c';
    if (gate && run.mode === 'practice' && lesson.step === 6) { point = gate.position; label = 'TRAINING GATE'; color = '#57ffdb'; }
    else if (gate && (run.shields < 60 || run.energy.amount < 30)) { point = gate.position; label = 'RECHARGE'; color = '#57ffdb'; }
    else if (boss && target !== boss) { point = boss.position; label = 'SENTINEL'; color = '#ff638f'; }
    else if (!target) {
        const nearest = enemies.reduce((best, ship) => !best || ship.position.distanceToSquared(player.position) < best.position.distanceToSquared(player.position) ? ship : best, null);
        if (nearest) { point = nearest.position; label = nearest.userData.boss ? 'SENTINEL' : nearest.userData.tier.name; }
        else if (gate) { point = gate.position; label = 'RECHARGE'; color = '#57ffdb'; }
    }
    const marker = el('nav-pointer'); marker.hidden = !point;
    if (!point) return;
    const local = player.worldToLocal(point.clone()), p = point.clone().project(camera);
    if (local.z < 0 && Math.abs(p.x) < 0.85 && Math.abs(p.y) < 0.73) { marker.hidden = true; return; }
    let dx = local.x, dy = -local.y;
    if (local.z > 0) dy += Math.max(60, local.z * 0.3);
    if (Math.abs(dx) + Math.abs(dy) < 1) dy = 1;
    const angle = Math.atan2(dy, dx), rx = window.innerWidth / 2 - 70, ry = Math.max(80, window.innerHeight / 2 - 130);
    const scale = 1 / Math.max(Math.abs(Math.cos(angle)) / rx, Math.abs(Math.sin(angle)) / ry);
    marker.style.left = `${window.innerWidth / 2 + Math.cos(angle) * scale}px`; marker.style.top = `${window.innerHeight / 2 + Math.sin(angle) * scale}px`;
    marker.style.color = color; el('nav-arrow').style.transform = `rotate(${angle}rad)`;
    el('nav-label').textContent = `${label} ${Math.round(point.distanceTo(player.position))}m`;
}
function fireLaser() {
    run.shots++; sfx('sfxLaser');
    const aim = canAssist ? targetAim.clone() : player.position.clone().addScaledVector(forward, 700);
    const volley = { hit: false, damaged: new Set<number>() };
    for (const offset of [-2.1, 2.1]) {
        const laser = new THREE.Mesh(laserGeometry, laserMaterial);
        const glow = new THREE.Mesh(boltGlowGeometry, boltGlowMaterial); glow.scale.set(1.4, 1.4, 17); laser.add(glow);
        const spawn = new THREE.Vector3(offset, -0.85, -3).applyMatrix4(player.matrixWorld);
        laser.position.copy(spawn); laser.lookAt(aim);
        laser.userData = { velocity: aim.clone().sub(spawn).normalize().multiplyScalar(FLIGHT.laserSpeed), distance: 0, volley };
        scene.add(laser); lasers.push(laser);
    }
}
function updateLasers(dt: number) {
    for (let i = lasers.length - 1; i >= 0; i--) {
        const laser = lasers[i], data = laser.userData, start = laser.position.clone();
        const travel = Math.min(FLIGHT.laserSpeed * dt, FLIGHT.laserRange - data.distance), end = start.clone().addScaledVector(data.velocity, travel / FLIGHT.laserSpeed);
        const wall = city.segmentHit(start, end, 0.2);
        let fraction = wall?.fraction ?? Infinity, victim: any = null;
        for (const ship of enemies) {
            const relativeStart = start.clone().add(ship.position).sub(ship.userData.previous);
            const hit = segmentBoxFraction(relativeStart, end, ship.userData.boss && !ship.userData.exposed ? ship.userData.shieldBox : ship.userData.box, 0.5);
            if (hit !== null && hit < fraction) { fraction = hit; victim = ship; }
        }
        laser.position.copy(end); data.distance += travel;
        if (fraction !== Infinity || data.distance >= FLIGHT.laserRange) {
            if (victim) {
                if (!data.volley.hit && (!victim.userData.boss || victim.userData.exposed)) { run.hits++; data.volley.hit = true; }
                if (!data.volley.damaged.has(victim.userData.id)) { data.volley.damaged.add(victim.userData.id); hurtEnemy(victim, 1); }
            }
            scene.remove(laser); lasers.splice(i, 1);
        }
    }
}
function hurtEnemy(ship: any, amount: number, emp = false) {
    const data = ship.userData;
    if (data.boss && !data.exposed && !emp) {
        effects.burst(ship.position, 0x88aaff, 2); blockedTime = 0.16; return;
    }
    data.health -= amount; data.flash = 0.15; blockedTime = 0; hitTime = 0.12;
    if (data.boss && !data.phaseTwo && data.health > 0 && data.health <= data.maxHealth / 2) {
        data.phaseTwo = true; showMessage('SENTINEL OVERLOAD', 'Wider fans · faster bursts · change course at the warning', 3.4, 3); tone('warning');
    }
    if (data.health > 0) { effects.burst(ship.position, data.tier.color, 3); tone('hit'); return; }
    const reward = killReward(run, data.boss ? 2000 : data.tier.score, data.boss);
    killTime = 0.2; sfx('sfxExplosion', ship.position, data.boss); effects.burst(ship.position, data.boss ? 0xffb65c : data.tier.color, data.boss ? 100 : 26, data.boss);
    effects.ring(ship.position, data.tier.color, data.boss ? 110 : 32, data.boss ? 1.2 : .55, player.quaternion);
    if (data.boss) { effects.ring(ship.position, 0xff526b, 160, 1.6, ship.quaternion); boss = null; }
    disposeObject(scene, ship); enemies.splice(enemies.indexOf(ship), 1);
    showMessage(`+${reward.points} · ${data.boss ? 'SENTINEL DOWN' : data.tier.name}`, `STREAK ${run.streak} · ×${run.multiplier} · shields +${data.boss ? 15 : 3}`, 1.5);
    if (reward.advanced) {
        run.shields = Math.min(100, run.shields + 12); run.energy.amount = Math.min(100, run.energy.amount + 25);
        showMessage(run.mode === 'mission' ? SECTORS[run.sector].name : `PATROL ${run.sector + 1}`, 'Sector clear · shields +12 · energy +25', 4, 3); tone('gate');
        spawnTimer = 0.5;
    }
    if (run.outcome !== 'flying') finishRun();
}
function fireHostile(ship: any) {
    const data = ship.userData;
    if (settings.sound) AudioEngine.hostile(soundPan(ship.position), ship.position.distanceTo(player.position), data.boss);
    for (const shot of data.attack.shots) {
        const pending = { delay: shot.delay, velocity: data.shotDirection.clone().applyAxisAngle(up, shot.yaw).multiplyScalar(data.attack.speed) };
        if (shot.delay === 0) fireHostileBolt(ship, pending); else data.pendingShots.push(pending);
    }
}
function fireHostileBolt(ship: any, shot: any) {
    if (projectiles.length >= 36) return;
    const projectile = new THREE.Mesh(bulletGeometry, bulletMaterial);
    const glow = new THREE.Mesh(boltGlowGeometry, hostileGlowMaterial); glow.scale.set(3.4, 3.4, 16); projectile.add(glow);
    projectile.position.copy(ship.position); projectile.lookAt(projectile.position.clone().add(shot.velocity));
    projectile.userData = { velocity: shot.velocity, age: 0, grazed: false }; scene.add(projectile); projectiles.push(projectile);
}
function updateProjectiles(dt: number, previousPlayer: any) {
    const box = new THREE.Box3().setFromCenterAndSize(player.position, new THREE.Vector3(6, 5, 7));
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i], start = projectile.position.clone(), end = start.clone().addScaledVector(projectile.userData.velocity, dt);
        const wall = city.segmentHit(start, end, 0.6);
        const relativeStart = start.clone().add(player.position).sub(previousPlayer);
        const hit = segmentBoxFraction(relativeStart, end, box);
        const hitPlayer = hit !== null && (!wall || hit < wall.fraction);
        if (!hitPlayer && !wall && !projectile.userData.grazed && dodgeCooldown === 0 && run.invulnerable === 0 && speed >= DIFFICULTIES[run.difficulty].speed * 0.7) {
            const close = closestApproach(start.clone().sub(previousPlayer), end.clone().sub(player.position));
            if (close.fraction > 0 && close.fraction < 1 && close.distance > 7 && close.distance < 17) {
                projectile.userData.grazed = true; dodgeCooldown = 0.75;
                const points = dodgeReward(run); tone('evade', projectile.position); if (settings.sound) AudioEngine.flyby(soundPan(projectile.position)); showMessage(`CLOSE EVADE +${points}`, 'Energy +8 · keep your momentum', 1.3);
            }
        }
        projectile.position.copy(end); projectile.userData.age += dt;
        if (hitPlayer || wall || projectile.userData.age > 6) {
            if (hitPlayer) { damage('SHIELDS HIT', false, DIFFICULTIES[run.difficulty].projectileDamage, projectile.userData.velocity); effects.burst(player.position, 0xff638f, 5); }
            scene.remove(projectile); projectiles.splice(i, 1);
        }
    }
}
function activatePulse() {
    if (!usePulse(run.energy)) {
        showMessage(run.energy.pulseCooldown > 0 ? 'EMP RECHARGING' : 'ENERGY LOW', run.energy.pulseCooldown > 0 ? 'Keep moving while the pulse recovers' : 'Release boost or fly a recharge gate · EMP needs 45 energy', 1.6, 1); return;
    }
    pulseFlash = 0.55; tone('pulse'); effects.ring(player.position, 0x61ffe0, ENERGY.pulseRadius, 0.6, player.quaternion);
    run.pulses++;
    let cleared = 0, disrupted = 0;
    for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].position.distanceTo(player.position) <= ENERGY.pulseRadius) {
        effects.burst(projectiles[i].position, 0x61ffe0, 3); scene.remove(projectiles[i]); projectiles.splice(i, 1); cleared++;
    }
    for (const ship of [...enemies]) if (ship.position.distanceTo(player.position) <= ENERGY.pulseRadius) {
        ship.userData.stunned = 3; ship.userData.charge = 0; ship.userData.pendingShots.length = 0; ship.userData.exposed = true; disrupted++; hurtEnemy(ship, ship.userData.boss ? 4 : 1, true);
    }
    showMessage('EMP DISCHARGED', `${cleared} shots cleared · ${disrupted} hostiles disrupted · energy −45`, 2.3, 2);
}

function updateHud() {
    el('hud-speed').textContent = String(Math.round(speed * 3.6));
    el('cruise-throttle').hidden = false; el('pulse-box').hidden = run.mode === 'cruise';
    el('cruise-pace').textContent = `${Math.round(throttleSetting * 3.6)}km/h`;
    el('afterburner-button').classList.toggle('ignited', boostActive); el('afterburner-button').setAttribute('aria-pressed', String(boostActive));
    el('afterburner-button').innerHTML = boostActive ? 'AFTERBURNER <b>IGNITED</b>' : 'AFTERBURNER <kbd>SHIFT</kbd>';
    el('hud-alt').textContent = `${Math.round(player.position.y)}m`;
    el('hud-score').textContent = String(run.score).padStart(6, '0'); el('hud-shield').textContent = `${Math.ceil(run.shields)}%`;
    el('score-label').textContent = run.mode === 'cruise' ? 'DISTANCE / KM' : 'SCORE';
    if (run.mode === 'cruise') el('hud-score').textContent = (flightDistance / 1000).toFixed(1);
    el('shield-fill').style.width = `${run.shields}%`; el('shield-box').classList.toggle('low', run.shields < 35);
    el('hud-clock').textContent = run.mode === 'mission' ? formatTime(run.remaining) : formatTime(run.elapsed);
    el('clock-label').textContent = run.mode === 'mission' ? 'CONTRACT' : run.mode === 'practice' ? 'PRACTICE' : 'FLIGHT TIME';
    el('clock-box').classList.toggle('low', run.mode === 'mission' && run.remaining < 30);
    el('hud-energy').textContent = `${Math.floor(run.energy.amount)}%`;
    el('energy-hint').textContent = settings.controls === 'touch' || coarsePointer.matches || window.innerWidth <= 700 ? 'BOOST' : controls.controller ? 'RB / BOOST' : 'SHIFT / BOOST';
    el('pulse-key').textContent = controls.controller ? 'B' : 'F';
    el('energy-fill').style.width = `${run.energy.amount}%`;
    el('energy-box').classList.toggle('low', run.energy.amount < ENERGY.pulseCost);
    el('pulse-status').textContent = run.energy.pulseCooldown > 0 ? `${Math.ceil(run.energy.pulseCooldown)}s` : run.energy.amount < ENERGY.pulseCost ? 'LOW POWER' : 'READY';
    el('pulse-box').classList.toggle('ready', run.energy.pulseCooldown === 0 && run.energy.amount >= ENERGY.pulseCost);
    el('pulse-fill').style.width = `${(1 - run.energy.pulseCooldown / ENERGY.pulseCooldown) * 100}%`;
    el('combo-fill').style.width = `${run.combo / FLIGHT.comboWindow * 100}%`;
    el('hud-combo').textContent = run.combo > 0 && run.streak > 0 ? `×${run.multiplier} / ${run.streak} KILL CHAIN` : 'CHAIN TARGETS FOR ×4';
    const sector = Math.min(2, run.sector);
    el('hud-sector').textContent = run.mode === 'practice' ? 'FLIGHT SCHOOL' : run.mode === 'mission' ? `0${sector + 1} / 03 · ${SECTORS[sector].name}` : `PATROL ${run.sector + 1} · ENDLESS HUNT`;
    el('hud-objective').textContent = run.mode === 'practice' ? lesson.step < LESSONS.length ? `SKILL ${lesson.step + 1} / ${LESSONS.length} · ${LESSONS[lesson.step].goal}` : 'ALL SKILLS COMPLETE · FLY FREELY'
        : boss ? 'Destroy the Sentinel · fire when its shield drops'
        : run.mode === 'mission' ? `${run.sectorKills} / ${SECTORS[sector].quota} HOSTILES CLEARED` : `${run.kills} HOSTILES CLEARED`;
    if (run.mode === 'cruise') {
        const districts = ['LUMEN WARD', 'AFTERGLOW', 'THE NEON MILE', 'ECHO DISTRICT', 'SKYLINE COMMONS'];
        const district = Math.abs(Math.floor(player.position.x / 1200) * 7 + Math.floor(player.position.z / 1200) * 3) % districts.length;
        el('hud-sector').textContent = `SUNSET CRUISE / ${districts[district]}`; el('hud-objective').textContent = 'No deadline · no damage · follow your own line';
        el('hud-combo').textContent = `${run.gates} GATES · FLY FREELY`; el('clock-label').textContent = 'AIRBORNE';
    }
    const fill = run.mode === 'practice' ? (lesson.step + (lesson.step < LESSONS.length ? lessonProgress(lesson, run) : 0)) / LESSONS.length
        : boss ? 1 - boss.userData.health / boss.userData.maxHealth : run.sectorKills / (run.mode === 'mission' ? SECTORS[sector].quota : 6 + run.sector * 2);
    el('objective-fill').style.width = `${Math.min(100, fill * 100)}%`;
    el('coach-panel').hidden = run.mode !== 'practice';
    if (run.mode === 'practice') {
        const complete = lesson.step >= LESSONS.length, current = LESSONS[lesson.step];
        el('coach-step').textContent = complete ? 'WINGS EARNED' : `FLIGHT SCHOOL / ${lesson.step + 1} OF ${LESSONS.length}`;
        el('coach-title').textContent = complete ? 'YOU ARE CLEARED TO FLY' : current.title;
        el('coach-detail').textContent = complete ? 'Keep flying freely, or pause to finish. Select Sector intercept on the flight deck when you are ready.'
            : settings.controls === 'flightstick' && lesson.step === 0 ? 'Centre the cursor to engage. Move it a little left, then right. Return it to the centre circle to hold your heading. Arrows or the left stick also steer.'
            : settings.controls === 'flightstick' && lesson.step === 1 ? 'Move the cursor gently above, then below the centre circle. Return to centre to stop pitching. W / S adjusts throttle in this control style.'
            : lesson.step === 4 && settings.autoFire ? 'Line up the white lead diamond. Automatic cannons fire on clear targets. Brake for precision and clear two scouts.' : current.detail;
        el('coach-progress').style.width = `${lessonProgress(lesson, run) * 100}%`;
    }
    el('boss-panel').hidden = !boss;
    if (boss) {
        el('boss-percent').textContent = `${Math.max(0, Math.ceil(boss.userData.health / boss.userData.maxHealth * 100))}%`;
        el('boss-health').style.width = `${Math.max(0, boss.userData.health / boss.userData.maxHealth) * 100}%`;
        el('boss-phase').textContent = (boss.userData.phaseTwo ? 'OVERLOAD / ' : '') + (boss.userData.exposed ? 'CORE EXPOSED' : 'SHIELDS UP');
        el('boss-panel').classList.toggle('exposed', boss.userData.exposed);
    }
    el('flight-mode').textContent = currentInput.drift ? 'DRIFT · RELEASE ALT / LB TO RECOUPLE' : leveling ? 'RECOVERING LEVEL FLIGHT' : currentInput.brake ? 'RETRO THRUST / BRAKE' : boostActive ? 'AFTERBURNER' : settings.controls === 'mouse' && document.pointerLockElement !== renderer.domElement
        ? controls.captureDenied ? 'DRAG VIEW TO AIM + FIRE' : 'CLICK VIEW FOR MOUSE AIM' : run.mode === 'cruise' ? 'SUNSET CRUISE' : settings.autoFire ? 'AUTO CANNONS ARMED' : controls.controller ? 'GAMEPAD LINKED' : settings.stabilized ? 'ASSISTED FLIGHT' : 'MANUAL FLIGHT';
    let warning = '';
    if (player.position.y < 32) warning = 'LOW ALTITUDE · PULL UP';
    else if (player.position.y > 350) warning = 'FLIGHT CEILING · DESCEND';
    else {
        const lookAhead = player.position.clone().addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion), speed * 1.25);
        if (city.segmentHit(player.position, lookAhead, 3)) warning = 'OBSTACLE AHEAD · BRAKE / TURN';
        else if (enemies.some(ship => ship.userData.charge > 0)) warning = 'HOSTILE CHARGING · CHANGE COURSE';
        else if (projectiles.some(shot => shot.position.distanceToSquared(player.position) < 240 ** 2)) warning = 'INCOMING FIRE · EVADE / F EMP';
        else if (currentInput.boost && run.energy.locked) warning = 'BOOST EMPTY · RELEASE BOOST TO REARM';
    }
    if (el('flight-warning').textContent !== warning) el('flight-warning').textContent = warning;
    document.body.classList.toggle('boosting', boostActive && !settings.reducedMotion);
    document.body.classList.toggle('reduced-motion', settings.reducedMotion);
    drawRadar();
}
function drawRadar() {
    const canvas = el<HTMLCanvasElement>('radar'), ctx = canvas.getContext('2d')!;
    const center = 74, radius = 60, range = 1050;
    ctx.clearRect(0, 0, 148, 148); ctx.fillStyle = '#04131be0'; ctx.beginPath(); ctx.arc(center, center, 69, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2b6170'; ctx.lineWidth = 1;
    for (const r of [30, 60]) { ctx.beginPath(); ctx.arc(center, center, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = '#23505c'; ctx.beginPath(); ctx.moveTo(center, 12); ctx.lineTo(center, 136); ctx.moveTo(12, center); ctx.lineTo(136, center); ctx.stroke();
    const sin = Math.sin(flightAttitude.heading), cos = Math.cos(flightAttitude.heading);
    const point = (position: any, color: string, size: number, ring = false) => {
        const dx = position.x - player.position.x, dz = position.z - player.position.z;
        let x = (dx * cos - dz * sin) / range * radius, y = (dx * sin + dz * cos) / range * radius;
        const scale = Math.max(1, Math.hypot(x, y) / radius); x = center + x / scale; y = center + y / scale;
        ctx.fillStyle = ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); if (ring) ctx.stroke(); else ctx.fill();
    };
    for (const ship of enemies) point(ship.position, ship.userData.charge > 0 ? '#ff476f' : ship.userData.boss ? '#ff5f8c' : ship === target ? '#ffffff' : '#f4b875', ship.userData.boss ? 5 : ship === target ? 3.5 : 2.5);
    if (gate) point(gate.position, '#57ffdb', 4, true);
    for (const shot of projectiles) if (shot.position.distanceToSquared(player.position) < 500 ** 2) point(shot.position, '#ff526b', 1.4);
    ctx.fillStyle = '#83eaff'; ctx.beginPath(); ctx.moveTo(center, center - 6); ctx.lineTo(center - 4, center + 4); ctx.lineTo(center + 4, center + 4); ctx.closePath(); ctx.fill();
}
function simulate(dt: number) {
    tickRun(run, dt); if (run.outcome !== 'flying') { finishRun(); return; }
    currentInput = controls.sample(dt, pad);
    if (currentInput.view) cycleView();
    if (currentInput.throttle) setThrottle(throttleSetting + currentInput.throttle * 5);
    if (currentInput.throttleAxis) setThrottle(throttleSetting + currentInput.throttleAxis * dt * 55);
    dodgeCooldown = Math.max(0, dodgeCooldown - dt); damageDirectionTime = Math.max(0, damageDirectionTime - dt); threatToneCooldown = Math.max(0, threatToneCooldown - dt);
    el('damage-direction').hidden = damageDirectionTime === 0;
    hitTime = Math.max(0, hitTime - dt); killTime = Math.max(0, killTime - dt); blockedTime = Math.max(0, blockedTime - dt);
    manageEnemies(dt); const previous = updateFlight(dt, currentInput); if (state !== 'playing') return;
    updateTarget();
    let automaticShot = false;
    if (settings.autoFire && target && (!target.userData.boss || target.userData.exposed)) {
        if (canAssist) automaticShot = true;
        else if (!settings.aimAssist) {
            const leadBox = target.userData.box.clone().translate(targetAim.clone().sub(target.position)).expandByScalar(-0.6);
            automaticShot = shotPathClear
                && segmentBoxFraction(player.position, player.position.clone().addScaledVector(forward, FLIGHT.laserRange), leadBox) !== null;
        }
    }
    const trigger = currentInput.fire || automaticShot;
    const cannon = cannonStep(shotCooldown, dt, trigger); shotCooldown = cannon.cooldown;
    if (cannon.fire) fireLaser();
    updateLasers(dt); if (state !== 'playing') return;
    updateProjectiles(dt, previous); if (state !== 'playing') return;
    updateDirector(dt); effects.update(dt);
    if (tickLesson(lesson, run, { yaw: flightDelta.yaw, pitch: flightDelta.pitch, brake: currentInput.brake, boost: boostActive, speed,
        level: currentInput.level, levelled: Math.abs(flightAttitude.pitch) < 0.025 && Math.abs(flightAttitude.bank) < 0.025 }, dt)) {
        tone(lesson.step === LESSONS.length ? 'victory' : 'gate');
        if (lesson.step === 6) {
            if (gate) disposeObject(scene, gate, pooled); gate = null; spawnGate();
        }
        updateHud();
    }
    if (run.mode === 'mission' && run.remaining < 30 && !lastClockWarning) { lastClockWarning = true; showMessage('30 SECONDS LEFT', 'Finish the contract · recharge gates can buy more time', 3.5, 2); tone('warning'); }
    messageTime = Math.max(0, messageTime - dt);
    if (messageTime === 0) { el('event-message').hidden = true; messagePriority = 0; }
    flashTime = Math.max(0, flashTime - dt); pulseFlash = Math.max(0, pulseFlash - dt);
    document.body.classList.toggle('damaged', flashTime > 0); document.body.classList.toggle('emp-active', pulseFlash > 0);
    hudTimer += dt; if (hudTimer > 0.08) { updateHud(); hudTimer = 0; }
}
function animate(timestamp: number) {
    requestAnimationFrame(animate);
    const elapsedFrame = Math.max(0, timestamp - lastFrame);
    const dt = Math.min(Math.max((timestamp - lastFrame) / 1000, 0), 0.1); lastFrame = timestamp;
    pad = controls.pollPadPause();
    if (state === 'playing') {
        let remaining = dt;
        while (remaining > 1e-8 && state === 'playing') { const step = Math.min(remaining, 1 / 120); simulate(step); remaining -= step; }
        player.updateMatrixWorld(true); camera.updateMatrixWorld(true); updateTarget(true);
        airflow.update(dt, speed, boostActive && !settings.reducedMotion);
        AudioEngine.updateFlight({ speed, boost: boostActive, brake: currentInput.brake, turn: Math.abs(yawRate) + Math.abs(pitchRate), shields: run.shields,
            intensity: boss ? 1 : run.mode === 'cruise' || run.mode === 'practice' ? .1 : Math.min(1, run.sector * .28 + projectiles.length * .06) });
        needsRender = true;
    } else if (state === 'results' && (effects.particles.length || effects.rings.length)) { effects.update(dt); needsRender = true; }
    if (needsRender) {
        const started = performance.now(); effects.render(); camera.updateMatrixWorld(true); city.cull(camera); presentation.render(scene, camera); needsRender = false;
        if (diagnostics && state === 'playing') {
            measuredTime += elapsedFrame; measuredFrames++; renderTime += performance.now() - started;
            if (measuredTime >= 1500) {
                el('render-stats').textContent = `${Math.round(measuredFrames / measuredTime * 1000)} FPS · ${(renderTime / measuredFrames).toFixed(1)}ms submit · ${renderer.info.render.calls} draws · ${Math.round(renderer.info.render.triangles / 1000)}k triangles · ${renderer.info.memory.geometries} geometries`;
                measuredTime = measuredFrames = renderTime = 0;
            }
        }
    }
}
init();

// END GAME RUNTIME

return {pause:()=>{pauseGame();controls?.release();musicPreview=false;applyAudio();},running:()=>state==='playing',resize:()=>{if(!presentation)return;camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();presentation.resize(window.innerWidth,window.innerHeight,settings.quality);needsRender=true;},resetClock:()=>{lastFrame=performance.now();},dispose:()=>renderer?.dispose()};
}
