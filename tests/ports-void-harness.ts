import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as balance from '../src/arcade-ports/void/balance.ts';
import { shopDiagram, shipLoadout } from '../src/arcade-ports/void/shop-art.ts';
import * as progress from '../src/arcade-ports/void/progress.ts';
import { drawPlayer, drawEnemy } from '../src/arcade-ports/void/visuals.ts';
import * as music from '../src/arcade-ports/void/music.ts';
import * as ending from '../src/arcade-ports/void/ending.ts';
import * as victoryAudio from '../src/arcade-ports/void/victory-audio.ts';
import * as flightControls from '../src/arcade-ports/void/flight-controls.ts';
import * as effectsRandom from '../src/arcade-ports/void/effects-random.ts';

// Keep long simulations on one consistent source revision while development continues.
const gameSource=readFileSync(new URL('../src/arcade-ports/void/controller.ts',import.meta.url),'utf8')
    .split('// BEGIN GAME RUNTIME')[1].split('// END GAME RUNTIME')[0]
    .replace(/^import [\s\S]*?;\s*/gm,'').replace(/^export .*;$/gm,'').replace('Game.init();','');

export function loadGame(seed = 1, width = 1200, height = 800) {
    const elements = new Map();
    const context2d = new Proxy({}, { get: (_,key) => key==='createLinearGradient'||key==='createRadialGradient'?()=>({addColorStop(){}}):()=>{} });
    const element = () => ({ style: {setProperty(){}}, dataset:{}, innerText: '', innerHTML: '', disabled: false, open:false, showModal(){this.open=true;},close(){this.open=false;},focus(){},classList:{add(){},remove(){},toggle(){}},setAttribute(){},
        getContext: () => context2d, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => element() });
    const document = { hidden: false, getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
        createElement: element, addEventListener() {}, querySelectorAll:()=>[], querySelector:()=>null, body: element() };
    let state = seed >>> 0;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2**32; };
    const math = Object.create(Math); math.random = random;
    const window = { innerWidth: width, innerHeight: height, addEventListener() {} };
    const sandbox = vm.createContext({scope:{rect(){return undefined;}}, ...balance, ...progress, ...music, ...ending, ...victoryAudio, ...flightControls, ...effectsRandom, shopDiagram, shipLoadout, drawPlayer, drawEnemy, window, document, Math: math, requestAnimationFrame() {}, cancelAnimationFrame(){}, setTimeout() {} });
    vm.runInContext(gameSource + '\nglobalThis.runtime = { Game, Player, Enemy, Bullet, Missile, ClusterMissile, ClusterSeeker, Coin, Powerup, LootCrate, AudioEngine, buyUpgrade, buyRepair, requestSalvage, cancelSalvage, confirmSalvage, salvageModule, closeShop, continueEndless };', sandbox);
    const runtime = sandbox.runtime;
    const originalAudio={...runtime.AudioEngine};
    for (const key of Object.keys(runtime.AudioEngine)) if (typeof runtime.AudioEngine[key] === 'function') runtime.AudioEngine[key] = () => {};
    runtime.Game.start();
    return { ...runtime, elements, window, random,originalAudio };
}
